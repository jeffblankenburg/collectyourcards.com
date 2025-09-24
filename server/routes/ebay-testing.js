/**
 * eBay Testing Routes
 * 
 * Comprehensive testing system for eBay integration
 * Handles sandbox failures with automatic fallback to mock data
 */

const express = require('express')
const { getPrismaClient } = require('../utils/prisma-pool-manager')
const { authMiddleware } = require('../middleware/auth')
const { getValidAccessToken, ebayClient } = require('./ebay-auth')
const { generateScenarioData, generateMockErrors } = require('../utils/ebay-mock-data')
const { processEbayPurchase } = require('../utils/automatic-card-processor')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

/**
 * GET /api/ebay/test/connection
 * Test eBay API connection and credentials
 */
router.get('/connection', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Get eBay account
    const ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (!ebayAccount) {
      return res.json({
        success: false,
        connected: false,
        message: 'No eBay account connected',
        recommendation: 'Connect your eBay account first'
      })
    }
    
    // Test API connection
    let connectionTest = {
      tokenValid: false,
      profileAccessible: false,
      ordersAccessible: false,
      errors: []
    }
    
    try {
      // Test 1: Validate access token
      const accessToken = await getValidAccessToken(userId)
      connectionTest.tokenValid = true
      
      // Test 2: Get user profile
      try {
        const profile = await ebayClient.getUserProfile(accessToken)
        connectionTest.profileAccessible = true
        connectionTest.profileData = {
          username: profile.username || 'Unknown',
          userId: profile.userId || 'Unknown',
          feedbackScore: profile.feedbackScore || 0
        }
      } catch (profileError) {
        connectionTest.errors.push({
          test: 'getUserProfile',
          error: profileError.message,
          code: profileError.response?.status
        })
      }
      
      // Test 3: Get user orders
      try {
        const orders = await ebayClient.getUserOrders(accessToken)
        connectionTest.ordersAccessible = true
        connectionTest.orderCount = orders?.orders?.length || 0
      } catch (ordersError) {
        connectionTest.errors.push({
          test: 'getUserOrders', 
          error: ordersError.message,
          code: ordersError.response?.status
        })
      }
      
    } catch (tokenError) {
      connectionTest.errors.push({
        test: 'getValidAccessToken',
        error: tokenError.message
      })
    }
    
    // Determine overall status
    const overallSuccess = connectionTest.tokenValid && connectionTest.profileAccessible
    
    res.json({
      success: overallSuccess,
      connected: true,
      ebayAccount: {
        username: ebayAccount.ebay_username,
        connectedAt: ebayAccount.created_at,
        lastSync: ebayAccount.last_sync_at
      },
      connectionTest,
      recommendation: overallSuccess 
        ? 'eBay connection is working properly'
        : 'eBay sandbox may be experiencing issues. Consider using mock data for testing.'
    })
    
  } catch (error) {
    console.error('eBay connection test error:', error)
    res.status(500).json({
      success: false,
      connected: false,
      error: 'Failed to test eBay connection',
      message: error.message
    })
  }
})

/**
 * POST /api/ebay/test/mock-sync
 * Test purchase sync using mock data (bypasses sandbox issues)
 */
router.post('/mock-sync', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { scenario = 'mixed_realistic', count = 12 } = req.body
    
    console.log(`Creating mock eBay sync for user ${userId} with scenario: ${scenario}`)
    
    // Get or create eBay account record
    let ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (!ebayAccount) {
      // Create mock eBay account for testing
      const mockUserId = 'sandbox_tester_' + Date.now().toString().slice(-6)
      ebayAccount = await prisma.user_ebay_accounts.create({
        data: {
          user_id: BigInt(userId),
          ebay_user_id: mockUserId,
          ebay_username: `TestUser${mockUserId.slice(-3)}`, // More realistic username
          access_token: 'mock_encrypted_token',
          scope_permissions: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.order.readonly',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    }
    
    // Generate mock data based on scenario
    const mockData = generateScenarioData(scenario)
    
    if (scenario === 'error') {
      return res.status(400).json({
        success: false,
        error: 'Mock error scenario',
        ebayError: mockData
      })
    }
    
    // Create sync log
    const syncLog = await prisma.ebay_sync_logs.create({
      data: {
        user_id: BigInt(userId),
        ebay_account_id: ebayAccount.id,
        sync_type: 'mock_test',
        sync_start: new Date(),
        items_processed: 0,
        sports_cards_found: 0,
        new_purchases: 0,
        errors_encountered: 0,
        status: 'running'
      }
    })
    
    // Process mock orders
    let itemsProcessed = 0
    let sportsCardsFound = 0
    let newPurchases = 0
    let cardsAutoAdded = 0
    let cardsSuggested = 0
    const addedCards = []
    
    for (const order of mockData.orders) {
      itemsProcessed++
      
      // Check if already exists (prevent duplicates during testing)
      const existingPurchase = await prisma.ebay_purchases.findFirst({
        where: {
          user_id: BigInt(userId),
          ebay_order_id: order.orderId
        }
      })
      
      if (!existingPurchase) {
        for (const lineItem of order.lineItems) {
          // Save the purchase first
          const purchase = await prisma.ebay_purchases.create({
            data: {
              user_id: BigInt(userId),
              ebay_account_id: ebayAccount.id,
              ebay_item_id: lineItem.itemId,
              ebay_transaction_id: lineItem.lineItemId,
              ebay_order_id: order.orderId,
              title: lineItem.title,
              purchase_date: new Date(order.creationDate),
              price: parseFloat(lineItem.total.value),
              currency: lineItem.total.currency,
              quantity: lineItem.quantity,
              seller_name: order.seller?.username,
              image_url: lineItem.image?.imageUrl,
              ebay_category_id: lineItem.categoryId,
              category_path: lineItem.categoryPath,
              is_sports_card: false, // Will be updated by processor
              card_confidence: 0,    // Will be updated by processor
              status: 'not_processed',
              manual_match: false,
              created_at: new Date(),
              updated_at: new Date()
            }
          })
          
          newPurchases++
          
          // Process the purchase for automatic card addition
          try {
            const processingResult = await processEbayPurchase(userId, {
              id: purchase.id.toString(),
              title: purchase.title,
              price: parseFloat(lineItem.total.value),
              purchase_date: purchase.purchase_date,
              seller_name: purchase.seller_name,
              image_url: purchase.image_url
            })
            
            if (processingResult.action === 'auto_added') {
              cardsAutoAdded++
              if (processingResult.cardAdded) {
                addedCards.push(processingResult.cardAdded)
              }
              sportsCardsFound++
            } else if (processingResult.action === 'suggested') {
              cardsSuggested++
              sportsCardsFound++
            } else if (processingResult.confidence > 0.3) {
              sportsCardsFound++
            }
            
            console.log('Processed mock purchase:', {
              id: purchase.id.toString(),
              title: purchase.title,
              action: processingResult.action,
              confidence: processingResult.confidence
            })
            
          } catch (processingError) {
            console.error('Error processing mock purchase:', processingError)
          }
        }
      }
    }
    
    // Update sync log
    await prisma.ebay_sync_logs.update({
      where: { id: syncLog.id },
      data: {
        sync_end: new Date(),
        items_processed: itemsProcessed,
        sports_cards_found: sportsCardsFound,
        new_purchases: newPurchases,
        status: 'completed',
        error_details: `Mock sync completed successfully with scenario: ${scenario}`
      }
    })
    
    // Update account sync time
    await prisma.user_ebay_accounts.update({
      where: { id: ebayAccount.id },
      data: {
        last_sync_at: new Date(),
        updated_at: new Date()
      }
    })
    
    res.json({
      success: true,
      message: `Mock sync completed with scenario: ${scenario}`,
      isMockData: true,
      scenario: scenario,
      stats: {
        itemsProcessed,
        sportsCardsFound,
        newPurchases,
        cardsAutoAdded,
        cardsSuggested,
        addedCards: addedCards.length
      },
      automaticProcessing: {
        enabled: true,
        cardsAddedToCollection: cardsAutoAdded,
        cardsSuggestedForReview: cardsSuggested,
        totalCardsDetected: sportsCardsFound
      },
      syncLogId: syncLog.id.toString()
    })
    
  } catch (error) {
    console.error('Mock sync error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to perform mock sync',
      message: error.message
    })
  }
})

/**
 * POST /api/ebay/test/smart-sync
 * Intelligent sync that tries real eBay first, falls back to mock data
 */
router.post('/smart-sync', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Try real eBay sync first
    try {
      const accessToken = await getValidAccessToken(userId)
      const orders = await ebayClient.getUserOrders(accessToken)
      
      // If we get here, eBay is working - use real sync logic
      // (This would call the existing sync endpoint)
      console.log('eBay sandbox is working, using real data')
      
      // For now, redirect to regular sync
      return res.json({
        success: true,
        message: 'eBay sandbox is working, use regular sync endpoint',
        useRealSync: true,
        recommendation: 'Call /api/ebay/sync/orders for real data'
      })
      
    } catch (ebayError) {
      console.log('eBay sandbox failed, falling back to mock data:', ebayError.message)
      
      // eBay failed, use mock data with realistic scenario
      const mockResponse = await router.handle({
        ...req,
        body: { scenario: 'mixed_realistic', count: 8 }
      }, res)
      
      // Don't return here, let the mock-sync handler respond
      return
    }
    
  } catch (error) {
    console.error('Smart sync error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to perform smart sync',
      message: error.message
    })
  }
})

/**
 * GET /api/ebay/test/scenarios
 * List available testing scenarios
 */
router.get('/scenarios', (req, res) => {
  res.json({
    success: true,
    scenarios: {
      'mixed_realistic': {
        description: 'Mix of sports cards and other items (realistic)',
        sportsCards: '~70%',
        itemCount: '12-15',
        priceRange: '$5-$500'
      },
      'sports_cards_only': {
        description: 'Only sports cards',
        sportsCards: '100%',
        itemCount: '15',
        priceRange: '$5-$2500'
      },
      'no_sports_cards': {
        description: 'No sports cards (electronics, shoes, etc.)',
        sportsCards: '0%',
        itemCount: '10',
        priceRange: '$10-$1500'
      },
      'empty': {
        description: 'No purchases found',
        sportsCards: '0%',
        itemCount: '0',
        priceRange: 'N/A'
      },
      'error': {
        description: 'Simulate eBay API error',
        sportsCards: 'N/A',
        itemCount: 'Error',
        priceRange: 'N/A'
      }
    },
    recommendation: 'Use mixed_realistic for most testing'
  })
})

/**
 * DELETE /api/ebay/test/clear-data
 * Clear all test eBay data for user
 */
router.delete('/clear-data', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Delete all eBay purchases for user
    await prisma.ebay_purchases.deleteMany({
      where: {
        user_id: BigInt(userId)
      }
    })
    
    // Delete sync logs
    await prisma.ebay_sync_logs.deleteMany({
      where: {
        user_id: BigInt(userId)
      }
    })
    
    res.json({
      success: true,
      message: 'All eBay test data cleared successfully'
    })
    
  } catch (error) {
    console.error('Clear test data error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear test data',
      message: error.message
    })
  }
})

// Import sports card detection function
function detectSportsCard(title) {
  if (!title) return false
  
  const titleLower = title.toLowerCase()
  
  // Sports keywords
  const sportsKeywords = ['baseball', 'football', 'basketball', 'hockey', 'soccer', 'nba', 'nfl', 'mlb', 'nhl']
  
  // Card keywords
  const cardKeywords = ['card', 'rookie', 'rc', 'auto', 'autograph', 'relic', 'patch', 'parallel', 'refractor', 'prizm', 'topps', 'panini', 'upper deck', 'bowman', 'chrome', 'optic']
  
  // Check if title contains both sports and card keywords
  const hasSportsKeyword = sportsKeywords.some(keyword => titleLower.includes(keyword))
  const hasCardKeyword = cardKeywords.some(keyword => titleLower.includes(keyword))
  
  return hasSportsKeyword || hasCardKeyword
}

module.exports = router