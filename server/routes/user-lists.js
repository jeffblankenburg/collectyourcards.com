const express = require('express')
const prisma = require('../config/prisma')
const { authMiddleware } = require('../middleware/auth')
const { sanitizeInput, sanitizeParams } = require('../middleware/inputSanitization')
const router = express.Router()

// Helper function to create slug from list name
function createListSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Helper function to find list by slug and user
async function findListBySlug(slug, userId) {
  const result = await prisma.$queryRaw`
    SELECT user_list_id, name, summary, card_count, created, is_public
    FROM user_list
    WHERE [user] = ${BigInt(userId)}
  `

  // Find the list that matches the slug
  const list = result.find(row => createListSlug(row.name) === slug)

  if (!list) {
    return null
  }

  return {
    user_list_id: Number(list.user_list_id),
    name: list.name,
    summary: list.summary || '',
    card_count: list.card_count || 0,
    created: list.created,
    is_public: Boolean(list.is_public)
  }
}

// All routes require authentication
router.use(authMiddleware)
router.use(sanitizeInput)
router.use(sanitizeParams)

// POST /api/user/lists/copy - Copy a public list from another user
router.post('/copy', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { source_username, source_list_slug } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!source_username || !source_list_slug) {
      return res.status(400).json({ error: 'Missing required fields: source_username, source_list_slug' })
    }

    // Find the source user
    const sourceUserResult = await prisma.$queryRaw`
      SELECT user_id
      FROM [user]
      WHERE username = ${source_username.toLowerCase()}
        AND is_active = 1
    `

    if (sourceUserResult.length === 0) {
      return res.status(404).json({ error: 'Source user not found' })
    }

    const sourceUserId = Number(sourceUserResult[0].user_id)

    // Get the source user's public lists
    const sourceListsResult = await prisma.$queryRaw`
      SELECT user_list_id, name, card_count, is_public
      FROM user_list
      WHERE [user] = ${BigInt(sourceUserId)}
        AND is_public = 1
    `

    // Find the list that matches the slug
    const sourceList = sourceListsResult.find(row => createListSlug(row.name) === source_list_slug)

    if (!sourceList) {
      return res.status(404).json({ error: 'Source list not found or is private' })
    }

    const sourceListId = Number(sourceList.user_list_id)

    // Create new list for current user (append " (Copy)" if needed to avoid conflicts)
    let newListName = sourceList.name
    const existingLists = await prisma.$queryRaw`
      SELECT name FROM user_list WHERE [user] = ${BigInt(userId)}
    `
    const existingNames = existingLists.map(l => l.name.toLowerCase())

    if (existingNames.includes(newListName.toLowerCase())) {
      newListName = `${sourceList.name} (Copy)`
      let counter = 2
      while (existingNames.includes(newListName.toLowerCase())) {
        newListName = `${sourceList.name} (Copy ${counter})`
        counter++
      }
    }

    // Create the new list
    const createResult = await prisma.$queryRaw`
      INSERT INTO user_list ([user], name, is_public, created)
      OUTPUT INSERTED.user_list_id
      VALUES (${BigInt(userId)}, ${newListName}, 0, GETDATE())
    `

    const newListId = Number(createResult[0].user_list_id)

    // Get all cards from source list
    const sourceCards = await prisma.$queryRaw`
      SELECT card
      FROM user_list_card
      WHERE user_list = ${BigInt(sourceListId)}
    `

    // Copy cards to new list
    for (const cardRow of sourceCards) {
      await prisma.$executeRaw`
        INSERT INTO user_list_card (user_list, card)
        VALUES (${BigInt(newListId)}, ${cardRow.card})
      `
    }

    // Update card count
    await prisma.$executeRaw`
      UPDATE user_list
      SET card_count = ${sourceCards.length}
      WHERE user_list_id = ${BigInt(newListId)}
    `

    res.json({
      message: 'List copied successfully',
      list: {
        user_list_id: newListId,
        name: newListName,
        slug: createListSlug(newListName),
        card_count: sourceCards.length,
        is_public: false
      }
    })
  } catch (error) {
    console.error('Error copying list:', error)
    res.status(500).json({ error: 'Failed to copy list', message: error.message })
  }
})

// GET /api/user/lists - Get all lists for authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    const result = await prisma.$queryRaw`
      SELECT
        user_list_id,
        name,
        card_count,
        created
      FROM user_list
      WHERE [user] = ${BigInt(userId)}
      ORDER BY created DESC
    `

    // Serialize BigInt fields and add slugs
    const lists = result.map(row => {
      const listId = Number(row.user_list_id)
      return {
        user_list_id: listId,
        slug: createListSlug(row.name),
        name: row.name,
        card_count: row.card_count || 0,
        created: row.created
      }
    })

    res.json({ lists })
  } catch (error) {
    console.error('Error fetching user lists:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch lists'
    })
  }
})

// POST /api/user/lists - Create new list
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { name } = req.body

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'List name is required'
      })
    }

    if (name.length > 100) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'List name must be 100 characters or less'
      })
    }

    const result = await prisma.$queryRaw`
      INSERT INTO user_list ([user], name, created, card_count)
      OUTPUT INSERTED.user_list_id, INSERTED.name, INSERTED.created, INSERTED.card_count
      VALUES (${BigInt(userId)}, ${name.trim()}, GETDATE(), 0)
    `

    const newList = result[0]
    const listId = Number(newList.user_list_id)

    res.status(201).json({
      list: {
        user_list_id: listId,
        slug: createListSlug(newList.name),
        name: newList.name,
        card_count: newList.card_count || 0,
        created: newList.created
      }
    })
  } catch (error) {
    console.error('Error creating list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create list'
    })
  }
})

// GET /api/user/lists/:slug - Get list details with cards
router.get('/:slug', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Find list by slug
    const listInfo = await findListBySlug(slug, userId)

    if (!listInfo) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = listInfo.user_list_id

    // Get all cards in the list with user ownership counts
    const cardsResult = await prisma.$queryRaw`
        SELECT
          ulc.user_list_card_id,
          ulc.created as date_added,
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          c.sort_order,
          c.notes,
          s.series_id,
          s.name as series_name,
          col.name as color,
          col.hex_value as hex_color,
          cpt.card_player_team_id,
          p.player_id,
          p.first_name,
          p.last_name,
          t.team_id,
          t.name as team_name,
          t.abbreviation as team_abbr,
          t.primary_color,
          t.secondary_color,
          (SELECT COUNT(*) FROM user_card uc WHERE uc.card = c.card_id AND uc.[user] = ${BigInt(userId)}) as user_card_count
        FROM user_list_card ulc
        JOIN card c ON ulc.card = c.card_id
        JOIN series s ON c.series = s.series_id
        LEFT JOIN color col ON c.color = col.color_id
        LEFT JOIN card_player_team cpt ON cpt.card = c.card_id
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE ulc.user_list = ${BigInt(listId)}
        ORDER BY ulc.created DESC
      `

    // Group cards by card_id to handle multiple player-team associations
    const cardMap = new Map()

    cardsResult.forEach(row => {
      const cardId = Number(row.card_id)

      if (!cardMap.has(cardId)) {
        cardMap.set(cardId, {
          user_list_card_id: Number(row.user_list_card_id),
          date_added: row.date_added,
          card_id: cardId,
          card_number: row.card_number,
          is_rookie: row.is_rookie,
          is_autograph: row.is_autograph,
          is_relic: row.is_relic,
          print_run: row.print_run,
          sort_order: row.sort_order,
          notes: row.notes,
          user_card_count: row.user_card_count || 0,
          series_rel: {
            series_id: Number(row.series_id),
            name: row.series_name
          },
          color_rel: row.color ? {
            color: row.color,
            hex_color: row.hex_color
          } : null,
          card_player_teams: []
        })
      }

      const card = cardMap.get(cardId)

      // Add card_player_team relationship if exists and not already added
      if (row.card_player_team_id) {
        const cptId = Number(row.card_player_team_id)
        if (!card.card_player_teams.find(cpt => cpt.card_player_team_id === cptId)) {
          card.card_player_teams.push({
            card_player_team_id: cptId,
            player: row.player_id ? {
              player_id: Number(row.player_id),
              first_name: row.first_name,
              last_name: row.last_name
            } : null,
            team: row.team_id ? {
              team_id: row.team_id,
              name: row.team_name,
              abbreviation: row.team_abbr,
              primary_color: row.primary_color,
              secondary_color: row.secondary_color
            } : null
          })
        }
      }
    })

    const cards = Array.from(cardMap.values())

    res.json({
      list: {
        user_list_id: listInfo.user_list_id,
        slug: createListSlug(listInfo.name),
        name: listInfo.name,
        summary: listInfo.summary || '',
        card_count: listInfo.card_count,
        created: listInfo.created,
        is_public: listInfo.is_public
      },
      cards
    })
  } catch (error) {
    console.error('Error fetching list details:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch list details'
    })
  }
})

// PUT /api/user/lists/:slug - Update list name
router.put('/:slug', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug } = req.params
    const { name, summary } = req.body

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Find list by slug
    const existingList = await findListBySlug(slug, userId)

    if (!existingList) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = existingList.user_list_id

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'List name is required'
        })
      }

      if (name.length > 100) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'List name must be 100 characters or less'
        })
      }
    }

    // Validate summary if provided
    if (summary !== undefined && summary.length > 1000) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Summary must be 1000 characters or less'
      })
    }

    // Build update query based on what fields are provided
    let result
    if (name !== undefined && summary !== undefined) {
      result = await prisma.$queryRaw`
        UPDATE user_list
        SET name = ${name.trim()}, summary = ${summary.trim()}
        OUTPUT INSERTED.user_list_id, INSERTED.name, INSERTED.summary, INSERTED.card_count, INSERTED.created, INSERTED.is_public
        WHERE user_list_id = ${BigInt(listId)} AND [user] = ${BigInt(userId)}
      `
    } else if (name !== undefined) {
      result = await prisma.$queryRaw`
        UPDATE user_list
        SET name = ${name.trim()}
        OUTPUT INSERTED.user_list_id, INSERTED.name, INSERTED.summary, INSERTED.card_count, INSERTED.created, INSERTED.is_public
        WHERE user_list_id = ${BigInt(listId)} AND [user] = ${BigInt(userId)}
      `
    } else if (summary !== undefined) {
      result = await prisma.$queryRaw`
        UPDATE user_list
        SET summary = ${summary.trim()}
        OUTPUT INSERTED.user_list_id, INSERTED.name, INSERTED.summary, INSERTED.card_count, INSERTED.created, INSERTED.is_public
        WHERE user_list_id = ${BigInt(listId)} AND [user] = ${BigInt(userId)}
      `
    } else {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields to update'
      })
    }

    if (result.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const updatedList = result[0]
    const updatedListId = Number(updatedList.user_list_id)

    res.json({
      list: {
        user_list_id: updatedListId,
        slug: createListSlug(updatedList.name),
        name: updatedList.name,
        summary: updatedList.summary || '',
        card_count: updatedList.card_count || 0,
        created: updatedList.created,
        is_public: Boolean(updatedList.is_public)
      }
    })
  } catch (error) {
    console.error('Error updating list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update list'
    })
  }
})

// PATCH /api/user/lists/:slug/visibility - Toggle list visibility (public/private)
router.patch('/:slug/visibility', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug } = req.params
    const { is_public } = req.body

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (typeof is_public !== 'boolean') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'is_public must be a boolean value'
      })
    }

    // Find list by slug
    const existingList = await findListBySlug(slug, userId)

    if (!existingList) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = existingList.user_list_id

    // Update visibility
    const result = await prisma.$queryRaw`
      UPDATE user_list
      SET is_public = ${is_public ? 1 : 0}
      OUTPUT INSERTED.user_list_id, INSERTED.name, INSERTED.card_count, INSERTED.created, INSERTED.is_public
      WHERE user_list_id = ${BigInt(listId)} AND [user] = ${BigInt(userId)}
    `

    if (result.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const updatedList = result[0]
    res.json({
      list: {
        user_list_id: Number(updatedList.user_list_id),
        slug: createListSlug(updatedList.name),
        name: updatedList.name,
        card_count: updatedList.card_count || 0,
        created: updatedList.created,
        is_public: Boolean(updatedList.is_public)
      }
    })
  } catch (error) {
    console.error('Error updating list visibility:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update list visibility'
    })
  }
})

// DELETE /api/user/lists/:slug - Delete list
router.delete('/:slug', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Find list by slug
    const existingList = await findListBySlug(slug, userId)

    if (!existingList) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = existingList.user_list_id

    try {
      await prisma.$transaction(async (tx) => {
        // Delete all cards in the list first
        await tx.$executeRaw`DELETE FROM user_list_card WHERE user_list = ${BigInt(listId)}`

        // Delete the list (only if belongs to user)
        const result = await tx.$executeRaw`DELETE FROM user_list WHERE user_list_id = ${BigInt(listId)} AND [user] = ${BigInt(userId)}`

        if (result === 0) {
          throw new Error('List not found or access denied')
        }
      })

      res.json({ message: 'List deleted successfully' })
    } catch (error) {
      if (error.message === 'List not found or access denied') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        })
      }
      throw error
    }
  } catch (error) {
    console.error('Error deleting list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete list'
    })
  }
})

// POST /api/user/lists/:slug/cards - Add card(s) to list
router.post('/:slug/cards', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug } = req.params
    const { cardId, cardIds } = req.body // Support single or multiple cards

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Find list by slug
    const existingList = await findListBySlug(slug, userId)

    if (!existingList) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = existingList.user_list_id

    // Normalize to array
    const cardsToAdd = cardIds || (cardId ? [cardId] : [])

    if (cardsToAdd.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'At least one card ID is required'
      })
    }

    await prisma.$transaction(async (tx) => {
      let addedCount = 0
      let duplicateCount = 0

      for (const cId of cardsToAdd) {
        // Check if card already in list
        const existingCheck = await tx.$queryRaw`SELECT user_list_card_id FROM user_list_card WHERE user_list = ${BigInt(listId)} AND card = ${BigInt(cId)}`

        if (existingCheck.length > 0) {
          duplicateCount++
          continue
        }

        // Add card to list
        await tx.$executeRaw`
          INSERT INTO user_list_card (user_list, card, created)
          VALUES (${BigInt(listId)}, ${BigInt(cId)}, GETDATE())
        `

        addedCount++
      }

      // Update card count
      await tx.$executeRaw`
        UPDATE user_list
        SET card_count = (SELECT COUNT(*) FROM user_list_card WHERE user_list = ${BigInt(listId)})
        WHERE user_list_id = ${BigInt(listId)}
      `

      // Generate appropriate message
      let message
      if (addedCount === 0 && duplicateCount > 0) {
        message = duplicateCount === 1
          ? 'Card is already in this list'
          : `${duplicateCount} cards are already in this list`
      } else if (addedCount > 0 && duplicateCount > 0) {
        message = `${addedCount} card${addedCount !== 1 ? 's' : ''} added, ${duplicateCount} already in list`
      } else if (addedCount === 1) {
        message = 'Card added to list'
      } else {
        message = `${addedCount} cards added to list`
      }

      return {
        message,
        added: addedCount,
        duplicates: duplicateCount
      }
    }).then(result => res.json(result))
  } catch (error) {
    console.error('Error adding cards to list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to add cards to list'
    })
  }
})

// DELETE /api/user/lists/:slug/cards/:cardId - Remove card from list
router.delete('/:slug/cards/:cardId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { slug, cardId } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    // Find list by slug
    const existingList = await findListBySlug(slug, userId)

    if (!existingList) {
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or access denied'
      })
    }

    const listId = existingList.user_list_id

    try {
      await prisma.$transaction(async (tx) => {
        // Delete the card from list
        const result = await tx.$executeRaw`DELETE FROM user_list_card WHERE user_list = ${BigInt(listId)} AND card = ${BigInt(cardId)}`

        if (result === 0) {
          throw new Error('Card not found in this list')
        }

        // Update card count
        await tx.$executeRaw`
          UPDATE user_list
          SET card_count = (SELECT COUNT(*) FROM user_list_card WHERE user_list = ${BigInt(listId)})
          WHERE user_list_id = ${BigInt(listId)}
        `
      })

      res.json({ message: 'Card removed from list' })
    } catch (error) {
      if (error.message === 'Card not found in this list') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        })
      }
      throw error
    }
  } catch (error) {
    console.error('Error removing card from list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to remove card from list'
    })
  }
})

// GET /api/user/lists/card/:cardId - Check which lists contain a specific card
router.get('/card/:cardId', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { cardId } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    const result = await prisma.$queryRaw`
      SELECT
        ul.user_list_id,
        ul.name,
        ul.card_count,
        ulc.created as date_added
      FROM user_list ul
      JOIN user_list_card ulc ON ul.user_list_id = ulc.user_list
      WHERE ul.[user] = ${BigInt(userId)} AND ulc.card = ${BigInt(cardId)}
      ORDER BY ulc.created DESC
    `

    const lists = result.map(row => ({
      user_list_id: Number(row.user_list_id),
      name: row.name,
      card_count: row.card_count || 0,
      date_added: row.date_added
    }))

    res.json({ lists })
  } catch (error) {
    console.error('Error checking card lists:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to check card lists'
    })
  }
})

module.exports = router
