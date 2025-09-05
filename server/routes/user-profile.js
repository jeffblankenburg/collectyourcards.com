const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth')
const { isReserved, suggestAlternatives } = require('../config/reserved-usernames')

// GET /api/profile - Get current user's profile (for profile management)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    console.log(`🔍 Debug: Fetching own profile for user ID: ${userId}`)

    // Get user profile
    const profile = await prisma.$queryRaw`
      SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.bio,
        u.avatar_url,
        u.website,
        u.user_location,
        u.is_public_profile,
        u.created_at,
        u.profile_completed,
        u.email
      FROM [user] u
      WHERE u.user_id = ${Number(userId)}
        AND u.is_active = 1
    `

    if (profile.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = profile[0]

    // Serialize BigInt fields
    const serializedProfile = {
      user_id: Number(user.user_id),
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      bio: user.bio,
      avatar_url: user.avatar_url,
      website: user.website,
      location: user.user_location,
      is_public_profile: user.is_public_profile,
      joined_date: user.created_at,
      profile_completed: user.profile_completed
    }

    res.json({
      profile: serializedProfile
    })

  } catch (error) {
    console.error('Error fetching own profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// GET /api/profile/user/:username - Get public profile by username
router.get('/user/:username', optionalAuthMiddleware, async (req, res) => {
  try {
    const { username } = req.params
    const requestingUserId = req.user?.userId
    
    console.log(`🔍 Profile: Looking for username: ${username}`)
    
    // Get user profile from database
    const profile = await prisma.$queryRaw`
      SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.bio,
        u.avatar_url,
        u.website,
        u.user_location,
        u.is_public_profile,
        u.created_at,
        u.profile_completed
      FROM [user] u
      WHERE u.username = ${username}
        AND u.is_active = 1
    `
    
    if (profile.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = profile[0]
    const isOwnProfile = requestingUserId && Number(user.user_id) === Number(requestingUserId)

    // Check if profile is public or if it's the user's own profile
    if (!user.is_public_profile && !isOwnProfile) {
      return res.status(403).json({ error: 'This profile is private' })
    }

    // Serialize and return basic profile for now
    const serializedProfile = {
      user_id: Number(user.user_id),
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      website: user.website,
      location: user.user_location,
      is_public_profile: user.is_public_profile,
      joined_date: user.created_at,
      profile_completed: user.profile_completed,
      is_own_profile: isOwnProfile
    }

    // Get user's favorite cards if profile is public
    let favoriteCards = []
    if (user.is_public_profile || isOwnProfile) {
      try {
        const favorites = await prisma.$queryRaw`
          SELECT 
            ufc.sort_order,
            uc.user_card_id,
            uc.serial_number,
            uc.grade,
            c.card_id,
            c.card_number,
            c.is_rookie,
            c.is_autograph,
            c.is_relic,
            s.name as series_name,
            set_info.name as set_name,
            set_info.year as set_year,
            COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown Player') as player_name,
            -- Get primary photo
            (SELECT TOP 1 photo_url 
             FROM user_card_photo ucp 
             WHERE ucp.user_card = uc.user_card_id 
             ORDER BY ucp.user_card_photo_id ASC) as primary_photo
          FROM user_favorite_cards ufc
          INNER JOIN user_card uc ON ufc.user_card_id = uc.user_card_id
          INNER JOIN card c ON uc.card = c.card_id
          LEFT JOIN series s ON c.series = s.series_id
          LEFT JOIN [set] set_info ON s.set = set_info.set_id
          LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
          LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
          LEFT JOIN player p ON pt.player = p.player_id
          WHERE ufc.user_id = ${Number(user.user_id)}
          ORDER BY ufc.sort_order ASC
        `

        favoriteCards = favorites.map(card => ({
          sort_order: card.sort_order,
          user_card_id: Number(card.user_card_id),
          card_id: Number(card.card_id),
          card_number: card.card_number,
          serial_number: card.serial_number,
          grade: card.grade ? Number(card.grade) : null,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          series_name: card.series_name,
          set_name: card.set_name,
          set_year: card.set_year,
          player_name: card.player_name,
          primary_photo: card.primary_photo
        }))
      } catch (favoritesError) {
        console.error('Error fetching favorite cards for profile:', favoritesError)
        favoriteCards = [] // Continue without favorites if there's an error
      }
    }

    res.json({
      profile: serializedProfile,
      favorite_cards: favoriteCards,
      stats: {
        total_cards: 0,
        unique_cards: 0,
        unique_sets: 0,
        rookie_cards: 0,
        autograph_cards: 0,
        relic_cards: 0,
        estimated_value: "0.00",
        avg_card_value: "0.00"
      },
      recent_activity: []
    })

  } catch (error) {
    console.error('Error fetching public profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PUT /api/profile/update - Update own profile (authentication required)
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { 
      bio, 
      website, 
      location, 
      is_public_profile 
    } = req.body

    // Validate inputs
    if (bio && bio.length > 500) {
      return res.status(400).json({ error: 'Bio too long (max 500 characters)' })
    }

    if (website && website.length > 255) {
      return res.status(400).json({ error: 'Website URL too long (max 255 characters)' })
    }

    if (location && location.length > 100) {
      return res.status(400).json({ error: 'Location too long (max 100 characters)' })
    }

    // URL validation for website
    if (website && website.trim()) {
      try {
        new URL(website.startsWith('http') ? website : `https://${website}`)
      } catch {
        return res.status(400).json({ error: 'Invalid website URL' })
      }
    }

    // Update profile
    await prisma.$executeRaw`
      UPDATE [user]
      SET bio = ${bio || null},
          website = ${website || null},
          user_location = ${location || null},
          is_public_profile = ${is_public_profile !== undefined ? is_public_profile : true},
          profile_completed = 1,
          updated_at = GETDATE()
      WHERE user_id = ${Number(userId)}
    `

    res.json({ message: 'Profile updated successfully' })

  } catch (error) {
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// GET /api/profile/check-username/:username - Check username availability
router.get('/check-username/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params
    const userId = req.user.userId

    // Validate username format
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ 
        available: false,
        error: 'Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or dashes'
      })
    }

    // Check if username is reserved
    if (isReserved(username)) {
      return res.status(400).json({
        available: false,
        error: 'This username is reserved',
        suggestions: suggestAlternatives(username)
      })
    }

    // Check if username exists (excluding current user)
    const existing = await prisma.$queryRaw`
      SELECT user_id 
      FROM [user] 
      WHERE username = ${username.toLowerCase()}
        AND user_id != ${Number(userId)}
    `

    res.json({
      available: existing.length === 0,
      username: username.toLowerCase()
    })

  } catch (error) {
    console.error('Error checking username:', error)
    res.status(500).json({ error: 'Failed to check username' })
  }
})

// PUT /api/profile/update-username - Update username (authentication required)
router.put('/update-username', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { username } = req.body

    // Validate username
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' })
    }

    const cleanUsername = username.trim().toLowerCase()

    // Validate username format
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({ 
        error: 'Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or dashes'
      })
    }

    // Check if username is reserved
    if (isReserved(cleanUsername)) {
      return res.status(400).json({
        error: 'This username is reserved and cannot be used',
        suggestions: suggestAlternatives(cleanUsername)
      })
    }

    // Check if username is already taken by another user
    const existingUser = await prisma.$queryRaw`
      SELECT user_id 
      FROM [user] 
      WHERE username = ${cleanUsername}
        AND user_id != ${Number(userId)}
        AND is_active = 1
    `

    if (existingUser.length > 0) {
      return res.status(409).json({
        error: 'This username is already taken'
      })
    }

    // Get current username for logging
    const currentUser = await prisma.$queryRaw`
      SELECT username FROM [user] WHERE user_id = ${Number(userId)}
    `

    const oldUsername = currentUser.length > 0 ? currentUser[0].username : null

    // Update username
    await prisma.$executeRaw`
      UPDATE [user]
      SET username = ${cleanUsername},
          updated_at = GETDATE()
      WHERE user_id = ${Number(userId)}
    `

    // Log the username change for audit trail
    console.log(`🔄 Username changed: User ${userId} changed from "${oldUsername}" to "${cleanUsername}"`)

    res.json({ 
      message: 'Username updated successfully',
      username: cleanUsername
    })

  } catch (error) {
    console.error('Error updating username:', error)
    res.status(500).json({ error: 'Failed to update username' })
  }
})

// GET /api/profile/favorite-cards - Get user's favorite cards
router.get('/favorite-cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Get user's favorite cards with full card details
    const favoriteCards = await prisma.$queryRaw`
      SELECT 
        ufc.favorite_id,
        ufc.sort_order,
        uc.user_card_id,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.current_value,
        uc.notes,
        uc.grade,
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        set_info.name as set_name,
        set_info.year as set_year,
        -- Get primary photo
        (SELECT TOP 1 photo_url 
         FROM user_card_photo ucp 
         WHERE ucp.user_card = uc.user_card_id 
         ORDER BY ucp.user_card_photo_id ASC) as primary_photo
      FROM user_favorite_cards ufc
      INNER JOIN user_card uc ON ufc.user_card_id = uc.user_card_id
      INNER JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] set_info ON s.set = set_info.set_id
      WHERE ufc.user_id = ${Number(userId)}
      ORDER BY ufc.sort_order ASC
    `

    // Serialize BigInt fields
    const serializedFavorites = favoriteCards.map(card => ({
      favorite_id: Number(card.favorite_id),
      sort_order: card.sort_order,
      user_card_id: Number(card.user_card_id),
      card_id: Number(card.card_id),
      card_number: card.card_number,
      serial_number: card.serial_number,
      purchase_price: card.purchase_price ? Number(card.purchase_price).toFixed(2) : '0.00',
      estimated_value: card.estimated_value ? Number(card.estimated_value).toFixed(2) : '0.00',
      current_value: card.current_value ? Number(card.current_value).toFixed(2) : '0.00',
      grade: card.grade ? Number(card.grade) : null,
      notes: card.notes,
      is_rookie: card.is_rookie,
      is_autograph: card.is_autograph,
      is_relic: card.is_relic,
      print_run: card.print_run,
      series_name: card.series_name,
      set_name: card.set_name,
      set_year: card.set_year,
      primary_photo: card.primary_photo
    }))

    res.json({
      favorite_cards: serializedFavorites
    })

  } catch (error) {
    console.error('Error fetching favorite cards:', error)
    res.status(500).json({ error: 'Failed to fetch favorite cards' })
  }
})

// GET /api/profile/collection-cards - Get user's collection for favorite selection
router.get('/collection-cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { search, limit = 50, offset = 0 } = req.query

    let whereClause = `WHERE uc.user = ${Number(userId)}`
    if (search) {
      whereClause += ` AND (
        c.card_number LIKE '%${search}%' OR
        s.name LIKE '%${search}%' OR
        set_info.name LIKE '%${search}%' OR
        CONCAT(p.first_name, ' ', p.last_name) LIKE '%${search}%'
      )`
    }

    // Get user's collection cards (excluding already favorited ones)
    const collectionCards = await prisma.$queryRaw`
      SELECT TOP ${Number(limit)}
        uc.user_card_id,
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        s.name as series_name,
        set_info.name as set_name,
        set_info.year as set_year,
        CONCAT(p.first_name, ' ', p.last_name) as player_name,
        -- Get primary photo
        (SELECT TOP 1 photo_url 
         FROM user_card_photo ucp 
         WHERE ucp.user_card = uc.user_card_id 
         ORDER BY ucp.user_card_photo_id ASC) as primary_photo,
        -- Check if already favorited
        CASE WHEN ufc.user_card_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM user_card uc
      INNER JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] set_info ON s.set = set_info.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN user_favorite_cards ufc ON uc.user_card_id = ufc.user_card_id AND ufc.user_id = ${Number(userId)}
      ${whereClause}
      ORDER BY 
        CASE WHEN ufc.user_card_id IS NOT NULL THEN 1 ELSE 0 END ASC, -- Non-favorites first
        c.card_id ASC
      OFFSET ${Number(offset)} ROWS
    `

    // Serialize BigInt fields
    const serializedCards = collectionCards.map(card => ({
      user_card_id: Number(card.user_card_id),
      card_id: Number(card.card_id),
      card_number: card.card_number,
      is_rookie: card.is_rookie,
      is_autograph: card.is_autograph,
      is_relic: card.is_relic,
      series_name: card.series_name,
      set_name: card.set_name,
      set_year: card.set_year,
      player_name: card.player_name,
      primary_photo: card.primary_photo,
      is_favorite: card.is_favorite === 1
    }))

    res.json({
      cards: serializedCards,
      has_more: collectionCards.length === Number(limit)
    })

  } catch (error) {
    console.error('Error fetching collection cards:', error)
    res.status(500).json({ error: 'Failed to fetch collection cards' })
  }
})

// POST /api/profile/favorite-cards - Add card to favorites
router.post('/favorite-cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { user_card_id, sort_order } = req.body

    if (!user_card_id || !sort_order) {
      return res.status(400).json({ error: 'user_card_id and sort_order are required' })
    }

    // Validate sort_order
    if (sort_order < 1 || sort_order > 5) {
      return res.status(400).json({ error: 'sort_order must be between 1 and 5' })
    }

    // Check if user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id FROM user_card 
      WHERE user_card_id = ${Number(user_card_id)} AND user = ${Number(userId)}
    `

    if (userCard.length === 0) {
      return res.status(404).json({ error: 'Card not found in your collection' })
    }

    // Check current favorite count
    const currentFavorites = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM user_favorite_cards WHERE user_id = ${Number(userId)}
    `

    if (currentFavorites[0].count >= 5) {
      return res.status(400).json({ error: 'You can only have 5 favorite cards maximum' })
    }

    // Check if sort_order is already taken
    const existingPosition = await prisma.$queryRaw`
      SELECT favorite_id FROM user_favorite_cards 
      WHERE user_id = ${Number(userId)} AND sort_order = ${sort_order}
    `

    if (existingPosition.length > 0) {
      return res.status(400).json({ error: `Position ${sort_order} is already taken` })
    }

    // Add to favorites
    await prisma.$executeRaw`
      INSERT INTO user_favorite_cards (user_id, user_card_id, sort_order, created_at, updated_at)
      VALUES (${Number(userId)}, ${Number(user_card_id)}, ${sort_order}, GETDATE(), GETDATE())
    `

    res.json({ message: 'Card added to favorites successfully' })

  } catch (error) {
    console.error('Error adding favorite card:', error)
    if (error.message.includes('UNIQUE KEY constraint')) {
      return res.status(409).json({ error: 'This card is already in your favorites' })
    }
    res.status(500).json({ error: 'Failed to add favorite card' })
  }
})

// DELETE /api/profile/favorite-cards/:favoriteId - Remove card from favorites
router.delete('/favorite-cards/:favoriteId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { favoriteId } = req.params

    // Verify the favorite belongs to this user
    const favorite = await prisma.$queryRaw`
      SELECT favorite_id FROM user_favorite_cards 
      WHERE favorite_id = ${Number(favoriteId)} AND user_id = ${Number(userId)}
    `

    if (favorite.length === 0) {
      return res.status(404).json({ error: 'Favorite card not found' })
    }

    // Remove from favorites
    await prisma.$executeRaw`
      DELETE FROM user_favorite_cards 
      WHERE favorite_id = ${Number(favoriteId)} AND user_id = ${Number(userId)}
    `

    res.json({ message: 'Card removed from favorites successfully' })

  } catch (error) {
    console.error('Error removing favorite card:', error)
    res.status(500).json({ error: 'Failed to remove favorite card' })
  }
})

// PUT /api/profile/favorite-cards/reorder - Reorder favorite cards
router.put('/favorite-cards/reorder', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { favorites } = req.body // Array of { favorite_id, sort_order }

    if (!Array.isArray(favorites)) {
      return res.status(400).json({ error: 'favorites must be an array' })
    }

    // Validate favorites
    const validSortOrders = [1, 2, 3, 4, 5]
    for (const fav of favorites) {
      if (!fav.favorite_id || !validSortOrders.includes(fav.sort_order)) {
        return res.status(400).json({ error: 'Invalid favorite_id or sort_order' })
      }
    }

    // Update each favorite's sort order
    for (const favorite of favorites) {
      await prisma.$executeRaw`
        UPDATE user_favorite_cards 
        SET sort_order = ${favorite.sort_order}, updated_at = GETDATE()
        WHERE favorite_id = ${Number(favorite.favorite_id)} AND user_id = ${Number(userId)}
      `
    }

    res.json({ message: 'Favorite cards reordered successfully' })

  } catch (error) {
    console.error('Error reordering favorite cards:', error)
    res.status(500).json({ error: 'Failed to reorder favorite cards' })
  }
})

module.exports = router