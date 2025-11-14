const express = require('express')
const { router: authRouter } = require('./ebay-auth')
const syncRouter = require('./ebay-sync')
const testingRouter = require('./ebay-testing')
const listingsRouter = require('./ebay-listings')
const router = express.Router()

// Mount eBay authentication routes
router.use('/auth', authRouter)

// Mount eBay sync routes
router.use('/sync', syncRouter)

// Mount eBay testing routes
router.use('/test', testingRouter)

// Mount eBay listings routes
router.use('/listings', listingsRouter)

// Health check for eBay integration
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'eBay integration is available',
    endpoints: {
      auth: '/api/ebay/auth/*',
      status: '/api/ebay/auth/status',
      connect: '/api/ebay/auth/initiate',
      disconnect: '/api/ebay/auth/disconnect',
      testDisconnect: '/api/ebay/auth/test-disconnect',
      sync: '/api/ebay/sync/orders',
      purchases: '/api/ebay/sync/purchases',
      listings: '/api/ebay/listings/create',
      previewListing: '/api/ebay/listings/preview/:card_id',
      testing: '/api/ebay/test/*'
    },
    testing: {
      connection: '/api/ebay/test/connection',
      mockSync: '/api/ebay/test/mock-sync',
      smartSync: '/api/ebay/test/smart-sync',
      scenarios: '/api/ebay/test/scenarios',
      clearData: '/api/ebay/test/clear-data'
    }
  })
})

module.exports = router