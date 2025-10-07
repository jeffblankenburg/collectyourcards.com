const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error'] }) // Only log errors, not queries
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth')
const { sanitizeInput, sanitizeParams } = require('../middleware/inputSanitization')
const { isReserved, suggestAlternatives } = require('../config/reserved-usernames')
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')

// Configure multer for memory storage (profile pictures)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for profile pictures
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
const CONTAINER_NAME = 'user-profiles'

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
    const requestingUserId = req.user?.id || req.user?.userId  // Support both id and userId
    
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
          SELECT TOP 5
            uc.user_card_id,
            uc.serial_number,
            uc.estimated_value,
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
            -- Create series slug for navigation
            LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', '-'), '''', ''), '/', '-')) as series_slug,
            -- Create set slug for navigation
            LOWER(REPLACE(REPLACE(REPLACE(set_info.name, ' ', '-'), '''', ''), '/', '-')) as set_slug,
            -- Get player names (concatenated if multiple)
            STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_name,
            -- Get team info from the first team association
            (SELECT TOP 1 t.name FROM card_player_team cpt2 
             INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
             INNER JOIN team t ON pt2.team = t.team_Id
             WHERE cpt2.card = c.card_id) as team_name,
            (SELECT TOP 1 t.abbreviation FROM card_player_team cpt2 
             INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
             INNER JOIN team t ON pt2.team = t.team_Id
             WHERE cpt2.card = c.card_id) as team_abbreviation,
            (SELECT TOP 1 t.primary_color FROM card_player_team cpt2 
             INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
             INNER JOIN team t ON pt2.team = t.team_Id
             WHERE cpt2.card = c.card_id) as team_primary_color,
            (SELECT TOP 1 t.secondary_color FROM card_player_team cpt2 
             INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
             INNER JOIN team t ON pt2.team = t.team_Id
             WHERE cpt2.card = c.card_id) as team_secondary_color,
            -- Get primary photo from user_card_photo table
            (SELECT TOP 1 photo_url 
             FROM user_card_photo ucp 
             WHERE ucp.user_card = uc.user_card_id 
             ORDER BY ucp.user_card_photo_id ASC) as primary_photo
          FROM user_card uc
          INNER JOIN card c ON uc.card = c.card_id
          LEFT JOIN series s ON c.series = s.series_id
          LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
          LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
          LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
          LEFT JOIN player p ON pt.player = p.player_id
          WHERE uc.[user] = ${Number(user.user_id)}
            AND uc.is_special = 1
          GROUP BY 
            uc.user_card_id, uc.serial_number, uc.estimated_value, uc.grade,
            c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
            s.name, set_info.name, set_info.year
          ORDER BY uc.user_card_id DESC
        `

        favoriteCards = favorites.map((card, index) => ({
          sort_order: index + 1,
          user_card_id: Number(card.user_card_id),
          card_id: Number(card.card_id),
          card_number: card.card_number,
          serial_number: card.serial_number,
          grade: card.grade ? Number(card.grade) : null,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          print_run: card.print_run ? Number(card.print_run) : null,
          series_name: card.series_name,
          set_name: card.set_name,
          set_year: card.set_year,
          series_slug: card.series_slug,
          set_slug: card.set_slug,
          player_name: card.player_name || 'Unknown Player',
          team_name: card.team_name,
          team_abbreviation: card.team_abbreviation,
          team_primary_color: card.team_primary_color,
          team_secondary_color: card.team_secondary_color,
          estimated_value: card.estimated_value ? Number(card.estimated_value).toFixed(2) : '0.00',
          primary_photo: card.primary_photo
        }))
      } catch (favoritesError) {
        console.error('Error fetching favorite cards for profile:', favoritesError)
        favoriteCards = [] // Continue without favorites if there's an error
      }
    }

    // Get user's collection statistics
    let stats = {
      total_cards: 0,
      unique_cards: 0,
      unique_sets: 0,
      rookie_cards: 0,
      autograph_cards: 0,
      relic_cards: 0,
      estimated_value: "0.00",
      avg_card_value: "0.00"
    }

    if (user.is_public_profile || isOwnProfile) {
      try {
        const statsResult = await prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_cards,
            COUNT(DISTINCT c.card_id) as unique_cards,
            COUNT(DISTINCT set_info.set_id) as unique_sets,
            SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_cards,
            SUM(CASE WHEN c.is_autograph = 1 THEN 1 ELSE 0 END) as autograph_cards,
            SUM(CASE WHEN c.is_relic = 1 THEN 1 ELSE 0 END) as relic_cards,
            COALESCE(SUM(CAST(uc.estimated_value as DECIMAL(10,2))), 0) as total_estimated_value,
            CASE WHEN COUNT(*) > 0 
                 THEN COALESCE(SUM(CAST(uc.estimated_value as DECIMAL(10,2))) / COUNT(*), 0) 
                 ELSE 0 
            END as avg_card_value
          FROM user_card uc
          INNER JOIN card c ON uc.card = c.card_id
          LEFT JOIN series s ON c.series = s.series_id
          LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
          WHERE uc.[user] = ${Number(user.user_id)}
        `

        if (statsResult.length > 0) {
          const statsData = statsResult[0]
          stats = {
            total_cards: Number(statsData.total_cards) || 0,
            unique_cards: Number(statsData.unique_cards) || 0,
            unique_sets: Number(statsData.unique_sets) || 0,
            rookie_cards: Number(statsData.rookie_cards) || 0,
            autograph_cards: Number(statsData.autograph_cards) || 0,
            relic_cards: Number(statsData.relic_cards) || 0,
            estimated_value: Number(statsData.total_estimated_value).toFixed(2) || "0.00",
            avg_card_value: Number(statsData.avg_card_value).toFixed(2) || "0.00"
          }
        }
      } catch (statsError) {
        console.error('Error fetching collection stats for profile:', statsError)
        // Continue with default stats if there's an error
      }
    }

    // Get user's recent activity (comments)
    let recentActivity = []
    if (user.is_public_profile || isOwnProfile) {
      try {
        const activities = await prisma.$queryRaw`
          SELECT TOP 5
            c.comment_id,
            c.comment_text,
            c.comment_type,
            c.created_at,
            CASE 
              WHEN c.comment_type = 'series' THEN s.name
              WHEN c.comment_type = 'set' THEN set_table.name
              WHEN c.comment_type = 'card' THEN CONCAT(
                COALESCE(card_series.name, 'Unknown Series'), 
                CASE WHEN card_info.card_number IS NOT NULL 
                     THEN ' #' + CAST(card_info.card_number AS NVARCHAR) 
                     ELSE '' 
                END
              )
              ELSE 'Unknown'
            END as item_name
          FROM universal_comments c
          -- Join for series comments
          LEFT JOIN series s ON c.comment_type = 'series' AND c.item_id = s.series_id
          -- Join for set comments
          LEFT JOIN [set] set_table ON c.comment_type = 'set' AND c.item_id = set_table.set_id
          -- Join for card comments
          LEFT JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
          LEFT JOIN series card_series ON card_info.series = card_series.series_id
          WHERE c.user_id = ${Number(user.user_id)}
            AND c.is_deleted = 0
            AND c.comment_status = 'visible'
          ORDER BY c.created_at DESC
        `

        recentActivity = activities.map(activity => ({
          comment_id: Number(activity.comment_id),
          comment_text: activity.comment_text.length > 150 
            ? activity.comment_text.substring(0, 150) + '...' 
            : activity.comment_text,
          comment_type: activity.comment_type,
          item_name: activity.item_name,
          created_at: activity.created_at
        }))
      } catch (activityError) {
        console.error('Error fetching recent activity for profile:', activityError)
        recentActivity = []
      }
    }

    // Get user's achievement data
    let achievementData = {
      total_points: 0,
      total_achievements: 0,
      recent_achievements: []
    }

    if (user.is_public_profile || isOwnProfile) {
      try {
        // Get achievement stats
        const achievementStats = await prisma.$queryRaw`
          SELECT 
            total_points,
            total_achievements,
            common_achievements,
            uncommon_achievements,
            rare_achievements,
            epic_achievements,
            legendary_achievements,
            mythic_achievements
          FROM user_achievement_stats
          WHERE user_id = ${Number(user.user_id)}
        `

        if (achievementStats.length > 0) {
          const stats = achievementStats[0]
          achievementData.total_points = Number(stats.total_points) || 0
          achievementData.total_achievements = Number(stats.total_achievements) || 0
          achievementData.tier_breakdown = {
            common: Number(stats.common_achievements) || 0,
            uncommon: Number(stats.uncommon_achievements) || 0,
            rare: Number(stats.rare_achievements) || 0,
            epic: Number(stats.epic_achievements) || 0,
            legendary: Number(stats.legendary_achievements) || 0,
            mythic: Number(stats.mythic_achievements) || 0
          }
        }

        // Get recent achievements
        const recentAchievements = await prisma.$queryRaw`
          SELECT TOP 5
            a.achievement_id,
            a.name,
            a.description,
            a.points,
            a.tier,
            a.icon_url,
            ua.completed_at
          FROM user_achievements ua
          INNER JOIN achievements a ON ua.achievement_id = a.achievement_id
          WHERE ua.user_id = ${Number(user.user_id)}
            AND ua.is_completed = 1
          ORDER BY ua.completed_at DESC
        `

        achievementData.recent_achievements = recentAchievements.map(ach => ({
          achievement_id: Number(ach.achievement_id),
          name: ach.name,
          description: ach.description,
          points: Number(ach.points),
          tier: ach.tier,
          icon_url: ach.icon_url,
          completed_at: ach.completed_at
        }))

      } catch (achievementError) {
        console.error('Error fetching achievement data for profile:', achievementError)
        // Continue with default achievement data if there's an error
      }
    }

    res.json({
      profile: serializedProfile,
      favoriteCards: favoriteCards,  // Use camelCase for consistency
      stats: stats,
      recentActivity: recentActivity,  // Use camelCase for consistency
      achievements: achievementData
    })

  } catch (error) {
    console.error('Error fetching public profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PUT /api/profile - Update own profile (authentication required)
router.put('/', authMiddleware, async (req, res) => {
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

    // Sanitize bio input to prevent XSS
    const sanitizedBio = bio ? bio.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+>/g, '') : null

    // Update profile
    await prisma.$executeRaw`
      UPDATE [user]
      SET bio = ${sanitizedBio},
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

// PUT /api/profile/update - Alias for backwards compatibility
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

// GET /api/profile/check-username/:username - Check username availability (no auth required)
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params

    // Validate username format
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({
        available: false,
        error: 'Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or dashes'
      })
    }

    // Check if username is reserved
    if (isReserved(username)) {
      return res.json({
        available: false,
        reserved: true,
        suggestions: suggestAlternatives(username)
      })
    }

    // Check if username exists
    const existing = await prisma.$queryRaw`
      SELECT user_id
      FROM [user]
      WHERE username = ${username.toLowerCase()}
    `

    res.json({
      available: existing.length === 0,
      username: username.toLowerCase(),
      suggestions: existing.length > 0 ? suggestAlternatives(username) : undefined
    })

  } catch (error) {
    console.error('Error checking username:', error)
    res.status(500).json({ error: 'Failed to check username' })
  }
})

// PUT /api/profile/username - Update username (authentication required)
router.put('/username', authMiddleware, async (req, res) => {
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
      return res.status(409).json({
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

// PUT /api/profile/update-username - Update username (authentication required) - Alias for backwards compatibility
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

// POST /api/profile/picture - Upload profile picture
router.post('/picture', authMiddleware, upload.single('picture'), async (req, res) => {
  try {
    const userId = req.user.userId
    const file = req.file

    if (!file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please select a profile picture to upload'
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

    // Get current profile to check for existing avatar
    const currentProfile = await prisma.$queryRaw`
      SELECT avatar_url FROM [user] WHERE user_id = ${Number(userId)}
    `

    // Delete old profile picture if it exists
    if (currentProfile.length > 0 && currentProfile[0].avatar_url) {
      try {
        const oldAvatarUrl = currentProfile[0].avatar_url
        // Extract blob name from URL (assuming it follows our naming convention)
        if (oldAvatarUrl.includes(CONTAINER_NAME)) {
          const urlParts = oldAvatarUrl.split('/')
          const oldBlobName = urlParts[urlParts.length - 1]
          if (oldBlobName.includes(`${userId}_`)) {
            const oldBlockBlobClient = containerClient.getBlockBlobClient(oldBlobName)
            await oldBlockBlobClient.deleteIfExists()
          }
        }
      } catch (deleteError) {
        console.error('Error deleting old profile picture:', deleteError)
        // Continue with upload even if deletion fails
      }
    }

    // Generate unique blob name: userId_timestamp.extension
    const timestamp = Date.now()
    const fileExtension = file.originalname.split('.').pop()
    const blobName = `${userId}_${timestamp}.${fileExtension}`

    // Upload to Azure Blob Storage
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Set content type and cache control
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      },
      metadata: {
        userId: userId.toString(),
        uploadedAt: new Date().toISOString(),
        originalName: file.originalname
      }
    }

    // Upload the file
    await blockBlobClient.uploadData(file.buffer, uploadOptions)

    // Get the public URL
    const avatarUrl = blockBlobClient.url

    // Update user record with new avatar URL
    await prisma.$executeRaw`
      UPDATE [user] 
      SET avatar_url = ${avatarUrl}, 
          updated_at = GETDATE(),
          profile_completed = CASE WHEN profile_completed = 0 THEN 1 ELSE profile_completed END
      WHERE user_id = ${Number(userId)}
    `

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      avatar_url: avatarUrl
    })

  } catch (error) {
    console.error('Error uploading profile picture:', error)
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Profile picture must be smaller than 2MB'
      })
    }

    if (error.message.includes('Only JPEG, PNG, and WebP')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload profile picture. Please try again.'
    })
  }
})

// DELETE /api/profile/picture - Delete profile picture
router.delete('/picture', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Get current profile picture URL
    const currentProfile = await prisma.$queryRaw`
      SELECT avatar_url FROM [user] WHERE user_id = ${Number(userId)}
    `

    if (currentProfile.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      })
    }

    const avatarUrl = currentProfile[0].avatar_url

    if (!avatarUrl) {
      return res.status(400).json({
        error: 'No profile picture',
        message: 'No profile picture to delete'
      })
    }

    // Delete from Azure Blob Storage
    if (AZURE_STORAGE_CONNECTION_STRING && avatarUrl.includes(CONTAINER_NAME)) {
      try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
        const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)
        
        // Extract blob name from URL
        const urlParts = avatarUrl.split('/')
        const blobName = urlParts[urlParts.length - 1]
        if (blobName.includes(`${userId}_`)) {
          const blockBlobClient = containerClient.getBlockBlobClient(blobName)
          await blockBlobClient.deleteIfExists()
        }
      } catch (blobError) {
        console.error('Failed to delete blob from storage:', blobError)
        // Continue anyway - database deletion is more important
      }
    }

    // Update user record to remove avatar URL
    await prisma.$executeRaw`
      UPDATE [user] 
      SET avatar_url = NULL, 
          updated_at = GETDATE()
      WHERE user_id = ${Number(userId)}
    `

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting profile picture:', error)
    res.status(500).json({
      error: 'Delete failed',
      message: 'Failed to delete profile picture. Please try again.'
    })
  }
})

// GET /api/profile/favorite-cards - Get user's favorite cards (marked as special)
router.get('/favorite-cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Get user's favorite cards (is_special = 1) with full card details including players
    const favoriteCards = await prisma.$queryRaw`
      SELECT TOP 5
        uc.user_card_id,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.current_value,
        uc.notes,
        uc.grade,
        ga.abbreviation as grading_agency_abbr,
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        set_info.name as set_name,
        -- Get primary photo from user_card_photo table
        (SELECT TOP 1 photo_url 
         FROM user_card_photo ucp 
         WHERE ucp.user_card = uc.user_card_id 
         ORDER BY ucp.user_card_photo_id ASC) as primary_photo,
        -- Get all players for this card
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_names
      FROM user_card uc
      INNER JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE uc.[user] = ${Number(userId)}
        AND uc.is_special = 1
      GROUP BY 
        uc.user_card_id, uc.serial_number, uc.purchase_price, uc.estimated_value, 
        uc.current_value, uc.notes, uc.grade, ga.abbreviation,
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
        s.name, set_info.name
      ORDER BY uc.user_card_id DESC
    `

    // Serialize BigInt fields and add position numbers
    const serializedFavorites = favoriteCards.map((card, index) => ({
      sort_order: index + 1,
      user_card_id: Number(card.user_card_id),
      card_id: Number(card.card_id),
      card_number: card.card_number,
      serial_number: card.serial_number,
      purchase_price: card.purchase_price ? Number(card.purchase_price).toFixed(2) : '0.00',
      estimated_value: card.estimated_value ? Number(card.estimated_value).toFixed(2) : '0.00',
      current_value: card.current_value ? Number(card.current_value).toFixed(2) : '0.00',
      grade: card.grade ? Number(card.grade) : null,
      grading_agency_abbr: card.grading_agency_abbr,
      notes: card.notes,
      is_rookie: card.is_rookie,
      is_autograph: card.is_autograph,
      is_relic: card.is_relic,
      print_run: card.print_run ? Number(card.print_run) : null,
      series_name: card.series_name,
      set_name: card.set_name,
      player_names: card.player_names, // Comma-separated player names
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

    let whereClause = `WHERE uc.[user] = ${Number(userId)}`
    if (search) {
      whereClause += ` AND (
        c.card_number LIKE '%${search}%' OR
        s.name LIKE '%${search}%' OR
        set_info.name LIKE '%${search}%' OR
        CONCAT(p.first_name, ' ', p.last_name) LIKE '%${search}%'
      )`
    }

    // Get user's collection cards with special status
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
        -- Get primary photo from user_card_photo table
        (SELECT TOP 1 photo_url 
         FROM user_card_photo ucp 
         WHERE ucp.user_card = uc.user_card_id 
         ORDER BY ucp.user_card_photo_id ASC) as primary_photo,
        -- Check if marked as special/favorite
        uc.is_special as is_favorite
      FROM user_card uc
      INNER JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      ${whereClause}
      ORDER BY 
        CASE WHEN uc.is_special = 1 THEN 0 ELSE 1 END ASC, -- Favorites first
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

// POST /api/profile/favorite-cards - Set favorite cards (bulk update)
router.post('/favorite-cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { favorite_card_ids } = req.body

    if (!Array.isArray(favorite_card_ids)) {
      return res.status(400).json({ error: 'favorite_card_ids must be an array' })
    }

    if (favorite_card_ids.length > 5) {
      return res.status(400).json({ error: 'You can only have 5 favorite cards maximum' })
    }

    // First, unmark all current favorites
    await prisma.$executeRaw`
      UPDATE user_card
      SET is_special = 0
      WHERE [user] = ${Number(userId)}
    `

    // Then mark the new favorites
    if (favorite_card_ids.length > 0) {
      for (const userCardId of favorite_card_ids) {
        // Verify user owns this card
        const userCard = await prisma.$queryRaw`
          SELECT user_card_id
          FROM user_card
          WHERE user_card_id = ${Number(userCardId)} AND [user] = ${Number(userId)}
        `

        if (userCard.length > 0) {
          await prisma.$executeRaw`
            UPDATE user_card
            SET is_special = 1
            WHERE user_card_id = ${Number(userCardId)} AND [user] = ${Number(userId)}
          `
        }
      }
    }

    res.json({
      message: 'Favorite cards updated successfully'
    })

  } catch (error) {
    console.error('Error setting favorite cards:', error)
    res.status(500).json({ error: 'Failed to set favorite cards' })
  }
})

// POST /api/profile/favorite-cards/:userCardId - Toggle card as favorite
router.post('/favorite-cards/:userCardId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { userCardId } = req.params

    // Check if user owns this card
    const userCard = await prisma.$queryRaw`
      SELECT user_card_id, is_special 
      FROM user_card 
      WHERE user_card_id = ${Number(userCardId)} AND [user] = ${Number(userId)}
    `

    if (userCard.length === 0) {
      return res.status(404).json({ error: 'Card not found in your collection' })
    }

    const currentIsSpecial = userCard[0].is_special

    // If trying to mark as favorite, check current count
    if (!currentIsSpecial) {
      const currentFavorites = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM user_card 
        WHERE [user] = ${Number(userId)} AND is_special = 1
      `

      if (currentFavorites[0].count >= 5) {
        return res.status(400).json({ error: 'You can only have 5 favorite cards maximum' })
      }
    }

    // Toggle is_special status
    await prisma.$executeRaw`
      UPDATE user_card 
      SET is_special = ${currentIsSpecial ? 0 : 1}
      WHERE user_card_id = ${Number(userCardId)} AND [user] = ${Number(userId)}
    `

    res.json({ 
      message: currentIsSpecial ? 'Card removed from favorites' : 'Card added to favorites',
      is_favorite: !currentIsSpecial
    })

  } catch (error) {
    console.error('Error toggling favorite card:', error)
    res.status(500).json({ error: 'Failed to update favorite status' })
  }
})

// PUT /api/profile/change-password - Change user password
router.put('/change-password', authMiddleware, sanitizeInput, async (req, res) => {
  try {
    const userId = req.user.userId
    const { currentPassword, newPassword } = req.sanitized

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Current password and new password are required'
      })
    }

    // Get current user with password hash
    const user = await prisma.$queryRaw`
      SELECT user_id, password_hash 
      FROM [user] 
      WHERE user_id = ${Number(userId)} AND is_active = 1
    `

    if (user.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    const bcrypt = require('bcrypt')

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user[0].password_hash)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'The current password you entered is incorrect'
      })
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Invalid new password',
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      })
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user[0].password_hash)
    if (isSamePassword) {
      return res.status(400).json({
        error: 'Invalid new password',
        message: 'New password must be different from current password'
      })
    }

    // Hash new password
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await prisma.$executeRaw`
      UPDATE [user]
      SET password_hash = ${hashedNewPassword},
          updated_at = GETDATE()
      WHERE user_id = ${Number(userId)}
    `

    // Log password change for security audit
    console.log(`🔐 Password changed: User ${userId} changed password at ${new Date().toISOString()}`)

    res.json({ 
      message: 'Password changed successfully'
    })

  } catch (error) {
    console.error('Error changing password:', error)
    res.status(500).json({ 
      error: 'Failed to change password',
      message: 'An error occurred while updating your password'
    })
  }
})


module.exports = router