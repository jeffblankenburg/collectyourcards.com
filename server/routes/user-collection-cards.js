const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { validateNumericId, validateNumericArray } = require('../utils/sql-security')

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/collection/cards/minimal - Get user's collection cards with minimal data (optimized for performance)
router.get('/minimal', async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Getting minimal collection cards for user:', userId)

    // Get location IDs and filters from query parameters (same as full endpoint)
    const {
      location_id,
      include_unassigned,
      only_unassigned,
      series_id,
      is_rookie,
      is_autograph,
      is_relic,
      has_grade,
      team_id
    } = req.query
    const locationIds = Array.isArray(location_id) ? location_id : (location_id ? [location_id] : [])
    const includeUnassigned = include_unassigned === 'true'
    const onlyUnassigned = only_unassigned === 'true'
    const seriesFilter = series_id ? parseInt(series_id) : null
    const rookieFilter = is_rookie === 'true'
    const autographFilter = is_autograph === 'true'
    const relicFilter = is_relic === 'true'
    const gradedFilter = has_grade === 'true'
    const teamIds = Array.isArray(team_id) ? team_id : (team_id ? [team_id] : [])

    // Validate user ID
    const userIdNum = validateNumericId(userId, 'user_id')

    // Build where clause
    let whereClause = `WHERE uc.[user] = ${userIdNum}`

    // Add location filter
    if (onlyUnassigned) {
      whereClause += ` AND uc.user_location IS NULL`
    } else if (locationIds.length > 0) {
      const validLocationIds = validateNumericArray(locationIds)
      if (validLocationIds.length > 0) {
        const locationFilter = validLocationIds.join(',')
        if (includeUnassigned) {
          whereClause += ` AND (uc.user_location IN (${locationFilter}) OR uc.user_location IS NULL)`
        } else {
          whereClause += ` AND uc.user_location IN (${locationFilter})`
        }
      }
    }

    // Add series filter
    if (seriesFilter) {
      try {
        const seriesIdNum = validateNumericId(seriesFilter, 'series_id')
        whereClause += ` AND c.series = ${seriesIdNum}`
      } catch (err) {
        // Invalid series ID - skip filter
      }
    }

    // Add card attribute filters
    if (rookieFilter) whereClause += ` AND c.is_rookie = 1`
    if (autographFilter) whereClause += ` AND c.is_autograph = 1`
    if (relicFilter) whereClause += ` AND c.is_relic = 1`
    if (gradedFilter) whereClause += ` AND uc.grade IS NOT NULL`

    // Add team filtering
    if (teamIds.length > 0) {
      const validTeamIds = validateNumericArray(teamIds)
      if (validTeamIds.length > 0) {
        const teamFilter = validTeamIds.join(',')
        whereClause += ` AND EXISTS (
          SELECT 1 FROM card_player_team cpt2
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          WHERE cpt2.card = c.card_id AND pt2.team IN (${teamFilter})
        )`
      }
    }

    // Minimal query - includes primary photo URL for gallery view, but not full photo arrays
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
        uc.aftermarket_autograph,
        uc.is_special,
        uc.created as date_added,
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        c.sort_order,
        s.name as series_name,
        s.series_id,
        s.slug as series_slug,
        st.name as set_name,
        st.year as set_year,
        col.name as color,
        col.hex_value as hex_color,
        ul.location as location_name,
        p.player_id,
        p.first_name,
        p.last_name,
        p.slug as player_slug,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.slug as team_slug,
        t.primary_color,
        t.secondary_color,
        ucp.photo_url as primary_photo_url,
        ISNULL(photo_count.count, 0) as photo_count
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      LEFT JOIN user_card_photo ucp ON uc.user_card_id = ucp.user_card AND ucp.sort_order = 1
      LEFT JOIN (
        SELECT user_card, COUNT(*) as count
        FROM user_card_photo
        GROUP BY user_card
      ) photo_count ON uc.user_card_id = photo_count.user_card
      LEFT JOIN card_player_team cpt ON cpt.card = c.card_id
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      ${whereClause}
      ORDER BY s.name ASC, c.sort_order ASC, uc.user_card_id ASC
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
          aftermarket_autograph: row.aftermarket_autograph,
          is_special: row.is_special,
          is_rookie: row.is_rookie,
          is_autograph: row.is_autograph,
          is_relic: row.is_relic,
          print_run: row.print_run,
          sort_order: row.sort_order,
          user_card_count: 1,
          date_added: row.date_added,
          location_name: row.location_name,
          series_rel: {
            series_id: typeof row.series_id === 'bigint' ? Number(row.series_id) : row.series_id,
            name: row.series_name,
            slug: row.series_slug,
            set_name: row.set_name,
            set_year: row.set_year
          },
          color_rel: row.color ? {
            color: row.color,
            hex_color: row.hex_color
          } : null,
          card_player_teams: [],
          // Photo info for indicators and gallery view - full photo array loaded on demand
          primary_photo_url: row.primary_photo_url || null,
          photo_count: Number(row.photo_count) || 0,
          has_photos: Number(row.photo_count) > 0
        })
      }

      // Add player-team data if it exists
      if (row.first_name && row.last_name && row.team_name) {
        const card = cardMap.get(userCardId)
        // Prevent duplicate player-team combinations
        const playerKey = `${row.player_id}-${row.team_id}`
        if (!card.card_player_teams.some(cpt =>
          `${cpt.player.player_id}-${cpt.team.team_id}` === playerKey
        )) {
          card.card_player_teams.push({
            player: {
              player_id: typeof row.player_id === 'bigint' ? Number(row.player_id) : row.player_id,
              name: `${row.first_name} ${row.last_name}`,
              first_name: row.first_name,
              last_name: row.last_name,
              slug: row.player_slug
            },
            team: {
              team_id: row.team_id ? Number(row.team_id) : null,
              name: row.team_name,
              abbreviation: row.team_abbr,
              slug: row.team_slug,
              primary_color: row.primary_color,
              secondary_color: row.secondary_color
            }
          })
        }
      }
    })

    // Convert Map to array for response (already sorted by SQL query)
    const cards = Array.from(cardMap.values())
    const total = cards.length

    console.log(`Returning ${total} minimal collection cards`)

    res.json({
      cards,
      total,
      page: 1,
      limit: total,
      hasMore: false
    })

  } catch (error) {
    console.error('Error getting minimal collection cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get collection cards'
    })
  }
})

// GET /api/user/collection/cards - Get user's collection cards filtered by locations (FULL VERSION with photos)
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
    
    // Get location IDs and filters from query parameters
    const { 
      location_id, 
      include_unassigned, 
      only_unassigned, 
      series_id,
      is_rookie,
      is_autograph,
      is_relic,
      has_grade,
      team_id
    } = req.query
    const locationIds = Array.isArray(location_id) ? location_id : (location_id ? [location_id] : [])
    const includeUnassigned = include_unassigned === 'true'
    const onlyUnassigned = only_unassigned === 'true'
    const seriesFilter = series_id ? parseInt(series_id) : null
    const rookieFilter = is_rookie === 'true'
    const autographFilter = is_autograph === 'true'
    const relicFilter = is_relic === 'true'
    const gradedFilter = has_grade === 'true'
    const teamIds = Array.isArray(team_id) ? team_id : (team_id ? [team_id] : [])
    
    console.log('Location IDs filter:', locationIds, 'Include unassigned:', includeUnassigned, 'Only unassigned:', onlyUnassigned, 'Series filter:', seriesFilter)
    console.log('Card filters - Rookie:', rookieFilter, 'Auto:', autographFilter, 'Relic:', relicFilter, 'Graded:', gradedFilter, 'Teams:', teamIds)

    // Validate user ID
    const userIdNum = validateNumericId(userId, 'user_id')

    // Build where clause with location and series filters
    let whereClause = `WHERE uc.[user] = ${userIdNum}`

    // Add location filter with validation
    if (onlyUnassigned) {
      // Show only cards without a location
      whereClause += ` AND uc.user_location IS NULL`
    } else if (locationIds.length > 0) {
      const validLocationIds = validateNumericArray(locationIds)
      if (validLocationIds.length > 0) {
        const locationFilter = validLocationIds.join(',')
        if (includeUnassigned) {
          // Show selected locations AND unassigned cards
          whereClause += ` AND (uc.user_location IN (${locationFilter}) OR uc.user_location IS NULL)`
        } else {
          // Show only selected locations
          whereClause += ` AND uc.user_location IN (${locationFilter})`
        }
      }
    }

    // Add series filter with validation
    if (seriesFilter) {
      try {
        const seriesIdNum = validateNumericId(seriesFilter, 'series_id')
        whereClause += ` AND c.series = ${seriesIdNum}`
      } catch (err) {
        // Invalid series ID - skip filter
      }
    }

    // Add card attribute filters
    if (rookieFilter) {
      whereClause += ` AND c.is_rookie = 1`
    }
    if (autographFilter) {
      whereClause += ` AND c.is_autograph = 1`
    }
    if (relicFilter) {
      whereClause += ` AND c.is_relic = 1`
    }
    if (gradedFilter) {
      whereClause += ` AND uc.grade IS NOT NULL`
    }

    // Add team filtering with validation
    if (teamIds.length > 0) {
      const validTeamIds = validateNumericArray(teamIds)
      if (validTeamIds.length > 0) {
        const teamFilter = validTeamIds.join(',')
        whereClause += ` AND t.team_id IN (${teamFilter})`
      }
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
        uc.is_special,
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
        s.slug as series_slug,
        -- Add set information for proper URL construction
        st.name as set_name,
        LOWER(REPLACE(REPLACE(REPLACE(st.name, ' ', '-'), '''', ''), '/', '-')) as set_slug,
        st.year as set_year,
        col.name as color,
        col.hex_value as hex_color,
        ul.location as location_name,
        p.player_id,
        p.first_name,
        p.last_name,
        p.slug as player_slug,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.slug as team_slug,
        t.primary_color,
        t.secondary_color,
        ucp.photo_url as primary_photo_url,
        ISNULL(photo_count.count, 0) as photo_count
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      LEFT JOIN user_card_photo ucp ON uc.user_card_id = ucp.user_card AND ucp.sort_order = 1
      LEFT JOIN (
        SELECT user_card, COUNT(*) as count
        FROM user_card_photo
        GROUP BY user_card
      ) photo_count ON uc.user_card_id = photo_count.user_card
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
          is_special: row.is_special,
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
          photo_count: Number(row.photo_count) || 0,
          series_rel: {
            series_id: typeof row.series_id === 'bigint' ? Number(row.series_id) : row.series_id,
            name: row.series_name,
            slug: row.series_slug,
            set_slug: row.set_slug,
            set_name: row.set_name,
            set_year: row.set_year
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
            player_id: typeof row.player_id === 'bigint' ? Number(row.player_id) : row.player_id,
            name: `${row.first_name} ${row.last_name}`,
            first_name: row.first_name,
            last_name: row.last_name,
            slug: row.player_slug
          },
          team: {
            team_id: row.team_id ? Number(row.team_id) : null,
            name: row.team_name,
            abbreviation: row.team_abbr,
            slug: row.team_slug,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color
          }
        })
      }
    })

    // Convert Map to array for response
    const cards = Array.from(cardMap.values())
    
    // Now fetch all photos for cards that have photos
    const cardIdsWithPhotos = cards.filter(card => card.photo_count > 0).map(card => card.user_card_id)

    if (cardIdsWithPhotos.length > 0) {
      // Validate card IDs (they come from DB, but still good practice)
      const validCardIds = validateNumericArray(cardIdsWithPhotos)

      if (validCardIds.length > 0) {
        const allPhotosQuery = `
          SELECT
            user_card,
            user_card_photo_id,
            photo_url,
            sort_order
          FROM user_card_photo
          WHERE user_card IN (${validCardIds.join(',')})
          ORDER BY user_card ASC, sort_order ASC
        `
      
        const allPhotosResults = await prisma.$queryRawUnsafe(allPhotosQuery)

        // Group photos by user_card_id
        const photosByCard = new Map()
        allPhotosResults.forEach(photo => {
          const userCardId = Number(photo.user_card)
          if (!photosByCard.has(userCardId)) {
            photosByCard.set(userCardId, [])
          }
          photosByCard.get(userCardId).push({
            user_card_photo_id: Number(photo.user_card_photo_id),
            photo_url: photo.photo_url,
            sort_order: photo.sort_order
          })
        })

        // Add all photos to each card
        cards.forEach(card => {
          if (photosByCard.has(card.user_card_id)) {
            card.all_photos = photosByCard.get(card.user_card_id)
          } else {
            card.all_photos = []
          }
        })
      }
    } else {
      // No cards have photos, add empty arrays
      cards.forEach(card => {
        card.all_photos = []
      })
    }
    
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

// GET /api/user/collection/teams-with-players - Get teams with unique player counts from user's collection
router.get('/teams-with-players', async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Getting teams with player counts for user:', userId)

    // Validate user ID
    const userIdNum = validateNumericId(userId, 'user_id')

    // Query to get teams with unique player counts from user's collection
    const teamsQuery = `
      SELECT
        t.team_id,
        t.name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT p.player_id) as card_count
      FROM user_card uc
      INNER JOIN card c ON uc.card = c.card_id
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
      INNER JOIN team t ON pt.team = t.team_id
      INNER JOIN player p ON pt.player = p.player_id
      WHERE uc.[user] = ${userIdNum}
      GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      HAVING COUNT(DISTINCT p.player_id) > 0
      ORDER BY COUNT(DISTINCT p.player_id) DESC, t.name ASC
    `
    
    const teamsResult = await prisma.$queryRawUnsafe(teamsQuery)
    
    // Process the results
    const teams = teamsResult.map(row => ({
      team_id: Number(row.team_id),
      name: row.name,
      abbreviation: row.abbreviation,
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      card_count: Number(row.card_count) // This represents unique players, not total cards
    }))

    console.log(`Found ${teams.length} teams with players in collection`)

    res.json({
      teams,
      total: teams.length
    })

  } catch (error) {
    console.error('Error getting teams with players:', error)
    console.error('Error details:', error.message)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get teams with players'
    })
  }
})

module.exports = router