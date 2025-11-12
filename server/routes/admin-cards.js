const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireDataAdmin } = require('../middleware/auth')
const { processCardImage, deleteOptimizedImage } = require('../utils/image-optimizer')

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

    // Check if card exists and get current image URLs
    const card = await prisma.card.findUnique({
      where: { card_id: cardId },
      select: {
        card_id: true,
        reference_user_card: true,
        front_image_path: true,
        back_image_path: true
      }
    })

    if (!card) {
      return res.status(404).json({ error: 'Card not found' })
    }

    // CASE 1: Clearing reference (setting to null)
    if (user_card_id === null || user_card_id === undefined) {
      console.log(`Clearing reference for card ${cardId}...`)

      // Delete old optimized images if they exist
      const deletionPromises = []
      if (card.front_image_path) {
        deletionPromises.push(deleteOptimizedImage(card.front_image_path))
      }
      if (card.back_image_path) {
        deletionPromises.push(deleteOptimizedImage(card.back_image_path))
      }

      await Promise.allSettled(deletionPromises) // Don't fail if deletion fails

      // Update card to clear reference and image paths
      await prisma.card.update({
        where: { card_id: cardId },
        data: {
          reference_user_card: null,
          front_image_path: null,
          back_image_path: null
        }
      })

      return res.json({
        message: 'Reference image cleared successfully',
        reference_user_card: null,
        front_image_url: null,
        back_image_url: null
      })
    }

    // CASE 2: Setting or changing reference
    console.log(`Setting reference for card ${cardId} to user_card ${user_card_id}...`)

    // Validate the new user_card exists and has photos
    const userCard = await prisma.user_card.findUnique({
      where: { user_card_id: BigInt(user_card_id) },
      select: {
        user_card_id: true,
        card: true,
        user_card_photo_user_card_photo_user_cardTouser_card: {
          orderBy: {
            sort_order: 'asc'
          },
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

    const photos = userCard.user_card_photo_user_card_photo_user_cardTouser_card
    if (photos.length === 0) {
      return res.status(400).json({ error: 'User card has no photos' })
    }

    // Get front and back images (sort_order 1 = front, 2 = back)
    const frontPhoto = photos.find(p => p.sort_order === 1)
    const backPhoto = photos.find(p => p.sort_order === 2)

    // Delete old optimized images if reference is changing
    if (card.reference_user_card && Number(card.reference_user_card) !== user_card_id) {
      console.log(`Reference changing from ${card.reference_user_card} to ${user_card_id}, deleting old optimized images...`)
      const deletionPromises = []
      if (card.front_image_path) {
        deletionPromises.push(deleteOptimizedImage(card.front_image_path))
      }
      if (card.back_image_path) {
        deletionPromises.push(deleteOptimizedImage(card.back_image_path))
      }
      await Promise.allSettled(deletionPromises) // Don't fail if deletion fails
    }

    // Process images: download, optimize, and upload
    const processingResults = {
      front_image_url: null,
      back_image_url: null
    }

    // Process front image if available
    if (frontPhoto?.photo_url) {
      try {
        console.log(`Processing front image for card ${cardId}...`)
        processingResults.front_image_url = await processCardImage(frontPhoto.photo_url, cardId, 'front')
        console.log(`✓ Front image optimized successfully`)
      } catch (error) {
        console.error(`Failed to process front image:`, error.message)
        // Continue - we'll update what we can
      }
    }

    // Process back image if available
    if (backPhoto?.photo_url) {
      try {
        console.log(`Processing back image for card ${cardId}...`)
        processingResults.back_image_url = await processCardImage(backPhoto.photo_url, cardId, 'back')
        console.log(`✓ Back image optimized successfully`)
      } catch (error) {
        console.error(`Failed to process back image:`, error.message)
        // Continue - we'll update what we can
      }
    }

    // Update the card with reference and optimized image URLs
    await prisma.card.update({
      where: { card_id: cardId },
      data: {
        reference_user_card: BigInt(user_card_id),
        front_image_path: processingResults.front_image_url,
        back_image_path: processingResults.back_image_url
      }
    })

    console.log(`✓ Reference updated successfully for card ${cardId}`)

    res.json({
      message: 'Reference image updated and optimized successfully',
      reference_user_card: Number(user_card_id),
      front_image_url: processingResults.front_image_url,
      back_image_url: processingResults.back_image_url,
      processing_summary: {
        front_processed: !!processingResults.front_image_url,
        back_processed: !!processingResults.back_image_url
      }
    })

  } catch (error) {
    console.error('Error updating reference image:', error)
    res.status(500).json({
      error: 'Failed to update reference image',
      message: error.message
    })
  }
})

// GET /api/admin/cards/needs-reference - Get cards that have user photos but no reference image assigned
router.get('/needs-reference', requireDataAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    // Find cards that:
    // 1. Have reference_user_card IS NULL
    // 2. Have at least one user_card with photos
    const query = `
      SELECT
        c.card_id,
        c.card_number,
        s.series_id,
        s.name as series_name,
        s.slug as series_slug,
        st.set_id,
        st.name as set_name,
        st.year as set_year,
        st.slug as set_slug,
        COUNT(DISTINCT ucp.user_card_photo_id) as photo_count,
        COUNT(DISTINCT uc.user_card_id) as user_card_count
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      JOIN user_card uc ON c.card_id = uc.card
      JOIN user_card_photo ucp ON uc.user_card_id = ucp.user_card
      WHERE c.reference_user_card IS NULL
      GROUP BY c.card_id, c.card_number, s.series_id, s.name, s.slug,
               st.set_id, st.name, st.year, st.slug
      ORDER BY photo_count DESC, st.year DESC, st.name, s.name, c.card_number
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const results = await prisma.$queryRawUnsafe(query)

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT c.card_id) as total
      FROM card c
      JOIN user_card uc ON c.card_id = uc.card
      JOIN user_card_photo ucp ON uc.user_card_id = ucp.user_card
      WHERE c.reference_user_card IS NULL
    `

    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Transform results
    const cards = results.map(row => ({
      card_id: Number(row.card_id),
      card_number: row.card_number,
      series: {
        series_id: Number(row.series_id),
        name: row.series_name,
        slug: row.series_slug
      },
      set: {
        set_id: Number(row.set_id),
        name: row.set_name,
        year: Number(row.set_year),
        slug: row.set_slug
      },
      photo_count: Number(row.photo_count),
      user_card_count: Number(row.user_card_count)
    }))

    res.json({
      success: true,
      cards,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })

  } catch (error) {
    console.error('Error fetching cards needing reference:', error)
    res.status(500).json({
      error: 'Failed to fetch cards',
      message: error.message
    })
  }
})

module.exports = router