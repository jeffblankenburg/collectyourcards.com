const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')
const { sanitizeInput } = require('../middleware/inputSanitization')

// All routes require authentication
router.use(authMiddleware)
router.use(sanitizeInput)

// GET /api/user/table-preferences/:tableName - Get user's column preferences for a specific table
router.get('/:tableName', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { tableName } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Validate table name (security - prevent SQL injection)
    const validTables = ['card_table', 'collection_table']
    if (!validTables.includes(tableName)) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table name must be one of: ${validTables.join(', ')}`
      })
    }

    // Use a simple indexed query - composite index will be used automatically
    const preference = await prisma.$queryRaw`
      SELECT visible_columns, column_order
      FROM user_table_preferences
      WHERE [user] = ${BigInt(userId)} AND table_name = ${tableName}
    `

    if (preference.length === 0) {
      return res.json({
        visible_columns: null,
        column_order: null,
        message: 'No preferences found, using defaults'
      })
    }

    res.json({
      visible_columns: JSON.parse(preference[0].visible_columns),
      column_order: preference[0].column_order ? JSON.parse(preference[0].column_order) : null
    })

  } catch (error) {
    console.error('Error fetching table preferences:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch table preferences'
    })
  }
})

// POST /api/user/table-preferences - Save/update user's column preferences
router.post('/', async (req, res) => {
  const requestStartTime = Date.now()
  console.log('\n[TablePrefs] ===== POST REQUEST RECEIVED =====')
  console.log('[TablePrefs] Request body:', req.body)
  console.log('[TablePrefs] Request sanitized:', req.sanitized)

  try {
    const userId = req.user?.userId
    const { table_name, visible_columns, column_order } = req.sanitized || req.body

    console.log('[TablePrefs] User ID:', userId)
    console.log('[TablePrefs] Table name:', table_name)
    console.log('[TablePrefs] Visible columns count:', visible_columns?.length)

    if (!userId) {
      console.log('[TablePrefs] ERROR: No user ID')
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Validate inputs
    const validTables = ['card_table', 'collection_table']
    if (!validTables.includes(table_name)) {
      console.log('[TablePrefs] ERROR: Invalid table name:', table_name)
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table name must be one of: ${validTables.join(', ')}`
      })
    }

    if (!Array.isArray(visible_columns)) {
      console.log('[TablePrefs] ERROR: visible_columns is not an array')
      return res.status(400).json({
        error: 'Invalid data',
        message: 'visible_columns must be an array'
      })
    }

    if (visible_columns.length === 0) {
      console.log('[TablePrefs] ERROR: visible_columns is empty')
      return res.status(400).json({
        error: 'Invalid data',
        message: 'visible_columns cannot be empty'
      })
    }

    const startTime = Date.now()
    console.log('[TablePrefs] Starting database operation...')

    // Fast upsert: Try UPDATE first (most common case), then INSERT if needed
    // This is MUCH faster than MERGE, especially with our indexes
    const visibleColumnsJson = JSON.stringify(visible_columns)
    const columnOrderJson = column_order ? JSON.stringify(column_order) : null

    console.log('[TablePrefs] Attempting UPDATE...')
    const updateStart = Date.now()

    // Step 1: Try to update existing row (composite index will be used automatically)
    const updateResult = await prisma.$executeRaw`
      UPDATE user_table_preferences
      SET
        visible_columns = ${visibleColumnsJson},
        column_order = ${columnOrderJson},
        updated_at = GETDATE()
      WHERE [user] = ${BigInt(userId)} AND table_name = ${table_name}
    `

    const updateElapsed = Date.now() - updateStart
    console.log(`[TablePrefs] UPDATE completed in ${updateElapsed}ms, rows affected: ${updateResult}`)

    // Step 2: If no rows were updated, insert new row
    if (updateResult === 0) {
      console.log('[TablePrefs] No existing row, performing INSERT...')
      const insertStart = Date.now()

      await prisma.$executeRaw`
        INSERT INTO user_table_preferences ([user], table_name, visible_columns, column_order, created_at, updated_at)
        VALUES (${BigInt(userId)}, ${table_name}, ${visibleColumnsJson}, ${columnOrderJson}, GETDATE(), GETDATE())
      `

      const insertElapsed = Date.now() - insertStart
      console.log(`[TablePrefs] INSERT completed in ${insertElapsed}ms`)
    }

    const dbElapsed = Date.now() - startTime
    const totalElapsed = Date.now() - requestStartTime
    console.log(`[TablePrefs] Total database time: ${dbElapsed}ms`)
    console.log(`[TablePrefs] Total request time: ${totalElapsed}ms`)
    console.log('[TablePrefs] ===== REQUEST COMPLETE =====\n')

    res.json({
      success: true,
      message: 'Table preferences saved successfully'
    })

  } catch (error) {
    console.error('Error saving table preferences:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to save table preferences'
    })
  }
})

// DELETE /api/user/table-preferences/:tableName - Reset to defaults by deleting preferences
router.delete('/:tableName', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { tableName } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Validate table name
    const validTables = ['card_table', 'collection_table']
    if (!validTables.includes(tableName)) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table name must be one of: ${validTables.join(', ')}`
      })
    }

    const startTime = Date.now()

    // Composite index will be used automatically for fast deletion
    await prisma.$executeRaw`
      DELETE FROM user_table_preferences
      WHERE [user] = ${BigInt(userId)} AND table_name = ${tableName}
    `

    const elapsed = Date.now() - startTime
    console.log(`Deleted table preferences in ${elapsed}ms`)

    res.json({
      success: true,
      message: 'Table preferences reset to defaults'
    })

  } catch (error) {
    console.error('Error deleting table preferences:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to reset table preferences'
    })
  }
})

module.exports = router
