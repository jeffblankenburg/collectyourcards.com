const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../../../config/prisma-singleton')
const { Prisma } = require('@prisma/client')
const { authMiddleware, submissionLimiter } = require('./middleware')
const { ensureContributorStats, updateContributorStatsOnSubmit, updateContributorStatsOnReview } = require('./helpers')

const router = express.Router()

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
// GET PLAYER CARDS WITH IMAGES (for display card selection)
// =============================================================================

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
