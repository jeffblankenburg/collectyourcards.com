const express = require('express')
const { getPrismaClient } = require('../utils/prisma-pool-manager')
const { authMiddleware } = require('../middleware/auth')
const { getValidAccessToken, ebayClient } = require('./ebay-auth')
const { processEbayPurchase } = require('../utils/automatic-card-processor')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

// GET /api/ebay/sync/orders - Manually sync eBay orders
router.post('/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Get valid access token
    let accessToken
    try {
      accessToken = await getValidAccessToken(userId)
    } catch (error) {
      return res.status(401).json({
        error: 'eBay account not connected',
        message: 'Please connect your eBay account first'
      })
    }
    
    // Get the eBay account
    const ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (!ebayAccount) {
      return res.status(404).json({
        error: 'eBay account not found'
      })
    }
    
    // Create sync log entry
    const syncLog = await prisma.ebay_sync_logs.create({
      data: {
        user_id: BigInt(userId),
        ebay_account_id: ebayAccount.id,
        sync_type: 'manual',
        sync_start: new Date(),
        items_processed: 0,
        sports_cards_found: 0,
        new_purchases: 0,
        errors_encountered: 0,
        status: 'running'
      }
    })
    
    try {
      // Fetch recent orders from eBay
      console.log('Fetching orders from eBay for user:', userId)
      const orders = await ebayClient.getUserOrders(accessToken)
      
      console.log('eBay orders response:', JSON.stringify(orders, null, 2))
      
      // Process each order
      let itemsProcessed = 0
      let sportsCardsFound = 0
      let newPurchases = 0
      let cardsAutoAdded = 0
      let cardsSuggested = 0
      const addedCards = []
      
      const orderItems = orders?.orders || []
      
      for (const order of orderItems) {
        itemsProcessed++
        
        // Check if this order already exists
        const existingPurchase = await prisma.ebay_purchases.findFirst({
          where: {
            user_id: BigInt(userId),
            ebay_order_id: order.orderId
          }
        })
        
        if (!existingPurchase) {
          // Save the purchase first
          for (const lineItem of (order.lineItems || [])) {
            const purchase = await prisma.ebay_purchases.create({
              data: {
                user_id: BigInt(userId),
                ebay_account_id: ebayAccount.id,
                ebay_item_id: lineItem.legacyItemId || lineItem.itemId || 'unknown',
                ebay_transaction_id: lineItem.lineItemId,
                ebay_order_id: order.orderId,
                title: lineItem.title || 'Unknown Item',
                purchase_date: new Date(order.creationDate || Date.now()),
                price: parseFloat(lineItem.total?.value || '0'),
                currency: lineItem.total?.currency || 'USD',
                quantity: lineItem.quantity || 1,
                seller_name: order.seller?.username || null,
                image_url: lineItem.image?.imageUrl || null,
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
                price: parseFloat(lineItem.total?.value || '0'),
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
              
              console.log('Processed eBay purchase:', {
                id: purchase.id.toString(),
                title: purchase.title,
                action: processingResult.action,
                confidence: processingResult.confidence
              })
              
            } catch (processingError) {
              console.error('Error processing purchase:', processingError)
              // Continue with other purchases
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
          status: 'completed'
        }
      })
      
      // Update last sync time
      await prisma.user_ebay_accounts.update({
        where: { id: ebayAccount.id },
        data: {
          last_sync_at: new Date(),
          updated_at: new Date()
        }
      })
      
      res.json({
        success: true,
        message: `Sync completed successfully`,
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
        }
      })
      
    } catch (syncError) {
      console.error('Sync error:', syncError)
      
      // Update sync log with error
      await prisma.ebay_sync_logs.update({
        where: { id: syncLog.id },
        data: {
          sync_end: new Date(),
          errors_encountered: 1,
          error_details: syncError.message,
          status: 'failed'
        }
      })
      
      throw syncError
    }
    
  } catch (error) {
    console.error('eBay sync error:', error)
    res.status(500).json({
      error: 'Failed to sync eBay orders',
      message: error.message
    })
  }
})

// POST /api/ebay/sync/process-existing - Process existing unprocessed purchases
router.post('/process-existing', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Get unprocessed purchases
    const unprocessedPurchases = await prisma.ebay_purchases.findMany({
      where: {
        user_id: BigInt(userId),
        status: {
          in: ['pending_review', 'not_processed']
        }
      },
      orderBy: {
        purchase_date: 'desc'
      }
    })
    
    if (unprocessedPurchases.length === 0) {
      return res.json({
        success: true,
        message: 'No unprocessed purchases found',
        stats: {
          processed: 0,
          autoAdded: 0,
          suggested: 0,
          ignored: 0
        }
      })
    }
    
    // Process each purchase
    let autoAdded = 0
    let suggested = 0
    let ignored = 0
    const addedCards = []
    
    for (const purchase of unprocessedPurchases) {
      try {
        const processingResult = await processEbayPurchase(userId, {
          id: purchase.id.toString(),
          title: purchase.title,
          price: purchase.price ? Number(purchase.price) : 0,
          purchase_date: purchase.purchase_date,
          seller_name: purchase.seller_name,
          image_url: purchase.image_url
        })
        
        if (processingResult.action === 'auto_added') {
          autoAdded++
          if (processingResult.cardAdded) {
            addedCards.push(processingResult.cardAdded)
          }
        } else if (processingResult.action === 'suggested') {
          suggested++
        } else {
          ignored++
        }
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error processing purchase ${purchase.id}:`, error)
        ignored++
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${unprocessedPurchases.length} existing purchases`,
      stats: {
        processed: unprocessedPurchases.length,
        autoAdded,
        suggested,
        ignored
      },
      automaticProcessing: {
        enabled: true,
        cardsAddedToCollection: autoAdded,
        cardsSuggestedForReview: suggested,
        totalProcessed: unprocessedPurchases.length
      }
    })
    
  } catch (error) {
    console.error('Error processing existing purchases:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process existing purchases',
      message: error.message
    })
  }
})

// GET /api/ebay/sync/purchases - Get synced purchases
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    const purchases = await prisma.ebay_purchases.findMany({
      where: {
        user_id: BigInt(userId)
      },
      orderBy: {
        purchase_date: 'desc'
      },
      take: 100
    })
    
    // Serialize BigInt values
    const serializedPurchases = purchases.map(p => ({
      ...p,
      id: p.id.toString(),
      user_id: p.user_id.toString(),
      ebay_account_id: p.ebay_account_id?.toString(),
      matched_card_id: p.matched_card_id?.toString(),
      price: p.price ? Number(p.price) : 0,
      card_confidence: p.card_confidence ? Number(p.card_confidence) : 0,
      match_confidence: p.match_confidence ? Number(p.match_confidence) : 0
    }))
    
    res.json({
      success: true,
      purchases: serializedPurchases
    })
    
  } catch (error) {
    console.error('Error fetching purchases:', error)
    res.status(500).json({
      error: 'Failed to fetch eBay purchases',
      message: error.message
    })
  }
})

// Simple sports card detection
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