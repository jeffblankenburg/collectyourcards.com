const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats, updateContributorStatsOnSubmit } = require('./helpers')

const router = express.Router()

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

module.exports = router
