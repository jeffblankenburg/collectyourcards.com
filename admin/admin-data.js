const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// Table configuration with primary key information
const TABLE_CONFIG = {
  // Core Data Tables
  card: { primaryKey: 'card_id', displayFields: ['card_number', 'sort_order', 'is_rookie', 'is_autograph', 'series'] },
  player: { primaryKey: 'player_id', displayFields: ['first_name', 'last_name', 'nick_name', 'is_hof', 'card_count'] },
  team: { primaryKey: 'team_Id', displayFields: ['name', 'city', 'abbreviation', 'organization', 'card_count'] },
  series: { primaryKey: 'series_id', displayFields: ['name', 'set', 'card_count', 'is_base', 'parallel_of_series'] },
  set: { primaryKey: 'set_id', displayFields: ['name', 'year', 'organization', 'manufacturer', 'card_count'] },
  
  // Reference Tables
  color: { primaryKey: 'color_id', displayFields: ['name', 'hex_value'] },
  grading_agency: { primaryKey: 'grading_agency_id', displayFields: ['name', 'abbreviation', 'sort_order'] },
  manufacturer: { primaryKey: 'manufacturer_id', displayFields: ['name'] },
  organization: { primaryKey: 'organization_id', displayFields: ['name', 'abbreviation'] },
  
  // Relationship Tables
  card_player_team: { primaryKey: 'card_player_team_id', displayFields: ['card', 'player_team'] },
  player_team: { primaryKey: 'player_team_id', displayFields: ['player', 'team'] },
  card_variation: { primaryKey: 'card_variation_id', displayFields: ['card', 'description'] },
  player_alias: { primaryKey: 'alias_id', displayFields: ['player_id', 'alias_name', 'alias_type', 'confidence_score'] },
  
  // User Data Tables
  user: { primaryKey: 'user_id', displayFields: ['name', 'email', 'role', 'is_active', 'is_verified'] },
  user_card: { primaryKey: 'user_card_id', displayFields: ['user', 'card', 'serial_number', 'purchase_price', 'grading_agency'] },
  user_location: { primaryKey: 'user_location_id', displayFields: ['user', 'location', 'card_count', 'is_dashboard'] },
  user_player: { primaryKey: 'user_player_id', displayFields: ['user', 'player', 'created'] },
  user_team: { primaryKey: 'user_team_id', displayFields: ['user', 'team', 'created'] },
  user_series: { primaryKey: 'user_series_id', displayFields: ['user_id', 'series_id', 'created'] },
  
  // Import & Processing
  import_job: { primaryKey: 'id', displayFields: ['user_id', 'filename', 'status', 'current_stage', 'total_rows'] },
  import_staging: { primaryKey: 'id', displayFields: ['import_job_id', 'stage_number', 'row_number', 'entity_type', 'match_status'] },
  import_series_staging: { primaryKey: 'id', displayFields: ['import_job_id', 'series_name', 'is_parallel', 'color', 'match_confidence'] },
  import_mapping: { primaryKey: 'id', displayFields: ['user_id', 'name', 'source_type', 'is_public', 'usage_count'] },
  import_recovery_point: { primaryKey: 'recovery_id', displayFields: ['import_id', 'user_id', 'recovery_complexity', 'can_fully_reverse'] },
  
  // Logs & Audit
  admin_action_log: { primaryKey: 'log_id', displayFields: ['user_id', 'action_type', 'entity_type', 'entity_id', 'created'] },
  user_auth_log: { primaryKey: 'log_id', displayFields: ['user_id', 'email', 'event_type', 'success', 'created'] },
  user_session: { primaryKey: 'session_id', displayFields: ['user_id', 'expires_at', 'created', 'last_accessed'] },
  
  // eBay Integration
  ebay_purchases: { primaryKey: 'id', displayFields: ['user_id', 'ebay_item_id', 'title', 'price', 'purchase_date', 'status'] },
  user_ebay_accounts: { primaryKey: 'id', displayFields: ['user_id', 'ebay_user_id', 'ebay_username', 'is_active', 'last_sync_at'] },
  ebay_sync_logs: { primaryKey: 'id', displayFields: ['user_id', 'sync_type', 'items_processed', 'sports_cards_found', 'status'] },
  ebay_deletion_log: { primaryKey: 'log_id', displayFields: ['username', 'user_id', 'deletion_date', 'processed'] },
  
  // Utilities & Processing
  duplicate_detection_job: { primaryKey: 'job_id', displayFields: ['started_at', 'status', 'total_players_checked', 'groups_found'] },
  duplicate_player_group: { primaryKey: 'group_id', displayFields: ['similarity_score', 'total_cards', 'status', 'created'] },
  duplicate_player_member: { primaryKey: 'member_id', displayFields: ['group_id', 'player_id', 'is_primary', 'created'] },
  staging_data: { primaryKey: 'staging_data_id', displayFields: ['primary_key', 'table_name', 'field_name', 'data_value', 'user'] },
  user_card_photo: { primaryKey: 'user_card_photo_id', displayFields: ['user_card', 'photo_url', 'created'] }
}

// Helper function to get table columns
const getTableColumns = async (tableName) => {
  try {
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ${tableName}
      ORDER BY ORDINAL_POSITION
    `
    return columns.map(col => col.COLUMN_NAME)
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error)
    return []
  }
}

// Helper function to serialize BigInt values
const serializeRow = (row) => {
  const serialized = {}
  Object.keys(row).forEach(key => {
    serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
  })
  return serialized
}

// GET /api/admin-data/table-data/:tableName - Get paginated table data
router.get('/table-data/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params
    const { limit = 10000, search = '', sortColumn = null, sortDirection = 'asc' } = req.query
    
    // Validate table name
    if (!TABLE_CONFIG[tableName]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table ${tableName} is not configured for admin access`
      })
    }
    
    const config = TABLE_CONFIG[tableName]
    const limitNum = parseInt(limit) || 10000
    
    // Get table columns
    const columns = await getTableColumns(tableName)
    
    // Build enhanced search condition and joins to get display names
    let searchCondition = ''
    let joinClauses = ''
    let selectFields = 't.*'
    
    // Always add joins for foreign key relationships to get display names
    if (tableName === 'team') {
      joinClauses += ' LEFT JOIN [organization] org ON t.[organization] = org.[organization_id]'
      selectFields += ', org.[name] as organization_name'
    } else if (tableName === 'series') {
      joinClauses += ' LEFT JOIN [set] s ON t.[set] = s.[set_id]'
      joinClauses += ' LEFT JOIN [series] ps ON t.[parallel_of_series] = ps.[series_id]'
      selectFields += ', s.[name] as set_name, ps.[name] as parallel_of_series_name'
    } else if (tableName === 'set') {
      joinClauses += ' LEFT JOIN [organization] org ON t.[organization] = org.[organization_id]'
      selectFields += ', org.[name] as organization_name'
    } else if (tableName === 'card') {
      joinClauses += ' LEFT JOIN [series] ser ON t.[series] = ser.[series_id]'
      joinClauses += ' LEFT JOIN [grading_agency] ga ON t.[grading_agency] = ga.[grading_agency_id]'
      selectFields += ', ser.[name] as series_name, ga.[name] as grading_agency_name'
    }

    // Build search condition if search term provided
    if (search) {
      const escapedSearch = search.replace(/'/g, "''") // Escape single quotes
      const searchClauses = []
      
      // Search in direct text fields (exclude IDs and system fields)
      const excludeFromSearch = [config.primaryKey, 'created', 'updated', 'created_at', 'updated_at']
      const textFields = columns.filter(field => 
        !excludeFromSearch.includes(field) && 
        !field.toLowerCase().includes('password') &&
        !field.toLowerCase().includes('token') &&
        !field.toLowerCase().includes('secret') &&
        !field.toLowerCase().endsWith('_id') &&
        !field.toLowerCase().includes('id')
      )
      
      // Add text field searches
      textFields.forEach(field => {
        searchClauses.push(`CAST(t.[${field}] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
      })
      
      // Add foreign key relationship searches
      if (tableName === 'team') {
        searchClauses.push(`CAST(org.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
      } else if (tableName === 'series') {
        searchClauses.push(`CAST(s.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
        searchClauses.push(`CAST(ps.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
      } else if (tableName === 'set') {
        searchClauses.push(`CAST(org.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
      } else if (tableName === 'card') {
        searchClauses.push(`CAST(ser.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
        searchClauses.push(`CAST(ga.[name] AS NVARCHAR(MAX)) LIKE '%${escapedSearch}%'`)
      }
      
      if (searchClauses.length > 0) {
        searchCondition = `WHERE ${searchClauses.join(' OR ')}`
      }
    }
    
    // Get total count with proper table alias
    const countQuery = `SELECT COUNT(*) as total FROM [${tableName}] t ${joinClauses} ${searchCondition}`
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)
    
    // Build ORDER BY clause with table alias
    let orderByClause = `ORDER BY t.[${config.primaryKey}] DESC`
    if (sortColumn && columns.includes(sortColumn)) {
      const direction = sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      orderByClause = `ORDER BY t.[${sortColumn}] ${direction}`
    }
    
    // Get all data (no pagination) with related display names
    const dataQuery = `
      SELECT TOP (${limitNum}) ${selectFields} FROM [${tableName}] t
      ${joinClauses}
      ${searchCondition}
      ${orderByClause}
    `
    
    const data = await prisma.$queryRawUnsafe(dataQuery)
    const serializedData = data.map(serializeRow)
    
    res.json({
      data: serializedData,
      columns: columns,
      primaryKey: config.primaryKey,
      total: total,
      limit: limitNum
    })
    
  } catch (error) {
    console.error('Error fetching table data:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch table data',
      details: error.message
    })
  }
})

// POST /api/admin-data/table-data/:tableName - Create new record
router.post('/table-data/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params
    const recordData = req.body
    
    // Validate table name
    if (!TABLE_CONFIG[tableName]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table ${tableName} is not configured for admin access`
      })
    }
    
    // Get table columns to filter the data
    const columns = await getTableColumns(tableName)
    const config = TABLE_CONFIG[tableName]
    
    // Filter out the primary key and any invalid columns
    const filteredData = {}
    Object.keys(recordData).forEach(key => {
      if (columns.includes(key) && key !== config.primaryKey) {
        filteredData[key] = recordData[key] || null
      }
    })
    
    // Build INSERT query with proper SQL escaping
    const columnNames = Object.keys(filteredData)
    const values = Object.values(filteredData)
    
    // Build VALUES clause with proper SQL escaping
    const valuesList = values.map(value => {
      if (value === null || value === undefined) {
        return 'NULL'
      } else if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'` // Escape single quotes
      } else {
        return value
      }
    }).join(', ')
    
    const insertQuery = `
      INSERT INTO [${tableName}] ([${columnNames.join('], [')}])
      VALUES (${valuesList})
    `
    
    await prisma.$executeRawUnsafe(insertQuery)
    
    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_action_log ([user_id], action_type, entity_type, entity_id, created)
      VALUES (${BigInt(req.user.userId)}, 'CREATE', ${tableName}, 'new', GETDATE())
    `
    
    res.status(201).json({
      message: 'Record created successfully'
    })
    
  } catch (error) {
    console.error('Error creating record:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create record',
      details: error.message
    })
  }
})

// PUT /api/admin-data/table-data/:tableName/:id - Update record
router.put('/table-data/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params
    const recordData = req.body
    
    console.log('UPDATE REQUEST RECEIVED:', {
      tableName,
      id,
      recordData,
      userId: req.user?.userId
    })
    
    // Validate table name
    if (!TABLE_CONFIG[tableName]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table ${tableName} is not configured for admin access`
      })
    }
    
    const config = TABLE_CONFIG[tableName]
    const columns = await getTableColumns(tableName)
    
    // Filter and prepare update data
    console.log('Available columns:', columns)
    console.log('Primary key:', config.primaryKey)
    console.log('Record data received:', recordData)
    
    const filteredData = {}
    Object.keys(recordData).forEach(key => {
      console.log(`Processing field: ${key}, value: ${recordData[key]}, column exists: ${columns.includes(key)}, is primary key: ${key === config.primaryKey}`)
      if (columns.includes(key) && key !== config.primaryKey) {
        filteredData[key] = recordData[key] === '' ? null : recordData[key]
        console.log(`Added to filteredData: ${key} = ${filteredData[key]}`)
      }
    })
    
    console.log('Final filteredData:', filteredData)
    
    // Check if there are any fields to update
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        message: 'No editable fields were provided for update'
      })
    }
    
    // Build UPDATE query - SQL Server with Prisma requires string interpolation, not parameters
    const keys = Object.keys(filteredData)
    const values = Object.values(filteredData)
    
    // Build SET clauses with proper SQL escaping
    const setClauses = keys.map((key, index) => {
      const value = values[index]
      if (value === null) {
        return `[${key}] = NULL`
      } else if (typeof value === 'string') {
        return `[${key}] = '${value.replace(/'/g, "''")}'` // Escape single quotes
      } else {
        return `[${key}] = ${value}`
      }
    })
    
    const updateQuery = `
      UPDATE [${tableName}]
      SET ${setClauses.join(', ')}
      WHERE [${config.primaryKey}] = ${id}
    `
    
    console.log(`Executing UPDATE query:`, updateQuery)
    console.log(`With values:`, values)
    console.log(`And ID:`, id)
    
    await prisma.$executeRawUnsafe(updateQuery)
    
    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_action_log ([user_id], action_type, entity_type, entity_id, created)
      VALUES (${BigInt(req.user.userId)}, 'UPDATE', ${tableName}, ${id}, GETDATE())
    `
    
    res.json({
      message: 'Record updated successfully'
    })
    
  } catch (error) {
    console.error('Error updating record:', error)
    console.error('Table:', tableName)
    console.error('Record ID:', id)
    console.error('Update data:', recordData)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update record',
      details: error.message
    })
  }
})

// DELETE /api/admin-data/table-data/:tableName/:id - Delete record
router.delete('/table-data/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params
    
    // Validate table name
    if (!TABLE_CONFIG[tableName]) {
      return res.status(400).json({
        error: 'Invalid table name',
        message: `Table ${tableName} is not configured for admin access`
      })
    }
    
    const config = TABLE_CONFIG[tableName]
    
    // Execute delete
    const deleteQuery = `DELETE FROM [${tableName}] WHERE [${config.primaryKey}] = ${id}`
    await prisma.$executeRawUnsafe(deleteQuery)
    
    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_action_log ([user_id], action_type, entity_type, entity_id, created)
      VALUES (${BigInt(req.user.userId)}, 'DELETE', ${tableName}, ${id}, GETDATE())
    `
    
    res.json({
      message: 'Record deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting record:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete record',
      details: error.message
    })
  }
})

// GET /api/admin-data/tables - Get list of available tables
router.get('/tables', async (req, res) => {
  try {
    const tables = Object.keys(TABLE_CONFIG).map(tableName => ({
      name: tableName,
      displayName: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      primaryKey: TABLE_CONFIG[tableName].primaryKey,
      displayFields: TABLE_CONFIG[tableName].displayFields
    }))
    
    res.json({
      tables: tables
    })
    
  } catch (error) {
    console.error('Error fetching tables list:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch tables list'
    })
  }
})

// POST /api/admin-data/parse-spreadsheet - Parse uploaded spreadsheet (PREVIEW MODE)
router.post('/parse-spreadsheet', async (req, res) => {
  try {
    // This is a mock parser for preview purposes
    // In a real implementation, you would use libraries like 'xlsx' or 'csv-parser'
    
    console.log('Spreadsheet parsing requested (PREVIEW MODE)')
    
    // Mock response simulating different spreadsheet formats
    const mockData = {
      filename: 'sample-spreadsheet.xlsx',
      sheets: [
        {
          name: 'Base',
          headers: ['Card Number', 'Player', 'Team', 'Subset', 'Print Run'],
          data: [
            { 'Card Number': '1', 'Player': 'Mike Trout', 'Team': 'LAA', 'Subset': 'Base', 'Print Run': '' },
            { 'Card Number': '2', 'Player': 'Ronald Acuña Jr.', 'Team': 'ATL', 'Subset': 'Base', 'Print Run': '' },
            { 'Card Number': '3', 'Player': 'Fernando Tatís Jr.', 'Team': 'SD', 'Subset': 'Base', 'Print Run': '' },
            { 'Card Number': '4', 'Player': 'Juan Soto', 'Team': 'NYY', 'Subset': 'Base', 'Print Run': '' },
            { 'Card Number': '5', 'Player': 'Vladimir Guerrero Jr.', 'Team': 'TOR', 'Subset': 'Base', 'Print Run': '' }
          ]
        },
        {
          name: 'Parallels',
          headers: ['Card Number', 'Player', 'Team', 'Parallel', 'Print Run'],
          data: [
            { 'Card Number': '1', 'Player': 'Mike Trout', 'Team': 'LAA', 'Parallel': 'Gold', 'Print Run': '50' },
            { 'Card Number': '1', 'Player': 'Mike Trout', 'Team': 'LAA', 'Parallel': 'Silver', 'Print Run': '99' },
            { 'Card Number': '2', 'Player': 'Ronald Acuña Jr.', 'Team': 'ATL', 'Parallel': 'Gold', 'Print Run': '50' }
          ]
        },
        {
          name: 'Autographs',
          headers: ['Card Number', 'Player', 'Team', 'Type', 'Print Run'],
          data: [
            { 'Card Number': 'A-MT', 'Player': 'Mike Trout', 'Team': 'LAA', 'Type': 'On-Card Auto', 'Print Run': '25' },
            { 'Card Number': 'A-RA', 'Player': 'Ronald Acuña Jr.', 'Team': 'ATL', 'Type': 'Sticker Auto', 'Print Run': '99' }
          ]
        }
      ],
      metadata: {
        totalRows: 10,
        sheetsFound: 3,
        estimatedFormat: 'Topps Standard',
        confidence: 0.85
      }
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    res.json(mockData)
    
  } catch (error) {
    console.error('Error parsing spreadsheet:', error)
    res.status(500).json({
      error: 'Parse error',
      message: 'Failed to parse spreadsheet',
      details: error.message
    })
  }
})

module.exports = router