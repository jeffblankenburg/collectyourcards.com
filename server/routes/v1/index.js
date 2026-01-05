/**
 * API v1 Router
 *
 * Mounts all v1 API routes at /api/v1
 *
 * This is the versioned, standardized API designed for third-party developers.
 * All endpoints follow RESTful conventions and return consistent response formats.
 */

const express = require('express')
const router = express.Router()

// Import v1 route modules
const playersRouter = require('./players')
const teamsRouter = require('./teams')
const setsRouter = require('./sets')
const seriesRouter = require('./series')
const cardsRouter = require('./cards')
const searchRouter = require('./search')

// Mount routes
router.use('/players', playersRouter)
router.use('/teams', teamsRouter)
router.use('/sets', setsRouter)
router.use('/series', seriesRouter)
router.use('/cards', cardsRouter)
router.use('/search', searchRouter)

// API v1 health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString()
    }
  })
})

module.exports = router
