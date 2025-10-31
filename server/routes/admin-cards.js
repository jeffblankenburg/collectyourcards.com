const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireDataAdmin } = require('../middleware/auth')

// POST /api/admin/cards - Create a new card
router.post('/', requireDataAdmin, async (req, res) => {
  try {
    const { series_id, card_number, sort_order, is_rookie, is_autograph, is_relic, print_run, notes, players } = req.body

    // Validate required fields
    if (!series_id) {
      return res.status(400).json({ error: 'Series ID is required' })
    }
    if (!card_number || !card_number.trim()) {
      return res.status(400).json({ error: 'Card number is required' })
    }

    // Verify series exists
    const series = await prisma.series.findUnique({
      where: { series_id: BigInt(series_id) }
    })

    if (!series) {
      return res.status(404).json({ error: 'Series not found' })
    }

    // Prepare card data
    const cardData = {
      series: BigInt(series_id),
      card_number: card_number.trim(),
      sort_order: sort_order ? parseInt(sort_order) : null,
      is_rookie: Boolean(is_rookie),
      is_autograph: Boolean(is_autograph),
      is_relic: Boolean(is_relic),
      print_run: print_run ? parseInt(print_run) : null,
      notes: notes?.trim() || null,
      created: new Date()
    }

    // Use a transaction to create both card and player relationships
    const newCard = await prisma.$transaction(async (tx) => {
      // Create the card
      const card = await tx.card.create({
        data: cardData
      })

      // Add player-team relationships if provided
      if (players && Array.isArray(players) && players.length > 0) {
        for (const playerData of players) {
          const playerId = parseInt(playerData.player_id)
          const teamId = parseInt(playerData.team_id)

          if (!playerId || !teamId) {
            console.warn(`Invalid player_id (${playerId}) or team_id (${teamId})`)
            continue
          }

          // Find the player_team record that matches this player-team combination
          const playerTeam = await tx.player_team.findFirst({
            where: {
              player: BigInt(playerId),
              team: teamId
            }
          })

          if (playerTeam) {
            // Create the card-player-team relationship
            await tx.card_player_team.create({
              data: {
                card: card.card_id,
                player_team: playerTeam.player_team_id
              }
            })
          } else {
            console.warn(`No player_team found for player ${playerId} and team ${teamId}`)
          }
        }
      }

      return card
    })

    res.status(201).json({
      message: 'Card created successfully',
      card: {
        card_id: Number(newCard.card_id),
        card_number: newCard.card_number,
        series_id: Number(newCard.series)
      }
    })

  } catch (error) {
    console.error('Error creating card:', error)
    res.status(500).json({
      error: 'Failed to create card',
      message: error.message
    })
  }
})

// PUT /api/admin/cards/:id - Update a card
router.put('/:id', requireDataAdmin, async (req, res) => {
  try {
    const cardId = parseInt(req.params.id)
    const { card_number, sort_order, is_rookie, is_autograph, is_relic, print_run, notes, players } = req.body

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID is required' })
    }

    // Validate input
    const updateData = {
      card_number: card_number?.trim() || null,
      sort_order: sort_order ? parseInt(sort_order) : null,
      is_rookie: Boolean(is_rookie),
      is_autograph: Boolean(is_autograph),
      is_relic: Boolean(is_relic),
      print_run: print_run ? parseInt(print_run) : null,
      notes: notes?.trim() || null
    }

    // Check if card exists
    const existingCard = await prisma.card.findUnique({
      where: { card_id: cardId }
    })

    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' })
    }

    // Use a transaction to update both card and player relationships
    await prisma.$transaction(async (tx) => {
      // Update the card
      await tx.card.update({
        where: { card_id: cardId },
        data: updateData
      })

      // Handle player-team relationships only if explicitly provided
      // This prevents accidental deletion of existing players when only updating other fields
      if (players !== undefined && Array.isArray(players)) {
        // Delete existing card-player-team relationships
        await tx.card_player_team.deleteMany({
          where: { card: cardId }
        })

        // Add new player-team relationships
        for (const playerData of players) {
          const playerId = parseInt(playerData.player_id)
          const teamId = parseInt(playerData.team_id)

          if (!playerId || !teamId) {
            console.warn(`Invalid player_id (${playerId}) or team_id (${teamId})`)
            continue
          }

          // Find the player_team record that matches this player-team combination
          const playerTeam = await tx.player_team.findFirst({
            where: {
              player: BigInt(playerId),
              team: teamId
            }
          })

          if (playerTeam) {
            // Create the card-player-team relationship
            await tx.card_player_team.create({
              data: {
                card: cardId,
                player_team: playerTeam.player_team_id
              }
            })
          } else {
            console.warn(`No player_team found for player ${playerId} and team ${teamId}`)
          }
        }
      }
    })

    res.json({ 
      message: 'Card updated successfully'
    })

  } catch (error) {
    console.error('Error updating card:', error)
    res.status(500).json({ 
      error: 'Failed to update card',
      message: error.message 
    })
  }
})

module.exports = router