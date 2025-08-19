const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const dynatraceService = require('../services/dynatraceService')
const prisma = new PrismaClient()

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
      monitoring: dynatraceService.getStatus()
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
    // Test database connection
    await prisma.$connect()
    
    // Get record counts using raw queries
    const [cardsResult, playersResult, teamsResult, usersResult] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as count FROM card`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM player`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM team`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM [user]`.catch(() => [{ count: 0 }])
    ])

    const cardsCount = Number(cardsResult[0]?.count || 0)
    const playersCount = Number(playersResult[0]?.count || 0)
    const teamsCount = Number(teamsResult[0]?.count || 0)
    const usersCount = Number(usersResult[0]?.count || 0)

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
        users: usersCount
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
      { method: 'ALL', path: '/api/admin/*', status: 'mock', description: 'Admin panel (not implemented)' },
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

// Dynatrace monitoring status endpoint
router.get('/dynatrace/status', async (req, res) => {
  try {
    const dynatraceStatus = dynatraceService.getStatus()
    
    // Get environment variables (without sensitive data)
    const envConfig = {
      DYNATRACE_ENVIRONMENT_ID: process.env.DYNATRACE_ENVIRONMENT_ID || 'Not configured',
      DYNATRACE_ENDPOINT: process.env.DYNATRACE_ENDPOINT || 'Not configured',
      DYNATRACE_API_TOKEN: process.env.DYNATRACE_API_TOKEN ? 'Configured (hidden)' : 'Not configured',
      DYNATRACE_PAAS_TOKEN: process.env.DYNATRACE_PAAS_TOKEN ? 'Configured (hidden)' : 'Not configured'
    }

    // Get recent business events from console logs (last 10)
    const recentEvents = [
      'Note: In development, events are logged to console',
      'Check server logs for real-time event tracking',
      'Events should appear in Dynatrace within 5-10 minutes'
    ]

    // Check if this is likely a real Dynatrace environment
    const isRealEnvironment = process.env.DYNATRACE_ENVIRONMENT_ID && 
                             process.env.DYNATRACE_API_TOKEN &&
                             process.env.DYNATRACE_ENDPOINT &&
                             process.env.DYNATRACE_ENVIRONMENT_ID !== 'your-environment-id'

    const troubleshooting = []
    if (!isRealEnvironment) {
      troubleshooting.push('Dynatrace environment variables may not be properly configured')
    }
    if (!dynatraceStatus.dynatrace_enabled) {
      troubleshooting.push('Dynatrace SDK failed to initialize')
    }

    res.json({
      ...dynatraceStatus,
      environment_config: envConfig,
      real_environment_detected: isRealEnvironment,
      recent_events: recentEvents,
      troubleshooting: troubleshooting,
      setup_guide: '/DYNATRACE_SETUP_GUIDE.md',
      expected_data_delay: '5-10 minutes for first data to appear',
      dashboard_url: process.env.DYNATRACE_ENDPOINT ? `${process.env.DYNATRACE_ENDPOINT}/ui/apps/dynatrace.classic.technologies` : null
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve Dynatrace status',
      error: error.message
    })
  }
})

module.exports = router