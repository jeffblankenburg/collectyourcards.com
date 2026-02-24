const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats, updateContributorStatsOnSubmit } = require('./helpers')

const router = express.Router()

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

module.exports = router
