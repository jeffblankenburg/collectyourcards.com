# Universal Search V2: Complete Rewrite Implementation Plan

## Project Goal
Achieve 100% coverage of Issue #34 requirements with order-agnostic, multi-token intelligent search that's blazing fast.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     API ENDPOINT                                 │
│  GET /api/search/universal-v2?q=trout+2020+topps+chrome+auto   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              1. TOKEN EXTRACTION LAYER                           │
│  Order-agnostic parallel extraction of all token types          │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │ player_name  │ card_number  │    year      │  set_name   │  │
│  │   "trout"    │              │   "2020"     │"topps chrome"│  │
│  │              │              │              │             │  │
│  │ team_name    │  parallel    │ serial_num   │ card_types  │  │
│  │              │              │              │   ["auto"]  │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│           2. PATTERN RECOGNITION ENGINE                          │
│  Identifies pattern type and selects search strategy            │
│  Pattern: 4-token (player + year + set + card_type)            │
│  Confidence: 95%                                                 │
│  Strategy: CARDS_WITH_MULTI_FILTERS                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              3. QUERY BUILDER LAYER                              │
│  Builds single optimized SQL query with all filters             │
│  Uses FTS indexes, proper JOINs, efficient WHERE clauses        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              4. FUZZY MATCHING LAYER                             │
│  Optional: Expands results with phonetic/typo matching          │
│  Levenshtein distance, Soundex, abbreviation expansion          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              5. RESULT RANKING & SCORING                         │
│  Scores results by relevance, applies type priority             │
│  Returns top N results sorted by score                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Token Extraction

### Design Philosophy
- **Parallel extraction**: All token types extracted simultaneously
- **Order-agnostic**: Position in query doesn't matter
- **Confidence scoring**: Each token gets a confidence score (0-100)
- **Conflict resolution**: Handle ambiguous cases (e.g., "2020" could be year or card number)

### Token Extractors (12 types)

#### 1. Player Name Extractor
```javascript
function extractPlayerNames(query) {
  // Strategy: Use existing player table for fuzzy matching
  // 1. Try exact name matches (full name, first, last, nickname)
  // 2. Try partial matches with minimum length (3+ chars)
  // 3. Handle apostrophes (O'Neill, ooneill)
  // 4. Return array of potential player matches with confidence

  return [
    { player_id: 1234, name: "Mike Trout", confidence: 95, matched: "trout" },
    { player_id: 5678, name: "Trout Fishing Co", confidence: 20, matched: "trout" }
  ]
}
```

**Implementation Notes:**
- Query player table with LIKE patterns
- Use COLLATE Latin1_General_CI_AI for accent insensitivity
- Boost confidence for high card_count players
- Boost confidence for HOF players

#### 2. Card Number Extractor
```javascript
function extractCardNumbers(query) {
  // Strategy: Regex patterns (existing logic is excellent)
  // 1. Try hyphenated formats: T87C2-39, BD-9, A-1
  // 2. Try alphanumeric: US110, H78, 1T, 57b
  // 3. Try pure numbers: 1, 108, 600
  // 4. Avoid false positives (years, serial numbers)

  return [
    { pattern: "108", confidence: 90, type: "pure_number" },
    { pattern: "US108", confidence: 85, type: "alphanumeric" }
  ]
}
```

**Implementation Notes:**
- Reuse existing regex patterns from current implementation
- Lower confidence for pure numbers (could be years)
- Higher confidence for alphanumeric patterns

#### 3. Year Extractor
```javascript
function extractYears(query) {
  // Strategy: 4-digit patterns
  // 1. Match 19xx or 20xx
  // 2. Validate against set year ranges (earliest baseball card ~1887)
  // 3. Boost confidence if near known set years

  return [
    { year: 2020, confidence: 95, context: "standalone" },
    { year: 2021, confidence: 70, context: "ambiguous" }
  ]
}
```

**Conflict Resolution:**
- If pattern matches both card_number and year, check:
  - Position context (years often at start/end)
  - Presence of other date indicators ("'20", "/20")
  - Known card number patterns from database

#### 4. Set Name Extractor
```javascript
function extractSetNames(query) {
  // Strategy: Match against set.name and manufacturer.name
  // 1. Multi-word matching: "topps chrome", "bowman draft"
  // 2. Manufacturer alone: "topps", "panini", "upper deck"
  // 3. Handle common abbreviations: "BC" → "Bowman Chrome"
  // 4. Year + set combination: "2020 topps"

  return [
    {
      set_id: 456,
      name: "Topps Chrome",
      year: 2020,
      confidence: 90,
      matched: "topps chrome"
    }
  ]
}
```

**Implementation Notes:**
- Query set and manufacturer tables
- Use word boundary matching (not substring)
- Consider year proximity for better matching
- Common abbreviations dictionary

#### 5. Team Name Extractor
```javascript
function extractTeams(query) {
  // Strategy: Match against team table (all columns)
  // 1. Full name: "Los Angeles Angels"
  // 2. City: "Los Angeles", "LA"
  // 3. Mascot: "Angels"
  // 4. Abbreviation: "LAA"
  // 5. Historical names

  return [
    {
      team_id: 12,
      name: "Los Angeles Angels",
      abbreviation: "LAA",
      confidence: 95,
      matched: "angels"
    }
  ]
}
```

**Implementation Notes:**
- Query entire team table dynamically
- Handle city abbreviations (LA, SF, NY)
- Match on any column (name, city, mascot, abbreviation)

#### 6. Parallel Descriptor Extractor
```javascript
function extractParallelDescriptors(query) {
  // Strategy: Match color names and parallel terms
  // 1. Color names: "refractor", "blue", "red", "gold"
  // 2. Parallel terms: "parallel", "variation", "sp"
  // 3. Foil types: "foil", "shimmer", "chrome"

  return [
    {
      color_id: 5,
      name: "Refractor",
      confidence: 90,
      matched: "refractor"
    }
  ]
}
```

**Implementation Notes:**
- Query color table
- Dictionary of common parallel terms
- Match partial words ("refract" matches "refractor")

#### 7. Serial Number Extractor
```javascript
function extractSerialNumbers(query) {
  // Strategy: Pattern matching for print runs
  // 1. Slash notation: "/499", "/25", "/1"
  // 2. Alternative: "to 499", "numbered 25"
  // 3. Extract number after slash

  return [
    { print_run: 499, confidence: 95, pattern: "/499" }
  ]
}
```

**Implementation Notes:**
- Regex: `/\/(\d+)/`
- Also match: `to \d+`, `numbered \d+`

#### 8. Insert Name Extractor
```javascript
function extractInsertNames(query) {
  // Strategy: Common insert/subset naming patterns
  // 1. Query series.name for subset/insert patterns
  // 2. Common terms: "future stars", "rookie debut", "all-star"
  // 3. Multi-word matching

  return [
    {
      series_id: 789,
      name: "Future Stars",
      confidence: 85,
      matched: "future stars"
    }
  ]
}
```

**Implementation Notes:**
- Many inserts are stored as separate series
- Query series table with is_base = 0
- Common insert term dictionary

#### 9. Rookie Indicator Extractor
```javascript
function extractRookieIndicators(query) {
  // Strategy: Keyword matching
  // 1. Terms: "rookie", "rc", "1st bowman", "prospect"
  // 2. Handle variations: "rookies", "rcs"

  return [
    { indicator: "rookie", confidence: 95, matched: "rc" }
  ]
}
```

**Dictionary:**
- "rookie", "rc", "rcs", "rookies"
- "1st bowman", "first bowman", "prospect"

#### 10. Autograph Indicator Extractor
```javascript
function extractAutoIndicators(query) {
  // Strategy: Keyword matching
  // 1. Terms: "autograph", "auto", "signed"
  // 2. Handle variations: "autos", "autographed"

  return [
    { indicator: "autograph", confidence: 95, matched: "auto" }
  ]
}
```

**Dictionary:**
- "auto", "autograph", "autos", "autographed", "signed"

#### 11. SP Indicator Extractor
```javascript
function extractSPIndicators(query) {
  // Strategy: Keyword matching for short prints
  // 1. Terms: "sp", "ssp", "variation", "var"
  // 2. Handle: "short print", "super short"

  return [
    { indicator: "sp", confidence: 90, matched: "sp" }
  ]
}
```

**Dictionary:**
- "sp", "ssp", "short print", "super short"
- "variation", "var", "variant"

#### 12. Misc Keyword Extractor
```javascript
function extractMiscKeywords(query) {
  // Strategy: Design/nickname terms
  // 1. Popular terms: "mojo", "cracked ice", "wave"
  // 2. Query series.name for these patterns
  // 3. Build from actual database content

  return [
    {
      keyword: "mojo",
      confidence: 80,
      matched: "mojo",
      related_series: [123, 456, 789]
    }
  ]
}
```

**Implementation Notes:**
- Build dictionary from series names in database
- Common terms: "mojo", "cracked ice", "ice", "wave", "atomic"
- Can be expanded over time

---

## Layer 2: Pattern Recognition Engine

### Pattern Types

```javascript
const PATTERN_TYPES = {
  SINGLE_TOKEN: 'single',
  TWO_TOKEN: 'two',
  THREE_TOKEN: 'three',
  FOUR_TOKEN_RICH: 'four_rich',
  COMPLEX: 'complex'
}

const SEARCH_STRATEGIES = {
  PLAYER_ONLY: 'player_only',
  CARD_NUMBER_ONLY: 'card_number_only',
  CARDS_WITH_PLAYER: 'cards_with_player',
  CARDS_WITH_MULTI_FILTERS: 'cards_with_multi_filters',
  SET_BROWSE: 'set_browse',
  TEAM_BROWSE: 'team_browse'
}
```

### Pattern Recognition Logic

```javascript
function recognizePattern(tokens) {
  // Count active tokens
  const activeTokens = []
  if (tokens.player?.length > 0) activeTokens.push('player')
  if (tokens.cardNumber?.length > 0) activeTokens.push('cardNumber')
  if (tokens.year?.length > 0) activeTokens.push('year')
  if (tokens.set?.length > 0) activeTokens.push('set')
  if (tokens.team?.length > 0) activeTokens.push('team')
  if (tokens.parallel?.length > 0) activeTokens.push('parallel')
  if (tokens.serial?.length > 0) activeTokens.push('serial')
  if (tokens.cardTypes?.length > 0) activeTokens.push('cardTypes')

  const tokenCount = activeTokens.length

  // Determine pattern type
  let patternType
  if (tokenCount === 1) patternType = PATTERN_TYPES.SINGLE_TOKEN
  else if (tokenCount === 2) patternType = PATTERN_TYPES.TWO_TOKEN
  else if (tokenCount === 3) patternType = PATTERN_TYPES.THREE_TOKEN
  else if (tokenCount === 4) patternType = PATTERN_TYPES.FOUR_TOKEN_RICH
  else patternType = PATTERN_TYPES.COMPLEX

  // Select search strategy
  const strategy = selectSearchStrategy(activeTokens, tokens)

  // Calculate confidence
  const confidence = calculatePatternConfidence(tokens)

  return {
    patternType,
    activeTokens,
    strategy,
    confidence,
    tokens  // Pass through for query builder
  }
}

function selectSearchStrategy(activeTokens, tokens) {
  // Priority order for ambiguous cases

  // If player is present, likely searching for cards
  if (activeTokens.includes('player')) {
    if (activeTokens.length === 1) return SEARCH_STRATEGIES.PLAYER_ONLY
    return SEARCH_STRATEGIES.CARDS_WITH_MULTI_FILTERS
  }

  // Card number only
  if (activeTokens.includes('cardNumber') && activeTokens.length === 1) {
    return SEARCH_STRATEGIES.CARD_NUMBER_ONLY
  }

  // Set browsing (set + maybe year/parallel)
  if (activeTokens.includes('set') && !activeTokens.includes('player')) {
    return SEARCH_STRATEGIES.SET_BROWSE
  }

  // Team browsing
  if (activeTokens.includes('team') && !activeTokens.includes('player')) {
    return SEARCH_STRATEGIES.TEAM_BROWSE
  }

  // Default: card search with all filters
  return SEARCH_STRATEGIES.CARDS_WITH_MULTI_FILTERS
}

function calculatePatternConfidence(tokens) {
  // Average confidence across all tokens
  let totalConfidence = 0
  let tokenCount = 0

  for (const [key, value] of Object.entries(tokens)) {
    if (Array.isArray(value) && value.length > 0) {
      totalConfidence += value[0].confidence || 50
      tokenCount++
    }
  }

  return tokenCount > 0 ? totalConfidence / tokenCount : 0
}
```

---

## Layer 3: Query Builder

### Core Principles
1. **Single Query**: One optimized SQL query instead of multiple separate queries
2. **Dynamic WHERE Clause**: Build filters based on active tokens
3. **FTS Indexes**: Use full-text search for text fields
4. **Covering Indexes**: Include all commonly selected columns
5. **Smart JOINs**: Only join tables needed for active filters

### Query Building Logic

```javascript
async function buildAndExecuteQuery(pattern, limit) {
  const { strategy, tokens } = pattern

  switch (strategy) {
    case SEARCH_STRATEGIES.PLAYER_ONLY:
      return await queryPlayerOnly(tokens, limit)

    case SEARCH_STRATEGIES.CARD_NUMBER_ONLY:
      return await queryCardNumberOnly(tokens, limit)

    case SEARCH_STRATEGIES.CARDS_WITH_MULTI_FILTERS:
      return await queryCardsWithFilters(tokens, limit)

    case SEARCH_STRATEGIES.SET_BROWSE:
      return await querySetBrowse(tokens, limit)

    case SEARCH_STRATEGIES.TEAM_BROWSE:
      return await queryTeamBrowse(tokens, limit)

    default:
      return await queryCardsWithFilters(tokens, limit)
  }
}

async function queryCardsWithFilters(tokens, limit) {
  // Build dynamic WHERE clauses
  const whereClauses = []
  const joinClauses = []
  let needPlayerJoin = false
  let needTeamJoin = false

  // Player filter
  if (tokens.player?.length > 0) {
    const playerIds = tokens.player.map(p => p.player_id).join(',')
    whereClauses.push(`p.player_id IN (${playerIds})`)
    needPlayerJoin = true
  }

  // Card number filter
  if (tokens.cardNumber?.length > 0) {
    const cardPatterns = tokens.cardNumber.map(cn =>
      `c.card_number LIKE '%${escapeSqlLike(cn.pattern)}%'`
    ).join(' OR ')
    whereClauses.push(`(${cardPatterns})`)
  }

  // Year filter
  if (tokens.year?.length > 0) {
    const years = tokens.year.map(y => y.year).join(',')
    whereClauses.push(`st.year IN (${years})`)
  }

  // Set filter
  if (tokens.set?.length > 0) {
    const setIds = tokens.set.map(s => s.set_id).join(',')
    whereClauses.push(`st.set_id IN (${setIds})`)
  }

  // Team filter
  if (tokens.team?.length > 0) {
    const teamIds = tokens.team.map(t => t.team_id).join(',')
    whereClauses.push(`t.team_id IN (${teamIds})`)
    needPlayerJoin = true
    needTeamJoin = true
  }

  // Parallel filter
  if (tokens.parallel?.length > 0) {
    const colorIds = tokens.parallel.map(p => p.color_id).join(',')
    whereClauses.push(`s.color IN (${colorIds})`)
  }

  // Serial number filter
  if (tokens.serial?.length > 0) {
    const printRun = tokens.serial[0].print_run
    whereClauses.push(`c.print_run = ${printRun}`)
  }

  // Card type filters
  if (tokens.cardTypes?.rookie) {
    whereClauses.push(`c.is_rookie = 1`)
  }
  if (tokens.cardTypes?.autograph) {
    whereClauses.push(`c.is_autograph = 1`)
  }
  if (tokens.cardTypes?.shortPrint) {
    whereClauses.push(`c.is_short_print = 1`)
  }

  // Build JOINs
  if (needPlayerJoin) {
    joinClauses.push(`
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
    `)
  }
  if (needTeamJoin) {
    joinClauses.push(`
      LEFT JOIN team t ON pt.team = t.team_id
    `)
  }

  // Build final query
  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : ''

  const query = `
    SELECT TOP ${limit}
      c.card_id,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.is_short_print,
      c.print_run,
      s.series_id,
      s.name as series_name,
      s.slug as series_slug,
      st.set_id,
      st.name as set_name,
      st.slug as set_slug,
      st.year as set_year,
      m.name as manufacturer_name,
      s.parallel_of_series,
      col.name as color_name,
      col.hex_value as color_hex,
      ${needPlayerJoin ? `
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(p.slug, '|', p.first_name, ' ', p.last_name)), '~') as players_slugs_data
      ` : `NULL as player_names, NULL as players_slugs_data`},
      ${needTeamJoin ? `
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''), '|', ISNULL(t.slug, ''))), '~') as teams_data
      ` : `NULL as teams_data`}
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    ${joinClauses.join('\n')}
    ${whereClause}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.is_short_print, c.print_run,
             s.series_id, s.name, s.slug, st.set_id, st.name, st.slug, st.year, m.name,
             s.parallel_of_series, col.name, col.hex_value
    ORDER BY
      ${tokens.player ? `STRING_AGG(p.card_count, ',') DESC,` : ''}
      st.year DESC,
      s.name,
      c.card_number
  `

  const results = await prisma.$queryRawUnsafe(query)
  return results.map(card => formatCardResult(card, 90))
}
```

---

## Layer 4: Fuzzy Matching (Optional Enhancement)

### When to Apply
- Zero results from exact matching
- Low confidence token extraction
- User explicitly requests ("did you mean...?")

### Techniques

#### 1. Levenshtein Distance (Typo Tolerance)
```javascript
function fuzzyPlayerMatch(query, threshold = 2) {
  // Find players with names within threshold edit distance
  // "Trou" → "Trout" (distance = 1)
  // "Beiber" → "Bieber" (distance = 1)
}
```

#### 2. Soundex/Metaphone (Phonetic Matching)
```javascript
function phoneticMatch(query) {
  // Match by pronunciation
  // "Guerrero" vs "Gerero" (same Soundex)
  // "O'Neill" vs "Oneal" (same Metaphone)
}
```

#### 3. Abbreviation Expansion
```javascript
function expandAbbreviations(query) {
  const dictionary = {
    'BC': 'Bowman Chrome',
    'TC': 'Topps Chrome',
    'UD': 'Upper Deck',
    'SP': 'SP Authentic',
    'SPx': 'SPx'
  }
  // Expand known abbreviations
}
```

---

## Layer 5: Result Ranking & Scoring

### Scoring Algorithm

```javascript
function calculateRelevanceScore(result, pattern, originalQuery) {
  let score = 0

  // Base score by result type
  const baseScores = {
    card: 80,
    player: 70,
    series: 60,
    team: 50
  }
  score += baseScores[result.type] || 50

  // Token match bonuses
  if (pattern.tokens.player) {
    // Player match
    score += 20

    // Exact name match
    if (result.player_names?.toLowerCase().includes(pattern.tokens.player[0].name.toLowerCase())) {
      score += 10
    }
  }

  if (pattern.tokens.cardNumber) {
    // Card number exact match
    if (result.card_number === pattern.tokens.cardNumber[0].pattern) {
      score += 25
    } else {
      score += 10
    }
  }

  if (pattern.tokens.year) {
    // Year match
    if (result.set_year === pattern.tokens.year[0].year) {
      score += 15
    }
  }

  if (pattern.tokens.set) {
    // Set exact match
    if (result.set_id === pattern.tokens.set[0].set_id) {
      score += 15
    }
  }

  // Card type bonuses
  if (pattern.tokens.cardTypes?.rookie && result.is_rookie) {
    score += 10
  }
  if (pattern.tokens.cardTypes?.autograph && result.is_autograph) {
    score += 10
  }

  // Rarity bonuses
  if (result.print_run && result.print_run < 100) {
    score += 5
  }

  // HOF player bonus
  if (result.is_hof) {
    score += 5
  }

  return score
}

function rankResults(results, pattern, originalQuery) {
  // Calculate scores
  const scored = results.map(result => ({
    ...result,
    relevanceScore: calculateRelevanceScore(result, pattern, originalQuery)
  }))

  // Sort by score descending
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
```

---

## Database Requirements

### Full-Text Search Indexes (CRITICAL for Performance)

```sql
-- 1. Player names (first, last, nickname)
CREATE FULLTEXT INDEX ON player(first_name, last_name, nick_name)
KEY INDEX PK_player WITH STOPLIST = SYSTEM;

-- 2. Team names
CREATE FULLTEXT INDEX ON team(name, city, mascot)
KEY INDEX PK_team WITH STOPLIST = SYSTEM;

-- 3. Set names
CREATE FULLTEXT INDEX ON [set](name)
KEY INDEX PK_set WITH STOPLIST = SYSTEM;

-- 4. Series names
CREATE FULLTEXT INDEX ON series(name)
KEY INDEX PK_series WITH STOPLIST = SYSTEM;

-- 5. Manufacturer names
CREATE FULLTEXT INDEX ON manufacturer(name)
KEY INDEX PK_manufacturer WITH STOPLIST = SYSTEM;
```

### Regular Indexes (Already exist, verify)

```sql
-- Verify these indexes exist
SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('card')
-- Should have indexes on: card_number, series, is_rookie, is_autograph, is_relic, is_short_print, print_run

SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('series')
-- Should have indexes on: set, color, parallel_of_series

SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('player')
-- Should have indexes on: card_count, is_hof
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Core token extraction working

**Tasks:**
1. Create new file: `server/routes/search-v2.js`
2. Implement token extractors:
   - ✅ Player name (reuse existing logic)
   - ✅ Card number (reuse existing logic)
   - ✅ Year
   - ✅ Rookie/auto/sp indicators
3. Create comprehensive test suite for token extraction
4. Set up database FTS indexes

**Deliverable:** Token extraction layer returns structured tokens for any query

---

### Phase 2: Pattern Recognition (Week 2)
**Goal:** Pattern engine identifies query types

**Tasks:**
1. Implement pattern recognition logic
2. Build search strategy selector
3. Test with all Issue #34 pattern examples
4. Add confidence scoring

**Deliverable:** Pattern engine correctly identifies all 57 pattern combinations from Issue #34

---

### Phase 3: Query Builder Core (Week 3)
**Goal:** Generate optimized SQL for common patterns

**Tasks:**
1. Implement CARDS_WITH_MULTI_FILTERS strategy
2. Build dynamic WHERE clause generator
3. Optimize JOINs based on active filters
4. Test performance with various token combinations

**Deliverable:** Can search cards with any combination of: player, year, set, team, card types

---

### Phase 4: Advanced Tokens (Week 4)
**Goal:** Complete remaining token types

**Tasks:**
1. Set name extractor
2. Team name extractor (dynamic, not hardcoded)
3. Parallel descriptor extractor
4. Serial number extractor
5. Insert name extractor
6. Misc keyword extractor

**Deliverable:** All 12 token types working

---

### Phase 5: Remaining Strategies (Week 5)
**Goal:** All search strategies implemented

**Tasks:**
1. PLAYER_ONLY strategy
2. CARD_NUMBER_ONLY strategy
3. SET_BROWSE strategy
4. TEAM_BROWSE strategy
5. Complex pattern handling (5+ tokens)

**Deliverable:** All search strategies working

---

### Phase 6: Fuzzy Matching & Polish (Week 6)
**Goal:** Handle edge cases, typos, ambiguity

**Tasks:**
1. Levenshtein distance for typos
2. Soundex for phonetic matching
3. Abbreviation expansion
4. "Did you mean...?" suggestions
5. Performance optimization

**Deliverable:** Fuzzy matching working, zero-result queries minimized

---

### Phase 7: Testing & Migration (Week 7-8)
**Goal:** Production-ready, comprehensive testing

**Tasks:**
1. Comprehensive integration tests
2. Performance benchmarking
3. Load testing
4. Migration plan (v1 → v2)
5. Rollback strategy
6. Documentation

**Deliverable:** Production-ready search v2

---

## Testing Strategy

### Unit Tests (Token Extractors)
```javascript
describe('extractPlayerNames', () => {
  it('should extract single last name', () => {
    const result = extractPlayerNames('trout')
    expect(result[0].name).toBe('Mike Trout')
  })

  it('should extract full name', () => {
    const result = extractPlayerNames('mike trout')
    expect(result[0].confidence).toBeGreaterThan(90)
  })

  it('should handle apostrophes', () => {
    const result = extractPlayerNames('o\'neill')
    expect(result[0].name).toContain('O\'Neill')
  })

  it('should handle missing apostrophes', () => {
    const result = extractPlayerNames('oneill')
    expect(result[0].name).toContain('O\'Neill')
  })
})
```

### Integration Tests (Pattern Recognition)
```javascript
describe('Pattern Recognition', () => {
  it('should recognize player + year pattern', () => {
    const tokens = extractAllTokens('trout 2020')
    const pattern = recognizePattern(tokens)
    expect(pattern.patternType).toBe('two')
    expect(pattern.activeTokens).toContain('player')
    expect(pattern.activeTokens).toContain('year')
  })
})
```

### E2E Tests (Full Search Flow)
```javascript
describe('Universal Search V2', () => {
  it('should handle order-agnostic queries', async () => {
    const result1 = await search('108 bieber')
    const result2 = await search('bieber 108')
    expect(result1[0].card_id).toBe(result2[0].card_id)
  })

  it('should handle 4-token rich patterns', async () => {
    const results = await search('trout 2020 topps chrome auto')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].player_names).toContain('Trout')
    expect(results[0].set_year).toBe(2020)
    expect(results[0].series_name).toContain('Topps Chrome')
    expect(results[0].is_autograph).toBe(true)
  })
})
```

### Issue #34 Test Suite
```javascript
// Test EVERY example from Issue #34
describe('Issue #34 Compliance', () => {
  // Single-token patterns
  test('player_name: "trout"', async () => { /* ... */ })
  test('card_number: "108"', async () => { /* ... */ })
  test('year: "2020"', async () => { /* ... */ })
  // ... all 11 single-token patterns

  // Two-token patterns
  test('player_name + card_number: "trout 108"', async () => { /* ... */ })
  test('player_name + year: "vlad 2019"', async () => { /* ... */ })
  // ... all 22 two-token patterns

  // Three-token patterns
  test('player + year + set: "trout 2020 topps"', async () => { /* ... */ })
  // ... all 18 three-token patterns

  // Four-token rich patterns
  test('player + year + set + type: "bieber 2020 topps chrome"', async () => { /* ... */ })
  // ... all 6 four-token patterns
})
```

---

## Performance Targets

| Query Complexity | Target Time | Max Acceptable |
|------------------|-------------|----------------|
| Single token | < 50ms | 100ms |
| Two tokens | < 100ms | 200ms |
| Three tokens | < 150ms | 300ms |
| Four+ tokens | < 200ms | 400ms |

**Optimization Techniques:**
1. FTS indexes (5-10x speedup)
2. Covering indexes (reduce I/O)
3. Query result caching (Redis)
4. Token extraction caching
5. Materialized search view

---

## Migration Strategy

### Parallel Deployment
1. **Week 1-7**: Develop search-v2 alongside existing search
2. **Week 8**: Beta testing with `/api/search/universal-v2` endpoint
3. **Week 9**: A/B testing (50% traffic to v2)
4. **Week 10**: Full cutover to v2
5. **Week 11**: Deprecate v1, update all client code

### Rollback Plan
- Keep v1 endpoint active for 2 weeks after cutover
- Monitor error rates, performance metrics
- One-click rollback if issues detected
- Client-side feature flag for instant fallback

---

## Success Metrics

### Coverage (Issue #34 Compliance)
- ✅ **Target:** 100% of pattern types supported
- ✅ **Target:** 95%+ of example queries work correctly

### Performance
- ✅ **Target:** <200ms for 95th percentile
- ✅ **Target:** <500ms for 99th percentile
- ✅ **Target:** Zero database timeouts

### Accuracy
- ✅ **Target:** 90%+ user satisfaction with top 3 results
- ✅ **Target:** <5% zero-result queries
- ✅ **Target:** Correct result in top 5 for 95% of queries

### Order Agnostic
- ✅ **Target:** 100% of patterns work regardless of token order
- ✅ **Test:** "trout 108" = "108 trout" = "trout #108"

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance regression | Medium | High | Comprehensive benchmarking, A/B testing |
| FTS index creation downtime | Low | Medium | Off-hours deployment, read replicas |
| Token extraction ambiguity | High | Medium | Confidence scoring, user feedback loop |
| Migration bugs | Medium | High | Parallel deployment, instant rollback |
| User confusion (v1 vs v2) | Low | Low | Seamless cutover, no UI changes |

---

## Next Steps

1. ✅ **Review this plan** - ensure alignment with vision
2. **Create feature branch:** `feature/universal-search-v2`
3. **Start Phase 1:** Token extraction foundation
4. **Set up tracking:** Weekly progress updates
5. **Deploy FTS indexes:** Non-breaking, immediate benefit

**Estimated Total Effort:** 6-8 weeks to production
**Resource Requirement:** 1 developer full-time
**Expected Impact:** Transform search from "good" to "world-class"

---

**Let's build this! 🚀**
