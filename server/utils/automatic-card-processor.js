/**
 * Automatic Card Processor
 * 
 * Seamlessly processes eBay purchases and automatically adds cards to user collections
 * Handles location creation, card matching, and status updates
 */

const { getPrismaClient } = require('./prisma-pool-manager')
const { detectAndMatchCard } = require('./card-detection-engine')
const prisma = getPrismaClient()

/**
 * Process an eBay purchase and automatically handle card addition
 */
async function processEbayPurchase(userId, ebayPurchase) {
  const result = {
    success: false,
    action: 'ignored',
    message: 'Purchase not processed',
    cardAdded: null,
    confidence: 0
  }

  try {
    console.log(`Processing eBay purchase: ${ebayPurchase.title}`)

    // Step 1: Detect and match card
    const detection = await detectAndMatchCard(ebayPurchase.title, ebayPurchase.price)
    
    result.confidence = detection.confidence

    if (!detection.isCard) {
      result.action = 'ignored'
      result.message = 'Not identified as a sports card'
      await updatePurchaseStatus(ebayPurchase.id, 'not_a_card', detection.reason)
      return result
    }

    // Step 2: Handle based on confidence level
    if (detection.status === 'auto_add' && detection.matchedCard) {
      // High confidence - automatically add to collection
      const addedCard = await automaticallyAddCard(userId, ebayPurchase, detection)
      if (addedCard) {
        result.success = true
        result.action = 'auto_added'
        result.message = `Automatically added ${detection.extractedData.playerName || 'card'} to your collection`
        result.cardAdded = addedCard
        await updatePurchaseStatus(ebayPurchase.id, 'auto_added', `Added to collection as card ID ${addedCard.card_id}`)
      }
    } else if (detection.status === 'suggest_match' && detection.matchedCard) {
      // Medium confidence - create suggestion for user review
      result.action = 'suggested'
      result.message = `Found possible match for ${detection.extractedData.playerName || 'card'} - review suggested`
      await updatePurchaseStatus(ebayPurchase.id, 'suggested_match', `Possible match found: ${detection.matchedCard.card_id}`)
    } else if (detection.status === 'no_match') {
      // Sports card but no database match - could still add as "unknown card"
      const addedCard = await addUnknownCard(userId, ebayPurchase, detection)
      if (addedCard) {
        result.success = true
        result.action = 'added_unknown'
        result.message = `Added ${detection.extractedData.playerName || 'unknown card'} as unmatched card`
        result.cardAdded = addedCard
        await updatePurchaseStatus(ebayPurchase.id, 'added_unknown', 'Added as unmatched sports card')
      }
    } else {
      result.action = 'needs_review'
      result.message = 'Sports card detected but needs manual review'
      await updatePurchaseStatus(ebayPurchase.id, 'needs_review', detection.reason)
    }

  } catch (error) {
    console.error('Error processing eBay purchase:', error)
    result.message = `Processing error: ${error.message}`
    await updatePurchaseStatus(ebayPurchase.id, 'error', error.message)
  }

  return result
}

/**
 * Automatically add a matched card to user's collection
 */
async function automaticallyAddCard(userId, ebayPurchase, detection) {
  try {
    // Get or create "In Transit To Me" location
    const location = await getOrCreateTransitLocation(userId)
    
    const userCard = await prisma.user_card.create({
      data: {
        user: BigInt(userId),
        card: BigInt(detection.matchedCard.card_id),
        purchase_price: ebayPurchase.price || 0,
        notes: `Automatically added from eBay purchase: ${ebayPurchase.title}`,
        user_location: location.location_id,
        is_special: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    console.log(`✅ Auto-added card ${detection.matchedCard.card_id} to user ${userId} collection`)

    return {
      ...userCard,
      user_card_id: userCard.user_card_id.toString(),
      user: userCard.user.toString(),
      card: userCard.card.toString(),
      user_location: userCard.user_location.toString(),
      card_info: detection.matchedCard
    }

  } catch (error) {
    console.error('Error automatically adding card:', error)
    return null
  }
}

/**
 * Add an unmatched sports card as a placeholder entry
 */
async function addUnknownCard(userId, ebayPurchase, detection) {
  try {
    // For now, we'll just update the purchase status
    // In the future, we could create placeholder card entries
    console.log(`📝 Detected sports card but no database match: ${ebayPurchase.title}`)
    
    // Could create a "user_unknown_cards" table for these
    // For now, just mark the purchase appropriately
    return null

  } catch (error) {
    console.error('Error adding unknown card:', error)
    return null
  }
}

/**
 * Get existing "In Transit" location for user
 */
async function getOrCreateTransitLocation(userId) {
  try {
    // Check if user has "In Transit" location (created during account setup)
    let location = await prisma.user_location.findFirst({
      where: {
        user_id: BigInt(userId),
        location: 'In Transit'
      }
    })

    if (!location) {
      // Fallback: look for any "In Transit" variations
      location = await prisma.user_location.findFirst({
        where: {
          user_id: BigInt(userId),
          location: {
            contains: 'Transit'
          }
        }
      })
    }

    return {
      ...location,
      location_id: location.location_id.toString(),
      user_id: location.user_id.toString()
    }

  } catch (error) {
    console.error('Error creating transit location:', error)
    
    // Fallback: try to find any user location
    const fallbackLocation = await prisma.user_location.findFirst({
      where: {
        user_id: BigInt(userId)
      }
    })

    if (fallbackLocation) {
      return {
        ...fallbackLocation,
        location_id: fallbackLocation.location_id.toString(),
        user_id: fallbackLocation.user_id.toString()
      }
    }

    throw new Error('No user locations available')
  }
}

/**
 * Update eBay purchase status and details
 */
async function updatePurchaseStatus(purchaseId, status, details) {
  try {
    await prisma.ebay_purchases.update({
      where: { id: BigInt(purchaseId) },
      data: {
        status: status,
        processed_at: new Date(),
        user_notes: details,
        updated_at: new Date()
      }
    })
  } catch (error) {
    console.error('Error updating purchase status:', error)
  }
}

/**
 * Process multiple eBay purchases in batch
 */
async function processPurchasesBatch(userId, purchases) {
  const results = {
    total: purchases.length,
    autoAdded: 0,
    suggested: 0,
    ignored: 0,
    errors: 0,
    addedCards: []
  }

  for (const purchase of purchases) {
    try {
      const result = await processEbayPurchase(userId, purchase)
      
      switch (result.action) {
        case 'auto_added':
          results.autoAdded++
          if (result.cardAdded) {
            results.addedCards.push(result.cardAdded)
          }
          break
        case 'suggested':
          results.suggested++
          break
        case 'ignored':
          results.ignored++
          break
        default:
          results.errors++
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`Error processing purchase ${purchase.id}:`, error)
      results.errors++
    }
  }

  return results
}

/**
 * Get user's unprocessed eBay purchases
 */
async function getUnprocessedPurchases(userId) {
  try {
    const purchases = await prisma.ebay_purchases.findMany({
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

    return purchases.map(p => ({
      ...p,
      id: p.id.toString(),
      user_id: p.user_id.toString(),
      ebay_account_id: p.ebay_account_id?.toString(),
      matched_card_id: p.matched_card_id?.toString(),
      price: p.price ? Number(p.price) : 0
    }))

  } catch (error) {
    console.error('Error getting unprocessed purchases:', error)
    return []
  }
}

module.exports = {
  processEbayPurchase,
  automaticallyAddCard,
  processPurchasesBatch,
  getUnprocessedPurchases,
  getOrCreateTransitLocation,
  updatePurchaseStatus
}