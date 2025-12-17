const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')

// GET /api/players/by-slug/:slug - Get player details by slug (simplified)
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    // Normalize slug: remove all non-alphanumeric characters, lowercase
    // "fernando-tatis-jr" -> "fernandotatisjr"
    // "vladimir-guerrero" -> "vladimirguerrero"
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '')

    if (!normalizedSlug) {
      return res.status(400).json({
        error: 'Invalid slug format',
        message: 'Slug cannot be empty'
      })
    }

    console.log(`🔍 Searching for player with slug: "${slug}" -> normalized: "${normalizedSlug}"`)

    // Match against:
    // 0. Stored slug in database (exact match after normalization)
    // 1. first_name + last_name (e.g., "fernandotatisjr")
    // 2. nick_name + last_name (e.g., "bighurtthomas")
    // 3. first_name + nick_name + last_name (e.g., "frankbighurtthomas")
    // Get ALL matches, ordered by card_count DESC to prefer players with more cards
    const results = await prisma.$queryRaw`
      SELECT
        p.*,
        display_card_photo.photo_url as display_card_front_image
      FROM player p
      LEFT JOIN card display_card ON p.display_card = display_card.card_id
      LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
      LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
      WHERE
        LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ISNULL(p.slug, ''),
          ' ', ''), '.', ''), '''', ''), '-', ''), ',', '')) = ${normalizedSlug}
        OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ISNULL(p.first_name, '') + ISNULL(p.last_name, ''),
          ' ', ''), '.', ''), '''', ''), '-', ''), ',', '')) = ${normalizedSlug}
        OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ISNULL(p.nick_name, '') + ISNULL(p.last_name, ''),
          ' ', ''), '.', ''), '''', ''), '-', ''), ',', '')) = ${normalizedSlug}
        OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ISNULL(p.first_name, '') + ISNULL(p.nick_name, '') + ISNULL(p.last_name, ''),
          ' ', ''), '.', ''), '''', ''), '-', ''), ',', '')) = ${normalizedSlug}
      ORDER BY p.card_count DESC, p.player_id ASC
    `

    if (results.length === 0) {
      console.log(`❌ No player found for slug: "${slug}"`)
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found for slug: ${slug}`
      })
    }

    const matchCount = results.length
    console.log(`✅ Found ${matchCount} matching player(s): ${results[0].first_name} ${results[0].last_name} (ID: ${results[0].player_id}, Cards: ${results[0].card_count})`)
    if (matchCount > 1) {
      console.log(`   Other matches: ${results.slice(1).map(p => `${p.first_name} ${p.last_name} (${p.card_count} cards)`).join(', ')}`)
    }

    // Convert BigInt to Number for JSON serialization
    const serializedResults = results.map(row => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    })

    const player = serializedResults[0]

    // Prepare alternate players list (if there are multiple matches)
    const alternates = matchCount > 1 ? serializedResults.slice(1).map(p => ({
      player_id: p.player_id,
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      card_count: p.card_count
    })) : []
    
    // Get team statistics for team circles with card counts
    const teamResults = await prisma.$queryRaw`
      SELECT DISTINCT 
        t.team_id,
        t.name as team_name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${player.player_id}
      GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
    `
    
    const teams = teamResults.map(team => {
      // Convert BigInt fields to Number and fix field names
      const serialized = {}
      Object.keys(team).forEach(key => {
        serialized[key] = typeof team[key] === 'bigint' ? Number(team[key]) : team[key]
      })
      
      // Rename team_name to name for frontend compatibility
      return {
        team_id: serialized.team_id,
        name: serialized.team_name,
        abbreviation: serialized.abbreviation,
        primary_color: serialized.primary_color,
        secondary_color: serialized.secondary_color,
        card_count: serialized.card_count
      }
    })
    
    // Calculate player statistics
    const statsResults = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT c.card_id) as total_cards,
        COUNT(DISTINCT CASE WHEN c.is_rookie = 1 THEN c.card_id END) as rookie_cards,
        COUNT(DISTINCT CASE WHEN c.is_autograph = 1 THEN c.card_id END) as autograph_cards,
        COUNT(DISTINCT CASE WHEN c.is_relic = 1 THEN c.card_id END) as relic_cards,
        COUNT(DISTINCT CASE WHEN c.print_run IS NOT NULL AND c.print_run > 0 THEN c.card_id END) as numbered_cards,
        COUNT(DISTINCT c.series) as unique_series
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${player.player_id}
    `
    
    const statsData = statsResults[0] || {}
    
    // Cards will be loaded via the separate cards API endpoint with infinite scrolling
    const cards = []
    const stats = {
      total_cards: Number(statsData.total_cards) || 0,
      rookie_cards: Number(statsData.rookie_cards) || 0,
      autograph_cards: Number(statsData.autograph_cards) || 0,
      relic_cards: Number(statsData.relic_cards) || 0,
      numbered_cards: Number(statsData.numbered_cards) || 0,
      unique_series: Number(statsData.unique_series) || 0
    }
    
    const response = {
      player,
      cards,
      teams,
      stats
    }

    // Include alternate players if there are multiple matches
    if (alternates.length > 0) {
      response.alternate_players = alternates
    }

    res.json(response)
    
  } catch (error) {
    console.error('Error fetching player details:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player details',
      details: error.message
    })
  }
})

// GET /api/players/:id - Get player details by ID
router.get('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return res.status(400).json({
        error: 'Invalid player ID',
        message: 'Player ID must be a number'
      })
    }

    console.log(`🔍 Fetching player with ID: ${playerId}`)

    // Get player by ID
    const results = await prisma.$queryRaw`
      SELECT
        p.*,
        display_card_photo.photo_url as display_card_front_image
      FROM player p
      LEFT JOIN card display_card ON p.display_card = display_card.card_id
      LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
      LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
      WHERE p.player_id = ${playerId}
    `

    if (results.length === 0) {
      console.log(`❌ No player found with ID: ${playerId}`)
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found with ID: ${playerId}`
      })
    }

    console.log(`✅ Found player: ${results[0].first_name} ${results[0].last_name}`)

    // Convert BigInt to Number for JSON serialization
    const player = {}
    Object.keys(results[0]).forEach(key => {
      player[key] = typeof results[0][key] === 'bigint' ? Number(results[0][key]) : results[0][key]
    })

    // Get team statistics for team circles with card counts
    const teamResults = await prisma.$queryRaw`
      SELECT DISTINCT
        t.team_id,
        t.name as team_name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${playerId}
      GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
    `

    const teams = teamResults.map(team => ({
      team_id: Number(team.team_id),
      name: team.team_name,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      card_count: Number(team.card_count)
    }))

    // Get stats
    const statsResults = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT c.card_id) as total_cards,
        COUNT(DISTINCT CASE WHEN c.is_rookie = 1 THEN c.card_id END) as rookie_cards,
        COUNT(DISTINCT CASE WHEN c.is_autograph = 1 THEN c.card_id END) as autograph_cards,
        COUNT(DISTINCT CASE WHEN c.is_relic = 1 THEN c.card_id END) as relic_cards,
        COUNT(DISTINCT CASE WHEN c.print_run IS NOT NULL AND c.print_run > 0 THEN c.card_id END) as numbered_cards,
        COUNT(DISTINCT c.series) as unique_series
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${playerId}
    `

    const statsData = statsResults[0] || {}
    const stats = {
      total_cards: Number(statsData.total_cards) || 0,
      rookie_cards: Number(statsData.rookie_cards) || 0,
      autograph_cards: Number(statsData.autograph_cards) || 0,
      relic_cards: Number(statsData.relic_cards) || 0,
      numbered_cards: Number(statsData.numbered_cards) || 0,
      unique_series: Number(statsData.unique_series) || 0
    }

    res.json({
      player,
      cards: [], // Cards loaded via separate API with infinite scrolling
      teams,
      stats
    })

  } catch (error) {
    console.error('Error fetching player by ID:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player details',
      details: error.message
    })
  }
})

// POST /api/players/track-visit - Track player visit (accepts both authenticated and anonymous visits)
router.post('/track-visit', async (req, res) => {
  try {
    const { player_id } = req.body
    
    if (!player_id) {
      return res.status(400).json({
        error: 'Missing player_id',
        message: 'player_id is required'
      })
    }

    // Check if player exists using raw query since Prisma model names don't match table names
    const playerExists = await prisma.$queryRaw`
      SELECT player_id FROM player WHERE player_id = ${BigInt(player_id)}
    `

    if (playerExists.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found with ID: ${player_id}`
      })
    }

    // For authenticated users, track in user_player table
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken')
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = BigInt(decoded.userId)

        // Check if relationship already exists
        const existingRelation = await prisma.$queryRaw`
          SELECT user_player_id FROM user_player 
          WHERE [user] = ${userId} AND player = ${BigInt(player_id)}
        `

        if (existingRelation.length === 0) {
          // Create new user-player relationship
          await prisma.$executeRaw`
            INSERT INTO user_player ([user], player, created)
            VALUES (${userId}, ${BigInt(player_id)}, GETDATE())
          `
        } else {
          // Update the created timestamp to track latest visit
          await prisma.$executeRaw`
            UPDATE user_player 
            SET created = GETDATE()
            WHERE user_player_id = ${existingRelation[0].user_player_id}
          `
        }
        
        return res.json({ success: true, tracked: 'authenticated' })
      } catch (jwtError) {
        // JWT verification failed, treat as anonymous
      }
    }

    // For anonymous users, just return success without tracking
    res.json({ success: true, tracked: 'anonymous' })

  } catch (error) {
    console.error('Error tracking player visit:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to track player visit',
      details: error.message
    })
  }
})

module.exports = router