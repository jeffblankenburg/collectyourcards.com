const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient({ log: ['error'] })

// =============================================
// POST /api/follow/:userId - Follow a user
// =============================================
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerUserId = req.user?.userId
    const followingUserId = parseInt(req.params.userId)

    if (!followerUserId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to follow users'
      })
    }

    // Validate following user ID
    if (isNaN(followingUserId) || followingUserId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    // Can't follow yourself
    if (followerUserId === followingUserId) {
      return res.status(400).json({
        error: 'Invalid action',
        message: 'You cannot follow yourself'
      })
    }

    // Check if user exists
    const userExists = await prisma.$queryRaw`
      SELECT user_id FROM [user] WHERE user_id = ${BigInt(followingUserId)}
    `

    if (userExists.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user you are trying to follow does not exist'
      })
    }

    // Check if already following
    const existingFollow = await prisma.$queryRaw`
      SELECT user_follow_id FROM user_follow
      WHERE follower_user_id = ${BigInt(followerUserId)}
      AND following_user_id = ${BigInt(followingUserId)}
    `

    if (existingFollow.length > 0) {
      return res.status(409).json({
        error: 'Already following',
        message: 'You are already following this user'
      })
    }

    // Create follow relationship
    await prisma.$queryRaw`
      INSERT INTO user_follow (follower_user_id, following_user_id, created)
      VALUES (${BigInt(followerUserId)}, ${BigInt(followingUserId)}, GETDATE())
    `

    // Check if this creates a friendship (reciprocal follow)
    const isReciprocal = await prisma.$queryRaw`
      SELECT user_follow_id FROM user_follow
      WHERE follower_user_id = ${BigInt(followingUserId)}
      AND following_user_id = ${BigInt(followerUserId)}
    `

    const areFriends = isReciprocal.length > 0

    res.status(201).json({
      message: areFriends ? 'You are now friends!' : 'Successfully followed user',
      is_following: true,
      are_friends: areFriends
    })

  } catch (error) {
    console.error('Error following user:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to follow user'
    })
  }
})

// =============================================
// DELETE /api/follow/:userId - Unfollow a user
// =============================================
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerUserId = req.user?.userId
    const followingUserId = parseInt(req.params.userId)

    if (!followerUserId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to unfollow users'
      })
    }

    // Validate following user ID
    if (isNaN(followingUserId) || followingUserId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    // Delete follow relationship
    const result = await prisma.$queryRaw`
      DELETE FROM user_follow
      WHERE follower_user_id = ${BigInt(followerUserId)}
      AND following_user_id = ${BigInt(followingUserId)}
    `

    res.json({
      message: 'Successfully unfollowed user',
      is_following: false,
      are_friends: false
    })

  } catch (error) {
    console.error('Error unfollowing user:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to unfollow user'
    })
  }
})

// =============================================
// GET /api/follow/status/:userId - Get follow status
// =============================================
router.get('/status/:userId', optionalAuthMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const targetUserId = parseInt(req.params.userId)

    if (!currentUserId) {
      // Not authenticated - return default status
      return res.json({
        is_following: false,
        is_followed_by: false,
        are_friends: false,
        can_follow: false
      })
    }

    // Validate target user ID
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    // Can't check status with yourself
    if (currentUserId === targetUserId) {
      return res.json({
        is_following: false,
        is_followed_by: false,
        are_friends: false,
        can_follow: false,
        is_own_profile: true
      })
    }

    // Check if current user follows target user
    const isFollowing = await prisma.$queryRaw`
      SELECT user_follow_id FROM user_follow
      WHERE follower_user_id = ${BigInt(currentUserId)}
      AND following_user_id = ${BigInt(targetUserId)}
    `

    // Check if target user follows current user
    const isFollowedBy = await prisma.$queryRaw`
      SELECT user_follow_id FROM user_follow
      WHERE follower_user_id = ${BigInt(targetUserId)}
      AND following_user_id = ${BigInt(currentUserId)}
    `

    const following = isFollowing.length > 0
    const followedBy = isFollowedBy.length > 0
    const friends = following && followedBy

    res.json({
      is_following: following,
      is_followed_by: followedBy,
      are_friends: friends,
      can_follow: true
    })

  } catch (error) {
    console.error('Error getting follow status:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get follow status'
    })
  }
})

// =============================================
// GET /api/follow/stats/:userId - Get follow stats
// =============================================
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId)

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    // Get followers count
    const followersResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM user_follow
      WHERE following_user_id = ${BigInt(userId)}
    `

    // Get following count
    const followingResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM user_follow
      WHERE follower_user_id = ${BigInt(userId)}
    `

    // Get friends count (reciprocal follows)
    const friendsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM user_follow uf1
      INNER JOIN user_follow uf2
        ON uf1.follower_user_id = uf2.following_user_id
        AND uf1.following_user_id = uf2.follower_user_id
      WHERE uf1.follower_user_id = ${BigInt(userId)}
    `

    res.json({
      followers: Number(followersResult[0].count),
      following: Number(followingResult[0].count),
      friends: Number(friendsResult[0].count)
    })

  } catch (error) {
    console.error('Error getting follow stats:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get follow stats'
    })
  }
})

// =============================================
// GET /api/follow/followers/:userId - Get user's followers
// =============================================
router.get('/followers/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId)
    const { limit = 50, offset = 0 } = req.query

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    const limitNum = Math.min(parseInt(limit) || 50, 100)
    const offsetNum = parseInt(offset) || 0

    const followers = await prisma.$queryRaw`
      SELECT
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        uf.created as followed_at
      FROM user_follow uf
      JOIN [user] u ON uf.follower_user_id = u.user_id
      WHERE uf.following_user_id = ${BigInt(userId)}
      ORDER BY uf.created DESC
      OFFSET ${offsetNum} ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `

    // Serialize BigInt values
    const serializedFollowers = followers.map(f => ({
      user_id: Number(f.user_id),
      username: f.username,
      first_name: f.first_name,
      last_name: f.last_name,
      followed_at: f.followed_at
    }))

    res.json({
      followers: serializedFollowers,
      count: serializedFollowers.length
    })

  } catch (error) {
    console.error('Error getting followers:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get followers'
    })
  }
})

// =============================================
// GET /api/follow/following/:userId - Get users this user follows
// =============================================
router.get('/following/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId)
    const { limit = 50, offset = 0 } = req.query

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'The user ID must be a valid number'
      })
    }

    const limitNum = Math.min(parseInt(limit) || 50, 100)
    const offsetNum = parseInt(offset) || 0

    const following = await prisma.$queryRaw`
      SELECT
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        uf.created as followed_at
      FROM user_follow uf
      JOIN [user] u ON uf.following_user_id = u.user_id
      WHERE uf.follower_user_id = ${BigInt(userId)}
      ORDER BY uf.created DESC
      OFFSET ${offsetNum} ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `

    // Serialize BigInt values
    const serializedFollowing = following.map(f => ({
      user_id: Number(f.user_id),
      username: f.username,
      first_name: f.first_name,
      last_name: f.last_name,
      followed_at: f.followed_at
    }))

    res.json({
      following: serializedFollowing,
      count: serializedFollowing.length
    })

  } catch (error) {
    console.error('Error getting following:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get following list'
    })
  }
})

module.exports = router
