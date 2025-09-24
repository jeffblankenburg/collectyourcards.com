/**
 * AI-Powered Card Detection and Matching Engine
 * 
 * Parses eBay purchase titles and automatically matches them to cards in our database
 * Uses fuzzy matching, keyword extraction, and confidence scoring
 */

const { getPrismaClient } = require('./prisma-pool-manager')
const prisma = getPrismaClient()

/**
 * Main card detection and matching function
 */
async function detectAndMatchCard(ebayTitle, ebayPrice = 0) {
  const result = {
    isCard: false,
    confidence: 0,
    matchedCard: null,
    extractedData: {},
    status: 'not_a_card',
    reason: 'No sports card keywords detected'
  }

  // Step 1: Basic sports card detection
  const cardDetection = detectSportsCard(ebayTitle)
  if (!cardDetection.isCard) {
    return result
  }

  result.isCard = true
  result.confidence = cardDetection.confidence

  // Step 2: Extract card data from title
  const extractedData = extractCardData(ebayTitle)
  result.extractedData = extractedData

  // Step 3: Try to match to database
  if (extractedData.year && extractedData.playerName) {
    const matchResult = await findMatchingCards(extractedData, ebayPrice)
    
    if (matchResult.bestMatch) {
      result.matchedCard = matchResult.bestMatch
      result.confidence = Math.min(result.confidence + matchResult.confidence, 1.0)
      
      // Determine status based on confidence
      if (result.confidence >= 0.85) {
        result.status = 'auto_add'
        result.reason = 'High confidence match found'
      } else if (result.confidence >= 0.6) {
        result.status = 'suggest_match'
        result.reason = 'Good match found, user confirmation recommended'
      } else {
        result.status = 'no_match'
        result.reason = 'Sports card detected but no good database match'
      }
    } else {
      result.status = 'no_match'
      result.reason = 'Sports card detected but no database match found'
    }
  } else {
    result.status = 'incomplete_data'
    result.reason = 'Sports card detected but missing player/year information'
  }

  return result
}

/**
 * Enhanced sports card detection with confidence scoring
 */
function detectSportsCard(title) {
  if (!title) return { isCard: false, confidence: 0 }
  
  const titleLower = title.toLowerCase()
  let confidence = 0
  let reasons = []

  // Sports keywords (weighted scoring)
  const sportsKeywords = [
    { terms: ['baseball', 'mlb'], weight: 0.3 },
    { terms: ['basketball', 'nba'], weight: 0.3 },
    { terms: ['football', 'nfl'], weight: 0.3 },
    { terms: ['hockey', 'nhl'], weight: 0.3 },
    { terms: ['soccer'], weight: 0.25 }
  ]

  // Card-specific keywords (higher weights for definitive terms)
  const cardKeywords = [
    { terms: ['rookie', 'rc'], weight: 0.4 },
    { terms: ['autograph', 'auto', 'signed'], weight: 0.35 },
    { terms: ['patch', 'jersey', 'relic'], weight: 0.35 },
    { terms: ['refractor', 'parallel', 'chrome'], weight: 0.3 },
    { terms: ['prizm', 'optic', 'select'], weight: 0.3 },
    { terms: ['topps', 'panini', 'upper deck', 'bowman'], weight: 0.35 },
    { terms: ['card'], weight: 0.2 }
  ]

  // Check for sports keywords
  let foundSports = false
  for (const sport of sportsKeywords) {
    if (sport.terms.some(term => titleLower.includes(term))) {
      confidence += sport.weight
      foundSports = true
      reasons.push(`Found sport: ${sport.terms[0]}`)
      break // Only count one sport
    }
  }

  // Check for card keywords
  let foundCard = false
  for (const cardType of cardKeywords) {
    if (cardType.terms.some(term => titleLower.includes(term))) {
      confidence += cardType.weight
      foundCard = true
      reasons.push(`Found card keyword: ${cardType.terms[0]}`)
    }
  }

  // Year detection adds confidence
  const yearMatch = titleLower.match(/\b(19|20)\d{2}\b/)
  if (yearMatch) {
    confidence += 0.15
    reasons.push(`Found year: ${yearMatch[0]}`)
  }

  // Card number detection
  const numberMatch = titleLower.match(/#\d+|card\s+\d+|\b\d+\/\d+\b/)
  if (numberMatch) {
    confidence += 0.1
    reasons.push('Found card number pattern')
  }

  // Grading mentions
  if (titleLower.match(/\b(psa|bgs|sgc)\s+\d+|\bgraded\b|\bmint\b/)) {
    confidence += 0.1
    reasons.push('Found grading reference')
  }

  // Must have either sports + card keywords OR very strong card indicators
  const isCard = (foundSports && foundCard) || confidence >= 0.4

  return {
    isCard,
    confidence: Math.min(confidence, 1.0),
    reasons
  }
}

/**
 * Extract structured data from eBay title
 */
function extractCardData(title) {
  const data = {
    year: null,
    playerName: null,
    brand: null,
    series: null,
    cardNumber: null,
    isRookie: false,
    isAutograph: false,
    isRelic: false,
    sport: null,
    team: null,
    grade: null,
    gradingCompany: null
  }

  const titleLower = title.toLowerCase()

  // Extract year (4-digit year between 1950-2030)
  const yearMatch = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/)
  if (yearMatch) {
    data.year = parseInt(yearMatch[1])
  }

  // Extract brand/manufacturer
  const brands = [
    'topps', 'panini', 'upper deck', 'bowman', 'donruss', 'fleer', 
    'score', 'leaf', 'prizm', 'optic', 'select', 'contenders', 'chronicles'
  ]
  for (const brand of brands) {
    if (titleLower.includes(brand)) {
      data.brand = brand
      break
    }
  }

  // Extract series/product
  const series = [
    'chrome', 'heritage', 'stadium club', 'fire', 'mosaic', 'immaculate',
    'national treasures', 'flawless', 'noir', 'the cup', 'genesis'
  ]
  for (const ser of series) {
    if (titleLower.includes(ser)) {
      data.series = ser
      break
    }
  }

  // Extract card number
  const numberPatterns = [
    /#(\d+)/,           // #123
    /card\s+(\d+)/i,    // Card 123
    /no\.?\s*(\d+)/i,   // No. 123
    /\b(\d+)\/\d+\b/    // 123/500 (numbered cards)
  ]
  
  for (const pattern of numberPatterns) {
    const match = title.match(pattern)
    if (match) {
      data.cardNumber = match[1]
      break
    }
  }

  // Extract player name (this is the tricky part)
  data.playerName = extractPlayerName(title, data.year, data.brand)

  // Detect card types
  data.isRookie = /\b(rookie|rc)\b/i.test(title)
  data.isAutograph = /\b(auto|autograph|signed)\b/i.test(title)
  data.isRelic = /\b(relic|patch|jersey|game.?used)\b/i.test(title)

  // Extract sport
  const sportMap = {
    'baseball': ['baseball', 'mlb'],
    'basketball': ['basketball', 'nba'],
    'football': ['football', 'nfl'],
    'hockey': ['hockey', 'nhl'],
    'soccer': ['soccer', 'mls']
  }

  for (const [sport, keywords] of Object.entries(sportMap)) {
    if (keywords.some(keyword => titleLower.includes(keyword))) {
      data.sport = sport
      break
    }
  }

  // Extract grading info
  const gradingMatch = title.match(/\b(psa|bgs|sgc)\s+(\d+(?:\.\d+)?)/i)
  if (gradingMatch) {
    data.gradingCompany = gradingMatch[1].toUpperCase()
    data.grade = parseFloat(gradingMatch[2])
  }

  return data
}

/**
 * Intelligent player name extraction
 */
function extractPlayerName(title, year, brand) {
  // Common patterns for player names in card titles
  const patterns = [
    // "2024 Topps Mike Trout Baseball Card"
    new RegExp(`${year}\\s+${brand}\\s+([A-Z][a-z]+\\s+[A-Z][a-z]+)`, 'i'),
    
    // "Mike Trout 2024 Topps"
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)\s+\d{4}/i,
    
    // "2024 Panini Prizm LeBron James"
    /\d{4}\s+\w+\s+\w+\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    
    // General pattern: Look for two capitalized words
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      const name = match[1].trim()
      
      // Filter out common false positives
      const excludeWords = [
        'upper deck', 'trading card', 'rookie card', 'base card',
        'insert card', 'chrome refractor', 'gold parallel', 'silver prizm',
        'red refractor', 'blue parallel', 'green wave', 'black gold'
      ]
      
      if (!excludeWords.some(exclude => name.toLowerCase().includes(exclude.toLowerCase()))) {
        return name
      }
    }
  }

  return null
}

/**
 * Find matching cards in database using fuzzy matching
 */
async function findMatchingCards(extractedData, ebayPrice) {
  const result = {
    bestMatch: null,
    confidence: 0,
    alternativeMatches: []
  }

  try {
    // Build search query
    const searchConditions = []

    // Year matching (exact or close)
    if (extractedData.year) {
      searchConditions.push({
        OR: [
          { 
            series: {
              set: {
                year: extractedData.year
              }
            }
          },
          {
            series: {
              set: {
                year: {
                  gte: extractedData.year - 1,
                  lte: extractedData.year + 1
                }
              }
            }
          }
        ]
      })
    }

    // Only search if we have meaningful criteria
    if (searchConditions.length === 0 && !extractedData.playerName) {
      return result
    }

    // Search for cards
    const cards = await prisma.card.findMany({
      where: searchConditions.length > 0 ? {
        AND: searchConditions
      } : {},
      include: {
        card_player_team: {
          include: {
            player_team: {
              include: {
                player: true,
                team: true
              }
            }
          }
        },
        series: {
          include: {
            set: true,
            color: true
          }
        },
        color: true
      },
      take: 50 // Limit for performance
    })

    // Score each card for similarity
    const scoredCards = cards.map(card => {
      const score = calculateCardMatchScore(card, extractedData, ebayPrice)
      return { card, score }
    }).filter(item => item.score > 0.3) // Only consider decent matches
    .sort((a, b) => b.score - a.score)

    if (scoredCards.length > 0) {
      result.bestMatch = scoredCards[0].card
      result.confidence = scoredCards[0].score
      result.alternativeMatches = scoredCards.slice(1, 4).map(item => ({
        card: item.card,
        confidence: item.score
      }))
    }

  } catch (error) {
    console.error('Error finding matching cards:', error)
  }

  return result
}

/**
 * Calculate similarity score between extracted data and database card
 */
function calculateCardMatchScore(card, extractedData, ebayPrice) {
  let score = 0
  let maxScore = 0

  // Player name matching (most important - 40% weight)
  maxScore += 0.4
  if (extractedData.playerName && card.card_player_team?.length > 0) {
    const dbPlayerName = `${card.card_player_team[0].player_team.player.first_name} ${card.card_player_team[0].player_team.player.last_name}`
    const similarity = calculateStringSimilarity(extractedData.playerName.toLowerCase(), dbPlayerName.toLowerCase())
    score += similarity * 0.4
  }

  // Year matching (30% weight)
  maxScore += 0.3
  if (extractedData.year && card.series?.set?.year) {
    const yearDiff = Math.abs(extractedData.year - card.series.set.year)
    if (yearDiff === 0) {
      score += 0.3
    } else if (yearDiff === 1) {
      score += 0.15
    }
  }

  // Card number matching (15% weight)
  maxScore += 0.15
  if (extractedData.cardNumber && card.card_number) {
    if (extractedData.cardNumber === card.card_number) {
      score += 0.15
    }
  }

  // Brand/series matching (10% weight)
  maxScore += 0.1
  if (extractedData.brand && card.series?.set?.name) {
    const setBrand = card.series.set.name.toLowerCase()
    if (setBrand.includes(extractedData.brand.toLowerCase())) {
      score += 0.1
    }
  }

  // Rookie status matching (5% weight)
  maxScore += 0.05
  if (extractedData.isRookie === card.is_rookie) {
    score += 0.05
  }

  // Normalize score
  return maxScore > 0 ? score / maxScore : 0
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1, str2) {
  if (str1 === str2) return 1.0
  
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

module.exports = {
  detectAndMatchCard,
  detectSportsCard,
  extractCardData,
  findMatchingCards,
  calculateCardMatchScore
}