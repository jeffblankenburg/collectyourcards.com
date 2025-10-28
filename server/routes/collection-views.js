const express = require('express')
const router = express.Router()
const { connectToDatabase } = require('../config/database')
const { requireAuth } = require('../middleware/auth')
const sql = require('mssql')

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
    const userId = req.user.user_id

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    if (!filter_config) {
      return res.status(400).json({ error: 'Filter configuration is required' })
    }

    const pool = await connectToDatabase()

    // Generate unique slug
    let slug = generateSlug(name)
    let slugExists = true
    let attempts = 0

    // Try to find a unique slug (max 10 attempts)
    while (slugExists && attempts < 10) {
      const checkResult = await pool.request()
        .input('slug', sql.NVarChar, slug)
        .query('SELECT collection_view_id FROM collection_view WHERE slug = @slug')

      if (checkResult.recordset.length === 0) {
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
    const result = await pool.request()
      .input('user', sql.BigInt, userId)
      .input('name', sql.NVarChar, name.trim())
      .input('slug', sql.NVarChar, slug)
      .input('description', sql.NVarChar, description || null)
      .input('filter_config', sql.NVarChar, JSON.stringify(filter_config))
      .input('is_public', sql.Bit, is_public !== false) // Default to true
      .query(`
        INSERT INTO collection_view ([user], name, slug, description, filter_config, is_public)
        OUTPUT INSERTED.*
        VALUES (@user, @name, @slug, @description, @filter_config, @is_public)
      `)

    const view = result.recordset[0]

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
    const userId = req.user.user_id
    const pool = await connectToDatabase()

    const result = await pool.request()
      .input('userId', sql.BigInt, userId)
      .query(`
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
        WHERE cv.[user] = @userId
        ORDER BY cv.created_at DESC
      `)

    const views = result.recordset.map(view => ({
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

// Get a public collection view by slug (no auth required for public views)
router.get('/shared/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const pool = await connectToDatabase()

    // Get the view
    const viewResult = await pool.request()
      .input('slug', sql.NVarChar, slug)
      .query(`
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
          u.username,
          u.display_name
        FROM collection_view cv
        JOIN [user] u ON cv.[user] = u.user_id
        WHERE cv.slug = @slug
      `)

    if (viewResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Collection view not found' })
    }

    const view = viewResult.recordset[0]

    // Check if view is public (unless it's the owner requesting)
    const requestUserId = req.user?.user_id
    const isOwner = requestUserId && Number(requestUserId) === Number(view.user)

    if (!view.is_public && !isOwner) {
      return res.status(404).json({ error: 'Collection view not found' })
    }

    // Increment view count (only for non-owners)
    if (!isOwner) {
      await pool.request()
        .input('viewId', sql.BigInt, view.collection_view_id)
        .query('UPDATE collection_view SET view_count = view_count + 1 WHERE collection_view_id = @viewId')
    }

    // Parse filter config
    const filterConfig = JSON.parse(view.filter_config)

    // Build query to fetch cards based on filter config
    const params = []

    // Add location filters
    if (filterConfig.locationIds && filterConfig.locationIds.length > 0) {
      const locationParams = filterConfig.locationIds.map(id => `location_id=${id}`).join('&')
      params.push(locationParams)
      if (filterConfig.includeUnassigned) {
        params.push('include_unassigned=true')
      }
    } else if (filterConfig.onlyUnassigned) {
      params.push('only_unassigned=true')
    }

    // Add card type filters
    if (filterConfig.filters) {
      if (filterConfig.filters.rookies) params.push('is_rookie=true')
      if (filterConfig.filters.autos) params.push('is_autograph=true')
      if (filterConfig.filters.relics) params.push('is_relic=true')
      if (filterConfig.filters.graded) params.push('has_grade=true')
    }

    // Add team filters
    if (filterConfig.teamIds && filterConfig.teamIds.length > 0) {
      const teamParams = filterConfig.teamIds.map(id => `team_id=${id}`).join('&')
      params.push(teamParams)
    }

    // Fetch cards using the collection cards endpoint logic
    // We'll reuse the same query structure from user-collection-cards.js
    const cardsResult = await pool.request()
      .input('userId', sql.BigInt, view.user)
      .query(`
        SELECT
          uc.user_card_id,
          uc.card,
          uc.serial_number,
          uc.purchase_price,
          uc.estimated_value,
          uc.current_value,
          uc.is_for_sale,
          uc.is_wanted,
          uc.is_special,
          uc.grade,
          uc.grade_id,
          uc.grading_agency,
          uc.user_location,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          c.notes,
          s.series_id,
          s.name as series_name,
          s.production_code,
          st.set_id,
          st.name as set_name,
          st.year as set_year
        FROM user_card uc
        JOIN card c ON uc.card = c.card_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        WHERE uc.[user] = @userId
      `)

    // Calculate stats
    const cards = cardsResult.recordset
    let totalValue = 0
    let uniquePlayers = new Set()
    let uniqueSeries = new Set()

    cards.forEach(card => {
      if (card.current_value) {
        totalValue += parseFloat(card.current_value)
      }
      if (card.series_id) {
        uniqueSeries.add(card.series_id)
      }
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
          username: view.username,
          display_name: view.display_name
        },
        is_owner: isOwner
      },
      cards: cards.map(card => ({
        user_card_id: Number(card.user_card_id),
        card_id: Number(card.card),
        card_number: card.card_number,
        is_rookie: card.is_rookie,
        is_autograph: card.is_autograph,
        is_relic: card.is_relic,
        print_run: card.print_run,
        notes: card.notes,
        serial_number: card.serial_number,
        current_value: card.current_value ? parseFloat(card.current_value) : null,
        is_special: card.is_special,
        grade: card.grade,
        series_rel: {
          series_id: Number(card.series_id),
          name: card.series_name,
          production_code: card.production_code,
          set_name: card.set_name,
          set_year: card.set_year
        }
      })),
      stats: {
        total_cards: cards.length,
        total_value: totalValue,
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
    const userId = req.user.user_id

    const pool = await connectToDatabase()

    // Check ownership
    const checkResult = await pool.request()
      .input('viewId', sql.BigInt, id)
      .input('userId', sql.BigInt, userId)
      .query('SELECT collection_view_id FROM collection_view WHERE collection_view_id = @viewId AND [user] = @userId')

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Collection view not found or you do not have permission to edit it' })
    }

    // Update the view
    const result = await pool.request()
      .input('viewId', sql.BigInt, id)
      .input('name', sql.NVarChar, name?.trim() || null)
      .input('description', sql.NVarChar, description || null)
      .input('filter_config', sql.NVarChar, filter_config ? JSON.stringify(filter_config) : null)
      .input('is_public', sql.Bit, is_public)
      .query(`
        UPDATE collection_view
        SET
          name = COALESCE(@name, name),
          description = COALESCE(@description, description),
          filter_config = COALESCE(@filter_config, filter_config),
          is_public = COALESCE(@is_public, is_public),
          updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE collection_view_id = @viewId
      `)

    const view = result.recordset[0]

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
    const userId = req.user.user_id

    const pool = await connectToDatabase()

    // Check ownership and delete
    const result = await pool.request()
      .input('viewId', sql.BigInt, id)
      .input('userId', sql.BigInt, userId)
      .query('DELETE FROM collection_view WHERE collection_view_id = @viewId AND [user] = @userId')

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Collection view not found or you do not have permission to delete it' })
    }

    res.json({ success: true, message: 'Collection view deleted successfully' })
  } catch (error) {
    console.error('Error deleting collection view:', error)
    res.status(500).json({ error: 'Failed to delete collection view' })
  }
})

module.exports = router
