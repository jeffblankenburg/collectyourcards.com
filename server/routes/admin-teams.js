const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// Helper function to generate URL slug from team name
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// GET /api/admin/teams - Get list of all teams
router.get('/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      select: {
        team_Id: true,
        name: true,
        city: true,
        mascot: true,
        abbreviation: true,
        organization: true,
        primary_color: true,
        secondary_color: true,
        card_count: true,
        organization_team_organizationToorganization: {
          select: {
            abbreviation: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Convert BigInt to Number for JSON serialization if needed
    const serializedTeams = teams.map(team => ({
      ...team,
      team_id: Number(team.team_Id), // Map team_Id to team_id for frontend
      team_Id: undefined, // Remove the original field
      organization: team.organization_team_organizationToorganization?.abbreviation || '', // Map organization abbreviation
      organization_id: team.organization ? Number(team.organization) : null, // Include organization_id for editing
      organization_team_organizationToorganization: undefined, // Remove the original nested field
      card_count: team.card_count,
      created: new Date() // Add a placeholder created date
    }))

    res.json({
      teams: serializedTeams,
      total: serializedTeams.length
    })

  } catch (error) {
    console.error('Error fetching teams:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch teams',
      details: error.message
    })
  }
})

// PUT /api/admin/teams/:id - Update team
router.put('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, city, mascot, abbreviation, organization_id, primary_color, secondary_color } = req.body

    // Validate team ID
    const teamId = parseInt(id)
    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({
        error: 'Invalid team ID',
        message: 'Team ID must be a valid number'
      })
    }

    // Check if team exists
    const existingTeam = await prisma.team.findUnique({
      where: { team_Id: teamId },
      select: {
        team_Id: true,
        name: true,
        city: true,
        mascot: true,
        abbreviation: true,
        organization: true,
        primary_color: true,
        secondary_color: true
      }
    })

    if (!existingTeam) {
      return res.status(404).json({
        error: 'Team not found',
        message: `Team with ID ${teamId} does not exist`
      })
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Team name is required'
      })
    }

    // Check for duplicate team name (excluding current team)
    if (name.trim() !== existingTeam.name) {
      const duplicateTeam = await prisma.team.findFirst({
        where: {
          name: name.trim(),
          team_Id: { not: teamId }
        }
      })

      if (duplicateTeam) {
        return res.status(409).json({
          error: 'Duplicate team name',
          message: `Team name "${name.trim()}" already exists`
        })
      }
    }

    // Prepare update data
    const trimmedName = name.trim()
    const updateData = {
      name: trimmedName,
      slug: generateSlug(trimmedName),
      city: city?.trim() || null,
      mascot: mascot?.trim() || null,
      abbreviation: abbreviation?.trim() || null,
      organization: organization_id ? parseInt(organization_id) : null,
      primary_color: primary_color?.trim() || null,
      secondary_color: secondary_color?.trim() || null
    }

    // Validate color formats if provided
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    if (updateData.primary_color && !hexColorRegex.test(updateData.primary_color)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Primary color must be a valid hex color (e.g., #FF0000)'
      })
    }
    if (updateData.secondary_color && !hexColorRegex.test(updateData.secondary_color)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Secondary color must be a valid hex color (e.g., #FF0000)'
      })
    }

    // Store old values for logging
    const oldValues = JSON.stringify({
      name: existingTeam.name,
      city: existingTeam.city,
      mascot: existingTeam.mascot,
      abbreviation: existingTeam.abbreviation,
      organization: existingTeam.organization,
      primary_color: existingTeam.primary_color,
      secondary_color: existingTeam.secondary_color
    })

    // Update team
    const updatedTeam = await prisma.team.update({
      where: { team_Id: teamId },
      data: updateData,
      select: {
        team_Id: true,
        name: true,
        city: true,
        mascot: true,
        abbreviation: true,
        organization: true,
        primary_color: true,
        secondary_color: true
      }
    })

    // Log admin action to legacy admin_action_log
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'TEAM_UPDATED',
          entity_type: 'team',
          entity_id: teamId.toString(),
          old_values: oldValues,
          new_values: JSON.stringify(updateData),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
      // Don't fail the request if logging fails
    }

    // Log to team_edit_submissions for unified audit history (admin = auto-approved)
    // Check if any trackable fields changed
    const hasChanges =
      existingTeam.name !== updateData.name ||
      existingTeam.city !== updateData.city ||
      existingTeam.mascot !== updateData.mascot ||
      existingTeam.abbreviation !== updateData.abbreviation ||
      existingTeam.primary_color !== updateData.primary_color ||
      existingTeam.secondary_color !== updateData.secondary_color

    if (hasChanges && req.user?.userId) {
      try {
        await prisma.team_edit_submissions.create({
          data: {
            team_id: teamId,
            user_id: BigInt(req.user.userId),
            // Previous values
            previous_name: existingTeam.name,
            previous_city: existingTeam.city,
            previous_mascot: existingTeam.mascot,
            previous_abbreviation: existingTeam.abbreviation,
            previous_primary_color: existingTeam.primary_color,
            previous_secondary_color: existingTeam.secondary_color,
            // Proposed/new values
            proposed_name: updateData.name,
            proposed_city: updateData.city,
            proposed_mascot: updateData.mascot,
            proposed_abbreviation: updateData.abbreviation,
            proposed_primary_color: updateData.primary_color,
            proposed_secondary_color: updateData.secondary_color,
            // Auto-approve for admin
            status: 'approved',
            reviewed_by: BigInt(req.user.userId),
            reviewed_at: new Date(),
            review_notes: 'Admin direct edit - auto-approved',
            created_at: new Date()
          }
        })
      } catch (auditError) {
        console.warn('Failed to create team_edit_submissions audit record:', auditError.message)
      }
    }

    res.json({
      message: 'Team updated successfully',
      team: {
        ...updatedTeam,
        team_id: Number(updatedTeam.team_Id),
        team_Id: undefined,
        card_count: 0,
        created: new Date()
      }
    })

  } catch (error) {
    console.error('Error updating team:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update team',
      details: error.message
    })
  }
})

// GET /api/admin/teams/:id - Get specific team
router.get('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params
    const teamId = parseInt(id)

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({
        error: 'Invalid team ID',
        message: 'Team ID must be a valid number'
      })
    }

    const team = await prisma.team.findUnique({
      where: { team_Id: teamId },
      select: {
        team_Id: true,
        name: true,
        city: true,
        mascot: true,
        abbreviation: true,
        organization: true,
        primary_color: true,
        secondary_color: true,
        card_count: true,
        organization_team_organizationToorganization: {
          select: {
            abbreviation: true
          }
        }
      }
    })

    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        message: `Team with ID ${teamId} does not exist`
      })
    }

    res.json({
      team: {
        ...team,
        team_id: Number(team.team_Id),
        team_Id: undefined,
        organization: team.organization_team_organizationToorganization?.abbreviation || '', // Map organization abbreviation
        organization_id: team.organization ? Number(team.organization) : null, // Include organization_id for editing
        organization_team_organizationToorganization: undefined, // Remove the original nested field
        card_count: team.card_count,
        created: new Date()
      }
    })

  } catch (error) {
    console.error('Error fetching team:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch team',
      details: error.message
    })
  }
})

// POST /api/admin/teams - Create new team
router.post('/teams', async (req, res) => {
  try {
    const { name, city, mascot, abbreviation, organization_id, primary_color, secondary_color } = req.body

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Team name is required'
      })
    }

    if (!abbreviation || !abbreviation.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Team abbreviation is required'
      })
    }

    if (!organization_id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Organization is required'
      })
    }

    // Prepare team data
    const trimmedName = name.trim()
    const teamData = {
      name: trimmedName,
      slug: generateSlug(trimmedName),
      city: city ? city.trim() : null,
      mascot: mascot ? mascot.trim() : null,
      abbreviation: abbreviation.trim(),
      organization: parseInt(organization_id),
      primary_color: primary_color ? primary_color.trim() : null,
      secondary_color: secondary_color ? secondary_color.trim() : null
    }

    // Validate hex colors if provided
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    if (teamData.primary_color && !hexColorRegex.test(teamData.primary_color)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Primary color must be a valid hex color (e.g., #FF0000)'
      })
    }

    if (teamData.secondary_color && !hexColorRegex.test(teamData.secondary_color)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Secondary color must be a valid hex color (e.g., #FF0000)'
      })
    }

    // Create team
    const newTeam = await prisma.team.create({
      data: teamData,
      select: {
        team_Id: true,
        name: true,
        city: true,
        mascot: true,
        abbreviation: true,
        organization: true,
        primary_color: true,
        secondary_color: true
      }
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'TEAM_CREATED',
          entity_type: 'team',
          entity_id: newTeam.team_Id.toString(),
          old_values: null,
          new_values: JSON.stringify(teamData),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
      // Don't fail the request if logging fails
    }

    res.status(201).json({
      message: 'Team created successfully',
      team: {
        ...newTeam,
        team_id: Number(newTeam.team_Id),
        team_Id: undefined,
        organization_id: newTeam.organization,
        card_count: 0,
        created: new Date()
      }
    })

  } catch (error) {
    console.error('Error creating team:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create team',
      details: error.message
    })
  }
})

// DELETE /api/admin/teams/:id - Delete a team and all related data
// DANGEROUS OPERATION - Requires superadmin
router.delete('/teams/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const teamId = parseInt(id)

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({
        error: 'Invalid team ID',
        message: 'Team ID must be a valid number'
      })
    }

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { team_Id: teamId },
      select: {
        team_Id: true,
        name: true,
        card_count: true
      }
    })

    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        message: `Team with ID ${teamId} does not exist`
      })
    }

    console.log(`Superadmin: Beginning cascade delete of team ${teamId} (${team.name})`)

    // Track what we're about to delete for logging
    let deletedCounts = {
      userCardPhotos: 0,
      userCards: 0,
      cardPlayerTeam: 0,
      cards: 0,
      playerTeam: 0,
      teamEditSubmissions: 0
    }

    // Get all player_team IDs for this team
    const playerTeams = await prisma.$queryRawUnsafe(`
      SELECT player_team_id FROM player_team WHERE team = ${teamId}
    `)
    const playerTeamIds = playerTeams.map(pt => Number(pt.player_team_id))

    if (playerTeamIds.length > 0) {
      // Get all card IDs associated with this team through card_player_team
      const cardIdsResult = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT card FROM card_player_team
        WHERE player_team IN (${playerTeamIds.join(',')})
      `)
      const cardIds = cardIdsResult.map(c => Number(c.card))

      if (cardIds.length > 0) {
        // Delete user_card_photo records for all cards
        const photoDeleteResult = await prisma.$executeRawUnsafe(`
          DELETE ucp FROM user_card_photo ucp
          INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id
          WHERE uc.card IN (${cardIds.join(',')})
        `)
        deletedCounts.userCardPhotos = photoDeleteResult

        // Delete user_card records
        const userCardDeleteResult = await prisma.$executeRawUnsafe(`
          DELETE FROM user_card WHERE card IN (${cardIds.join(',')})
        `)
        deletedCounts.userCards = userCardDeleteResult

        // Delete card_player_team records for this team's player_teams
        const cptDeleteResult = await prisma.$executeRawUnsafe(`
          DELETE FROM card_player_team WHERE player_team IN (${playerTeamIds.join(',')})
        `)
        deletedCounts.cardPlayerTeam = cptDeleteResult

        // Delete cards that are now orphaned (no more card_player_team records)
        const orphanedCardsResult = await prisma.$executeRawUnsafe(`
          DELETE c FROM card c
          WHERE c.card_id IN (${cardIds.join(',')})
          AND NOT EXISTS (SELECT 1 FROM card_player_team cpt WHERE cpt.card = c.card_id)
        `)
        deletedCounts.cards = orphanedCardsResult
      }

      // Delete player-team relationships
      const ptDeleteResult = await prisma.$executeRawUnsafe(`
        DELETE FROM player_team WHERE team = ${teamId}
      `)
      deletedCounts.playerTeam = ptDeleteResult
    }

    // Delete team_edit_submissions records
    try {
      const editSubmissionsResult = await prisma.team_edit_submissions.deleteMany({
        where: { team_id: teamId }
      })
      deletedCounts.teamEditSubmissions = editSubmissionsResult.count
    } catch (e) {
      console.warn('Could not delete team_edit_submissions:', e.message)
    }

    // Delete team_submissions records (new team submissions that created this team)
    try {
      const teamSubmissionsResult = await prisma.team_submissions.deleteMany({
        where: { created_team_id: teamId }
      })
      deletedCounts.teamSubmissions = teamSubmissionsResult.count
    } catch (e) {
      console.warn('Could not delete team_submissions:', e.message)
    }

    // Delete user_team records (user's recently viewed teams)
    try {
      const userTeamResult = await prisma.user_team.deleteMany({
        where: { team: teamId }
      })
      deletedCounts.userTeam = userTeamResult.count
    } catch (e) {
      console.warn('Could not delete user_team:', e.message)
    }

    // Delete the team
    await prisma.team.delete({
      where: { team_Id: teamId }
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'DELETE_TEAM',
          entity_type: 'team',
          entity_id: teamId.toString(),
          old_values: JSON.stringify({
            team_name: team.name,
            card_count: Number(team.card_count || 0),
            deletedCounts
          })
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    console.log('Superadmin: Deleted team:', team.name, 'Deleted counts:', deletedCounts)

    res.json({
      message: 'Team deleted successfully',
      deletedCounts
    })

  } catch (error) {
    console.error('Error deleting team:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete team',
      details: error.message
    })
  }
})

module.exports = router