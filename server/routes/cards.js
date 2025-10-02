const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')

// Optional auth middleware
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      await authMiddleware(req, res, () => {})
    } catch (err) {
      // User not authenticated, continue without user context
    }
  }
  next()
}

// GET /api/cards - Get cards with filtering and pagination
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const { 
      player_name, 
      team_id, 
      series_name,
      series_id,
      limit = 100, 
      page = 1 
    } = req.query


    const limitNum = Math.min(parseInt(limit) || 100, 10000) // Cap at 10000 for loading all data
    const pageNum = parseInt(page) || 1
    const offsetNum = (pageNum - 1) * limitNum

    // Build WHERE conditions for filtering
    const whereConditions = []
    let playerFilterJoin = ''

    if (player_name) {
      // Split player name into parts
      const nameParts = player_name.trim().split(/\s+/)
      if (nameParts.length >= 2) {
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ')
        
        whereConditions.push(`EXISTS (
          SELECT 1 FROM card_player_team cpt2
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          JOIN player p2 ON pt2.player = p2.player_id
          WHERE cpt2.card = c.card_id 
          AND LOWER(p2.first_name) LIKE LOWER('%${firstName}%')
          AND LOWER(p2.last_name) LIKE LOWER('%${lastName}%')
        )`)
      }
    }

    if (team_id) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM card_player_team cpt3
        JOIN player_team pt3 ON cpt3.player_team = pt3.player_team_id
        WHERE cpt3.card = c.card_id AND pt3.team = ${parseInt(team_id)}
      )`)
    }

    if (series_name) {
      whereConditions.push(`LOWER(s.name) LIKE LOWER('%${series_name}%')`)
    }

    if (series_id) {
      whereConditions.push(`s.series_id = ${parseInt(series_id)}`)
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${whereClause}
    `
    
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Get paginated cards with user collection data
    const userId = req.user?.userId
    const userIdNumber = userId ? Number(userId) : null
    const userCollectionJoin = userIdNumber ? `
      LEFT JOIN user_card uc ON c.card_id = uc.card AND uc.[user] = ${userIdNumber}
    ` : ''
    
    const cardsQuery = `
      SELECT 
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, 
        c.print_run, c.sort_order, c.notes,
        s.name as series_name, s.series_id,
        col.name as color, col.hex_value as hex_color,
        ${userIdNumber ? 'ISNULL(COUNT(uc.user_card_id), 0) as user_card_count' : '0 as user_card_count'}
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${userCollectionJoin}
      ${whereClause}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, 
               c.print_run, c.sort_order, c.notes, s.name, s.series_id, 
               col.name, col.hex_value
      ORDER BY s.name ASC, c.sort_order ASC
      OFFSET ${offsetNum} ROWS FETCH NEXT ${limitNum} ROWS ONLY
    `
    
    const cardResults = await prisma.$queryRawUnsafe(cardsQuery)
    

    // Get player-team associations for these cards
    const cardIds = cardResults.map(card => Number(card.card_id))
    
    let cardPlayerTeamMap = {}
    if (cardIds.length > 0) {
      // Get ALL player-team associations for the filtered cards
      // This is correct - we want all players on multi-player cards
      const playerTeamQuery = `
        SELECT 
          cpt.card as card_id,
          p.player_id,
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
        WHERE cpt.card IN (${cardIds.join(',')})
        ORDER BY cpt.card, p.last_name
      `

      const cardPlayerResults = await prisma.$queryRawUnsafe(playerTeamQuery)

      // Group by card_id
      cardPlayerResults.forEach(row => {
        const cardId = Number(row.card_id)
        if (!cardPlayerTeamMap[cardId]) {
          cardPlayerTeamMap[cardId] = []
        }
        
        cardPlayerTeamMap[cardId].push({
          player: {
            player_id: Number(row.player_id),
            name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
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
        })
      })
    }

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
        user_card_count: Number(serialized.user_card_count) || 0,
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
      cards,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < total
    })

  } catch (error) {
    console.error('Error fetching cards:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch cards',
      details: error.message
    })
  }
})

module.exports = router