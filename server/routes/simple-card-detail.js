const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { escapeString, escapeLikePattern, validateNumericId } = require('../utils/sql-security')

const router = express.Router()

// Database connection is handled by singleton
const databaseAvailable = true
console.log('Simple Card Detail API: Database connection established')

// Helper function to normalize player name for matching
function normalizePlayerName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim()
}

// GET /api/card/:seriesSlug/:cardNumber/:playerName - Get card details using simplified URL
// Optional query param: set_id - when provided, only match cards from that specific set
router.get('/:seriesSlug/:cardNumber/:playerName', async (req, res) => {
  if (!databaseAvailable) {
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'Card detail service is temporarily unavailable'
    })
  }

  try {
    const { seriesSlug, cardNumber, playerName } = req.params
    const { set_id } = req.query  // Optional set_id for disambiguation

    // Normalize the card number (uppercase, handle common variations)
    const normalizedCardNumber = cardNumber.toUpperCase()

    // Normalize player name for searching
    // Handle both single players and multiple players (with or without commas in the URL)
    const normalizedPlayerName = normalizePlayerName(playerName.replace(/-/g, ' '))

    // Split the player name into individual names for flexible matching
    // This allows matching cards with multiple players even if only one name is provided
    const playerNameParts = normalizedPlayerName.split(/\s+/).filter(part => part.length > 2) // Filter out short words like "jr"

    console.log(`Searching for card: ${normalizedCardNumber}, player: ${normalizedPlayerName}, series slug: ${seriesSlug}${set_id ? `, set_id: ${set_id}` : ''}`)

    // Validate and escape user inputs
    const safeCardNumber = escapeString(normalizedCardNumber)
    const safePlayerParts = playerNameParts.map(part => escapeString(part))

    // Build set filter clause with validation
    let setFilter = ''
    if (set_id) {
      try {
        const setIdNum = validateNumericId(set_id, 'set_id')
        setFilter = `AND st.set_id = ${setIdNum}`
      } catch (err) {
        // Invalid set_id - skip filter
      }
    }

    // Search for the card using comprehensive query with player name matching
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP 1
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        c.reference_user_card,
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
        front_photo.photo_url as front_image_url,
        back_photo.photo_url as back_image_url,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN user_card ref_uc ON c.reference_user_card = ref_uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON ref_uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      LEFT JOIN user_card_photo back_photo ON ref_uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_number = '${safeCardNumber}'
        AND s.slug = '${escapeString(seriesSlug)}'
        ${setFilter}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.reference_user_card,
               s.series_id, s.name, s.slug, st.set_id, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value,
               front_photo.photo_url, back_photo.photo_url
      HAVING ${safePlayerParts.length > 0 ?
        safePlayerParts.map(part =>
          `STRING_AGG(LOWER(CONCAT(p.first_name, ' ', p.last_name)), ', ') LIKE '%${part}%'`
        ).join(' AND ')
        : '1=1'}
    `)
    
    if (results.length === 0) {
      // If exact match fails, try fuzzy matching with series name starting with the slug pattern
      // But be more restrictive - only match series names that START with the expected pattern
      const fuzzyResults = await prisma.$queryRawUnsafe(`
        SELECT TOP 5
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          c.reference_user_card,
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
          front_photo.photo_url as front_image_url,
          back_photo.photo_url as back_image_url,
          STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
          STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
        FROM card c
        JOIN series s ON c.series = s.series_id
        JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
        LEFT JOIN color col ON s.color = col.color_id
        LEFT JOIN user_card ref_uc ON c.reference_user_card = ref_uc.user_card_id
        LEFT JOIN user_card_photo front_photo ON ref_uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
        LEFT JOIN user_card_photo back_photo ON ref_uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE (c.card_number LIKE '%${safeCardNumber}%' OR '${safeCardNumber}' LIKE '%' + c.card_number + '%')
          AND s.slug LIKE '${escapeString(seriesSlug)}%'
          ${setFilter}
        GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.reference_user_card,
                 s.series_id, s.name, s.slug, st.set_id, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value,
                 front_photo.photo_url, back_photo.photo_url
        HAVING ${safePlayerParts.length > 0 ?
        safePlayerParts.map(part =>
          `STRING_AGG(LOWER(CONCAT(p.first_name, ' ', p.last_name)), ', ') LIKE '%${part}%'`
        ).join(' AND ')
        : '1=1'}
        ORDER BY
          CASE
            WHEN c.card_number = '${safeCardNumber}' THEN 1
            WHEN c.card_number LIKE '${safeCardNumber}%' THEN 2
            ELSE 3
          END
      `)
      
      if (fuzzyResults.length === 0) {
        return res.status(404).json({
          error: 'Card not found',
          message: `No card found matching: ${normalizedCardNumber} for player: ${normalizedPlayerName} in series: ${seriesSlug}`,
          searchParams: { seriesSlug: seriesSlug, cardNumber: normalizedCardNumber, playerName: normalizedPlayerName }
        })
      }
      
      // Use the best fuzzy match
      results.push(fuzzyResults[0])
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
      // Use stored slugs from database
      set_slug: card.set_slug,
      series_slug: card.series_slug,
      // Create card slug for the complex URL format
      card_slug: `${card.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${card.player_names ? card.player_names.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') : 'unknown'}`,
      // Reference card images
      front_image_url: card.front_image_url || null,
      back_image_url: card.back_image_url || null
    }
    
    res.json({
      success: true,
      card: cardDetail,
      url_type: 'simple' // Indicate this came from the simple URL format
    })
    
  } catch (error) {
    console.error('Simple card detail error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

module.exports = router