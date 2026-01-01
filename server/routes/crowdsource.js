const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')
const rateLimit = require('express-rate-limit')
const ExcelJS = require('exceljs')

const router = express.Router()

// Rate limiting for submissions
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 submissions per hour
  message: { error: 'Too many submissions', message: 'Please wait before submitting more edits' },
  standardHeaders: true,
  legacyHeaders: false
})

// Helper to ensure contributor_stats record exists for user
async function ensureContributorStats(userId) {
  const existing = await prisma.$queryRaw`
    SELECT user_id FROM contributor_stats WHERE user_id = ${userId}
  `

  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO contributor_stats (user_id, created_at)
      VALUES (${userId}, GETDATE())
    `
  }
}

// Helper to update contributor stats after submission
async function updateContributorStatsOnSubmit(userId) {
  await prisma.$executeRaw`
    UPDATE contributor_stats
    SET
      total_submissions = total_submissions + 1,
      pending_submissions = pending_submissions + 1,
      last_submission_at = GETDATE(),
      first_submission_at = COALESCE(first_submission_at, GETDATE()),
      updated_at = GETDATE()
    WHERE user_id = ${userId}
  `
}

// Helper to calculate trust level based on points
function calculateTrustLevel(trustPoints) {
  if (trustPoints >= 500) return 'master'
  if (trustPoints >= 300) return 'expert'
  if (trustPoints >= 150) return 'trusted'
  if (trustPoints >= 50) return 'contributor'
  return 'novice'
}

// Helper to update stats when submission is reviewed
async function updateContributorStatsOnReview(userId, wasApproved) {
  const pointChange = wasApproved ? 5 : -2 // Gain 5 points for approval, lose 2 for rejection

  await prisma.$executeRaw`
    UPDATE contributor_stats
    SET
      pending_submissions = pending_submissions - 1,
      approved_submissions = approved_submissions + ${wasApproved ? 1 : 0},
      rejected_submissions = rejected_submissions + ${wasApproved ? 0 : 1},
      trust_points = CASE
        WHEN trust_points + ${pointChange} < 0 THEN 0
        ELSE trust_points + ${pointChange}
      END,
      approval_rate = CASE
        WHEN (approved_submissions + rejected_submissions + 1) > 0
        THEN CAST((approved_submissions + ${wasApproved ? 1 : 0}) AS DECIMAL(5,2)) /
             CAST((approved_submissions + rejected_submissions + 1) AS DECIMAL(5,2)) * 100
        ELSE NULL
      END,
      updated_at = GETDATE()
    WHERE user_id = ${userId}
  `

  // Update trust level based on new points
  const stats = await prisma.$queryRaw`
    SELECT trust_points FROM contributor_stats WHERE user_id = ${userId}
  `

  if (stats.length > 0) {
    const newTrustLevel = calculateTrustLevel(stats[0].trust_points)
    await prisma.$executeRaw`
      UPDATE contributor_stats
      SET trust_level = ${newTrustLevel}
      WHERE user_id = ${userId}
    `
  }
}

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

// =============================================================================
// AUTHENTICATED USER ENDPOINTS
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

// Get user's own submissions
router.get('/my-submissions',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)
      const { status, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      let statusFilter = ''
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        statusFilter = `AND ces.status = '${status}'`
      }

      const submissions = await prisma.$queryRawUnsafe(`
        SELECT
          ces.submission_id,
          ces.card_id,
          ces.proposed_card_number,
          ces.proposed_is_rookie,
          ces.proposed_is_autograph,
          ces.proposed_is_relic,
          ces.proposed_is_short_print,
          ces.proposed_print_run,
          ces.proposed_notes,
          ces.submission_notes,
          ces.status,
          ces.review_notes,
          ces.created_at,
          ces.reviewed_at,
          c.card_number as current_card_number,
          c.is_rookie as current_is_rookie,
          c.is_autograph as current_is_autograph,
          c.is_relic as current_is_relic,
          c.is_short_print as current_is_short_print,
          c.print_run as current_print_run,
          c.notes as current_notes,
          s.name as series_name,
          st.name as set_name,
          st.year as set_year,
          (
            SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
            FROM card_player cp
            JOIN player p ON cp.player = p.player_id
            WHERE cp.card = c.card_id
          ) as player_names
        FROM card_edit_submissions ces
        JOIN card c ON ces.card_id = c.card_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        WHERE ces.user_id = ${userId}
        ${statusFilter}
        ORDER BY ces.created_at DESC
        OFFSET ${offsetNum} ROWS FETCH NEXT ${limitNum} ROWS ONLY
      `)

      // Get total count
      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM card_edit_submissions ces
        WHERE ces.user_id = ${userId}
        ${statusFilter}
      `)

      // Serialize BigInts
      const serialized = submissions.map(s => ({
        submission_id: Number(s.submission_id),
        card_id: Number(s.card_id),
        proposed_card_number: s.proposed_card_number,
        proposed_is_rookie: s.proposed_is_rookie,
        proposed_is_autograph: s.proposed_is_autograph,
        proposed_is_relic: s.proposed_is_relic,
        proposed_is_short_print: s.proposed_is_short_print,
        proposed_print_run: s.proposed_print_run ? Number(s.proposed_print_run) : null,
        proposed_notes: s.proposed_notes,
        submission_notes: s.submission_notes,
        status: s.status,
        review_notes: s.review_notes,
        created_at: s.created_at,
        reviewed_at: s.reviewed_at,
        current_card_number: s.current_card_number,
        current_is_rookie: s.current_is_rookie,
        current_is_autograph: s.current_is_autograph,
        current_is_relic: s.current_is_relic,
        current_is_short_print: s.current_is_short_print,
        current_print_run: s.current_print_run ? Number(s.current_print_run) : null,
        current_notes: s.current_notes,
        series_name: s.series_name,
        set_name: s.set_name,
        set_year: s.set_year ? Number(s.set_year) : null,
        player_names: s.player_names
      }))

      res.json({
        success: true,
        submissions: serialized,
        total: Number(countResult[0].total),
        limit: limitNum,
        offset: offsetNum
      })

    } catch (error) {
      console.error('Error fetching user submissions:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch submissions'
      })
    }
  }
)

// =============================================================================
// SET SUBMISSIONS
// =============================================================================

// Submit a new set suggestion
router.post('/set',
  authMiddleware,
  submissionLimiter,
  body('name').isString().isLength({ min: 3, max: 255 }).withMessage('Set name is required (3-255 chars)'),
  body('year').isInt({ min: 1900, max: 2100 }).withMessage('Valid year is required'),
  body('sport').isString().isLength({ min: 2, max: 50 }).withMessage('Sport is required'),
  body('manufacturer').optional().isString().isLength({ max: 100 }),
  body('description').optional().isString().isLength({ max: 5000 }),
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
      const { name, year, sport, manufacturer, description, submission_notes } = req.body

      // Check for duplicate pending submission
      const existing = await prisma.$queryRaw`
        SELECT submission_id FROM set_submissions
        WHERE user_id = ${userId}
        AND proposed_name = ${name}
        AND proposed_year = ${year}
        AND status = 'pending'
      `

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Duplicate submission',
          message: 'You already have a pending submission for this set'
        })
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the submission
      const result = await prisma.$queryRaw`
        INSERT INTO set_submissions (
          user_id, proposed_name, proposed_year, proposed_sport,
          proposed_manufacturer, proposed_description,
          submission_notes, status, created_at
        )
        OUTPUT INSERTED.submission_id
        VALUES (
          ${userId}, ${name}, ${year}, ${sport},
          ${manufacturer || null}, ${description || null},
          ${submission_notes || null}, 'pending', GETDATE()
        )
      `

      // Update contributor stats
      await updateContributorStatsOnSubmit(userId)

      // Increment set_submissions count
      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET set_submissions = set_submissions + 1
        WHERE user_id = ${userId}
      `

      res.status(201).json({
        success: true,
        message: 'Set suggestion submitted successfully',
        submission_id: Number(result[0].submission_id)
      })

    } catch (error) {
      console.error('Error submitting set:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit set suggestion'
      })
    }
  }
)

// =============================================================================
// SERIES SUBMISSIONS
// =============================================================================

// Submit a new series suggestion
router.post('/series',
  authMiddleware,
  submissionLimiter,
  body('set_id').optional().isInt({ min: 1 }),
  body('set_submission_id').optional().isInt({ min: 1 }),
  body('name').isString().isLength({ min: 2, max: 255 }).withMessage('Series name is required (2-255 chars)'),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('base_card_count').optional().isInt({ min: 1 }),
  body('is_parallel').optional().isBoolean(),
  body('parallel_of_series_id').optional().isInt({ min: 1 }),
  body('print_run').optional().isInt({ min: 1 }),
  body('submission_notes').optional().isString().isLength({ max: 2000 }),
  body('cards').optional().isArray(),
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
        set_id, set_submission_id, name, description, base_card_count,
        is_parallel, parallel_of_series_id, print_run, submission_notes, cards
      } = req.body

      // Must have either set_id or set_submission_id
      if (!set_id && !set_submission_id) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Either set_id or set_submission_id is required'
        })
      }

      // If set_id provided, verify it exists
      if (set_id) {
        const setExists = await prisma.$queryRaw`
          SELECT set_id FROM [set] WHERE set_id = ${set_id}
        `
        if (setExists.length === 0) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Set not found'
          })
        }
      }

      // If set_submission_id provided, verify it exists and belongs to user or is approved
      if (set_submission_id) {
        const setSubExists = await prisma.$queryRaw`
          SELECT submission_id, user_id, status FROM set_submissions
          WHERE submission_id = ${BigInt(set_submission_id)}
        `
        if (setSubExists.length === 0) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Set submission not found'
          })
        }
      }

      // If parallel_of_series_id provided, verify it exists
      if (parallel_of_series_id) {
        const seriesExists = await prisma.$queryRaw`
          SELECT series_id FROM series WHERE series_id = ${parallel_of_series_id}
        `
        if (seriesExists.length === 0) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Parent series not found'
          })
        }
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the series submission
      const result = await prisma.$queryRaw`
        INSERT INTO series_submissions (
          user_id, set_id, set_submission_id, proposed_name, proposed_description,
          proposed_base_card_count, proposed_is_parallel, proposed_parallel_of_series,
          proposed_print_run, submission_notes, status, created_at
        )
        OUTPUT INSERTED.submission_id
        VALUES (
          ${userId}, ${set_id || null}, ${set_submission_id ? BigInt(set_submission_id) : null},
          ${name}, ${description || null}, ${base_card_count || null},
          ${is_parallel || false}, ${parallel_of_series_id ? BigInt(parallel_of_series_id) : null},
          ${print_run || null}, ${submission_notes || null}, 'pending', GETDATE()
        )
      `

      const seriesSubmissionId = result[0].submission_id

      // If cards were provided, create card submissions linked to this series submission
      let cardCount = 0
      if (cards && Array.isArray(cards) && cards.length > 0) {
        const batchId = `series_${seriesSubmissionId}_${Date.now()}`

        for (let i = 0; i < cards.length; i++) {
          const card = cards[i]
          if (!card.card_number) continue

          await prisma.$executeRaw`
            INSERT INTO card_submissions (
              user_id, series_submission_id, batch_id, batch_sequence,
              proposed_card_number, proposed_player_names, proposed_team_names,
              proposed_is_rookie, proposed_is_autograph, proposed_is_relic,
              proposed_is_short_print, proposed_print_run, proposed_color, proposed_notes,
              status, created_at
            )
            VALUES (
              ${userId}, ${seriesSubmissionId}, ${batchId}, ${i + 1},
              ${card.card_number}, ${card.player_names || null}, ${card.team_names || null},
              ${card.is_rookie || false}, ${card.is_autograph || false}, ${card.is_relic || false},
              ${card.is_short_print || false}, ${card.print_run || null}, ${card.color || null},
              ${card.notes || null}, 'pending', GETDATE()
            )
          `
          cardCount++
        }
      }

      // Update contributor stats
      await updateContributorStatsOnSubmit(userId)

      // Increment series_submissions count
      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET series_submissions = series_submissions + 1
        WHERE user_id = ${userId}
      `

      // If cards were submitted, also increment card_submissions count
      if (cardCount > 0) {
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET card_submissions = card_submissions + ${cardCount}
          WHERE user_id = ${userId}
        `
      }

      const message = cardCount > 0
        ? `Series suggestion with ${cardCount} cards submitted successfully`
        : 'Series suggestion submitted successfully'

      res.status(201).json({
        success: true,
        message,
        submission_id: Number(seriesSubmissionId),
        card_count: cardCount
      })

    } catch (error) {
      console.error('Error submitting series:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit series suggestion'
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

// =============================================================================
// GET ALL USER SUBMISSIONS (all types)
// =============================================================================

// Get all user submissions across all types
router.get('/my-all-submissions',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)
      const { status, type, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      // Get submissions based on type filter or all
      const results = { sets: [], series: [], cards: [], card_edits: [] }

      if (!type || type === 'set') {
        let sets
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          sets = await prisma.$queryRaw`
            SELECT 'set' as submission_type, submission_id, proposed_name, proposed_year,
                   proposed_sport, proposed_manufacturer, status, created_at, reviewed_at, review_notes
            FROM set_submissions
            WHERE user_id = ${userId} AND status = ${status}
            ORDER BY created_at DESC
          `
        } else {
          sets = await prisma.$queryRaw`
            SELECT 'set' as submission_type, submission_id, proposed_name, proposed_year,
                   proposed_sport, proposed_manufacturer, status, created_at, reviewed_at, review_notes
            FROM set_submissions
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
          `
        }
        results.sets = sets.map(s => ({
          submission_type: 'set',
          submission_id: Number(s.submission_id),
          name: s.proposed_name,
          year: s.proposed_year,
          sport: s.proposed_sport,
          manufacturer: s.proposed_manufacturer,
          status: s.status,
          created_at: s.created_at,
          reviewed_at: s.reviewed_at,
          review_notes: s.review_notes
        }))
      }

      if (!type || type === 'series') {
        let series
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          series = await prisma.$queryRaw`
            SELECT 'series' as submission_type, ss.submission_id, ss.proposed_name,
                   ss.proposed_is_parallel, ss.proposed_parallel_name, ss.status,
                   ss.created_at, ss.reviewed_at, ss.review_notes,
                   s.name as set_name, s.year as set_year,
                   sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year
            FROM series_submissions ss
            LEFT JOIN [set] s ON ss.set_id = s.set_id
            LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
            WHERE ss.user_id = ${userId} AND ss.status = ${status}
            ORDER BY ss.created_at DESC
          `
        } else {
          series = await prisma.$queryRaw`
            SELECT 'series' as submission_type, ss.submission_id, ss.proposed_name,
                   ss.proposed_is_parallel, ss.proposed_parallel_name, ss.status,
                   ss.created_at, ss.reviewed_at, ss.review_notes,
                   s.name as set_name, s.year as set_year,
                   sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year
            FROM series_submissions ss
            LEFT JOIN [set] s ON ss.set_id = s.set_id
            LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
            WHERE ss.user_id = ${userId}
            ORDER BY ss.created_at DESC
          `
        }
        results.series = series.map(s => ({
          submission_type: 'series',
          submission_id: Number(s.submission_id),
          name: s.proposed_name,
          is_parallel: s.proposed_is_parallel,
          parallel_name: s.proposed_parallel_name,
          set_name: s.set_name || s.pending_set_name,
          set_year: s.set_year || s.pending_set_year,
          status: s.status,
          created_at: s.created_at,
          reviewed_at: s.reviewed_at,
          review_notes: s.review_notes
        }))
      }

      if (!type || type === 'card') {
        let cards
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          cards = await prisma.$queryRaw`
            SELECT 'card' as submission_type, cs.submission_id, cs.batch_id,
                   cs.proposed_card_number, cs.proposed_player_names, cs.proposed_team_names,
                   cs.status, cs.created_at, cs.reviewed_at, cs.review_notes,
                   s.name as series_name, st.name as set_name, st.year as set_year
            FROM card_submissions cs
            LEFT JOIN series s ON cs.series_id = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE cs.user_id = ${userId} AND cs.status = ${status}
            ORDER BY cs.created_at DESC
          `
        } else {
          cards = await prisma.$queryRaw`
            SELECT 'card' as submission_type, cs.submission_id, cs.batch_id,
                   cs.proposed_card_number, cs.proposed_player_names, cs.proposed_team_names,
                   cs.status, cs.created_at, cs.reviewed_at, cs.review_notes,
                   s.name as series_name, st.name as set_name, st.year as set_year
            FROM card_submissions cs
            LEFT JOIN series s ON cs.series_id = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE cs.user_id = ${userId}
            ORDER BY cs.created_at DESC
          `
        }
        results.cards = cards.map(c => ({
          submission_type: 'card',
          submission_id: Number(c.submission_id),
          batch_id: c.batch_id,
          card_number: c.proposed_card_number,
          player_names: c.proposed_player_names,
          team_names: c.proposed_team_names,
          series_name: c.series_name,
          set_name: c.set_name,
          set_year: c.set_year,
          status: c.status,
          created_at: c.created_at,
          reviewed_at: c.reviewed_at,
          review_notes: c.review_notes
        }))
      }

      if (!type || type === 'card_edit') {
        let cardEdits
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          cardEdits = await prisma.$queryRaw`
            SELECT 'card_edit' as submission_type, ces.submission_id, ces.card_id,
                   ces.proposed_card_number, ces.status, ces.created_at, ces.reviewed_at, ces.review_notes,
                   c.card_number as current_card_number, s.name as series_name,
                   st.name as set_name, st.year as set_year,
                   (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                    FROM card_player_team cpt
                    JOIN player_team pt ON cpt.player_team = pt.player_team_id
                    JOIN player p ON pt.player = p.player_id
                    WHERE cpt.card = c.card_id) as player_names
            FROM card_edit_submissions ces
            JOIN card c ON ces.card_id = c.card_id
            LEFT JOIN series s ON c.series = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE ces.user_id = ${userId} AND ces.status = ${status}
            ORDER BY ces.created_at DESC
          `
        } else {
          cardEdits = await prisma.$queryRaw`
            SELECT 'card_edit' as submission_type, ces.submission_id, ces.card_id,
                   ces.proposed_card_number, ces.status, ces.created_at, ces.reviewed_at, ces.review_notes,
                   c.card_number as current_card_number, s.name as series_name,
                   st.name as set_name, st.year as set_year,
                   (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                    FROM card_player_team cpt
                    JOIN player_team pt ON cpt.player_team = pt.player_team_id
                    JOIN player p ON pt.player = p.player_id
                    WHERE cpt.card = c.card_id) as player_names
            FROM card_edit_submissions ces
            JOIN card c ON ces.card_id = c.card_id
            LEFT JOIN series s ON c.series = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE ces.user_id = ${userId}
            ORDER BY ces.created_at DESC
          `
        }
        results.card_edits = cardEdits.map(ce => ({
          submission_type: 'card_edit',
          submission_id: Number(ce.submission_id),
          card_id: Number(ce.card_id),
          card_number: ce.current_card_number,
          proposed_card_number: ce.proposed_card_number,
          player_names: ce.player_names,
          series_name: ce.series_name,
          set_name: ce.set_name,
          set_year: ce.set_year,
          status: ce.status,
          created_at: ce.created_at,
          reviewed_at: ce.reviewed_at,
          review_notes: ce.review_notes
        }))
      }

      // Combine and sort by created_at
      const allSubmissions = [
        ...results.sets,
        ...results.series,
        ...results.cards,
        ...results.card_edits
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(offsetNum, offsetNum + limitNum)

      res.json({
        success: true,
        submissions: allSubmissions,
        counts: {
          sets: results.sets.length,
          series: results.series.length,
          cards: results.cards.length,
          card_edits: results.card_edits.length,
          total: results.sets.length + results.series.length + results.cards.length + results.card_edits.length
        }
      })

    } catch (error) {
      console.error('Error fetching all submissions:', error.message)
      console.error('Stack:', error.stack)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch submissions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
)

// Get user's contributor stats
router.get('/my-stats',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)

      // Ensure stats record exists
      await ensureContributorStats(userId)

      const stats = await prisma.$queryRaw`
        SELECT
          cs.total_submissions,
          cs.pending_submissions,
          cs.approved_submissions,
          cs.rejected_submissions,
          cs.approval_rate,
          cs.trust_level,
          cs.trust_points,
          cs.first_submission_at,
          cs.last_submission_at,
          cs.current_streak_days,
          cs.longest_streak_days,
          cs.set_submissions,
          cs.series_submissions,
          cs.card_submissions
        FROM contributor_stats cs
        WHERE cs.user_id = ${userId}
      `

      if (stats.length === 0) {
        return res.json({
          success: true,
          stats: {
            total_submissions: 0,
            pending_submissions: 0,
            approved_submissions: 0,
            rejected_submissions: 0,
            approval_rate: null,
            trust_level: 'novice',
            trust_points: 0,
            first_submission_at: null,
            last_submission_at: null,
            current_streak_days: 0,
            longest_streak_days: 0,
            set_submissions: 0,
            series_submissions: 0,
            card_submissions: 0
          }
        })
      }

      res.json({
        success: true,
        stats: {
          total_submissions: stats[0].total_submissions,
          pending_submissions: stats[0].pending_submissions,
          approved_submissions: stats[0].approved_submissions,
          rejected_submissions: stats[0].rejected_submissions,
          approval_rate: stats[0].approval_rate ? Number(stats[0].approval_rate) : null,
          trust_level: stats[0].trust_level,
          trust_points: stats[0].trust_points,
          first_submission_at: stats[0].first_submission_at,
          last_submission_at: stats[0].last_submission_at,
          current_streak_days: stats[0].current_streak_days,
          longest_streak_days: stats[0].longest_streak_days,
          set_submissions: stats[0].set_submissions || 0,
          series_submissions: stats[0].series_submissions || 0,
          card_submissions: stats[0].card_submissions || 0
        }
      })

    } catch (error) {
      console.error('Error fetching contributor stats:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch contributor stats'
      })
    }
  }
)

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

// Check if user is admin
const adminCheck = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    })
  }
  next()
}

// Get pending submissions for review (admin only)
router.get('/review-queue',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      const submissions = await prisma.$queryRawUnsafe(`
        SELECT
          ces.submission_id,
          ces.card_id,
          ces.user_id,
          u.username as submitter_username,
          u.email as submitter_email,
          cs.trust_level as submitter_trust_level,
          cs.approval_rate as submitter_approval_rate,
          ces.proposed_card_number,
          ces.proposed_is_rookie,
          ces.proposed_is_autograph,
          ces.proposed_is_relic,
          ces.proposed_is_short_print,
          ces.proposed_print_run,
          ces.proposed_notes,
          ces.submission_notes,
          ces.created_at,
          c.card_number as current_card_number,
          c.is_rookie as current_is_rookie,
          c.is_autograph as current_is_autograph,
          c.is_relic as current_is_relic,
          c.is_short_print as current_is_short_print,
          c.print_run as current_print_run,
          c.notes as current_notes,
          s.name as series_name,
          st.name as set_name,
          st.year as set_year,
          (
            SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
            FROM card_player cp
            JOIN player p ON cp.player = p.player_id
            WHERE cp.card = c.card_id
          ) as player_names
        FROM card_edit_submissions ces
        JOIN card c ON ces.card_id = c.card_id
        JOIN [user] u ON ces.user_id = u.user_id
        LEFT JOIN contributor_stats cs ON ces.user_id = cs.user_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        WHERE ces.status = 'pending'
        ORDER BY ces.created_at ASC
        OFFSET ${offsetNum} ROWS FETCH NEXT ${limitNum} ROWS ONLY
      `)

      // Get total count
      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*) as total
        FROM card_edit_submissions
        WHERE status = 'pending'
      `

      // Serialize BigInts
      const serialized = submissions.map(s => ({
        submission_id: Number(s.submission_id),
        card_id: Number(s.card_id),
        user_id: Number(s.user_id),
        submitter_username: s.submitter_username,
        submitter_email: s.submitter_email,
        submitter_trust_level: s.submitter_trust_level || 'novice',
        submitter_approval_rate: s.submitter_approval_rate ? Number(s.submitter_approval_rate) : null,
        proposed_card_number: s.proposed_card_number,
        proposed_is_rookie: s.proposed_is_rookie,
        proposed_is_autograph: s.proposed_is_autograph,
        proposed_is_relic: s.proposed_is_relic,
        proposed_is_short_print: s.proposed_is_short_print,
        proposed_print_run: s.proposed_print_run ? Number(s.proposed_print_run) : null,
        proposed_notes: s.proposed_notes,
        submission_notes: s.submission_notes,
        created_at: s.created_at,
        current_card_number: s.current_card_number,
        current_is_rookie: s.current_is_rookie,
        current_is_autograph: s.current_is_autograph,
        current_is_relic: s.current_is_relic,
        current_is_short_print: s.current_is_short_print,
        current_print_run: s.current_print_run ? Number(s.current_print_run) : null,
        current_notes: s.current_notes,
        series_name: s.series_name,
        set_name: s.set_name,
        set_year: s.set_year ? Number(s.set_year) : null,
        player_names: s.player_names
      }))

      res.json({
        success: true,
        submissions: serialized,
        total: Number(countResult[0].total),
        limit: limitNum,
        offset: offsetNum
      })

    } catch (error) {
      console.error('Error fetching review queue:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch review queue'
      })
    }
  }
)

// Approve a submission (admin only)
router.post('/review/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get the submission
      const submission = await prisma.$queryRaw`
        SELECT submission_id, card_id, user_id, status,
               proposed_card_number, proposed_is_rookie, proposed_is_autograph,
               proposed_is_relic, proposed_is_short_print, proposed_print_run,
               proposed_notes
        FROM card_edit_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Submission not found'
        })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({
          error: 'Invalid state',
          message: 'Submission has already been reviewed'
        })
      }

      const sub = submission[0]

      // Apply the changes to the card
      // Only update fields that were proposed (not null)
      let updateParts = []
      if (sub.proposed_card_number !== null) updateParts.push(`card_number = '${sub.proposed_card_number.replace(/'/g, "''")}'`)
      if (sub.proposed_is_rookie !== null) updateParts.push(`is_rookie = ${sub.proposed_is_rookie ? 1 : 0}`)
      if (sub.proposed_is_autograph !== null) updateParts.push(`is_autograph = ${sub.proposed_is_autograph ? 1 : 0}`)
      if (sub.proposed_is_relic !== null) updateParts.push(`is_relic = ${sub.proposed_is_relic ? 1 : 0}`)
      if (sub.proposed_is_short_print !== null) updateParts.push(`is_short_print = ${sub.proposed_is_short_print ? 1 : 0}`)
      if (sub.proposed_print_run !== null) updateParts.push(`print_run = ${sub.proposed_print_run}`)
      if (sub.proposed_notes !== null) updateParts.push(`notes = '${sub.proposed_notes.replace(/'/g, "''")}'`)

      if (updateParts.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE card SET ${updateParts.join(', ')} WHERE card_id = ${sub.card_id}
        `)
      }

      // Update the submission status
      await prisma.$executeRaw`
        UPDATE card_edit_submissions
        SET status = 'approved',
            reviewed_by = ${reviewerId},
            reviewed_at = GETDATE(),
            review_notes = ${review_notes || null},
            updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      // Update contributor stats
      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: 'Submission approved and changes applied'
      })

    } catch (error) {
      console.error('Error approving submission:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to approve submission'
      })
    }
  }
)

// Reject a submission (admin only)
router.post('/review/:submissionId/reject',
  authMiddleware,
  adminCheck,
  body('review_notes').isString().isLength({ min: 10, max: 2000 }).withMessage('Review notes required (min 10 characters)'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get the submission
      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status
        FROM card_edit_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Submission not found'
        })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({
          error: 'Invalid state',
          message: 'Submission has already been reviewed'
        })
      }

      // Update the submission status
      await prisma.$executeRaw`
        UPDATE card_edit_submissions
        SET status = 'rejected',
            reviewed_by = ${reviewerId},
            reviewed_at = GETDATE(),
            review_notes = ${review_notes},
            updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      // Update contributor stats
      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({
        success: true,
        message: 'Submission rejected'
      })

    } catch (error) {
      console.error('Error rejecting submission:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to reject submission'
      })
    }
  }
)

// Get overall crowdsourcing stats (admin only)
router.get('/admin/stats',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const stats = await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*) FROM card_edit_submissions) as total_card_edits,
          (SELECT COUNT(*) FROM card_edit_submissions WHERE status = 'pending') as pending_card_edits,
          (SELECT COUNT(*) FROM set_submissions) as total_sets,
          (SELECT COUNT(*) FROM set_submissions WHERE status = 'pending') as pending_sets,
          (SELECT COUNT(*) FROM series_submissions) as total_series,
          (SELECT COUNT(*) FROM series_submissions WHERE status = 'pending') as pending_series,
          (SELECT COUNT(*) FROM card_submissions) as total_cards,
          (SELECT COUNT(*) FROM card_submissions WHERE status = 'pending') as pending_cards,
          (SELECT COUNT(DISTINCT user_id) FROM contributor_stats) as unique_contributors,
          (SELECT COUNT(*) FROM contributor_stats WHERE trust_level != 'novice') as trusted_contributors
      `

      res.json({
        success: true,
        stats: {
          total_card_edits: Number(stats[0].total_card_edits),
          pending_card_edits: Number(stats[0].pending_card_edits),
          total_sets: Number(stats[0].total_sets),
          pending_sets: Number(stats[0].pending_sets),
          total_series: Number(stats[0].total_series),
          pending_series: Number(stats[0].pending_series),
          total_cards: Number(stats[0].total_cards),
          pending_cards: Number(stats[0].pending_cards),
          total_pending: Number(stats[0].pending_card_edits) + Number(stats[0].pending_sets) + Number(stats[0].pending_series) + Number(stats[0].pending_cards),
          unique_contributors: Number(stats[0].unique_contributors),
          trusted_contributors: Number(stats[0].trusted_contributors)
        }
      })

    } catch (error) {
      console.error('Error fetching admin stats:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch stats'
      })
    }
  }
)

// =============================================================================
// UNIFIED ADMIN REVIEW QUEUE (all submission types)
// =============================================================================

// Get all pending submissions for review (admin only)
router.get('/admin/review-all',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const { type, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      const results = { sets: [], series: [], cards: [], card_edits: [] }

      // Get set submissions
      if (!type || type === 'set') {
        const sets = await prisma.$queryRaw`
          SELECT ss.submission_id, ss.user_id, ss.proposed_name, ss.proposed_year,
                 ss.proposed_sport, ss.proposed_manufacturer, ss.proposed_description,
                 ss.submission_notes, ss.status, ss.created_at,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM set_submissions ss
          JOIN [user] u ON ss.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ss.user_id = cs.user_id
          WHERE ss.status = 'pending'
          ORDER BY ss.created_at ASC
        `
        results.sets = sets.map(s => ({
          submission_type: 'set',
          submission_id: Number(s.submission_id),
          user_id: Number(s.user_id),
          submitter_username: s.submitter_username,
          submitter_email: s.submitter_email,
          submitter_trust_level: s.submitter_trust_level || 'novice',
          submitter_approval_rate: s.submitter_approval_rate ? Number(s.submitter_approval_rate) : null,
          proposed_name: s.proposed_name,
          proposed_year: s.proposed_year,
          proposed_sport: s.proposed_sport,
          proposed_manufacturer: s.proposed_manufacturer,
          proposed_description: s.proposed_description,
          submission_notes: s.submission_notes,
          created_at: s.created_at
        }))
      }

      // Get series submissions
      if (!type || type === 'series') {
        const series = await prisma.$queryRaw`
          SELECT ss.submission_id, ss.user_id, ss.set_id, ss.set_submission_id,
                 ss.proposed_name, ss.proposed_description, ss.proposed_base_card_count,
                 ss.proposed_is_parallel, ss.proposed_parallel_name, ss.proposed_print_run,
                 ss.submission_notes, ss.status, ss.created_at,
                 s.name as set_name, s.year as set_year,
                 sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM series_submissions ss
          LEFT JOIN [set] s ON ss.set_id = s.set_id
          LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
          JOIN [user] u ON ss.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ss.user_id = cs.user_id
          WHERE ss.status = 'pending'
          ORDER BY ss.created_at ASC
        `
        results.series = series.map(s => ({
          submission_type: 'series',
          submission_id: Number(s.submission_id),
          user_id: Number(s.user_id),
          set_id: s.set_id ? Number(s.set_id) : null,
          set_submission_id: s.set_submission_id ? Number(s.set_submission_id) : null,
          submitter_username: s.submitter_username,
          submitter_email: s.submitter_email,
          submitter_trust_level: s.submitter_trust_level || 'novice',
          submitter_approval_rate: s.submitter_approval_rate ? Number(s.submitter_approval_rate) : null,
          proposed_name: s.proposed_name,
          proposed_description: s.proposed_description,
          proposed_base_card_count: s.proposed_base_card_count ? Number(s.proposed_base_card_count) : null,
          proposed_is_parallel: s.proposed_is_parallel,
          proposed_parallel_name: s.proposed_parallel_name,
          proposed_print_run: s.proposed_print_run ? Number(s.proposed_print_run) : null,
          set_name: s.set_name || s.pending_set_name,
          set_year: s.set_year || s.pending_set_year,
          submission_notes: s.submission_notes,
          created_at: s.created_at
        }))
      }

      // Get card submissions (new cards)
      if (!type || type === 'card') {
        // Get valid colors from database for validation
        const validColors = await prisma.$queryRaw`SELECT name FROM color`
        const validColorNames = new Set(validColors.map(c => c.name.toLowerCase()))

        const cards = await prisma.$queryRaw`
          SELECT cs.submission_id, cs.user_id, cs.series_id, cs.series_submission_id,
                 cs.batch_id, cs.batch_sequence, cs.proposed_card_number,
                 cs.proposed_player_names, cs.proposed_team_names,
                 cs.proposed_is_rookie, cs.proposed_is_autograph, cs.proposed_is_relic,
                 cs.proposed_is_short_print, cs.proposed_print_run, cs.proposed_notes,
                 cs.proposed_color, cs.submission_notes, cs.status, cs.created_at,
                 s.name as series_name, st.name as set_name, st.year as set_year,
                 u.username as submitter_username, u.email as submitter_email,
                 cst.trust_level as submitter_trust_level, cst.approval_rate as submitter_approval_rate
          FROM card_submissions cs
          LEFT JOIN series s ON cs.series_id = s.series_id
          LEFT JOIN [set] st ON s.[set] = st.set_id
          JOIN [user] u ON cs.user_id = u.user_id
          LEFT JOIN contributor_stats cst ON cs.user_id = cst.user_id
          WHERE cs.status = 'pending'
          ORDER BY cs.created_at ASC
        `
        results.cards = cards.map(c => {
          // Check if proposed_color is valid (exists in our color table)
          const hasInvalidColor = c.proposed_color && !validColorNames.has(c.proposed_color.toLowerCase())

          return {
            submission_type: 'card',
            submission_id: Number(c.submission_id),
            user_id: Number(c.user_id),
            series_id: c.series_id ? Number(c.series_id) : null,
            series_submission_id: c.series_submission_id ? Number(c.series_submission_id) : null,
            batch_id: c.batch_id,
            batch_sequence: c.batch_sequence,
            submitter_username: c.submitter_username,
            submitter_email: c.submitter_email,
            submitter_trust_level: c.submitter_trust_level || 'novice',
            submitter_approval_rate: c.submitter_approval_rate ? Number(c.submitter_approval_rate) : null,
            proposed_card_number: c.proposed_card_number,
            proposed_player_names: c.proposed_player_names,
            proposed_team_names: c.proposed_team_names,
            proposed_is_rookie: c.proposed_is_rookie,
            proposed_is_autograph: c.proposed_is_autograph,
            proposed_is_relic: c.proposed_is_relic,
            proposed_is_short_print: c.proposed_is_short_print,
            proposed_print_run: c.proposed_print_run ? Number(c.proposed_print_run) : null,
            proposed_color: c.proposed_color,
            proposed_notes: c.proposed_notes,
            series_name: c.series_name,
            set_name: c.set_name,
            set_year: c.set_year ? Number(c.set_year) : null,
            submission_notes: c.submission_notes,
            created_at: c.created_at,
            // Flag for admin review - true if color was provided but doesn't match our database
            has_invalid_color: hasInvalidColor
          }
        })
      }

      // Get card edit submissions
      if (!type || type === 'card_edit') {
        const cardEdits = await prisma.$queryRaw`
          SELECT ces.submission_id, ces.card_id, ces.user_id,
                 ces.proposed_card_number, ces.proposed_is_rookie, ces.proposed_is_autograph,
                 ces.proposed_is_relic, ces.proposed_is_short_print, ces.proposed_print_run,
                 ces.proposed_notes, ces.submission_notes, ces.created_at,
                 c.card_number as current_card_number, c.is_rookie as current_is_rookie,
                 c.is_autograph as current_is_autograph, c.is_relic as current_is_relic,
                 c.is_short_print as current_is_short_print, c.print_run as current_print_run,
                 c.notes as current_notes,
                 s.name as series_name, st.name as set_name, st.year as set_year,
                 (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                  FROM card_player_team cpt
                  JOIN player_team pt ON cpt.player_team = pt.player_team_id
                  JOIN player p ON pt.player = p.player_id
                  WHERE cpt.card = c.card_id) as player_names,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM card_edit_submissions ces
          JOIN card c ON ces.card_id = c.card_id
          LEFT JOIN series s ON c.series = s.series_id
          LEFT JOIN [set] st ON s.[set] = st.set_id
          JOIN [user] u ON ces.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ces.user_id = cs.user_id
          WHERE ces.status = 'pending'
          ORDER BY ces.created_at ASC
        `
        results.card_edits = cardEdits.map(ce => ({
          submission_type: 'card_edit',
          submission_id: Number(ce.submission_id),
          card_id: Number(ce.card_id),
          user_id: Number(ce.user_id),
          submitter_username: ce.submitter_username,
          submitter_email: ce.submitter_email,
          submitter_trust_level: ce.submitter_trust_level || 'novice',
          submitter_approval_rate: ce.submitter_approval_rate ? Number(ce.submitter_approval_rate) : null,
          proposed_card_number: ce.proposed_card_number,
          proposed_is_rookie: ce.proposed_is_rookie,
          proposed_is_autograph: ce.proposed_is_autograph,
          proposed_is_relic: ce.proposed_is_relic,
          proposed_is_short_print: ce.proposed_is_short_print,
          proposed_print_run: ce.proposed_print_run ? Number(ce.proposed_print_run) : null,
          proposed_notes: ce.proposed_notes,
          current_card_number: ce.current_card_number,
          current_is_rookie: ce.current_is_rookie,
          current_is_autograph: ce.current_is_autograph,
          current_is_relic: ce.current_is_relic,
          current_is_short_print: ce.current_is_short_print,
          current_print_run: ce.current_print_run ? Number(ce.current_print_run) : null,
          current_notes: ce.current_notes,
          player_names: ce.player_names,
          series_name: ce.series_name,
          set_name: ce.set_name,
          set_year: ce.set_year ? Number(ce.set_year) : null,
          submission_notes: ce.submission_notes,
          created_at: ce.created_at
        }))
      }

      // Combine and sort by created_at
      const allSubmissions = [
        ...results.sets,
        ...results.series,
        ...results.cards,
        ...results.card_edits
      ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(offsetNum, offsetNum + limitNum)

      res.json({
        success: true,
        submissions: allSubmissions,
        counts: {
          sets: results.sets.length,
          series: results.series.length,
          cards: results.cards.length,
          card_edits: results.card_edits.length,
          total: results.sets.length + results.series.length + results.cards.length + results.card_edits.length
        }
      })

    } catch (error) {
      console.error('Error fetching admin review queue:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch review queue'
      })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR SET SUBMISSIONS
// =============================================================================

// Approve a set submission (admin only)
router.post('/admin/review/set/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get the submission
      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status, proposed_name, proposed_year,
               proposed_sport, proposed_manufacturer, proposed_description
        FROM set_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Look up organization ID by sport
      const orgResult = await prisma.$queryRaw`
        SELECT organization_id FROM organization WHERE abbreviation = ${sub.proposed_sport} OR name = ${sub.proposed_sport}
      `
      const organizationId = orgResult.length > 0 ? orgResult[0].organization_id : null

      // Look up or create manufacturer
      let manufacturerId = null
      if (sub.proposed_manufacturer) {
        const mfgResult = await prisma.$queryRaw`
          SELECT manufacturer_id FROM manufacturer WHERE name = ${sub.proposed_manufacturer}
        `
        if (mfgResult.length > 0) {
          manufacturerId = mfgResult[0].manufacturer_id
        }
        // If not found, we could create it but for now just leave null
      }

      // Generate slug from name
      const slug = `${sub.proposed_year}-${sub.proposed_name}`
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Create the set
      const newSet = await prisma.$queryRaw`
        INSERT INTO [set] (name, year, organization, manufacturer, slug, created, is_complete)
        OUTPUT INSERTED.set_id
        VALUES (${sub.proposed_name}, ${sub.proposed_year}, ${organizationId}, ${manufacturerId},
                ${slug}, GETDATE(), 0)
      `

      // Update the submission
      await prisma.$executeRaw`
        UPDATE set_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, created_set_id = ${newSet[0].set_id}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      // Update contributor stats
      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: 'Set created successfully',
        set_id: Number(newSet[0].set_id)
      })

    } catch (error) {
      console.error('Error approving set submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a set submission (admin only)
router.post('/admin/review/set/:submissionId/reject',
  authMiddleware,
  adminCheck,
  body('review_notes').isString().isLength({ min: 10, max: 2000 }).withMessage('Review notes required'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', message: errors.array()[0].msg })
      }

      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status FROM set_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE set_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting set submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR SERIES SUBMISSIONS
// =============================================================================

// Approve a series submission (admin only)
router.post('/admin/review/series/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status, set_id, set_submission_id,
               proposed_name, proposed_description, proposed_base_card_count,
               proposed_is_parallel, proposed_parallel_name, proposed_print_run
        FROM series_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Determine the set_id - either directly or from approved set submission
      let setId = sub.set_id
      if (!setId && sub.set_submission_id) {
        const setSubmission = await prisma.$queryRaw`
          SELECT created_set_id FROM set_submissions WHERE submission_id = ${sub.set_submission_id} AND status = 'approved'
        `
        if (setSubmission.length > 0 && setSubmission[0].created_set_id) {
          setId = setSubmission[0].created_set_id
        } else {
          return res.status(400).json({
            error: 'Invalid state',
            message: 'The parent set submission must be approved first'
          })
        }
      }

      if (!setId) {
        return res.status(400).json({ error: 'Invalid state', message: 'No valid set reference' })
      }

      // Generate slug from name
      const seriesSlug = sub.proposed_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Create the series - get the max ID after insert since triggers prevent OUTPUT clause
      await prisma.$executeRaw`
        INSERT INTO series ([set], name, slug, card_count, is_base, created)
        VALUES (${setId}, ${sub.proposed_name}, ${seriesSlug},
                ${sub.proposed_base_card_count || 0}, ${!sub.proposed_is_parallel}, GETDATE())
      `
      // Get the series we just created by matching the unique slug
      const newSeriesResult = await prisma.$queryRaw`
        SELECT series_id FROM series WHERE slug = ${seriesSlug}
      `
      const newSeriesId = newSeriesResult[0].series_id

      // Update the submission
      await prisma.$executeRaw`
        UPDATE series_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, created_series_id = ${newSeriesId}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: 'Series created successfully',
        series_id: Number(newSeriesId)
      })

    } catch (error) {
      console.error('Error approving series submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a series submission (admin only)
router.post('/admin/review/series/:submissionId/reject',
  authMiddleware,
  adminCheck,
  body('review_notes').isString().isLength({ min: 10, max: 2000 }).withMessage('Review notes required'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', message: errors.array()[0].msg })
      }

      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status FROM series_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE series_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting series submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR CARD SUBMISSIONS (NEW CARDS)
// =============================================================================

// Approve a card submission (admin only)
router.post('/admin/review/card/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status, series_id, series_submission_id,
               proposed_card_number, proposed_player_names, proposed_team_names,
               proposed_is_rookie, proposed_is_autograph, proposed_is_relic,
               proposed_is_short_print, proposed_print_run, proposed_notes
        FROM card_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Determine the series_id
      let seriesId = sub.series_id
      if (!seriesId && sub.series_submission_id) {
        const seriesSubmission = await prisma.$queryRaw`
          SELECT created_series_id FROM series_submissions WHERE submission_id = ${sub.series_submission_id} AND status = 'approved'
        `
        if (seriesSubmission.length > 0 && seriesSubmission[0].created_series_id) {
          seriesId = seriesSubmission[0].created_series_id
        } else {
          return res.status(400).json({
            error: 'Invalid state',
            message: 'The parent series submission must be approved first'
          })
        }
      }

      if (!seriesId) {
        return res.status(400).json({ error: 'Invalid state', message: 'No valid series reference' })
      }

      // Create the card - use separate insert and query due to triggers
      await prisma.$executeRaw`
        INSERT INTO card (series, card_number, is_rookie, is_autograph, is_relic, is_short_print, print_run, notes, created)
        VALUES (${seriesId}, ${sub.proposed_card_number},
                ${sub.proposed_is_rookie || false}, ${sub.proposed_is_autograph || false},
                ${sub.proposed_is_relic || false}, ${sub.proposed_is_short_print || false},
                ${sub.proposed_print_run || null}, ${sub.proposed_notes || null}, GETDATE())
      `
      // Get the card we just created by matching series and card number
      const newCardResult = await prisma.$queryRaw`
        SELECT card_id FROM card WHERE series = ${seriesId} AND card_number = ${sub.proposed_card_number}
      `
      const newCardId = newCardResult[0].card_id

      // Update the submission
      await prisma.$executeRaw`
        UPDATE card_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, created_card_id = ${newCardId}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      // Note: card count is now updated by the trigger trg_update_series_card_entered_count

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: 'Card created successfully',
        card_id: Number(newCardId)
      })

    } catch (error) {
      console.error('Error approving card submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a card submission (admin only)
router.post('/admin/review/card/:submissionId/reject',
  authMiddleware,
  adminCheck,
  body('review_notes').isString().isLength({ min: 10, max: 2000 }).withMessage('Review notes required'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', message: errors.array()[0].msg })
      }

      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status FROM card_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE card_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting card submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR CARD EDIT SUBMISSIONS
// =============================================================================

// Approve a card edit submission (admin only)
router.post('/admin/review/card-edit/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      // Get the submission
      const submission = await prisma.$queryRaw`
        SELECT submission_id, card_id, user_id, status,
               proposed_card_number, proposed_is_rookie, proposed_is_autograph,
               proposed_is_relic, proposed_is_short_print, proposed_print_run,
               proposed_notes
        FROM card_edit_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Apply the changes to the card
      let updateParts = []
      if (sub.proposed_card_number !== null) updateParts.push(`card_number = '${sub.proposed_card_number.replace(/'/g, "''")}'`)
      if (sub.proposed_is_rookie !== null) updateParts.push(`is_rookie = ${sub.proposed_is_rookie ? 1 : 0}`)
      if (sub.proposed_is_autograph !== null) updateParts.push(`is_autograph = ${sub.proposed_is_autograph ? 1 : 0}`)
      if (sub.proposed_is_relic !== null) updateParts.push(`is_relic = ${sub.proposed_is_relic ? 1 : 0}`)
      if (sub.proposed_is_short_print !== null) updateParts.push(`is_short_print = ${sub.proposed_is_short_print ? 1 : 0}`)
      if (sub.proposed_print_run !== null) updateParts.push(`print_run = ${sub.proposed_print_run}`)
      if (sub.proposed_notes !== null) updateParts.push(`notes = '${sub.proposed_notes.replace(/'/g, "''")}'`)

      if (updateParts.length > 0) {
        await prisma.$executeRawUnsafe(`UPDATE card SET ${updateParts.join(', ')} WHERE card_id = ${sub.card_id}`)
      }

      // Update the submission status
      await prisma.$executeRaw`
        UPDATE card_edit_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({ success: true, message: 'Submission approved and changes applied' })

    } catch (error) {
      console.error('Error approving card edit submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a card edit submission (admin only)
router.post('/admin/review/card-edit/:submissionId/reject',
  authMiddleware,
  adminCheck,
  body('review_notes').isString().isLength({ min: 10, max: 2000 }).withMessage('Review notes required'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', message: errors.array()[0].msg })
      }

      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, user_id, status FROM card_edit_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE card_edit_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting card edit submission:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// TEMPLATE DOWNLOAD
// =============================================================================

// Download series checklist template
router.get('/template/series-checklist',
  authMiddleware,
  async (req, res) => {
    try {
      // Get colors from database for dropdown
      const colors = await prisma.$queryRaw`SELECT name FROM color ORDER BY name`
      const colorNames = colors.map(c => c.name)

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Collect Your Cards'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Checklist')

      // Define columns with headers and widths
      worksheet.columns = [
        { header: 'Card Number', key: 'cardNumber', width: 12 },
        { header: 'Player(s)', key: 'players', width: 45 },
        { header: 'Team(s)', key: 'teams', width: 55 },
        { header: 'RC', key: 'rc', width: 6 },
        { header: 'Auto', key: 'auto', width: 6 },
        { header: 'Relic', key: 'relic', width: 6 },
        { header: 'SP', key: 'sp', width: 6 },
        { header: 'Color', key: 'color', width: 14 },
        { header: 'Print Run', key: 'printRun', width: 10 },
        { header: 'Notes', key: 'notes', width: 30 }
      ]

      // Style header row
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      }
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

      // Example data rows - use "/" for multiple players/teams
      const exampleData = [
        { cardNumber: '1', players: 'Mike Trout', teams: 'Los Angeles Angels', rc: '', auto: '', relic: '', sp: '', color: '', printRun: '', notes: '' },
        { cardNumber: '2', players: 'Shohei Ohtani', teams: 'Los Angeles Dodgers', rc: 'RC', auto: '', relic: '', sp: '', color: '', printRun: '', notes: 'MVP candidate' },
        { cardNumber: '3', players: 'Juan Soto / Aaron Judge / Giancarlo Stanton', teams: 'New York Mets / New York Yankees / New York Yankees', rc: '', auto: '', relic: '', sp: '', color: '', printRun: '', notes: 'Multi-player card' },
        { cardNumber: '4', players: 'Ronald Acuna Jr.', teams: 'Atlanta Braves', rc: '', auto: 'Auto', relic: '', sp: '', color: '', printRun: '', notes: 'On-card auto' },
        { cardNumber: '5', players: 'Mookie Betts', teams: 'Los Angeles Dodgers', rc: '', auto: '', relic: 'Relic', sp: '', color: '', printRun: '', notes: 'Jersey swatch' },
        { cardNumber: '6', players: 'Freddie Freeman', teams: 'Los Angeles Dodgers', rc: '', auto: '', relic: '', sp: 'SP', color: '', printRun: '', notes: 'Short print' },
        { cardNumber: '7', players: 'Corey Seager', teams: 'Texas Rangers', rc: '', auto: '', relic: '', sp: '', color: 'Gold', printRun: '50', notes: 'Numbered to 50' },
        { cardNumber: '8', players: 'Julio Rodriguez', teams: 'Seattle Mariners', rc: 'RC', auto: 'Auto', relic: 'Relic', sp: '', color: 'Red', printRun: '25', notes: 'Rookie patch auto' }
      ]

      exampleData.forEach(row => worksheet.addRow(row))

      // Add data validation (dropdown) for Color column (column H)
      // Apply to rows 2-500 to cover plenty of data entry
      for (let row = 2; row <= 500; row++) {
        worksheet.getCell(`H${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${colorNames.join(',')}"`],
          showDropDown: true
        }
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()

      // Send as download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="series-checklist-template.xlsx"')
      res.send(buffer)

    } catch (error) {
      console.error('Error generating template:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to generate template' })
    }
  }
)

module.exports = router
