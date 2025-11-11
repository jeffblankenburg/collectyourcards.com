const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireDataAdmin } = require('../middleware/auth')

// POST /api/admin/cards - Create a new card
router.post('/', requireDataAdmin, async (req, res) => {
  try {
    const { series_id, card_number, sort_order, is_rookie, is_autograph, is_relic, is_short_print, print_run, notes, players } = req.body

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
      is_short_print: Boolean(is_short_print),
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
    const { card_number, sort_order, is_rookie, is_autograph, is_relic, is_short_print, print_run, notes, players } = req.body

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
      is_short_print: Boolean(is_short_print),
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

// GET /api/admin/cards/:id/community-images - Get all community-uploaded images for a card
router.get('/:id/community-images', requireDataAdmin, async (req, res) => {
  try {
    const cardId = parseInt(req.params.id)

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID is required' })
    }

    // Check if card exists
    const card = await prisma.card.findUnique({
      where: { card_id: cardId }
    })

    if (!card) {
      return res.status(404).json({ error: 'Card not found' })
    }

    // Find all user_card records for this card with their photos
    // Note: Explicitly select fields to avoid missing columns (like ebay_purchase_id) in production
    const userCards = await prisma.user_card.findMany({
      where: {
        card: BigInt(cardId)
      },
      select: {
        user_card_id: true,
        created: true,
        user_card_photo_user_card_photo_user_cardTouser_card: {
          orderBy: {
            sort_order: 'asc'
          },
          select: {
            user_card_photo_id: true,
            photo_url: true,
            sort_order: true
          }
        },
        user_user_card_userTouser: {
          select: {
            user_id: true,
            email: true
          }
        }
      }
    })

    // Transform the data for easier consumption
    const communityImages = userCards.map(uc => {
      const photos = uc.user_card_photo_user_card_photo_user_cardTouser_card
      return {
        user_card_id: Number(uc.user_card_id),
        user_email: uc.user_user_card_userTouser?.email || 'Unknown',
        created: uc.created,
        front_image: photos.find(p => p.sort_order === 1)?.photo_url || null,
        back_image: photos.find(p => p.sort_order === 2)?.photo_url || null,
        has_images: photos.length > 0,
        photo_count: photos.length
      }
    }).filter(uc => uc.has_images) // Only return user_cards that have at least one photo

    res.json({
      card_id: cardId,
      current_reference: card.reference_user_card ? Number(card.reference_user_card) : null,
      community_images: communityImages
    })

  } catch (error) {
    console.error('Error fetching community images:', error)
    res.status(500).json({
      error: 'Failed to fetch community images',
      message: error.message
    })
  }
})

// PUT /api/admin/cards/:id/reference-image - Update the reference_user_card for a card
router.put('/:id/reference-image', requireDataAdmin, async (req, res) => {
  try {
    const cardId = parseInt(req.params.id)
    const { user_card_id } = req.body

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID is required' })
    }

    // Check if card exists
    const card = await prisma.card.findUnique({
      where: { card_id: cardId }
    })

    if (!card) {
      return res.status(404).json({ error: 'Card not found' })
    }

    // If user_card_id is provided, validate it exists and belongs to this card
    if (user_card_id !== null && user_card_id !== undefined) {
      const userCard = await prisma.user_card.findUnique({
        where: { user_card_id: BigInt(user_card_id) },
        select: {
          user_card_id: true,
          card: true,
          user_card_photo_user_card_photo_user_cardTouser_card: {
            select: {
              user_card_photo_id: true,
              photo_url: true,
              sort_order: true
            }
          }
        }
      })

      if (!userCard) {
        return res.status(404).json({ error: 'User card not found' })
      }

      if (Number(userCard.card) !== cardId) {
        return res.status(400).json({ error: 'User card does not belong to this card' })
      }

      if (userCard.user_card_photo_user_card_photo_user_cardTouser_card.length === 0) {
        return res.status(400).json({ error: 'User card has no photos' })
      }
    }

    // Update the card's reference_user_card
    await prisma.card.update({
      where: { card_id: cardId },
      data: {
        reference_user_card: user_card_id ? BigInt(user_card_id) : null
      }
    })

    res.json({
      message: 'Reference image updated successfully',
      reference_user_card: user_card_id ? Number(user_card_id) : null
    })

  } catch (error) {
    console.error('Error updating reference image:', error)
    res.status(500).json({
      error: 'Failed to update reference image',
      message: error.message
    })
  }
})

module.exports = router