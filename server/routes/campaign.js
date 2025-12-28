const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const crypto = require('crypto')
const { authMiddleware } = require('../middleware/auth')
const { logApiError } = require('../utils/logger')
const { validateNumericId } = require('../utils/sql-security')

const router = express.Router()

/**
 * Campaign Tracking Routes
 * Tracks visits from QR code marketing campaigns and conversion metrics
 */

// GET /api/campaign/card/:cardId - Get card details for QR code landing page
router.get('/card/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params

    // Validate card ID
    let cardIdNum
    try {
      cardIdNum = validateNumericId(cardId, 'cardId')
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid card ID',
        message: 'Card ID must be a valid number'
      })
    }

    // Get card details with all related info
    // Images are stored directly on the card record (front_image_path/back_image_path)
    const results = await prisma.$queryRaw`
      SELECT
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        c.notes as card_notes,
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
        c.front_image_path as front_image_url,
        c.back_image_path as back_image_url,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(p.player_id, '|', p.first_name, '|', p.last_name, '|', t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as player_team_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_id = ${cardIdNum}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.notes,
               s.series_id, s.name, s.slug, st.set_id, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value,
               c.front_image_path, c.back_image_path
    `

    if (results.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'No card found with the specified ID'
      })
    }

    const card = results[0]

    // Get CYC Population count (how many users have this card)
    const populationResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT uc.[user]) as collectors,
             COUNT(*) as total_copies
      FROM user_card uc
      WHERE uc.card = ${cardIdNum}
      AND uc.sold_at IS NULL
    `

    // Get total user count for percentage calculation
    const userCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total_users
      FROM [user]
      WHERE is_active = 1
    `

    const collectors = Number(populationResult[0]?.collectors || 0)
    const totalCopies = Number(populationResult[0]?.total_copies || 0)
    const totalUsers = Number(userCountResult[0]?.total_users || 1)
    const collectorPercentage = ((collectors / totalUsers) * 100).toFixed(1)

    // Parse player/team data
    let playerTeams = []
    if (card.player_team_data) {
      const ptStrings = card.player_team_data.split('~')
      playerTeams = ptStrings.map(ptString => {
        const [player_id, first_name, last_name, team_id, team_name, abbreviation, primary_color, secondary_color] = ptString.split('|')
        return {
          player_id: player_id ? Number(player_id) : null,
          first_name: first_name || null,
          last_name: last_name || null,
          full_name: `${first_name || ''} ${last_name || ''}`.trim(),
          team: {
            team_id: team_id ? Number(team_id) : null,
            name: team_name || null,
            abbreviation: abbreviation || null,
            primary_color: primary_color || null,
            secondary_color: secondary_color || null
          }
        }
      }).filter(pt => pt.player_id)
    }

    // Extract unique teams for backwards compatibility
    const teams = playerTeams
      .map(pt => pt.team)
      .filter((team, idx, arr) => team.team_id && arr.findIndex(t => t.team_id === team.team_id) === idx)

    // Format response in a structure the AddCardModal can use
    const cardDetail = {
      card_id: Number(card.card_id),
      card_number: card.card_number,
      player_names: card.player_names,
      series_id: Number(card.series_id),
      series_name: card.series_name,
      series_slug: card.series_slug,
      set_id: card.set_id ? Number(card.set_id) : null,
      set_name: card.set_name,
      set_slug: card.set_slug,
      set_year: card.set_year ? Number(card.set_year) : null,
      manufacturer_name: card.manufacturer_name,
      is_rookie: !!card.is_rookie,
      is_autograph: !!card.is_autograph,
      is_relic: !!card.is_relic,
      is_parallel: !!card.parallel_of_series,
      color_name: card.color_name,
      color_hex: card.color_hex,
      print_run: card.print_run ? Number(card.print_run) : null,
      card_notes: card.card_notes,
      teams: teams,
      primary_team: teams[0] || null,
      front_image_url: card.front_image_url || null,
      back_image_url: card.back_image_url || null,
      // Community stats
      community_stats: {
        collectors: collectors,
        total_copies: totalCopies,
        collector_percentage: parseFloat(collectorPercentage)
      },
      // Player/team details for display
      player_teams: playerTeams,
      // Format for AddCardModal compatibility
      series_rel: {
        series_id: Number(card.series_id),
        name: card.series_name
      },
      card_player_teams: playerTeams.map(pt => ({
        player: {
          player_id: pt.player_id,
          name: pt.full_name,
          first_name: pt.first_name,
          last_name: pt.last_name
        },
        team: pt.team
      }))
    }

    res.json({
      success: true,
      card: cardDetail
    })

  } catch (error) {
    logApiError('/campaign/card/:cardId', 'GET', error, req)
    res.status(500).json({
      error: 'Failed to get card details',
      message: error.message
    })
  }
})

// GET /api/campaign/cards/:cardIds - Get multiple card details for QR code landing page
// cardIds should be comma-separated, optionally with price (e.g., "12345-54.95,67890,11111-5.50")
router.get('/cards/:cardIds', async (req, res) => {
  try {
    const { cardIds } = req.params

    // Parse card entries (format: "cardId" or "cardId-price")
    const cardEntries = cardIds.split(',').map(entry => entry.trim()).filter(entry => entry)

    if (cardEntries.length === 0) {
      return res.status(400).json({
        error: 'Invalid card IDs',
        message: 'At least one card ID is required'
      })
    }

    if (cardEntries.length > 20) {
      return res.status(400).json({
        error: 'Too many cards',
        message: 'Maximum of 20 cards allowed per request'
      })
    }

    // Parse each entry into { cardId, purchasePrice }
    const parsedEntries = []
    for (const entry of cardEntries) {
      // Check if entry contains a price (format: cardId-price)
      const hyphenIndex = entry.indexOf('-')
      let cardIdStr, priceStr

      if (hyphenIndex > 0) {
        cardIdStr = entry.substring(0, hyphenIndex)
        priceStr = entry.substring(hyphenIndex + 1)
      } else {
        cardIdStr = entry
        priceStr = null
      }

      // Validate card ID
      let cardIdNum
      try {
        cardIdNum = validateNumericId(cardIdStr, 'cardId')
      } catch (err) {
        return res.status(400).json({
          error: 'Invalid card ID',
          message: `Card ID "${cardIdStr}" must be a valid number`
        })
      }

      // Validate price if provided
      let purchasePrice = null
      if (priceStr) {
        purchasePrice = parseFloat(priceStr)
        if (isNaN(purchasePrice) || purchasePrice < 0) {
          return res.status(400).json({
            error: 'Invalid price',
            message: `Price "${priceStr}" for card ${cardIdStr} must be a valid positive number`
          })
        }
      }

      parsedEntries.push({ cardId: cardIdNum, purchasePrice })
    }

    // Get total user count for percentage calculation (only fetch once)
    const userCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total_users
      FROM [user]
      WHERE is_active = 1
    `
    const totalUsers = Number(userCountResult[0]?.total_users || 1)

    // Fetch all cards in parallel
    const cardPromises = parsedEntries.map(async ({ cardId: cardIdNum, purchasePrice }) => {
      // Get card details with all related info
      // Images are stored directly on the card record (front_image_path/back_image_path)
      const results = await prisma.$queryRaw`
        SELECT
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          c.notes as card_notes,
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
          c.front_image_path as front_image_url,
          c.back_image_path as back_image_url,
          STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
          STRING_AGG(CONVERT(varchar(max), CONCAT(p.player_id, '|', p.first_name, '|', p.last_name, '|', t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as player_team_data
        FROM card c
        JOIN series s ON c.series = s.series_id
        JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
        LEFT JOIN color col ON s.color = col.color_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE c.card_id = ${cardIdNum}
        GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run, c.notes,
                 s.series_id, s.name, s.slug, st.set_id, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value,
                 c.front_image_path, c.back_image_path
      `

      if (results.length === 0) {
        return { card_id: cardIdNum, error: 'Card not found' }
      }

      const card = results[0]

      // Get CYC Population count
      const populationResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT uc.[user]) as collectors,
               COUNT(*) as total_copies
        FROM user_card uc
        WHERE uc.card = ${cardIdNum}
        AND uc.sold_at IS NULL
      `

      const collectors = Number(populationResult[0]?.collectors || 0)
      const totalCopies = Number(populationResult[0]?.total_copies || 0)
      const collectorPercentage = ((collectors / totalUsers) * 100).toFixed(1)

      // Parse player/team data
      let playerTeams = []
      if (card.player_team_data) {
        const ptStrings = card.player_team_data.split('~')
        playerTeams = ptStrings.map(ptString => {
          const [player_id, first_name, last_name, team_id, team_name, abbreviation, primary_color, secondary_color] = ptString.split('|')
          return {
            player_id: player_id ? Number(player_id) : null,
            first_name: first_name || null,
            last_name: last_name || null,
            full_name: `${first_name || ''} ${last_name || ''}`.trim(),
            team: {
              team_id: team_id ? Number(team_id) : null,
              name: team_name || null,
              abbreviation: abbreviation || null,
              primary_color: primary_color || null,
              secondary_color: secondary_color || null
            }
          }
        }).filter(pt => pt.player_id)
      }

      // Extract unique teams
      const teams = playerTeams
        .map(pt => pt.team)
        .filter((team, idx, arr) => team.team_id && arr.findIndex(t => t.team_id === team.team_id) === idx)

      return {
        card_id: Number(card.card_id),
        card_number: card.card_number,
        player_names: card.player_names,
        series_id: Number(card.series_id),
        series_name: card.series_name,
        series_slug: card.series_slug,
        set_id: card.set_id ? Number(card.set_id) : null,
        set_name: card.set_name,
        set_slug: card.set_slug,
        set_year: card.set_year ? Number(card.set_year) : null,
        manufacturer_name: card.manufacturer_name,
        is_rookie: !!card.is_rookie,
        is_autograph: !!card.is_autograph,
        is_relic: !!card.is_relic,
        is_parallel: !!card.parallel_of_series,
        color_name: card.color_name,
        color_hex: card.color_hex,
        print_run: card.print_run ? Number(card.print_run) : null,
        card_notes: card.card_notes,
        purchase_price: purchasePrice, // Price from URL if provided
        teams: teams,
        primary_team: teams[0] || null,
        front_image_url: card.front_image_url || null,
        back_image_url: card.back_image_url || null,
        community_stats: {
          collectors: collectors,
          total_copies: totalCopies,
          collector_percentage: parseFloat(collectorPercentage)
        },
        player_teams: playerTeams,
        series_rel: {
          series_id: Number(card.series_id),
          name: card.series_name
        },
        card_player_teams: playerTeams.map(pt => ({
          player: {
            player_id: pt.player_id,
            name: pt.full_name,
            first_name: pt.first_name,
            last_name: pt.last_name
          },
          team: pt.team
        }))
      }
    })

    const cardResults = await Promise.all(cardPromises)

    // Separate successful cards from errors, maintaining order
    const cards = []
    const errors = []

    cardResults.forEach((result, idx) => {
      if (result.error) {
        errors.push({ card_id: parsedEntries[idx].cardId, error: result.error })
      } else {
        cards.push(result)
      }
    })

    res.json({
      success: true,
      cards: cards,
      errors: errors.length > 0 ? errors : undefined,
      total_requested: parsedEntries.length,
      total_found: cards.length
    })

  } catch (error) {
    logApiError('/campaign/cards/:cardIds', 'GET', error, req)
    res.status(500).json({
      error: 'Failed to get card details',
      message: error.message
    })
  }
})

// POST /api/campaign/visit - Track a landing page visit
router.post('/visit', async (req, res) => {
  try {
    const { campaign_code, session_id } = req.body

    if (!campaign_code) {
      return res.status(400).json({
        error: 'Campaign code is required'
      })
    }

    // Generate session ID if not provided
    const trackingSessionId = session_id || crypto.randomBytes(32).toString('hex')

    // Check if this session already exists for this campaign
    const existingVisit = await prisma.$queryRaw`
      SELECT visit_id FROM campaign_visit
      WHERE session_id = ${trackingSessionId}
      AND campaign_code = ${campaign_code}
    `

    if (existingVisit.length > 0) {
      // Session already tracked
      return res.json({
        success: true,
        session_id: trackingSessionId,
        visit_id: Number(existingVisit[0].visit_id),
        message: 'Visit already tracked'
      })
    }

    // Create new visit record
    await prisma.$executeRaw`
      INSERT INTO campaign_visit (
        campaign_code,
        session_id,
        ip_address,
        user_agent,
        referrer,
        visited_at
      )
      VALUES (
        ${campaign_code},
        ${trackingSessionId},
        ${req.ip || req.connection?.remoteAddress || null},
        ${req.get('User-Agent')?.substring(0, 500) || null},
        ${req.get('Referer')?.substring(0, 500) || null},
        GETDATE()
      )
    `

    // Get the newly created visit_id
    const result = await prisma.$queryRaw`
      SELECT CAST(SCOPE_IDENTITY() AS BIGINT) as visit_id
    `

    res.json({
      success: true,
      session_id: trackingSessionId,
      visit_id: Number(result[0].visit_id),
      message: 'Visit tracked successfully'
    })

  } catch (error) {
    logApiError('/campaign/visit', 'POST', error, req)
    res.status(500).json({
      error: 'Failed to track visit'
    })
  }
})

// POST /api/campaign/signup - Track when a visitor signs up
router.post('/signup', async (req, res) => {
  try {
    const { session_id, user_id, email } = req.body

    if (!session_id) {
      return res.status(400).json({
        error: 'Session ID is required'
      })
    }

    let actualUserId = user_id

    // If we have an email but no user_id, look up the user
    if (!actualUserId && email) {
      try {
        const userResult = await prisma.$queryRaw`
          SELECT user_id FROM [user] WHERE email = ${email}
        `
        if (userResult.length > 0) {
          actualUserId = userResult[0].user_id
        }
      } catch (lookupError) {
        console.error('Failed to lookup user by email:', lookupError)
      }
    }

    // Update the visit record with signup info
    const result = await prisma.$executeRaw`
      UPDATE campaign_visit
      SET signed_up_at = GETDATE(),
          user_id = ${actualUserId ? BigInt(actualUserId) : null}
      WHERE session_id = ${session_id}
      AND signed_up_at IS NULL
    `

    res.json({
      success: true,
      updated: result > 0,
      message: result > 0 ? 'Signup tracked successfully' : 'No matching visit found or already signed up'
    })

  } catch (error) {
    logApiError('/campaign/signup', 'POST', error, req)
    res.status(500).json({
      error: 'Failed to track signup'
    })
  }
})

// POST /api/campaign/first-card - Track when a user adds their first card
router.post('/first-card', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      })
    }

    // Update any campaign visits for this user that don't have first_card_at set
    const result = await prisma.$executeRaw`
      UPDATE campaign_visit
      SET first_card_at = GETDATE()
      WHERE user_id = ${BigInt(userId)}
      AND first_card_at IS NULL
    `

    res.json({
      success: true,
      updated: result > 0,
      message: result > 0 ? 'First card tracked successfully' : 'No matching campaign visit found or already tracked'
    })

  } catch (error) {
    logApiError('/campaign/first-card', 'POST', error, req)
    res.status(500).json({
      error: 'Failed to track first card'
    })
  }
})

// GET /api/campaign/stats - Get campaign analytics (admin only)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId

    // Check if user is admin
    const user = await prisma.$queryRaw`
      SELECT role FROM [user] WHERE user_id = ${BigInt(userId)}
    `

    if (!user[0] || user[0].role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      })
    }

    const { campaign_code, days = 30 } = req.query

    // Get overall stats
    let statsQuery
    if (campaign_code) {
      statsQuery = await prisma.$queryRaw`
        SELECT
          campaign_code,
          COUNT(*) as total_visits,
          COUNT(signed_up_at) as signups,
          COUNT(first_card_at) as first_cards,
          CAST(COUNT(signed_up_at) AS FLOAT) / NULLIF(COUNT(*), 0) * 100 as signup_rate,
          CAST(COUNT(first_card_at) AS FLOAT) / NULLIF(COUNT(signed_up_at), 0) * 100 as card_rate
        FROM campaign_visit
        WHERE campaign_code = ${campaign_code}
        AND visited_at >= DATEADD(day, -${parseInt(days)}, GETDATE())
        GROUP BY campaign_code
      `
    } else {
      statsQuery = await prisma.$queryRaw`
        SELECT
          campaign_code,
          COUNT(*) as total_visits,
          COUNT(signed_up_at) as signups,
          COUNT(first_card_at) as first_cards,
          CAST(COUNT(signed_up_at) AS FLOAT) / NULLIF(COUNT(*), 0) * 100 as signup_rate,
          CAST(COUNT(first_card_at) AS FLOAT) / NULLIF(COUNT(signed_up_at), 0) * 100 as card_rate
        FROM campaign_visit
        WHERE visited_at >= DATEADD(day, -${parseInt(days)}, GETDATE())
        GROUP BY campaign_code
        ORDER BY total_visits DESC
      `
    }

    // Get daily breakdown
    const dailyStats = await prisma.$queryRaw`
      SELECT
        CAST(visited_at AS DATE) as date,
        ${campaign_code ? prisma.sql`campaign_code,` : prisma.sql``}
        COUNT(*) as visits,
        COUNT(signed_up_at) as signups,
        COUNT(first_card_at) as first_cards
      FROM campaign_visit
      WHERE visited_at >= DATEADD(day, -${parseInt(days)}, GETDATE())
      ${campaign_code ? prisma.sql`AND campaign_code = ${campaign_code}` : prisma.sql``}
      GROUP BY CAST(visited_at AS DATE)${campaign_code ? prisma.sql`, campaign_code` : prisma.sql``}
      ORDER BY date DESC
    `

    // Convert BigInt to Number for JSON serialization
    const serializeStats = (stats) => stats.map(row => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    })

    res.json({
      campaigns: serializeStats(statsQuery),
      daily: serializeStats(dailyStats),
      period_days: parseInt(days)
    })

  } catch (error) {
    logApiError('/campaign/stats', 'GET', error, req)
    res.status(500).json({
      error: 'Failed to get campaign stats'
    })
  }
})

// GET /api/campaign/stats/:campaignCode - Get stats for a specific campaign
router.get('/stats/:campaignCode', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId
    const { campaignCode } = req.params
    const { days = 30 } = req.query

    // Check if user is admin
    const user = await prisma.$queryRaw`
      SELECT role FROM [user] WHERE user_id = ${BigInt(userId)}
    `

    if (!user[0] || user[0].role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      })
    }

    // Get campaign stats
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_visits,
        COUNT(signed_up_at) as signups,
        COUNT(first_card_at) as first_cards,
        MIN(visited_at) as first_visit,
        MAX(visited_at) as last_visit
      FROM campaign_visit
      WHERE campaign_code = ${campaignCode}
      AND visited_at >= DATEADD(day, -${parseInt(days)}, GETDATE())
    `

    // Get recent visitors
    const recentVisitors = await prisma.$queryRaw`
      SELECT TOP 50
        cv.visit_id,
        cv.visited_at,
        cv.signed_up_at,
        cv.first_card_at,
        u.username,
        u.email
      FROM campaign_visit cv
      LEFT JOIN [user] u ON cv.user_id = u.user_id
      WHERE cv.campaign_code = ${campaignCode}
      ORDER BY cv.visited_at DESC
    `

    // Serialize BigInt values
    const serializeRow = (row) => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    }

    res.json({
      campaign_code: campaignCode,
      stats: stats[0] ? serializeRow(stats[0]) : null,
      recent_visitors: recentVisitors.map(serializeRow),
      period_days: parseInt(days)
    })

  } catch (error) {
    logApiError('/campaign/stats/:campaignCode', 'GET', error, req)
    res.status(500).json({
      error: 'Failed to get campaign stats'
    })
  }
})

module.exports = router
