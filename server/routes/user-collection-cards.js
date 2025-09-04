const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/collection/cards - Get user's collection cards filtered by locations
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Getting collection cards for user:', userId)
    
    // Get location IDs from query parameters
    const { location_id, include_unassigned } = req.query
    const locationIds = Array.isArray(location_id) ? location_id : (location_id ? [location_id] : [])
    const includeUnassigned = include_unassigned === 'true'
    
    console.log('Location IDs filter:', locationIds, 'Include unassigned:', includeUnassigned)
    
    // Build location filter
    let whereClause
    if (locationIds.length === 0) {
      // If no specific locations selected, show all cards for the user
      whereClause = `WHERE uc.[user] = ${parseInt(userId)}`
    } else if (includeUnassigned) {
      // Show selected locations AND unassigned cards
      const locationFilter = locationIds.map(id => parseInt(id)).join(',')
      whereClause = `WHERE uc.[user] = ${parseInt(userId)} AND (uc.user_location IN (${locationFilter}) OR uc.user_location IS NULL)`
    } else {
      // Show only selected locations (backward compatibility)
      const locationFilter = locationIds.map(id => parseInt(id)).join(',')
      whereClause = `WHERE uc.[user] = ${parseInt(userId)} AND uc.user_location IN (${locationFilter})`
    }
    
    // Single optimized query to get all collection cards with player-team data and primary photo
    const cardsQuery = `
      SELECT 
        uc.user_card_id,
        uc.random_code,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.current_value,
        uc.grade,
        uc.grade_id,
        uc.grading_agency,
        ga.abbreviation as grading_agency_abbr,
        ga.name as grading_agency_name,
        uc.aftermarket_autograph,
        uc.created as date_added,
        c.card_id, 
        c.card_number, 
        c.is_rookie, 
        c.is_autograph, 
        c.is_relic,
        c.print_run, 
        c.sort_order, 
        c.notes as card_notes,
        s.name as series_name, 
        s.series_id,
        col.name as color, 
        col.hex_value as hex_color,
        ul.location as location_name,
        p.first_name,
        p.last_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.primary_color,
        t.secondary_color,
        ucp.photo_url as primary_photo_url
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      LEFT JOIN user_card_photo ucp ON uc.user_card_id = ucp.user_card AND ucp.sort_order = 1
      LEFT JOIN card_player_team cpt ON cpt.card = c.card_id
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      ${whereClause}
      ORDER BY uc.user_card_id ASC, p.last_name ASC
    `
    
    const allResults = await prisma.$queryRawUnsafe(cardsQuery)

    // Group results by user_card_id to handle cards with multiple players
    const cardMap = new Map()
    
    allResults.forEach(row => {
      const userCardId = Number(row.user_card_id)
      
      if (!cardMap.has(userCardId)) {
        // First time seeing this user_card, create the card object
        cardMap.set(userCardId, {
          card_id: Number(row.card_id),
          user_card_id: userCardId,
          random_code: row.random_code,
          card_number: row.card_number,
          serial_number: row.serial_number,
          purchase_price: row.purchase_price,
          estimated_value: row.estimated_value,
          current_value: row.current_value,
          grade: row.grade,
          grade_id: typeof row.grade_id === 'bigint' ? Number(row.grade_id) : row.grade_id,
          grading_agency: typeof row.grading_agency === 'bigint' ? Number(row.grading_agency) : row.grading_agency,
          grading_agency_abbr: row.grading_agency_abbr,
          grading_agency_name: row.grading_agency_name,
          aftermarket_autograph: row.aftermarket_autograph,
          is_rookie: row.is_rookie,
          is_autograph: row.is_autograph,
          is_relic: row.is_relic,
          print_run: row.print_run,
          sort_order: row.sort_order,
          notes: row.card_notes,
          user_card_count: 1,
          date_added: row.date_added,
          location_name: row.location_name,
          primary_photo_url: row.primary_photo_url,
          series_rel: {
            series_id: typeof row.series_id === 'bigint' ? Number(row.series_id) : row.series_id,
            name: row.series_name
          },
          color_rel: row.color ? {
            color: row.color,
            hex_color: row.hex_color
          } : null,
          card_player_teams: []
        })
      }
      
      // Add player-team data if it exists
      if (row.first_name && row.last_name && row.team_name) {
        const card = cardMap.get(userCardId)
        card.card_player_teams.push({
          player: {
            name: `${row.first_name} ${row.last_name}`,
            first_name: row.first_name,
            last_name: row.last_name
          },
          team: {
            team_id: row.team_id ? Number(row.team_id) : null,
            name: row.team_name,
            abbreviation: row.team_abbr,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color
          }
        })
      }
    })

    // Convert Map to array for response
    const cards = Array.from(cardMap.values())
    
    // Sort cards by series name, then sort order, then date added (matching original query intent)
    cards.sort((a, b) => {
      // First by series name
      const seriesCompare = (a.series_rel?.name || '').localeCompare(b.series_rel?.name || '')
      if (seriesCompare !== 0) return seriesCompare
      
      // Then by sort order
      const sortOrderCompare = (a.sort_order || 0) - (b.sort_order || 0)
      if (sortOrderCompare !== 0) return sortOrderCompare
      
      // Finally by date added (newest first)
      return new Date(b.date_added) - new Date(a.date_added)
    })

    const total = cards.length

    res.json({
      cards,
      total,
      page: 1,
      limit: total,
      hasMore: false
    })

  } catch (error) {
    console.error('Error getting collection cards:', error)
    console.error('Error details:', error.message)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get collection cards'
    })
  }
})

module.exports = router