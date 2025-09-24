/**
 * eBay Mock Data Generator
 * 
 * Creates realistic test data for eBay integration testing
 * Bypasses the notoriously unreliable eBay sandbox
 */

const mockSportsCardTitles = [
  "2024 Topps Chrome Mike Trout #1 Baseball Card PSA 10",
  "2023 Panini Prizm LeBron James Lakers Basketball Card Silver Refractor",
  "2024 Upper Deck Connor McDavid Young Guns Rookie RC Hockey Card",
  "2023 Topps Update Ronald Acuña Jr. Autograph Baseball Card #/50",
  "2024 Panini Select Justin Herbert Chargers Football Card Patch Auto",
  "2023 Bowman Chrome Wander Franco Rookie Card Rainbow Foil",
  "2024 Topps Stadium Club Shohei Ohtani Dodgers Photo Variation",
  "2023 Panini Contenders Josh Allen Bills Ticket Auto #/99",
  "2024 Upper Deck The Cup Connor Bedard Rookie Patch Auto #/199",
  "2023 Topps Chrome Julio Rodríguez Rookie Refractor RC",
  "2024 Panini Immaculate Luka Dončić Mavs Premium Patch #/25",
  "2023 Topps Heritage Acuña Jr. High Number Short Print SP",
  "2024 Bowman Sterling Termarr Johnson 1st Bowman Auto RC",
  "2023 Panini Phoenix Ja Morant Grizzlies Rising Stars Insert",
  "2024 Upper Deck Series 1 Auston Matthews Leafs Base Card"
]

const mockNonSportsCardTitles = [
  "iPhone 14 Pro Max 256GB Space Black Unlocked Apple",
  "Nike Air Jordan 1 Retro High OG Chicago Size 10.5",
  "Sony PlayStation 5 Console Disc Version Brand New",
  "Vintage 1950s Coca-Cola Glass Bottles Set of 6",
  "Samsung 55\" 4K QLED Smart TV QN55Q70A 2023 Model",
  "MacBook Pro 16\" M2 Max 1TB Space Gray AppleCare+",
  "Lego Star Wars Millennium Falcon 75257 Complete Set",
  "Rolex Submariner Date 126610LN Black Dial Steel Watch",
  "Canon EOS R5 Mirrorless Camera Body Only Professional",
  "KitchenAid Artisan Stand Mixer 5-Quart Tilt-Head Red"
]

const mockSellerNames = [
  "sportscards_central",
  "cardshop_online", 
  "vintage_collectibles",
  "probstein123",
  "comc_consignment",
  "dacardworld",
  "steelcitycollectibles",
  "blowoutcards",
  "topps_official",
  "panini_america"
]

const mockEbayCategories = {
  sportsCards: {
    categoryId: 212,
    categoryPath: "Collectibles > Sports Trading Cards > Trading Card Singles"
  },
  electronics: {
    categoryId: 58058,
    categoryPath: "Consumer Electronics > Cell Phones & Smartphones"
  },
  shoes: {
    categoryId: 15709,
    categoryPath: "Clothing, Shoes & Accessories > Men's Shoes > Athletic Shoes"
  },
  toys: {
    categoryId: 220,
    categoryPath: "Toys & Hobbies > Building Toys > LEGO"
  }
}

/**
 * Generate realistic mock eBay order data
 */
function generateMockOrders(count = 10, includeNonCards = true) {
  const orders = []
  const now = new Date()
  
  for (let i = 0; i < count; i++) {
    // Mix of sports cards and non-sports items for realistic testing
    const isSportsCard = includeNonCards ? Math.random() > 0.3 : true
    const titles = isSportsCard ? mockSportsCardTitles : mockNonSportsCardTitles
    const title = titles[Math.floor(Math.random() * titles.length)]
    const seller = mockSellerNames[Math.floor(Math.random() * mockSellerNames.length)]
    
    // Generate realistic prices
    let price
    if (isSportsCard) {
      // Sports cards: $5-$500 range with some expensive outliers
      if (Math.random() > 0.9) {
        price = (Math.random() * 2000 + 500).toFixed(2) // $500-$2500 for rare cards
      } else {
        price = (Math.random() * 495 + 5).toFixed(2) // $5-$500 for normal cards
      }
    } else {
      // Non-sports items: wider price range
      price = (Math.random() * 1500 + 10).toFixed(2) // $10-$1510
    }
    
    // Create order date within last 90 days
    const daysAgo = Math.floor(Math.random() * 90)
    const orderDate = new Date(now)
    orderDate.setDate(orderDate.getDate() - daysAgo)
    
    const orderId = `mock_order_${Date.now()}_${i}`
    const itemId = `mock_item_${Date.now()}_${i}`
    const transactionId = `mock_txn_${Date.now()}_${i}`
    
    const order = {
      orderId: orderId,
      creationDate: orderDate.toISOString(),
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      sellerId: seller,
      seller: {
        username: seller,
        feedbackPercentage: Math.floor(Math.random() * 5) + 95, // 95-99.9%
        feedbackScore: Math.floor(Math.random() * 50000) + 1000
      },
      pricingSummary: {
        total: {
          value: price,
          currency: "USD"
        },
        subtotal: {
          value: (parseFloat(price) * 0.9).toFixed(2),
          currency: "USD"
        },
        deliveryCost: {
          value: (parseFloat(price) * 0.1).toFixed(2),
          currency: "USD"
        }
      },
      lineItems: [{
        lineItemId: transactionId,
        legacyItemId: itemId,
        itemId: itemId,
        title: title,
        quantity: 1,
        soldFormat: "FIXED_PRICE",
        total: {
          value: price,
          currency: "USD"
        },
        image: {
          imageUrl: generateMockImageUrl(title, isSportsCard)
        },
        itemLocation: {
          postalCode: "90210",
          countryCode: "US"
        },
        taxes: [{
          taxType: "STATE_SALES_TAX",
          taxPercentage: "8.25",
          includedInBasePrice: false
        }],
        // Add category info
        categoryId: isSportsCard ? mockEbayCategories.sportsCards.categoryId : mockEbayCategories.electronics.categoryId,
        categoryPath: isSportsCard ? mockEbayCategories.sportsCards.categoryPath : mockEbayCategories.electronics.categoryPath
      }]
    }
    
    orders.push(order)
  }
  
  return orders
}

/**
 * Generate mock image URL based on item type
 */
function generateMockImageUrl(title, isSportsCard) {
  if (isSportsCard) {
    // Use realistic sports card placeholder
    const cardTypes = ['baseball', 'basketball', 'football', 'hockey']
    const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)]
    return `https://via.placeholder.com/400x560/1e40af/ffffff?text=${cardType.toUpperCase()}+CARD`
  } else {
    // Use generic product placeholder
    return `https://via.placeholder.com/400x400/6b7280/ffffff?text=PRODUCT`
  }
}

/**
 * Generate mock user profile data
 */
function generateMockUserProfile() {
  return {
    userId: "mock_user_123456",
    username: "test_buyer_sandbox",
    registrationDate: "2020-01-15T10:30:00.000Z",
    feedbackPercentage: 100,
    feedbackScore: 1247,
    uniqueNegativeFeedbackCount: 0,
    uniquePositiveFeedbackCount: 1247,
    uniqueNeutralFeedbackCount: 0,
    status: "CONFIRMED",
    sellerInfo: {
      sellerLevel: "NONE",
      sellerAccount: "BUSINESS"
    },
    businessAccount: false
  }
}

/**
 * Create realistic error responses for testing error handling
 */
function generateMockErrors() {
  return {
    authError: {
      error: "invalid_token",
      error_description: "The access token provided is expired, revoked, malformed, or invalid for other reasons."
    },
    rateLimitError: {
      errors: [{
        errorId: 1050,
        domain: "API_BROWSE",
        category: "REQUEST", 
        message: "The call limit has been exceeded.",
        longMessage: "The call limit for this application has been exceeded."
      }]
    },
    notFoundError: {
      errors: [{
        errorId: 1001,
        domain: "API_BROWSE",
        category: "REQUEST",
        message: "No orders found.",
        longMessage: "No orders were found for the specified criteria."
      }]
    }
  }
}

/**
 * Smart mock data based on testing scenario
 */
function generateScenarioData(scenario = 'mixed') {
  switch (scenario) {
    case 'sports_cards_only':
      return {
        orders: generateMockOrders(15, false), // Only sports cards
        profile: generateMockUserProfile()
      }
    
    case 'no_sports_cards':
      return {
        orders: generateMockOrders(10, true).filter(order => 
          !mockSportsCardTitles.some(title => 
            order.lineItems[0].title.includes(title.split(' ')[2]) // Rough filter
          )
        ),
        profile: generateMockUserProfile()
      }
    
    case 'mixed_realistic':
      return {
        orders: generateMockOrders(25, true), // Mix of everything
        profile: generateMockUserProfile()
      }
    
    case 'empty':
      return {
        orders: [],
        profile: generateMockUserProfile()
      }
    
    case 'error':
      return generateMockErrors().notFoundError
      
    default:
      return {
        orders: generateMockOrders(12, true),
        profile: generateMockUserProfile()
      }
  }
}

module.exports = {
  generateMockOrders,
  generateMockUserProfile,
  generateMockErrors,
  generateScenarioData,
  mockSportsCardTitles,
  mockNonSportsCardTitles,
  mockSellerNames,
  mockEbayCategories
}