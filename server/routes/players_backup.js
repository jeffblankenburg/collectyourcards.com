const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// Helper function to create player slug
const createPlayerSlug = (firstName, lastName) => {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
}

// Helper function to find player by slug
const findPlayerBySlug = async (slug) => {
  try {
    console.log('Finding player by slug:', slug)
    // Parse slug back to name parts (case-insensitive matching via SQL)
    const nameParts = slug.toLowerCase().split('-')
    console.log('Name parts:', nameParts)
    
    if (nameParts.length < 2) {
      console.log('Not enough name parts')
      return null
    }
    
    // Use raw SQL for case-insensitive search since SQL Server doesn't support Prisma's mode parameter
    let player = null
    
    // Try simple first-last combination first
    if (nameParts.length === 2) {
      console.log('Trying simple first-last combination')
      const results = await prisma.$queryRaw`
        SELECT TOP 1 * FROM player 
        WHERE LOWER(first_name) LIKE ${`%${nameParts[0]}%`} 
        AND LOWER(last_name) LIKE ${`%${nameParts[1]}%`}
      `
      
      console.log('Raw query results:', results.length, 'found')
      
      if (results.length > 0) {
        console.log('Found player with ID:', results[0].player_id)
        // Get the full player record with relations using the found ID
        player = await prisma.player.findUnique({
          where: { player_id: Number(results[0].player_id) },
          include: {
            player_teams: {
              include: {
                team_rel: true
              }
            }
          }
        })
        console.log('Player with relations:', player ? 'found' : 'not found')
      }
    }
    
    // If not found and we have more parts, try other combinations
    if (!player && nameParts.length >= 3) {
      console.log('Trying complex name combination')
      // Try first name + combined remaining parts as last name
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      
      const results = await prisma.$queryRaw`
        SELECT TOP 1 * FROM player 
        WHERE LOWER(first_name) LIKE ${`%${firstName}%`} 
        AND LOWER(last_name) LIKE ${`%${lastName}%`}
      `
      
      if (results.length > 0) {
        player = await prisma.player.findUnique({
          where: { player_id: Number(results[0].player_id) },
          include: {
            player_teams: {
              include: {
                team_rel: true
              }
            }
          }
        })
      }
    }
    
    console.log('Final result:', player ? 'player found' : 'no player')
    return player
  } catch (error) {
    console.error('Error in findPlayerBySlug:', error)
    return null
  }
}

// GET /api/players/debug/duplicates/:firstName/:lastName - Check for duplicate player names
router.get('/debug/duplicates/:firstName/:lastName', async (req, res) => {
  try {
    const { firstName, lastName } = req.params
    
    const results = await prisma.$queryRaw`
      SELECT p.player_id, p.first_name, p.last_name, p.card_count, p.is_hof,
             CASE 
               WHEN LOWER(p.first_name) = ${firstName.toLowerCase()} AND LOWER(p.last_name) = ${lastName.toLowerCase()} THEN 100
               WHEN LOWER(p.first_name) LIKE ${`${firstName.toLowerCase()}%`} AND LOWER(p.last_name) LIKE ${`${lastName.toLowerCase()}%`} THEN 90
               ELSE 80
             END as name_match_score,
             CASE WHEN p.is_hof = 1 THEN 20 ELSE 0 END as hof_bonus
      FROM player p 
      WHERE LOWER(first_name) LIKE ${`%${firstName.toLowerCase()}%`} 
      AND LOWER(last_name) LIKE ${`%${lastName.toLowerCase()}%`}
      ORDER BY (CASE 
                 WHEN LOWER(p.first_name) = ${firstName.toLowerCase()} AND LOWER(p.last_name) = ${lastName.toLowerCase()} THEN 100
                 WHEN LOWER(p.first_name) LIKE ${`${firstName.toLowerCase()}%`} AND LOWER(p.last_name) LIKE ${`${lastName.toLowerCase()}%`} THEN 90
                 ELSE 80
               END + CASE WHEN p.is_hof = 1 THEN 20 ELSE 0 END + (p.card_count / 100)) DESC
    `
    
    const serialized = results.map(player => {
      const obj = {}
      Object.keys(player).forEach(key => {
        obj[key] = typeof player[key] === 'bigint' ? Number(player[key]) : player[key]
      })
      obj.total_score = Number(player.name_match_score) + Number(player.hof_bonus) + (Number(player.card_count) / 100)
      return obj
    })
    
    res.json({
      searchTerms: { firstName, lastName },
      count: serialized.length,
      players: serialized
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/players/debug/cards/:playerId - Debug route to test card queries
router.get('/debug/cards/:playerId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId)
    
    // Test the card query step by step
    console.log('Testing card query for player ID:', playerId)
    
    // First, test if player_team records exist for this player
    const playerTeams = await prisma.$queryRaw`
      SELECT pt.player_team_id, pt.player, pt.team, t.name as team_name
      FROM player_team pt
      JOIN team t ON pt.team = t.team_id
      WHERE pt.player = ${playerId}
    `
    
    console.log('Player teams found:', playerTeams.length)
    
    // Test if card_player_team records exist and get some sample cards
    let cardPlayerTeams = []
    let sampleCards = []
    
    if (playerTeams.length > 0) {
      // Test card_player_team connection for first team
      cardPlayerTeams = await prisma.$queryRaw`
        SELECT TOP 5 cpt.card_player_team_id, cpt.card, cpt.player_team
        FROM card_player_team cpt
        WHERE cpt.player_team = ${Number(playerTeams[0].player_team_id)}
      `
      
      console.log('Card player team records found:', cardPlayerTeams.length)
      
      // If we have card-player-team records, get some sample cards
      if (cardPlayerTeams.length > 0) {
        sampleCards = await prisma.$queryRaw`
          SELECT TOP 5 
            c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic,
            s.name as series_name
          FROM card c
          JOIN series s ON c.series = s.series_id
          JOIN card_player_team cpt ON c.card_id = cpt.card
          WHERE cpt.player_team = ${Number(playerTeams[0].player_team_id)}
        `
        
        console.log('Sample cards found:', sampleCards.length)
      }
    }
    
    res.json({
      playerId,
      playerTeams: playerTeams.map(pt => {
        const serialized = {}
        Object.keys(pt).forEach(key => {
          serialized[key] = typeof pt[key] === 'bigint' ? Number(pt[key]) : pt[key]
        })
        return serialized
      }),
      cardPlayerTeamRecords: cardPlayerTeams.length,
      sampleCards: sampleCards.map(card => {
        const serialized = {}
        Object.keys(card).forEach(key => {
          serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
        })
        return serialized
      })
    })
    
  } catch (error) {
    console.error('Debug cards error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/players/debug/slug/:slug - Debug route to test slug matching
router.get('/debug/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const nameParts = slug.toLowerCase().split('-')
    
    // Test the LIKE query that's failing
    const results = await prisma.$queryRaw`
      SELECT TOP 1 * FROM player 
      WHERE LOWER(first_name) LIKE ${`%${nameParts[0]}%`} 
      AND LOWER(last_name) LIKE ${`%${nameParts[1]}%`}
    `
    
    // Convert BigInt to Number for JSON serialization
    const serializedResults = results.map(row => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    })
    
    res.json({ 
      slug,
      nameParts,
      searchTerms: {
        firstName: `%${nameParts[0]}%`,
        lastName: `%${nameParts[1]}%`
      },
      results: serializedResults,
      count: results.length 
    })
  } catch (error) {
    console.error('Debug query error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/players/by-slug/:slug - Get player details by slug
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const nameParts = slug.toLowerCase().split('-')
    
    // Use the same simple approach as the debug route that works
    const results = await prisma.$queryRaw`
      SELECT TOP 1 * FROM player 
      WHERE LOWER(first_name) LIKE ${`%${nameParts[0]}%`} 
      AND LOWER(last_name) LIKE ${`%${nameParts[1]}%`}
    `
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found for slug: ${slug}`
      })
    }
    
    // Convert BigInt to Number for JSON serialization (exactly like debug route)
    const serializedResults = results.map(row => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    })

    const player = serializedResults[0]
    
    // Get player's cards with all necessary joins for display
    const limit = req.query.limit ? parseInt(req.query.limit) : 100
    const offset = req.query.offset ? parseInt(req.query.offset) : 0
    
    console.log(`Loading cards for player ${player.player_id} with limit=${limit}, offset=${offset}`)
    console.log('Query parameters:', req.query)
    console.log('Limit > 1000?', limit > 1000)
    
    // Get all cards when limit is high, otherwise use TOP
    let cardResults
    if (limit > 1000) {
      console.log('Getting ALL cards (no limit)')
      cardResults = await prisma.$queryRaw`
        SELECT 
          c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.sort_order, c.notes,
          s.name as series_name, s.series_id,
          col.name as color, col.hex_value as hex_color
        FROM card c
        JOIN series s ON c.series = s.series_id
        LEFT JOIN color col ON c.color = col.color_id
        WHERE c.card_id IN (
          SELECT DISTINCT c2.card_id 
          FROM card c2
          JOIN card_player_team cpt2 ON c2.card_id = cpt2.card
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          WHERE pt2.player = ${player.player_id}
        )
        ORDER BY s.name ASC, c.sort_order ASC
      `
    } else {
      console.log(`Getting TOP ${limit} cards`)
      cardResults = await prisma.$queryRaw`
        SELECT TOP ${limit}
          c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.sort_order, c.notes,
          s.name as series_name, s.series_id,
          col.name as color, col.hex_value as hex_color
        FROM card c
        JOIN series s ON c.series = s.series_id
        LEFT JOIN color col ON c.color = col.color_id
        WHERE c.card_id IN (
          SELECT DISTINCT c2.card_id 
          FROM card c2
          JOIN card_player_team cpt2 ON c2.card_id = cpt2.card
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          WHERE pt2.player = ${player.player_id}
        )
        ORDER BY s.name ASC, c.sort_order ASC
      `
    }
    
    // Get all player associations with teams for these cards
    const cardPlayerResults = await prisma.$queryRaw`
      SELECT 
        cpt.card as card_id,
        p.first_name,
        p.last_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.primary_color,
        t.secondary_color
      FROM card_player_team cpt
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      JOIN player p ON pt.player = p.player_id
      JOIN team t ON pt.team = t.team_id
      WHERE cpt.card IN (
        SELECT DISTINCT c2.card_id 
        FROM card c2
        JOIN card_player_team cpt2 ON c2.card_id = cpt2.card
        JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
        WHERE pt2.player = ${player.player_id}
      )
      ORDER BY cpt.card, p.last_name
    `
    
    // Group player and team data by card_id with proper player-team associations
    const cardPlayerTeamMap = {}
    cardPlayerResults.forEach(row => {
      const cardId = Number(row.card_id)
      
      if (!cardPlayerTeamMap[cardId]) {
        cardPlayerTeamMap[cardId] = {
          playerTeams: []
        }
      }
      
      const playerTeam = {
        player: {
          name: `${row.first_name} ${row.last_name}`,
          first_name: row.first_name,
          last_name: row.last_name
        },
        team: {
          team_id: Number(row.team_id),
          name: row.team_name,
          abbreviation: row.team_abbr,
          primary_color: row.primary_color,
          secondary_color: row.secondary_color
        }
      }
      
      cardPlayerTeamMap[cardId].playerTeams.push(playerTeam)
    })
    
    // Create player names map for backward compatibility
    const playerNamesMap = {}
    Object.keys(cardPlayerTeamMap).forEach(cardId => {
      const players = cardPlayerTeamMap[cardId].playerTeams.map(pt => pt.player.name)
      playerNamesMap[cardId] = players.join(' / ')
    })

    // Get teams this player has cards for with card counts
    const teamResults = await prisma.$queryRaw`
      SELECT t.team_id, t.name, t.city, t.abbreviation, t.primary_color, t.secondary_color,
             COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${player.player_id}
      GROUP BY t.team_id, t.name, t.city, t.abbreviation, t.primary_color, t.secondary_color
      ORDER BY card_count DESC, t.name ASC
    `

    // Calculate player statistics
    const statsResults = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_cards,
        SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_cards,
        SUM(CASE WHEN c.is_autograph = 1 THEN 1 ELSE 0 END) as autograph_cards,
        SUM(CASE WHEN c.is_relic = 1 THEN 1 ELSE 0 END) as relic_cards,
        SUM(CASE WHEN c.print_run IS NOT NULL THEN 1 ELSE 0 END) as numbered_cards,
        COUNT(DISTINCT c.series) as unique_series
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${player.player_id}
    `

    // Serialize all BigInt fields and transform to match frontend structure
    const cards = cardResults.map(card => {
      // Convert BigInt fields
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })
      
      const cardId = Number(serialized.card_id)
      
      // Transform to match frontend expected structure
      return {
        card_id: cardId,
        card_number: serialized.card_number,
        is_rookie: serialized.is_rookie,
        is_autograph: serialized.is_autograph,
        is_relic: serialized.is_relic,
        print_run: serialized.print_run,
        sort_order: serialized.sort_order,
        notes: serialized.notes,
        player_names: playerNamesMap[cardId] || '',
        card_player_teams: cardPlayerTeamMap[cardId]?.playerTeams || [],
        // Add nested structures for compatibility
        series_rel: {
          series_id: serialized.series_id,
          name: serialized.series_name
        },
        color_rel: serialized.color ? {
          color: serialized.color,
          hex_color: serialized.hex_color
        } : null
      }
    })

    const teams = teamResults.map(team => {
      const serialized = {}
      Object.keys(team).forEach(key => {
        serialized[key] = typeof team[key] === 'bigint' ? Number(team[key]) : team[key]
      })
      return serialized
    })

    const stats = statsResults[0] ? {
      total_cards: Number(statsResults[0].total_cards || 0),
      rookie_cards: Number(statsResults[0].rookie_cards || 0),
      autograph_cards: Number(statsResults[0].autograph_cards || 0),
      relic_cards: Number(statsResults[0].relic_cards || 0),
      numbered_cards: Number(statsResults[0].numbered_cards || 0),
      unique_series: Number(statsResults[0].unique_series || 0)
    } : {
      total_cards: 0,
      rookie_cards: 0,
      autograph_cards: 0,
      relic_cards: 0,
      numbered_cards: 0,
      unique_series: 0
    }

    res.json({
      player: player,
      cards: cards,
      teams: teams,
      stats: stats,
      total_cards: stats.total_cards
    })

  } catch (error) {
    console.error('Error fetching player details:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player details'
    })
  }
})

// GET /api/players/by-slug/:slug/cards/all - Get all cards for a player
router.get('/by-slug/:slug/cards/all', async (req, res) => {
  try {
    const { slug } = req.params
    const nameParts = slug.toLowerCase().split('-')
    
    // Find player using same method as main endpoint
    console.log('Looking for player with slug:', slug, 'name parts:', nameParts)
    const results = await prisma.$queryRaw`
      SELECT TOP 1 * FROM player 
      WHERE LOWER(first_name) LIKE ${`%${nameParts[0]}%`} 
      AND LOWER(last_name) LIKE ${`%${nameParts[1]}%`}
      ORDER BY (CASE 
                 WHEN LOWER(first_name) = ${nameParts[0]} AND LOWER(last_name) = ${nameParts[1]} THEN 100
                 WHEN LOWER(first_name) LIKE ${`${nameParts[0]}%`} AND LOWER(last_name) LIKE ${`${nameParts[1]}%`} THEN 90
                 ELSE 80
               END + CASE WHEN is_hof = 1 THEN 20 ELSE 0 END + (card_count / 100)) DESC
    `
    
    console.log('Query results:', results.length, results.length > 0 ? results[0] : 'no results')
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found for slug: ${slug}`
      })
    }
    
    // Convert BigInt fields
    const player = {}
    Object.keys(results[0]).forEach(key => {
      player[key] = typeof results[0][key] === 'bigint' ? Number(results[0][key]) : results[0][key]
    })

    // Get ALL player's cards using raw SQL (same approach as main endpoint)
    const cardResults = await prisma.$queryRaw`
      SELECT 
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.sort_order, c.notes,
        s.name as series_name, s.series_id,
        col.name as color, col.hex_value as hex_color
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      WHERE c.card_id IN (
        SELECT DISTINCT c2.card_id 
        FROM card c2
        JOIN card_player_team cpt2 ON c2.card_id = cpt2.card
        JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
        WHERE pt2.player = ${Number(player.player_id)}
      )
      ORDER BY s.name ASC, c.sort_order ASC
    `
    
    // Get all player associations with teams for these cards
    const cardPlayerResults = await prisma.$queryRaw`
      SELECT 
        cpt.card as card_id,
        p.first_name,
        p.last_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.primary_color,
        t.secondary_color
      FROM card_player_team cpt
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      JOIN player p ON pt.player = p.player_id
      JOIN team t ON pt.team = t.team_id
      WHERE cpt.card IN (
        SELECT DISTINCT c2.card_id 
        FROM card c2
        JOIN card_player_team cpt2 ON c2.card_id = cpt2.card
        JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
        WHERE pt2.player = ${Number(player.player_id)}
      )
      ORDER BY cpt.card, p.last_name
    `
    
    // Group player and team data by card_id
    const cardPlayerTeamMap = {}
    cardPlayerResults.forEach(row => {
      const cardId = Number(row.card_id)
      
      if (!cardPlayerTeamMap[cardId]) {
        cardPlayerTeamMap[cardId] = []
      }
      
      const playerTeam = {
        player: {
          name: `${row.first_name} ${row.last_name}`,
          first_name: row.first_name,
          last_name: row.last_name
        },
        team: {
          team_id: Number(row.team_id),
          name: row.team_name,
          abbreviation: row.team_abbr,
          primary_color: row.primary_color,
          secondary_color: row.secondary_color
        }
      }
      
      cardPlayerTeamMap[cardId].push(playerTeam)
    })

    // Transform cards to match frontend structure
    const cards = cardResults.map(card => {
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })
      
      const cardId = Number(serialized.card_id)
      
      return {
        card_id: cardId,
        card_number: serialized.card_number,
        is_rookie: serialized.is_rookie,
        is_autograph: serialized.is_autograph,
        is_relic: serialized.is_relic,
        print_run: serialized.print_run,
        sort_order: serialized.sort_order,
        notes: serialized.notes,
        card_player_teams: cardPlayerTeamMap[cardId] || [],
        series_rel: {
          series_id: serialized.series_id,
          name: serialized.series_name
        },
        color_rel: serialized.color ? {
          color: serialized.color,
          hex_color: serialized.hex_color
        } : null
      }
    })

    res.json({
      cards: cards,
      total: cards.length
    })

  } catch (error) {
    console.error('Error fetching all player cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch all player cards'
    })
  }
})


// GET /api/players/:id/slug - Get player slug by ID (for migration purposes)
router.get('/:id/slug', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    
    if (isNaN(playerId)) {
      return res.status(400).json({
        error: 'Invalid player ID',
        message: 'Player ID must be a number'
      })
    }

    const player = await prisma.player.findUnique({
      where: { player_id: playerId },
      select: {
        player_id: true,
        first_name: true,
        last_name: true
      }
    })

    if (!player) {
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found with ID: ${playerId}`
      })
    }

    const slug = createPlayerSlug(player.first_name, player.last_name)

    res.json({
      player_id: Number(player.player_id),
      slug: slug,
      redirect_url: `/players/${slug}`
    })

  } catch (error) {
    console.error('Error generating player slug:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to generate player slug'
    })
  }
})

module.exports = router