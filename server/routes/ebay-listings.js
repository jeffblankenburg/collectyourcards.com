const express = require('express')
const { getPrismaClient } = require('../utils/prisma-pool-manager')
const { authMiddleware } = require('../middleware/auth')
const { getValidAccessToken, ebayClient } = require('./ebay-auth')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

// POST /api/ebay/listings/create - Create a listing on eBay from a card
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { card_id } = req.body

    if (!card_id) {
      return res.status(400).json({
        error: 'Missing card_id',
        message: 'card_id is required'
      })
    }

    // Get valid eBay access token (auto-refreshes if needed)
    let accessToken
    try {
      accessToken = await getValidAccessToken(userId)
    } catch (error) {
      return res.status(401).json({
        error: 'eBay not connected',
        message: 'Please connect your eBay account first',
        code: 'EBAY_NOT_CONNECTED'
      })
    }

    // Fetch card data from database
    const cardQuery = `
      SELECT TOP 1
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        c.notes,
        s.name as series_name,
        s.series_id,
        col.name as color_name,
        st.name as set_name,
        st.year as set_year,
        st.slug as set_slug,
        m.name as manufacturer_name,
        p.first_name,
        p.last_name,
        t.name as team_name,
        t.abbreviation as team_abbr
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_id = ${parseInt(card_id)}
    `

    const cardResults = await prisma.$queryRawUnsafe(cardQuery)

    if (cardResults.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'The specified card does not exist'
      })
    }

    const card = cardResults[0]

    // Format card data for eBay listing
    const cardData = {
      year: card.set_year ? Number(card.set_year) : null,
      set: card.set_name || null,
      series: card.series_name || null,
      manufacturer: card.manufacturer_name || null,
      player: card.first_name && card.last_name
        ? `${card.first_name} ${card.last_name}`
        : null,
      team: card.team_name || null,
      cardNumber: card.card_number || null,
      parallel: card.color_name || null,
      printRun: card.print_run ? Number(card.print_run) : null,
      isRookie: Boolean(card.is_rookie),
      isAutograph: Boolean(card.is_autograph),
      isRelic: Boolean(card.is_relic),
      notes: card.notes || null
    }

    console.log('Creating eBay listing with card data:', cardData)

    // Create listing on eBay
    const listing = await ebayClient.createDraftListing(accessToken, cardData)

    console.log('eBay listing created:', listing)

    res.json({
      success: true,
      listing: {
        itemId: listing.itemId,
        title: listing.title,
        listingUrl: listing.listingUrl,
        editUrl: listing.editUrl
      },
      message: 'Listing created successfully! You can now add photos and set your price on eBay.'
    })

  } catch (error) {
    console.error('Create eBay listing error:', error)

    // Check for specific error types
    if (error.message.includes('No eBay account found')) {
      return res.status(401).json({
        error: 'eBay not connected',
        message: 'Please connect your eBay account first',
        code: 'EBAY_NOT_CONNECTED'
      })
    }

    res.status(500).json({
      error: 'Failed to create eBay listing',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// GET /api/ebay/listings/preview/:card_id - Preview what the listing will look like
router.get('/preview/:card_id', authMiddleware, async (req, res) => {
  try {
    const { card_id } = req.params

    // Fetch card data from database (same query as above)
    const cardQuery = `
      SELECT TOP 1
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        c.notes,
        s.name as series_name,
        s.series_id,
        col.name as color_name,
        st.name as set_name,
        st.year as set_year,
        st.slug as set_slug,
        m.name as manufacturer_name,
        p.first_name,
        p.last_name,
        t.name as team_name,
        t.abbreviation as team_abbr
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_id = ${parseInt(card_id)}
    `

    const cardResults = await prisma.$queryRawUnsafe(cardQuery)

    if (cardResults.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'The specified card does not exist'
      })
    }

    const card = cardResults[0]

    // Format card data
    const cardData = {
      year: card.set_year ? Number(card.set_year) : null,
      set: card.set_name || null,
      series: card.series_name || null,
      manufacturer: card.manufacturer_name || null,
      player: card.first_name && card.last_name
        ? `${card.first_name} ${card.last_name}`
        : null,
      team: card.team_name || null,
      cardNumber: card.card_number || null,
      parallel: card.color_name || null,
      printRun: card.print_run ? Number(card.print_run) : null,
      isRookie: Boolean(card.is_rookie),
      isAutograph: Boolean(card.is_autograph),
      isRelic: Boolean(card.is_relic),
      notes: card.notes || null
    }

    // Generate preview without creating actual listing
    const title = ebayClient.buildListingTitle(cardData)
    const description = ebayClient.buildListingDescription(cardData)

    res.json({
      success: true,
      preview: {
        title: title,
        description: description,
        cardData: cardData
      }
    })

  } catch (error) {
    console.error('Preview eBay listing error:', error)
    res.status(500).json({
      error: 'Failed to preview listing',
      message: error.message
    })
  }
})

module.exports = router
