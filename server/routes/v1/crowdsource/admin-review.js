const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, adminCheck } = require('./middleware')
const { updateContributorStatsOnReview } = require('./helpers')

const router = express.Router()

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
          createdPlayerTeamId = existing[0].player_team_id
        } else {
          const newAssoc = await prisma.$queryRaw`
            INSERT INTO player_team (player, team, created)
            OUTPUT INSERTED.player_team_id
            VALUES (${sub.player_id}, ${sub.team_id}, GETDATE())
          `
          createdPlayerTeamId = newAssoc[0].player_team_id
        }
      } else if (sub.action_type === 'remove') {
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

module.exports = router
