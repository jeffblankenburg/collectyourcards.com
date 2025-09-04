const express = require('express')
const { PrismaClient, Prisma } = require('@prisma/client')
const { authMiddleware } = require('../middleware/auth')
const { BlobServiceClient } = require('@azure/storage-blob')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/cards/:cardId - Get user's copies of a specific card
router.get('/:cardId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { cardId } = req.params
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Copy exact working query from user-collection-cards.js
    const userCardsQuery = `
      SELECT 
        uc.user_card_id,
        uc.random_code,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.current_value,
        uc.grade,
        uc.grade_id,
        uc.grading_agency,
        ga.abbreviation as grading_agency_abbr,
        ga.name as grading_agency_name,
        uc.aftermarket_autograph,
        uc.created as date_added,
        c.card_id, 
        c.card_number, 
        c.is_rookie, 
        c.is_autograph, 
        c.is_relic,
        c.print_run, 
        c.sort_order, 
        c.notes as card_notes,
        s.name as series_name, 
        s.series_id,
        col.name as color, 
        col.hex_value as hex_color,
        ul.location as location_name,
        p.first_name,
        p.last_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbr,
        t.primary_color,
        t.secondary_color
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      LEFT JOIN card_player_team cpt ON cpt.card = c.card_id
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE uc.[user] = ${parseInt(userId)} 
      AND uc.card = ${parseInt(cardId)}
      ORDER BY uc.created DESC
    `
    
    const rawResults = await prisma.$queryRawUnsafe(userCardsQuery)
    
    // Group by user_card_id to handle multiple player-team associations per card
    const cardMap = new Map()
    
    rawResults.forEach(row => {
      const userCardId = (typeof row.user_card_id === 'bigint' ? Number(row.user_card_id) : row.user_card_id).toString()
      
      if (!cardMap.has(userCardId)) {
        cardMap.set(userCardId, {
          user_card_id: typeof row.user_card_id === 'bigint' ? Number(row.user_card_id) : Number(row.user_card_id),
          random_code: row.random_code,
          serial_number: row.serial_number,
          purchase_price: row.purchase_price ? Number(row.purchase_price) : null,
          estimated_value: row.estimated_value ? Number(row.estimated_value) : null,
          current_value: row.current_value ? Number(row.current_value) : null,
          grade: row.grade,
          grade_id: typeof row.grade_id === 'bigint' ? Number(row.grade_id) : row.grade_id,
          aftermarket_autograph: row.aftermarket_autograph,
          date_added: row.date_added,
          card_id: typeof row.card_id === 'bigint' ? Number(row.card_id) : Number(row.card_id),
          card_number: row.card_number,
          is_rookie: row.is_rookie,
          is_autograph: row.is_autograph,
          is_relic: row.is_relic,
          print_run: row.print_run ? Number(row.print_run) : null,
          card_notes: row.card_notes,
          sort_order: row.sort_order ? Number(row.sort_order) : null,
          color: row.color,
          hex_color: row.hex_color,
          grading_agency_abbr: row.grading_agency_abbr,
          grading_agency_name: row.grading_agency_name,
          location_name: row.location_name,
          user_location_id: row.user_location ? Number(row.user_location) : null,
          // Series relationship data
          series_rel: {
            series_id: typeof row.series_id === 'bigint' ? Number(row.series_id) : Number(row.series_id),
            name: row.series_name
          },
          // Initialize player-team relationships array
          card_player_teams: []
        })
      }
      
      // Add player-team relationship if exists
      if (row.first_name && row.last_name) {
        cardMap.get(userCardId).card_player_teams.push({
          player: {
            name: `${row.first_name} ${row.last_name}`,
            first_name: row.first_name,
            last_name: row.last_name
          },
          team: {
            team_id: row.team_id ? (typeof row.team_id === 'bigint' ? Number(row.team_id) : Number(row.team_id)) : null,
            name: row.team_name,
            abbreviation: row.team_abbr,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color
          }
        })
      }
    })

    // Convert Map to array for response
    const cards = Array.from(cardMap.values())
    
    // Return in the format UniversalCardTable expects
    res.json({ 
      cards,
      total: cards.length,
      page: 1,
      limit: cards.length,
      hasMore: false
    })
  } catch (error) {
    console.error('Error getting user cards for specific card:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user cards'
    })
  }
})

// POST /api/user/cards/counts - Get user's card counts for specific cards
router.post('/counts', async (req, res) => {
  try {
    const { card_ids } = req.body
    console.log('Full req.user object:', req.user)
    
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!Array.isArray(card_ids) || card_ids.length === 0) {
      return res.json({ counts: {} })
    }

    console.log('Getting card counts for user:', userId, 'cards:', card_ids.length)

    // Convert card_ids to integers for proper SQL binding
    const cardIdNumbers = card_ids.map(id => parseInt(id))

    const counts = await prisma.$queryRaw`
      SELECT 
        card,
        COUNT(*) as count
      FROM user_card 
      WHERE [user] = ${BigInt(parseInt(userId))} 
      AND card IN (${Prisma.join(cardIdNumbers)})
      GROUP BY card
    `

    // Convert to object map for easier frontend consumption
    const countsMap = {}
    counts.forEach(row => {
      countsMap[Number(row.card)] = Number(row.count)
    })

    res.json({ counts: countsMap })
  } catch (error) {
    console.error('Error getting user card counts:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user card counts'
    })
  }
})

// POST /api/user/cards - Add a card to user's collection
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    const {
      card_id,
      random_code,
      serial_number,
      user_location,
      notes,
      aftermarket_autograph,
      purchase_price,
      estimated_value,
      grading_agency,
      grade,
      grade_id
    } = req.body

    console.log('Adding card to collection:', { userId, card_id, serial_number })

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Validate required fields
    if (!card_id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'card_id is required'
      })
    }

    // Check if card exists
    const cardExists = await prisma.$queryRaw`
      SELECT card_id FROM card WHERE card_id = ${card_id}
    `
    
    if (cardExists.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Card does not exist'
      })
    }

    // Insert user card
    const insertResult = await prisma.$queryRaw`
      INSERT INTO user_card (
        [user], 
        card, 
        random_code,
        serial_number, 
        purchase_price, 
        estimated_value, 
        grading_agency, 
        grade, 
        grade_id,
        aftermarket_autograph,
        user_location, 
        notes,
        created
      )
      OUTPUT INSERTED.user_card_id
      VALUES (
        ${BigInt(parseInt(userId))},
        ${card_id},
        ${random_code},
        ${serial_number},
        ${purchase_price},
        ${estimated_value},
        ${grading_agency},
        ${grade},
        ${grade_id || null},
        ${aftermarket_autograph || false},
        ${user_location},
        ${notes || null},
        GETDATE()
      )
    `

    const newUserCardId = insertResult[0].user_card_id

    res.status(201).json({
      message: 'Card added to collection successfully',
      user_card_id: Number(newUserCardId)
    })

  } catch (error) {
    console.error('Error adding card to collection:', error)
    
    // Handle duplicate key constraint
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        error: 'Duplicate card',
        message: 'This card is already in your collection'
      })
    }

    res.status(500).json({
      error: 'Database error',
      message: 'Failed to add card to collection'
    })
  }
})

// GET /api/user/cards - Get user's card collection
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { limit = 100, page = 1 } = req.query

    const limitNum = Math.min(parseInt(limit) || 100, 1000)
    const pageNum = parseInt(page) || 1
    const offsetNum = (pageNum - 1) * limitNum

    console.log('Getting user collection:', { userId, limit: limitNum, page: pageNum })

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    const userCards = await prisma.$queryRaw`
      SELECT 
        uc.user_card_id,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.grading_agency,
        uc.grade,
        uc.grade_id,
        uc.aftermarket_auto,
        uc.notes,
        uc.created,
        c.card_id,
        c.card_number,
        c.print_run,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        s.name as series_name,
        ul.location as user_location_name,
        ga.name as grading_agency_name
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      WHERE uc.[user] = ${BigInt(parseInt(userId))}
      ORDER BY uc.created DESC
      OFFSET ${offsetNum} ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `

    // Get total count
    const totalCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM user_card WHERE [user] = ${userId}
    `

    const serializedCards = userCards.map(card => {
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })
      return serialized
    })

    res.json({
      cards: serializedCards,
      total: Number(totalCount[0].total),
      page: pageNum,
      limit: limitNum
    })

  } catch (error) {
    console.error('Error getting user collection:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user collection'
    })
  }
})

// PUT /api/user/cards/:userCardId - Update a user's card
router.put('/:userCardId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId } = req.params
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Updating user card:', { userId, userCardId, body: req.body })

    // Verify the user_card belongs to this user
    const existingCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (existingCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Extract and validate the update data
    const {
      random_code,
      serial_number,
      user_location,
      notes,
      aftermarket_autograph,
      purchase_price,
      estimated_value,
      current_value,
      grading_agency,
      grade
    } = req.body

    // Build update data object for simpler approach
    const updateData = {}
    
    if (random_code !== undefined) updateData.random_code = random_code || null
    if (serial_number !== undefined) updateData.serial_number = serial_number
    if (user_location !== undefined) updateData.user_location = user_location || null
    if (notes !== undefined) updateData.notes = notes || null
    if (aftermarket_autograph !== undefined) updateData.aftermarket_autograph = aftermarket_autograph ? 1 : 0
    if (purchase_price !== undefined) updateData.purchase_price = purchase_price || null
    if (estimated_value !== undefined) updateData.estimated_value = estimated_value || null
    if (current_value !== undefined) updateData.current_value = current_value || null
    if (grading_agency !== undefined) updateData.grading_agency = grading_agency || null
    if (grade !== undefined) updateData.grade = grade || null

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'At least one field must be provided for update'
      })
    }

    console.log('Updating user card:', { userId, userCardId, updateData })

    // Use individual field updates with proper parameter binding
    const updates = []
    if (updateData.random_code !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET random_code = ${updateData.random_code} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.serial_number !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET serial_number = ${updateData.serial_number} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.user_location !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET user_location = ${updateData.user_location} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.notes !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET notes = ${updateData.notes} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.aftermarket_autograph !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET aftermarket_autograph = ${updateData.aftermarket_autograph} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.purchase_price !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET purchase_price = ${updateData.purchase_price} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.estimated_value !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET estimated_value = ${updateData.estimated_value} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.current_value !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET current_value = ${updateData.current_value} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.grading_agency !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET grading_agency = ${updateData.grading_agency} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }
    if (updateData.grade !== undefined) {
      await prisma.$queryRaw`UPDATE user_card SET grade = ${updateData.grade} WHERE user_card_id = ${parseInt(userCardId)} AND [user] = ${BigInt(parseInt(userId))}`
    }

    res.json({
      message: 'Card updated successfully',
      user_card_id: parseInt(userCardId)
    })

  } catch (error) {
    console.error('Error updating user card:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update card'
    })
  }
})

// DELETE /api/user/cards/:userCardId - Remove card from collection
router.delete('/:userCardId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId } = req.params

    console.log('Removing card from collection:', { userId, userCardId })

    // Validate authentication
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // First, get all photos for this user card so we can delete them from Azure Blob Storage
    const photos = await prisma.$queryRaw`
      SELECT user_card_photo_id, photo_url, blob_name
      FROM user_card_photo
      WHERE user_card = ${parseInt(userCardId)}
    `

    // Delete photos from Azure Blob Storage
    if (photos.length > 0 && process.env.AZURE_STORAGE_CONNECTION_STRING) {
      try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
        const containerClient = blobServiceClient.getContainerClient('user-card')

        for (const photo of photos) {
          if (photo.blob_name) {
            try {
              await containerClient.deleteBlob(photo.blob_name)
              console.log(`Deleted blob: ${photo.blob_name}`)
            } catch (blobError) {
              console.error(`Failed to delete blob ${photo.blob_name}:`, blobError.message)
              // Continue with other deletions even if one fails
            }
          }
        }
      } catch (azureError) {
        console.error('Error connecting to Azure Blob Storage:', azureError.message)
        // Continue with database deletion even if Azure cleanup fails
      }
    }

    // Delete photo records from database
    if (photos.length > 0) {
      await prisma.$queryRaw`
        DELETE FROM user_card_photo 
        WHERE user_card = ${parseInt(userCardId)}
      `
      console.log(`Deleted ${photos.length} photo records`)
    }

    // Finally, delete the user card record
    const deleteResult = await prisma.$queryRaw`
      DELETE FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    res.json({
      message: 'Card and associated photos removed from collection successfully'
    })

  } catch (error) {
    console.error('Error removing card from collection:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to remove card from collection'
    })
  }
})

module.exports = router