/**
 * Admin Review Endpoints for Provisional Card System
 *
 * Provides diff-view review, approval, rejection, and entity creation
 * for provisional card bundles.
 */

const express = require('express')
const { body, param, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, adminCheck } = require('./middleware')
const { updateContributorStatsOnReview } = require('./helpers')

const router = express.Router()

// =============================================================================
// ADMIN: GET PENDING BUNDLES QUEUE
// =============================================================================

/**
 * GET /api/crowdsource/admin/bundles
 *
 * Get all bundles pending review with summary info
 */
router.get('/admin/bundles',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const { status = 'pending' } = req.query

      const bundles = await prisma.$queryRaw`
        SELECT
          sb.bundle_id,
          sb.user_id,
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
          u.name AS submitter_name,
          u.email AS submitter_email,
          reviewer.name AS reviewer_name
        FROM suggestion_bundle sb
        JOIN [user] u ON sb.user_id = u.user_id
        LEFT JOIN [user] reviewer ON sb.reviewed_by = reviewer.user_id
        WHERE sb.status = ${status}
        ORDER BY sb.submitted_at ASC
      `

      res.json({
        success: true,
        count: bundles.length,
        bundles: bundles.map(b => ({
          bundle_id: Number(b.bundle_id),
          user_id: Number(b.user_id),
          submitter_name: b.submitter_name,
          submitter_email: b.submitter_email,
          status: b.status,
          submitted_at: b.submitted_at,
          reviewed_at: b.reviewed_at,
          review_notes: b.review_notes,
          reviewer_name: b.reviewer_name,
          requires_new_set: b.requires_new_set,
          requires_new_series: b.requires_new_series,
          requires_new_player: b.requires_new_player,
          requires_new_team: b.requires_new_team,
          card_count: b.card_count,
          auto_resolved_count: b.auto_resolved_count,
          needs_review_count: b.needs_review_count
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

// =============================================================================
// ADMIN: GET BUNDLE DETAILS (DIFF VIEW)
// =============================================================================

/**
 * GET /api/crowdsource/admin/bundles/:bundleId
 *
 * Get detailed diff view of a bundle for admin review
 */
router.get('/admin/bundles/:bundleId',
  authMiddleware,
  adminCheck,
  param('bundleId').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { bundleId } = req.params

      // Get bundle info
      const bundles = await prisma.$queryRaw`
        SELECT
          sb.*,
          u.name AS submitter_name,
          u.email AS submitter_email,
          reviewer.name AS reviewer_name
        FROM suggestion_bundle sb
        JOIN [user] u ON sb.user_id = u.user_id
        LEFT JOIN [user] reviewer ON sb.reviewed_by = reviewer.user_id
        WHERE sb.bundle_id = ${parseInt(bundleId)}
      `

      if (bundles.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bundle not found'
        })
      }

      const bundle = bundles[0]

      // Get all provisional cards in this bundle
      const provisionalCards = await prisma.$queryRaw`
        SELECT
          pc.*,
          s.name AS resolved_set_name,
          s.year AS resolved_set_year,
          ser.name AS resolved_series_name,
          c.name AS resolved_color_name,
          card.card_id AS existing_card_id,
          card.card_number AS existing_card_number
        FROM provisional_card pc
        LEFT JOIN [set] s ON pc.resolved_set_id = s.set_id
        LEFT JOIN series ser ON pc.resolved_series_id = ser.series_id
        LEFT JOIN color c ON pc.resolved_color_id = c.color_id
        LEFT JOIN card ON pc.resolved_card_id = card.card_id
        WHERE pc.bundle_id = ${parseInt(bundleId)}
        ORDER BY pc.provisional_card_id
      `

      // Get players for each card
      const cardIds = provisionalCards.map(c => Number(c.provisional_card_id))
      let players = []

      if (cardIds.length > 0) {
        const cardIdList = cardIds.join(',')
        players = await prisma.$queryRawUnsafe(`
          SELECT
            pcp.*,
            p.first_name,
            p.last_name,
            p.player_id AS matched_player_id,
            t.name AS resolved_team_name,
            t.team_Id AS matched_team_id
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
          provisional_card_player_id: Number(player.provisional_card_player_id),
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

      // Build diff view for each card
      const cards = provisionalCards.map(card => ({
        provisional_card_id: Number(card.provisional_card_id),
        status: card.status,
        needs_review: card.needs_review,
        auto_resolved: card.auto_resolved,

        // User's raw input
        input: {
          set_name: card.set_name_raw,
          series_name: card.series_name_raw,
          year: card.year,
          card_number: card.card_number,
          color_name: card.color_name_raw,
          print_run: card.print_run,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          is_short_print: card.is_short_print,
          notes: card.user_notes
        },

        // Resolution results
        resolution: {
          set: card.resolved_set_id ? {
            id: card.resolved_set_id,
            name: card.resolved_set_name,
            year: card.resolved_set_year,
            confidence: card.set_match_confidence ? Number(card.set_match_confidence) : null,
            matched: true
          } : {
            matched: false,
            needs_creation: true
          },

          series: card.resolved_series_id ? {
            id: Number(card.resolved_series_id),
            name: card.resolved_series_name,
            confidence: card.series_match_confidence ? Number(card.series_match_confidence) : null,
            matched: true
          } : {
            matched: false,
            needs_creation: !!card.series_name_raw
          },

          color: card.resolved_color_id ? {
            id: card.resolved_color_id,
            name: card.resolved_color_name,
            matched: true
          } : {
            matched: false,
            needs_creation: !!card.color_name_raw
          },

          existing_card: card.resolved_card_id ? {
            card_id: Number(card.resolved_card_id),
            card_number: card.existing_card_number
          } : null
        },

        // Players on this card
        players: playersByCard[Number(card.provisional_card_id)] || []
      }))

      res.json({
        success: true,
        bundle: {
          bundle_id: Number(bundle.bundle_id),
          user_id: Number(bundle.user_id),
          submitter_name: bundle.submitter_name,
          submitter_email: bundle.submitter_email,
          status: bundle.status,
          submitted_at: bundle.submitted_at,
          reviewed_at: bundle.reviewed_at,
          review_notes: bundle.review_notes,
          reviewer_name: bundle.reviewer_name,
          requires_new_set: bundle.requires_new_set,
          requires_new_series: bundle.requires_new_series,
          requires_new_player: bundle.requires_new_player,
          requires_new_team: bundle.requires_new_team,
          card_count: bundle.card_count,
          auto_resolved_count: bundle.auto_resolved_count,
          needs_review_count: bundle.needs_review_count
        },
        cards
      })

    } catch (error) {
      console.error('Error fetching bundle details:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch bundle details'
      })
    }
  }
)

// =============================================================================
// ADMIN: APPROVE BUNDLE
// =============================================================================

/**
 * POST /api/crowdsource/admin/bundles/:bundleId/approve
 *
 * Approve a bundle and create all necessary cards
 */
router.post('/admin/bundles/:bundleId/approve',
  authMiddleware,
  adminCheck,
  param('bundleId').isInt({ min: 1 }),
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const { bundleId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get bundle
      const bundles = await prisma.$queryRaw`
        SELECT * FROM suggestion_bundle WHERE bundle_id = ${parseInt(bundleId)}
      `

      if (bundles.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bundle not found'
        })
      }

      const bundle = bundles[0]

      if (bundle.status !== 'pending') {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Bundle is already ${bundle.status}`
        })
      }

      // Get all provisional cards that need processing
      const provisionalCards = await prisma.$queryRaw`
        SELECT * FROM provisional_card
        WHERE bundle_id = ${parseInt(bundleId)}
          AND status IN ('pending', 'auto_resolved')
      `

      const results = {
        cards_created: 0,
        cards_linked: 0,
        user_cards_updated: 0,
        errors: []
      }

      for (const pc of provisionalCards) {
        try {
          // Skip if already has a resolved card
          if (pc.resolved_card_id) {
            // Just update the user_card to link properly
            await prisma.$executeRaw`
              UPDATE user_card
              SET card = ${pc.resolved_card_id},
                  is_provisional = 0,
                  provisional_card_id = NULL
              WHERE provisional_card_id = ${pc.provisional_card_id}
            `
            results.cards_linked++
            results.user_cards_updated++
            continue
          }

          // Check if we have resolved set and series
          if (!pc.resolved_set_id || !pc.resolved_series_id) {
            results.errors.push({
              provisional_card_id: Number(pc.provisional_card_id),
              error: 'Missing set or series resolution'
            })
            continue
          }

          // Get players for this card
          const players = await prisma.$queryRaw`
            SELECT * FROM provisional_card_player
            WHERE provisional_card_id = ${pc.provisional_card_id}
            ORDER BY position
          `

          // Check all players are resolved
          const unresolvedPlayers = players.filter(p => !p.resolved_player_team_id && !p.resolved_player_id)
          if (unresolvedPlayers.length > 0) {
            results.errors.push({
              provisional_card_id: Number(pc.provisional_card_id),
              error: `${unresolvedPlayers.length} player(s) not resolved`
            })
            continue
          }

          // Create the card
          // Note: card table has triggers, so we can't use OUTPUT INSERTED
          // Note: card_number_indexed is a computed column, so we can't insert into it
          const cardNumber = pc.card_number || ''
          const sortOrder = parseInt(cardNumber) || 0

          await prisma.$executeRaw`
            INSERT INTO card (
              series, card_number,
              is_rookie, is_autograph, is_relic, is_short_print,
              color, print_run, notes, created, sort_order
            )
            VALUES (
              ${pc.resolved_series_id},
              ${cardNumber},
              ${pc.is_rookie || false}, ${pc.is_autograph || false}, ${pc.is_relic || false}, ${pc.is_short_print || false},
              ${pc.resolved_color_id},
              ${pc.print_run},
              ${pc.user_notes},
              GETDATE(),
              ${sortOrder}
            )
          `

          // Query back to get the new card ID
          const newCardResult = await prisma.$queryRaw`
            SELECT TOP 1 card_id FROM card
            WHERE series = ${pc.resolved_series_id}
              AND card_number = ${cardNumber}
            ORDER BY card_id DESC
          `
          const newCardId = newCardResult[0].card_id

          // Create card_player_team links
          for (const player of players) {
            if (player.resolved_player_team_id) {
              await prisma.$executeRaw`
                INSERT INTO card_player_team (card, player_team, created)
                VALUES (${newCardId}, ${player.resolved_player_team_id}, GETDATE())
              `
            }
          }

          // Update provisional card with resolved card ID
          await prisma.$executeRaw`
            UPDATE provisional_card
            SET resolved_card_id = ${newCardId},
                status = 'approved',
                resolved_at = GETDATE()
            WHERE provisional_card_id = ${pc.provisional_card_id}
          `

          // Update user_card to link to real card
          const userCardsUpdated = await prisma.$executeRaw`
            UPDATE user_card
            SET card = ${newCardId},
                is_provisional = 0,
                provisional_card_id = NULL
            WHERE provisional_card_id = ${pc.provisional_card_id}
          `

          results.cards_created++
          results.user_cards_updated += Number(userCardsUpdated)

          // Update series card count
          await prisma.$executeRaw`
            UPDATE series
            SET card_entered_count = ISNULL(card_entered_count, 0) + 1
            WHERE series_id = ${pc.resolved_series_id}
          `

        } catch (cardError) {
          console.error(`Error processing provisional card ${pc.provisional_card_id}:`, cardError)
          results.errors.push({
            provisional_card_id: Number(pc.provisional_card_id),
            error: cardError.message
          })
        }
      }

      // Update bundle status
      await prisma.$executeRaw`
        UPDATE suggestion_bundle
        SET status = 'approved',
            reviewed_by = ${reviewerId},
            reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}
        WHERE bundle_id = ${parseInt(bundleId)}
      `

      // Update contributor stats for submitter
      await updateContributorStatsOnReview(bundle.user_id, true)

      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET provisional_cards_resolved = provisional_cards_resolved + ${results.cards_created + results.cards_linked}
        WHERE user_id = ${bundle.user_id}
      `

      res.json({
        success: true,
        message: `Bundle approved. ${results.cards_created} cards created, ${results.cards_linked} cards linked.`,
        results
      })

    } catch (error) {
      console.error('Error approving bundle:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to approve bundle'
      })
    }
  }
)

// =============================================================================
// ADMIN: REJECT BUNDLE
// =============================================================================

/**
 * POST /api/crowdsource/admin/bundles/:bundleId/reject
 *
 * Reject a bundle
 */
router.post('/admin/bundles/:bundleId/reject',
  authMiddleware,
  adminCheck,
  param('bundleId').isInt({ min: 1 }),
  body('review_notes').isString().isLength({ min: 1, max: 2000 }).withMessage('Review notes are required for rejection'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const { bundleId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get bundle
      const bundles = await prisma.$queryRaw`
        SELECT * FROM suggestion_bundle WHERE bundle_id = ${parseInt(bundleId)}
      `

      if (bundles.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Bundle not found'
        })
      }

      const bundle = bundles[0]

      if (bundle.status !== 'pending') {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Bundle is already ${bundle.status}`
        })
      }

      // Update all provisional cards to rejected
      await prisma.$executeRaw`
        UPDATE provisional_card
        SET status = 'rejected'
        WHERE bundle_id = ${parseInt(bundleId)}
      `

      // Remove provisional user_cards (or mark them somehow)
      // For now, we'll delete the provisional user_card entries
      await prisma.$executeRaw`
        DELETE FROM user_card
        WHERE provisional_card_id IN (
          SELECT provisional_card_id FROM provisional_card WHERE bundle_id = ${parseInt(bundleId)}
        )
      `

      // Update bundle status
      await prisma.$executeRaw`
        UPDATE suggestion_bundle
        SET status = 'rejected',
            reviewed_by = ${reviewerId},
            reviewed_at = GETDATE(),
            review_notes = ${review_notes}
        WHERE bundle_id = ${parseInt(bundleId)}
      `

      // Update contributor stats
      await updateContributorStatsOnReview(bundle.user_id, false)

      res.json({
        success: true,
        message: 'Bundle rejected'
      })

    } catch (error) {
      console.error('Error rejecting bundle:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to reject bundle'
      })
    }
  }
)

// =============================================================================
// ADMIN: RESOLVE ENTITY - Create missing set/series/player/team inline
// =============================================================================

/**
 * POST /api/crowdsource/admin/provisional-card/:cardId/resolve-set
 *
 * Create a new set for a provisional card
 */
router.post('/admin/provisional-card/:cardId/resolve-set',
  authMiddleware,
  adminCheck,
  param('cardId').isInt({ min: 1 }),
  body('set_id').optional().isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 255 }),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('manufacturer_id').optional().isInt({ min: 1 }),
  body('organization_id').optional().isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { cardId } = req.params
      const { set_id, name, year, manufacturer_id, organization_id } = req.body

      // Get provisional card
      const cards = await prisma.$queryRaw`
        SELECT * FROM provisional_card WHERE provisional_card_id = ${parseInt(cardId)}
      `

      if (cards.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Provisional card not found'
        })
      }

      const pc = cards[0]
      let resolvedSetId = set_id

      // If set_id provided, use existing set
      if (set_id) {
        const existingSet = await prisma.$queryRaw`
          SELECT set_id FROM [set] WHERE set_id = ${set_id}
        `
        if (existingSet.length === 0) {
          return res.status(400).json({
            error: 'Invalid set',
            message: 'Specified set does not exist'
          })
        }
      } else if (name && year) {
        // Create new set
        const slug = name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        let finalSlug = `${year}-${slug}`

        // Check slug uniqueness
        const existingSlug = await prisma.$queryRaw`
          SELECT set_id FROM [set] WHERE slug = ${finalSlug}
        `
        if (existingSlug.length > 0) {
          finalSlug = `${finalSlug}-${Date.now()}`
        }

        const newSet = await prisma.$queryRaw`
          INSERT INTO [set] (name, year, manufacturer, organization, slug, created, card_count, series_count)
          OUTPUT INSERTED.set_id
          VALUES (${name}, ${year}, ${manufacturer_id || null}, ${organization_id || null}, ${finalSlug}, GETDATE(), 0, 0)
        `
        resolvedSetId = newSet[0].set_id

        // Create base series for the new set
        const seriesSlug = 'base'
        await prisma.$executeRaw`
          INSERT INTO series (name, [set], is_base, slug, created, card_count, card_entered_count)
          VALUES ('Base', ${resolvedSetId}, 1, ${seriesSlug}, GETDATE(), 0, 0)
        `

        // Update set series count
        await prisma.$executeRaw`
          UPDATE [set] SET series_count = 1 WHERE set_id = ${resolvedSetId}
        `
      } else {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Provide either set_id or name+year'
        })
      }

      // Update provisional card
      await prisma.$executeRaw`
        UPDATE provisional_card
        SET resolved_set_id = ${resolvedSetId},
            set_match_confidence = 1.0
        WHERE provisional_card_id = ${parseInt(cardId)}
      `

      res.json({
        success: true,
        message: set_id ? 'Set linked' : 'Set created and linked',
        set_id: resolvedSetId
      })

    } catch (error) {
      console.error('Error resolving set:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to resolve set'
      })
    }
  }
)

/**
 * POST /api/crowdsource/admin/provisional-card/:cardId/resolve-series
 *
 * Create a new series for a provisional card
 */
router.post('/admin/provisional-card/:cardId/resolve-series',
  authMiddleware,
  adminCheck,
  param('cardId').isInt({ min: 1 }),
  body('series_id').optional().isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 255 }),
  body('is_base').optional().isBoolean(),
  body('color_id').optional().isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { cardId } = req.params
      const { series_id, name, is_base, color_id } = req.body

      // Get provisional card
      const cards = await prisma.$queryRaw`
        SELECT * FROM provisional_card WHERE provisional_card_id = ${parseInt(cardId)}
      `

      if (cards.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Provisional card not found'
        })
      }

      const pc = cards[0]

      if (!pc.resolved_set_id) {
        return res.status(400).json({
          error: 'Missing set',
          message: 'Set must be resolved before series'
        })
      }

      let resolvedSeriesId = series_id

      if (series_id) {
        // Use existing series
        const existingSeries = await prisma.$queryRaw`
          SELECT series_id FROM series WHERE series_id = ${series_id}
        `
        if (existingSeries.length === 0) {
          return res.status(400).json({
            error: 'Invalid series',
            message: 'Specified series does not exist'
          })
        }
      } else if (name) {
        // Create new series
        const slug = name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        // Check slug uniqueness within set
        const existingSlug = await prisma.$queryRaw`
          SELECT series_id FROM series WHERE slug = ${slug} AND [set] = ${pc.resolved_set_id}
        `
        let finalSlug = slug
        if (existingSlug.length > 0) {
          finalSlug = `${slug}-${Date.now()}`
        }

        // Note: series table has triggers, so we can't use OUTPUT INSERTED
        // Use $executeRaw and query back instead
        await prisma.$executeRaw`
          INSERT INTO series (name, [set], is_base, color, slug, created, card_count, card_entered_count)
          VALUES (${name}, ${pc.resolved_set_id}, ${is_base || false}, ${color_id || null}, ${finalSlug}, GETDATE(), 0, 0)
        `

        // Query back to get the new series ID
        const newSeriesResult = await prisma.$queryRaw`
          SELECT series_id FROM series WHERE slug = ${finalSlug} AND [set] = ${pc.resolved_set_id}
        `
        resolvedSeriesId = Number(newSeriesResult[0].series_id)

        // Update set series count
        await prisma.$executeRaw`
          UPDATE [set] SET series_count = series_count + 1 WHERE set_id = ${pc.resolved_set_id}
        `
      } else {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Provide either series_id or name'
        })
      }

      // Update provisional card
      await prisma.$executeRaw`
        UPDATE provisional_card
        SET resolved_series_id = ${resolvedSeriesId},
            series_match_confidence = 1.0
        WHERE provisional_card_id = ${parseInt(cardId)}
      `

      res.json({
        success: true,
        message: series_id ? 'Series linked' : 'Series created and linked',
        series_id: resolvedSeriesId
      })

    } catch (error) {
      console.error('Error resolving series:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to resolve series'
      })
    }
  }
)

/**
 * POST /api/crowdsource/admin/provisional-card-player/:playerId/resolve
 *
 * Resolve a player on a provisional card
 */
router.post('/admin/provisional-card-player/:playerId/resolve',
  authMiddleware,
  adminCheck,
  param('playerId').isInt({ min: 1 }),
  body('player_id').optional().isInt({ min: 1 }),
  body('team_id').optional().isInt({ min: 1 }),
  body('first_name').optional().isString().isLength({ min: 1, max: 255 }),
  body('last_name').optional().isString().isLength({ min: 1, max: 255 }),
  async (req, res) => {
    try {
      const { playerId } = req.params
      const { player_id, team_id, first_name, last_name } = req.body

      // Get provisional card player
      const pcps = await prisma.$queryRaw`
        SELECT * FROM provisional_card_player WHERE provisional_card_player_id = ${parseInt(playerId)}
      `

      if (pcps.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Provisional card player not found'
        })
      }

      const pcp = pcps[0]
      let resolvedPlayerId = player_id
      let resolvedTeamId = team_id || pcp.resolved_team_id
      let resolvedPlayerTeamId = null

      if (player_id) {
        // Use existing player
        const existingPlayer = await prisma.$queryRaw`
          SELECT player_id FROM player WHERE player_id = ${player_id}
        `
        if (existingPlayer.length === 0) {
          return res.status(400).json({
            error: 'Invalid player',
            message: 'Specified player does not exist'
          })
        }

        // Find or create player_team
        if (resolvedTeamId) {
          const pt = await prisma.$queryRaw`
            SELECT player_team_id FROM player_team
            WHERE player = ${player_id} AND team = ${resolvedTeamId}
          `
          if (pt.length > 0) {
            resolvedPlayerTeamId = Number(pt[0].player_team_id)
          } else {
            // Create player_team
            const newPt = await prisma.$queryRaw`
              INSERT INTO player_team (player, team, created)
              OUTPUT INSERTED.player_team_id
              VALUES (${player_id}, ${resolvedTeamId}, GETDATE())
            `
            resolvedPlayerTeamId = Number(newPt[0].player_team_id)
          }
        }
      } else if (first_name && last_name) {
        // Create new player
        const slug = `${first_name}-${last_name}`.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const newPlayer = await prisma.$queryRaw`
          INSERT INTO player (first_name, last_name, slug, created, card_count)
          OUTPUT INSERTED.player_id
          VALUES (${first_name}, ${last_name}, ${slug}, GETDATE(), 0)
        `
        resolvedPlayerId = Number(newPlayer[0].player_id)

        // Create player_team if team specified
        if (resolvedTeamId) {
          const newPt = await prisma.$queryRaw`
            INSERT INTO player_team (player, team, created)
            OUTPUT INSERTED.player_team_id
            VALUES (${resolvedPlayerId}, ${resolvedTeamId}, GETDATE())
          `
          resolvedPlayerTeamId = Number(newPt[0].player_team_id)

          // Update team player count
          await prisma.$executeRaw`
            UPDATE team SET player_count = ISNULL(player_count, 0) + 1 WHERE team_Id = ${resolvedTeamId}
          `
        }
      } else {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Provide either player_id or first_name+last_name'
        })
      }

      // Update provisional card player
      await prisma.$executeRaw`
        UPDATE provisional_card_player
        SET resolved_player_id = ${resolvedPlayerId},
            resolved_team_id = ${resolvedTeamId || null},
            resolved_player_team_id = ${resolvedPlayerTeamId},
            match_confidence = 1.0,
            auto_matched = 0,
            needs_review = 0
        WHERE provisional_card_player_id = ${parseInt(playerId)}
      `

      res.json({
        success: true,
        message: player_id ? 'Player linked' : 'Player created and linked',
        player_id: resolvedPlayerId,
        player_team_id: resolvedPlayerTeamId
      })

    } catch (error) {
      console.error('Error resolving player:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to resolve player'
      })
    }
  }
)

module.exports = router
