const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { requireAdmin, requireDataAdmin } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

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

      // Handle player-team relationships if provided
      if (players && Array.isArray(players)) {
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
              player: playerId,
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