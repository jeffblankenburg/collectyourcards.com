const express = require('express')

// Import all sub-routers
const userSubmissionsRouter = require('./user-submissions')
const setsRouter = require('./sets')
const seriesRouter = require('./series')
const cardsRouter = require('./cards')
const playersRouter = require('./players')
const teamsRouter = require('./teams')
const adminReviewRouter = require('./admin-review')
const adminQueueRouter = require('./admin-queue')
const templatesRouter = require('./templates')
const provisionalCardsRouter = require('./provisional-cards')
const provisionalAdminRouter = require('./provisional-admin')

const router = express.Router()

// =============================================================================
// MOUNT ALL SUB-ROUTERS
// =============================================================================

// User submission endpoints (my-submissions, my-all-submissions, my-stats)
router.use('/', userSubmissionsRouter)

// Provisional card system (user-centric card submission)
router.use('/', provisionalCardsRouter)  // POST /provisional-card, GET /my-provisional-cards, GET /my-bundles

// Entity-specific submission endpoints (legacy)
router.use('/', setsRouter)        // POST /set, POST /set-edit
router.use('/', seriesRouter)      // POST /series
router.use('/', cardsRouter)       // POST /card-edit, POST /cards
router.use('/', playersRouter)     // POST /player-edit, POST /player, POST /player-alias, POST /player-team, GET /player/:playerId/cards-with-images
router.use('/', teamsRouter)       // POST /team, POST /team-edit

// Admin endpoints
router.use('/', adminQueueRouter)  // GET /admin/stats, GET /admin/review-all
router.use('/', adminReviewRouter) // POST /admin/review/:type/:id/approve|reject
router.use('/', provisionalAdminRouter) // GET/POST /admin/bundles/*, /admin/provisional-card/*

// Template downloads
router.use('/', templatesRouter)   // GET /template/series-checklist

module.exports = router
