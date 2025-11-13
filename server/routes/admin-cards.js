const express = require('express')
const router = express.Router()
const multer = require('multer')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireDataAdmin } = require('../middleware/auth')
const { processCardImage, deleteOptimizedImage, optimizeImage, uploadOptimizedImage } = require('../utils/image-optimizer')

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP image files are allowed'))
    }
  }
})

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
// Supports both:
// 1. Uploading edited image files (front_image, back_image)
// 2. Referencing existing user_card images (user_card_id)
router.put('/:id/reference-image', requireDataAdmin, upload.fields([
  { name: 'front_image', maxCount: 1 },
  { name: 'back_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const cardId = parseInt(req.params.id)
    const { user_card_id } = req.body
    const files = req.files || {}

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

    const processingResults = {
      front_image_url: null,
      back_image_url: null
    }

    // CASE 1: Uploaded image files (edited/cropped/rotated by admin)
    // CHECK FILES FIRST before checking user_card_id, because FormData without user_card_id has undefined value
    if (files.front_image || files.back_image) {
      console.log(`Processing uploaded image files for card ${cardId}...`)

      // Process front image if uploaded
      if (files.front_image && files.front_image[0]) {
        try {
          console.log(`Processing uploaded front image...`)
          const frontBuffer = files.front_image[0].buffer
          const optimizedBuffer = await optimizeImage(frontBuffer)
          const blobName = `${cardId}_front.jpg`
          // Upload will automatically overwrite existing blob with same name
          const newFrontUrl = await uploadOptimizedImage(optimizedBuffer, blobName)

          processingResults.front_image_url = newFrontUrl
          console.log(`✓ Front image optimized and uploaded`)
        } catch (error) {
          console.error(`Failed to process front image:`, error.message)
          // If processing fails, keep the old image by not updating front_image_url
        }
      }

      // Process back image if uploaded
      if (files.back_image && files.back_image[0]) {
        try {
          console.log(`Processing uploaded back image...`)
          const backBuffer = files.back_image[0].buffer
          const optimizedBuffer = await optimizeImage(backBuffer)
          const blobName = `${cardId}_back.jpg`
          // Upload will automatically overwrite existing blob with same name
          const newBackUrl = await uploadOptimizedImage(optimizedBuffer, blobName)

          processingResults.back_image_url = newBackUrl
          console.log(`✓ Back image optimized and uploaded`)
        } catch (error) {
          console.error(`Failed to process back image:`, error.message)
          // If processing fails, keep the old image by not updating back_image_url
        }
      }

      // Update card with new optimized images
      // Keep existing images if not replaced
      await prisma.card.update({
        where: { card_id: cardId },
        data: {
          reference_user_card: null, // Clear reference when using uploaded files
          front_image_path: processingResults.front_image_url || card.front_image_path,
          back_image_path: processingResults.back_image_url || card.back_image_path
        }
      })

      console.log(`✓ Card images updated successfully for card ${cardId}`)

      return res.json({
        message: 'Reference images updated and optimized successfully',
        reference_user_card: null,
        front_image_url: processingResults.front_image_url || card.front_image_path,
        back_image_url: processingResults.back_image_url || card.back_image_path,
        processing_summary: {
          front_processed: !!processingResults.front_image_url,
          back_processed: !!processingResults.back_image_url
        }
      })
    }

    // CASE 2: Clearing reference (setting to null)
    // This now comes AFTER checking for uploaded files
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

    // CASE 3: Reference existing user_card images (original flow)
    console.log(`Setting reference for card ${cardId} to user_card ${user_card_id}...`)

    // Delete old optimized images before processing new reference
    const deletionPromises = []
    if (card.front_image_path) {
      deletionPromises.push(deleteOptimizedImage(card.front_image_path))
    }
    if (card.back_image_path) {
      deletionPromises.push(deleteOptimizedImage(card.back_image_path))
    }
    if (deletionPromises.length > 0) {
      await Promise.allSettled(deletionPromises)
    }

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

    // Process images: download, optimize, and upload
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

    // Only update if at least one image was successfully processed
    if (!processingResults.front_image_url && !processingResults.back_image_url) {
      throw new Error('Failed to process any images from the selected user_card')
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

    // Optimized query: Filter first, then aggregate only what's needed
    const query = `
      WITH CardsNeedingRef AS (
        -- First: Get ONLY cards needing reference images that have actual photos available
        SELECT TOP ${limit + offset}
          c.card_id,
          c.card_number,
          s.series_id,
          s.name as series_name,
          s.slug as series_slug,
          st.set_id,
          st.name as set_name,
          st.year as set_year,
          st.slug as set_slug
        FROM card c WITH (NOLOCK)
        JOIN series s WITH (NOLOCK) ON c.series = s.series_id
        JOIN [set] st WITH (NOLOCK) ON s.[set] = st.set_id
        WHERE (c.front_image_path IS NULL OR c.back_image_path IS NULL)
          AND EXISTS (
            SELECT 1
            FROM user_card uc WITH (NOLOCK)
            JOIN user_card_photo ucp WITH (NOLOCK) ON uc.user_card_id = ucp.user_card
            WHERE uc.card = c.card_id
          )
        ORDER BY st.year DESC, st.name, s.name, c.card_number
      )
      SELECT
        cnr.*,
        ISNULL((
          SELECT COUNT(DISTINCT ucp.user_card_photo_id)
          FROM user_card uc WITH (NOLOCK)
          JOIN user_card_photo ucp WITH (NOLOCK) ON uc.user_card_id = ucp.user_card
          WHERE uc.card = cnr.card_id
        ), 0) as photo_count,
        ISNULL((
          SELECT COUNT(DISTINCT user_card_id)
          FROM user_card WITH (NOLOCK)
          WHERE card = cnr.card_id
        ), 0) as user_card_count,
        fp.player_id,
        fp.first_name,
        fp.last_name,
        fp.team_id,
        fp.team_name,
        fp.team_abbreviation,
        fp.primary_color,
        fp.secondary_color
      FROM CardsNeedingRef cnr
      LEFT JOIN (
        SELECT
          cpt.card,
          p.player_id,
          p.first_name,
          p.last_name,
          t.team_id,
          t.name as team_name,
          t.abbreviation as team_abbreviation,
          t.primary_color,
          t.secondary_color,
          ROW_NUMBER() OVER (PARTITION BY cpt.card ORDER BY p.last_name, p.first_name) as rn
        FROM CardsNeedingRef cnr2
        JOIN card_player_team cpt WITH (NOLOCK) ON cnr2.card_id = cpt.card
        JOIN player_team pt WITH (NOLOCK) ON cpt.player_team = pt.player_team_id
        JOIN player p WITH (NOLOCK) ON pt.player = p.player_id
        JOIN team t WITH (NOLOCK) ON pt.team = t.team_id
      ) fp ON cnr.card_id = fp.card AND fp.rn = 1
      ORDER BY cnr.set_year DESC, cnr.set_name, cnr.series_name, cnr.card_number
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const results = await prisma.$queryRawUnsafe(query)

    // Fast count query - check for missing image paths
    const countQuery = `
      SELECT COUNT(DISTINCT c.card_id) as total
      FROM card c WITH (NOLOCK)
      WHERE (c.front_image_path IS NULL OR c.back_image_path IS NULL)
        AND EXISTS (
          SELECT 1
          FROM user_card uc WITH (NOLOCK)
          JOIN user_card_photo ucp WITH (NOLOCK) ON uc.user_card_id = ucp.user_card
          WHERE uc.card = c.card_id
        )
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
      user_card_count: Number(row.user_card_count),
      player: row.player_id ? {
        player_id: Number(row.player_id),
        first_name: row.first_name,
        last_name: row.last_name,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim()
      } : null,
      team: row.team_id ? {
        team_id: Number(row.team_id),
        name: row.team_name,
        abbreviation: row.team_abbreviation,
        primary_color: row.primary_color,
        secondary_color: row.secondary_color
      } : null
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