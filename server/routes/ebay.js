const express = require('express')
const { router: authRouter } = require('./ebay-auth')
const syncRouter = require('./ebay-sync')
const testingRouter = require('./ebay-testing')
const router = express.Router()

// Mount eBay authentication routes
router.use('/auth', authRouter)

// Mount eBay sync routes
router.use('/sync', syncRouter)

// Mount eBay testing routes
router.use('/test', testingRouter)

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