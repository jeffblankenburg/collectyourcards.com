const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { escapeString, escapeLikePattern, validateNumericId } = require('../utils/sql-security')

const router = express.Router()

// Database connection is handled by singleton
const databaseAvailable = true
console.log('Card Detail API: Database connection established')

// Helper function to generate URL slug from name
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// GET /api/card-detail/:year/:setSlug/:seriesSlug/:cardSlug - Get card details
router.get('/:year/:setSlug/:seriesSlug/:cardSlug', async (req, res) => {
  if (!databaseAvailable) {
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'Card detail service is temporarily unavailable'
    })
  }

  try {
    const { year, setSlug, seriesSlug, cardSlug } = req.params
    
    // Parse card slug to extract card number and player name
    // Format: "c90a-ari-austin-riley" -> cardNumber="C90A-ARI", playerSlug="austin-riley"
    // The logic needs to account for team abbreviations in card numbers
    let cardNumber = ''
    let playerSlug = ''
    
    const parts = cardSlug.split('-')
    
    // Common team abbreviations that might appear in card numbers
    const teamAbbrevs = [
      'ari', 'atl', 'bal', 'bos', 'chc', 'chw', 'cin', 'cle', 'col', 'det',
      'hou', 'kc', 'laa', 'lad', 'mia', 'mil', 'min', 'nym', 'nyy', 'oak',
      'phi', 'pit', 'sd', 'sea', 'sf', 'stl', 'tb', 'tex', 'tor', 'was',
      'az', 'la', 'ny', 'sf', 'tb', 'wsh', 'aru'
    ]
    
    // Look for player name pattern - typically starts with a common first name
    const commonFirstNames = [
      'aaron', 'adam', 'adrian', 'albert', 'alex', 'andrew', 'anthony', 'austin',
      'ben', 'brandon', 'brian', 'carlos', 'chris', 'daniel', 'david', 'derek',
      'eric', 'fernando', 'frank', 'gary', 'george', 'harold', 'jacob', 'james',
      'jason', 'jeffrey', 'john', 'jose', 'josh', 'justin', 'kevin', 'kyle',
      'luis', 'marcus', 'mark', 'martin', 'matthew', 'max', 'michael', 'mike',
      'nelson', 'paul', 'pedro', 'peter', 'rafael', 'ramon', 'ricardo', 'richard',
      'robert', 'ronald', 'ryan', 'salvador', 'scott', 'sergio', 'stephen', 'steve',
      'thomas', 'tim', 'tony', 'trevor', 'tyler', 'victor', 'vladimir', 'william'
    ]
    
    // Find where player name starts
    let playerStartIndex = -1
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase()
      if (commonFirstNames.includes(part)) {
        playerStartIndex = i
        break
      }
    }
    
    if (playerStartIndex > 0) {
      // Found player name, everything before is card number
      cardNumber = parts.slice(0, playerStartIndex).join('-').toUpperCase()
      playerSlug = parts.slice(playerStartIndex).join('-')
    } else if (playerStartIndex === 0) {
      // Player name starts at beginning - this shouldn't happen with proper slugs
      // but handle gracefully
      cardNumber = parts[0].toUpperCase()
      playerSlug = parts.slice(1).join('-')
    } else {
      // No common first name found, use smarter heuristics
      // Look for likely break point between card number and player name
      let bestSplit = -1
      
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].toLowerCase()
        
        // Strong indicators this is likely a player name:
        // - Not a team abbreviation
        // - Not all digits
        // - Not a single letter
        // - Not common card number terms
        const cardTerms = ['rc', 'sp', 'auto', 'relic', 'gold', 'silver', 'black', 'red', 'blue', 'green']
        
        if (!teamAbbrevs.includes(part) && 
            !/^\d+$/.test(part) && 
            part.length > 1 &&
            !cardTerms.includes(part)) {
          bestSplit = i
          break
        }
      }
      
      if (bestSplit > 0) {
        cardNumber = parts.slice(0, bestSplit).join('-').toUpperCase()
        playerSlug = parts.slice(bestSplit).join('-')
      } else {
        // Final fallback - treat entire slug as card number
        cardNumber = cardSlug.toUpperCase()
        playerSlug = ''
      }
    }
    
    // Validate and escape user inputs
    const safeCardNumber = escapeString(cardNumber)
    const yearNum = validateNumericId(year, 'year')
    const safeSeriesSlug = escapeLikePattern(seriesSlug.replace(/-/g, ' '))

    // Search for the card using a comprehensive query
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP 1
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.series_id,
        s.name as series_name,
        st.set_id,
        st.name as set_name,
        st.year as set_year,
        m.name as manufacturer_name,
        s.parallel_of_series,
        col.name as color_name,
        col.hex_value as color_hex,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_number = '${safeCardNumber}'
        AND st.year = ${yearNum}
        AND s.name LIKE '%${safeSeriesSlug}%'
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.series_id, s.name, st.set_id, st.name, st.year, m.name, s.parallel_of_series, col.name, col.hex_value
    `)
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: `No card found matching: ${cardNumber} in ${year} ${seriesSlug}`,
        searchParams: { year, setSlug, seriesSlug, cardSlug, cardNumber, playerSlug }
      })
    }
    
    const card = results[0]
    // Get CYC Population count from user_card table
    const cardIdNum = Number(card.card_id)
    const populationResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as cyc_population
      FROM user_card uc
      WHERE uc.card = ${cardIdNum}
    `)
    
    const cycPopulation = populationResult[0]?.cyc_population || 0
    
    // Parse teams data
    let teams = []
    if (card.teams_data) {
      const teamStrings = card.teams_data.split('~')
      teams = teamStrings.map(teamString => {
        const [team_id, name, abbreviation, primary_color, secondary_color] = teamString.split('|')
        return {
          team_id: team_id ? Number(team_id) : null,
          name: name || null,
          abbreviation: abbreviation || null,
          primary_color: primary_color || null,
          secondary_color: secondary_color || null
        }
      }).filter(team => team.team_id)
    }
    
    // Format the response
    const cardDetail = {
      card_id: card.card_id.toString(),
      card_number: card.card_number,
      player_names: card.player_names,
      series_id: card.series_id.toString(),
      series_name: card.series_name,
      set_id: card.set_id ? Number(card.set_id) : null,
      set_name: card.set_name,
      set_year: card.set_year ? Number(card.set_year) : null,
      manufacturer_name: card.manufacturer_name,
      is_rookie: !!card.is_rookie,
      is_autograph: !!card.is_autograph,
      is_relic: !!card.is_relic,
      is_parallel: !!card.parallel_of_series,
      color_name: card.color_name,
      color_hex: card.color_hex,
      print_run: card.print_run ? Number(card.print_run) : null,
      cyc_population: Number(cycPopulation),
      teams: teams,
      primary_team: teams[0] || null,
      // Add navigation slugs
      set_slug: generateSlug(card.set_name),
      series_slug: generateSlug(card.series_name),
      card_slug: cardSlug
    }
    
    res.json({
      success: true,
      card: cardDetail
    })
    
  } catch (error) {
    console.error('Card detail error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router