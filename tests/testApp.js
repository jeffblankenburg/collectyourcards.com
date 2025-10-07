// Test-specific app setup to ensure real routes are loaded
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

// Create Express app
const app = express()

// Configuration
const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  environment: process.env.NODE_ENV || 'test'
}

// Security middleware
app.use(helmet())
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.environment
  })
})

// Load real routes for testing
try {
  // Status routes (always available)
  app.use('/api', require('../server/routes/status'))

  // Auth routes
  app.use('/api/auth', require('../server/routes/auth'))

  // User routes
  app.use('/api/user/cards', require('../server/routes/user-cards'))
  app.use('/api/user/locations', require('../server/routes/user-locations'))
  app.use('/api/user/collection', require('../server/routes/user-collection-cards'))

  // Profile routes
  app.use('/api/profile', require('../server/routes/user-profile'))

  // Comment routes
  app.use('/api/comments', require('../server/routes/comments'))

  // Notification routes
  app.use('/api/notifications', require('../server/routes/notifications'))

  // Search routes
  app.use('/api/search', require('../server/routes/search'))

  // Card routes
  app.use('/api/cards', require('../server/routes/cards'))
  app.use('/api/card-detail', require('../server/routes/card-detail'))

  // Admin routes
  app.use('/api/admin', require('../server/routes/admin-users'))

  console.log('✅ Real routes loaded for testing')
} catch (error) {
  console.error('❌ Failed to load routes for testing:', error.message)
  console.error('Stack:', error.stack)

  // Fallback mock route for testing
  app.use('/api/*', (req, res) => {
    res.status(500).json({
      error: 'Test route loading failed',
      message: error.message
    })
  })
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Test app error:', err)
  
  res.status(500).json({
    error: err.message,
    stack: config.environment === 'test' ? err.stack : undefined
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  })
})

module.exports = {
  app,
  config
}