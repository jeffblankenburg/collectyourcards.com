const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// GET /api/admin/analytics/users - User metrics
router.get('/users', async (req, res) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const lastMonthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    
    // Total users
    const totalUsers = await prisma.user.count()
    
    // Active today (users with sessions today)
    const activeToday = await prisma.userSession.groupBy({
      by: ['user_id'],
      where: {
        last_activity: {
          gte: todayStart
        }
      }
    })
    
    // New users this week
    const newThisWeek = await prisma.user.count({
      where: {
        created: {
          gte: weekAgo
        }
      }
    })
    
    // New users this month
    const newThisMonth = await prisma.user.count({
      where: {
        created: {
          gte: monthAgo
        }
      }
    })
    
    // Growth rate (this month vs last month)
    const lastMonthUsers = await prisma.user.count({
      where: {
        created: {
          gte: lastMonthStart,
          lt: monthAgo
        }
      }
    })
    
    const growthRate = lastMonthUsers > 0 
      ? Math.round(((newThisMonth - lastMonthUsers) / lastMonthUsers) * 100)
      : 0
    
    res.json({
      totalUsers,
      activeToday: activeToday.length,
      newThisWeek,
      newThisMonth,
      growthRate
    })
    
  } catch (error) {
    console.error('Error fetching user metrics:', error)
    res.status(500).json({
      error: 'Failed to fetch user metrics',
      message: error.message
    })
  }
})

// GET /api/admin/analytics/collections - Collection metrics
router.get('/collections', async (req, res) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
    
    // Total cards collected
    const totalCardsCollected = await prisma.userCard.count()
    
    // Unique collectors
    const uniqueCollectors = await prisma.userCard.groupBy({
      by: ['user_id']
    })
    
    // Average cards per user
    const avgCardsPerUser = uniqueCollectors.length > 0
      ? Math.round(totalCardsCollected / uniqueCollectors.length)
      : 0
    
    // Recent additions (today)
    const recentAdditions = await prisma.userCard.count({
      where: {
        added_date: {
          gte: todayStart
        }
      }
    })
    
    // Most popular set (by number of collected cards)
    const popularSets = await prisma.$queryRaw`
      SELECT TOP 1 s.name, COUNT(*) as card_count
      FROM UserCard uc
      JOIN card c ON uc.card_id = c.card_id
      JOIN series sr ON c.series = sr.series_id
      JOIN [set] s ON sr.[set] = s.set_id
      GROUP BY s.set_id, s.name
      ORDER BY card_count DESC
    `
    
    const mostPopularSet = popularSets && popularSets[0] ? popularSets[0].name : ''
    
    res.json({
      totalCardsCollected,
      uniqueCollectors: uniqueCollectors.length,
      avgCardsPerUser,
      mostPopularSet,
      recentAdditions
    })
    
  } catch (error) {
    console.error('Error fetching collection metrics:', error)
    res.status(500).json({
      error: 'Failed to fetch collection metrics',
      message: error.message
    })
  }
})

// GET /api/admin/analytics/recent-activity - Recent activity feed
router.get('/recent-activity', async (req, res) => {
  try {
    const activities = []
    
    // Get recent user registrations
    const recentUsers = await prisma.user.findMany({
      select: {
        username: true,
        created: true
      },
      orderBy: {
        created: 'desc'
      },
      take: 5
    })
    
    recentUsers.forEach(user => {
      activities.push({
        icon: 'user-plus',
        description: `New user registered: ${user.username}`,
        timestamp: user.created
      })
    })
    
    // Get recent card additions
    const recentCards = await prisma.userCard.findMany({
      select: {
        added_date: true,
        user: {
          select: {
            username: true
          }
        },
        card: {
          select: {
            card_number: true
          }
        }
      },
      orderBy: {
        added_date: 'desc'
      },
      take: 5
    })
    
    recentCards.forEach(item => {
      if (item.user && item.card) {
        activities.push({
          icon: 'plus-circle',
          description: `${item.user.username} added card #${item.card.card_number}`,
          timestamp: item.added_date
        })
      }
    })
    
    // Get recent logins
    const recentLogins = await prisma.userAuthLog.findMany({
      where: {
        event_type: 'LOGIN_SUCCESS'
      },
      select: {
        created: true,
        user: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        created: 'desc'
      },
      take: 5
    })
    
    recentLogins.forEach(login => {
      if (login.user) {
        activities.push({
          icon: 'log-in',
          description: `${login.user.username} logged in`,
          timestamp: login.created
        })
      }
    })
    
    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    res.json({
      activities: activities.slice(0, 20) // Return top 20 most recent
    })
    
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    res.status(500).json({
      error: 'Failed to fetch recent activity',
      message: error.message
    })
  }
})

module.exports = router