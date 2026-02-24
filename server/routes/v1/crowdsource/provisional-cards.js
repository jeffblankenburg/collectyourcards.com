/**
 * Provisional Card Submission Endpoints
 *
 * Users submit cards, not entities. The system resolves entities.
 */

const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats } = require('./helpers')
const {
  autoResolve,
  parseMultiplePlayersTeams,
  findExistingCard
} = require('./auto-resolver')

const router = express.Router()

// =============================================================================
// SUBMIT PROVISIONAL CARD(S) - "Add a Card"
// =============================================================================

/**
 * POST /api/crowdsource/provisional-card
 *
 * Submit one or more provisional cards as a bundle.
 * Cards appear in user's collection immediately with "provisional" status.
 */
router.post('/provisional-card',
  authMiddleware,
  submissionLimiter,
  // Required fields
  body('cards').isArray({ min: 1, max: 100 }).withMessage('Must submit 1-100 cards'),
  body('cards.*.player_name').isString().isLength({ min: 1, max: 500 }).withMessage('Player name is required'),
  body('cards.*.set_name').isString().isLength({ min: 1, max: 255 }).withMessage('Set name is required'),
  body('cards.*.card_number').isString().isLength({ min: 1, max: 50 }).withMessage('Card number is required'),
  body('cards.*.year').isInt({ min: 1900, max: 2100 }).withMessage('Valid year is required'),
  // Optional fields
  body('cards.*.team_name').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('cards.*.series_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('cards.*.color_name').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('cards.*.print_run').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  body('cards.*.is_rookie').optional().isBoolean(),
  body('cards.*.is_autograph').optional().isBoolean(),
  body('cards.*.is_relic').optional().isBoolean(),
  body('cards.*.is_short_print').optional().isBoolean(),
  body('cards.*.notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  // User's copy-specific data
  body('cards.*.serial_number').optional({ nullable: true }).isInt({ min: 1 }),
  body('cards.*.purchase_price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('cards.*.user_location_id').optional({ nullable: true }).isInt({ min: 1 }),

  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg,
          details: errors.array()
        })
      }

      const userId = BigInt(req.user.userId)
      const { cards } = req.body
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the suggestion bundle
      const bundleResult = await prisma.$queryRaw`
        INSERT INTO suggestion_bundle (
          user_id, status, submitted_at, card_count
        )
        OUTPUT INSERTED.bundle_id
        VALUES (
          ${userId}, 'pending', GETDATE(), ${cards.length}
        )
      `
      const bundleId = bundleResult[0].bundle_id

      // Track summary for the bundle
      let requiresNewSet = false
      let requiresNewSeries = false
      let requiresNewPlayer = false
      let requiresNewTeam = false
      let autoResolvedCount = 0
      let needsReviewCount = 0

      const processedCards = []

      // Process each card
      for (const cardData of cards) {
        // Auto-resolve entities
        const resolution = await autoResolve({
          setNameRaw: cardData.set_name,
          seriesNameRaw: cardData.series_name || null,
          colorNameRaw: cardData.color_name || null,
          playerNameRaw: cardData.player_name,
          teamNameRaw: cardData.team_name || null,
          year: cardData.year
        })

        // Track what's needed
        if (resolution.requiresNewSet) requiresNewSet = true
        if (resolution.requiresNewSeries) requiresNewSeries = true
        if (resolution.requiresNewPlayer) requiresNewPlayer = true
        if (resolution.requiresNewTeam) requiresNewTeam = true

        const needsReview = !resolution.fullyResolved
        if (needsReview) {
          needsReviewCount++
        } else {
          autoResolvedCount++
        }

        // Create provisional card record
        const provisionalCardResult = await prisma.$queryRaw`
          INSERT INTO provisional_card (
            bundle_id, user_id,
            set_name_raw, series_name_raw, year, card_number,
            is_rookie, is_autograph, is_relic, is_short_print,
            color_name_raw, print_run, user_notes,
            resolved_set_id, resolved_series_id, resolved_color_id,
            set_match_confidence, series_match_confidence,
            status, auto_resolved, needs_review, created_at
          )
          OUTPUT INSERTED.provisional_card_id
          VALUES (
            ${bundleId}, ${userId},
            ${cardData.set_name}, ${cardData.series_name || null}, ${cardData.year}, ${cardData.card_number},
            ${cardData.is_rookie || false}, ${cardData.is_autograph || false},
            ${cardData.is_relic || false}, ${cardData.is_short_print || false},
            ${cardData.color_name || null}, ${cardData.print_run || null}, ${cardData.notes || null},
            ${resolution.set?.id || null}, ${resolution.series?.id || null}, ${resolution.color?.id || null},
            ${resolution.set?.confidence || null}, ${resolution.series?.confidence || null},
            ${needsReview ? 'pending' : 'auto_resolved'}, ${!needsReview}, ${needsReview}, GETDATE()
          )
        `
        const provisionalCardId = provisionalCardResult[0].provisional_card_id

        // Create provisional card player records
        const playerEntries = parseMultiplePlayersTeams(
          cardData.player_name,
          cardData.team_name || ''
        )

        for (let i = 0; i < playerEntries.length; i++) {
          const playerEntry = playerEntries[i]
          const resolvedPlayer = resolution.players[i] || {}

          await prisma.$executeRaw`
            INSERT INTO provisional_card_player (
              provisional_card_id, position,
              player_name_raw, team_name_raw,
              resolved_player_id, resolved_team_id, resolved_player_team_id,
              match_confidence, auto_matched, needs_review
            )
            VALUES (
              ${provisionalCardId}, ${i + 1},
              ${playerEntry.playerName}, ${playerEntry.teamName || null},
              ${resolvedPlayer.playerId || null}, ${resolvedPlayer.teamId || null}, ${resolvedPlayer.playerTeamId || null},
              ${resolvedPlayer.confidence || null}, ${resolvedPlayer.confidence >= 0.95},
              ${!resolvedPlayer.playerId || resolvedPlayer.confidence < 0.95}
            )
          `
        }

        // Check if card already exists in database (for auto-resolved cards)
        let resolvedCardId = null
        if (resolution.fullyResolved && resolution.series?.id) {
          const playerTeamIds = resolution.players
            .filter(p => p.playerTeamId)
            .map(p => p.playerTeamId)

          const existingCard = await findExistingCard(
            resolution.series.id,
            cardData.card_number,
            playerTeamIds
          )

          if (existingCard) {
            resolvedCardId = existingCard.cardId

            // Update provisional card with resolved card ID
            await prisma.$executeRaw`
              UPDATE provisional_card
              SET resolved_card_id = ${resolvedCardId},
                  status = 'auto_resolved',
                  resolved_at = GETDATE()
              WHERE provisional_card_id = ${provisionalCardId}
            `
          }
        }

        // Create user_card entry (provisional or linked to real card)
        // Note: user_card table has triggers, so we can't use OUTPUT INSERTED
        // Instead, we insert and then query back by provisional_card_id
        await prisma.$executeRaw`
          INSERT INTO user_card (
            [user], card, serial_number, purchase_price,
            user_location, notes, is_provisional, provisional_card_id, created
          )
          VALUES (
            ${userId},
            ${resolvedCardId},
            ${cardData.serial_number || null},
            ${cardData.purchase_price || null},
            ${cardData.user_location_id || null},
            ${cardData.notes || null},
            ${resolvedCardId ? 0 : 1},
            ${resolvedCardId ? null : provisionalCardId},
            GETDATE()
          )
        `

        // Get the newly created user_card_id by querying back
        let userCardId = null
        if (!resolvedCardId && provisionalCardId) {
          const userCardResult = await prisma.$queryRaw`
            SELECT user_card_id FROM user_card
            WHERE provisional_card_id = ${provisionalCardId}
          `
          if (userCardResult.length > 0) {
            userCardId = Number(userCardResult[0].user_card_id)
          }
        } else {
          // For resolved cards, get the most recent user_card for this user/card
          const userCardResult = await prisma.$queryRaw`
            SELECT TOP 1 user_card_id FROM user_card
            WHERE [user] = ${userId}
              AND card = ${resolvedCardId}
            ORDER BY created DESC
          `
          if (userCardResult.length > 0) {
            userCardId = Number(userCardResult[0].user_card_id)
          }
        }

        processedCards.push({
          provisional_card_id: Number(provisionalCardId),
          user_card_id: userCardId ? Number(userCardId) : null,
          resolved_card_id: resolvedCardId ? Number(resolvedCardId) : null,
          status: resolvedCardId ? 'linked' : (needsReview ? 'pending' : 'auto_resolved'),
          resolution_summary: {
            set: resolution.set ? { name: resolution.set.name, confidence: resolution.set.confidence } : null,
            series: resolution.series ? { name: resolution.series.name, confidence: resolution.series.confidence } : null,
            players: resolution.players.map(p => ({
              name: p.playerName || p.rawPlayerName,
              matched: !!p.playerId,
              confidence: p.confidence
            })),
            needs_review: needsReview
          }
        })
      }

      // Update bundle summary
      await prisma.$executeRaw`
        UPDATE suggestion_bundle
        SET requires_new_set = ${requiresNewSet ? 1 : 0},
            requires_new_series = ${requiresNewSeries ? 1 : 0},
            requires_new_player = ${requiresNewPlayer ? 1 : 0},
            requires_new_team = ${requiresNewTeam ? 1 : 0},
            auto_resolved_count = ${autoResolvedCount},
            needs_review_count = ${needsReviewCount},
            status = ${needsReviewCount === 0 ? 'auto_resolved' : 'pending'}
        WHERE bundle_id = ${bundleId}
      `

      // Update contributor stats
      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET bundle_submissions = bundle_submissions + 1,
            provisional_cards_submitted = provisional_cards_submitted + ${cards.length},
            provisional_cards_resolved = provisional_cards_resolved + ${autoResolvedCount},
            total_submissions = total_submissions + 1,
            last_submission_at = GETDATE()
        WHERE user_id = ${userId}
      `

      res.status(201).json({
        success: true,
        message: needsReviewCount > 0
          ? `${cards.length} card(s) submitted. ${autoResolvedCount} auto-resolved, ${needsReviewCount} pending review.`
          : `${cards.length} card(s) added to your collection!`,
        bundle_id: Number(bundleId),
        summary: {
          total: cards.length,
          auto_resolved: autoResolvedCount,
          needs_review: needsReviewCount,
          requires_new_set: requiresNewSet,
          requires_new_series: requiresNewSeries,
          requires_new_player: requiresNewPlayer,
          requires_new_team: requiresNewTeam
        },
        cards: processedCards
      })

    } catch (error) {
      console.error('Error submitting provisional card(s):', error)
      console.error('Error stack:', error.stack)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit card(s)',
        debug: process.env.NODE_ENV !== 'production' ? error.message : undefined
      })
    }
  }
)

// =============================================================================
// GET USER'S PROVISIONAL CARDS
// =============================================================================

/**
 * GET /api/crowdsource/my-provisional-cards
 *
 * Get all provisional cards for the current user
 */
router.get('/my-provisional-cards',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)

      const provisionalCards = await prisma.$queryRaw`
        SELECT
          pc.provisional_card_id,
          pc.bundle_id,
          pc.set_name_raw,
          pc.series_name_raw,
          pc.year,
          pc.card_number,
          pc.is_rookie,
          pc.is_autograph,
          pc.is_relic,
          pc.is_short_print,
          pc.color_name_raw,
          pc.print_run,
          pc.user_notes,
          pc.status,
          pc.auto_resolved,
          pc.needs_review,
          pc.resolved_card_id,
          pc.resolved_set_id,
          pc.resolved_series_id,
          pc.created_at,
          pc.resolved_at,
          s.name AS resolved_set_name,
          ser.name AS resolved_series_name,
          uc.user_card_id,
          uc.serial_number,
          uc.purchase_price
        FROM provisional_card pc
        LEFT JOIN [set] s ON pc.resolved_set_id = s.set_id
        LEFT JOIN series ser ON pc.resolved_series_id = ser.series_id
        LEFT JOIN user_card uc ON uc.provisional_card_id = pc.provisional_card_id
        WHERE pc.user_id = ${userId}
        ORDER BY pc.created_at DESC
      `

      // Get players for each card
      const cardIds = provisionalCards.map(c => Number(c.provisional_card_id))

      let players = []
      if (cardIds.length > 0) {
        // Build IN clause safely
        const cardIdList = cardIds.join(',')
        players = await prisma.$queryRawUnsafe(`
          SELECT
            pcp.provisional_card_id,
            pcp.position,
            pcp.player_name_raw,
            pcp.team_name_raw,
            pcp.resolved_player_id,
            pcp.resolved_team_id,
            pcp.match_confidence,
            pcp.auto_matched,
            pcp.needs_review,
            p.first_name,
            p.last_name,
            t.name AS resolved_team_name
          FROM provisional_card_player pcp
          LEFT JOIN player p ON pcp.resolved_player_id = p.player_id
          LEFT JOIN team t ON pcp.resolved_team_id = t.team_Id
          WHERE pcp.provisional_card_id IN (${cardIdList})
          ORDER BY pcp.provisional_card_id, pcp.position
        `)
      }

      // Group players by card
      const playersByCard = {}
      for (const player of players) {
        const cardId = Number(player.provisional_card_id)
        if (!playersByCard[cardId]) {
          playersByCard[cardId] = []
        }
        playersByCard[cardId].push({
          position: player.position,
          player_name_raw: player.player_name_raw,
          team_name_raw: player.team_name_raw,
          resolved_player_id: player.resolved_player_id ? Number(player.resolved_player_id) : null,
          resolved_player_name: player.first_name ? `${player.first_name} ${player.last_name}` : null,
          resolved_team_id: player.resolved_team_id,
          resolved_team_name: player.resolved_team_name,
          match_confidence: player.match_confidence ? Number(player.match_confidence) : null,
          auto_matched: player.auto_matched,
          needs_review: player.needs_review
        })
      }

      const result = provisionalCards.map(card => ({
        provisional_card_id: Number(card.provisional_card_id),
        bundle_id: Number(card.bundle_id),
        set_name_raw: card.set_name_raw,
        series_name_raw: card.series_name_raw,
        year: card.year,
        card_number: card.card_number,
        is_rookie: card.is_rookie,
        is_autograph: card.is_autograph,
        is_relic: card.is_relic,
        is_short_print: card.is_short_print,
        color_name_raw: card.color_name_raw,
        print_run: card.print_run,
        user_notes: card.user_notes,
        status: card.status,
        auto_resolved: card.auto_resolved,
        needs_review: card.needs_review,
        resolved_card_id: card.resolved_card_id ? Number(card.resolved_card_id) : null,
        resolved_set_id: card.resolved_set_id,
        resolved_set_name: card.resolved_set_name,
        resolved_series_id: card.resolved_series_id ? Number(card.resolved_series_id) : null,
        resolved_series_name: card.resolved_series_name,
        created_at: card.created_at,
        resolved_at: card.resolved_at,
        user_card_id: card.user_card_id ? Number(card.user_card_id) : null,
        serial_number: card.serial_number,
        purchase_price: card.purchase_price ? Number(card.purchase_price) : null,
        players: playersByCard[Number(card.provisional_card_id)] || []
      }))

      res.json({
        success: true,
        count: result.length,
        cards: result
      })

    } catch (error) {
      console.error('Error fetching provisional cards:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch provisional cards'
      })
    }
  }
)

// =============================================================================
// GET USER'S BUNDLES
// =============================================================================

/**
 * GET /api/crowdsource/my-bundles
 *
 * Get all submission bundles for the current user
 */
router.get('/my-bundles',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)

      const bundles = await prisma.$queryRaw`
        SELECT
          sb.bundle_id,
          sb.status,
          sb.submitted_at,
          sb.reviewed_at,
          sb.review_notes,
          sb.requires_new_set,
          sb.requires_new_series,
          sb.requires_new_player,
          sb.requires_new_team,
          sb.card_count,
          sb.auto_resolved_count,
          sb.needs_review_count,
          u.name AS reviewer_name
        FROM suggestion_bundle sb
        LEFT JOIN [user] u ON sb.reviewed_by = u.user_id
        WHERE sb.user_id = ${userId}
        ORDER BY sb.submitted_at DESC
      `

      res.json({
        success: true,
        count: bundles.length,
        bundles: bundles.map(b => ({
          bundle_id: Number(b.bundle_id),
          status: b.status,
          submitted_at: b.submitted_at,
          reviewed_at: b.reviewed_at,
          review_notes: b.review_notes,
          requires_new_set: b.requires_new_set,
          requires_new_series: b.requires_new_series,
          requires_new_player: b.requires_new_player,
          requires_new_team: b.requires_new_team,
          card_count: b.card_count,
          auto_resolved_count: b.auto_resolved_count,
          needs_review_count: b.needs_review_count,
          reviewer_name: b.reviewer_name
        }))
      })

    } catch (error) {
      console.error('Error fetching bundles:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch bundles'
      })
    }
  }
)

module.exports = router
