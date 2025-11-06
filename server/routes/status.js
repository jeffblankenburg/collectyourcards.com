const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const router = express.Router()
const telemetryService = require('../services/telemetryService')

// Initialize Prisma with error handling (don't fail route loading if Prisma fails)
try {
} catch (error) {
  console.error('Status route: Prisma client failed to initialize:', error.message)
}

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthData = {
      status: 'operational',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      monitoring: telemetryService.getStatus()
    }
    res.json(healthData)
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// Database status endpoint
router.get('/database/status', async (req, res) => {
  try {
    if (!prisma) {
      return res.status(500).json({
        status: 'error',
        message: 'Prisma client not available',
        error: 'Prisma client failed to initialize'
      })
    }
    
    // Test database connection with timeout
    try {
      await prisma.$connect()
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for engine to be ready
    } catch (connectError) {
      throw new Error(`Connection failed: ${connectError.message}`)
    }
    
    // Get record counts using raw queries with better error handling
    const [cardsResult, playersResult, teamsResult, usersResult, setsResult, seriesResult] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as count FROM card`.catch(err => {
        console.error('Card count query failed:', err.message)
        return [{ count: 0 }]
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM player`.catch(err => {
        console.error('Player count query failed:', err.message)
        return [{ count: 0 }]
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM team`.catch(err => {
        console.error('Team count query failed:', err.message)
        return [{ count: 0 }]
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM [user]`.catch(err => {
        console.error('User count query failed:', err.message)
        return [{ count: 0 }]
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM [set]`.catch(err => {
        console.error('Set count query failed:', err.message)
        return [{ count: 0 }]
      }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM series`.catch(err => {
        console.error('Series count query failed:', err.message)
        return [{ count: 0 }]
      })
    ])

    const cardsCount = Number(cardsResult[0]?.count || 0)
    const playersCount = Number(playersResult[0]?.count || 0)
    const teamsCount = Number(teamsResult[0]?.count || 0)
    const usersCount = Number(usersResult[0]?.count || 0)
    const setsCount = Number(setsResult[0]?.count || 0)
    const seriesCount = Number(seriesResult[0]?.count || 0)

    // Get table count
    const tables = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'
    `

    res.json({
      status: 'operational',
      type: 'SQL Server 2022',
      connection: 'established',
      tables: tables[0]?.count || 0,
      records: {
        cards: cardsCount,
        players: playersCount,
        teams: teamsCount,
        users: usersCount,
        sets: setsCount,
        series: seriesCount
      },
      dockerContainer: 'collect-cards-db',
      port: 1433
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    })
  }
})

// Endpoints monitoring
router.get('/endpoints/status', async (req, res) => {
  try {
    // Manually define the known endpoints for now since route extraction is complex
    const endpoints = [
      // Health endpoints
      { method: 'GET', path: '/health', status: 'operational', description: 'Basic server health check' },
      { method: 'GET', path: '/api/health', status: 'operational', description: 'Detailed backend health' },
      { method: 'GET', path: '/api/database/status', status: 'operational', description: 'Database connectivity check' },
      { method: 'GET', path: '/api/endpoints/status', status: 'operational', description: 'Endpoint monitoring' },
      { method: 'GET', path: '/api/environment', status: 'operational', description: 'Environment information' },
      
      // Authentication endpoints
      { method: 'POST', path: '/api/auth/register', status: 'operational', description: 'User registration with email verification' },
      { method: 'POST', path: '/api/auth/login', status: 'operational', description: 'User login with JWT' },
      { method: 'POST', path: '/api/auth/verify-email', status: 'operational', description: 'Email verification' },
      { method: 'POST', path: '/api/auth/resend-verification', status: 'operational', description: 'Resend verification email' },
      { method: 'POST', path: '/api/auth/forgot-password', status: 'operational', description: 'Request password reset' },
      { method: 'POST', path: '/api/auth/reset-password', status: 'operational', description: 'Reset password with token' },
      { method: 'GET', path: '/api/auth/profile', status: 'operational', description: 'Get user profile (protected)' },
      { method: 'POST', path: '/api/auth/logout', status: 'operational', description: 'Logout current session' },
      { method: 'POST', path: '/api/auth/logout-all', status: 'operational', description: 'Logout all sessions' },
      
      // Mock endpoints (placeholder)
      { method: 'ALL', path: '/api/cards/*', status: 'mock', description: 'Card management (not implemented)' },
      { method: 'ALL', path: '/api/collection/*', status: 'mock', description: 'Collection management (not implemented)' },
      { method: 'ALL', path: '/api/import/*', status: 'mock', description: 'Spreadsheet import (not implemented)' },
      { method: 'ALL', path: '/api/ebay/*', status: 'mock', description: 'eBay integration (not implemented)' }
    ]

    // Test a few key endpoints to verify they're working
    try {
      // Test basic health endpoint
      const response = await fetch('http://localhost:3001/health')
      if (!response.ok) {
        endpoints.find(e => e.path === '/health').status = 'error'
      }
    } catch (error) {
      endpoints.find(e => e.path === '/health').status = 'error'
    }

    res.json({
      total: endpoints.length,
      endpoints: endpoints,
      last_checked: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve endpoints',
      error: error.message
    })
  }
})

// Environment information (sanitized)
router.get('/environment', async (req, res) => {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      NODE_VERSION: process.version,
      PLATFORM: process.platform,
      ARCH: process.arch,
      FRONTEND_URL: process.env.FRONTEND_URL || 'Not configured',
      DATABASE_STATUS: process.env.DATABASE_URL ? 'Configured' : 'Not configured',
      JWT_STATUS: process.env.JWT_SECRET ? 'Configured' : 'Not configured',
      EMAIL_STATUS: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? 'Configured' : 'Not configured',
      EBAY_STATUS: process.env.EBAY_CLIENT_ID ? 'Configured' : 'Not configured'
    }
    res.json(envInfo)
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve environment info',
      error: error.message
    })
  }
})

// OpenTelemetry monitoring status endpoint
router.get('/telemetry/status', async (req, res) => {
  try {
    const telemetryStatus = telemetryService.getStatus()

    // Get environment variables (without sensitive data)
    const envConfig = {
      APPLICATIONINSIGHTS_CONNECTION_STRING: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'Configured (hidden)' : 'Not configured',
      SERVICE_NAME: process.env.SERVICE_NAME || 'collect-your-cards-api',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }

    // Get recent business events info
    const recentEvents = [
      'Note: In development (without connection string), events are logged to console',
      'With Application Insights connection string: Events export to Azure',
      'With Dynatrace endpoint: Events export to Dynatrace',
      'Check server logs for real-time event tracking'
    ]

    // Check if telemetry is properly configured
    const isConfigured = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING

    const troubleshooting = []
    if (!isConfigured) {
      troubleshooting.push('APPLICATIONINSIGHTS_CONNECTION_STRING not configured - telemetry will log to console only')
    }
    if (!telemetryStatus.telemetry_enabled) {
      troubleshooting.push('OpenTelemetry SDK failed to initialize')
    }

    res.json({
      ...telemetryStatus,
      environment_config: envConfig,
      telemetry_configured: !!isConfigured,
      recent_events: recentEvents,
      troubleshooting: troubleshooting,
      setup_guide: '/OPENTELEMETRY_MIGRATION.md',
      expected_data_delay: '2-3 minutes for data to appear in dashboard'
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve Dynatrace status',
      error: error.message
    })
  }
})

// Detailed status endpoint for production diagnostics
router.get('/status', async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      routes: {},
      prisma: {},
      azure: {}
    }

    // Check which routes are loaded
    const routeFiles = [
      { name: 'Auth', path: './auth' },
      { name: 'Cards', path: './cards' },
      { name: 'Collection', path: './collection' },
      { name: 'Import', path: './import' },
      { name: 'eBay', path: './ebay' },
      { name: 'Search', path: './search' }
    ]

    routeFiles.forEach(route => {
      try {
        require(route.path)
        status.routes[route.name] = { loaded: true }
      } catch (error) {
        status.routes[route.name] = { 
          loaded: false, 
          error: error.message.substring(0, 100) 
        }
      }
    })

    // Check Prisma status
    if (prisma) {
      try {
        status.prisma.clientAvailable = true
        
        try {
          await prisma.$connect()
          status.prisma.databaseConnected = true
          
          // Test a simple query
          const result = await prisma.$queryRaw`SELECT 1 as test`
          status.prisma.queryTest = 'success'
          
          await prisma.$disconnect()
        } catch (dbError) {
          status.prisma.databaseConnected = false
          status.prisma.error = dbError.message
        }
      } catch (prismaError) {
        status.prisma.clientAvailable = false
        status.prisma.error = prismaError.message
      }
    } else {
      status.prisma.clientAvailable = false
      status.prisma.error = 'Prisma client failed to initialize during route loading'
    }

    // Add connection string info (sanitized)
    if (process.env.DATABASE_URL) {
      // Sanitize connection string for display
      const dbUrl = process.env.DATABASE_URL
      if (dbUrl.includes('sqlserver://')) {
        const parts = dbUrl.split('@')
        if (parts.length > 1) {
          status.prisma.connectionString = `sqlserver://***@${parts[1]}`
        } else {
          status.prisma.connectionString = 'sqlserver://*** (connection string format issue)'
        }
      } else {
        status.prisma.connectionString = 'Available (non-SQL Server)'
      }
    } else {
      status.prisma.connectionString = 'Not configured'
    }

    // Azure-specific information
    if (process.env.NODE_ENV === 'production') {
      status.azure = {
        website_site_name: process.env.WEBSITE_SITE_NAME || 'Not available',
        website_resource_group: process.env.WEBSITE_RESOURCE_GROUP || 'Not available',
        website_instance_id: process.env.WEBSITE_INSTANCE_ID || 'Not available',
        website_hostname: process.env.WEBSITE_HOSTNAME || 'Not available',
        scm_commit_id: process.env.SCM_COMMIT_ID || 'Not available',
        port: process.env.PORT || '3001',
        trust_proxy: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'
      }
    }

    res.json(status)
    
  } catch (error) {
    console.error('Status check error:', error)
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router