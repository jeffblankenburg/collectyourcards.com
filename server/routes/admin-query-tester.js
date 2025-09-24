const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireAdmin } = require('../middleware/auth')

const prisma = new PrismaClient()

// Test SQL query execution (SELECT only)
router.post('/test-query', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { query, userId } = req.body

    if (!query || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query and userId are required' 
      })
    }

    // Validate query is SELECT only
    const cleanQuery = query.trim().toUpperCase()
    
    if (!cleanQuery.startsWith('SELECT')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Only SELECT queries are allowed' 
      })
    }

    // Check for dangerous keywords
    const dangerousKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
      'EXEC', 'EXECUTE', 'SP_', 'XP_', 'BULK', 'BACKUP', 'RESTORE',
      'GRANT', 'REVOKE', 'DENY', 'OPENROWSET', 'OPENDATASOURCE'
    ]
    
    for (const keyword of dangerousKeywords) {
      if (cleanQuery.includes(keyword)) {
        return res.status(400).json({ 
          success: false, 
          error: `Dangerous keyword detected: ${keyword}` 
        })
      }
    }

    // Check for SQL injection patterns
    const injectionPatterns = [
      /;\s*--/, // Comment injection
      /;\s*\/\*/, // Block comment injection
      /'\s*OR\s+'1'\s*=\s*'1/, // Classic OR injection
      /'\s*OR\s+1\s*=\s*1/, // Numeric OR injection
      /UNION\s+SELECT/i, // Union injection
      /WAITFOR\s+DELAY/i, // Time delay injection
      /BENCHMARK\s*\(/i // MySQL benchmark injection
    ]
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Potential SQL injection pattern detected' 
        })
      }
    }

    // Replace @user_id parameter with actual user ID
    let parameterizedQuery = query.replace(/@user_id/g, userId.toString())
    
    // Fix SQL Server reserved keyword issues by escaping table names
    // Only escape if not already escaped (avoid double brackets)
    if (!parameterizedQuery.includes('[set]')) {
      parameterizedQuery = parameterizedQuery.replace(/\bset\b(?!\s*=)/gi, '[set]')
    }
    if (!parameterizedQuery.includes('[user]')) {
      parameterizedQuery = parameterizedQuery.replace(/\buser\b(?!\s*=|\s*\.|_)/gi, '[user]')
    }
    
    console.log('Executing parameterized query:', parameterizedQuery)
    
    // Track execution time
    const startTime = process.hrtime.bigint()
    
    // Execute the query
    const result = await prisma.$queryRawUnsafe(parameterizedQuery)
    
    const endTime = process.hrtime.bigint()
    const executionTime = Number(endTime - startTime) / 1000000 // Convert to milliseconds

    // Log admin query for audit purposes
    console.log(`[ADMIN QUERY] User ${req.user.user_id} executed query for user ${userId}:`, {
      query: parameterizedQuery.substring(0, 200),
      executionTime: `${executionTime.toFixed(2)}ms`,
      resultCount: result.length
    })

    // Serialize BigInt values for JSON response
    const serializedResult = result.map(row => {
      const serializedRow = {}
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'bigint') {
          serializedRow[key] = Number(value)
        } else {
          serializedRow[key] = value
        }
      }
      return serializedRow
    })

    res.json({
      success: true,
      result: serializedResult,
      rowCount: result.length,
      executionTime: Math.round(executionTime * 100) / 100, // Round to 2 decimal places
      query: parameterizedQuery
    })

  } catch (error) {
    console.error('Query execution error:', error)
    
    // Return detailed error for debugging
    let errorMessage = error.message
    
    // Check for common SQL Server errors and provide helpful messages
    if (error.message.includes('Invalid column name')) {
      errorMessage = `Invalid column name. Check that all column names exist in the referenced tables.`
    } else if (error.message.includes('Invalid object name')) {
      errorMessage = `Invalid table name. Check that all table names are correct and exist.`
    } else if (error.message.includes('Syntax error')) {
      errorMessage = `SQL syntax error. Please check your query syntax.`
    } else if (error.message.includes('Cannot convert')) {
      errorMessage = `Data type conversion error. Check data types in your query.`
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      executionTime: 0
    })
  }
})

// Get list of users for testing (limited for performance)
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.$queryRaw`
      SELECT TOP 50
        user_id,
        first_name,
        last_name,
        email,
        is_active
      FROM [user]
      WHERE is_active = 1
      ORDER BY first_name, last_name
    `

    // Serialize BigInt user_id
    const serializedUsers = users.map(user => ({
      ...user,
      user_id: Number(user.user_id)
    }))

    res.json(serializedUsers)

  } catch (error) {
    console.error('Error fetching users for query testing:', error)
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error.message 
    })
  }
})

// Get sample achievement queries for reference
router.get('/sample-queries', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const sampleQueries = [
      {
        name: "Basic Card Count",
        query: "SELECT COUNT(*) as total_cards FROM user_card WHERE [user] = @user_id",
        description: "Count total cards owned by user"
      },
      {
        name: "Rookie Cards",
        query: `SELECT COUNT(*) as rookie_cards 
                 FROM user_card uc 
                 INNER JOIN card c ON uc.card = c.card_id 
                 WHERE uc.[user] = @user_id AND c.is_rookie = 1`,
        description: "Count rookie cards owned by user"
      },
      {
        name: "Collection Value",
        query: `SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) as total_value
                 FROM user_card uc 
                 WHERE uc.[user] = @user_id`,
        description: "Calculate total collection value"
      },
      {
        name: "Unique Players",
        query: `SELECT COUNT(DISTINCT pt.player) as unique_players
                 FROM user_card uc 
                 INNER JOIN card c ON uc.card = c.card_id 
                 INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
                 INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
                 WHERE uc.[user] = @user_id`,
        description: "Count unique players in collection"
      },
      {
        name: "Graded Cards",
        query: "SELECT COUNT(*) as graded_cards FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL",
        description: "Count graded cards in collection"
      }
    ]

    res.json({ samples: sampleQueries })

  } catch (error) {
    console.error('Error fetching sample queries:', error)
    res.status(500).json({ 
      error: 'Failed to fetch sample queries',
      details: error.message 
    })
  }
})

module.exports = router