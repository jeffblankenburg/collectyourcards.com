const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats, updateContributorStatsOnSubmit } = require('./helpers')

const router = express.Router()

// =============================================================================
// CARD EDIT SUBMISSIONS
// =============================================================================

// Submit a card edit suggestion
router.post('/card-edit',
  authMiddleware,
  submissionLimiter,
  body('card_id').isInt({ min: 1 }).withMessage('Valid card ID is required'),
  body('proposed_card_number').optional().isString().isLength({ max: 100 }),
  body('proposed_is_rookie').optional().isBoolean(),
  body('proposed_is_autograph').optional().isBoolean(),
  body('proposed_is_relic').optional().isBoolean(),
  body('proposed_is_short_print').optional().isBoolean(),
  body('proposed_print_run').optional().isInt({ min: 1 }),
  body('proposed_notes').optional().isString().isLength({ max: 5000 }),
  body('submission_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const userId = BigInt(req.user.userId)
      const {
        card_id,
        proposed_card_number,
        proposed_is_rookie,
        proposed_is_autograph,
        proposed_is_relic,
        proposed_is_short_print,
        proposed_print_run,
        proposed_notes,
        submission_notes
      } = req.body

      // Verify the card exists
      const card = await prisma.$queryRaw`
        SELECT card_id FROM card WHERE card_id = ${BigInt(card_id)}
      `

      if (card.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Card not found'
        })
      }

      // Check if user already has a pending submission for this card
      const existingPending = await prisma.$queryRaw`
        SELECT submission_id FROM card_edit_submissions
        WHERE card_id = ${BigInt(card_id)}
        AND user_id = ${userId}
        AND status = 'pending'
      `

      if (existingPending.length > 0) {
        return res.status(409).json({
          error: 'Duplicate submission',
          message: 'You already have a pending edit for this card'
        })
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the submission
      await prisma.$executeRaw`
        INSERT INTO card_edit_submissions (
          card_id, user_id,
          proposed_card_number, proposed_is_rookie, proposed_is_autograph,
          proposed_is_relic, proposed_is_short_print, proposed_print_run,
          proposed_notes, submission_notes, status, created_at
        ) VALUES (
          ${BigInt(card_id)}, ${userId},
          ${proposed_card_number || null},
          ${proposed_is_rookie !== undefined ? proposed_is_rookie : null},
          ${proposed_is_autograph !== undefined ? proposed_is_autograph : null},
          ${proposed_is_relic !== undefined ? proposed_is_relic : null},
          ${proposed_is_short_print !== undefined ? proposed_is_short_print : null},
          ${proposed_print_run || null},
          ${proposed_notes || null}, ${submission_notes || null},
          'pending', GETDATE()
        )
      `

      // Update contributor stats
      await updateContributorStatsOnSubmit(userId)

      res.status(201).json({
        success: true,
        message: 'Edit suggestion submitted successfully'
      })

    } catch (error) {
      console.error('Error submitting card edit:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit edit suggestion'
      })
    }
  }
)

// =============================================================================
// CARD SUBMISSIONS (NEW CARDS)
// =============================================================================

// Submit new card(s) suggestion - supports single or bulk
router.post('/cards',
  authMiddleware,
  submissionLimiter,
  body('series_id').optional().isInt({ min: 1 }),
  body('series_submission_id').optional().isInt({ min: 1 }),
  body('cards').isArray({ min: 1, max: 500 }).withMessage('Cards array is required (1-500 cards)'),
  body('cards.*.card_number').isString().isLength({ min: 1, max: 50 }).withMessage('Card number is required'),
  body('cards.*.player_names').optional().isString().isLength({ max: 500 }),
  body('cards.*.team_names').optional().isString().isLength({ max: 500 }),
  body('cards.*.is_rookie').optional().isBoolean(),
  body('cards.*.is_autograph').optional().isBoolean(),
  body('cards.*.is_relic').optional().isBoolean(),
  body('cards.*.is_short_print').optional().isBoolean(),
  body('cards.*.print_run').optional().isInt({ min: 1 }),
  body('cards.*.notes').optional().isString().isLength({ max: 2000 }),
  body('submission_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const userId = BigInt(req.user.userId)
      const { series_id, series_submission_id, cards, submission_notes } = req.body

      // Must have either series_id or series_submission_id
      if (!series_id && !series_submission_id) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Either series_id or series_submission_id is required'
        })
      }

      // If series_id provided, verify it exists
      if (series_id) {
        const seriesExists = await prisma.$queryRaw`
          SELECT series_id FROM series WHERE series_id = ${BigInt(series_id)}
        `
        if (seriesExists.length === 0) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Series not found'
          })
        }
      }

      // Generate batch ID for bulk submissions
      const batchId = cards.length > 1 ? `batch_${Date.now()}_${userId}` : null

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Insert all cards
      let insertedCount = 0
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        await prisma.$executeRaw`
          INSERT INTO card_submissions (
            user_id, series_id, series_submission_id, batch_id, batch_sequence,
            proposed_card_number, proposed_player_names, proposed_team_names,
            proposed_is_rookie, proposed_is_autograph, proposed_is_relic,
            proposed_is_short_print, proposed_print_run, proposed_notes,
            submission_notes, status, created_at
          ) VALUES (
            ${userId}, ${series_id ? BigInt(series_id) : null},
            ${series_submission_id ? BigInt(series_submission_id) : null},
            ${batchId}, ${i + 1},
            ${card.card_number}, ${card.player_names || null}, ${card.team_names || null},
            ${card.is_rookie || false}, ${card.is_autograph || false}, ${card.is_relic || false},
            ${card.is_short_print || false}, ${card.print_run || null}, ${card.notes || null},
            ${submission_notes || null}, 'pending', GETDATE()
          )
        `
        insertedCount++
      }

      // Update contributor stats - count each card as a submission
      for (let i = 0; i < insertedCount; i++) {
        await updateContributorStatsOnSubmit(userId)
      }

      // Increment card_submissions count
      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET card_submissions = card_submissions + ${insertedCount}
        WHERE user_id = ${userId}
      `

      res.status(201).json({
        success: true,
        message: `${insertedCount} card${insertedCount > 1 ? 's' : ''} submitted successfully`,
        count: insertedCount,
        batch_id: batchId
      })

    } catch (error) {
      console.error('Error submitting cards:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit card suggestions'
      })
    }
  }
)

module.exports = router
