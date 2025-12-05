/**
 * Admin Seller Routes - Global seller configuration
 *
 * Manages system-wide settings for seller tools:
 * - Product Types (Hobby Box, Retail Blaster, etc.)
 * - Selling Platforms (eBay, COMC, etc.)
 * - Sale Statuses (Listed, Sold, Shipped, etc.)
 *
 * These are NOT user-scoped - they're global settings managed by site admins.
 */

const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { authMiddleware: requireAuth, requireAdmin } = require('../middleware/auth')

// Helper to serialize BigInt values
const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// Helper to generate slug from name
const slugify = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50)
}

// ============================================
// PRODUCT TYPES (Global)
// ============================================

/**
 * GET /api/admin/seller/product-types
 * Get all global product types
 */
router.get('/product-types', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_inactive } = req.query

    const where = { user_id: null } // Global = no user_id
    if (!include_inactive) {
      where.is_active = true
    }

    const productTypes = await prisma.product_type.findMany({
      where,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }]
    })

    res.json({
      product_types: serializeBigInt(productTypes)
    })
  } catch (error) {
    console.error('Error fetching product types:', error)
    res.status(500).json({ error: 'Failed to fetch product types' })
  }
})

/**
 * POST /api/admin/seller/product-types
 * Create a new global product type
 */
router.post('/product-types', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, display_order } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const slug = slugify(name)

    // Check for duplicate slug
    const existing = await prisma.product_type.findFirst({
      where: { user_id: null, slug }
    })
    if (existing) {
      return res.status(400).json({ error: 'A product type with a similar name already exists' })
    }

    const productType = await prisma.product_type.create({
      data: {
        user_id: null, // Global
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        display_order: display_order ?? 0
      }
    })

    console.log(`Admin Seller: Created global product type ${productType.product_type_id}`)

    res.status(201).json({
      message: 'Product type created successfully',
      product_type: serializeBigInt(productType)
    })
  } catch (error) {
    console.error('Error creating product type:', error)
    res.status(500).json({ error: 'Failed to create product type' })
  }
})

/**
 * PUT /api/admin/seller/product-types/reorder
 * Reorder product types by updating display_order values
 * Request body: { items: [{ id: number, display_order: number }, ...] }
 * NOTE: This route MUST come before /product-types/:id to avoid :id matching "reorder"
 */
router.put('/product-types/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' })
    }

    // Update each item's display_order
    await prisma.$transaction(
      items.map(item =>
        prisma.product_type.update({
          where: { product_type_id: item.id },
          data: { display_order: item.display_order }
        })
      )
    )

    console.log(`Admin Seller: Reordered ${items.length} product types`)

    res.json({ message: 'Product types reordered successfully' })
  } catch (error) {
    console.error('Error reordering product types:', error)
    res.status(500).json({ error: 'Failed to reorder product types' })
  }
})

/**
 * PUT /api/admin/seller/product-types/:id
 * Update a global product type
 */
router.put('/product-types/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const productTypeId = parseInt(req.params.id)

    const existing = await prisma.product_type.findFirst({
      where: { product_type_id: productTypeId, user_id: null }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Product type not found' })
    }

    const { name, description, is_active, display_order } = req.body

    const updateData = {}
    if (name !== undefined) {
      updateData.name = name.trim()
      updateData.slug = slugify(name)

      // Check for duplicate slug (excluding self)
      const duplicate = await prisma.product_type.findFirst({
        where: {
          user_id: null,
          slug: updateData.slug,
          product_type_id: { not: productTypeId }
        }
      })
      if (duplicate) {
        return res.status(400).json({ error: 'A product type with a similar name already exists' })
      }
    }
    if (description !== undefined) updateData.description = description?.trim() || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (display_order !== undefined) updateData.display_order = display_order

    const productType = await prisma.product_type.update({
      where: { product_type_id: productTypeId },
      data: updateData
    })

    console.log(`Admin Seller: Updated global product type ${productTypeId}`)

    res.json({
      message: 'Product type updated successfully',
      product_type: serializeBigInt(productType)
    })
  } catch (error) {
    console.error('Error updating product type:', error)
    res.status(500).json({ error: 'Failed to update product type' })
  }
})

/**
 * DELETE /api/admin/seller/product-types/:id
 * Delete a global product type (or deactivate if in use)
 */
router.delete('/product-types/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const productTypeId = parseInt(req.params.id)

    const existing = await prisma.product_type.findFirst({
      where: { product_type_id: productTypeId, user_id: null }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Product type not found' })
    }

    // Check if in use (by product_purchase table using slug match)
    const inUse = await prisma.product_purchase.findFirst({
      where: { product_type: existing.slug }
    })

    if (inUse) {
      // Deactivate instead of delete
      await prisma.product_type.update({
        where: { product_type_id: productTypeId },
        data: { is_active: false }
      })
      console.log(`Admin Seller: Deactivated global product type ${productTypeId} (in use)`)
      return res.json({ message: 'Product type deactivated (in use by purchases)' })
    }

    await prisma.product_type.delete({
      where: { product_type_id: productTypeId }
    })

    console.log(`Admin Seller: Deleted global product type ${productTypeId}`)

    res.json({ message: 'Product type deleted successfully' })
  } catch (error) {
    console.error('Error deleting product type:', error)
    res.status(500).json({ error: 'Failed to delete product type' })
  }
})

// ============================================
// SELLING PLATFORMS (Global)
// ============================================

/**
 * GET /api/admin/seller/platforms
 * Get all global selling platforms
 */
router.get('/platforms', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_inactive } = req.query

    const where = { user_id: null } // Global = no user_id
    if (!include_inactive) {
      where.is_active = true
    }

    const platforms = await prisma.selling_platform.findMany({
      where,
      orderBy: { name: 'asc' }
    })

    res.json({
      platforms: serializeBigInt(platforms)
    })
  } catch (error) {
    console.error('Error fetching platforms:', error)
    res.status(500).json({ error: 'Failed to fetch platforms' })
  }
})

/**
 * POST /api/admin/seller/platforms
 * Create a new global selling platform
 */
router.post('/platforms', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, fee_percentage, payment_fee_pct, fixed_fee } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // Check for duplicate name
    const existing = await prisma.selling_platform.findFirst({
      where: { user_id: null, name: name.trim() }
    })
    if (existing) {
      return res.status(400).json({ error: 'A platform with this name already exists' })
    }

    const platform = await prisma.selling_platform.create({
      data: {
        user_id: null, // Global
        name: name.trim(),
        fee_percentage: fee_percentage ? parseFloat(fee_percentage) : null,
        payment_fee_pct: payment_fee_pct ? parseFloat(payment_fee_pct) : null,
        fixed_fee: fixed_fee ? parseFloat(fixed_fee) : null
      }
    })

    console.log(`Admin Seller: Created global platform ${platform.platform_id}`)

    res.status(201).json({
      message: 'Platform created successfully',
      platform: serializeBigInt(platform)
    })
  } catch (error) {
    console.error('Error creating platform:', error)
    res.status(500).json({ error: 'Failed to create platform' })
  }
})

/**
 * PUT /api/admin/seller/platforms/:id
 * Update a global selling platform
 */
router.put('/platforms/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const platformId = parseInt(req.params.id)

    const existing = await prisma.selling_platform.findFirst({
      where: { platform_id: platformId, user_id: null }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Platform not found' })
    }

    const { name, fee_percentage, payment_fee_pct, fixed_fee, is_active } = req.body

    const updateData = {}
    if (name !== undefined) {
      // Check for duplicate name (excluding self)
      const duplicate = await prisma.selling_platform.findFirst({
        where: {
          user_id: null,
          name: name.trim(),
          platform_id: { not: platformId }
        }
      })
      if (duplicate) {
        return res.status(400).json({ error: 'A platform with this name already exists' })
      }
      updateData.name = name.trim()
    }
    if (fee_percentage !== undefined) updateData.fee_percentage = fee_percentage ? parseFloat(fee_percentage) : null
    if (payment_fee_pct !== undefined) updateData.payment_fee_pct = payment_fee_pct ? parseFloat(payment_fee_pct) : null
    if (fixed_fee !== undefined) updateData.fixed_fee = fixed_fee ? parseFloat(fixed_fee) : null
    if (is_active !== undefined) updateData.is_active = is_active

    const platform = await prisma.selling_platform.update({
      where: { platform_id: platformId },
      data: updateData
    })

    console.log(`Admin Seller: Updated global platform ${platformId}`)

    res.json({
      message: 'Platform updated successfully',
      platform: serializeBigInt(platform)
    })
  } catch (error) {
    console.error('Error updating platform:', error)
    res.status(500).json({ error: 'Failed to update platform' })
  }
})

/**
 * DELETE /api/admin/seller/platforms/:id
 * Delete a global selling platform (or deactivate if in use)
 */
router.delete('/platforms/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const platformId = parseInt(req.params.id)

    const existing = await prisma.selling_platform.findFirst({
      where: { platform_id: platformId, user_id: null }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Platform not found' })
    }

    // Check if in use
    const inUse = await prisma.sale.findFirst({
      where: { platform_id: platformId }
    })

    if (inUse) {
      await prisma.selling_platform.update({
        where: { platform_id: platformId },
        data: { is_active: false }
      })
      console.log(`Admin Seller: Deactivated global platform ${platformId} (in use)`)
      return res.json({ message: 'Platform deactivated (in use by sales)' })
    }

    await prisma.selling_platform.delete({
      where: { platform_id: platformId }
    })

    console.log(`Admin Seller: Deleted global platform ${platformId}`)

    res.json({ message: 'Platform deleted successfully' })
  } catch (error) {
    console.error('Error deleting platform:', error)
    res.status(500).json({ error: 'Failed to delete platform' })
  }
})

// ============================================
// SALE STATUSES (Global)
// Note: Currently sale status is just a string field.
// This endpoint manages a lookup table for UI consistency.
// ============================================

/**
 * GET /api/admin/seller/sale-statuses
 * Get all sale statuses
 */
router.get('/sale-statuses', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_inactive } = req.query

    // Check if sale_status table exists
    const tableExists = await prisma.$queryRaw`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'sale_status'
    `

    if (tableExists.length === 0) {
      // Return default statuses if table doesn't exist
      const defaultStatuses = [
        { sale_status_id: 1, name: 'Listed', slug: 'listed', description: 'Card is listed for sale', color: '#3b82f6', display_order: 0, is_active: true },
        { sale_status_id: 2, name: 'Sold', slug: 'sold', description: 'Card has been sold', color: '#10b981', display_order: 1, is_active: true }
      ]
      return res.json({ sale_statuses: defaultStatuses })
    }

    const where = {}
    if (!include_inactive) {
      where.is_active = true
    }

    const saleStatuses = await prisma.sale_status.findMany({
      where,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }]
    })

    res.json({
      sale_statuses: serializeBigInt(saleStatuses)
    })
  } catch (error) {
    console.error('Error fetching sale statuses:', error)
    // Return defaults on error (table might not exist yet)
    const defaultStatuses = [
      { sale_status_id: 1, name: 'Listed', slug: 'listed', description: 'Card is listed for sale', color: '#3b82f6', display_order: 0, is_active: true },
      { sale_status_id: 2, name: 'Sold', slug: 'sold', description: 'Card has been sold', color: '#10b981', display_order: 1, is_active: true }
    ]
    res.json({ sale_statuses: defaultStatuses })
  }
})

/**
 * POST /api/admin/seller/sale-statuses
 * Create a new sale status
 */
router.post('/sale-statuses', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, color, display_order } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const slug = slugify(name)

    // Check for duplicate slug
    const existing = await prisma.sale_status.findFirst({
      where: { slug }
    })
    if (existing) {
      return res.status(400).json({ error: 'A sale status with a similar name already exists' })
    }

    const saleStatus = await prisma.sale_status.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        color: color || '#6b7280',
        display_order: display_order ?? 0
      }
    })

    console.log(`Admin Seller: Created sale status ${saleStatus.sale_status_id}`)

    res.status(201).json({
      message: 'Sale status created successfully',
      sale_status: serializeBigInt(saleStatus)
    })
  } catch (error) {
    console.error('Error creating sale status:', error)
    // If table doesn't exist, inform user
    if (error.code === 'P2021') {
      return res.status(400).json({ error: 'Sale status table needs to be created. Please run database migrations.' })
    }
    res.status(500).json({ error: 'Failed to create sale status' })
  }
})

/**
 * PUT /api/admin/seller/sale-statuses/reorder
 * Reorder sale statuses by updating display_order values
 * Request body: { items: [{ id: number, display_order: number }, ...] }
 * NOTE: This route MUST come before /sale-statuses/:id to avoid :id matching "reorder"
 */
router.put('/sale-statuses/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' })
    }

    // Update each item's display_order
    await prisma.$transaction(
      items.map(item =>
        prisma.sale_status.update({
          where: { sale_status_id: item.id },
          data: { display_order: item.display_order }
        })
      )
    )

    console.log(`Admin Seller: Reordered ${items.length} sale statuses`)

    res.json({ message: 'Sale statuses reordered successfully' })
  } catch (error) {
    console.error('Error reordering sale statuses:', error)
    res.status(500).json({ error: 'Failed to reorder sale statuses' })
  }
})

/**
 * PUT /api/admin/seller/sale-statuses/:id
 * Update a sale status
 */
router.put('/sale-statuses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const saleStatusId = parseInt(req.params.id)

    const existing = await prisma.sale_status.findUnique({
      where: { sale_status_id: saleStatusId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Sale status not found' })
    }

    const { name, description, color, is_active, display_order } = req.body

    const updateData = {}
    if (name !== undefined) {
      updateData.name = name.trim()
      updateData.slug = slugify(name)

      // Check for duplicate slug (excluding self)
      const duplicate = await prisma.sale_status.findFirst({
        where: {
          slug: updateData.slug,
          sale_status_id: { not: saleStatusId }
        }
      })
      if (duplicate) {
        return res.status(400).json({ error: 'A sale status with a similar name already exists' })
      }
    }
    if (description !== undefined) updateData.description = description?.trim() || null
    if (color !== undefined) updateData.color = color
    if (is_active !== undefined) updateData.is_active = is_active
    if (display_order !== undefined) updateData.display_order = display_order

    const saleStatus = await prisma.sale_status.update({
      where: { sale_status_id: saleStatusId },
      data: updateData
    })

    console.log(`Admin Seller: Updated sale status ${saleStatusId}`)

    res.json({
      message: 'Sale status updated successfully',
      sale_status: serializeBigInt(saleStatus)
    })
  } catch (error) {
    console.error('Error updating sale status:', error)
    res.status(500).json({ error: 'Failed to update sale status' })
  }
})

/**
 * DELETE /api/admin/seller/sale-statuses/:id
 * Delete a sale status (or deactivate if in use)
 */
router.delete('/sale-statuses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const saleStatusId = parseInt(req.params.id)

    const existing = await prisma.sale_status.findUnique({
      where: { sale_status_id: saleStatusId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Sale status not found' })
    }

    // Check if in use (match by slug since sale.status is a string)
    const inUse = await prisma.sale.findFirst({
      where: { status: existing.slug }
    })

    if (inUse) {
      await prisma.sale_status.update({
        where: { sale_status_id: saleStatusId },
        data: { is_active: false }
      })
      console.log(`Admin Seller: Deactivated sale status ${saleStatusId} (in use)`)
      return res.json({ message: 'Sale status deactivated (in use by sales)' })
    }

    await prisma.sale_status.delete({
      where: { sale_status_id: saleStatusId }
    })

    console.log(`Admin Seller: Deleted sale status ${saleStatusId}`)

    res.json({ message: 'Sale status deleted successfully' })
  } catch (error) {
    console.error('Error deleting sale status:', error)
    res.status(500).json({ error: 'Failed to delete sale status' })
  }
})

// ============================================
// SEED DEFAULTS
// ============================================

/**
 * POST /api/admin/seller/seed-defaults
 * Seed default global values for product types, platforms, and sale statuses
 */
router.post('/seed-defaults', requireAuth, requireAdmin, async (req, res) => {
  try {
    const results = {
      product_types: 0,
      platforms: 0,
      sale_statuses: 0
    }

    // Seed default product types
    const existingProductTypes = await prisma.product_type.findFirst({
      where: { user_id: null }
    })

    if (!existingProductTypes) {
      const defaultProductTypes = [
        { name: 'Hobby Box', slug: 'hobby_box', display_order: 0 },
        { name: 'Hobby Case', slug: 'hobby_case', display_order: 1 },
        { name: 'Retail Blaster', slug: 'retail_blaster', display_order: 2 },
        { name: 'Retail Hanger', slug: 'retail_hanger', display_order: 3 },
        { name: 'Retail Mega', slug: 'retail_mega', display_order: 4 },
        { name: 'Retail Cello', slug: 'retail_cello', display_order: 5 },
        { name: 'Other', slug: 'other', display_order: 99 }
      ]

      await prisma.product_type.createMany({
        data: defaultProductTypes.map(pt => ({ ...pt, user_id: null }))
      })
      results.product_types = defaultProductTypes.length
      console.log(`Admin Seller: Seeded ${defaultProductTypes.length} default product types`)
    }

    // Seed default platforms
    const existingPlatforms = await prisma.selling_platform.findFirst({
      where: { user_id: null }
    })

    if (!existingPlatforms) {
      const defaultPlatforms = [
        { name: 'eBay', fee_percentage: 13.25, payment_fee_pct: 0, fixed_fee: 0.30 },
        { name: 'COMC', fee_percentage: 5.0, payment_fee_pct: 0, fixed_fee: 0 },
        { name: 'Facebook Marketplace', fee_percentage: 0, payment_fee_pct: 0, fixed_fee: 0 },
        { name: 'MySlabs', fee_percentage: 9.0, payment_fee_pct: 2.9, fixed_fee: 0.30 },
        { name: 'Card Show', fee_percentage: 0, payment_fee_pct: 0, fixed_fee: 0 },
        { name: 'Other', fee_percentage: 0, payment_fee_pct: 0, fixed_fee: 0 }
      ]

      await prisma.selling_platform.createMany({
        data: defaultPlatforms.map(p => ({ ...p, user_id: null }))
      })
      results.platforms = defaultPlatforms.length
      console.log(`Admin Seller: Seeded ${defaultPlatforms.length} default platforms`)
    }

    // Seed default sale statuses (if table exists)
    try {
      const existingSaleStatuses = await prisma.sale_status.findFirst()

      if (!existingSaleStatuses) {
        const defaultSaleStatuses = [
          { name: 'Listed', slug: 'listed', description: 'Card is listed for sale', color: '#3b82f6', display_order: 0 },
          { name: 'Sold', slug: 'sold', description: 'Card has been sold', color: '#10b981', display_order: 1 },
          { name: 'Shipped', slug: 'shipped', description: 'Card has been shipped', color: '#8b5cf6', display_order: 2 },
          { name: 'Delivered', slug: 'delivered', description: 'Card has been delivered', color: '#06b6d4', display_order: 3 },
          { name: 'Cancelled', slug: 'cancelled', description: 'Sale was cancelled', color: '#ef4444', display_order: 4 },
          { name: 'Returned', slug: 'returned', description: 'Card was returned', color: '#f97316', display_order: 5 }
        ]

        await prisma.sale_status.createMany({
          data: defaultSaleStatuses
        })
        results.sale_statuses = defaultSaleStatuses.length
        console.log(`Admin Seller: Seeded ${defaultSaleStatuses.length} default sale statuses`)
      }
    } catch (e) {
      // Sale status table might not exist yet - that's OK
      console.log('Sale status table not available yet')
    }

    if (results.product_types === 0 && results.platforms === 0 && results.sale_statuses === 0) {
      return res.status(400).json({ error: 'Default values already exist' })
    }

    res.status(201).json({
      message: 'Default values created successfully',
      seeded: results
    })
  } catch (error) {
    console.error('Error seeding defaults:', error)
    res.status(500).json({ error: 'Failed to seed defaults' })
  }
})

module.exports = router
