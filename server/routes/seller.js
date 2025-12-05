/**
 * Seller Tools API Routes
 *
 * Sales tracking and management for card collectors.
 * Access controlled by seller_role field on user.
 * Admins always have access; regular users need seller_role set.
 */

const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { authMiddleware: requireAuth, requireSeller } = require('../middleware/auth')

// Helper to serialize BigInt values
const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// Helper to calculate profit fields
// Profit = Sale $ + Ship $ - Purchase Price - Fees - Ship Cost - Supplies + Adjustment
const calculateProfitFields = (sale) => {
  const purchasePrice = parseFloat(sale.purchase_price) || 0
  const salePrice = parseFloat(sale.sale_price) || 0
  const shippingCharged = parseFloat(sale.shipping_charged) || 0
  const shippingCost = parseFloat(sale.shipping_cost) || 0
  const platformFees = parseFloat(sale.platform_fees) || 0
  const otherFees = parseFloat(sale.other_fees) || 0
  const supplyCost = parseFloat(sale.supply_cost) || 0
  const adjustment = parseFloat(sale.adjustment) || 0 // negative = cost, positive = profit

  const totalRevenue = salePrice + shippingCharged
  const totalCosts = purchasePrice + shippingCost + platformFees + otherFees + supplyCost
  const netProfit = totalRevenue - totalCosts + adjustment

  return {
    total_revenue: totalRevenue,
    total_costs: totalCosts,
    net_profit: netProfit
  }
}

// Helper to calculate supply cost from shipping config
const calculateSupplyCostFromConfig = async (prisma, userId, shippingConfigId) => {
  if (!shippingConfigId) return 0

  const config = await prisma.shipping_config.findFirst({
    where: {
      shipping_config_id: shippingConfigId,
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

  if (!config) return 0

  let totalCost = 0

  for (const item of config.shipping_config_items) {
    // Get the oldest non-depleted batch for FIFO costing
    const batch = await prisma.supply_batch.findFirst({
      where: {
        user_id: userId,
        supply_type_id: item.supply_type_id,
        is_depleted: false,
        quantity_remaining: { gt: 0 }
      },
      orderBy: { purchase_date: 'asc' }
    })

    if (batch) {
      totalCost += item.quantity * parseFloat(batch.cost_per_unit)
    }
  }

  return totalCost
}

/**
 * GET /api/seller/platforms
 * Get all selling platforms (system defaults + user-specific)
 */
router.get('/platforms', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const platforms = await prisma.selling_platform.findMany({
      where: {
        OR: [
          { user_id: null }, // System defaults
          { user_id: userId } // User-specific
        ],
        is_active: true
      },
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
 * GET /api/seller/sales
 * Get all sales for the current user
 */
router.get('/sales', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { status, limit = 50, offset = 0 } = req.query

    const where = { user_id: userId }
    if (status) {
      where.status = status
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          card: {
            include: {
              color_card_colorTocolor: true,
              card_player_team_card_player_team_cardTocard: {
                include: {
                  player_team_card_player_team_player_teamToplayer_team: {
                    include: {
                      player_player_team_playerToplayer: true,
                      team_player_team_teamToteam: true
                    }
                  }
                }
              }
            }
          },
          platform: true,
          order: {
            include: {
              shipping_config: true,
              order_supplies: {
                include: {
                  supply_batch: {
                    include: { supply_type: true }
                  }
                }
              }
            }
          },
          shipping_config: true
        },
        orderBy: { created: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.sale.count({ where })
    ])

    // Get unique series IDs from the sales and fetch series/set data
    const seriesIds = [...new Set(sales.map(s => s.card?.series).filter(Boolean))]
    const seriesData = seriesIds.length > 0 ? await prisma.series.findMany({
      where: { series_id: { in: seriesIds } },
      include: { set_series_setToset: true }
    }) : []
    const seriesMap = new Map(seriesData.map(s => [Number(s.series_id), s]))

    // Format the response with card details
    const formattedSales = sales.map(sale => {
      const card = sale.card
      const playerTeams = card?.card_player_team_card_player_team_cardTocard || []
      const series = card?.series ? seriesMap.get(Number(card.series)) : null
      const set = series?.set_series_setToset
      const colorData = card?.color_card_colorTocolor

      // Get player names and teams
      const playerData = playerTeams.map(cpt => {
        const pt = cpt.player_team_card_player_team_player_teamToplayer_team
        const player = pt?.player_player_team_playerToplayer
        const team = pt?.team_player_team_teamToteam
        return {
          name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : null,
          team_name: team?.name || null,
          team_abbreviation: team?.abbreviation || null,
          primary_color: team?.primary_color || null,
          secondary_color: team?.secondary_color || null
        }
      }).filter(p => p.name)

      return {
        ...serializeBigInt(sale),
        card_info: card ? {
          card_id: Number(card.card_id),
          card_number: card.card_number,
          players: playerData.map(p => p.name).join(', '),
          player_data: playerData,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          is_short_print: card.is_short_print,
          print_run: card.print_run,
          color: colorData?.name || null,
          color_hex: colorData?.hex_value || null,
          series_name: series?.name || null,
          set_name: set?.name || null
        } : null
      }
    })

    res.json({
      sales: formattedSales,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    res.status(500).json({ error: 'Failed to fetch sales' })
  }
})

/**
 * GET /api/seller/sales/:id
 * Get a single sale by ID
 */
router.get('/sales/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const saleId = BigInt(req.params.id)

    const sale = await prisma.sale.findFirst({
      where: {
        sale_id: saleId,
        user_id: userId
      },
      include: {
        card: {
          include: {
            card_player_team_card_player_team_cardTocard: {
              include: {
                player_team_card_player_team_player_teamToplayer_team: {
                  include: {
                    player_player_team_playerToplayer: true,
                    team_player_team_teamToteam: true
                  }
                }
              }
            }
          }
        },
        platform: true,
        order: {
          include: {
            shipping_config: true,
            order_supplies: {
              include: {
                supply_batch: {
                  include: {
                    supply_type: true
                  }
                }
              }
            }
          }
        },
        sale_supply_usage: {
          include: {
            supply_batch: {
              include: {
                supply_type: true
              }
            }
          }
        }
      }
    })

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' })
    }

    res.json({ sale: serializeBigInt(sale) })
  } catch (error) {
    console.error('Error fetching sale:', error)
    res.status(500).json({ error: 'Failed to fetch sale' })
  }
})

/**
 * POST /api/seller/sales
 * Create a new sale
 */
router.post('/sales', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const {
      card_id,
      platform_id,
      order_id,
      shipping_config_id,
      status = 'listed',
      sale_date,
      purchase_price,
      sale_price,
      shipping_charged,
      shipping_cost,
      platform_fees,
      other_fees,
      supply_cost,
      buyer_username,
      tracking_number,
      notes
    } = req.body

    if (!card_id) {
      return res.status(400).json({ error: 'card_id is required' })
    }

    // Calculate profit fields
    const profitFields = calculateProfitFields({
      purchase_price,
      sale_price,
      shipping_charged,
      shipping_cost,
      platform_fees,
      other_fees,
      supply_cost
    })

    const sale = await prisma.sale.create({
      data: {
        user_id: userId,
        card_id: BigInt(card_id),
        platform_id: platform_id ? parseInt(platform_id) : null,
        order_id: order_id ? BigInt(order_id) : null,
        shipping_config_id: shipping_config_id ? parseInt(shipping_config_id) : null,
        status,
        sale_date: sale_date ? new Date(sale_date) : null,
        purchase_price: purchase_price ? parseFloat(purchase_price) : null,
        sale_price: sale_price ? parseFloat(sale_price) : null,
        shipping_charged: shipping_charged ? parseFloat(shipping_charged) : null,
        shipping_cost: shipping_cost ? parseFloat(shipping_cost) : null,
        platform_fees: platform_fees ? parseFloat(platform_fees) : null,
        other_fees: other_fees ? parseFloat(other_fees) : null,
        supply_cost: supply_cost ? parseFloat(supply_cost) : null,
        total_revenue: profitFields.total_revenue,
        total_costs: profitFields.total_costs,
        net_profit: profitFields.net_profit,
        buyer_username,
        tracking_number,
        notes
      },
      include: {
        card: true,
        platform: true,
        order: true,
        shipping_config: true
      }
    })

    console.log(`Seller: Created sale ${sale.sale_id} for card ${card_id}`)

    res.status(201).json({
      message: 'Sale created successfully',
      sale: serializeBigInt(sale)
    })
  } catch (error) {
    console.error('Error creating sale:', error)
    res.status(500).json({ error: 'Failed to create sale' })
  }
})

/**
 * POST /api/seller/sell-from-collection
 * Sell a card from user's collection - creates sale and archives the user_card (sets sold_at)
 */
router.post('/sell-from-collection', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { user_card_id } = req.body

    if (!user_card_id) {
      return res.status(400).json({ error: 'user_card_id is required' })
    }

    // Find the user_card to get card_id and purchase_price
    const userCard = await prisma.user_card.findFirst({
      where: {
        user_card_id: BigInt(user_card_id),
        user: userId,
        sold_at: null // Must not already be sold
      }
    })

    if (!userCard) {
      return res.status(404).json({ error: 'Card not found in your collection or already sold' })
    }

    // Calculate profit fields with purchase_price from collection
    const purchasePrice = userCard.purchase_price ? parseFloat(userCard.purchase_price) : 0
    const profitFields = calculateProfitFields({
      purchase_price: purchasePrice,
      sale_price: 0,
      shipping_charged: 0,
      shipping_cost: 0,
      platform_fees: 0,
      other_fees: 0,
      supply_cost: 0
    })

    // Create the sale with purchase_price from user_card and link to user_card_id
    const sale = await prisma.sale.create({
      data: {
        user_id: userId,
        card_id: userCard.card,
        user_card_id: BigInt(user_card_id),
        status: 'listed',
        sale_date: new Date(),
        purchase_price: purchasePrice || null,
        total_revenue: profitFields.total_revenue,
        total_costs: profitFields.total_costs,
        net_profit: profitFields.net_profit
      },
      include: {
        card: true,
        platform: true
      }
    })

    // Archive the user_card instead of deleting - set sold_at and link to sale
    await prisma.user_card.update({
      where: { user_card_id: BigInt(user_card_id) },
      data: {
        sold_at: new Date(),
        sale_id: sale.sale_id
      }
    })

    console.log(`Seller: Created sale ${sale.sale_id} from collection card ${user_card_id} (archived, not deleted)`)

    res.status(201).json({
      message: 'Card listed for sale and archived from collection',
      sale: serializeBigInt(sale)
    })
  } catch (error) {
    console.error('Error selling from collection:', error)
    res.status(500).json({ error: 'Failed to sell card from collection' })
  }
})

/**
 * PUT /api/seller/sales/:id
 * Update a sale
 */
router.put('/sales/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const saleId = BigInt(req.params.id)

    // Verify ownership
    const existingSale = await prisma.sale.findFirst({
      where: {
        sale_id: saleId,
        user_id: userId
      }
    })

    if (!existingSale) {
      return res.status(404).json({ error: 'Sale not found' })
    }

    const {
      platform_id,
      order_id,
      shipping_config_id,
      status,
      sale_date,
      purchase_price,
      sale_price,
      shipping_charged,
      shipping_cost,
      platform_fees,
      other_fees,
      adjustment,
      buyer_username,
      tracking_number,
      notes
    } = req.body

    // If shipping_config_id changed, auto-calculate supply cost from config
    let newSupplyCost = existingSale.supply_cost
    const newConfigId = shipping_config_id !== undefined ? shipping_config_id : existingSale.shipping_config_id
    if (shipping_config_id !== undefined) {
      if (shipping_config_id) {
        newSupplyCost = await calculateSupplyCostFromConfig(prisma, userId, parseInt(shipping_config_id))
      } else {
        newSupplyCost = 0 // Config cleared
      }
    }

    // Calculate profit fields
    const profitFields = calculateProfitFields({
      purchase_price: purchase_price ?? existingSale.purchase_price,
      sale_price: sale_price ?? existingSale.sale_price,
      shipping_charged: shipping_charged ?? existingSale.shipping_charged,
      shipping_cost: shipping_cost ?? existingSale.shipping_cost,
      platform_fees: platform_fees ?? existingSale.platform_fees,
      other_fees: other_fees ?? existingSale.other_fees,
      supply_cost: newSupplyCost,
      adjustment: adjustment ?? existingSale.adjustment
    })

    const sale = await prisma.sale.update({
      where: { sale_id: saleId },
      data: {
        platform_id: platform_id !== undefined ? (platform_id ? parseInt(platform_id) : null) : undefined,
        order_id: order_id !== undefined ? (order_id ? BigInt(order_id) : null) : undefined,
        shipping_config_id: shipping_config_id !== undefined ? (shipping_config_id ? parseInt(shipping_config_id) : null) : undefined,
        status: status ?? undefined,
        sale_date: sale_date !== undefined ? (sale_date ? new Date(sale_date) : null) : undefined,
        purchase_price: purchase_price !== undefined ? parseFloat(purchase_price) : undefined,
        sale_price: sale_price !== undefined ? parseFloat(sale_price) : undefined,
        shipping_charged: shipping_charged !== undefined ? parseFloat(shipping_charged) : undefined,
        shipping_cost: shipping_cost !== undefined ? parseFloat(shipping_cost) : undefined,
        platform_fees: platform_fees !== undefined ? parseFloat(platform_fees) : undefined,
        other_fees: other_fees !== undefined ? parseFloat(other_fees) : undefined,
        supply_cost: newSupplyCost,
        adjustment: adjustment !== undefined ? parseFloat(adjustment) : undefined,
        total_revenue: profitFields.total_revenue,
        total_costs: profitFields.total_costs,
        net_profit: profitFields.net_profit,
        buyer_username: buyer_username ?? undefined,
        tracking_number: tracking_number ?? undefined,
        notes: notes ?? undefined,
        updated: new Date()
      },
      include: {
        card: true,
        platform: true,
        order: true,
        shipping_config: true
      }
    })

    console.log(`Seller: Updated sale ${saleId}`)

    res.json({
      message: 'Sale updated successfully',
      sale: serializeBigInt(sale)
    })
  } catch (error) {
    console.error('Error updating sale:', error)
    res.status(500).json({ error: 'Failed to update sale' })
  }
})

/**
 * DELETE /api/seller/sales/:id
 * Delete a sale and restore linked user_card if exists
 */
router.delete('/sales/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const saleId = BigInt(req.params.id)

    // Verify ownership
    const existingSale = await prisma.sale.findFirst({
      where: {
        sale_id: saleId,
        user_id: userId
      }
    })

    if (!existingSale) {
      return res.status(404).json({ error: 'Sale not found' })
    }

    // Check if this sale has a linked user_card (was sold from collection)
    let restoredCard = false
    if (existingSale.user_card_id) {
      // Restore the user_card by clearing sold_at and sale_id
      await prisma.user_card.update({
        where: { user_card_id: existingSale.user_card_id },
        data: {
          sold_at: null,
          sale_id: null
        }
      })
      restoredCard = true
      console.log(`Seller: Restored user_card ${existingSale.user_card_id} to collection`)
    }

    await prisma.sale.delete({
      where: { sale_id: saleId }
    })

    console.log(`Seller: Deleted sale ${saleId}`)

    res.json({
      message: restoredCard
        ? 'Sale deleted and card restored to collection'
        : 'Sale deleted successfully',
      restored_to_collection: restoredCard
    })
  } catch (error) {
    console.error('Error deleting sale:', error)
    res.status(500).json({ error: 'Failed to delete sale' })
  }
})

// ============================================
// ORDER MANAGEMENT ENDPOINTS
// Orders group multiple sales for combined shipping
// ============================================

/**
 * GET /api/seller/orders
 * Get all orders for the current user
 */
router.get('/orders', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { status, limit = 50, offset = 0 } = req.query

    const where = { user_id: userId }
    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.sale_order.findMany({
        where,
        include: {
          platform: true,
          sales: {
            include: {
              card: {
                include: {
                  card_player_team_card_player_team_cardTocard: {
                    include: {
                      player_team_card_player_team_player_teamToplayer_team: {
                        include: {
                          player_player_team_playerToplayer: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          order_supplies: {
            include: {
              supply_batch: {
                include: {
                  supply_type: true
                }
              }
            }
          }
        },
        orderBy: { created: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.sale_order.count({ where })
    ])

    res.json({
      orders: serializeBigInt(orders),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

/**
 * GET /api/seller/orders/:id
 * Get a single order by ID
 */
router.get('/orders/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)

    const order = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      },
      include: {
        platform: true,
        sales: {
          include: {
            card: {
              include: {
                card_player_team_card_player_team_cardTocard: {
                  include: {
                    player_team_card_player_team_player_teamToplayer_team: {
                      include: {
                        player_player_team_playerToplayer: true,
                        team_player_team_teamToteam: true
                      }
                    }
                  }
                }
              }
            },
            platform: true
          }
        },
        order_supplies: {
          include: {
            supply_batch: {
              include: {
                supply_type: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    res.json({ order: serializeBigInt(order) })
  } catch (error) {
    console.error('Error fetching order:', error)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

/**
 * POST /api/seller/orders
 * Create a new order (optionally with sales)
 */
router.post('/orders', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const {
      platform_id,
      order_reference,
      buyer_username,
      status = 'pending',
      ship_date,
      shipping_charged,
      shipping_cost,
      tracking_number,
      notes,
      sale_ids // Optional: array of sale IDs to add to this order
    } = req.body

    const order = await prisma.sale_order.create({
      data: {
        user_id: userId,
        platform_id: platform_id ? parseInt(platform_id) : null,
        order_reference,
        buyer_username,
        status,
        ship_date: ship_date ? new Date(ship_date) : null,
        shipping_charged: shipping_charged ? parseFloat(shipping_charged) : null,
        shipping_cost: shipping_cost ? parseFloat(shipping_cost) : null,
        tracking_number,
        notes
      }
    })

    // If sale_ids provided, link them to this order and reset order-level values
    if (sale_ids && sale_ids.length > 0) {
      // Get the sales to recalculate their profit fields
      const salesToLink = await prisma.sale.findMany({
        where: {
          sale_id: { in: sale_ids.map(id => BigInt(id)) },
          user_id: userId
        }
      })

      // Reset order-level values on each sale and link to order
      for (const sale of salesToLink) {
        const profitFields = calculateProfitFields({
          purchase_price: sale.purchase_price,
          sale_price: sale.sale_price,
          shipping_charged: 0,
          shipping_cost: 0,
          platform_fees: 0,
          other_fees: sale.other_fees,
          supply_cost: 0,
          adjustment: sale.adjustment
        })

        await prisma.sale.update({
          where: { sale_id: sale.sale_id },
          data: {
            order_id: order.order_id,
            shipping_charged: 0,
            shipping_cost: 0,
            platform_fees: 0,
            supply_cost: 0,
            total_revenue: profitFields.total_revenue,
            total_costs: profitFields.total_costs,
            net_profit: profitFields.net_profit,
            updated: new Date()
          }
        })
      }
    }

    // Fetch the complete order with relations
    const completeOrder = await prisma.sale_order.findUnique({
      where: { order_id: order.order_id },
      include: {
        platform: true,
        sales: true,
        order_supplies: true
      }
    })

    console.log(`Seller: Created order ${order.order_id}`)

    res.status(201).json({
      message: 'Order created successfully',
      order: serializeBigInt(completeOrder)
    })
  } catch (error) {
    console.error('Error creating order:', error)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

/**
 * PUT /api/seller/orders/:id
 * Update an order
 */
router.put('/orders/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)

    // Verify ownership
    const existingOrder = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      }
    })

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const {
      platform_id,
      shipping_config_id,
      order_reference,
      buyer_username,
      status,
      ship_date,
      shipping_charged,
      shipping_cost,
      tracking_number,
      notes
    } = req.body

    const order = await prisma.sale_order.update({
      where: { order_id: orderId },
      data: {
        platform_id: platform_id !== undefined ? (platform_id ? parseInt(platform_id) : null) : undefined,
        shipping_config_id: shipping_config_id !== undefined ? (shipping_config_id ? parseInt(shipping_config_id) : null) : undefined,
        order_reference: order_reference ?? undefined,
        buyer_username: buyer_username ?? undefined,
        status: status ?? undefined,
        ship_date: ship_date !== undefined ? (ship_date ? new Date(ship_date) : null) : undefined,
        shipping_charged: shipping_charged !== undefined ? (shipping_charged ? parseFloat(shipping_charged) : null) : undefined,
        shipping_cost: shipping_cost !== undefined ? (shipping_cost ? parseFloat(shipping_cost) : null) : undefined,
        tracking_number: tracking_number ?? undefined,
        notes: notes ?? undefined,
        updated: new Date()
      },
      include: {
        platform: true,
        shipping_config: true,
        sales: true,
        order_supplies: {
          include: {
            supply_batch: true
          }
        }
      }
    })

    // If shipping_config_id changed, recalculate and distribute total supply cost to sales
    if (shipping_config_id !== undefined && order.sales.length > 0) {
      // Calculate config cost
      const configCost = shipping_config_id
        ? await calculateSupplyCostFromConfig(prisma, userId, parseInt(shipping_config_id))
        : 0

      // Calculate extra supplies cost from order_supplies
      const extraSuppliesCost = order.order_supplies.reduce(
        (sum, s) => sum + parseFloat(s.total_cost || 0), 0
      )

      const totalSupplyCost = configCost + extraSuppliesCost
      const costPerSale = totalSupplyCost / order.sales.length

      // Update each sale with their share of supply cost
      for (const sale of order.sales) {
        const profitFields = calculateProfitFields({
          purchase_price: sale.purchase_price,
          sale_price: sale.sale_price,
          shipping_charged: sale.shipping_charged,
          shipping_cost: sale.shipping_cost,
          platform_fees: sale.platform_fees,
          other_fees: sale.other_fees,
          supply_cost: costPerSale,
          adjustment: sale.adjustment
        })

        await prisma.sale.update({
          where: { sale_id: sale.sale_id },
          data: {
            supply_cost: costPerSale,
            total_revenue: profitFields.total_revenue,
            total_costs: profitFields.total_costs,
            net_profit: profitFields.net_profit,
            updated: new Date()
          }
        })
      }

      console.log(`Seller: Updated order ${orderId}, distributed supply cost $${totalSupplyCost.toFixed(2)} across ${order.sales.length} sales`)
    } else {
      console.log(`Seller: Updated order ${orderId}`)
    }

    // Re-fetch with updated sales
    const updatedOrder = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      include: {
        platform: true,
        shipping_config: true,
        sales: true,
        order_supplies: true
      }
    })

    res.json({
      message: 'Order updated successfully',
      order: serializeBigInt(updatedOrder)
    })
  } catch (error) {
    console.error('Error updating order:', error)
    res.status(500).json({ error: 'Failed to update order' })
  }
})

/**
 * DELETE /api/seller/orders/:id
 * Delete an order (unlinks sales, removes supply allocations)
 */
router.delete('/orders/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)

    // Verify ownership
    const existingOrder = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      },
      include: {
        sales: true,
        order_supplies: true
      }
    })

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' })
    }

    await prisma.$transaction(async (tx) => {
      // Reset order-level values on all sales and unlink from order
      for (const sale of existingOrder.sales) {
        // Recalculate profit with zeroed order-level costs
        const profitFields = calculateProfitFields({
          purchase_price: sale.purchase_price,
          sale_price: sale.sale_price,
          shipping_charged: 0,
          shipping_cost: 0,
          platform_fees: 0,
          other_fees: sale.other_fees,
          supply_cost: 0,
          adjustment: sale.adjustment
        })

        await tx.sale.update({
          where: { sale_id: sale.sale_id },
          data: {
            order_id: null,
            shipping_charged: 0,
            shipping_cost: 0,
            platform_fees: 0,
            supply_cost: 0,
            total_revenue: profitFields.total_revenue,
            total_costs: profitFields.total_costs,
            net_profit: profitFields.net_profit,
            updated: new Date()
          }
        })
      }

      // Return supplies to inventory (if allocated)
      for (const supply of existingOrder.order_supplies) {
        await tx.supply_batch.update({
          where: { supply_batch_id: supply.supply_batch_id },
          data: {
            quantity_remaining: { increment: supply.quantity_used },
            is_depleted: false,
            updated: new Date()
          }
        })
      }

      // Delete order (cascades to order_supply_usage)
      await tx.sale_order.delete({
        where: { order_id: orderId }
      })
    })

    console.log(`Seller: Deleted order ${orderId}`)

    res.json({ message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Error deleting order:', error)
    res.status(500).json({ error: 'Failed to delete order' })
  }
})

/**
 * POST /api/seller/orders/:id/add-sales
 * Add sales to an existing order
 */
router.post('/orders/:id/add-sales', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)
    const { sale_ids } = req.body

    if (!sale_ids || sale_ids.length === 0) {
      return res.status(400).json({ error: 'sale_ids is required' })
    }

    // Verify ownership of order
    const order = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Update sales to link to this order
    const result = await prisma.sale.updateMany({
      where: {
        sale_id: { in: sale_ids.map(id => BigInt(id)) },
        user_id: userId
      },
      data: {
        order_id: orderId,
        updated: new Date()
      }
    })

    console.log(`Seller: Added ${result.count} sales to order ${orderId}`)

    // Return updated order
    const updatedOrder = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      include: {
        platform: true,
        sales: true
      }
    })

    res.json({
      message: `Added ${result.count} sales to order`,
      order: serializeBigInt(updatedOrder)
    })
  } catch (error) {
    console.error('Error adding sales to order:', error)
    res.status(500).json({ error: 'Failed to add sales to order' })
  }
})

/**
 * POST /api/seller/orders/:id/remove-sales
 * Remove sales from an order (unlink them)
 */
router.post('/orders/:id/remove-sales', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)
    const { sale_ids } = req.body

    if (!sale_ids || sale_ids.length === 0) {
      return res.status(400).json({ error: 'sale_ids is required' })
    }

    // Verify ownership of order
    const order = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Unlink sales from this order
    const result = await prisma.sale.updateMany({
      where: {
        sale_id: { in: sale_ids.map(id => BigInt(id)) },
        user_id: userId,
        order_id: orderId
      },
      data: {
        order_id: null,
        updated: new Date()
      }
    })

    console.log(`Seller: Removed ${result.count} sales from order ${orderId}`)

    // Return updated order
    const updatedOrder = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      include: {
        platform: true,
        sales: true
      }
    })

    res.json({
      message: `Removed ${result.count} sales from order`,
      order: serializeBigInt(updatedOrder)
    })
  } catch (error) {
    console.error('Error removing sales from order:', error)
    res.status(500).json({ error: 'Failed to remove sales from order' })
  }
})

/**
 * POST /api/seller/orders/:id/allocate-supplies
 * Allocate supplies to an order using FIFO
 * Request body: { supplies: [{ supply_type_id: number, quantity: number }, ...] }
 */
router.post('/orders/:id/allocate-supplies', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)
    const { supplies } = req.body

    if (!supplies || supplies.length === 0) {
      return res.status(400).json({ error: 'supplies array is required' })
    }

    // Get the order
    const order = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      },
      include: {
        order_supplies: true,
        sales: true
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Check if supplies have already been allocated
    if (order.order_supplies.length > 0) {
      return res.status(400).json({ error: 'Supplies have already been allocated for this order. Delete existing allocations first.' })
    }

    // Get supply type names for error messages
    const supplyTypeIds = supplies.map(s => s.supply_type_id)
    const supplyTypes = await prisma.supply_type.findMany({
      where: { supply_type_id: { in: supplyTypeIds } }
    })
    const supplyTypeMap = new Map(supplyTypes.map(st => [st.supply_type_id, st.name]))

    // Allocate supplies using FIFO for each requested supply
    const allocations = []
    let totalSupplyCost = 0

    for (const item of supplies) {
      // Get available batches for this supply type (FIFO order)
      const batches = await prisma.supply_batch.findMany({
        where: {
          user_id: userId,
          supply_type_id: item.supply_type_id,
          is_depleted: false,
          quantity_remaining: { gt: 0 }
        },
        orderBy: { purchase_date: 'asc' } // FIFO: oldest first
      })

      let remaining = item.quantity

      for (const batch of batches) {
        if (remaining <= 0) break

        const toAllocate = Math.min(remaining, batch.quantity_remaining)
        const costPerUnit = parseFloat(batch.cost_per_unit)
        const itemCost = toAllocate * costPerUnit

        allocations.push({
          order_id: orderId,
          supply_batch_id: batch.supply_batch_id,
          quantity_used: toAllocate,
          cost_per_unit: costPerUnit,
          total_cost: itemCost
        })

        totalSupplyCost += itemCost
        remaining -= toAllocate
      }

      if (remaining > 0) {
        const typeName = supplyTypeMap.get(item.supply_type_id) || `ID ${item.supply_type_id}`
        return res.status(400).json({
          error: `Insufficient inventory for ${typeName}. Need ${item.quantity}, can allocate ${item.quantity - remaining}`
        })
      }
    }

    // Use transaction to create allocations and update batch quantities
    await prisma.$transaction(async (tx) => {
      // Create allocation records
      for (const alloc of allocations) {
        await tx.order_supply_usage.create({
          data: alloc
        })

        // Update batch quantity
        const batch = await tx.supply_batch.findUnique({
          where: { supply_batch_id: alloc.supply_batch_id }
        })

        const newRemaining = batch.quantity_remaining - alloc.quantity_used
        await tx.supply_batch.update({
          where: { supply_batch_id: alloc.supply_batch_id },
          data: {
            quantity_remaining: newRemaining,
            is_depleted: newRemaining <= 0,
            updated: new Date()
          }
        })
      }
    })

    console.log(`Seller: Allocated extra supplies for order ${orderId}, extra cost: $${totalSupplyCost.toFixed(2)}`)

    // Get config cost to include in total
    const updatedOrderWithConfig = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      select: { shipping_config_id: true }
    })
    const configCost = updatedOrderWithConfig?.shipping_config_id
      ? await calculateSupplyCostFromConfig(prisma, userId, updatedOrderWithConfig.shipping_config_id)
      : 0

    // Total supply cost = config cost + extra supplies cost
    const combinedSupplyCost = configCost + totalSupplyCost
    console.log(`Seller: Total supply cost for order ${orderId}: $${combinedSupplyCost.toFixed(2)} (config: $${configCost.toFixed(2)} + extra: $${totalSupplyCost.toFixed(2)})`)

    // Distribute combined supply cost across sales in the order
    if (order.sales.length > 0) {
      const costPerSale = combinedSupplyCost / order.sales.length
      for (const sale of order.sales) {
        const profitFields = calculateProfitFields({
          purchase_price: sale.purchase_price,
          sale_price: sale.sale_price,
          shipping_charged: sale.shipping_charged,
          shipping_cost: sale.shipping_cost,
          platform_fees: sale.platform_fees,
          other_fees: sale.other_fees,
          supply_cost: costPerSale,
          adjustment: sale.adjustment
        })

        await prisma.sale.update({
          where: { sale_id: sale.sale_id },
          data: {
            supply_cost: costPerSale,
            total_revenue: profitFields.total_revenue,
            total_costs: profitFields.total_costs,
            net_profit: profitFields.net_profit,
            updated: new Date()
          }
        })
      }
    }

    // Return updated order with allocations
    const updatedOrder = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      include: {
        platform: true,
        sales: true,
        order_supplies: {
          include: {
            supply_batch: {
              include: {
                supply_type: true
              }
            }
          }
        }
      }
    })

    res.json({
      message: 'Supplies allocated successfully',
      supply_cost: totalSupplyCost,
      allocations: serializeBigInt(allocations),
      order: serializeBigInt(updatedOrder)
    })
  } catch (error) {
    console.error('Error allocating supplies to order:', error)
    res.status(500).json({ error: 'Failed to allocate supplies' })
  }
})

/**
 * DELETE /api/seller/orders/:id/supplies
 * Remove all supply allocations from an order (return to inventory)
 */
router.delete('/orders/:id/supplies', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const orderId = BigInt(req.params.id)

    // Get the order with its supply allocations
    const order = await prisma.sale_order.findFirst({
      where: {
        order_id: orderId,
        user_id: userId
      },
      include: {
        order_supplies: true,
        sales: true
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.order_supplies.length === 0) {
      return res.status(400).json({ error: 'No supplies allocated to this order' })
    }

    await prisma.$transaction(async (tx) => {
      // Return supplies to inventory
      for (const supply of order.order_supplies) {
        await tx.supply_batch.update({
          where: { supply_batch_id: supply.supply_batch_id },
          data: {
            quantity_remaining: { increment: supply.quantity_used },
            is_depleted: false,
            updated: new Date()
          }
        })
      }

      // Delete allocation records
      await tx.order_supply_usage.deleteMany({
        where: { order_id: orderId }
      })
    })

    // Recalculate supply cost - now only config cost remains (extra supplies removed)
    const orderWithConfig = await prisma.sale_order.findUnique({
      where: { order_id: orderId },
      select: { shipping_config_id: true }
    })
    const configCost = orderWithConfig?.shipping_config_id
      ? await calculateSupplyCostFromConfig(prisma, userId, orderWithConfig.shipping_config_id)
      : 0

    // Update sales with just the config cost (or 0 if no config)
    if (order.sales.length > 0) {
      const costPerSale = configCost / order.sales.length
      for (const sale of order.sales) {
        const profitFields = calculateProfitFields({
          purchase_price: sale.purchase_price,
          sale_price: sale.sale_price,
          shipping_charged: sale.shipping_charged,
          shipping_cost: sale.shipping_cost,
          platform_fees: sale.platform_fees,
          other_fees: sale.other_fees,
          supply_cost: costPerSale,
          adjustment: sale.adjustment
        })

        await prisma.sale.update({
          where: { sale_id: sale.sale_id },
          data: {
            supply_cost: costPerSale,
            total_revenue: profitFields.total_revenue,
            total_costs: profitFields.total_costs,
            net_profit: profitFields.net_profit,
            updated: new Date()
          }
        })
      }
    }

    console.log(`Seller: Removed extra supply allocations from order ${orderId}, config cost remains: $${configCost.toFixed(2)}`)

    res.json({ message: 'Supply allocations removed and returned to inventory' })
  } catch (error) {
    console.error('Error removing supplies from order:', error)
    res.status(500).json({ error: 'Failed to remove supplies' })
  }
})

// ============================================
// PRODUCT PURCHASE ENDPOINTS (Set Investments)
// Track hobby box/case purchases for ROI calculations
// ============================================

// Product type display names
const PRODUCT_TYPES = {
  hobby_box: 'Hobby Box',
  hobby_case: 'Hobby Case',
  retail_blaster: 'Retail Blaster',
  retail_hanger: 'Retail Hanger',
  retail_mega: 'Retail Mega',
  retail_cello: 'Retail Cello',
  other: 'Other'
}

/**
 * GET /api/seller/product-purchases
 * Get all product purchases for the current user
 * Supports filtering by set_id
 */
router.get('/product-purchases', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { set_id, limit = 50, offset = 0 } = req.query

    const where = { user_id: userId }
    if (set_id) {
      where.set_id = parseInt(set_id)
    }

    const [purchases, total] = await Promise.all([
      prisma.product_purchase.findMany({
        where,
        include: {
          set: {
            include: {
              organization_set_organizationToorganization: true,
              manufacturer_set_manufacturerTomanufacturer: true
            }
          }
        },
        orderBy: { purchase_date: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.product_purchase.count({ where })
    ])

    // Format the response
    const formattedPurchases = purchases.map(purchase => ({
      ...serializeBigInt(purchase),
      product_type_display: PRODUCT_TYPES[purchase.product_type] || purchase.product_type,
      set_info: purchase.set ? {
        set_id: purchase.set.set_id,
        name: purchase.set.name,
        year: purchase.set.year,
        organization: purchase.set.organization_set_organizationToorganization?.abbreviation || null,
        manufacturer: purchase.set.manufacturer_set_manufacturerTomanufacturer?.name || null
      } : null
    }))

    res.json({
      purchases: formattedPurchases,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error fetching product purchases:', error)
    res.status(500).json({ error: 'Failed to fetch product purchases' })
  }
})

/**
 * GET /api/seller/product-purchases/:id
 * Get a single product purchase by ID
 */
router.get('/product-purchases/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const purchaseId = BigInt(req.params.id)

    const purchase = await prisma.product_purchase.findFirst({
      where: {
        product_purchase_id: purchaseId,
        user_id: userId
      },
      include: {
        set: {
          include: {
            organization_set_organizationToorganization: true,
            manufacturer_set_manufacturerTomanufacturer: true
          }
        }
      }
    })

    if (!purchase) {
      return res.status(404).json({ error: 'Product purchase not found' })
    }

    res.json({
      purchase: {
        ...serializeBigInt(purchase),
        product_type_display: PRODUCT_TYPES[purchase.product_type] || purchase.product_type,
        set_info: purchase.set ? {
          set_id: purchase.set.set_id,
          name: purchase.set.name,
          year: purchase.set.year,
          organization: purchase.set.organization_set_organizationToorganization?.abbreviation || null,
          manufacturer: purchase.set.manufacturer_set_manufacturerTomanufacturer?.name || null
        } : null
      }
    })
  } catch (error) {
    console.error('Error fetching product purchase:', error)
    res.status(500).json({ error: 'Failed to fetch product purchase' })
  }
})

/**
 * POST /api/seller/product-purchases
 * Create a new product purchase
 */
router.post('/product-purchases', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const {
      set_id,
      product_type,
      product_name,
      purchase_date,
      quantity = 1,
      total_cost,
      estimated_cards,
      source,
      notes
    } = req.body

    // Validation
    if (!set_id) {
      return res.status(400).json({ error: 'set_id is required' })
    }
    if (!product_type) {
      return res.status(400).json({ error: 'product_type is required' })
    }

    // Check global product types, fallback to hardcoded defaults
    const globalProductTypes = await prisma.product_type.findMany({
      where: { user_id: null, is_active: true }
    })
    const validProductTypes = globalProductTypes.length > 0
      ? globalProductTypes.map(pt => pt.slug)
      : Object.keys(PRODUCT_TYPES)

    if (!validProductTypes.includes(product_type)) {
      return res.status(400).json({ error: `Invalid product_type. Valid types: ${validProductTypes.join(', ')}` })
    }

    if (!purchase_date) {
      return res.status(400).json({ error: 'purchase_date is required' })
    }
    if (!total_cost || total_cost <= 0) {
      return res.status(400).json({ error: 'total_cost is required and must be greater than 0' })
    }

    // Verify set exists
    const set = await prisma.set.findUnique({
      where: { set_id: parseInt(set_id) }
    })
    if (!set) {
      return res.status(404).json({ error: 'Set not found' })
    }

    // Calculate cost per unit
    const qty = parseInt(quantity) || 1
    const costPerUnit = parseFloat(total_cost) / qty

    const purchase = await prisma.product_purchase.create({
      data: {
        user_id: userId,
        set_id: parseInt(set_id),
        product_type,
        product_name: product_name || null,
        purchase_date: new Date(purchase_date),
        quantity: qty,
        total_cost: parseFloat(total_cost),
        cost_per_unit: costPerUnit,
        estimated_cards: estimated_cards ? parseInt(estimated_cards) : null,
        source: source || null,
        notes: notes || null
      },
      include: {
        set: true
      }
    })

    console.log(`Seller: Created product purchase ${purchase.product_purchase_id} for set ${set_id}`)

    res.status(201).json({
      message: 'Product purchase created successfully',
      purchase: {
        ...serializeBigInt(purchase),
        product_type_display: PRODUCT_TYPES[purchase.product_type] || purchase.product_type
      }
    })
  } catch (error) {
    console.error('Error creating product purchase:', error)
    res.status(500).json({ error: 'Failed to create product purchase' })
  }
})

/**
 * PUT /api/seller/product-purchases/:id
 * Update a product purchase
 */
router.put('/product-purchases/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const purchaseId = BigInt(req.params.id)

    // Verify ownership
    const existing = await prisma.product_purchase.findFirst({
      where: {
        product_purchase_id: purchaseId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Product purchase not found' })
    }

    const {
      set_id,
      product_type,
      product_name,
      purchase_date,
      quantity,
      total_cost,
      estimated_cards,
      source,
      notes
    } = req.body

    // Validate product_type if provided
    if (product_type) {
      const globalProductTypes = await prisma.product_type.findMany({
        where: { user_id: null, is_active: true }
      })
      const validProductTypes = globalProductTypes.length > 0
        ? globalProductTypes.map(pt => pt.slug)
        : Object.keys(PRODUCT_TYPES)

      if (!validProductTypes.includes(product_type)) {
        return res.status(400).json({ error: `Invalid product_type. Valid types: ${validProductTypes.join(', ')}` })
      }
    }

    // Verify set exists if changing set_id
    if (set_id) {
      const set = await prisma.set.findUnique({
        where: { set_id: parseInt(set_id) }
      })
      if (!set) {
        return res.status(404).json({ error: 'Set not found' })
      }
    }

    // Calculate new cost per unit if quantity or total_cost changed
    const newQty = quantity !== undefined ? parseInt(quantity) : Number(existing.quantity)
    const newTotalCost = total_cost !== undefined ? parseFloat(total_cost) : parseFloat(existing.total_cost)
    const newCostPerUnit = newTotalCost / newQty

    const purchase = await prisma.product_purchase.update({
      where: { product_purchase_id: purchaseId },
      data: {
        set_id: set_id !== undefined ? parseInt(set_id) : undefined,
        product_type: product_type ?? undefined,
        product_name: product_name !== undefined ? (product_name || null) : undefined,
        purchase_date: purchase_date !== undefined ? new Date(purchase_date) : undefined,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        total_cost: total_cost !== undefined ? parseFloat(total_cost) : undefined,
        cost_per_unit: newCostPerUnit,
        estimated_cards: estimated_cards !== undefined ? (estimated_cards ? parseInt(estimated_cards) : null) : undefined,
        source: source !== undefined ? (source || null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        updated: new Date()
      },
      include: {
        set: true
      }
    })

    console.log(`Seller: Updated product purchase ${purchaseId}`)

    res.json({
      message: 'Product purchase updated successfully',
      purchase: {
        ...serializeBigInt(purchase),
        product_type_display: PRODUCT_TYPES[purchase.product_type] || purchase.product_type
      }
    })
  } catch (error) {
    console.error('Error updating product purchase:', error)
    res.status(500).json({ error: 'Failed to update product purchase' })
  }
})

/**
 * DELETE /api/seller/product-purchases/:id
 * Delete a product purchase
 */
router.delete('/product-purchases/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const purchaseId = BigInt(req.params.id)

    // Verify ownership
    const existing = await prisma.product_purchase.findFirst({
      where: {
        product_purchase_id: purchaseId,
        user_id: userId
      }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Product purchase not found' })
    }

    await prisma.product_purchase.delete({
      where: { product_purchase_id: purchaseId }
    })

    console.log(`Seller: Deleted product purchase ${purchaseId}`)

    res.json({ message: 'Product purchase deleted successfully' })
  } catch (error) {
    console.error('Error deleting product purchase:', error)
    res.status(500).json({ error: 'Failed to delete product purchase' })
  }
})

/**
 * GET /api/seller/set-investments
 * Get investment summary by set (aggregated purchases + sales data)
 * Returns ROI calculations showing "how much dug out of the hole"
 */
router.get('/set-investments', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    // Get all product purchases grouped by set
    const purchases = await prisma.product_purchase.findMany({
      where: { user_id: userId },
      include: {
        set: {
          include: {
            organization_set_organizationToorganization: true,
            manufacturer_set_manufacturerTomanufacturer: true
          }
        }
      },
      orderBy: { purchase_date: 'desc' }
    })

    // Group purchases by set
    const setMap = new Map()
    for (const purchase of purchases) {
      const setId = purchase.set_id
      if (!setMap.has(setId)) {
        setMap.set(setId, {
          set_id: setId,
          set_name: purchase.set?.name || 'Unknown Set',
          set_year: purchase.set?.year || null,
          set_organization: purchase.set?.organization_set_organizationToorganization?.abbreviation || null,
          set_manufacturer: purchase.set?.manufacturer_set_manufacturerTomanufacturer?.name || null,
          purchases: [],
          total_investment: 0,
          total_products: 0,
          estimated_cards: 0
        })
      }
      const setData = setMap.get(setId)
      setData.purchases.push(serializeBigInt(purchase))
      setData.total_investment += parseFloat(purchase.total_cost)
      setData.total_products += purchase.quantity
      setData.estimated_cards += purchase.estimated_cards || 0
    }

    // Get sales data for each set (sold cards from these sets)
    const setIds = [...setMap.keys()]
    if (setIds.length > 0) {
      // Get all series for these sets
      const seriesData = await prisma.series.findMany({
        where: { set: { in: setIds } },
        select: { series_id: true, set: true }
      })
      const seriesIds = seriesData.map(s => Number(s.series_id))
      const seriesSetMap = new Map(seriesData.map(s => [Number(s.series_id), s.set]))

      // Get all sold cards for these series
      const soldSales = await prisma.sale.findMany({
        where: {
          user_id: userId,
          status: 'sold',
          card: {
            series: { in: seriesIds.map(id => BigInt(id)) }
          }
        },
        include: {
          card: {
            select: { series: true }
          }
        }
      })

      // Aggregate sales by set
      for (const sale of soldSales) {
        const seriesId = sale.card?.series ? Number(sale.card.series) : null
        const setId = seriesId ? seriesSetMap.get(seriesId) : null

        if (setId && setMap.has(setId)) {
          const setData = setMap.get(setId)
          if (!setData.sales_data) {
            setData.sales_data = {
              total_sales_revenue: 0,
              total_sales_count: 0,
              total_net_profit: 0
            }
          }
          setData.sales_data.total_sales_revenue += parseFloat(sale.sale_price) || 0
          setData.sales_data.total_sales_count += 1
          setData.sales_data.total_net_profit += parseFloat(sale.net_profit) || 0
        }
      }
    }

    // Calculate ROI metrics for each set
    const investments = [...setMap.values()].map(setData => {
      const salesData = setData.sales_data || {
        total_sales_revenue: 0,
        total_sales_count: 0,
        total_net_profit: 0
      }

      // "Hole" = Investment - Sales Revenue
      // Negative = still in the hole, Positive = in the profit
      const remaining_hole = setData.total_investment - salesData.total_sales_revenue
      const recovery_percentage = setData.total_investment > 0
        ? ((salesData.total_sales_revenue / setData.total_investment) * 100)
        : 0

      return {
        set_id: setData.set_id,
        set_name: setData.set_name,
        set_year: setData.set_year,
        set_organization: setData.set_organization,
        set_manufacturer: setData.set_manufacturer,
        total_investment: setData.total_investment,
        total_products: setData.total_products,
        estimated_cards: setData.estimated_cards,
        purchase_count: setData.purchases.length,
        first_purchase: setData.purchases.length > 0
          ? setData.purchases[setData.purchases.length - 1].purchase_date
          : null,
        last_purchase: setData.purchases.length > 0
          ? setData.purchases[0].purchase_date
          : null,
        sales_revenue: salesData.total_sales_revenue,
        cards_sold: salesData.total_sales_count,
        net_profit_from_sales: salesData.total_net_profit,
        remaining_hole: remaining_hole,
        recovery_percentage: recovery_percentage,
        is_profitable: remaining_hole < 0 // Negative remaining hole means profitable
      }
    })

    // Sort by total investment descending
    investments.sort((a, b) => b.total_investment - a.total_investment)

    // Calculate overall totals
    const totals = investments.reduce((acc, inv) => {
      acc.total_investment += inv.total_investment
      acc.total_sales_revenue += inv.sales_revenue
      acc.total_cards_sold += inv.cards_sold
      acc.total_net_profit += inv.net_profit_from_sales
      return acc
    }, {
      total_investment: 0,
      total_sales_revenue: 0,
      total_cards_sold: 0,
      total_net_profit: 0
    })

    totals.remaining_hole = totals.total_investment - totals.total_sales_revenue
    totals.recovery_percentage = totals.total_investment > 0
      ? ((totals.total_sales_revenue / totals.total_investment) * 100)
      : 0

    // Get global product types, fallback to hardcoded defaults
    const globalProductTypes = await prisma.product_type.findMany({
      where: { user_id: null, is_active: true },
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }]
    })

    // Convert to object format for backwards compatibility
    const productTypesObj = globalProductTypes.length > 0
      ? Object.fromEntries(globalProductTypes.map(pt => [pt.slug, pt.name]))
      : PRODUCT_TYPES

    res.json({
      investments,
      totals,
      product_types: productTypesObj
    })
  } catch (error) {
    console.error('Error fetching set investments:', error)
    res.status(500).json({ error: 'Failed to fetch set investments' })
  }
})

/**
 * GET /api/seller/set-investments/:setId
 * Get detailed investment data for a specific set
 */
router.get('/set-investments/:setId', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const setId = parseInt(req.params.setId)

    // Get set info
    const set = await prisma.set.findUnique({
      where: { set_id: setId },
      include: {
        organization_set_organizationToorganization: true,
        manufacturer_set_manufacturerTomanufacturer: true
      }
    })

    if (!set) {
      return res.status(404).json({ error: 'Set not found' })
    }

    // Get all purchases for this set
    const purchases = await prisma.product_purchase.findMany({
      where: {
        user_id: userId,
        set_id: setId
      },
      orderBy: { purchase_date: 'desc' }
    })

    // Get all series for this set
    const seriesData = await prisma.series.findMany({
      where: { set: setId },
      select: { series_id: true, name: true }
    })
    const seriesIds = seriesData.map(s => Number(s.series_id))

    // Get all sales for cards in this set
    const sales = seriesIds.length > 0 ? await prisma.sale.findMany({
      where: {
        user_id: userId,
        card: {
          series: { in: seriesIds.map(id => BigInt(id)) }
        }
      },
      include: {
        card: {
          include: {
            color_card_colorTocolor: true,
            card_player_team_card_player_team_cardTocard: {
              include: {
                player_team_card_player_team_player_teamToplayer_team: {
                  include: {
                    player_player_team_playerToplayer: true,
                    team_player_team_teamToteam: true
                  }
                }
              }
            }
          }
        },
        platform: true,
        order: true,
        shipping_config: true
      },
      orderBy: { sale_date: 'desc' }
    }) : []

    // Calculate totals
    const totalInvestment = purchases.reduce((sum, p) => sum + parseFloat(p.total_cost), 0)
    const totalProducts = purchases.reduce((sum, p) => sum + p.quantity, 0)
    const estimatedCards = purchases.reduce((sum, p) => sum + (p.estimated_cards || 0), 0)

    const soldSales = sales.filter(s => s.status === 'sold')
    const salesRevenue = soldSales.reduce((sum, s) => sum + (parseFloat(s.sale_price) || 0), 0)
    const netProfit = soldSales.reduce((sum, s) => sum + (parseFloat(s.net_profit) || 0), 0)

    const remainingHole = totalInvestment - salesRevenue
    const recoveryPercentage = totalInvestment > 0 ? ((salesRevenue / totalInvestment) * 100) : 0

    // Create series map for looking up series names
    const seriesMap = new Map(seriesData.map(s => [Number(s.series_id), s]))

    // Format sales with card info (matching main /sales endpoint format)
    const formattedSales = sales.map(sale => {
      const card = sale.card
      const playerTeams = card?.card_player_team_card_player_team_cardTocard || []
      const series = card?.series ? seriesMap.get(Number(card.series)) : null
      const colorData = card?.color_card_colorTocolor

      // Get player names and teams (same format as main /sales endpoint)
      const playerData = playerTeams.map(cpt => {
        const pt = cpt.player_team_card_player_team_player_teamToplayer_team
        const player = pt?.player_player_team_playerToplayer
        const team = pt?.team_player_team_teamToteam
        return {
          name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : null,
          team_name: team?.name || null,
          team_abbreviation: team?.abbreviation || null,
          primary_color: team?.primary_color || null,
          secondary_color: team?.secondary_color || null
        }
      }).filter(p => p.name)

      return {
        ...serializeBigInt(sale),
        card_info: card ? {
          card_id: Number(card.card_id),
          card_number: card.card_number,
          players: playerData.map(p => p.name).join(', '),
          player_data: playerData,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          is_short_print: card.is_short_print,
          print_run: card.print_run,
          color: colorData?.name || null,
          color_hex: colorData?.hex_value || null,
          series_name: series?.name || null
        } : null
      }
    })

    // Get global product types, fallback to hardcoded defaults
    const globalProductTypes = await prisma.product_type.findMany({
      where: { user_id: null, is_active: true },
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }]
    })

    // Convert to object format for backwards compatibility
    const productTypesObj = globalProductTypes.length > 0
      ? Object.fromEntries(globalProductTypes.map(pt => [pt.slug, pt.name]))
      : PRODUCT_TYPES

    res.json({
      set: {
        set_id: set.set_id,
        name: set.name,
        year: set.year,
        organization: set.organization_set_organizationToorganization?.abbreviation || null,
        manufacturer: set.manufacturer_set_manufacturerTomanufacturer?.name || null
      },
      purchases: purchases.map(p => ({
        ...serializeBigInt(p),
        product_type_display: productTypesObj[p.product_type] || p.product_type
      })),
      sales: formattedSales,
      summary: {
        total_investment: totalInvestment,
        total_products: totalProducts,
        estimated_cards: estimatedCards,
        purchase_count: purchases.length,
        sales_revenue: salesRevenue,
        cards_sold: soldSales.length,
        cards_listed: sales.filter(s => s.status === 'listed').length,
        net_profit: netProfit,
        remaining_hole: remainingHole,
        recovery_percentage: recoveryPercentage,
        is_profitable: remainingHole < 0
      },
      product_types: productTypesObj
    })
  } catch (error) {
    console.error('Error fetching set investment detail:', error)
    res.status(500).json({ error: 'Failed to fetch set investment detail' })
  }
})

/**
 * GET /api/seller/summary
 * Get summary statistics for the seller dashboard
 */
router.get('/summary', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    // Get counts by status
    const statusCounts = await prisma.sale.groupBy({
      by: ['status'],
      where: { user_id: userId },
      _count: { sale_id: true }
    })

    // Get totals for sold cards only (profit should only count sold items)
    const soldSales = await prisma.sale.findMany({
      where: {
        user_id: userId,
        status: 'sold'
      },
      select: {
        sale_price: true,
        shipping_charged: true,
        total_revenue: true,
        total_costs: true,
        net_profit: true
      }
    })

    const totals = soldSales.reduce((acc, sale) => {
      acc.total_revenue += parseFloat(sale.total_revenue) || 0
      acc.total_costs += parseFloat(sale.total_costs) || 0
      acc.net_profit += parseFloat(sale.net_profit) || 0
      return acc
    }, { total_revenue: 0, total_costs: 0, net_profit: 0 })

    res.json({
      status_counts: statusCounts.reduce((acc, s) => {
        acc[s.status] = s._count.sale_id
        return acc
      }, {}),
      sold_totals: totals,
      total_sales: statusCounts.reduce((sum, s) => sum + s._count.sale_id, 0)
    })
  } catch (error) {
    console.error('Error fetching summary:', error)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

// ============================================
// SELLER ADMIN ENDPOINTS
// Manage dropdown data: platforms, supply types
// Note: Product types are managed globally via /api/admin/seller/product-types
// ============================================

// ---- SELLING PLATFORMS ----

/**
 * GET /api/seller/admin/platforms
 * Get all selling platforms for the current user (for admin management)
 */
router.get('/admin/platforms', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { include_inactive } = req.query

    const where = { user_id: userId }
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
 * POST /api/seller/admin/platforms
 * Create a new selling platform
 */
router.post('/admin/platforms', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { name, fee_percentage, payment_fee_pct, fixed_fee } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // Check for duplicate name
    const existing = await prisma.selling_platform.findFirst({
      where: { user_id: userId, name: name.trim() }
    })
    if (existing) {
      return res.status(400).json({ error: 'A platform with this name already exists' })
    }

    const platform = await prisma.selling_platform.create({
      data: {
        user_id: userId,
        name: name.trim(),
        fee_percentage: fee_percentage ? parseFloat(fee_percentage) : null,
        payment_fee_pct: payment_fee_pct ? parseFloat(payment_fee_pct) : null,
        fixed_fee: fixed_fee ? parseFloat(fixed_fee) : null
      }
    })

    console.log(`Seller Admin: Created platform ${platform.platform_id}`)

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
 * PUT /api/seller/admin/platforms/:id
 * Update a selling platform
 */
router.put('/admin/platforms/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const platformId = parseInt(req.params.id)

    const existing = await prisma.selling_platform.findFirst({
      where: { platform_id: platformId, user_id: userId }
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
          user_id: userId,
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

    console.log(`Seller Admin: Updated platform ${platformId}`)

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
 * DELETE /api/seller/admin/platforms/:id
 * Delete a selling platform (or deactivate if in use)
 */
router.delete('/admin/platforms/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const platformId = parseInt(req.params.id)

    const existing = await prisma.selling_platform.findFirst({
      where: { platform_id: platformId, user_id: userId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Platform not found' })
    }

    // Check if in use
    const inUse = await prisma.sale.findFirst({
      where: { user_id: userId, platform_id: platformId }
    })

    if (inUse) {
      await prisma.selling_platform.update({
        where: { platform_id: platformId },
        data: { is_active: false }
      })
      console.log(`Seller Admin: Deactivated platform ${platformId} (in use)`)
      return res.json({ message: 'Platform deactivated (in use by sales)' })
    }

    await prisma.selling_platform.delete({
      where: { platform_id: platformId }
    })

    console.log(`Seller Admin: Deleted platform ${platformId}`)

    res.json({ message: 'Platform deleted successfully' })
  } catch (error) {
    console.error('Error deleting platform:', error)
    res.status(500).json({ error: 'Failed to delete platform' })
  }
})

// ---- SUPPLY TYPES ----

/**
 * GET /api/seller/admin/supply-types
 * Get all supply types for the current user
 */
router.get('/admin/supply-types', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { include_inactive } = req.query

    const where = { user_id: userId }
    if (!include_inactive) {
      where.is_active = true
    }

    const supplyTypes = await prisma.supply_type.findMany({
      where,
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
 * POST /api/seller/admin/supply-types
 * Create a new supply type
 */
router.post('/admin/supply-types', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { name, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // Check for duplicate name
    const existing = await prisma.supply_type.findFirst({
      where: { user_id: userId, name: name.trim() }
    })
    if (existing) {
      return res.status(400).json({ error: 'A supply type with this name already exists' })
    }

    const supplyType = await prisma.supply_type.create({
      data: {
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    console.log(`Seller Admin: Created supply type ${supplyType.supply_type_id}`)

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
 * PUT /api/seller/admin/supply-types/:id
 * Update a supply type
 */
router.put('/admin/supply-types/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const supplyTypeId = parseInt(req.params.id)

    const existing = await prisma.supply_type.findFirst({
      where: { supply_type_id: supplyTypeId, user_id: userId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply type not found' })
    }

    const { name, description, is_active } = req.body

    const updateData = {}
    if (name !== undefined) {
      // Check for duplicate name (excluding self)
      const duplicate = await prisma.supply_type.findFirst({
        where: {
          user_id: userId,
          name: name.trim(),
          supply_type_id: { not: supplyTypeId }
        }
      })
      if (duplicate) {
        return res.status(400).json({ error: 'A supply type with this name already exists' })
      }
      updateData.name = name.trim()
    }
    if (description !== undefined) updateData.description = description?.trim() || null
    if (is_active !== undefined) updateData.is_active = is_active

    const supplyType = await prisma.supply_type.update({
      where: { supply_type_id: supplyTypeId },
      data: updateData
    })

    console.log(`Seller Admin: Updated supply type ${supplyTypeId}`)

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
 * DELETE /api/seller/admin/supply-types/:id
 * Delete a supply type (or deactivate if in use)
 */
router.delete('/admin/supply-types/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const supplyTypeId = parseInt(req.params.id)

    const existing = await prisma.supply_type.findFirst({
      where: { supply_type_id: supplyTypeId, user_id: userId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Supply type not found' })
    }

    // Check if in use by supply batches
    const inUse = await prisma.supply_batch.findFirst({
      where: { user_id: userId, supply_type_id: supplyTypeId }
    })

    if (inUse) {
      await prisma.supply_type.update({
        where: { supply_type_id: supplyTypeId },
        data: { is_active: false }
      })
      console.log(`Seller Admin: Deactivated supply type ${supplyTypeId} (in use)`)
      return res.json({ message: 'Supply type deactivated (in use by supply batches)' })
    }

    await prisma.supply_type.delete({
      where: { supply_type_id: supplyTypeId }
    })

    console.log(`Seller Admin: Deleted supply type ${supplyTypeId}`)

    res.json({ message: 'Supply type deleted successfully' })
  } catch (error) {
    console.error('Error deleting supply type:', error)
    res.status(500).json({ error: 'Failed to delete supply type' })
  }
})

module.exports = router
