const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats, updateContributorStatsOnSubmit, updateContributorStatsOnReview } = require('./helpers')

const router = express.Router()

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

module.exports = router
