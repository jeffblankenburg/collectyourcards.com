const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../config/prisma-singleton')
const { Prisma } = require('@prisma/client')
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

      // Check if user is admin (auto-approve)
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      if (isAdmin) {
        // Admin: Create the set directly and record as approved submission

        // Look up manufacturer_id if provided
        let manufacturerId = null
        if (manufacturer) {
          const mfr = await prisma.$queryRaw`
            SELECT manufacturer_id FROM manufacturer WHERE name = ${manufacturer}
          `
          if (mfr.length > 0) {
            manufacturerId = mfr[0].manufacturer_id
          }
        }

        // Look up organization_id based on sport
        let organizationId = null
        const sportToOrg = {
          'Baseball': 'MLB',
          'Football': 'NFL',
          'Basketball': 'NBA',
          'Hockey': 'NHL',
          'Soccer': 'MLS'
        }
        const orgAbbrev = sportToOrg[sport]
        if (orgAbbrev) {
          const org = await prisma.$queryRaw`
            SELECT organization_id FROM organization WHERE abbreviation = ${orgAbbrev}
          `
          if (org.length > 0) {
            organizationId = org[0].organization_id
          }
        }

        // Generate slug
        const slug = name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()

        // Create the actual set
        const newSet = await prisma.$queryRaw`
          INSERT INTO [set] (name, year, organization, manufacturer, slug, card_count, series_count, is_complete, created)
          OUTPUT INSERTED.set_id
          VALUES (${name}, ${year}, ${organizationId}, ${manufacturerId}, ${slug}, 0, 1, 0, GETDATE())
        `

        const setId = newSet[0].set_id

        // Create base series with the same name
        const seriesSlug = slug // Same slug as set for base series
        await prisma.$queryRaw`
          INSERT INTO series (name, [set], slug, is_base, card_count, created)
          VALUES (${name}, ${setId}, ${seriesSlug}, 1, 0, GETDATE())
        `

        // Create approved submission record for audit trail
        const result = await prisma.$queryRaw`
          INSERT INTO set_submissions (
            user_id, set_id, proposed_name, proposed_year, proposed_sport,
            proposed_manufacturer, proposed_description,
            submission_notes, status, reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId}, ${setId}, ${name}, ${year}, ${sport},
            ${manufacturer || null}, ${description || null},
            ${submission_notes || null}, 'approved', ${userId}, GETDATE(), GETDATE()
          )
        `

        // Update contributor stats (auto-approved)
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              approved_submissions = approved_submissions + 1,
              set_submissions = set_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Set created successfully',
          submission_id: Number(result[0].submission_id),
          set_id: Number(setId),
          auto_approved: true
        })
      } else {
        // Regular user: Create pending submission for review
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
          submission_id: Number(result[0].submission_id),
          auto_approved: false
        })
      }

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
        is_parallel, parallel_of_series_id, print_run, submission_notes
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

      // Check if user is admin (auto-approve)
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      if (isAdmin && set_id) {
        // Admin: Create the series directly (only if we have set_id, not set_submission_id)

        // Generate slug
        const slug = name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()

        // Create the actual series
        // Note: series table doesn't have description/is_parallel columns - those are stored in series_submissions
        // Use OUTPUT INTO because series table has triggers
        const newSeries = await prisma.$queryRaw`
          DECLARE @InsertedSeries TABLE (series_id BIGINT);
          INSERT INTO series (name, [set], slug, parallel_of_series, min_print_run, max_print_run, card_count, created)
          OUTPUT INSERTED.series_id INTO @InsertedSeries
          VALUES (${name}, ${set_id}, ${slug}, ${parallel_of_series_id || null},
                  ${print_run || null}, ${print_run || null}, 0, GETDATE());
          SELECT series_id FROM @InsertedSeries;
        `

        const seriesId = newSeries[0].series_id

        // Update the set's series_count
        await prisma.$executeRaw`
          UPDATE [set] SET series_count = series_count + 1 WHERE set_id = ${set_id}
        `

        // Create approved submission record for audit trail
        const result = await prisma.$queryRaw`
          INSERT INTO series_submissions (
            user_id, set_id, created_series_id, proposed_name, proposed_description,
            proposed_base_card_count, proposed_is_parallel, proposed_parallel_of_series,
            proposed_print_run, submission_notes, status, reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId}, ${set_id}, ${seriesId},
            ${name}, ${description || null}, ${base_card_count || null},
            ${is_parallel || false}, ${parallel_of_series_id ? BigInt(parallel_of_series_id) : null},
            ${print_run || null}, ${submission_notes || null}, 'approved', ${userId}, GETDATE(), GETDATE()
          )
        `

        // Update contributor stats (auto-approved)
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              approved_submissions = approved_submissions + 1,
              series_submissions = series_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Series created successfully!',
          submission_id: Number(result[0].submission_id),
          series_id: Number(seriesId),
          auto_approved: true
        })
      } else {
        // Regular user OR admin with set_submission_id: Create pending submission for review
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

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)

        // Increment series_submissions count
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET series_submissions = series_submissions + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Series suggestion submitted successfully',
          submission_id: Number(seriesSubmissionId),
          auto_approved: false
        })
      }

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
          (SELECT COUNT(*) FROM player_edit_submissions) as total_player_edits,
          (SELECT COUNT(*) FROM player_edit_submissions WHERE status = 'pending') as pending_player_edits,
          (SELECT COUNT(*) FROM player_alias_submissions) as total_player_aliases,
          (SELECT COUNT(*) FROM player_alias_submissions WHERE status = 'pending') as pending_player_aliases,
          (SELECT COUNT(*) FROM player_team_submissions) as total_player_teams,
          (SELECT COUNT(*) FROM player_team_submissions WHERE status = 'pending') as pending_player_teams,
          (SELECT COUNT(DISTINCT user_id) FROM contributor_stats) as unique_contributors,
          (SELECT COUNT(*) FROM contributor_stats WHERE trust_level != 'novice') as trusted_contributors
      `

      const s = stats[0]
      const totalPending = Number(s.pending_card_edits) + Number(s.pending_sets) + Number(s.pending_series) + Number(s.pending_cards) + Number(s.pending_player_edits) + Number(s.pending_player_aliases) + Number(s.pending_player_teams)

      res.json({
        success: true,
        stats: {
          total_card_edits: Number(s.total_card_edits),
          pending_card_edits: Number(s.pending_card_edits),
          total_sets: Number(s.total_sets),
          pending_sets: Number(s.pending_sets),
          total_series: Number(s.total_series),
          pending_series: Number(s.pending_series),
          total_cards: Number(s.total_cards),
          pending_cards: Number(s.pending_cards),
          total_player_edits: Number(s.total_player_edits),
          pending_player_edits: Number(s.pending_player_edits),
          total_player_aliases: Number(s.total_player_aliases),
          pending_player_aliases: Number(s.pending_player_aliases),
          total_player_teams: Number(s.total_player_teams),
          pending_player_teams: Number(s.pending_player_teams),
          total_pending: totalPending,
          unique_contributors: Number(s.unique_contributors),
          trusted_contributors: Number(s.trusted_contributors)
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

      const results = { sets: [], series: [], cards: [], card_edits: [], player_edits: [], player_aliases: [], player_teams: [], team_edits: [] }

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

        // Check if proposed_color column exists (for backwards compatibility)
        const hasColorColumn = await prisma.$queryRaw`
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'card_submissions' AND COLUMN_NAME = 'proposed_color'
        `
        const includeColor = hasColorColumn.length > 0

        const cards = includeColor
          ? await prisma.$queryRaw`
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
          : await prisma.$queryRaw`
              SELECT cs.submission_id, cs.user_id, cs.series_id, cs.series_submission_id,
                     cs.batch_id, cs.batch_sequence, cs.proposed_card_number,
                     cs.proposed_player_names, cs.proposed_team_names,
                     cs.proposed_is_rookie, cs.proposed_is_autograph, cs.proposed_is_relic,
                     cs.proposed_is_short_print, cs.proposed_print_run, cs.proposed_notes,
                     cs.submission_notes, cs.status, cs.created_at,
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
          const proposedColor = c.proposed_color || null
          const hasInvalidColor = proposedColor && !validColorNames.has(proposedColor.toLowerCase())

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
            proposed_color: proposedColor,
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

      // Get player edit submissions
      if (!type || type === 'player_edit') {
        const playerEdits = await prisma.$queryRaw`
          SELECT pes.submission_id, pes.player_id, pes.user_id,
                 pes.previous_first_name, pes.previous_last_name, pes.previous_nick_name,
                 pes.previous_birthdate, pes.previous_is_hof,
                 pes.proposed_first_name, pes.proposed_last_name, pes.proposed_nick_name,
                 pes.proposed_birthdate, pes.proposed_is_hof,
                 pes.submission_notes, pes.status, pes.created_at,
                 p.first_name as current_first_name, p.last_name as current_last_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_edit_submissions pes
          JOIN player p ON pes.player_id = p.player_id
          JOIN [user] u ON pes.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pes.user_id = cs.user_id
          WHERE pes.status = 'pending'
          ORDER BY pes.created_at ASC
        `
        results.player_edits = playerEdits.map(pe => ({
          submission_type: 'player_edit',
          submission_id: Number(pe.submission_id),
          player_id: Number(pe.player_id),
          user_id: Number(pe.user_id),
          submitter_username: pe.submitter_username,
          submitter_email: pe.submitter_email,
          submitter_trust_level: pe.submitter_trust_level || 'novice',
          submitter_approval_rate: pe.submitter_approval_rate ? Number(pe.submitter_approval_rate) : null,
          player_name: `${pe.current_first_name} ${pe.current_last_name}`,
          previous_first_name: pe.previous_first_name,
          previous_last_name: pe.previous_last_name,
          previous_nick_name: pe.previous_nick_name,
          previous_birthdate: pe.previous_birthdate,
          previous_is_hof: pe.previous_is_hof,
          proposed_first_name: pe.proposed_first_name,
          proposed_last_name: pe.proposed_last_name,
          proposed_nick_name: pe.proposed_nick_name,
          proposed_birthdate: pe.proposed_birthdate,
          proposed_is_hof: pe.proposed_is_hof,
          submission_notes: pe.submission_notes,
          created_at: pe.created_at
        }))
      }

      // Get player alias submissions
      if (!type || type === 'player_alias') {
        const playerAliases = await prisma.$queryRaw`
          SELECT pas.submission_id, pas.player_id, pas.user_id,
                 pas.proposed_alias_name, pas.proposed_alias_type,
                 pas.submission_notes, pas.status, pas.created_at,
                 p.first_name, p.last_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_alias_submissions pas
          JOIN player p ON pas.player_id = p.player_id
          JOIN [user] u ON pas.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pas.user_id = cs.user_id
          WHERE pas.status = 'pending'
          ORDER BY pas.created_at ASC
        `
        results.player_aliases = playerAliases.map(pa => ({
          submission_type: 'player_alias',
          submission_id: Number(pa.submission_id),
          player_id: Number(pa.player_id),
          user_id: Number(pa.user_id),
          submitter_username: pa.submitter_username,
          submitter_email: pa.submitter_email,
          submitter_trust_level: pa.submitter_trust_level || 'novice',
          submitter_approval_rate: pa.submitter_approval_rate ? Number(pa.submitter_approval_rate) : null,
          player_name: `${pa.first_name} ${pa.last_name}`,
          proposed_alias_name: pa.proposed_alias_name,
          proposed_alias_type: pa.proposed_alias_type,
          submission_notes: pa.submission_notes,
          created_at: pa.created_at
        }))
      }

      // Get player-team submissions
      if (!type || type === 'player_team') {
        const playerTeams = await prisma.$queryRaw`
          SELECT pts.submission_id, pts.player_id, pts.team_id, pts.user_id,
                 pts.action_type, pts.submission_notes, pts.status, pts.created_at,
                 p.first_name, p.last_name, t.name as team_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_team_submissions pts
          JOIN player p ON pts.player_id = p.player_id
          JOIN team t ON pts.team_id = t.team_Id
          JOIN [user] u ON pts.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pts.user_id = cs.user_id
          WHERE pts.status = 'pending'
          ORDER BY pts.created_at ASC
        `
        results.player_teams = playerTeams.map(pt => ({
          submission_type: 'player_team',
          submission_id: Number(pt.submission_id),
          player_id: Number(pt.player_id),
          team_id: Number(pt.team_id),
          user_id: Number(pt.user_id),
          submitter_username: pt.submitter_username,
          submitter_email: pt.submitter_email,
          submitter_trust_level: pt.submitter_trust_level || 'novice',
          submitter_approval_rate: pt.submitter_approval_rate ? Number(pt.submitter_approval_rate) : null,
          player_name: `${pt.first_name} ${pt.last_name}`,
          team_name: pt.team_name,
          action_type: pt.action_type,
          submission_notes: pt.submission_notes,
          created_at: pt.created_at
        }))
      }

      // Get team edit submissions
      if (!type || type === 'team_edit') {
        const teamEdits = await prisma.$queryRaw`
          SELECT tes.submission_id, tes.team_id, tes.user_id,
                 tes.previous_name, tes.previous_city, tes.previous_mascot,
                 tes.previous_abbreviation, tes.previous_primary_color, tes.previous_secondary_color,
                 tes.proposed_name, tes.proposed_city, tes.proposed_mascot,
                 tes.proposed_abbreviation, tes.proposed_primary_color, tes.proposed_secondary_color,
                 tes.submission_notes, tes.created_at,
                 t.name as current_team_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM team_edit_submissions tes
          JOIN team t ON tes.team_id = t.team_Id
          JOIN [user] u ON tes.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON tes.user_id = cs.user_id
          WHERE tes.status = 'pending'
          ORDER BY tes.created_at ASC
        `
        results.team_edits = teamEdits.map(te => ({
          submission_type: 'team_edit',
          submission_id: Number(te.submission_id),
          team_id: Number(te.team_id),
          user_id: Number(te.user_id),
          submitter_username: te.submitter_username,
          submitter_email: te.submitter_email,
          submitter_trust_level: te.submitter_trust_level || 'novice',
          submitter_approval_rate: te.submitter_approval_rate ? Number(te.submitter_approval_rate) : null,
          current_team_name: te.current_team_name,
          previous_name: te.previous_name,
          previous_city: te.previous_city,
          previous_mascot: te.previous_mascot,
          previous_abbreviation: te.previous_abbreviation,
          previous_primary_color: te.previous_primary_color,
          previous_secondary_color: te.previous_secondary_color,
          proposed_name: te.proposed_name,
          proposed_city: te.proposed_city,
          proposed_mascot: te.proposed_mascot,
          proposed_abbreviation: te.proposed_abbreviation,
          proposed_primary_color: te.proposed_primary_color,
          proposed_secondary_color: te.proposed_secondary_color,
          submission_notes: te.submission_notes,
          created_at: te.created_at
        }))
      }

      // Combine and sort by created_at
      const allSubmissions = [
        ...results.sets,
        ...results.series,
        ...results.cards,
        ...results.card_edits,
        ...results.player_edits,
        ...results.player_aliases,
        ...results.player_teams,
        ...results.team_edits
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
          player_edits: results.player_edits.length,
          player_aliases: results.player_aliases.length,
          player_teams: results.player_teams.length,
          team_edits: results.team_edits.length,
          total: results.sets.length + results.series.length + results.cards.length + results.card_edits.length + results.player_edits.length + results.player_aliases.length + results.player_teams.length + results.team_edits.length
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
        INSERT INTO [set] (name, year, organization, manufacturer, slug, card_count, series_count, created, is_complete)
        OUTPUT INSERTED.set_id
        VALUES (${sub.proposed_name}, ${sub.proposed_year}, ${organizationId}, ${manufacturerId},
                ${slug}, 0, 1, GETDATE(), 0)
      `

      const setId = newSet[0].set_id

      // Create base series with the same name
      await prisma.$queryRaw`
        INSERT INTO series (name, [set], slug, is_parallel, card_count, created)
        VALUES (${sub.proposed_name}, ${setId}, ${slug}, 0, 0, GETDATE())
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

// =============================================================================
// PLAYER EDIT SUBMISSIONS
// =============================================================================

// Submit player edit suggestion
router.post('/player-edit',
  authMiddleware,
  submissionLimiter,
  body('player_id').isInt({ min: 1 }).withMessage('Player ID is required'),
  body('proposed_first_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_last_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_nick_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_birthdate').optional({ nullable: true }).isISO8601(),
  body('proposed_is_hof').optional({ nullable: true }).isBoolean(),
  body('proposed_display_card').optional({ nullable: true }).isInt({ min: 1 }),
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
        player_id,
        proposed_first_name,
        proposed_last_name,
        proposed_nick_name,
        proposed_birthdate,
        proposed_is_hof,
        proposed_display_card,
        submission_notes
      } = req.body

      // Verify player exists and get current values
      const player = await prisma.$queryRaw`
        SELECT player_id, first_name, last_name, nick_name, birthdate, is_hof, display_card
        FROM player WHERE player_id = ${BigInt(player_id)}
      `

      if (player.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Player not found'
        })
      }

      const current = player[0]
      const currentDisplayCard = current.display_card ? Number(current.display_card) : null

      // If display card is being changed, verify it belongs to this player and has an image
      if (proposed_display_card !== undefined && proposed_display_card !== null) {
        const cardCheck = await prisma.$queryRawUnsafe(`
          SELECT c.card_id, front_photo.photo_url as front_image_url
          FROM card c
          INNER JOIN card_player_team cpt ON c.card_id = cpt.card
          INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
          LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
          LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
          WHERE pt.player = ${player_id} AND c.card_id = ${proposed_display_card}
        `)

        if (cardCheck.length === 0) {
          return res.status(400).json({
            error: 'Invalid card',
            message: 'The specified card does not belong to this player'
          })
        }

        if (!cardCheck[0].front_image_url) {
          return res.status(400).json({
            error: 'No image',
            message: 'The specified card does not have an image'
          })
        }
      }

      // Check that at least one field is being changed
      const hasChanges = (
        (proposed_first_name !== undefined && proposed_first_name !== current.first_name) ||
        (proposed_last_name !== undefined && proposed_last_name !== current.last_name) ||
        (proposed_nick_name !== undefined && proposed_nick_name !== current.nick_name) ||
        (proposed_birthdate !== undefined) ||
        (proposed_is_hof !== undefined && proposed_is_hof !== current.is_hof) ||
        (proposed_display_card !== undefined && proposed_display_card !== currentDisplayCard)
      )

      if (!hasChanges) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'No changes proposed'
        })
      }

      // Check if user is admin (auto-approve)
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      if (isAdmin) {
        // Admin: Apply changes directly and create approved submission record
        let updateParts = []
        if (proposed_first_name !== undefined && proposed_first_name !== current.first_name) {
          updateParts.push(`first_name = '${proposed_first_name.replace(/'/g, "''")}'`)
        }
        if (proposed_last_name !== undefined && proposed_last_name !== current.last_name) {
          updateParts.push(`last_name = '${proposed_last_name.replace(/'/g, "''")}'`)
        }
        if (proposed_nick_name !== undefined && proposed_nick_name !== current.nick_name) {
          updateParts.push(`nick_name = ${proposed_nick_name ? `'${proposed_nick_name.replace(/'/g, "''")}'` : 'NULL'}`)
        }
        if (proposed_birthdate !== undefined) {
          updateParts.push(`birthdate = '${new Date(proposed_birthdate).toISOString().split('T')[0]}'`)
        }
        if (proposed_is_hof !== undefined && proposed_is_hof !== current.is_hof) {
          updateParts.push(`is_hof = ${proposed_is_hof ? 1 : 0}`)
        }
        if (proposed_display_card !== undefined && proposed_display_card !== currentDisplayCard) {
          updateParts.push(`display_card = ${proposed_display_card ? proposed_display_card : 'NULL'}`)
        }

        // Apply the changes to the player
        if (updateParts.length > 0) {
          await prisma.$executeRawUnsafe(`UPDATE player SET ${updateParts.join(', ')} WHERE player_id = ${player_id}`)
        }

        // Create an approved submission record for audit trail
        const result = await prisma.$queryRaw`
          INSERT INTO player_edit_submissions (
            player_id, user_id,
            previous_first_name, previous_last_name, previous_nick_name,
            previous_birthdate, previous_is_hof, previous_display_card,
            proposed_first_name, proposed_last_name, proposed_nick_name,
            proposed_birthdate, proposed_is_hof, proposed_display_card,
            submission_notes, status, reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${BigInt(player_id)}, ${userId},
            ${current.first_name}, ${current.last_name}, ${current.nick_name},
            ${current.birthdate}, ${current.is_hof}, ${current.display_card},
            ${proposed_first_name !== undefined ? proposed_first_name : null},
            ${proposed_last_name !== undefined ? proposed_last_name : null},
            ${proposed_nick_name !== undefined ? proposed_nick_name : null},
            ${proposed_birthdate !== undefined ? new Date(proposed_birthdate) : null},
            ${proposed_is_hof !== undefined ? proposed_is_hof : null},
            ${proposed_display_card !== undefined ? (proposed_display_card ? BigInt(proposed_display_card) : null) : null},
            ${submission_notes || null}, 'approved', ${userId}, GETDATE(), GETDATE()
          )
        `

        // Update contributor stats (auto-approved)
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              approved_submissions = approved_submissions + 1,
              player_edit_submissions = player_edit_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Player updated successfully',
          submission_id: Number(result[0].submission_id),
          auto_approved: true
        })
      } else {
        // Regular user: Create pending submission for review
        const result = await prisma.$queryRaw`
          INSERT INTO player_edit_submissions (
            player_id, user_id,
            previous_first_name, previous_last_name, previous_nick_name,
            previous_birthdate, previous_is_hof, previous_display_card,
            proposed_first_name, proposed_last_name, proposed_nick_name,
            proposed_birthdate, proposed_is_hof, proposed_display_card,
            submission_notes, status, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${BigInt(player_id)}, ${userId},
            ${current.first_name}, ${current.last_name}, ${current.nick_name},
            ${current.birthdate}, ${current.is_hof}, ${current.display_card},
            ${proposed_first_name !== undefined ? proposed_first_name : null},
            ${proposed_last_name !== undefined ? proposed_last_name : null},
            ${proposed_nick_name !== undefined ? proposed_nick_name : null},
            ${proposed_birthdate !== undefined ? new Date(proposed_birthdate) : null},
            ${proposed_is_hof !== undefined ? proposed_is_hof : null},
            ${proposed_display_card !== undefined ? (proposed_display_card ? BigInt(proposed_display_card) : null) : null},
            ${submission_notes || null}, 'pending', GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET player_edit_submissions = player_edit_submissions + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Player edit suggestion submitted successfully',
          submission_id: Number(result[0].submission_id),
          auto_approved: false
        })
      }

    } catch (error) {
      console.error('Error submitting player edit:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit player edit suggestion'
      })
    }
  }
)

// =============================================================================
// NEW PLAYER SUBMISSIONS
// =============================================================================

// Submit new player suggestion
router.post('/player',
  authMiddleware,
  submissionLimiter,
  body('proposed_first_name').isString().isLength({ min: 1, max: 255 }).withMessage('First name is required'),
  body('proposed_last_name').isString().isLength({ min: 1, max: 255 }).withMessage('Last name is required'),
  body('proposed_nick_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_birthdate').optional({ nullable: true }).isISO8601(),
  body('proposed_is_hof').optional().isBoolean(),
  body('proposed_team_ids').optional().isArray(),
  body('proposed_team_ids.*').optional().isInt({ min: 1 }),
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
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)
      const {
        proposed_first_name,
        proposed_last_name,
        proposed_nick_name,
        proposed_birthdate,
        proposed_is_hof,
        proposed_team_ids,
        submission_notes
      } = req.body

      // Check for duplicate player with same name
      const existingPlayer = await prisma.$queryRaw`
        SELECT player_id, first_name, last_name FROM player
        WHERE LOWER(first_name) = LOWER(${proposed_first_name.trim()})
          AND LOWER(last_name) = LOWER(${proposed_last_name.trim()})
      `

      if (existingPlayer.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: `A player named ${proposed_first_name} ${proposed_last_name} already exists in the database`,
          existing_player_id: Number(existingPlayer[0].player_id)
        })
      }

      // Check for pending submission with same name
      const pendingSubmission = await prisma.$queryRaw`
        SELECT submission_id FROM player_submissions
        WHERE LOWER(proposed_first_name) = LOWER(${proposed_first_name.trim()})
          AND LOWER(proposed_last_name) = LOWER(${proposed_last_name.trim()})
          AND status = 'pending'
      `

      if (pendingSubmission.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: `A pending submission for ${proposed_first_name} ${proposed_last_name} already exists`
        })
      }

      // Verify all team_ids exist if provided
      if (proposed_team_ids && proposed_team_ids.length > 0) {
        const teamCheck = await prisma.$queryRaw`
          SELECT team_Id FROM team WHERE team_Id IN (${Prisma.join(proposed_team_ids)})
        `
        if (teamCheck.length !== proposed_team_ids.length) {
          return res.status(400).json({
            error: 'Invalid teams',
            message: 'One or more team IDs are invalid'
          })
        }
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Generate slug for the player
      const generateSlug = (firstName, lastName) => {
        const fullName = `${firstName} ${lastName}`.toLowerCase()
        return fullName
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }

      // Admin: Create player directly
      if (isAdmin) {
        let baseSlug = generateSlug(proposed_first_name.trim(), proposed_last_name.trim())
        let slug = baseSlug
        let slugCounter = 1

        // Check for slug uniqueness
        let slugExists = await prisma.$queryRaw`SELECT player_id FROM player WHERE slug = ${slug}`
        while (slugExists.length > 0) {
          slug = `${baseSlug}-${slugCounter}`
          slugExists = await prisma.$queryRaw`SELECT player_id FROM player WHERE slug = ${slug}`
          slugCounter++
        }

        // Create the player
        // Note: first_name_indexed, last_name_indexed, nick_name_indexed are computed columns
        const newPlayer = await prisma.$queryRaw`
          INSERT INTO player (
            first_name, last_name, nick_name, birthdate, is_hof,
            slug, created, card_count
          )
          OUTPUT INSERTED.player_id
          VALUES (
            ${proposed_first_name.trim()},
            ${proposed_last_name.trim()},
            ${proposed_nick_name?.trim() || null},
            ${proposed_birthdate ? new Date(proposed_birthdate) : null},
            ${proposed_is_hof || false},
            ${slug},
            GETDATE(),
            0
          )
        `

        const createdPlayerId = newPlayer[0].player_id

        // Create player-team associations if provided
        if (proposed_team_ids && proposed_team_ids.length > 0) {
          for (const teamId of proposed_team_ids) {
            await prisma.$executeRaw`
              INSERT INTO player_team (player, team, created, card_count)
              VALUES (${createdPlayerId}, ${teamId}, GETDATE(), 0)
            `
            // Update team player count
            await prisma.$executeRaw`
              UPDATE team SET player_count = player_count + 1 WHERE team_Id = ${teamId}
            `
          }
        }

        // Create approved submission record for audit trail
        await prisma.$queryRaw`
          INSERT INTO player_submissions (
            user_id, proposed_first_name, proposed_last_name, proposed_nick_name,
            proposed_birthdate, proposed_is_hof, proposed_team_ids,
            submission_notes, status, created_player_id,
            reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId},
            ${proposed_first_name.trim()},
            ${proposed_last_name.trim()},
            ${proposed_nick_name?.trim() || null},
            ${proposed_birthdate ? new Date(proposed_birthdate) : null},
            ${proposed_is_hof || false},
            ${proposed_team_ids ? JSON.stringify(proposed_team_ids) : null},
            ${submission_notes || 'Admin direct creation'},
            'approved',
            ${createdPlayerId},
            ${userId},
            GETDATE(),
            GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)
        await updateContributorStatsOnReview(userId, true)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET player_submissions = ISNULL(player_submissions, 0) + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Player created successfully',
          player_id: Number(createdPlayerId),
          auto_approved: true
        })

      } else {
        // Non-admin: Create pending submission for review
        const result = await prisma.$queryRaw`
          INSERT INTO player_submissions (
            user_id, proposed_first_name, proposed_last_name, proposed_nick_name,
            proposed_birthdate, proposed_is_hof, proposed_team_ids,
            submission_notes, status, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId},
            ${proposed_first_name.trim()},
            ${proposed_last_name.trim()},
            ${proposed_nick_name?.trim() || null},
            ${proposed_birthdate ? new Date(proposed_birthdate) : null},
            ${proposed_is_hof || false},
            ${proposed_team_ids ? JSON.stringify(proposed_team_ids) : null},
            ${submission_notes || null},
            'pending',
            GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET player_submissions = ISNULL(player_submissions, 0) + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'New player suggestion submitted for review',
          submission_id: Number(result[0].submission_id),
          auto_approved: false
        })
      }

    } catch (error) {
      console.error('Error submitting new player:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit new player suggestion'
      })
    }
  }
)

// =============================================================================
// PLAYER ALIAS SUBMISSIONS
// =============================================================================

// Submit player alias suggestion
router.post('/player-alias',
  authMiddleware,
  submissionLimiter,
  body('player_id').isInt({ min: 1 }).withMessage('Player ID is required'),
  body('proposed_alias_name').isString().isLength({ min: 1, max: 255 }).withMessage('Alias name is required'),
  body('proposed_alias_type').optional().isString().isIn(['misspelling', 'nickname', 'maiden_name', 'alternate_spelling', 'foreign_name']),
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
      const { player_id, proposed_alias_name, proposed_alias_type, submission_notes } = req.body

      // Verify player exists
      const player = await prisma.$queryRaw`
        SELECT player_id FROM player WHERE player_id = ${BigInt(player_id)}
      `

      if (player.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Player not found'
        })
      }

      // Check if this alias already exists for this player
      const existingAlias = await prisma.$queryRaw`
        SELECT alias_id FROM player_alias
        WHERE player_id = ${BigInt(player_id)} AND LOWER(alias_name) = LOWER(${proposed_alias_name})
      `

      if (existingAlias.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: 'This alias already exists for this player'
        })
      }

      // Check if there's already a pending submission for the same alias
      const pendingSubmission = await prisma.$queryRaw`
        SELECT submission_id FROM player_alias_submissions
        WHERE player_id = ${BigInt(player_id)}
          AND LOWER(proposed_alias_name) = LOWER(${proposed_alias_name})
          AND status = 'pending'
      `

      if (pendingSubmission.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: 'A pending submission for this alias already exists'
        })
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the submission
      const result = await prisma.$queryRaw`
        INSERT INTO player_alias_submissions (
          player_id, user_id, proposed_alias_name, proposed_alias_type,
          submission_notes, status, created_at
        )
        OUTPUT INSERTED.submission_id
        VALUES (
          ${BigInt(player_id)}, ${userId}, ${proposed_alias_name},
          ${proposed_alias_type || null}, ${submission_notes || null},
          'pending', GETDATE()
        )
      `

      // Update contributor stats
      await updateContributorStatsOnSubmit(userId)

      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET player_alias_submissions = player_alias_submissions + 1
        WHERE user_id = ${userId}
      `

      res.status(201).json({
        success: true,
        message: 'Player alias suggestion submitted successfully',
        submission_id: Number(result[0].submission_id)
      })

    } catch (error) {
      console.error('Error submitting player alias:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit player alias suggestion'
      })
    }
  }
)

// =============================================================================
// PLAYER TEAM SUBMISSIONS
// =============================================================================

// Submit player-team association suggestion (add or remove)
router.post('/player-team',
  authMiddleware,
  submissionLimiter,
  body('player_id').isInt({ min: 1 }).withMessage('Player ID is required'),
  body('team_id').isInt({ min: 1 }).withMessage('Team ID is required'),
  body('action_type').isIn(['add', 'remove']).withMessage('Action type must be "add" or "remove"'),
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
      const { player_id, team_id, action_type, submission_notes } = req.body

      // Verify player exists
      const player = await prisma.$queryRaw`
        SELECT player_id, first_name, last_name FROM player WHERE player_id = ${BigInt(player_id)}
      `

      if (player.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Player not found'
        })
      }

      // Verify team exists
      const team = await prisma.$queryRaw`
        SELECT team_Id, name FROM team WHERE team_Id = ${team_id}
      `

      if (team.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Team not found'
        })
      }

      // Check current association status
      const existingAssociation = await prisma.$queryRaw`
        SELECT player_team_id FROM player_team
        WHERE player = ${BigInt(player_id)} AND team = ${team_id}
      `

      if (action_type === 'add' && existingAssociation.length > 0) {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'This player is already associated with this team'
        })
      }

      if (action_type === 'remove' && existingAssociation.length === 0) {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'This player is not currently associated with this team'
        })
      }

      // Check for pending submission of same type
      const pendingSubmission = await prisma.$queryRaw`
        SELECT submission_id FROM player_team_submissions
        WHERE player_id = ${BigInt(player_id)}
          AND team_id = ${team_id}
          AND action_type = ${action_type}
          AND status = 'pending'
      `

      if (pendingSubmission.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: `A pending ${action_type} submission for this player-team association already exists`
        })
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Create the submission
      const result = await prisma.$queryRaw`
        INSERT INTO player_team_submissions (
          player_id, team_id, user_id, action_type,
          submission_notes, status, created_at
        )
        OUTPUT INSERTED.submission_id
        VALUES (
          ${BigInt(player_id)}, ${team_id}, ${userId}, ${action_type},
          ${submission_notes || null}, 'pending', GETDATE()
        )
      `

      // Update contributor stats
      await updateContributorStatsOnSubmit(userId)

      await prisma.$executeRaw`
        UPDATE contributor_stats
        SET player_team_submissions = player_team_submissions + 1
        WHERE user_id = ${userId}
      `

      res.status(201).json({
        success: true,
        message: `Player-team ${action_type} suggestion submitted successfully`,
        submission_id: Number(result[0].submission_id)
      })

    } catch (error) {
      console.error('Error submitting player-team:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit player-team suggestion'
      })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR PLAYER EDIT SUBMISSIONS
// =============================================================================

// Approve a player edit submission (admin only)
router.post('/admin/review/player-edit/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, player_id, user_id, status,
               proposed_first_name, proposed_last_name, proposed_nick_name,
               proposed_birthdate, proposed_is_hof, proposed_display_card
        FROM player_edit_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Apply changes to player
      let updateParts = []
      if (sub.proposed_first_name !== null) updateParts.push(`first_name = '${sub.proposed_first_name.replace(/'/g, "''")}'`)
      if (sub.proposed_last_name !== null) updateParts.push(`last_name = '${sub.proposed_last_name.replace(/'/g, "''")}'`)
      if (sub.proposed_nick_name !== null) updateParts.push(`nick_name = '${sub.proposed_nick_name.replace(/'/g, "''")}'`)
      if (sub.proposed_birthdate !== null) updateParts.push(`birthdate = '${sub.proposed_birthdate.toISOString().split('T')[0]}'`)
      if (sub.proposed_is_hof !== null) updateParts.push(`is_hof = ${sub.proposed_is_hof ? 1 : 0}`)
      if (sub.proposed_display_card !== null) updateParts.push(`display_card = ${sub.proposed_display_card}`)

      if (updateParts.length > 0) {
        await prisma.$executeRawUnsafe(`UPDATE player SET ${updateParts.join(', ')} WHERE player_id = ${sub.player_id}`)
      }

      // Update submission status
      await prisma.$executeRaw`
        UPDATE player_edit_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({ success: true, message: 'Player edit approved and changes applied' })

    } catch (error) {
      console.error('Error approving player edit:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a player edit submission (admin only)
router.post('/admin/review/player-edit/:submissionId/reject',
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
        SELECT submission_id, user_id, status FROM player_edit_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE player_edit_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting player edit:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR PLAYER ALIAS SUBMISSIONS
// =============================================================================

// Approve a player alias submission (admin only)
router.post('/admin/review/player-alias/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, player_id, user_id, status,
               proposed_alias_name, proposed_alias_type
        FROM player_alias_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Create the alias
      const newAlias = await prisma.$queryRaw`
        INSERT INTO player_alias (player_id, alias_name, alias_type, created_by, created)
        OUTPUT INSERTED.alias_id
        VALUES (${sub.player_id}, ${sub.proposed_alias_name}, ${sub.proposed_alias_type}, ${reviewerId}, GETDATE())
      `

      // Update submission status
      await prisma.$executeRaw`
        UPDATE player_alias_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, created_alias_id = ${newAlias[0].alias_id}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: 'Player alias approved and created',
        alias_id: Number(newAlias[0].alias_id)
      })

    } catch (error) {
      console.error('Error approving player alias:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a player alias submission (admin only)
router.post('/admin/review/player-alias/:submissionId/reject',
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
        SELECT submission_id, user_id, status FROM player_alias_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE player_alias_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting player alias:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR PLAYER TEAM SUBMISSIONS
// =============================================================================

// Approve a player-team submission (admin only)
router.post('/admin/review/player-team/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, player_id, team_id, user_id, status, action_type
        FROM player_team_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]
      let createdPlayerTeamId = null

      if (sub.action_type === 'add') {
        // Check if association already exists (could have been added directly by admin)
        const existing = await prisma.$queryRaw`
          SELECT player_team_id FROM player_team WHERE player = ${sub.player_id} AND team = ${sub.team_id}
        `

        if (existing.length > 0) {
          // Already exists, just mark as approved
          createdPlayerTeamId = existing[0].player_team_id
        } else {
          // Create the association
          const newAssoc = await prisma.$queryRaw`
            INSERT INTO player_team (player, team, created)
            OUTPUT INSERTED.player_team_id
            VALUES (${sub.player_id}, ${sub.team_id}, GETDATE())
          `
          createdPlayerTeamId = newAssoc[0].player_team_id
        }
      } else if (sub.action_type === 'remove') {
        // Remove the association
        await prisma.$executeRaw`
          DELETE FROM player_team WHERE player = ${sub.player_id} AND team = ${sub.team_id}
        `
      }

      // Update submission status
      await prisma.$executeRaw`
        UPDATE player_team_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null},
            created_player_team_id = ${createdPlayerTeamId},
            updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({
        success: true,
        message: `Player-team ${sub.action_type} approved`,
        player_team_id: createdPlayerTeamId ? Number(createdPlayerTeamId) : null
      })

    } catch (error) {
      console.error('Error approving player-team:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a player-team submission (admin only)
router.post('/admin/review/player-team/:submissionId/reject',
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
        SELECT submission_id, user_id, status FROM player_team_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE player_team_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting player-team:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// =============================================================================
// NEW TEAM SUBMISSIONS
// =============================================================================

// Submit new team suggestion
router.post('/team',
  authMiddleware,
  submissionLimiter,
  body('proposed_name').isString().isLength({ min: 1, max: 255 }).withMessage('Team name is required'),
  body('proposed_city').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_mascot').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_abbreviation').optional({ nullable: true }).isString().isLength({ min: 2, max: 10 }),
  body('proposed_organization_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('proposed_primary_color').optional({ nullable: true }).matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex color format'),
  body('proposed_secondary_color').optional({ nullable: true }).matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex color format'),
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
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)
      const {
        proposed_name,
        proposed_city,
        proposed_mascot,
        proposed_abbreviation,
        proposed_organization_id,
        proposed_primary_color,
        proposed_secondary_color,
        submission_notes
      } = req.body

      // Check for duplicate team with same name
      const existingTeam = await prisma.$queryRaw`
        SELECT team_Id, name FROM team
        WHERE LOWER(name) = LOWER(${proposed_name.trim()})
      `

      if (existingTeam.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: `A team named "${proposed_name}" already exists in the database`,
          existing_team_id: Number(existingTeam[0].team_Id)
        })
      }

      // Check for pending submission with same name
      const pendingSubmission = await prisma.$queryRaw`
        SELECT submission_id FROM team_submissions
        WHERE LOWER(proposed_name) = LOWER(${proposed_name.trim()})
          AND status = 'pending'
      `

      if (pendingSubmission.length > 0) {
        return res.status(400).json({
          error: 'Duplicate',
          message: `A pending submission for team "${proposed_name}" already exists`
        })
      }

      // Verify organization exists if provided
      if (proposed_organization_id) {
        const orgCheck = await prisma.$queryRaw`
          SELECT organization_id FROM organization WHERE organization_id = ${proposed_organization_id}
        `
        if (orgCheck.length === 0) {
          return res.status(400).json({
            error: 'Invalid organization',
            message: 'The specified organization does not exist'
          })
        }
      }

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      // Generate slug for the team
      const generateSlug = (name) => {
        return name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }

      // Admin: Create team directly
      if (isAdmin) {
        let baseSlug = generateSlug(proposed_name.trim())
        let slug = baseSlug
        let slugCounter = 1

        // Check for slug uniqueness
        let slugExists = await prisma.$queryRaw`SELECT team_Id FROM team WHERE slug = ${slug}`
        while (slugExists.length > 0) {
          slug = `${baseSlug}-${slugCounter}`
          slugExists = await prisma.$queryRaw`SELECT team_Id FROM team WHERE slug = ${slug}`
          slugCounter++
        }

        // Create the team
        const newTeam = await prisma.$queryRaw`
          INSERT INTO team (
            name, city, mascot, abbreviation, organization,
            primary_color, secondary_color,
            slug, created, card_count, player_count
          )
          OUTPUT INSERTED.team_Id
          VALUES (
            ${proposed_name.trim()},
            ${proposed_city?.trim() || null},
            ${proposed_mascot?.trim() || null},
            ${proposed_abbreviation?.trim()?.toUpperCase() || null},
            ${proposed_organization_id || null},
            ${proposed_primary_color || null},
            ${proposed_secondary_color || null},
            ${slug},
            GETDATE(),
            0,
            0
          )
        `

        const createdTeamId = newTeam[0].team_Id

        // Create approved submission record for audit trail
        await prisma.$queryRaw`
          INSERT INTO team_submissions (
            user_id, proposed_name, proposed_city, proposed_mascot,
            proposed_abbreviation, proposed_organization_id,
            proposed_primary_color, proposed_secondary_color,
            submission_notes, status, created_team_id,
            reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId},
            ${proposed_name.trim()},
            ${proposed_city?.trim() || null},
            ${proposed_mascot?.trim() || null},
            ${proposed_abbreviation?.trim()?.toUpperCase() || null},
            ${proposed_organization_id || null},
            ${proposed_primary_color || null},
            ${proposed_secondary_color || null},
            ${submission_notes || 'Admin direct creation'},
            'approved',
            ${createdTeamId},
            ${userId},
            GETDATE(),
            GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)
        await updateContributorStatsOnReview(userId, true)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET team_submissions = ISNULL(team_submissions, 0) + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Team created successfully',
          team_id: Number(createdTeamId),
          auto_approved: true
        })

      } else {
        // Non-admin: Create pending submission for review
        const result = await prisma.$queryRaw`
          INSERT INTO team_submissions (
            user_id, proposed_name, proposed_city, proposed_mascot,
            proposed_abbreviation, proposed_organization_id,
            proposed_primary_color, proposed_secondary_color,
            submission_notes, status, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${userId},
            ${proposed_name.trim()},
            ${proposed_city?.trim() || null},
            ${proposed_mascot?.trim() || null},
            ${proposed_abbreviation?.trim()?.toUpperCase() || null},
            ${proposed_organization_id || null},
            ${proposed_primary_color || null},
            ${proposed_secondary_color || null},
            ${submission_notes || null},
            'pending',
            GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET team_submissions = ISNULL(team_submissions, 0) + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'New team suggestion submitted for review',
          submission_id: Number(result[0].submission_id),
          auto_approved: false
        })
      }

    } catch (error) {
      console.error('Error submitting new team:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit new team suggestion'
      })
    }
  }
)

// =============================================================================
// SET EDIT SUBMISSIONS
// =============================================================================

// Submit set edit suggestion
router.post('/set-edit',
  authMiddleware,
  submissionLimiter,
  body('set_id').isInt({ min: 1 }).withMessage('Set ID is required'),
  body('proposed_name').optional({ nullable: true }).isString().isLength({ min: 3, max: 255 }),
  body('proposed_year').optional({ nullable: true }).isInt({ min: 1887, max: 2100 }),
  body('proposed_sport').optional({ nullable: true }).isString().isLength({ min: 2, max: 50 }),
  body('proposed_manufacturer').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_description').optional({ nullable: true }).isString().isLength({ max: 2000 }),
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
        set_id,
        proposed_name,
        proposed_year,
        proposed_sport,
        proposed_manufacturer,
        proposed_description,
        submission_notes
      } = req.body

      // Verify set exists and get current values
      const setResult = await prisma.$queryRaw`
        SELECT s.set_id, s.name, s.year, s.manufacturer,
               m.name as manufacturer_name,
               o.name as organization_name
        FROM [set] s
        LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
        LEFT JOIN organization o ON s.organization = o.organization_id
        WHERE s.set_id = ${set_id}
      `

      if (setResult.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Set not found'
        })
      }

      const current = setResult[0]

      // Determine current sport from organization
      const currentSport = current.organization_name ?
        (current.organization_name.toLowerCase().includes('baseball') ? 'Baseball' :
         current.organization_name.toLowerCase().includes('football') ? 'Football' :
         current.organization_name.toLowerCase().includes('basketball') ? 'Basketball' :
         current.organization_name.toLowerCase().includes('hockey') ? 'Hockey' :
         current.organization_name.toLowerCase().includes('soccer') ? 'Soccer' : 'Other') : 'Other'

      // Check that at least one field is being changed
      const hasChanges = (
        (proposed_name !== undefined && proposed_name !== current.name) ||
        (proposed_year !== undefined && proposed_year !== current.year) ||
        (proposed_sport !== undefined && proposed_sport !== currentSport) ||
        (proposed_manufacturer !== undefined && proposed_manufacturer !== current.manufacturer_name) ||
        (proposed_description !== undefined)
      )

      if (!hasChanges) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'No changes proposed'
        })
      }

      // Check if user is admin (auto-approve)
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      if (isAdmin) {
        // Admin: Apply changes directly
        let updateParts = []

        if (proposed_name !== undefined && proposed_name !== current.name) {
          updateParts.push(`name = '${proposed_name.replace(/'/g, "''")}'`)
          // Update slug when name changes
          const slug = proposed_name.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/'/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          updateParts.push(`slug = '${slug}'`)
        }

        if (proposed_year !== undefined && proposed_year !== current.year) {
          updateParts.push(`year = ${proposed_year}`)
        }

        // Handle manufacturer - look up by name
        if (proposed_manufacturer !== undefined && proposed_manufacturer !== current.manufacturer_name) {
          if (proposed_manufacturer) {
            const mfr = await prisma.$queryRaw`
              SELECT manufacturer_id FROM manufacturer WHERE name = ${proposed_manufacturer}
            `
            if (mfr.length > 0) {
              updateParts.push(`manufacturer = ${mfr[0].manufacturer_id}`)
            }
          } else {
            updateParts.push(`manufacturer = NULL`)
          }
        }

        // Apply changes to set
        if (updateParts.length > 0) {
          await prisma.$executeRawUnsafe(`UPDATE [set] SET ${updateParts.join(', ')} WHERE set_id = ${set_id}`)
        }

        // Create approved submission record for audit trail
        await prisma.$executeRaw`
          INSERT INTO set_submissions (
            user_id, set_id, proposed_name, proposed_year, proposed_sport,
            proposed_manufacturer, proposed_description, submission_notes,
            previous_name, previous_year, previous_sport, previous_manufacturer,
            status, reviewed_by, reviewed_at, created_at, updated_at
          ) VALUES (
            ${userId}, ${set_id}, ${proposed_name || null}, ${proposed_year || null}, ${proposed_sport || null},
            ${proposed_manufacturer || null}, ${proposed_description || null}, ${submission_notes || null},
            ${current.name}, ${current.year}, ${currentSport}, ${current.manufacturer_name || null},
            'approved', ${userId}, GETDATE(), GETDATE(), GETDATE()
          )
        `

        // Update contributor stats
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              approved_submissions = approved_submissions + 1,
              set_submissions = set_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(200).json({
          success: true,
          message: 'Set updated successfully',
          auto_approved: true
        })

      } else {
        // Regular user: Create pending submission
        await prisma.$executeRaw`
          INSERT INTO set_submissions (
            user_id, set_id, proposed_name, proposed_year, proposed_sport,
            proposed_manufacturer, proposed_description, submission_notes,
            previous_name, previous_year, previous_sport, previous_manufacturer,
            status, created_at, updated_at
          ) VALUES (
            ${userId}, ${set_id}, ${proposed_name || null}, ${proposed_year || null}, ${proposed_sport || null},
            ${proposed_manufacturer || null}, ${proposed_description || null}, ${submission_notes || null},
            ${current.name}, ${current.year}, ${currentSport}, ${current.manufacturer_name || null},
            'pending', GETDATE(), GETDATE()
          )
        `

        // Update contributor stats
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              pending_submissions = pending_submissions + 1,
              set_submissions = set_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Set edit submitted for review',
          auto_approved: false
        })
      }

    } catch (error) {
      console.error('Error submitting set edit:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit set edit'
      })
    }
  }
)

// =============================================================================
// TEAM EDIT SUBMISSIONS
// =============================================================================

// Submit team edit suggestion
router.post('/team-edit',
  authMiddleware,
  submissionLimiter,
  body('team_id').isInt({ min: 1 }).withMessage('Team ID is required'),
  body('proposed_name').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_city').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_mascot').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('proposed_abbreviation').optional({ nullable: true }).isString().isLength({ max: 10 }),
  body('proposed_primary_color').optional({ nullable: true }).matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex color format'),
  body('proposed_secondary_color').optional({ nullable: true }).matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex color format'),
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
        team_id,
        proposed_name,
        proposed_city,
        proposed_mascot,
        proposed_abbreviation,
        proposed_primary_color,
        proposed_secondary_color,
        submission_notes
      } = req.body

      // Verify team exists and get current values
      const team = await prisma.$queryRaw`
        SELECT team_Id, name, city, mascot, abbreviation, primary_color, secondary_color
        FROM team WHERE team_Id = ${team_id}
      `

      if (team.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Team not found'
        })
      }

      const current = team[0]

      // Check that at least one field is being changed
      const hasChanges = (
        (proposed_name !== undefined && proposed_name !== current.name) ||
        (proposed_city !== undefined && proposed_city !== current.city) ||
        (proposed_mascot !== undefined && proposed_mascot !== current.mascot) ||
        (proposed_abbreviation !== undefined && proposed_abbreviation !== current.abbreviation) ||
        (proposed_primary_color !== undefined && proposed_primary_color !== current.primary_color) ||
        (proposed_secondary_color !== undefined && proposed_secondary_color !== current.secondary_color)
      )

      if (!hasChanges) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'No changes proposed'
        })
      }

      // Check if user is admin (auto-approve)
      const isAdmin = ['admin', 'superadmin', 'data_admin'].includes(req.user.role)

      // Ensure contributor stats exist
      await ensureContributorStats(userId)

      if (isAdmin) {
        // Admin: Apply changes directly and create approved submission record
        let updateParts = []
        if (proposed_name !== undefined && proposed_name !== current.name) {
          updateParts.push(`name = '${proposed_name.replace(/'/g, "''")}'`)
          // Also update slug when name changes
          const slug = proposed_name.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/'/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          updateParts.push(`slug = '${slug}'`)
        }
        if (proposed_city !== undefined && proposed_city !== current.city) {
          updateParts.push(`city = ${proposed_city ? `'${proposed_city.replace(/'/g, "''")}'` : 'NULL'}`)
        }
        if (proposed_mascot !== undefined && proposed_mascot !== current.mascot) {
          updateParts.push(`mascot = ${proposed_mascot ? `'${proposed_mascot.replace(/'/g, "''")}'` : 'NULL'}`)
        }
        if (proposed_abbreviation !== undefined && proposed_abbreviation !== current.abbreviation) {
          updateParts.push(`abbreviation = ${proposed_abbreviation ? `'${proposed_abbreviation.replace(/'/g, "''")}'` : 'NULL'}`)
        }
        if (proposed_primary_color !== undefined && proposed_primary_color !== current.primary_color) {
          updateParts.push(`primary_color = ${proposed_primary_color ? `'${proposed_primary_color}'` : 'NULL'}`)
        }
        if (proposed_secondary_color !== undefined && proposed_secondary_color !== current.secondary_color) {
          updateParts.push(`secondary_color = ${proposed_secondary_color ? `'${proposed_secondary_color}'` : 'NULL'}`)
        }

        // Apply the changes to the team
        if (updateParts.length > 0) {
          await prisma.$executeRawUnsafe(`UPDATE team SET ${updateParts.join(', ')} WHERE team_Id = ${team_id}`)
        }

        // Create an approved submission record for audit trail
        const result = await prisma.$queryRaw`
          INSERT INTO team_edit_submissions (
            team_id, user_id,
            previous_name, previous_city, previous_mascot,
            previous_abbreviation, previous_primary_color, previous_secondary_color,
            proposed_name, proposed_city, proposed_mascot,
            proposed_abbreviation, proposed_primary_color, proposed_secondary_color,
            submission_notes, status, reviewed_by, reviewed_at, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${team_id}, ${userId},
            ${current.name}, ${current.city}, ${current.mascot},
            ${current.abbreviation}, ${current.primary_color}, ${current.secondary_color},
            ${proposed_name !== undefined ? proposed_name : null},
            ${proposed_city !== undefined ? proposed_city : null},
            ${proposed_mascot !== undefined ? proposed_mascot : null},
            ${proposed_abbreviation !== undefined ? proposed_abbreviation : null},
            ${proposed_primary_color !== undefined ? proposed_primary_color : null},
            ${proposed_secondary_color !== undefined ? proposed_secondary_color : null},
            ${submission_notes || null}, 'approved', ${userId}, GETDATE(), GETDATE()
          )
        `

        // Update contributor stats (auto-approved)
        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET total_submissions = total_submissions + 1,
              approved_submissions = approved_submissions + 1,
              team_edit_submissions = team_edit_submissions + 1,
              last_submission_at = GETDATE()
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Team updated successfully',
          submission_id: Number(result[0].submission_id),
          auto_approved: true
        })
      } else {
        // Regular user: Create pending submission for review
        const result = await prisma.$queryRaw`
          INSERT INTO team_edit_submissions (
            team_id, user_id,
            previous_name, previous_city, previous_mascot,
            previous_abbreviation, previous_primary_color, previous_secondary_color,
            proposed_name, proposed_city, proposed_mascot,
            proposed_abbreviation, proposed_primary_color, proposed_secondary_color,
            submission_notes, status, created_at
          )
          OUTPUT INSERTED.submission_id
          VALUES (
            ${team_id}, ${userId},
            ${current.name}, ${current.city}, ${current.mascot},
            ${current.abbreviation}, ${current.primary_color}, ${current.secondary_color},
            ${proposed_name !== undefined ? proposed_name : null},
            ${proposed_city !== undefined ? proposed_city : null},
            ${proposed_mascot !== undefined ? proposed_mascot : null},
            ${proposed_abbreviation !== undefined ? proposed_abbreviation : null},
            ${proposed_primary_color !== undefined ? proposed_primary_color : null},
            ${proposed_secondary_color !== undefined ? proposed_secondary_color : null},
            ${submission_notes || null}, 'pending', GETDATE()
          )
        `

        // Update contributor stats
        await updateContributorStatsOnSubmit(userId)

        await prisma.$executeRaw`
          UPDATE contributor_stats
          SET team_edit_submissions = team_edit_submissions + 1
          WHERE user_id = ${userId}
        `

        res.status(201).json({
          success: true,
          message: 'Team edit suggestion submitted successfully',
          submission_id: Number(result[0].submission_id),
          auto_approved: false
        })
      }

    } catch (error) {
      console.error('Error submitting team edit:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit team edit suggestion'
      })
    }
  }
)

// =============================================================================
// ADMIN REVIEW ACTIONS FOR TEAM EDIT SUBMISSIONS
// =============================================================================

// Approve a team edit submission (admin only)
router.post('/admin/review/team-edit/:submissionId/approve',
  authMiddleware,
  adminCheck,
  body('review_notes').optional().isString().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const { submissionId } = req.params
      const { review_notes } = req.body
      const reviewerId = BigInt(req.user.userId)

      const submission = await prisma.$queryRaw`
        SELECT submission_id, team_id, user_id, status,
               proposed_name, proposed_city, proposed_mascot,
               proposed_abbreviation, proposed_primary_color, proposed_secondary_color
        FROM team_edit_submissions
        WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      const sub = submission[0]

      // Apply changes to team
      let updateParts = []
      if (sub.proposed_name !== null) {
        updateParts.push(`name = '${sub.proposed_name.replace(/'/g, "''")}'`)
        // Also update slug when name changes
        const slug = sub.proposed_name.toLowerCase()
          .replace(/&/g, 'and')
          .replace(/'/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        updateParts.push(`slug = '${slug}'`)
      }
      if (sub.proposed_city !== null) updateParts.push(`city = '${sub.proposed_city.replace(/'/g, "''")}'`)
      if (sub.proposed_mascot !== null) updateParts.push(`mascot = '${sub.proposed_mascot.replace(/'/g, "''")}'`)
      if (sub.proposed_abbreviation !== null) updateParts.push(`abbreviation = '${sub.proposed_abbreviation.replace(/'/g, "''")}'`)
      if (sub.proposed_primary_color !== null) updateParts.push(`primary_color = '${sub.proposed_primary_color}'`)
      if (sub.proposed_secondary_color !== null) updateParts.push(`secondary_color = '${sub.proposed_secondary_color}'`)

      if (updateParts.length > 0) {
        await prisma.$executeRawUnsafe(`UPDATE team SET ${updateParts.join(', ')} WHERE team_Id = ${sub.team_id}`)
      }

      // Update submission status
      await prisma.$executeRaw`
        UPDATE team_edit_submissions
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes || null}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(sub.user_id, true)

      res.json({ success: true, message: 'Team edit approved and changes applied' })

    } catch (error) {
      console.error('Error approving team edit:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to approve submission' })
    }
  }
)

// Reject a team edit submission (admin only)
router.post('/admin/review/team-edit/:submissionId/reject',
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
        SELECT submission_id, user_id, status FROM team_edit_submissions WHERE submission_id = ${BigInt(submissionId)}
      `

      if (submission.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Submission not found' })
      }

      if (submission[0].status !== 'pending') {
        return res.status(400).json({ error: 'Invalid state', message: 'Submission has already been reviewed' })
      }

      await prisma.$executeRaw`
        UPDATE team_edit_submissions
        SET status = 'rejected', reviewed_by = ${reviewerId}, reviewed_at = GETDATE(),
            review_notes = ${review_notes}, updated_at = GETDATE()
        WHERE submission_id = ${BigInt(submissionId)}
      `

      await updateContributorStatsOnReview(submission[0].user_id, false)

      res.json({ success: true, message: 'Submission rejected' })

    } catch (error) {
      console.error('Error rejecting team edit:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to reject submission' })
    }
  }
)

// GET /api/crowdsource/player/:playerId/cards-with-images - Get cards for a player that have images
router.get('/player/:playerId/cards-with-images',
  authMiddleware,
  async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId)

      if (isNaN(playerId)) {
        return res.status(400).json({ error: 'Invalid player ID' })
      }

      const cards = await prisma.$queryRawUnsafe(`
        SELECT
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          s.name as series_name,
          st.year as series_year,
          pt.player_team_id,
          pt.team as team_id,
          t.name as team_name,
          t.abbreviation as team_abbreviation,
          t.primary_color,
          t.secondary_color,
          front_photo.photo_url as front_image_url,
          back_photo.photo_url as back_image_url
        FROM card c
        INNER JOIN card_player_team cpt ON c.card_id = cpt.card
        INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
        INNER JOIN team t ON pt.team = t.team_Id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
        LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
        LEFT JOIN user_card_photo back_photo ON uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
        WHERE pt.player = ${playerId}
          AND (front_photo.photo_url IS NOT NULL OR back_photo.photo_url IS NOT NULL)
        ORDER BY st.year DESC, s.name, c.card_number
      `)

      // Serialize BigInt values
      const serializedCards = cards.map(card => ({
        card_id: Number(card.card_id),
        card_number: card.card_number,
        is_rookie: Boolean(card.is_rookie),
        is_autograph: Boolean(card.is_autograph),
        is_relic: Boolean(card.is_relic),
        series_name: card.series_name,
        series_year: card.series_year,
        player_team_id: Number(card.player_team_id),
        team_id: Number(card.team_id),
        team_name: card.team_name,
        team_abbreviation: card.team_abbreviation,
        primary_color: card.primary_color,
        secondary_color: card.secondary_color,
        front_image_url: card.front_image_url,
        back_image_url: card.back_image_url
      }))

      res.json({
        cards: serializedCards,
        total: serializedCards.length
      })

    } catch (error) {
      console.error('Error fetching player cards with images:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch player cards'
      })
    }
  }
)

module.exports = router
