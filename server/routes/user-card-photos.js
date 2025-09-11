const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const router = express.Router()
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')
const { prisma } = require('../config/prisma-singleton')
const { Prisma } = require('@prisma/client')

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per photo
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP image files are allowed'))
    }
  }
})

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const CONTAINER_NAME = 'user-card-photos'

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/cards/:userCardId/photos - Get all photos for a user card
router.get('/:userCardId/photos', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Verify the user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (userCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Get all photos for this user card, ordered by sort_order
    const photos = await prisma.$queryRaw`
      SELECT 
        user_card_photo_id,
        photo_url,
        sort_order,
        created
      FROM user_card_photo
      WHERE user_card = ${parseInt(userCardId)}
      ORDER BY sort_order ASC
    `

    // Serialize BigInt values
    const serializedPhotos = photos.map(photo => ({
      user_card_photo_id: Number(photo.user_card_photo_id),
      photo_url: photo.photo_url,
      sort_order: photo.sort_order,
      created: photo.created
    }))

    res.json({
      success: true,
      photos: serializedPhotos
    })

  } catch (error) {
    console.error('Error fetching user card photos:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch card photos'
    })
  }
})

// POST /api/user/cards/:userCardId/photos - Upload new photo(s) for a user card
router.post('/:userCardId/photos', upload.array('photos', 5), async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId } = req.params
    const files = req.files

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files provided',
        message: 'Please select at least one photo to upload'
      })
    }

    // Verify the user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (userCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Check current photo count
    const currentPhotosResult = await prisma.$queryRaw`
      SELECT COUNT(*) as photo_count
      FROM user_card_photo
      WHERE user_card = ${parseInt(userCardId)}
    `
    
    const currentPhotoCount = Number(currentPhotosResult[0].photo_count)
    const remainingSlots = 5 - currentPhotoCount

    if (remainingSlots <= 0) {
      return res.status(400).json({
        error: 'Photo limit reached',
        message: 'Maximum 5 photos allowed per card. Please delete existing photos to upload new ones.'
      })
    }

    if (files.length > remainingSlots) {
      return res.status(400).json({
        error: 'Too many photos',
        message: `You can only upload ${remainingSlots} more photo(s). Maximum 5 photos per card.`
      })
    }

    // Check Azure Storage configuration
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      console.error('Azure Storage connection string not configured')
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Azure Storage not configured. Please contact support.'
      })
    }

    // Create Azure Storage client
    let blobServiceClient
    try {
      blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    } catch (error) {
      console.error('Invalid Azure Storage connection string:', error.message)
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid Azure Storage configuration. Please contact support.'
      })
    }

    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)

    // Ensure container exists with public read access
    await containerClient.createIfNotExists({
      access: 'blob'
    })

    // Upload each file and create database records
    const uploadedPhotos = []
    let nextSortOrder = currentPhotoCount + 1

    for (const file of files) {
      // Generate unique blob name: userCardId_timestamp_originalname
      const timestamp = Date.now()
      const fileExtension = file.originalname.split('.').pop()
      const sanitizedFileName = file.originalname
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
        .substring(0, 50) // Limit filename length
      
      const blobName = `user-card/${userCardId}_${timestamp}_${sanitizedFileName}.${fileExtension}`
      
      // Upload to Azure Blob Storage
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)
      
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype
        }
      })

      // Get the public URL
      const photoUrl = blockBlobClient.url

      // Insert record into database
      const insertResult = await prisma.$queryRaw`
        INSERT INTO user_card_photo (user_card, photo_url, sort_order, created)
        OUTPUT INSERTED.user_card_photo_id, INSERTED.photo_url, INSERTED.sort_order, INSERTED.created
        VALUES (${parseInt(userCardId)}, ${photoUrl}, ${nextSortOrder}, GETDATE())
      `

      uploadedPhotos.push({
        user_card_photo_id: Number(insertResult[0].user_card_photo_id),
        photo_url: insertResult[0].photo_url,
        sort_order: insertResult[0].sort_order,
        created: insertResult[0].created
      })

      nextSortOrder++
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`,
      photos: uploadedPhotos,
      remaining_slots: 5 - (currentPhotoCount + uploadedPhotos.length)
    })

  } catch (error) {
    console.error('Error uploading user card photos:', error)
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload photos. Please try again.',
      details: error.message
    })
  }
})

// PUT /api/user/cards/:userCardId/photos/reorder - Update sort_order for all photos
router.put('/:userCardId/photos/reorder', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId } = req.params
    const { photoOrders } = req.body // Array of { photoId, sortOrder }
    
    console.log('Photo reorder request:', { userId, userCardId, photoOrders })

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!photoOrders || !Array.isArray(photoOrders)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'photoOrders array is required'
      })
    }

    // Verify the user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (userCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Verify all photos belong to this user card
    const photoIds = photoOrders.map(p => parseInt(p.photoId))
    const verifyPhotos = await prisma.$queryRaw`
      SELECT user_card_photo_id
      FROM user_card_photo
      WHERE user_card = ${parseInt(userCardId)}
      AND user_card_photo_id IN (${Prisma.join(photoIds)})
    `

    if (verifyPhotos.length !== photoIds.length) {
      return res.status(400).json({
        error: 'Invalid photos',
        message: 'One or more photos do not belong to this card'
      })
    }

    // Update sort orders
    for (const { photoId, sortOrder } of photoOrders) {
      if (sortOrder < 1 || sortOrder > 5) {
        return res.status(400).json({
          error: 'Invalid sort order',
          message: 'Sort order must be between 1 and 5'
        })
      }

      await prisma.$queryRaw`
        UPDATE user_card_photo
        SET sort_order = ${parseInt(sortOrder)}
        WHERE user_card_photo_id = ${parseInt(photoId)}
        AND user_card = ${parseInt(userCardId)}
      `
    }

    res.json({
      success: true,
      message: 'Photo order updated successfully'
    })

  } catch (error) {
    console.error('Error reordering photos:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    })
    res.status(500).json({
      error: 'Update failed',
      message: 'Failed to update photo order',
      details: error.message
    })
  }
})

// PUT /api/user/cards/:userCardId/photos/:photoId - Replace/update a single photo
router.put('/:userCardId/photos/:photoId', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId, photoId } = req.params
    const file = req.file

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please select a photo to upload'
      })
    }

    // Verify the user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (userCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Get the existing photo to replace
    const existingPhoto = await prisma.$queryRaw`
      SELECT photo_url, sort_order
      FROM user_card_photo
      WHERE user_card_photo_id = ${parseInt(photoId)}
      AND user_card = ${parseInt(userCardId)}
    `

    if (existingPhoto.length === 0) {
      return res.status(404).json({
        error: 'Photo not found',
        message: 'Photo not found or does not belong to this card'
      })
    }

    const oldPhotoUrl = existingPhoto[0].photo_url
    const sortOrder = existingPhoto[0].sort_order

    // Check Azure Storage configuration
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      console.error('Azure Storage connection string not configured')
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Azure Storage not configured. Please contact support.'
      })
    }

    // Create Azure Storage client
    let blobServiceClient
    try {
      blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    } catch (error) {
      console.error('Invalid Azure Storage connection string:', error.message)
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid Azure Storage configuration. Please contact support.'
      })
    }

    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)

    // Generate unique blob name for new photo
    const timestamp = Date.now()
    const fileExtension = file.originalname.split('.').pop()
    const sanitizedFileName = file.originalname
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
      .substring(0, 50) // Limit filename length
    
    const blobName = `user-card/${userCardId}_${timestamp}_${sanitizedFileName}.${fileExtension}`
    
    // Upload new photo to Azure Blob Storage
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype
      }
    })

    // Get the public URL for new photo
    const newPhotoUrl = blockBlobClient.url

    // Update database record
    await prisma.$queryRaw`
      UPDATE user_card_photo
      SET photo_url = ${newPhotoUrl}
      WHERE user_card_photo_id = ${parseInt(photoId)}
      AND user_card = ${parseInt(userCardId)}
    `

    // Delete old photo from Azure Blob Storage (non-critical if it fails)
    try {
      if (oldPhotoUrl) {
        const urlParts = oldPhotoUrl.split('/')
        const oldBlobName = urlParts.slice(-2).join('/') // Get last two parts: user-card/filename
        
        if (oldBlobName.startsWith('user-card/')) {
          const oldBlockBlobClient = containerClient.getBlockBlobClient(oldBlobName)
          await oldBlockBlobClient.deleteIfExists()
        }
      }
    } catch (blobError) {
      console.error('Failed to delete old blob from storage:', blobError)
      // Continue anyway - new photo upload was successful
    }

    res.json({
      success: true,
      message: 'Photo updated successfully',
      photo: {
        user_card_photo_id: parseInt(photoId),
        photo_url: newPhotoUrl,
        sort_order: sortOrder
      }
    })

  } catch (error) {
    console.error('Error updating photo:', error)
    res.status(500).json({
      error: 'Update failed',
      message: 'Failed to update photo. Please try again.',
      details: error.message
    })
  }
})

// DELETE /api/user/cards/:userCardId/photos/:photoId - Delete a photo
router.delete('/:userCardId/photos/:photoId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { userCardId, photoId } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Verify the user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id 
      FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    if (userCard.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
        message: 'User card not found or does not belong to you'
      })
    }

    // Get the photo to delete (to get its URL for blob deletion)
    const photoToDelete = await prisma.$queryRaw`
      SELECT photo_url, sort_order
      FROM user_card_photo
      WHERE user_card_photo_id = ${parseInt(photoId)}
      AND user_card = ${parseInt(userCardId)}
    `

    if (photoToDelete.length === 0) {
      return res.status(404).json({
        error: 'Photo not found',
        message: 'Photo not found or does not belong to this card'
      })
    }

    const deletedSortOrder = photoToDelete[0].sort_order
    const photoUrl = photoToDelete[0].photo_url

    // Delete from database first
    await prisma.$queryRaw`
      DELETE FROM user_card_photo
      WHERE user_card_photo_id = ${parseInt(photoId)}
      AND user_card = ${parseInt(userCardId)}
    `

    // Reorder remaining photos to fill the gap
    await prisma.$queryRaw`
      UPDATE user_card_photo
      SET sort_order = sort_order - 1
      WHERE user_card = ${parseInt(userCardId)}
      AND sort_order > ${deletedSortOrder}
    `

    // Try to delete from Azure Blob Storage (non-critical if it fails)
    try {
      if (AZURE_STORAGE_CONNECTION_STRING && photoUrl) {
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
        const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)
        
        // Extract blob name from URL
        const urlParts = photoUrl.split('/')
        const blobName = urlParts.slice(-2).join('/') // Get last two parts: user-card/filename
        
        if (blobName.startsWith('user-card/')) {
          const blockBlobClient = containerClient.getBlockBlobClient(blobName)
          await blockBlobClient.deleteIfExists()
        }
      }
    } catch (blobError) {
      console.error('Failed to delete blob from storage:', blobError)
      // Continue anyway - database deletion was successful
    }

    // Get remaining photos count
    const remainingPhotosResult = await prisma.$queryRaw`
      SELECT COUNT(*) as photo_count
      FROM user_card_photo
      WHERE user_card = ${parseInt(userCardId)}
    `

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      remaining_photos: Number(remainingPhotosResult[0].photo_count),
      remaining_slots: 5 - Number(remainingPhotosResult[0].photo_count)
    })

  } catch (error) {
    console.error('Error deleting photo:', error)
    res.status(500).json({
      error: 'Delete failed',
      message: 'Failed to delete photo'
    })
  }
})


module.exports = router