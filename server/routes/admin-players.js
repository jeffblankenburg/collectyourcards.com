const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireDataAdmin } = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

// Apply authentication and data admin requirements to all routes
router.use(authMiddleware)
router.use(requireDataAdmin)

// GET /api/admin/players - Get players list with stats
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search } = req.query
    const limitNum = Math.min(parseInt(limit) || 100, 500)
    const offsetNum = parseInt(offset) || 0

    console.log('Admin: Getting players list', { limit: limitNum, offset: offsetNum, search })

    let players
    
    if (search && search.trim()) {
      // Search mode: search by player name - get players with their teams
      const searchTerm = search.trim()
      players = await prisma.$queryRawUnsafe(`
        SELECT 
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          NULL as last_viewed,
          STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_Id, '|', t.name, '|', t.city, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
        FROM player p
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        WHERE (
          p.first_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR p.last_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR p.nick_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        )
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY p.last_name, p.first_name
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    } else {
      // Default mode: most recently viewed players with their teams
      players = await prisma.$queryRawUnsafe(`
        SELECT 
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          MAX(up.created) as last_viewed,
          STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_Id, '|', t.name, '|', t.city, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
        FROM user_player up 
        LEFT JOIN player p ON p.player_id = up.player
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        WHERE p.player_id IS NOT NULL
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY last_viewed DESC
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    }

    // Get total count for pagination
    let totalCount = 0
    if (search && search.trim()) {
      const searchTerm = search.trim()
      const totalCountResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM player p
        WHERE (
          p.first_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR p.last_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR p.nick_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        )
      `)
      totalCount = Number(totalCountResult[0].total)
    } else {
      // For recently viewed, we limit to 100 anyway
      totalCount = Math.min(players.length, 100)
    }

    // Serialize BigInt values and parse team data
    const serializedPlayers = players.map(player => {
      // Parse teams data from STRING_AGG result
      let teams = []
      if (player.teams_data) {
        const teamStrings = player.teams_data.split('~')
        teams = teamStrings.map(teamStr => {
          const [team_id, name, city, abbreviation, primary_color, secondary_color] = teamStr.split('|')
          return {
            team_id: Number(team_id),
            name: name || null,
            city: city || null, 
            abbreviation: abbreviation || null,
            primary_color: primary_color || null,
            secondary_color: secondary_color || null
          }
        }).filter(team => team.team_id) // Filter out any malformed entries
      }

      return {
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        birthdate: player.birthdate,
        is_hof: Boolean(player.is_hof),
        card_count: Number(player.card_count || 0),
        teams: teams,
        team_count: teams.length,
        last_viewed: player.last_viewed
      }
    })

    res.json({
      players: serializedPlayers,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      hasMore: (offsetNum + limitNum) < totalCount
    })

  } catch (error) {
    console.error('Error fetching admin players:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch players',
      details: error.message
    })
  }
})

// GET /api/admin/players/:id - Get specific player details
router.get('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    
    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    const player = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    res.json({
      player: {
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        birthdate: player.birthdate,
        is_hof: Boolean(player.is_hof),
        card_count: Number(player.card_count || 0)
      }
    })

  } catch (error) {
    console.error('Error fetching player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player',
      details: error.message
    })
  }
})

// GET /api/admin/players/:id/teams - Get teams for a player
router.get('/:id/teams', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    
    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    const teams = await prisma.$queryRawUnsafe(`
      SELECT 
        t.team_Id,
        t.name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_Id = pt.team
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      LEFT JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${playerId}
      GROUP BY t.team_Id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      ORDER BY t.name
    `)

    // Serialize BigInt values
    const serializedTeams = teams.map(team => ({
      team_id: Number(team.team_Id),
      name: team.name,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      card_count: Number(team.card_count || 0)
    }))

    res.json({
      teams: serializedTeams
    })

  } catch (error) {
    console.error('Error fetching player teams:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player teams',
      details: error.message
    })
  }
})

// POST /api/admin/players - Create new player
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, nick_name, birthdate, is_hof } = req.body

    if (!first_name?.trim() && !last_name?.trim() && !nick_name?.trim()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: 'At least one name field (first name, last name, or nickname) is required' 
      })
    }

    // Check if player already exists
    const existingPlayer = await prisma.player.findFirst({
      where: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        nick_name: nick_name?.trim() || null
      }
    })

    if (existingPlayer) {
      return res.status(409).json({
        error: 'Player already exists',
        message: 'A player with this name already exists'
      })
    }

    const newPlayer = await prisma.player.create({
      data: {
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        nick_name: nick_name?.trim() || null,
        birthdate: birthdate ? new Date(birthdate) : null,
        is_hof: Boolean(is_hof),
        card_count: 0 // Start with 0 cards
      }
    })

    console.log('Admin: Created new player:', newPlayer.first_name, newPlayer.last_name)

    res.status(201).json({
      player: {
        player_id: Number(newPlayer.player_id),
        first_name: newPlayer.first_name,
        last_name: newPlayer.last_name,
        nick_name: newPlayer.nick_name,
        birthdate: newPlayer.birthdate,
        is_hof: Boolean(newPlayer.is_hof),
        card_count: Number(newPlayer.card_count)
      },
      message: 'Player created successfully'
    })

  } catch (error) {
    console.error('Error creating player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create player',
      details: error.message
    })
  }
})

// PUT /api/admin/players/:id - Update player
router.put('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { first_name, last_name, nick_name, birthdate, is_hof } = req.body

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    if (!first_name?.trim() && !last_name?.trim() && !nick_name?.trim()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: 'At least one name field (first name, last name, or nickname) is required' 
      })
    }

    // Check if player exists
    const existingPlayer = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Check for name conflicts (excluding current player)
    const conflictPlayer = await prisma.player.findFirst({
      where: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        nick_name: nick_name?.trim() || null,
        player_id: { not: playerId }
      }
    })

    if (conflictPlayer) {
      return res.status(409).json({
        error: 'Player name conflict',
        message: 'Another player with this name already exists'
      })
    }

    const updatedPlayer = await prisma.player.update({
      where: { player_id: playerId },
      data: {
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        nick_name: nick_name?.trim() || null,
        birthdate: birthdate ? new Date(birthdate) : null,
        is_hof: Boolean(is_hof)
      }
    })

    console.log('Admin: Updated player:', updatedPlayer.first_name, updatedPlayer.last_name)

    res.json({
      player: {
        player_id: Number(updatedPlayer.player_id),
        first_name: updatedPlayer.first_name,
        last_name: updatedPlayer.last_name,
        nick_name: updatedPlayer.nick_name,
        birthdate: updatedPlayer.birthdate,
        is_hof: Boolean(updatedPlayer.is_hof),
        card_count: Number(updatedPlayer.card_count)
      },
      message: 'Player updated successfully'
    })

  } catch (error) {
    console.error('Error updating player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update player',
      details: error.message
    })
  }
})

// POST /api/admin/players/:id/teams - Add team to player
router.post('/:id/teams', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { team_id } = req.body

    if (isNaN(playerId) || isNaN(team_id)) {
      return res.status(400).json({ error: 'Invalid player ID or team ID' })
    }

    // Check if relationship already exists
    const existingRelation = await prisma.player_team.findFirst({
      where: {
        player: playerId,
        team: team_id
      }
    })

    if (existingRelation) {
      return res.status(409).json({
        error: 'Relationship exists',
        message: 'Player is already assigned to this team'
      })
    }

    // Create the relationship
    const newRelation = await prisma.player_team.create({
      data: {
        player: playerId,
        team: team_id
      }
    })

    console.log('Admin: Added team', team_id, 'to player', playerId)

    res.status(201).json({
      player_team_id: Number(newRelation.player_team_id),
      message: 'Team added to player successfully'
    })

  } catch (error) {
    console.error('Error adding team to player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to add team to player',
      details: error.message
    })
  }
})

// DELETE /api/admin/players/:id/teams/:teamId - Remove team from player
router.delete('/:id/teams/:teamId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const teamId = parseInt(req.params.teamId)

    if (isNaN(playerId) || isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid player ID or team ID' })
    }

    // Check if there are cards for this player-team combination
    const cardCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM card_player_team cpt
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${playerId} AND pt.team = ${teamId}
    `)

    if (Number(cardCount[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot remove team',
        message: `This player has ${cardCount[0].count} cards assigned to this team. Please reassign the cards first.`,
        cardCount: Number(cardCount[0].count)
      })
    }

    // Remove the relationship
    const deleteResult = await prisma.player_team.deleteMany({
      where: {
        player: playerId,
        team: teamId
      }
    })

    if (deleteResult.count === 0) {
      return res.status(404).json({
        error: 'Relationship not found',
        message: 'Player is not assigned to this team'
      })
    }

    console.log('Admin: Removed team', teamId, 'from player', playerId)

    res.json({
      message: 'Team removed from player successfully',
      removedCount: deleteResult.count
    })

  } catch (error) {
    console.error('Error removing team from player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to remove team from player',
      details: error.message
    })
  }
})

// POST /api/admin/players/:id/reassign-cards - Reassign all cards from one team to another
router.post('/:id/reassign-cards', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { from_team_id, to_team_id } = req.body

    if (isNaN(playerId) || isNaN(from_team_id) || isNaN(to_team_id)) {
      return res.status(400).json({ error: 'Invalid player ID or team IDs' })
    }

    if (from_team_id === to_team_id) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Source and destination teams cannot be the same'
      })
    }

    // Get the player-team IDs
    const fromPlayerTeam = await prisma.player_team.findFirst({
      where: { player: playerId, team: from_team_id }
    })

    const toPlayerTeam = await prisma.player_team.findFirst({
      where: { player: playerId, team: to_team_id }
    })

    if (!fromPlayerTeam) {
      return res.status(400).json({
        error: 'Invalid source team',
        message: 'Player is not assigned to the source team'
      })
    }

    if (!toPlayerTeam) {
      return res.status(400).json({
        error: 'Invalid destination team',
        message: 'Player is not assigned to the destination team. Please add the team first.'
      })
    }

    // Count cards to be reassigned
    const cardCountResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM card_player_team 
      WHERE player_team = ${fromPlayerTeam.player_team_id}
    `)
    const cardsToReassign = Number(cardCountResult[0].count)

    if (cardsToReassign === 0) {
      return res.status(400).json({
        error: 'No cards to reassign',
        message: 'Player has no cards assigned to the source team'
      })
    }

    // Perform the reassignment
    const updateResult = await prisma.$executeRawUnsafe(`
      UPDATE card_player_team 
      SET player_team = ${toPlayerTeam.player_team_id}
      WHERE player_team = ${fromPlayerTeam.player_team_id}
    `)

    console.log(`Admin: Reassigned ${cardsToReassign} cards for player ${playerId} from team ${from_team_id} to team ${to_team_id}`)

    // Get team names for response
    const [fromTeam, toTeam] = await Promise.all([
      prisma.team.findUnique({ where: { team_Id: from_team_id } }),
      prisma.team.findUnique({ where: { team_Id: to_team_id } })
    ])

    res.json({
      message: 'Cards reassigned successfully',
      cardsReassigned: cardsToReassign,
      fromTeam: fromTeam?.name,
      toTeam: toTeam?.name
    })

  } catch (error) {
    console.error('Error reassigning cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to reassign cards',
      details: error.message
    })
  }
})

// DELETE /api/admin/players/:id - Delete player (only if no cards)
router.delete('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    // Check if player has cards
    const player = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    if (player.card_count > 0) {
      return res.status(400).json({
        error: 'Cannot delete player',
        message: `Player has ${player.card_count} cards. Cannot delete players with cards.`,
        cardCount: Number(player.card_count)
      })
    }

    // Delete player-team relationships first
    await prisma.player_team.deleteMany({
      where: { player: playerId }
    })

    // Delete the player
    await prisma.player.delete({
      where: { player_id: playerId }
    })

    console.log('Admin: Deleted player:', player.first_name, player.last_name)

    res.json({
      message: 'Player deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete player',
      details: error.message
    })
  }
})

module.exports = router