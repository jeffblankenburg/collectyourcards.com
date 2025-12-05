/**
 * Supply Management API Routes
 *
 * Tracks supply types, batches with FIFO inventory management,
 * and shipping configurations (BOMs) for sellers.
 */

const express = require('express')
const router = express.Router()
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')
const prisma = require('../config/prisma')
const { authMiddleware: requireAuth, requireSeller } = require('../middleware/auth')
const { getBlobName, extractBlobNameFromUrl } = require('../utils/azure-storage')

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for supply images
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

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const CONTAINER_NAME = 'user-card-photos' // Reuse existing container, store in supply-batch/ subfolder

// Helper to serialize BigInt values
const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// ============================================================
// SUPPLY TYPES
// ============================================================

/**
 * GET /api/supplies/types
 * Get all supply types for the current user
 */
router.get('/types', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const supplyTypes = await prisma.supply_type.findMany({
      where: {
        user_id: userId,
        is_active: true
      },
      orderBy: { name: 'asc' }
    })

    res.json({
      supply_types: serializeBigInt(supplyTypes)
    })
  } catch (error) {
    console.error('Error fetching supply types:', error)
    res.status(500).json({ error: 'Failed to fetch supply types' })
  }
})

/**
 * POST /api/supplies/types
 * Create a new supply type
 */
router.post('/types', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { name, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const supplyType = await prisma.supply_type.create({
      data: {
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    console.log(`Supplies: Created supply type ${supplyType.supply_type_id} for user ${userId}`)

    res.status(201).json({
      message: 'Supply type created successfully',
      supply_type: serializeBigInt(supplyType)
    })
  } catch (error) {
    console.error('Error creating supply type:', error)
    res.status(500).json({ error: 'Failed to create supply type' })
  }
})

/**
 * PUT /api/supplies/types/:id
 * Update a supply type
 */
router.put('/types/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const typeId = parseInt(req.params.id)
    const { name, description, is_active } = req.body

    // Verify ownership
    const existing = await prisma.supply_type.findFirst({
      where: {
        supply_type_id: typeId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply type not found' })
    }

    const supplyType = await prisma.supply_type.update({
      where: { supply_type_id: typeId },
      data: {
        name: name?.trim() ?? undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        is_active: is_active ?? undefined
      }
    })

    res.json({
      message: 'Supply type updated successfully',
      supply_type: serializeBigInt(supplyType)
    })
  } catch (error) {
    console.error('Error updating supply type:', error)
    res.status(500).json({ error: 'Failed to update supply type' })
  }
})

/**
 * DELETE /api/supplies/types/:id
 * Delete a supply type (soft delete by setting is_active = false)
 */
router.delete('/types/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const typeId = parseInt(req.params.id)

    // Verify ownership
    const existing = await prisma.supply_type.findFirst({
      where: {
        supply_type_id: typeId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply type not found' })
    }

    // Soft delete
    await prisma.supply_type.update({
      where: { supply_type_id: typeId },
      data: { is_active: false }
    })

    console.log(`Supplies: Deactivated supply type ${typeId}`)

    res.json({ message: 'Supply type deleted successfully' })
  } catch (error) {
    console.error('Error deleting supply type:', error)
    res.status(500).json({ error: 'Failed to delete supply type' })
  }
})

// ============================================================
// SUPPLY BATCHES
// ============================================================

/**
 * GET /api/supplies/batches
 * Get all supply batches for the current user (with optional filtering)
 */
router.get('/batches', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { supply_type_id, include_depleted = 'false' } = req.query

    const where = { user_id: userId }

    if (supply_type_id) {
      where.supply_type_id = parseInt(supply_type_id)
    }

    if (include_depleted !== 'true') {
      where.is_depleted = false
    }

    const batches = await prisma.supply_batch.findMany({
      where,
      include: {
        supply_type: true
      },
      orderBy: [
        { supply_type_id: 'asc' },
        { purchase_date: 'asc' } // FIFO order
      ]
    })

    res.json({
      batches: serializeBigInt(batches)
    })
  } catch (error) {
    console.error('Error fetching supply batches:', error)
    res.status(500).json({ error: 'Failed to fetch supply batches' })
  }
})

/**
 * GET /api/supplies/batches/summary
 * Get summary of supply inventory (total remaining by type)
 */
router.get('/batches/summary', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const summary = await prisma.$queryRaw`
      SELECT
        st.supply_type_id,
        st.name,
        SUM(sb.quantity_remaining) as total_remaining,
        COUNT(sb.supply_batch_id) as batch_count,
        MIN(sb.cost_per_unit) as min_cost,
        MAX(sb.cost_per_unit) as max_cost,
        AVG(sb.cost_per_unit) as avg_cost
      FROM supply_type st
      LEFT JOIN supply_batch sb ON st.supply_type_id = sb.supply_type_id AND sb.is_depleted = 0
      WHERE st.user_id = ${userId} AND st.is_active = 1
      GROUP BY st.supply_type_id, st.name
      ORDER BY st.name
    `

    res.json({
      summary: serializeBigInt(summary)
    })
  } catch (error) {
    console.error('Error fetching supply summary:', error)
    res.status(500).json({ error: 'Failed to fetch supply summary' })
  }
})

/**
 * POST /api/supplies/batches
 * Create a new supply batch (purchase)
 */
router.post('/batches', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const {
      supply_type_id,
      purchase_date,
      quantity_purchased,
      total_cost,
      notes,
      image_url,
      source_url
    } = req.body

    if (!supply_type_id) {
      return res.status(400).json({ error: 'supply_type_id is required' })
    }
    if (!quantity_purchased || quantity_purchased <= 0) {
      return res.status(400).json({ error: 'quantity_purchased must be positive' })
    }
    if (total_cost === undefined || total_cost < 0) {
      return res.status(400).json({ error: 'total_cost is required and cannot be negative' })
    }

    // Verify supply type belongs to user
    const supplyType = await prisma.supply_type.findFirst({
      where: {
        supply_type_id: parseInt(supply_type_id),
        user_id: userId
      }
    })

    if (!supplyType) {
      return res.status(404).json({ error: 'Supply type not found' })
    }

    // Calculate cost per unit (6 decimal places for fractional cents)
    const costPerUnit = parseFloat(total_cost) / parseInt(quantity_purchased)

    const batch = await prisma.supply_batch.create({
      data: {
        user_id: userId,
        supply_type_id: parseInt(supply_type_id),
        purchase_date: purchase_date ? new Date(purchase_date) : new Date(),
        quantity_purchased: parseInt(quantity_purchased),
        total_cost: parseFloat(total_cost),
        cost_per_unit: costPerUnit,
        quantity_remaining: parseInt(quantity_purchased),
        notes: notes?.trim() || null,
        image_url: image_url?.trim() || null,
        source_url: source_url?.trim() || null
      },
      include: {
        supply_type: true
      }
    })

    console.log(`Supplies: Created batch ${batch.supply_batch_id} - ${quantity_purchased} x ${supplyType.name}`)

    res.status(201).json({
      message: 'Supply batch created successfully',
      batch: serializeBigInt(batch)
    })
  } catch (error) {
    console.error('Error creating supply batch:', error)
    res.status(500).json({ error: 'Failed to create supply batch' })
  }
})

/**
 * PUT /api/supplies/batches/:id
 * Update a supply batch
 */
router.put('/batches/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const batchId = BigInt(req.params.id)
    const {
      supply_type_id,
      purchase_date,
      quantity_purchased,
      quantity_remaining,
      total_cost,
      cost_per_unit,
      is_depleted,
      notes,
      image_url,
      source_url
    } = req.body

    // Verify ownership
    const existing = await prisma.supply_batch.findFirst({
      where: {
        supply_batch_id: batchId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply batch not found' })
    }

    const updateData = {
      updated: new Date()
    }

    // Handle supply_type_id change - verify the new type belongs to the user
    if (supply_type_id !== undefined) {
      const supplyType = await prisma.supply_type.findFirst({
        where: {
          supply_type_id: parseInt(supply_type_id),
          user_id: userId
        }
      })
      if (!supplyType) {
        return res.status(400).json({ error: 'Invalid supply type' })
      }
      updateData.supply_type_id = parseInt(supply_type_id)
    }

    if (purchase_date !== undefined) {
      updateData.purchase_date = new Date(purchase_date)
    }
    if (quantity_purchased !== undefined) {
      updateData.quantity_purchased = parseInt(quantity_purchased)
    }
    if (total_cost !== undefined) {
      updateData.total_cost = parseFloat(total_cost)
    }
    if (cost_per_unit !== undefined) {
      updateData.cost_per_unit = parseFloat(cost_per_unit)
    }
    if (quantity_remaining !== undefined) {
      updateData.quantity_remaining = parseInt(quantity_remaining)
      // Auto-mark as depleted if remaining is 0
      if (updateData.quantity_remaining <= 0) {
        updateData.is_depleted = true
        updateData.quantity_remaining = 0
      }
    }
    if (is_depleted !== undefined) {
      updateData.is_depleted = is_depleted
    }
    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null
    }
    if (image_url !== undefined) {
      updateData.image_url = image_url?.trim() || null
    }
    if (source_url !== undefined) {
      updateData.source_url = source_url?.trim() || null
    }

    const batch = await prisma.supply_batch.update({
      where: { supply_batch_id: batchId },
      data: updateData,
      include: {
        supply_type: true
      }
    })

    res.json({
      message: 'Supply batch updated successfully',
      batch: serializeBigInt(batch)
    })
  } catch (error) {
    console.error('Error updating supply batch:', error)
    res.status(500).json({ error: 'Failed to update supply batch' })
  }
})

/**
 * POST /api/supplies/batches/:id/deplete
 * Mark a batch as depleted (even if remaining > 0)
 */
router.post('/batches/:id/deplete', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const batchId = BigInt(req.params.id)

    // Verify ownership
    const existing = await prisma.supply_batch.findFirst({
      where: {
        supply_batch_id: batchId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply batch not found' })
    }

    const batch = await prisma.supply_batch.update({
      where: { supply_batch_id: batchId },
      data: {
        is_depleted: true,
        updated: new Date()
      },
      include: {
        supply_type: true
      }
    })

    console.log(`Supplies: Manually depleted batch ${batchId}`)

    res.json({
      message: 'Supply batch marked as depleted',
      batch: serializeBigInt(batch)
    })
  } catch (error) {
    console.error('Error depleting supply batch:', error)
    res.status(500).json({ error: 'Failed to deplete supply batch' })
  }
})

/**
 * POST /api/supplies/batches/:id/image
 * Upload an image for a supply batch
 */
router.post('/batches/:id/image', requireAuth, requireSeller, upload.single('image'), async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const batchId = BigInt(req.params.id)
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    // Verify ownership
    const existing = await prisma.supply_batch.findFirst({
      where: {
        supply_batch_id: batchId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply batch not found' })
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

    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' })

    // Generate unique blob name
    const timestamp = Date.now()
    const fileExtension = file.originalname.split('.').pop()
    const sanitizedFileName = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50)

    const blobName = getBlobName(`supply-batch/${batchId}_${timestamp}_${sanitizedFileName}.${fileExtension}`)

    // Delete old image if exists
    if (existing.image_url) {
      try {
        const oldBlobName = extractBlobNameFromUrl(existing.image_url, 2)
        if (oldBlobName.includes('supply-batch/')) {
          const oldBlockBlobClient = containerClient.getBlockBlobClient(oldBlobName)
          await oldBlockBlobClient.deleteIfExists()
        }
      } catch (deleteError) {
        console.error('Failed to delete old supply batch image:', deleteError)
      }
    }

    // Upload new image
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype }
    })

    const imageUrl = blockBlobClient.url

    // Update database
    const batch = await prisma.supply_batch.update({
      where: { supply_batch_id: batchId },
      data: {
        image_url: imageUrl,
        updated: new Date()
      },
      include: { supply_type: true }
    })

    console.log(`Supplies: Uploaded image for batch ${batchId}`)

    res.json({
      message: 'Image uploaded successfully',
      batch: serializeBigInt(batch)
    })
  } catch (error) {
    console.error('Error uploading supply batch image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

/**
 * DELETE /api/supplies/batches/:id/image
 * Delete the image from a supply batch
 */
router.delete('/batches/:id/image', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const batchId = BigInt(req.params.id)

    // Verify ownership
    const existing = await prisma.supply_batch.findFirst({
      where: {
        supply_batch_id: batchId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply batch not found' })
    }

    if (!existing.image_url) {
      return res.status(400).json({ error: 'No image to delete' })
    }

    // Delete from Azure Storage
    if (AZURE_STORAGE_CONNECTION_STRING) {
      try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
        const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)
        const blobName = extractBlobNameFromUrl(existing.image_url, 2)

        if (blobName.includes('supply-batch/')) {
          const blockBlobClient = containerClient.getBlockBlobClient(blobName)
          await blockBlobClient.deleteIfExists()
        }
      } catch (deleteError) {
        console.error('Failed to delete supply batch image from storage:', deleteError)
      }
    }

    // Update database
    const batch = await prisma.supply_batch.update({
      where: { supply_batch_id: batchId },
      data: {
        image_url: null,
        updated: new Date()
      },
      include: { supply_type: true }
    })

    console.log(`Supplies: Deleted image for batch ${batchId}`)

    res.json({
      message: 'Image deleted successfully',
      batch: serializeBigInt(batch)
    })
  } catch (error) {
    console.error('Error deleting supply batch image:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

/**
 * DELETE /api/supplies/batches/:id
 * Delete a supply batch
 */
router.delete('/batches/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const batchId = BigInt(req.params.id)

    // Verify ownership
    const existing = await prisma.supply_batch.findFirst({
      where: {
        supply_batch_id: batchId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply batch not found' })
    }

    // Check if this batch has been used in any sales
    const usageCount = await prisma.sale_supply_usage.count({
      where: { supply_batch_id: batchId }
    })

    if (usageCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete batch that has been used in sales. Mark as depleted instead.'
      })
    }

    await prisma.supply_batch.delete({
      where: { supply_batch_id: batchId }
    })

    console.log(`Supplies: Deleted batch ${batchId}`)

    res.json({ message: 'Supply batch deleted successfully' })
  } catch (error) {
    console.error('Error deleting supply batch:', error)
    res.status(500).json({ error: 'Failed to delete supply batch' })
  }
})

// ============================================================
// SHIPPING CONFIGURATIONS
// ============================================================

/**
 * GET /api/supplies/shipping-configs
 * Get all shipping configs for the current user
 */
router.get('/shipping-configs', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const configs = await prisma.shipping_config.findMany({
      where: {
        user_id: userId,
        is_active: true
      },
      include: {
        shipping_config_items: {
          include: {
            supply_type: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json({
      shipping_configs: serializeBigInt(configs)
    })
  } catch (error) {
    console.error('Error fetching shipping configs:', error)
    res.status(500).json({ error: 'Failed to fetch shipping configs' })
  }
})

/**
 * GET /api/supplies/shipping-configs/:id
 * Get a single shipping config with its BOM
 */
router.get('/shipping-configs/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const configId = parseInt(req.params.id)

    const config = await prisma.shipping_config.findFirst({
      where: {
        shipping_config_id: configId,
        user_id: userId
      },
      include: {
        shipping_config_items: {
          include: {
            supply_type: true
          }
        }
      }
    })

    if (!config) {
      return res.status(404).json({ error: 'Shipping config not found' })
    }

    res.json({
      shipping_config: serializeBigInt(config)
    })
  } catch (error) {
    console.error('Error fetching shipping config:', error)
    res.status(500).json({ error: 'Failed to fetch shipping config' })
  }
})

/**
 * POST /api/supplies/shipping-configs
 * Create a new shipping config with its BOM items
 */
router.post('/shipping-configs', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { name, description, items = [] } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // Verify all supply types belong to user
    if (items.length > 0) {
      const typeIds = items.map(i => parseInt(i.supply_type_id))
      const validTypes = await prisma.supply_type.count({
        where: {
          supply_type_id: { in: typeIds },
          user_id: userId
        }
      })

      if (validTypes !== typeIds.length) {
        return res.status(400).json({ error: 'Invalid supply type in items' })
      }
    }

    const config = await prisma.shipping_config.create({
      data: {
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        shipping_config_items: {
          create: items.map(item => ({
            supply_type_id: parseInt(item.supply_type_id),
            quantity: parseInt(item.quantity) || 1
          }))
        }
      },
      include: {
        shipping_config_items: {
          include: {
            supply_type: true
          }
        }
      }
    })

    console.log(`Supplies: Created shipping config ${config.shipping_config_id} - ${name}`)

    res.status(201).json({
      message: 'Shipping config created successfully',
      shipping_config: serializeBigInt(config)
    })
  } catch (error) {
    console.error('Error creating shipping config:', error)
    res.status(500).json({ error: 'Failed to create shipping config' })
  }
})

/**
 * PUT /api/supplies/shipping-configs/:id
 * Update a shipping config and its BOM items
 */
router.put('/shipping-configs/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const configId = parseInt(req.params.id)
    const { name, description, is_active, items } = req.body

    // Verify ownership
    const existing = await prisma.shipping_config.findFirst({
      where: {
        shipping_config_id: configId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Shipping config not found' })
    }

    // If items are provided, verify all supply types belong to user
    if (items !== undefined && items.length > 0) {
      const typeIds = items.map(i => parseInt(i.supply_type_id))
      const validTypes = await prisma.supply_type.count({
        where: {
          supply_type_id: { in: typeIds },
          user_id: userId
        }
      })

      if (validTypes !== typeIds.length) {
        return res.status(400).json({ error: 'Invalid supply type in items' })
      }
    }

    // Use transaction to update config and items
    const config = await prisma.$transaction(async (tx) => {
      // Update config
      const updated = await tx.shipping_config.update({
        where: { shipping_config_id: configId },
        data: {
          name: name?.trim() ?? undefined,
          description: description !== undefined ? (description?.trim() || null) : undefined,
          is_active: is_active ?? undefined
        }
      })

      // If items provided, replace all items
      if (items !== undefined) {
        await tx.shipping_config_item.deleteMany({
          where: { shipping_config_id: configId }
        })

        if (items.length > 0) {
          await tx.shipping_config_item.createMany({
            data: items.map(item => ({
              shipping_config_id: configId,
              supply_type_id: parseInt(item.supply_type_id),
              quantity: parseInt(item.quantity) || 1
            }))
          })
        }
      }

      // Return with items
      return await tx.shipping_config.findUnique({
        where: { shipping_config_id: configId },
        include: {
          shipping_config_items: {
            include: {
              supply_type: true
            }
          }
        }
      })
    })

    res.json({
      message: 'Shipping config updated successfully',
      shipping_config: serializeBigInt(config)
    })
  } catch (error) {
    console.error('Error updating shipping config:', error)
    res.status(500).json({ error: 'Failed to update shipping config' })
  }
})

/**
 * DELETE /api/supplies/shipping-configs/:id
 * Delete a shipping config (soft delete)
 */
router.delete('/shipping-configs/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const configId = parseInt(req.params.id)

    // Verify ownership
    const existing = await prisma.shipping_config.findFirst({
      where: {
        shipping_config_id: configId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Shipping config not found' })
    }

    // Soft delete
    await prisma.shipping_config.update({
      where: { shipping_config_id: configId },
      data: { is_active: false }
    })

    console.log(`Supplies: Deactivated shipping config ${configId}`)

    res.json({ message: 'Shipping config deleted successfully' })
  } catch (error) {
    console.error('Error deleting shipping config:', error)
    res.status(500).json({ error: 'Failed to delete shipping config' })
  }
})

// ============================================================
// FIFO ALLOCATION HELPER
// ============================================================

/**
 * Allocate supplies from batches using FIFO
 * Returns the batches to use and their costs
 */
async function allocateSuppliesFIFO(userId, supplyTypeId, quantity) {
  const batches = await prisma.supply_batch.findMany({
    where: {
      user_id: userId,
      supply_type_id: supplyTypeId,
      is_depleted: false,
      quantity_remaining: { gt: 0 }
    },
    orderBy: { purchase_date: 'asc' } // FIFO: oldest first
  })

  const allocations = []
  let remaining = quantity

  for (const batch of batches) {
    if (remaining <= 0) break

    const toAllocate = Math.min(remaining, batch.quantity_remaining)
    allocations.push({
      supply_batch_id: batch.supply_batch_id,
      quantity_used: toAllocate,
      cost_per_unit: parseFloat(batch.cost_per_unit),
      total_cost: toAllocate * parseFloat(batch.cost_per_unit)
    })
    remaining -= toAllocate
  }

  if (remaining > 0) {
    return {
      success: false,
      error: `Insufficient inventory. Need ${quantity}, can allocate ${quantity - remaining}`,
      allocations: []
    }
  }

  return { success: true, allocations }
}

/**
 * POST /api/supplies/calculate-cost
 * Calculate the total supply cost for a shipping config using FIFO
 */
router.post('/calculate-cost', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { shipping_config_id } = req.body

    if (!shipping_config_id) {
      return res.status(400).json({ error: 'shipping_config_id is required' })
    }

    // Get the shipping config with items
    const config = await prisma.shipping_config.findFirst({
      where: {
        shipping_config_id: parseInt(shipping_config_id),
        user_id: userId
      },
      include: {
        shipping_config_items: {
          include: {
            supply_type: true
          }
        }
      }
    })

    if (!config) {
      return res.status(404).json({ error: 'Shipping config not found' })
    }

    // Calculate cost for each item using FIFO
    let totalCost = 0
    const itemDetails = []

    for (const item of config.shipping_config_items) {
      const allocation = await allocateSuppliesFIFO(
        userId,
        item.supply_type_id,
        item.quantity
      )

      if (!allocation.success) {
        return res.status(400).json({
          error: `Insufficient ${item.supply_type.name}: ${allocation.error}`
        })
      }

      const itemCost = allocation.allocations.reduce((sum, a) => sum + a.total_cost, 0)
      totalCost += itemCost

      itemDetails.push({
        supply_type_id: item.supply_type_id,
        supply_type_name: item.supply_type.name,
        quantity_needed: item.quantity,
        cost: itemCost,
        allocations: allocation.allocations
      })
    }

    res.json({
      shipping_config_id: config.shipping_config_id,
      shipping_config_name: config.name,
      total_cost: totalCost,
      items: itemDetails
    })
  } catch (error) {
    console.error('Error calculating supply cost:', error)
    res.status(500).json({ error: 'Failed to calculate supply cost' })
  }
})

// Export the FIFO allocation function for use in seller.js
module.exports = router
module.exports.allocateSuppliesFIFO = allocateSuppliesFIFO
