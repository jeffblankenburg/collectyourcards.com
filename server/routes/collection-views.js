const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware: requireAuth, optionalAuthMiddleware } = require('../middleware/auth')

// Helper function to generate unique slug
function generateSlug(name) {
  // Sanitize name: lowercase, remove special chars, replace spaces with hyphens
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50) // Limit base slug length

  // Generate random 5-character suffix
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return `${baseSlug}-${suffix}`
}

// Create a new collection view
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, filter_config, is_public } = req.body
    const userId = req.user.userId

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    if (!filter_config) {
      return res.status(400).json({ error: 'Filter configuration is required' })
    }

    // Generate unique slug
    let slug = generateSlug(name)
    let slugExists = true
    let attempts = 0

    // Try to find a unique slug (max 10 attempts)
    while (slugExists && attempts < 10) {
      const checkResult = await prisma.$queryRaw`
        SELECT collection_view_id FROM collection_view WHERE slug = ${slug}
      `

      if (checkResult.length === 0) {
        slugExists = false
      } else {
        slug = generateSlug(name) // Try again with new random suffix
        attempts++
      }
    }

    if (slugExists) {
      return res.status(500).json({ error: 'Failed to generate unique slug. Please try again.' })
    }

    // Insert collection view
    const result = await prisma.$queryRaw`
      INSERT INTO collection_view ([user], name, slug, description, filter_config, is_public)
      OUTPUT INSERTED.*
      VALUES (
        ${BigInt(parseInt(userId))},
        ${name.trim()},
        ${slug},
        ${description || null},
        ${JSON.stringify(filter_config)},
        ${is_public !== false ? 1 : 0}
      )
    `

    const view = result[0]

    res.json({
      success: true,
      view: {
        collection_view_id: Number(view.collection_view_id),
        name: view.name,
        slug: view.slug,
        description: view.description,
        filter_config: JSON.parse(view.filter_config),
        is_public: view.is_public,
        view_count: view.view_count,
        created_at: view.created_at,
        shortlink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/shared/${view.slug}`
      }
    })
  } catch (error) {
    console.error('Error creating collection view:', error)
    res.status(500).json({ error: 'Failed to create collection view' })
  }
})

// Get all collection views for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId

    const result = await prisma.$queryRaw`
      SELECT
        cv.collection_view_id,
        cv.name,
        cv.slug,
        cv.description,
        cv.filter_config,
        cv.is_public,
        cv.view_count,
        cv.created_at,
        cv.updated_at
      FROM collection_view cv
      WHERE cv.[user] = ${BigInt(parseInt(userId))}
      ORDER BY cv.created_at DESC
    `

    const views = result.map(view => ({
      collection_view_id: Number(view.collection_view_id),
      name: view.name,
      slug: view.slug,
      description: view.description,
      filter_config: JSON.parse(view.filter_config),
      is_public: view.is_public,
      view_count: view.view_count,
      created_at: view.created_at,
      updated_at: view.updated_at,
      shortlink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/shared/${view.slug}`
    }))

    res.json({ success: true, views })
  } catch (error) {
    console.error('Error fetching collection views:', error)
    res.status(500).json({ error: 'Failed to fetch collection views' })
  }
})

// Get a public collection view by slug (no auth required, but optional auth for owner detection)
router.get('/shared/:slug', optionalAuthMiddleware, async (req, res) => {
  try {
    const { slug } = req.params

    // Get the view
    const viewResult = await prisma.$queryRaw`
      SELECT
        cv.collection_view_id,
        cv.[user],
        cv.name,
        cv.slug,
        cv.description,
        cv.filter_config,
        cv.is_public,
        cv.view_count,
        cv.created_at,
        u.username
      FROM collection_view cv
      JOIN [user] u ON cv.[user] = u.user_id
      WHERE cv.slug = ${slug}
    `

    if (viewResult.length === 0) {
      return res.status(404).json({ error: 'Collection view not found' })
    }

    const view = viewResult[0]

    // Check if view is public (unless it's the owner requesting)
    // optionalAuthMiddleware sets req.user.id (not userId)
    const requestUserId = req.user?.id
    const isOwner = requestUserId && Number(requestUserId) === Number(view.user)

    if (!view.is_public && !isOwner) {
      return res.status(404).json({ error: 'Collection view not found' })
    }

    // Increment view count (only for non-owners)
    if (!isOwner) {
      await prisma.$queryRaw`
        UPDATE collection_view
        SET view_count = view_count + 1
        WHERE collection_view_id = ${BigInt(view.collection_view_id)}
      `
    }

    // Parse filter config
    const filterConfig = JSON.parse(view.filter_config)

    // Fetch cards with player and team data
    // view.user is already a BigInt from the database query
    const userId = typeof view.user === 'bigint' ? view.user : BigInt(parseInt(view.user))

    // Build SQL query dynamically based on filters
    let sqlQuery = `
      SELECT
        uc.user_card_id,
        uc.card,
        uc.serial_number,
        uc.grade,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.series_id,
        s.name as series_name,
        s.production_code,
        st.set_id,
        st.name as set_name,
        st.year as set_year,
        p.player_id,
        p.first_name,
        p.last_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.primary_color,
        t.secondary_color
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE uc.[user] = ${userId}
    `

    // Add location filters
    if (filterConfig.locationIds && filterConfig.locationIds.length > 0) {
      const locationBigInts = filterConfig.locationIds.map(id => BigInt(parseInt(id)))
      sqlQuery += ` AND uc.user_location IN (${locationBigInts.join(',')})`
    }

    // Add card type filters
    if (filterConfig.filters) {
      if (filterConfig.filters.rookies) sqlQuery += ' AND c.is_rookie = 1'
      if (filterConfig.filters.autos) sqlQuery += ' AND c.is_autograph = 1'
      if (filterConfig.filters.relics) sqlQuery += ' AND c.is_relic = 1'
      if (filterConfig.filters.graded) sqlQuery += ' AND uc.grade IS NOT NULL'
    }

    // Add team filters using EXISTS subquery
    if (filterConfig.teamIds && filterConfig.teamIds.length > 0) {
      const teamIds = filterConfig.teamIds.map(id => parseInt(id))
      sqlQuery += `
        AND EXISTS (
          SELECT 1
          FROM card_player_team cpt2
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          WHERE cpt2.card = c.card_id
            AND pt2.team IN (${teamIds.join(',')})
        )
      `
    }

    const cardsResult = await prisma.$queryRawUnsafe(sqlQuery)

    // Group cards by user_card_id and build card_player_teams arrays
    const cardMap = new Map()

    cardsResult.forEach(row => {
      const userCardId = Number(row.user_card_id)

      if (!cardMap.has(userCardId)) {
        cardMap.set(userCardId, {
          user_card_id: userCardId,
          card_id: Number(row.card),
          card_number: row.card_number,
          is_rookie: row.is_rookie,
          is_autograph: row.is_autograph,
          is_relic: row.is_relic,
          print_run: row.print_run,
          serial_number: row.serial_number,
          grade: row.grade,
          series_rel: row.series_id ? {
            series_id: Number(row.series_id),
            name: row.series_name,
            production_code: row.production_code,
            set_name: row.set_name,
            set_year: row.set_year
          } : null,
          card_player_teams: []
        })
      }

      // Add player/team data if present
      if (row.first_name && row.last_name && row.team_name) {
        const card = cardMap.get(userCardId)
        card.card_player_teams.push({
          player: {
            player_id: typeof row.player_id === 'bigint' ? Number(row.player_id) : row.player_id,
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

    const cards = Array.from(cardMap.values())

    // Calculate stats
    let uniquePlayers = new Set()
    let uniqueSeries = new Set()

    cards.forEach(card => {
      if (card.series_rel?.series_id) {
        uniqueSeries.add(card.series_rel.series_id)
      }
      card.card_player_teams?.forEach(cpt => {
        if (cpt.player?.player_id) {
          uniquePlayers.add(cpt.player.player_id)
        }
      })
    })

    res.json({
      success: true,
      view: {
        collection_view_id: Number(view.collection_view_id),
        name: view.name,
        slug: view.slug,
        description: view.description,
        is_public: view.is_public,
        view_count: view.view_count + (isOwner ? 0 : 1),
        created_at: view.created_at,
        owner: {
          username: view.username
        },
        is_owner: isOwner,
        visible_columns: filterConfig.visible_columns || null
      },
      cards: cards,
      stats: {
        total_cards: cards.length,
        unique_players: uniquePlayers.size,
        unique_series: uniqueSeries.size
      }
    })
  } catch (error) {
    console.error('Error fetching shared collection view:', error)
    res.status(500).json({ error: 'Failed to fetch collection view' })
  }
})

// Update a collection view
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, filter_config, is_public } = req.body
    const userId = req.user.userId

    // Check ownership
    const checkResult = await prisma.$queryRaw`
      SELECT collection_view_id
      FROM collection_view
      WHERE collection_view_id = ${BigInt(parseInt(id))}
        AND [user] = ${BigInt(parseInt(userId))}
    `

    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Collection view not found or you do not have permission to edit it' })
    }

    // Update the view
    const result = await prisma.$queryRaw`
      UPDATE collection_view
      SET
        name = COALESCE(${name?.trim() || null}, name),
        description = COALESCE(${description || null}, description),
        filter_config = COALESCE(${filter_config ? JSON.stringify(filter_config) : null}, filter_config),
        is_public = COALESCE(${is_public !== undefined ? (is_public ? 1 : 0) : null}, is_public),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE collection_view_id = ${BigInt(parseInt(id))}
    `

    const view = result[0]

    res.json({
      success: true,
      view: {
        collection_view_id: Number(view.collection_view_id),
        name: view.name,
        slug: view.slug,
        description: view.description,
        filter_config: JSON.parse(view.filter_config),
        is_public: view.is_public,
        view_count: view.view_count,
        created_at: view.created_at,
        updated_at: view.updated_at
      }
    })
  } catch (error) {
    console.error('Error updating collection view:', error)
    res.status(500).json({ error: 'Failed to update collection view' })
  }
})

// Delete a collection view
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    // Check ownership and delete
    const result = await prisma.$executeRaw`
      DELETE FROM collection_view
      WHERE collection_view_id = ${BigInt(parseInt(id))}
        AND [user] = ${BigInt(parseInt(userId))}
    `

    if (result === 0) {
      return res.status(404).json({ error: 'Collection view not found or you do not have permission to delete it' })
    }

    res.json({ success: true, message: 'Collection view deleted successfully' })
  } catch (error) {
    console.error('Error deleting collection view:', error)
    res.status(500).json({ error: 'Failed to delete collection view' })
  }
})

module.exports = router
