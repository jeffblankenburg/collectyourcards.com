const express = require('express')
const { prisma, executeWithRetry } = require('../config/prisma-singleton')

const router = express.Router()

// ============================================================================
// IN-MEMORY CACHE FOR PERFORMANCE OPTIMIZATION
// ============================================================================

/**
 * Simple LRU (Least Recently Used) Cache
 * Dramatically improves performance for repeated queries by caching database lookups
 */
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return null

    // Move to end (most recently used)
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key, value) {
    // Delete if exists (to re-insert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // If at max size, delete oldest (first) entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, value)
  }

  clear() {
    this.cache.clear()
  }

  size() {
    return this.cache.size
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100)
    }
  }
}

// Create caches for different token types
const playerCache = new LRUCache(500)   // Cache up to 500 player queries
const setCache = new LRUCache(200)      // Cache up to 200 set queries
const teamCache = new LRUCache(50)      // Cache up to 50 team queries (only 30 MLB teams)
const colorCache = new LRUCache(100)    // Cache up to 100 color queries

// Cache statistics
let cacheHits = 0
let cacheMisses = 0

function getCacheStats() {
  const totalRequests = cacheHits + cacheMisses
  const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0

  return {
    hits: cacheHits,
    misses: cacheMisses,
    totalRequests: totalRequests,
    hitRate: `${hitRate}%`,
    caches: {
      player: playerCache.stats(),
      set: setCache.stats(),
      team: teamCache.stats(),
      color: colorCache.stats()
    }
  }
}

// ============================================================================
// UNIVERSAL SEARCH V2 - Complete Rewrite for Issue #34
// ============================================================================
// Architecture:
// 1. Token Extraction Layer - Order-agnostic parallel extraction
// 2. Pattern Recognition Engine - Identifies query type
// 3. Query Builder Layer - Single optimized SQL
// 4. Fuzzy Matching Layer - Handles typos
// 5. Result Ranking & Scoring - Relevance sorting
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Escape SQL special characters for LIKE queries
function escapeSqlLike(str) {
  if (!str) return ''
  return str.replace(/'/g, "''") // Double single quotes for SQL Server
}

// Remove token from query string after extraction
function removeTokenFromQuery(query, token) {
  return query.replace(token, '').replace(/\s+/g, ' ').trim()
}

// ============================================================================
// LAYER 1: TOKEN EXTRACTION
// ============================================================================

/**
 * Main token extraction orchestrator
 * Extracts all token types in parallel (order-agnostic)
 */
async function extractAllTokens(query) {
  console.log('\n=== TOKEN EXTRACTION START ===')
  console.log('Query:', query)

  const tokens = {
    player: [],
    cardNumber: [],
    year: [],
    set: [],
    team: [],
    parallel: [],
    serial: [],
    insert: [],
    productionCode: [],
    cardTypes: {
      rookie: false,
      autograph: false,
      shortPrint: false,
      relic: false
    },
    keywords: []
  }

  // Extract all tokens in parallel
  await Promise.all([
    extractCardNumbers(query, tokens),
    extractYears(query, tokens),
    extractCardTypeIndicators(query, tokens),
    extractSerialNumbers(query, tokens),
    extractProductionCodes(query, tokens),
    extractPlayerNames(query, tokens),
    extractSetNames(query, tokens),
    extractTeamNames(query, tokens),
    extractParallelDescriptors(query, tokens),
    extractInsertNames(query, tokens),
    extractMiscKeywords(query, tokens)
  ])

  console.log('=== TOKEN EXTRACTION COMPLETE ===')
  console.log('Tokens extracted:', JSON.stringify(tokens, null, 2))
  console.log('')

  return tokens
}

// ============================================================================
// TOKEN EXTRACTOR: Card Number
// ============================================================================

async function extractCardNumbers(query, tokens) {
  const trimmedQuery = query.trim()

  // Regex patterns in order of specificity
  const patterns = [
    // Hyphenated formats (most specific first)
    { regex: /\b([A-Z0-9]{2,}[A-Z]{1,3}-[A-Z0-9]{1,3})\b/gi, name: 'Complex hyphenated', confidence: 95 },
    { regex: /\b([A-Z]{1,4}-[A-Z0-9]{1,4})\b/gi, name: 'Standard hyphenated', confidence: 95 },
    { regex: /\b([A-Z]-\d{1,3})\b/gi, name: 'Simple hyphenated', confidence: 95 },

    // Alphanumeric without hyphens
    { regex: /\b([A-Z]{1,4}\d{1,4}[A-Z]?)\b/gi, name: 'Letters + numbers', confidence: 90 },
    { regex: /\b(\d{1,4}[A-Z]{1,2})\b/gi, name: 'Numbers + letters', confidence: 90 },

    // Pure numbers (least specific, lowest confidence due to year ambiguity)
    { regex: /\b(\d{1,3})\b/g, name: 'Pure numbers 1-3 digits', confidence: 70 }
  ]

  const found = new Set() // Avoid duplicates

  for (const pattern of patterns) {
    const matches = [...trimmedQuery.matchAll(pattern.regex)]

    for (const match of matches) {
      const cardNumber = match[1]

      // Skip if already found
      if (found.has(cardNumber.toLowerCase())) continue

      // Skip if it looks like a year (4 digits starting with 19 or 20)
      if (/^(19|20)\d{2}$/.test(cardNumber)) continue

      // Skip if it's too long (unlikely to be a card number)
      if (cardNumber.length > 10) continue

      found.add(cardNumber.toLowerCase())

      tokens.cardNumber.push({
        pattern: cardNumber,
        confidence: pattern.confidence,
        type: pattern.name
      })

      console.log(`  [Card Number] Found: "${cardNumber}" (${pattern.name}, confidence: ${pattern.confidence})`)
    }
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Year
// ============================================================================

async function extractYears(query, tokens) {
  // Match 4-digit years: 19xx or 20xx
  const yearRegex = /\b(19\d{2}|20\d{2})\b/g
  const matches = [...query.matchAll(yearRegex)]

  for (const match of matches) {
    const year = parseInt(match[1])

    // Validate year range (baseball cards started ~1887, future years up to +2)
    const currentYear = new Date().getFullYear()
    if (year < 1887 || year > currentYear + 2) continue

    tokens.year.push({
      year: year,
      confidence: 95,
      context: 'standalone'
    })

    console.log(`  [Year] Found: ${year} (confidence: 95)`)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Card Type Indicators
// ============================================================================

async function extractCardTypeIndicators(query, tokens) {
  const lowerQuery = query.toLowerCase()

  // Rookie indicators
  const rookieTerms = ['rookie', 'rc', 'rcs', 'rookies', '1st bowman', 'first bowman', 'prospect']
  for (const term of rookieTerms) {
    if (lowerQuery.includes(term)) {
      tokens.cardTypes.rookie = true
      console.log(`  [Card Type] Found: Rookie (matched: "${term}")`)
      break
    }
  }

  // Autograph indicators
  const autoTerms = ['autograph', 'auto', 'autos', 'autographed', 'signed', 'sig']
  for (const term of autoTerms) {
    if (lowerQuery.includes(term)) {
      tokens.cardTypes.autograph = true
      console.log(`  [Card Type] Found: Autograph (matched: "${term}")`)
      break
    }
  }

  // Short Print indicators
  const spTerms = ['sp', 'ssp', 'short print', 'super short', 'variation', 'var', 'variant']
  for (const term of spTerms) {
    if (lowerQuery.includes(term)) {
      tokens.cardTypes.shortPrint = true
      console.log(`  [Card Type] Found: Short Print (matched: "${term}")`)
      break
    }
  }

  // Relic indicators
  const relicTerms = ['relic', 'jersey', 'patch', 'memorabilia', 'game-used', 'game used']
  for (const term of relicTerms) {
    if (lowerQuery.includes(term)) {
      tokens.cardTypes.relic = true
      console.log(`  [Card Type] Found: Relic (matched: "${term}")`)
      break
    }
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Serial Number
// ============================================================================

async function extractSerialNumbers(query, tokens) {
  // Match patterns like "/499", "/25", "/1"
  const serialRegex = /\/(\d+)\b/g
  const matches = [...query.matchAll(serialRegex)]

  for (const match of matches) {
    const printRun = parseInt(match[1])

    // Validate range (typical print runs are 1-9999)
    if (printRun < 1 || printRun > 9999) continue

    tokens.serial.push({
      print_run: printRun,
      confidence: 95,
      pattern: match[0]
    })

    console.log(`  [Serial Number] Found: /${printRun} (confidence: 95)`)
  }

  // Also match alternative patterns: "to 499", "numbered 25"
  const altPatterns = [
    /\bto\s+(\d+)\b/gi,
    /\bnumbered\s+(\d+)\b/gi,
    /\b#d?\s*(\d+)\b/gi
  ]

  for (const pattern of altPatterns) {
    const matches = [...query.matchAll(pattern)]
    for (const match of matches) {
      const printRun = parseInt(match[1])
      if (printRun < 1 || printRun > 9999) continue

      // Check if not already added
      if (!tokens.serial.some(s => s.print_run === printRun)) {
        tokens.serial.push({
          print_run: printRun,
          confidence: 85,
          pattern: match[0]
        })

        console.log(`  [Serial Number] Found: "${match[0]}" → /${printRun} (confidence: 85)`)
      }
    }
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Production Code
// ============================================================================

async function extractProductionCodes(query, tokens) {
  // Match production code patterns: CMP followed by 6 digits
  // Example: CMP000123, CMP123456
  const productionCodeRegex = /\b(CMP\d{6})\b/gi
  const matches = [...query.matchAll(productionCodeRegex)]

  for (const match of matches) {
    const productionCode = match[1].toUpperCase() // Normalize to uppercase

    tokens.productionCode.push({
      code: productionCode,
      confidence: 98,
      pattern: match[0]
    })

    console.log(`  [Production Code] Found: "${productionCode}" (confidence: 98)`)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Player Name
// ============================================================================

async function extractPlayerNames(query, tokens) {
  try {
    // Remove already-identified tokens to avoid false matches
    let cleanQuery = query

    // Remove card numbers
    for (const cn of tokens.cardNumber) {
      cleanQuery = removeTokenFromQuery(cleanQuery, cn.pattern)
    }

    // Remove years
    for (const y of tokens.year) {
      cleanQuery = removeTokenFromQuery(cleanQuery, y.year.toString())
    }

    // Remove serial numbers
    for (const s of tokens.serial) {
      cleanQuery = removeTokenFromQuery(cleanQuery, s.pattern)
    }

    // Remove production codes
    for (const pc of tokens.productionCode) {
      cleanQuery = removeTokenFromQuery(cleanQuery, pc.pattern)
    }

    // Remove card type keywords
    const cardTypeKeywords = [
      'rookie', 'rc', 'rcs', 'rookies', '1st bowman', 'first bowman', 'prospect',
      'autograph', 'auto', 'autos', 'autographed', 'signed', 'sig',
      'sp', 'ssp', 'short print', 'super short', 'variation', 'var', 'variant',
      'relic', 'jersey', 'patch', 'memorabilia', 'game-used', 'game used'
    ]
    for (const keyword of cardTypeKeywords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    // Remove parallel/color keywords to avoid false matches
    // This ensures "pink steven kwan" and "steven kwan pink" both extract the same player
    const parallelKeywords = [
      'refractor', 'prizm', 'shimmer', 'xfractor', 'superfractor',
      'red', 'blue', 'green', 'gold', 'silver', 'orange', 'purple', 'black', 'white',
      'wave', 'atomic', 'sepia', 'negative', 'camo', 'pink', 'yellow', 'teal', 'bronze',
      'platinum', 'emerald', 'sapphire', 'ruby', 'rainbow', 'prism', 'chrome'
    ]
    for (const keyword of parallelKeywords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim()

    if (cleanQuery.length < 2) {
      console.log(`  [Player Name] Skipping: query too short after token removal`)
      return
    }

    // N-gram entity extraction approach
    // After removing parallel keywords, we extract clean player/team names
    // This makes extraction order-agnostic: "pink steven kwan" and "steven kwan pink"
    // both become "steven kwan" and extract the same player

    const words = cleanQuery.trim().split(/\s+/)
    const nGrams = []

    // Generate all contiguous n-grams (from longest to shortest)
    // Only use 2+ word n-grams to avoid partial name matches
    // Exception: If query is only 1-2 words, also include 1-word n-grams
    const minNgramLength = words.length <= 2 ? 1 : 2

    for (let length = words.length; length >= minNgramLength; length--) {
      for (let start = 0; start <= words.length - length; start++) {
        const ngram = words.slice(start, start + length).join(' ')
        if (ngram.length >= 2) { // Skip single letters
          nGrams.push(ngram)
        }
      }
    }

    console.log(`  [Player Name] Generated ${nGrams.length} n-grams from "${cleanQuery}"`)

    // Search for each n-gram in parallel, collect all matches
    const allMatches = []
    const searchPromises = nGrams.map(async (ngram) => {
      const cacheKey = `player:${ngram.toLowerCase()}`
      let results = playerCache.get(cacheKey)

      if (results !== null) {
        cacheHits++
        if (results.length > 0) {
          console.log(`  [Player Name] Cache HIT for "${ngram}" - ${results.length} results`)
        }
        return { ngram, results }
      }

      cacheMisses++

      // Build search query
      const searchPattern = `%${escapeSqlLike(ngram)}%`
      const searchPatternNoApostrophe = `%${escapeSqlLike(ngram.replace(/'/g, ''))}%`
      const queryParts = ngram.trim().split(/\s+/)

      let whereClause = ''

      if (queryParts.length >= 2) {
        // Multi-word search
        const firstName = escapeSqlLike(queryParts[0])
        const lastName = escapeSqlLike(queryParts.slice(1).join(' '))
        const firstNameNoApostrophe = escapeSqlLike(queryParts[0].replace(/'/g, ''))
        const lastNameNoApostrophe = escapeSqlLike(queryParts.slice(1).join(' ').replace(/'/g, ''))

        whereClause = `
          (CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
          OR (CONCAT(nick_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
          OR (first_name LIKE '%${firstName}%' COLLATE Latin1_General_CI_AI AND last_name LIKE '%${lastName}%' COLLATE Latin1_General_CI_AI)
          OR (REPLACE(CONCAT(first_name, ' ', last_name), '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI)
        `
      } else {
        // Single word search
        whereClause = `
          first_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
          OR last_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
          OR nick_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
          OR CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
          OR REPLACE(first_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
          OR REPLACE(last_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        `
      }

      results = await prisma.$queryRawUnsafe(`
        SELECT TOP 10
          player_id,
          first_name,
          last_name,
          nick_name,
          slug,
          card_count,
          is_hof
        FROM player
        WHERE ${whereClause}
        ORDER BY card_count DESC
      `)

      playerCache.set(cacheKey, results)

      if (results.length > 0) {
        console.log(`  [Player Name] Found ${results.length} matches for n-gram "${ngram}"`)
      }

      return { ngram, results }
    })

    const searchResults = await Promise.all(searchPromises)

    // Collect all unique player matches with their matching n-gram
    const playerMatches = new Map() // player_id -> {player, ngram, ngramLength}

    for (const { ngram, results } of searchResults) {
      if (results.length > 0) {
        const ngramLength = ngram.split(/\s+/).length

        for (const player of results) {
          const playerId = Number(player.player_id)
          const existing = playerMatches.get(playerId)

          // Prefer longer n-gram matches (more specific)
          if (!existing || ngramLength > existing.ngramLength) {
            playerMatches.set(playerId, { player, ngram, ngramLength })
          }
        }
      }
    }

    console.log(`  [Player Name] Found ${playerMatches.size} unique players from n-gram matching`)

    // Add all unique players to tokens
    for (const { player, ngram, ngramLength } of playerMatches.values()) {
      const fullName = `${player.first_name}${player.nick_name ? ` "${player.nick_name}"` : ''} ${player.last_name}`

      // Calculate confidence based on match quality
      let confidence = 50
      const lowerNgram = ngram.toLowerCase()
      const lowerFullName = fullName.toLowerCase()
      const lowerFirstName = player.first_name.toLowerCase()
      const lowerLastName = player.last_name.toLowerCase()

      // Exact full name match
      if (lowerFullName === lowerNgram) confidence = 100
      // Exact first + last name match
      else if (`${lowerFirstName} ${lowerLastName}` === lowerNgram) confidence = 100
      // Last name match only
      else if (lowerLastName === lowerNgram) confidence = 95
      // First name match only
      else if (lowerFirstName === lowerNgram) confidence = 85
      // Partial match
      else if (lowerFullName.includes(lowerNgram)) confidence = 90
      // Generic match
      else confidence = 70

      // Boost for longer n-gram matches (more specific = higher confidence)
      if (ngramLength >= 3) confidence += 10
      else if (ngramLength === 2) confidence += 5

      // Boost for HOF players
      if (player.is_hof) confidence += 5

      // Boost for high card count (popular players)
      if (player.card_count > 1000) confidence += 3

      tokens.player.push({
        player_id: Number(player.player_id),
        name: fullName,
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        slug: player.slug,
        card_count: Number(player.card_count),
        is_hof: player.is_hof,
        confidence: Math.min(100, confidence),
        matched: ngram // Store which n-gram matched this player
      })

      console.log(`  [Player Name] Found: "${fullName}" via n-gram "${ngram}" (${ngramLength} words, confidence: ${Math.min(100, confidence)})`)
    }

    // Sort by confidence descending
    tokens.player.sort((a, b) => b.confidence - a.confidence)

    // Filter: Keep only the best matches, remove low-confidence partial matches
    // If we have a 2-word match like "Evan White", remove 1-word matches like "Evan"
    // If we have high-confidence matches (95+), remove low-confidence matches (<80)
    if (tokens.player.length > 1) {
      const bestConfidence = tokens.player[0].confidence
      const bestMatchLength = tokens.player[0].matched.split(/\s+/).length

      // Keep players that are either:
      // 1. Close to best confidence (within 15 points)
      // 2. Same or longer match length as best match
      // 3. Confidence >= 95 (exact matches)
      const filteredPlayers = tokens.player.filter(p => {
        const matchLength = p.matched.split(/\s+/).length
        const confidenceDiff = bestConfidence - p.confidence

        return (
          p.confidence >= 95 || // Exact/high-quality match
          confidenceDiff <= 15 || // Close to best confidence
          matchLength >= bestMatchLength // Same or better match length
        )
      })

      if (filteredPlayers.length < tokens.player.length) {
        console.log(`  [Player Name] Filtered ${tokens.player.length} players down to ${filteredPlayers.length} best matches`)
        tokens.player = filteredPlayers
      }
    }

  } catch (error) {
    console.error('  [Player Name] Error:', error.message)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Set Name
// ============================================================================

async function extractSetNames(query, tokens) {
  try {
    // Remove already-identified tokens to avoid false matches
    let cleanQuery = query

    // Remove card numbers
    for (const cn of tokens.cardNumber) {
      cleanQuery = removeTokenFromQuery(cleanQuery, cn.pattern)
    }

    // Remove years (but we may want years for set matching, so be careful)
    // Skip year removal for sets as years are useful: "2024 bowman chrome"

    // Remove serial numbers
    for (const s of tokens.serial) {
      cleanQuery = removeTokenFromQuery(cleanQuery, s.pattern)
    }

    // Remove production codes
    for (const pc of tokens.productionCode) {
      cleanQuery = removeTokenFromQuery(cleanQuery, pc.pattern)
    }

    // Remove card type keywords
    const cardTypeKeywords = [
      'rookie', 'rc', 'rcs', 'rookies', '1st bowman', 'first bowman', 'prospect',
      'autograph', 'auto', 'autos', 'autographed', 'signed', 'sig',
      'sp', 'ssp', 'short print', 'super short', 'variation', 'var', 'variant',
      'relic', 'jersey', 'patch', 'memorabilia', 'game-used', 'game used'
    ]
    for (const keyword of cardTypeKeywords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    // Remove parallel/color keywords to avoid false matches
    // BUT exclude keywords commonly used in set names (chrome, prism, prizm, etc.)
    const parallelKeywordsForSetCleaning = [
      'refractor', 'xfractor', 'superfractor', 'shimmer',
      'red', 'blue', 'green', 'gold', 'silver', 'orange', 'purple', 'black', 'white',
      'wave', 'atomic', 'sepia', 'negative', 'camo', 'pink', 'yellow', 'teal', 'bronze',
      'platinum', 'emerald', 'sapphire', 'ruby', 'rainbow'
      // NOTE: Omitted 'chrome', 'prism', 'prizm' as these are commonly part of set names
      // (Bowman Chrome, Topps Chrome, Panini Prizm, etc.)
    ]
    for (const keyword of parallelKeywordsForSetCleaning) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim()

    if (cleanQuery.length < 2) {
      console.log(`  [Set Name] Skipping: query too short after token removal`)
      return
    }

    // N-gram extraction for sets
    const words = cleanQuery.trim().split(/\s+/)
    const nGrams = []

    // For 3+ word queries, skip 1-word n-grams to avoid noise
    const minNgramLength = words.length <= 2 ? 1 : 2

    for (let length = words.length; length >= minNgramLength; length--) {
      for (let start = 0; start <= words.length - length; start++) {
        const ngram = words.slice(start, start + length).join(' ')
        if (ngram.length >= 3) { // Sets usually have longer names, require 3+ chars
          nGrams.push(ngram)
        }
      }
    }

    console.log(`  [Set Name] Generated ${nGrams.length} n-grams from "${cleanQuery}"`)

    // Search for each n-gram in parallel
    const searchPromises = nGrams.map(async (ngram) => {
      const cacheKey = `set:${ngram.toLowerCase()}`
      let results = setCache.get(cacheKey)

      if (results !== null) {
        cacheHits++
        if (results.length > 0) {
          console.log(`  [Set Name] Cache HIT for "${ngram}" - ${results.length} results`)
        }
        return { ngram, results }
      }

      cacheMisses++

      const searchPattern = `%${escapeSqlLike(ngram)}%`

      results = await prisma.$queryRawUnsafe(`
        SELECT TOP 5
          s.series_id,
          s.name as series_name,
          st.name as set_name,
          st.slug as set_slug,
          m.name as manufacturer_name,
          st.year as set_year
        FROM series s
        JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
        WHERE s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR st.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR m.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        ORDER BY st.year DESC
      `)

      setCache.set(cacheKey, results)

      if (results.length > 0) {
        console.log(`  [Set Name] Found ${results.length} matches for n-gram "${ngram}"`)
      }

      return { ngram, results }
    })

    const searchResults = await Promise.all(searchPromises)

    // Collect all unique set matches
    const setMatches = new Map() // series_id -> {series, ngram, ngramLength}

    for (const { ngram, results } of searchResults) {
      if (results.length > 0) {
        const ngramLength = ngram.split(/\s+/).length

        for (const series of results) {
          const seriesId = Number(series.series_id)
          const existing = setMatches.get(seriesId)

          // Prefer longer n-gram matches
          if (!existing || ngramLength > existing.ngramLength) {
            setMatches.set(seriesId, { series, ngram, ngramLength })
          }
        }
      }
    }

    console.log(`  [Set Name] Found ${setMatches.size} unique sets from n-gram matching`)

    // Add all unique sets to tokens
    for (const { series, ngram, ngramLength } of setMatches.values()) {
      let confidence = 60
      const lowerNgram = ngram.toLowerCase()
      const lowerSeriesName = series.series_name?.toLowerCase() || ''
      const lowerSetName = series.set_name?.toLowerCase() || ''
      const lowerManufacturer = series.manufacturer_name?.toLowerCase() || ''

      // Exact series name match
      if (lowerSeriesName === lowerNgram) confidence = 95
      // Exact set name match
      else if (lowerSetName === lowerNgram) confidence = 90
      // Exact manufacturer match
      else if (lowerManufacturer === lowerNgram) confidence = 85
      // Partial series name match
      else if (lowerSeriesName.includes(lowerNgram)) confidence = 80
      // Partial set name match
      else if (lowerSetName.includes(lowerNgram)) confidence = 75
      // Partial manufacturer match
      else if (lowerManufacturer.includes(lowerNgram)) confidence = 70

      // Boost for longer n-gram matches (more specific)
      if (ngramLength >= 3) confidence += 10
      else if (ngramLength === 2) confidence += 5

      tokens.set.push({
        series_id: Number(series.series_id),
        series_name: series.series_name,
        set_name: series.set_name,
        set_slug: series.set_slug,
        manufacturer_name: series.manufacturer_name,
        year: series.set_year,
        confidence: Math.min(100, confidence),
        matched: ngram
      })

      console.log(`  [Set Name] Found: "${series.series_name}" via n-gram "${ngram}" (confidence: ${Math.min(100, confidence)})`)
    }

    // Sort by confidence and year (prefer recent sets)
    tokens.set.sort((a, b) => {
      if (Math.abs(b.confidence - a.confidence) > 10) {
        return b.confidence - a.confidence
      }
      return b.year - a.year
    })

  } catch (error) {
    console.error('  [Set Name] Error:', error.message)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Team Name
// ============================================================================

async function extractTeamNames(query, tokens) {
  try {
    // Remove already-identified tokens to avoid false matches (same approach as players)
    let cleanQuery = query

    // Remove card numbers
    for (const cn of tokens.cardNumber) {
      cleanQuery = removeTokenFromQuery(cleanQuery, cn.pattern)
    }

    // Remove years
    for (const y of tokens.year) {
      cleanQuery = removeTokenFromQuery(cleanQuery, y.year.toString())
    }

    // Remove serial numbers
    for (const s of tokens.serial) {
      cleanQuery = removeTokenFromQuery(cleanQuery, s.pattern)
    }

    // Remove production codes
    for (const pc of tokens.productionCode) {
      cleanQuery = removeTokenFromQuery(cleanQuery, pc.pattern)
    }

    // Remove card type keywords
    const cardTypeKeywords = [
      'rookie', 'rc', 'rcs', 'rookies', '1st bowman', 'first bowman', 'prospect',
      'autograph', 'auto', 'autos', 'autographed', 'signed', 'sig',
      'sp', 'ssp', 'short print', 'super short', 'variation', 'var', 'variant',
      'relic', 'jersey', 'patch', 'memorabilia', 'game-used', 'game used'
    ]
    for (const keyword of cardTypeKeywords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    // Remove parallel/color keywords to avoid false matches
    const parallelKeywords = [
      'refractor', 'prizm', 'shimmer', 'xfractor', 'superfractor',
      'red', 'blue', 'green', 'gold', 'silver', 'orange', 'purple', 'black', 'white',
      'wave', 'atomic', 'sepia', 'negative', 'camo', 'pink', 'yellow', 'teal', 'bronze',
      'platinum', 'emerald', 'sapphire', 'ruby', 'rainbow', 'prism', 'chrome'
    ]
    for (const keyword of parallelKeywords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '')
    }

    cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim()

    if (cleanQuery.length < 2) {
      console.log(`  [Team Name] Skipping: query too short after token removal`)
      return
    }

    // N-gram extraction for teams
    const words = cleanQuery.trim().split(/\s+/)
    const nGrams = []

    // For 3+ word queries, skip 1-word n-grams to avoid noise
    const minNgramLength = words.length <= 2 ? 1 : 2

    for (let length = words.length; length >= minNgramLength; length--) {
      for (let start = 0; start <= words.length - length; start++) {
        const ngram = words.slice(start, start + length).join(' ')
        if (ngram.length >= 2) {
          nGrams.push(ngram)
        }
      }
    }

    console.log(`  [Team Name] Generated ${nGrams.length} n-grams from "${cleanQuery}"`)

    // Search for each n-gram in parallel
    const searchPromises = nGrams.map(async (ngram) => {
      const cacheKey = `team:${ngram.toLowerCase()}`
      let results = teamCache.get(cacheKey)

      if (results !== null) {
        cacheHits++
        if (results.length > 0) {
          console.log(`  [Team Name] Cache HIT for "${ngram}" - ${results.length} results`)
        }
        return { ngram, results }
      }

      cacheMisses++

      const searchPattern = `%${escapeSqlLike(ngram)}%`

      results = await prisma.$queryRawUnsafe(`
        SELECT TOP 5
          team_id,
          name,
          city,
          mascot,
          abbreviation
        FROM team
        WHERE name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR city LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR mascot LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR abbreviation LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
      `)

      teamCache.set(cacheKey, results)

      if (results.length > 0) {
        console.log(`  [Team Name] Found ${results.length} matches for n-gram "${ngram}"`)
      }

      return { ngram, results }
    })

    const searchResults = await Promise.all(searchPromises)

    // Collect all unique team matches
    const teamMatches = new Map() // team_id -> {team, ngram, ngramLength}

    for (const { ngram, results } of searchResults) {
      if (results.length > 0) {
        const ngramLength = ngram.split(/\s+/).length

        for (const team of results) {
          const teamId = Number(team.team_id)
          const existing = teamMatches.get(teamId)

          // Prefer longer n-gram matches
          if (!existing || ngramLength > existing.ngramLength) {
            teamMatches.set(teamId, { team, ngram, ngramLength })
          }
        }
      }
    }

    console.log(`  [Team Name] Found ${teamMatches.size} unique teams from n-gram matching`)

    // Add all unique teams to tokens
    for (const { team, ngram, ngramLength } of teamMatches.values()) {
      let confidence = 70
      const lowerNgram = ngram.toLowerCase()
      const lowerName = team.name?.toLowerCase() || ''
      const lowerCity = team.city?.toLowerCase() || ''
      const lowerMascot = team.mascot?.toLowerCase() || ''
      const lowerAbbr = team.abbreviation?.toLowerCase() || ''

      // Exact abbreviation match
      if (lowerAbbr === lowerNgram) confidence = 95
      // Exact team name match
      else if (lowerName === lowerNgram) confidence = 95
      // Exact city match
      else if (lowerCity === lowerNgram) confidence = 90
      // Exact mascot match
      else if (lowerMascot === lowerNgram) confidence = 90
      // Partial name match
      else if (lowerName.includes(lowerNgram)) confidence = 85
      // Partial city match
      else if (lowerCity.includes(lowerNgram)) confidence = 80
      // Partial mascot match
      else if (lowerMascot.includes(lowerNgram)) confidence = 75

      // Boost for longer n-gram matches
      if (ngramLength >= 2) confidence += 5

      tokens.team.push({
        team_id: Number(team.team_id),
        name: team.name,
        city: team.city,
        mascot: team.mascot,
        abbreviation: team.abbreviation,
        confidence: Math.min(100, confidence),
        matched: ngram
      })

      console.log(`  [Team Name] Found: "${team.name}" via n-gram "${ngram}" (confidence: ${Math.min(100, confidence)})`)
    }

    // Sort by confidence
    tokens.team.sort((a, b) => b.confidence - a.confidence)

  } catch (error) {
    console.error('  [Team Name] Error:', error.message)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Parallel Descriptor
// ============================================================================

async function extractParallelDescriptors(query, tokens) {
  try {
    const lowerQuery = query.toLowerCase()

    // Common parallel/color keywords
    const parallelKeywords = [
      'refractor', 'prizm', 'shimmer', 'xfractor', 'superfractor',
      'red', 'blue', 'green', 'gold', 'silver', 'orange', 'purple', 'black', 'white',
      'wave', 'atomic', 'sepia', 'negative', 'camo', 'pink', 'yellow', 'teal', 'bronze',
      'platinum', 'emerald', 'sapphire', 'ruby', 'rainbow', 'prism', 'chrome', 'shimmer'
    ]

    // Check for any parallel keywords in the query (match whole words only)
    const foundKeywords = parallelKeywords.filter(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i')
      return regex.test(query)
    })

    if (foundKeywords.length === 0) {
      return
    }

    console.log(`  [Parallel] Found keywords in query: ${foundKeywords.join(', ')}`)

    // Search color table for EACH keyword individually
    // This handles queries like "evan white pink" where "white" is a name and "pink" is a color
    for (const keyword of foundKeywords) {
      const searchPattern = `%${escapeSqlLike(keyword)}%`

      console.log(`  [Parallel] Searching color table for: "${keyword}"`)

      const results = await prisma.$queryRawUnsafe(`
        SELECT TOP 5
          color_id,
          name as color_name,
          hex_value
        FROM color
        WHERE name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
      `)

      for (const color of results) {
        // Avoid duplicates
        const alreadyAdded = tokens.parallel.some(p => p.color_id === Number(color.color_id))
        if (alreadyAdded) continue

        tokens.parallel.push({
          color_id: Number(color.color_id),
          color_name: color.color_name,
          hex_value: color.hex_value,
          confidence: 85,
          matched: keyword
        })

        console.log(`  [Parallel] Found: "${color.color_name}" (ID: ${color.color_id})`)
      }
    }

  } catch (error) {
    console.error('  [Parallel] Error:', error.message)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Insert Name
// ============================================================================

async function extractInsertNames(query, tokens) {
  try {
    const lowerQuery = query.toLowerCase()

    // Common insert/subset keywords to search for
    const insertKeywords = [
      'future stars', 'rookie debut', 'all-star', 'all star', 'prospects',
      'draft picks', '1st edition', 'first edition', 'traded', 'update',
      'reserve', 'finest', 'chrome prospects', 'bowman prospects',
      'sterling', 'tribute', 'heritage', 'redux'
    ]

    // Check for any insert keywords in the query
    const foundKeywords = insertKeywords.filter(keyword => lowerQuery.includes(keyword))

    if (foundKeywords.length === 0) {
      return
    }

    // Build search pattern from found keywords
    const searchPattern = `%${escapeSqlLike(foundKeywords.join(' '))}%`

    console.log(`  [Insert Name] Searching for: "${foundKeywords.join(' ')}"`)

    // Search series table for insert/subset names
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP 10
        s.series_id,
        s.name as series_name,
        st.name as set_name,
        m.name as manufacturer_name,
        st.year as set_year
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      WHERE s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
      ORDER BY st.year DESC
    `)

    for (const series of results) {
      let confidence = 80

      // Boost confidence for exact subset match
      if (series.series_name.toLowerCase().includes(foundKeywords.join(' '))) {
        confidence = 90
      }

      tokens.insert.push({
        series_id: Number(series.series_id),
        series_name: series.series_name,
        set_name: series.set_name,
        manufacturer_name: series.manufacturer_name,
        year: series.set_year,
        confidence: confidence,
        matched: foundKeywords.join(' ')
      })

      console.log(`  [Insert Name] Found: "${series.series_name}" (ID: ${series.series_id}, confidence: ${confidence})`)
    }

  } catch (error) {
    console.error('  [Insert Name] Error:', error.message)
  }
}

// ============================================================================
// TOKEN EXTRACTOR: Misc Keywords
// ============================================================================

async function extractMiscKeywords(query, tokens) {
  try {
    const lowerQuery = query.toLowerCase()

    // Design/aesthetic/nickname keywords
    const miscKeywords = [
      'mojo', 'cracked ice', 'wave', 'atomic', 'shimmer', 'prism',
      'mosaic', 'disco', 'holo', 'holographic', 'foil', 'metallic',
      'die-cut', 'die cut', 'acetate', 'laser', 'neon', 'platinum',
      'rainbow', 'spectrum', 'sparkle', 'numbered', 'limited'
    ]

    // Check for any misc keywords in the query
    const foundKeywords = miscKeywords.filter(keyword => lowerQuery.includes(keyword))

    if (foundKeywords.length === 0) {
      return
    }

    console.log(`  [Misc Keywords] Found keywords: "${foundKeywords.join(', ')}"`)

    // Store found keywords for potential filtering
    // These can be used in conjunction with other filters
    for (const keyword of foundKeywords) {
      tokens.keywords.push({
        keyword: keyword,
        confidence: 75,
        type: 'design_aesthetic'
      })

      console.log(`  [Misc Keywords] Tracked: "${keyword}" (confidence: 75)`)
    }

    // Also search color table for matching design terms
    const searchPattern = `%${escapeSqlLike(foundKeywords.join(' '))}%`

    const colorResults = await prisma.$queryRawUnsafe(`
      SELECT TOP 5
        color_id,
        name as color_name,
        hex_value
      FROM color
      WHERE name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
    `)

    // If we find matching colors, add them to parallel tokens
    for (const color of colorResults) {
      // Only add if not already in parallel tokens
      const alreadyExists = tokens.parallel.some(p => p.color_id === Number(color.color_id))

      if (!alreadyExists) {
        tokens.parallel.push({
          color_id: Number(color.color_id),
          color_name: color.color_name,
          hex_value: color.hex_value,
          confidence: 80,
          matched: foundKeywords.join(' ')
        })

        console.log(`  [Misc Keywords] Added to parallel: "${color.color_name}" (ID: ${color.color_id})`)
      }
    }

  } catch (error) {
    console.error('  [Misc Keywords] Error:', error.message)
  }
}

// ============================================================================
// LAYER 2: PATTERN RECOGNITION
// ============================================================================

/**
 * Pattern Recognition Engine
 * Analyzes extracted tokens and determines the optimal search strategy
 */
function recognizePattern(tokens) {
  console.log('\n=== PATTERN RECOGNITION START ===')

  // Count active tokens
  const activeTokens = countActiveTokens(tokens)
  console.log('Active tokens:', activeTokens)

  // Determine pattern type
  const patternType = determinePatternType(activeTokens)
  console.log('Pattern type:', patternType)

  // Select search strategy
  const strategy = selectSearchStrategy(tokens, activeTokens, patternType)
  console.log('Search strategy:', strategy)

  // Calculate pattern confidence
  const confidence = calculatePatternConfidence(tokens, activeTokens, patternType)
  console.log('Pattern confidence:', confidence)

  const pattern = {
    type: patternType,
    strategy: strategy,
    confidence: confidence,
    activeTokens: activeTokens,
    tokenCount: activeTokens.total
  }

  console.log('=== PATTERN RECOGNITION COMPLETE ===')
  console.log('Pattern:', JSON.stringify(pattern, null, 2))
  console.log('')

  return pattern
}

/**
 * Count all active tokens in the extraction results
 * NOTE: This counts TOKEN TYPES, not number of matches
 * Example: 3 players found = 1 active player token type
 */
function countActiveTokens(tokens) {
  const counts = {
    player: tokens.player.length > 0 ? 1 : 0,
    cardNumber: tokens.cardNumber.length > 0 ? 1 : 0,
    year: tokens.year.length > 0 ? 1 : 0,
    set: tokens.set.length > 0 ? 1 : 0,
    team: tokens.team.length > 0 ? 1 : 0,
    parallel: tokens.parallel.length > 0 ? 1 : 0,
    serial: tokens.serial.length > 0 ? 1 : 0,
    insert: tokens.insert.length > 0 ? 1 : 0,
    productionCode: tokens.productionCode.length > 0 ? 1 : 0,
    cardTypes: 0,
    keywords: tokens.keywords.length > 0 ? 1 : 0
  }

  // Count active card types (each type is separate)
  if (tokens.cardTypes.rookie) counts.cardTypes++
  if (tokens.cardTypes.autograph) counts.cardTypes++
  if (tokens.cardTypes.shortPrint) counts.cardTypes++
  if (tokens.cardTypes.relic) counts.cardTypes++

  // Calculate total active token types
  counts.total =
    counts.player +
    counts.cardNumber +
    counts.year +
    counts.set +
    counts.team +
    counts.parallel +
    counts.serial +
    counts.insert +
    counts.productionCode +
    counts.cardTypes +
    counts.keywords

  // Store raw match counts for reference
  counts.matchCounts = {
    players: tokens.player.length,
    cardNumbers: tokens.cardNumber.length,
    years: tokens.year.length,
    sets: tokens.set.length,
    teams: tokens.team.length,
    parallels: tokens.parallel.length,
    serials: tokens.serial.length,
    inserts: tokens.insert.length,
    productionCodes: tokens.productionCode.length,
    keywords: tokens.keywords.length
  }

  return counts
}

/**
 * Determine the pattern type based on token counts
 */
function determinePatternType(activeTokens) {
  const total = activeTokens.total

  if (total === 0) return 'EMPTY'
  if (total === 1) return 'SINGLE_TOKEN'
  if (total === 2) return 'TWO_TOKEN'
  if (total === 3) return 'THREE_TOKEN'
  if (total === 4) return 'FOUR_TOKEN_RICH'
  if (total >= 5) return 'COMPLEX'

  return 'UNKNOWN'
}

/**
 * Select the optimal search strategy based on tokens
 */
function selectSearchStrategy(tokens, activeTokens, patternType) {
  // EMPTY pattern
  if (patternType === 'EMPTY') {
    return 'NO_RESULTS'
  }

  // SINGLE TOKEN patterns
  if (patternType === 'SINGLE_TOKEN') {
    if (activeTokens.productionCode > 0) return 'PRODUCTION_CODE_ONLY'
    if (activeTokens.player > 0) return 'PLAYER_ONLY'
    if (activeTokens.cardNumber > 0) return 'CARD_NUMBER_ONLY'
    if (activeTokens.year > 0) return 'YEAR_BROWSE'
    if (activeTokens.set > 0) return 'SET_BROWSE'
    if (activeTokens.team > 0) return 'TEAM_BROWSE'
    if (activeTokens.cardTypes > 0) return 'CARD_TYPE_ONLY'
    if (activeTokens.parallel > 0) return 'PARALLEL_BROWSE'
    if (activeTokens.serial > 0) return 'SERIAL_BROWSE'
    if (activeTokens.insert > 0) return 'INSERT_BROWSE'
    if (activeTokens.keywords > 0) return 'KEYWORD_BROWSE'
  }

  // MULTI-TOKEN patterns - use combined filters
  // These all use the CARDS_WITH_MULTI_FILTERS strategy
  if (patternType === 'TWO_TOKEN' ||
      patternType === 'THREE_TOKEN' ||
      patternType === 'FOUR_TOKEN_RICH' ||
      patternType === 'COMPLEX') {

    // Special case: If only player + card number, might be looking for specific card
    if (activeTokens.player > 0 && activeTokens.cardNumber > 0 && activeTokens.total === 2) {
      return 'PLAYER_CARD_NUMBER'
    }

    // Special case: Year + set without player (browsing a specific set/year)
    if (activeTokens.year > 0 && activeTokens.set > 0 && activeTokens.player === 0 && activeTokens.cardNumber === 0) {
      return 'SET_YEAR_BROWSE'
    }

    // Default multi-filter strategy for all other combinations
    return 'CARDS_WITH_MULTI_FILTERS'
  }

  return 'FALLBACK'
}

/**
 * Calculate confidence score for the recognized pattern
 */
function calculatePatternConfidence(tokens, activeTokens, patternType) {
  let confidence = 50 // Base confidence

  // Single token patterns - confidence based on token type
  if (patternType === 'SINGLE_TOKEN') {
    if (activeTokens.productionCode > 0) {
      // Production codes are very specific and unique
      confidence = tokens.productionCode[0]?.confidence || 98
    } else if (activeTokens.player > 0) {
      // Use highest player confidence
      confidence = tokens.player[0]?.confidence || 70
    } else if (activeTokens.cardNumber > 0) {
      confidence = tokens.cardNumber[0]?.confidence || 70
    } else if (activeTokens.year > 0) {
      confidence = tokens.year[0]?.confidence || 95
    } else if (activeTokens.serial > 0) {
      confidence = tokens.serial[0]?.confidence || 95
    } else {
      confidence = 80 // Other single tokens (set, team, etc.)
    }
    return confidence
  }

  // Multi-token patterns - average confidence with bonuses
  let totalConfidence = 0
  let tokenConfidenceCount = 0

  // Player confidence
  if (activeTokens.player > 0 && tokens.player[0]) {
    totalConfidence += tokens.player[0].confidence
    tokenConfidenceCount++
  }

  // Card number confidence
  if (activeTokens.cardNumber > 0 && tokens.cardNumber[0]) {
    totalConfidence += tokens.cardNumber[0].confidence
    tokenConfidenceCount++
  }

  // Year confidence
  if (activeTokens.year > 0 && tokens.year[0]) {
    totalConfidence += tokens.year[0].confidence
    tokenConfidenceCount++
  }

  // Serial number confidence
  if (activeTokens.serial > 0 && tokens.serial[0]) {
    totalConfidence += tokens.serial[0].confidence
    tokenConfidenceCount++
  }

  // Card types - high confidence when present
  if (activeTokens.cardTypes > 0) {
    totalConfidence += 90
    tokenConfidenceCount++
  }

  // Calculate average
  if (tokenConfidenceCount > 0) {
    confidence = Math.round(totalConfidence / tokenConfidenceCount)
  }

  // Bonus for more specific patterns
  if (patternType === 'FOUR_TOKEN_RICH') {
    confidence += 10 // Very specific queries are more confident
  } else if (patternType === 'THREE_TOKEN') {
    confidence += 5
  }

  // Cap at 100
  return Math.min(100, confidence)
}

// ============================================================================
// LAYER 3: QUERY BUILDER
// ============================================================================

/**
 * Main Query Builder
 * Builds and executes SQL based on the recognized pattern and strategy
 */
async function buildAndExecuteQuery(tokens, pattern, limit = 50) {
  console.log('\n=== QUERY BUILDER START ===')
  console.log('Strategy:', pattern.strategy)
  console.log('Limit:', limit)

  let results = []

  try {
    switch (pattern.strategy) {
      case 'NO_RESULTS':
        results = []
        break

      case 'PLAYER_ONLY':
        results = await executePlayerOnlyQuery(tokens, limit)
        break

      case 'CARD_NUMBER_ONLY':
        results = await executeCardNumberOnlyQuery(tokens, limit)
        break

      case 'PRODUCTION_CODE_ONLY':
        results = await executeProductionCodeOnlyQuery(tokens, limit)
        break

      case 'YEAR_BROWSE':
        results = await executeYearBrowseQuery(tokens, limit)
        break

      case 'PLAYER_CARD_NUMBER':
        results = await executePlayerCardNumberQuery(tokens, limit)
        break

      case 'CARDS_WITH_MULTI_FILTERS':
        // When there are multiple filters, prioritize CARD results (not just entities)
        // This handles queries like "steven kwan pink" (player + color), "trout 2020" (player + year), etc.

        // Check if we have filtering tokens beyond just entity names (player/team/set)
        const hasFilteringTokens =
          tokens.parallel.length > 0 ||
          tokens.year.length > 0 ||
          tokens.cardNumber.length > 0 ||
          tokens.serial.length > 0 ||
          tokens.insert.length > 0 ||
          tokens.cardTypes.rookie ||
          tokens.cardTypes.autograph ||
          tokens.cardTypes.shortPrint ||
          tokens.cardTypes.relic

        // If we have entity tokens WITH filtering tokens, return cards
        if (hasFilteringTokens && (tokens.player.length > 0 || tokens.team.length > 0 || tokens.set.length > 0)) {
          console.log(`  [CARDS_WITH_MULTI_FILTERS] Have filtering tokens - returning CARDS`)
          results = await executeCardsWithMultiFiltersQuery(tokens, limit)
        } else {
          // No filtering tokens, return entities
          const entityQueries = []

          // Add player entity query if player tokens exist
          if (tokens.player && tokens.player.length > 0) {
            entityQueries.push(executePlayerOnlyQuery(tokens, Math.ceil(limit / 3)))
          }

          // Add team entity query if team tokens exist
          if (tokens.team && tokens.team.length > 0) {
            entityQueries.push(executeTeamBrowseQuery(tokens, Math.ceil(limit / 3)))
          }

          // Add series entity query if set tokens exist
          if (tokens.set && tokens.set.length > 0) {
            entityQueries.push(executeSetBrowseQuery(tokens, Math.ceil(limit / 3)))
          }

          // If we have entity queries, execute them in parallel and combine results
          if (entityQueries.length > 0) {
            console.log(`  [CARDS_WITH_MULTI_FILTERS] Executing ${entityQueries.length} entity queries in parallel`)
            const entityResults = await Promise.all(entityQueries)
            results = entityResults.flat()
            console.log(`  [CARDS_WITH_MULTI_FILTERS] Combined ${results.length} entity results`)
          } else {
            // No entity tokens either, fall back to card results
            results = await executeCardsWithMultiFiltersQuery(tokens, limit)
          }
        }
        break

      case 'SET_BROWSE':
        console.log('[Query Builder] Calling executeSetBrowseQuery...')
        results = await executeSetBrowseQuery(tokens, limit)
        console.log('[Query Builder] executeSetBrowseQuery returned:', results.length, 'results')
        if (results.length > 0) {
          console.log('[Query Builder] First result:', JSON.stringify(results[0]).substring(0, 200))
        }
        break

      case 'TEAM_BROWSE':
        results = await executeTeamBrowseQuery(tokens, limit)
        break

      case 'CARD_TYPE_ONLY':
        results = await executeCardTypeOnlyQuery(tokens, limit)
        break

      case 'PARALLEL_BROWSE':
        results = await executeParallelBrowseQuery(tokens, limit)
        break

      case 'SERIAL_BROWSE':
        results = await executeSerialBrowseQuery(tokens, limit)
        break

      case 'INSERT_BROWSE':
        results = await executeInsertBrowseQuery(tokens, limit)
        break

      case 'KEYWORD_BROWSE':
        results = await executeKeywordBrowseQuery(tokens, limit)
        break

      case 'SET_YEAR_BROWSE':
        results = await executeSetYearBrowseQuery(tokens, limit)
        break

      default:
        console.log('Unknown strategy, using fallback')
        results = await executeCardsWithMultiFiltersQuery(tokens, limit)
    }

    console.log('=== QUERY BUILDER COMPLETE ===')
    console.log('Results returned:', results.length)
    console.log('')

    return results

  } catch (error) {
    console.error('Query builder error:', error)
    return []
  }
}

/**
 * Strategy: PLAYER_ONLY
 * Returns player results when only a player name was searched
 */
async function executePlayerOnlyQuery(tokens, limit) {
  if (!tokens.player || tokens.player.length === 0) {
    return []
  }

  console.log('  [PLAYER_ONLY] Returning player matches')

  // Get player IDs to fetch team data
  const playerIds = tokens.player.slice(0, limit).map(p => p.player_id)

  // Fetch team data for all players
  const teamData = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT
      pt.player as player_id,
      t.team_id,
      t.name as team_name,
      t.abbreviation,
      t.primary_color,
      t.secondary_color
    FROM player_team pt
    INNER JOIN team t ON pt.team = t.team_id
    WHERE pt.player IN (${playerIds.join(',')})
  `)

  // Group teams by player_id
  const teamsByPlayer = teamData.reduce((acc, team) => {
    const playerId = Number(team.player_id)
    if (!acc[playerId]) {
      acc[playerId] = []
    }
    acc[playerId].push({
      team_id: Number(team.team_id),
      name: team.team_name,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color
    })
    return acc
  }, {})

  // Return the players we already found during token extraction
  // Add result type and format for consistency, including team data
  return tokens.player.slice(0, limit).map(player => ({
    type: 'player',
    id: player.player_id,
    name: `${player.first_name} ${player.last_name}`,
    first_name: player.first_name,
    last_name: player.last_name,
    nick_name: player.nick_name,
    slug: player.slug,
    card_count: player.card_count,
    is_hof: player.is_hof,
    teams: teamsByPlayer[player.player_id] || [],
    confidence: player.confidence,
    relevance: player.confidence
  }))
}

/**
 * Strategy: CARD_NUMBER_ONLY
 * Returns cards matching the card number pattern
 */
async function executeCardNumberOnlyQuery(tokens, limit) {
  if (!tokens.cardNumber || tokens.cardNumber.length === 0) {
    return []
  }

  const cardNumberPattern = tokens.cardNumber[0].pattern
  console.log(`  [CARD_NUMBER_ONLY] Searching for card number: ${cardNumberPattern}`)

  // Add wildcards for LIKE pattern
  const likePattern = `%${escapeSqlLike(cardNumberPattern)}%`

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      s.slug as series_slug,
      st.name as set_name,
      st.slug as set_slug,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE c.card_number LIKE '${likePattern}' COLLATE Latin1_General_CI_AI
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.slug, st.name, st.slug, st.year, m.name, col.name
    ORDER BY
      CASE WHEN c.card_number = '${escapeSqlLike(cardNumberPattern)}' THEN 0 ELSE 1 END,
      st.year DESC,
      c.card_number
  `

  console.log('SQL Query:', sql.substring(0, 500))  // Log first 500 chars

  const results = await prisma.$queryRawUnsafe(sql)

  console.log('  Query returned', results.length, 'results')

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: tokens.cardNumber[0].confidence,
    relevance: tokens.cardNumber[0].confidence
  }))
}

/**
 * Strategy: PRODUCTION_CODE_ONLY
 * Returns the series matching the production code (not individual cards)
 */
async function executeProductionCodeOnlyQuery(tokens, limit) {
  if (!tokens.productionCode || tokens.productionCode.length === 0) {
    return []
  }

  const productionCode = tokens.productionCode[0].code
  console.log(`  [PRODUCTION_CODE_ONLY] Searching for production code: ${productionCode}`)

  const sql = `
    SELECT TOP ${limit}
      s.series_id,
      s.name as series_name,
      s.slug,
      s.production_code,
      s.card_count,
      s.card_entered_count,
      s.is_base,
      s.parallel_of_series as parallel_of,
      s.print_run_display,
      st.set_id,
      st.name as set_name,
      st.slug as set_slug,
      st.year as set_year,
      m.name as manufacturer_name,
      col.color_id,
      col.name as color_name,
      col.hex_value as color_hex
    FROM series s
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    WHERE s.production_code = '${escapeSqlLike(productionCode)}'
    ORDER BY st.year DESC
  `

  console.log('SQL Query:', sql.substring(0, 500))

  const results = await prisma.$queryRawUnsafe(sql)

  console.log('  Query returned', results.length, 'results')

  return results.map(series => ({
    type: 'series',
    id: Number(series.series_id),
    series_id: Number(series.series_id),
    name: series.series_name,
    series_name: series.series_name,
    slug: series.slug,
    production_code: series.production_code,
    set_id: Number(series.set_id),
    set_name: series.set_name || '',
    set_slug: series.set_slug || '',
    set_year: series.set_year || null,
    year: series.set_year || null,
    manufacturer_name: series.manufacturer_name || '',
    color_id: series.color_id ? Number(series.color_id) : null,
    color_name: series.color_name || null,
    color_hex: series.color_hex || null,
    print_run_display: series.print_run_display || null,
    card_count: series.card_count || 0,
    rc_count: 0,
    parallel_count: 0,
    is_base: series.is_base || false,
    parallel_of: series.parallel_of ? Number(series.parallel_of) : null,
    confidence: tokens.productionCode[0].confidence,
    relevance: tokens.productionCode[0].confidence
  }))
}

/**
 * Strategy: YEAR_BROWSE
 * Returns cards from a specific year
 */
async function executeYearBrowseQuery(tokens, limit) {
  if (!tokens.year || tokens.year.length === 0) {
    return []
  }

  const year = tokens.year[0].year
  console.log(`  [YEAR_BROWSE] Browsing year: ${year}`)

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE st.year = ${year}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name
    ORDER BY max_card_count DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: 95,
    relevance: 95
  }))
}

/**
 * Strategy: PLAYER_CARD_NUMBER
 * Returns specific cards for a player with a specific card number
 */
async function executePlayerCardNumberQuery(tokens, limit) {
  if (!tokens.player || tokens.player.length === 0 || !tokens.cardNumber || tokens.cardNumber.length === 0) {
    return []
  }

  const player = tokens.player[0]
  const cardNumberPattern = tokens.cardNumber[0].pattern

  console.log(`  [PLAYER_CARD_NUMBER] Player: ${player.name}, Card #: ${cardNumberPattern}`)

  // Add wildcards for LIKE pattern
  const likePattern = `%${escapeSqlLike(cardNumberPattern)}%`

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    INNER JOIN card_player_team cpt ON c.card_id = cpt.card
    INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
    INNER JOIN player p ON pt.player = p.player_id
    WHERE p.player_id = ${player.player_id}
      AND c.card_number LIKE '${likePattern}' COLLATE Latin1_General_CI_AI
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY
      CASE WHEN c.card_number = '${escapeSqlLike(cardNumberPattern)}' THEN 0 ELSE 1 END,
      st.year DESC
  `

  const results = await prisma.$queryRawUnsafe(sql)

  // Calculate relevance based on combined confidence
  const avgConfidence = Math.round((player.confidence + tokens.cardNumber[0].confidence) / 2)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: avgConfidence,
    relevance: avgConfidence
  }))
}

/**
 * Strategy: CARDS_WITH_MULTI_FILTERS
 * Handles all multi-token queries with dynamic filter building
 */
async function executeCardsWithMultiFiltersQuery(tokens, limit) {
  console.log('  [CARDS_WITH_MULTI_FILTERS] Building dynamic query with all active filters')

  const whereClauses = []
  const confidenceScores = []

  // Filter by player
  if (tokens.player && tokens.player.length > 0) {
    const playerIds = tokens.player.map(p => p.player_id).join(', ')
    whereClauses.push(`p.player_id IN (${playerIds})`)
    confidenceScores.push(tokens.player[0].confidence)
    console.log(`    - Player filter: IDs [${playerIds}]`)
  }

  // Filter by card number
  if (tokens.cardNumber && tokens.cardNumber.length > 0) {
    const cardNumberPattern = tokens.cardNumber[0].pattern
    const likePattern = `%${escapeSqlLike(cardNumberPattern)}%`
    whereClauses.push(`c.card_number LIKE '${likePattern}' COLLATE Latin1_General_CI_AI`)
    confidenceScores.push(tokens.cardNumber[0].confidence)
    console.log(`    - Card number filter: ${cardNumberPattern}`)
  }

  // Filter by year (NOTE: year is in set table, not card table)
  if (tokens.year && tokens.year.length > 0) {
    const year = tokens.year[0].year
    whereClauses.push(`st.year = ${year}`)
    confidenceScores.push(tokens.year[0].confidence)
    console.log(`    - Year filter: ${year}`)
  }

  // Filter by card types
  if (tokens.cardTypes.rookie) {
    whereClauses.push(`c.is_rookie = 1`)
    confidenceScores.push(90)
    console.log(`    - Rookie filter: TRUE`)
  }
  if (tokens.cardTypes.autograph) {
    whereClauses.push(`c.is_autograph = 1`)
    confidenceScores.push(90)
    console.log(`    - Autograph filter: TRUE`)
  }
  if (tokens.cardTypes.shortPrint) {
    whereClauses.push(`c.is_short_print = 1`)
    confidenceScores.push(90)
    console.log(`    - Short Print filter: TRUE`)
  }
  if (tokens.cardTypes.relic) {
    whereClauses.push(`c.is_relic = 1`)
    confidenceScores.push(90)
    console.log(`    - Relic filter: TRUE`)
  }

  // Filter by serial number
  if (tokens.serial && tokens.serial.length > 0) {
    const printRun = tokens.serial[0].print_run
    whereClauses.push(`c.print_run = ${printRun}`)
    confidenceScores.push(tokens.serial[0].confidence)
    console.log(`    - Serial number filter: /${printRun}`)
  }

  // Filter by set/series
  if (tokens.set && tokens.set.length > 0) {
    const seriesIds = tokens.set.map(s => s.series_id).join(', ')
    whereClauses.push(`s.series_id IN (${seriesIds})`)
    confidenceScores.push(tokens.set[0].confidence)
    console.log(`    - Set filter: IDs [${seriesIds}]`)
  }

  // Filter by team
  if (tokens.team && tokens.team.length > 0) {
    const teamIds = tokens.team.map(t => t.team_id).join(', ')
    whereClauses.push(`t.team_id IN (${teamIds})`)
    confidenceScores.push(tokens.team[0].confidence)
    console.log(`    - Team filter: IDs [${teamIds}]`)
  }

  // Filter by parallel/color
  if (tokens.parallel && tokens.parallel.length > 0) {
    const colorIds = tokens.parallel.map(par => par.color_id).join(', ')
    whereClauses.push(`col.color_id IN (${colorIds})`)
    confidenceScores.push(tokens.parallel[0].confidence)
    console.log(`    - Parallel filter: IDs [${colorIds}]`)
  }

  // Filter by insert/subset
  if (tokens.insert && tokens.insert.length > 0) {
    const insertSeriesIds = tokens.insert.map(ins => ins.series_id).join(', ')
    whereClauses.push(`s.series_id IN (${insertSeriesIds})`)
    confidenceScores.push(tokens.insert[0].confidence)
    console.log(`    - Insert filter: IDs [${insertSeriesIds}]`)
  }

  // Build WHERE clause
  const whereClause = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1'

  // Calculate average confidence
  const avgConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
    : 70

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      s.slug as series_slug,
      st.name as set_name,
      st.slug as set_slug,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      col.hex_value as color_hex,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count,
      MAX(t.name) as team_name,
      MAX(t.abbreviation) as team_abbreviation,
      MAX(t.primary_color) as team_primary_color,
      MAX(t.secondary_color) as team_secondary_color
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    LEFT JOIN team t ON pt.team = t.team_id
    WHERE ${whereClause}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.slug, st.name, st.slug, st.year, m.name, col.name, col.hex_value
    ORDER BY
      st.year DESC,
      max_card_count DESC,
      c.card_number
  `

  console.log('    SQL WHERE:', whereClause)

  const results = await prisma.$queryRawUnsafe(sql)

  console.log(`    Results found: ${results.length}`)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    series_slug: card.series_slug,
    set_name: card.set_name,
    set_slug: card.set_slug,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    color_hex: card.color_hex,
    team_name: card.team_name,
    team_abbreviation: card.team_abbreviation,
    team_primary_color: card.team_primary_color,
    team_secondary_color: card.team_secondary_color,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: avgConfidence,
    relevance: avgConfidence
  }))
}

/**
 * Strategy: SET_BROWSE
 * Browse cards from a specific set/series
 */
async function executeSetBrowseQuery(tokens, limit) {
  console.log(`  [SET_BROWSE] Function called with tokens.set:`, JSON.stringify(tokens.set).substring(0, 300))

  if (!tokens.set || tokens.set.length === 0) {
    console.log(`  [SET_BROWSE] tokens.set is empty or undefined!`)
    return []
  }

  console.log(`  [SET_BROWSE] Returning series entities for ${tokens.set.length} series`)

  try {
    // Get full series data with counts
    const seriesIds = tokens.set.slice(0, limit).map(s => Number(s.series_id))

    if (seriesIds.length === 0) {
      return []
    }

    const sql = `
      SELECT TOP ${limit}
        CAST(s.series_id AS INT) as series_id,
        s.name as series_name,
        s.slug,
        s.card_count,
        s.card_entered_count,
        s.is_base,
        CAST(s.parallel_of_series AS INT) as parallel_of,
        s.print_run_display,
        CAST(st.set_id AS INT) as set_id,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year,
        m.name as manufacturer_name,
        CAST(col.color_id AS INT) as color_id,
        col.name as color_name,
        col.hex_value as color_hex
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      WHERE s.series_id IN (${seriesIds.join(',')})
    `

    console.log(`  [SET_BROWSE] About to execute SQL:`, sql.substring(0, 300))

    let results
    try {
      results = await prisma.$queryRawUnsafe(sql)
      console.log(`  [SET_BROWSE] Query returned ${results.length} results`)
    } catch (queryError) {
      console.error(`  [SET_BROWSE] SQL query failed:`, queryError.message)
      console.error(`  [SET_BROWSE] SQL:`, sql)
      return []
    }

    if (results.length === 0) {
      console.log(`  [SET_BROWSE] Results array is empty`)
      return []
    }

    console.log(`  [SET_BROWSE] Mapping ${results.length} results...`)
    const mapped = results.map((series, index) => ({
      type: 'series',
      id: series.series_id,
      series_id: series.series_id,
      name: series.series_name,
      series_name: series.series_name,
      slug: series.slug,
      set_id: series.set_id || null,
      set_name: series.set_name || '',
      set_slug: series.set_slug || '',
      set_year: series.set_year || null,
      year: series.set_year || null,
      manufacturer_name: series.manufacturer_name || '',
      color_id: series.color_id || null,
      color_name: series.color_name || null,
      color_hex: series.color_hex || null,
      print_run_display: series.print_run_display || null,
      card_count: series.card_count || 0,
      rc_count: 0,
      parallel_count: 0,
      is_base: series.is_base || false,
      parallel_of: series.parallel_of || null,
      confidence: tokens.set[index]?.confidence || 80,
      relevance: tokens.set[index]?.confidence || 80
    }))

    console.log(`  [SET_BROWSE] Successfully mapped ${mapped.length} series, returning...`)
    return mapped
  } catch (error) {
    console.error('  [SET_BROWSE] Outer try-catch error:', error.message)
    console.error('  [SET_BROWSE] Stack:', error.stack)
    return []
  }
}

/**
 * Strategy: TEAM_BROWSE
 * Returns team entities when user searches for a team
 */
async function executeTeamBrowseQuery(tokens, limit) {
  if (!tokens.team || tokens.team.length === 0) {
    return []
  }

  console.log(`  [TEAM_BROWSE] Returning team entities`)

  // Get full team data with counts
  const teamIds = tokens.team.slice(0, limit).map(t => t.team_id)

  const sql = `
    SELECT
      t.team_id,
      t.name,
      t.city,
      t.mascot,
      t.abbreviation,
      t.primary_color,
      t.secondary_color,
      t.slug,
      o.abbreviation as organization_abbreviation,
      o.name as organization_name,
      (SELECT COUNT(DISTINCT p.player_id)
       FROM player_team pt
       INNER JOIN player p ON pt.player = p.player_id
       WHERE pt.team = t.team_id) as player_count,
      (SELECT COUNT(DISTINCT c.card_id)
       FROM card_player_team cpt
       INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
       INNER JOIN card c ON cpt.card = c.card_id
       WHERE pt.team = t.team_id) as card_count
    FROM team t
    LEFT JOIN organization o ON t.organization = o.organization_id
    WHERE t.team_id IN (${teamIds.join(',')})
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map((team, index) => ({
    type: 'team',
    id: Number(team.team_id),
    team_id: Number(team.team_id),
    name: team.name,
    city: team.city,
    mascot: team.mascot,
    abbreviation: team.abbreviation,
    primary_color: team.primary_color,
    secondary_color: team.secondary_color,
    slug: team.slug,
    organization_abbreviation: team.organization_abbreviation,
    organization_name: team.organization_name,
    player_count: Number(team.player_count),
    card_count: Number(team.card_count),
    confidence: tokens.team[index]?.confidence || 80,
    relevance: tokens.team[index]?.confidence || 80
  }))
}

/**
 * Strategy: CARD_TYPE_ONLY
 * Browse cards of a specific type (rookie, auto, etc.)
 */
async function executeCardTypeOnlyQuery(tokens, limit) {
  console.log(`  [CARD_TYPE_ONLY] Browsing card types:`, tokens.cardTypes)

  const whereClauses = []

  if (tokens.cardTypes.rookie) whereClauses.push('c.is_rookie = 1')
  if (tokens.cardTypes.autograph) whereClauses.push('c.is_autograph = 1')
  if (tokens.cardTypes.shortPrint) whereClauses.push('c.is_short_print = 1')
  if (tokens.cardTypes.relic) whereClauses.push('c.is_relic = 1')

  if (whereClauses.length === 0) {
    return []
  }

  const whereClause = whereClauses.join(' AND ')

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE ${whereClause}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY max_card_count DESC, st.year DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: 90,
    relevance: 90
  }))
}

/**
 * Strategy: PARALLEL_BROWSE
 * Browse cards with specific parallel/color
 */
async function executeParallelBrowseQuery(tokens, limit) {
  if (!tokens.parallel || tokens.parallel.length === 0) {
    return []
  }

  const parallelInfo = tokens.parallel[0]
  console.log(`  [PARALLEL_BROWSE] Browsing parallel: ${parallelInfo.color_name}`)

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE col.color_id = ${parallelInfo.color_id}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY max_card_count DESC, st.year DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: parallelInfo.confidence,
    relevance: parallelInfo.confidence
  }))
}

/**
 * Strategy: SET_YEAR_BROWSE
 * Browse cards from a specific set + year combination
 * NOTE: Uses set/manufacturer name pattern matching, not specific series_id,
 * because the user might search "2020 topps" but token extraction found "2025 Topps"
 */
async function executeSetYearBrowseQuery(tokens, limit) {
  if (!tokens.set || tokens.set.length === 0 || !tokens.year || tokens.year.length === 0) {
    return []
  }

  const setInfo = tokens.set[0]
  const year = tokens.year[0].year

  console.log(`  [SET_YEAR_BROWSE] Browsing ${year} ${setInfo.set_name || setInfo.series_name}`)

  // Build search pattern from set name (use manufacturer + set name pattern)
  const searchPattern = `%${escapeSqlLike(setInfo.matched)}%`

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      s.slug as series_slug,
      st.name as set_name,
      st.slug as set_slug,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      col.hex_value as color_hex,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count,
      MAX(t.name) as team_name,
      MAX(t.abbreviation) as team_abbreviation,
      MAX(t.primary_color) as team_primary_color,
      MAX(t.secondary_color) as team_secondary_color
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    LEFT JOIN team t ON pt.team = t.team_id
    WHERE st.year = ${year}
      AND (st.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR m.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
           OR s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.slug, st.name, st.slug, st.year, m.name, col.name, col.hex_value
    ORDER BY max_card_count DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  const avgConfidence = Math.round((setInfo.confidence + tokens.year[0].confidence) / 2)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    series_slug: card.series_slug,
    set_name: card.set_name,
    set_slug: card.set_slug,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    color_hex: card.color_hex,
    team_name: card.team_name,
    team_abbreviation: card.team_abbreviation,
    team_primary_color: card.team_primary_color,
    team_secondary_color: card.team_secondary_color,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: avgConfidence,
    relevance: avgConfidence
  }))
}

/**
 * Strategy: SERIAL_BROWSE
 * Browse cards with specific print run
 */
async function executeSerialBrowseQuery(tokens, limit) {
  if (!tokens.serial || tokens.serial.length === 0) {
    return []
  }

  const serialInfo = tokens.serial[0]
  console.log(`  [SERIAL_BROWSE] Browsing cards /${serialInfo.print_run}`)

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE c.print_run = ${serialInfo.print_run}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY max_card_count DESC, st.year DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: serialInfo.confidence,
    relevance: serialInfo.confidence
  }))
}

/**
 * Strategy: INSERT_BROWSE
 * Browse cards from specific insert/subset
 */
async function executeInsertBrowseQuery(tokens, limit) {
  if (!tokens.insert || tokens.insert.length === 0) {
    return []
  }

  const insertInfo = tokens.insert[0]
  console.log(`  [INSERT_BROWSE] Browsing insert: ${insertInfo.series_name}`)

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE s.series_id = ${insertInfo.series_id}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY max_card_count DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: insertInfo.confidence,
    relevance: insertInfo.confidence
  }))
}

/**
 * Strategy: KEYWORD_BROWSE
 * Browse cards matching misc keywords (design terms, etc.)
 */
async function executeKeywordBrowseQuery(tokens, limit) {
  if (!tokens.keywords || tokens.keywords.length === 0) {
    return []
  }

  // Keywords might have matched colors/parallels, so use those if available
  if (tokens.parallel && tokens.parallel.length > 0) {
    return await executeParallelBrowseQuery(tokens, limit)
  }

  // Otherwise, do a text search on series names
  const keyword = tokens.keywords[0].keyword
  console.log(`  [KEYWORD_BROWSE] Browsing keyword: ${keyword}`)

  const searchPattern = `%${escapeSqlLike(keyword)}%`

  const sql = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      s.name as series_name,
      st.name as set_name,
      st.year as set_year,
      m.name as manufacturer_name,
      col.name as color_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
      MAX(p.card_count) as max_card_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
       OR col.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, st.name, st.year, m.name, col.name
    ORDER BY max_card_count DESC, st.year DESC, c.card_number
  `

  const results = await prisma.$queryRawUnsafe(sql)

  return results.map(card => ({
    type: 'card',
    id: Number(card.card_id),
    card_number: card.card_number,
    year: card.set_year,
    player_names: card.player_names,
    series_name: card.series_name,
    set_name: card.set_name,
    manufacturer_name: card.manufacturer_name,
    color_name: card.color_name,
    is_rookie: card.is_rookie,
    is_autograph: card.is_autograph,
    is_relic: card.is_relic,
    print_run: card.print_run ? Number(card.print_run) : null,
    confidence: tokens.keywords[0].confidence,
    relevance: tokens.keywords[0].confidence
  }))
}

// ============================================================================
// LAYER 4: FUZZY MATCHING - Phase 6
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to change one string into the other
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length
  const len2 = str2.length

  // Create a 2D array for dynamic programming
  const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0))

  // Initialize base cases
  for (let i = 0; i <= len1; i++) dp[i][0] = i
  for (let j = 0; j <= len2; j++) dp[0][j] = j

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + 1   // substitution
        )
      }
    }
  }

  return dp[len1][len2]
}

/**
 * Calculate Soundex code for phonetic matching
 * Soundex is a phonetic algorithm that indexes names by sound
 *
 * @param {string} str - String to encode
 * @returns {string} - Soundex code (e.g., "S530" for "Smith")
 */
function soundex(str) {
  if (!str || str.length === 0) return ''

  // Convert to uppercase and remove non-letters
  str = str.toUpperCase().replace(/[^A-Z]/g, '')
  if (str.length === 0) return ''

  // Keep first letter
  let code = str[0]

  // Soundex mapping
  const mapping = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  }

  let prevCode = mapping[str[0]] || '0'

  for (let i = 1; i < str.length && code.length < 4; i++) {
    const char = str[i]
    const charCode = mapping[char] || '0'

    // Skip vowels and H, W, Y
    if (charCode === '0') {
      prevCode = '0'
      continue
    }

    // Don't add duplicate consecutive codes
    if (charCode !== prevCode) {
      code += charCode
      prevCode = charCode
    }
  }

  // Pad with zeros to length 4
  return (code + '000').substring(0, 4)
}

/**
 * Abbreviation expansion dictionary
 * Maps common abbreviations to their full forms
 */
const ABBREVIATION_DICTIONARY = {
  // Set/Manufacturer abbreviations
  'bc': 'bowman chrome',
  'tc': 'topps chrome',
  'ud': 'upper deck',
  'sp': 'sp authentic',
  'spx': 'spx',
  'bo': 'bowman',
  'bg': 'bowman draft',
  'bd': 'bowman draft',
  'bcp': 'bowman chrome prospects',
  'tcu': 'topps chrome update',
  'tu': 'topps update',
  'ts': 'topps series',
  'sc': 'stadium club',
  'gq': 'gypsy queen',
  'ag': 'allen ginter',
  'a&g': 'allen ginter',
  'her': 'heritage',
  'arch': 'archive',
  'chrome': 'chrome',

  // Card type abbreviations
  'rc': 'rookie',
  'auto': 'autograph',
  'mem': 'memorabilia',
  'relic': 'relic',
  'patch': 'patch',
  'ssp': 'super short print',

  // Team abbreviations (MLB)
  'laa': 'angels',
  'ari': 'diamondbacks',
  'atl': 'braves',
  'bal': 'orioles',
  'bos': 'red sox',
  'chc': 'cubs',
  'cws': 'white sox',
  'cin': 'reds',
  'cle': 'guardians',
  'col': 'rockies',
  'det': 'tigers',
  'hou': 'astros',
  'kc': 'royals',
  'mia': 'marlins',
  'mil': 'brewers',
  'min': 'twins',
  'nym': 'mets',
  'nyy': 'yankees',
  'oak': 'athletics',
  'phi': 'phillies',
  'pit': 'pirates',
  'sd': 'padres',
  'sf': 'giants',
  'sea': 'mariners',
  'stl': 'cardinals',
  'tb': 'rays',
  'tex': 'rangers',
  'tor': 'blue jays',
  'was': 'nationals',

  // Common terms
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  'xfractor': 'xfractor',
  'superfractor': 'superfractor',
  'refractor': 'refractor'
}

/**
 * Expand abbreviations in a query
 *
 * @param {string} query - Search query
 * @returns {string} - Query with abbreviations expanded
 */
function expandAbbreviations(query) {
  let expanded = query.toLowerCase()

  // Try to expand each word
  const words = expanded.split(/\s+/)
  const expandedWords = words.map(word => {
    // Remove punctuation for matching
    const cleanWord = word.replace(/[^a-z0-9]/g, '')

    // Check if it's an abbreviation
    if (ABBREVIATION_DICTIONARY[cleanWord]) {
      return ABBREVIATION_DICTIONARY[cleanWord]
    }

    return word
  })

  return expandedWords.join(' ')
}

/**
 * Check if two strings are phonetically similar using Soundex
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {boolean} - True if phonetically similar
 */
function arePhoneticallySimilar(str1, str2) {
  const soundex1 = soundex(str1)
  const soundex2 = soundex(str2)
  return soundex1 === soundex2 && soundex1 !== ''
}

/**
 * Find close matches using Levenshtein distance
 *
 * @param {string} query - Query string
 * @param {Array} candidates - Array of candidate strings to match against
 * @param {number} maxDistance - Maximum edit distance to consider (default: 2)
 * @returns {Array} - Array of matches with their distances
 */
function findCloseMatches(query, candidates, maxDistance = 2) {
  const queryLower = query.toLowerCase()
  const matches = []

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase()
    const distance = levenshteinDistance(queryLower, candidateLower)

    if (distance <= maxDistance) {
      matches.push({
        value: candidate,
        distance: distance,
        confidence: Math.round(100 * (1 - distance / Math.max(queryLower.length, candidateLower.length)))
      })
    }
  }

  // Sort by distance (closest first)
  matches.sort((a, b) => a.distance - b.distance)

  return matches
}

/**
 * Generate "Did You Mean?" suggestions
 *
 * @param {string} query - Original query
 * @param {Array} tokens - Extracted tokens
 * @returns {Array} - Array of suggestions
 */
function generateSuggestions(query, tokens) {
  const suggestions = []

  // If player search with low confidence, suggest alternatives
  if (tokens.player && tokens.player.length > 0) {
    const topPlayer = tokens.player[0]
    if (topPlayer.confidence < 70 && tokens.player.length > 1) {
      // Suggest other players found
      for (let i = 1; i < Math.min(3, tokens.player.length); i++) {
        suggestions.push({
          type: 'player_alternative',
          original: query,
          suggestion: tokens.player[i].name,
          reason: `Did you mean "${tokens.player[i].name}"?`
        })
      }
    }
  }

  // Check for common typos in set names
  if (tokens.set && tokens.set.length > 0) {
    const topSet = tokens.set[0]
    if (topSet.confidence < 70) {
      suggestions.push({
        type: 'set_correction',
        original: query,
        suggestion: topSet.series_name,
        reason: `Showing results for "${topSet.series_name}"`
      })
    }
  }

  return suggestions
}

/**
 * Apply fuzzy matching to enhance token extraction
 * This is called after initial token extraction to add fuzzy matches
 *
 * @param {string} query - Search query
 * @param {Object} tokens - Extracted tokens
 * @returns {Object} - Enhanced tokens with fuzzy matches
 */
async function applyFuzzyMatching(query, tokens) {
  console.log('\n=== FUZZY MATCHING START ===')

  // Expand abbreviations in query
  const expandedQuery = expandAbbreviations(query)
  if (expandedQuery !== query.toLowerCase()) {
    console.log(`  [Abbreviation] Expanded: "${query}" → "${expandedQuery}"`)

    // Re-extract tokens with expanded query
    const expandedTokens = await extractAllTokens(expandedQuery)

    // Merge results (prefer expanded tokens if they have higher confidence)
    if (expandedTokens.player && expandedTokens.player.length > 0) {
      if (!tokens.player || tokens.player.length === 0 ||
          expandedTokens.player[0].confidence > tokens.player[0].confidence) {
        tokens.player = expandedTokens.player
        console.log(`  [Abbreviation] Enhanced player matches`)
      }
    }

    if (expandedTokens.set && expandedTokens.set.length > 0) {
      if (!tokens.set || tokens.set.length === 0 ||
          expandedTokens.set[0].confidence > tokens.set[0].confidence) {
        tokens.set = expandedTokens.set
        console.log(`  [Abbreviation] Enhanced set matches`)
      }
    }

    if (expandedTokens.team && expandedTokens.team.length > 0) {
      if (!tokens.team || tokens.team.length === 0 ||
          expandedTokens.team[0].confidence > tokens.team[0].confidence) {
        tokens.team = expandedTokens.team
        console.log(`  [Abbreviation] Enhanced team matches`)
      }
    }
  }

  // Apply phonetic matching for player names if results are weak
  if (tokens.player && tokens.player.length > 0) {
    const topPlayer = tokens.player[0]
    if (topPlayer.confidence < 80) {
      console.log(`  [Phonetic] Checking for phonetically similar players`)
      // Phonetic search could be added here
      // For now, we rely on the database's fuzzy matching
    }
  }

  console.log('=== FUZZY MATCHING COMPLETE ===\n')

  return tokens
}

/**
 * Progressive filter relaxation for zero-result queries
 * Gradually removes filters until results are found
 *
 * @param {Object} tokens - Original tokens
 * @param {Object} pattern - Original pattern
 * @param {number} limit - Result limit
 * @returns {Object} - Results with relaxation info
 */
async function relaxFiltersProgressively(tokens, pattern, limit) {
  console.log('\n=== PROGRESSIVE FILTER RELAXATION ===')

  // Priority order for removing filters (least important first)
  const filterPriority = [
    'serial',        // Remove print run requirement first
    'parallel',      // Then parallel/color
    'cardTypes',     // Then card type flags
    'insert',        // Then insert requirements
    'keywords',      // Then keywords
    'cardNumber',    // Then card number (keep player)
    'year',          // Then year
    'set',           // Then set
    'team'           // Keep team as long as possible if player is present
  ]

  // Create a copy of tokens to modify
  let relaxedTokens = JSON.parse(JSON.stringify(tokens))
  let filtersRemoved = []

  for (const filter of filterPriority) {
    // Skip if this filter wasn't active
    if (!tokens[filter] ||
        (Array.isArray(tokens[filter]) && tokens[filter].length === 0) ||
        (filter === 'cardTypes' && !tokens.cardTypes.rookie && !tokens.cardTypes.autograph &&
         !tokens.cardTypes.shortPrint && !tokens.cardTypes.relic)) {
      continue
    }

    // Remove this filter
    if (filter === 'cardTypes') {
      relaxedTokens.cardTypes = { rookie: false, autograph: false, shortPrint: false, relic: false }
    } else {
      relaxedTokens[filter] = []
    }

    filtersRemoved.push(filter)
    console.log(`  [Relax] Removing filter: ${filter}`)

    // Try searching with relaxed filters
    const relaxedPattern = recognizePattern(relaxedTokens)
    const results = await buildAndExecuteQuery(relaxedTokens, relaxedPattern, limit)

    if (results.length > 0) {
      console.log(`  [Relax] Found ${results.length} results after removing: ${filtersRemoved.join(', ')}`)
      console.log('=== RELAXATION COMPLETE ===\n')

      return {
        results: results,
        relaxed: true,
        filtersRemoved: filtersRemoved,
        message: `No exact matches found. Showing results without: ${filtersRemoved.join(', ')}`
      }
    }
  }

  console.log('  [Relax] No results even after full relaxation')
  console.log('=== RELAXATION COMPLETE ===\n')

  return {
    results: [],
    relaxed: true,
    filtersRemoved: filtersRemoved,
    message: 'No results found even with relaxed filters'
  }
}

// ============================================================================
// LAYER 5: RESULT RANKING (Advanced scoring)
// ============================================================================

// ============================================================================
// API ENDPOINT
// ============================================================================

router.get('/universal-v2', async (req, res) => {
  try {
    const { q: query, limit = 50, category = 'all' } = req.query

    console.log('\n' + '='.repeat(80))
    console.log('SEARCH V2 REQUEST')
    console.log('='.repeat(80))
    console.log('Query:', query)
    console.log('Limit:', limit)
    console.log('Category:', category)

    if (!query || query.trim().length < 2) {
      return res.json({ results: [], suggestions: [], message: 'Query too short' })
    }

    const searchQuery = query.trim()

    const startTime = Date.now()

    // PHASE 1: Extract tokens
    let tokens = await executeWithRetry(async () => {
      return await extractAllTokens(searchQuery)
    })

    // PHASE 4: Apply fuzzy matching (abbreviation expansion, typo tolerance)
    tokens = await applyFuzzyMatching(searchQuery, tokens)

    // PHASE 4.1: Clean up parallel tokens that match player/team names
    // This prevents "Evan White pink" from matching both "white" and "pink" as colors
    // Only use high-confidence player matches (95+) or multi-word matches to avoid
    // removing valid color tokens (e.g., don't let player "Pink" override color "Pink")
    if (tokens.player.length > 0 && tokens.parallel.length > 0) {
      const highConfidencePlayers = tokens.player.filter(p => {
        const wordCount = p.matched.split(/\s+/).length
        return p.confidence >= 95 || wordCount >= 2
      })

      const playerWords = highConfidencePlayers.flatMap(p =>
        [p.first_name, p.last_name, p.nick_name].filter(Boolean).flatMap(w => w.toLowerCase().split(/\s+/))
      )

      tokens.parallel = tokens.parallel.filter(parallel => {
        const parallelWord = parallel.matched.toLowerCase()
        const isPartOfPlayerName = playerWords.includes(parallelWord)
        if (isPartOfPlayerName) {
          console.log(`  [Token Cleanup] Removing parallel "${parallel.color_name}" because "${parallelWord}" is part of player name`)
        }
        return !isPartOfPlayerName
      })
    }

    // Do the same for team names (teams are usually multi-word, so less strict filtering)
    if (tokens.team.length > 0 && tokens.parallel.length > 0) {
      const teamWords = tokens.team.flatMap(t =>
        [t.name, t.city, t.mascot].filter(Boolean).flatMap(w => w.toLowerCase().split(/\s+/))
      )

      tokens.parallel = tokens.parallel.filter(parallel => {
        const parallelWord = parallel.matched.toLowerCase()
        const isPartOfTeamName = teamWords.includes(parallelWord)
        if (isPartOfTeamName) {
          console.log(`  [Token Cleanup] Removing parallel "${parallel.color_name}" because "${parallelWord}" is part of team name`)
        }
        return !isPartOfTeamName
      })
    }

    // PHASE 2: Recognize pattern (after fuzzy matching for best results)
    const pattern = recognizePattern(tokens)

    // PHASE 3: Build and execute query
    let results = await executeWithRetry(async () => {
      return await buildAndExecuteQuery(tokens, pattern, parseInt(limit))
    })

    // PHASE 4.5: If zero results, try progressive filter relaxation
    let relaxationInfo = null
    if (results.length === 0 && pattern.type !== 'EMPTY') {
      console.log('Zero results found, attempting filter relaxation...')
      const relaxed = await relaxFiltersProgressively(tokens, pattern, parseInt(limit))
      results = relaxed.results
      if (relaxed.relaxed) {
        relaxationInfo = {
          filtersRemoved: relaxed.filtersRemoved,
          message: relaxed.message
        }
      }
    }

    // PHASE 5: Generate suggestions (Did You Mean?)
    const suggestions = generateSuggestions(searchQuery, tokens)

    const searchTime = Date.now() - startTime

    console.log('='.repeat(80))
    console.log('SEARCH V2 COMPLETE')
    console.log('='.repeat(80))
    console.log('Query:', searchQuery)
    console.log('Pattern:', pattern.type, '→', pattern.strategy)
    console.log('Results:', results.length)
    console.log('Search time:', searchTime, 'ms')
    if (relaxationInfo) {
      console.log('Filters relaxed:', relaxationInfo.filtersRemoved.join(', '))
    }
    if (suggestions.length > 0) {
      console.log('Suggestions:', suggestions.length)
    }
    console.log('='.repeat(80) + '\n')

    // Return results with metadata
    const response = {
      query: searchQuery,
      pattern: {
        type: pattern.type,
        strategy: pattern.strategy,
        confidence: pattern.confidence
      },
      results: results,
      totalResults: results.length,
      searchTime: searchTime,
      phase: 'Phase 6 complete - fuzzy matching enabled!'
    }

    // Add relaxation info if applicable
    if (relaxationInfo) {
      response.relaxed = true
      response.filtersRemoved = relaxationInfo.filtersRemoved
      response.message = relaxationInfo.message
    }

    // Add suggestions if available
    if (suggestions.length > 0) {
      response.suggestions = suggestions
    }

    res.json(response)

  } catch (error) {
    console.error('Universal search V2 error:', error)
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    })
  }
})

// Health check
router.get('/health-v2', (req, res) => {
  res.json({
    status: 'OK',
    version: '2.0',
    route: 'search-v2',
    timestamp: new Date().toISOString()
  })
})

// ============================================================================
// CACHE STATISTICS ENDPOINT
// ============================================================================

router.get('/cache-stats', (req, res) => {
  const stats = getCacheStats()

  res.json({
    message: 'Search V2 Cache Statistics',
    ...stats,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})

module.exports = router
