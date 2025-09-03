const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

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
    const updateData = {
      name: name.trim(),
      city: city?.trim() || null,
      mascot: mascot?.trim() || null,
      abbreviation: abbreviation?.trim() || null,
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
        primary_color: true,
        secondary_color: true
      }
    })

    // Log admin action
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
    const teamData = {
      name: name.trim(),
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

module.exports = router