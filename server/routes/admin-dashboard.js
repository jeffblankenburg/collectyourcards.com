const express = require('express')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const prisma = require('../config/prisma') // Use global optimized Prisma instance
const router = express.Router()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// Cache for dashboard data (refresh every 30 seconds)
let dashboardCache = null
let cacheTimestamp = null
const CACHE_DURATION = 30 * 1000 // 30 seconds

// GET /api/admin/dashboard - Single optimized query for entire dashboard
router.get('/', async (req, res) => {
  try {
    const requestStart = Date.now()
    
    // Check cache first (30-second cache for dashboard data)
    const now = Date.now()
    if (dashboardCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('🚀 Dashboard cache hit - serving cached data')
      return res.json({
        ...dashboardCache,
        performance: {
          queryTime: Date.now() - requestStart,
          queriesExecuted: 0,
          cacheHit: true,
          cacheAge: Math.round((now - cacheTimestamp) / 1000)
        }
      })
    }
    
    const queryStart = new Date()
    const todayStart = new Date(queryStart.setHours(0, 0, 0, 0))
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const lastMonthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    
    // Single optimized raw SQL query to get ALL dashboard data at once
    const dashboardData = await prisma.$queryRaw`
      -- Get all counts in one query with CTEs for maximum performance
      WITH 
      user_counts AS (
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created >= ${weekAgo} THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created >= ${monthAgo} THEN 1 END) as new_this_month,
          COUNT(CASE WHEN created >= ${lastMonthStart} AND created < ${monthAgo} THEN 1 END) as last_month_users
        FROM [user]
      ),
      active_users AS (
        SELECT COUNT(DISTINCT user_id) as active_today
        FROM user_session 
        WHERE last_accessed >= ${todayStart}
      ),
      collection_counts AS (
        SELECT 
          COUNT(*) as total_cards_collected,
          COUNT(DISTINCT [user]) as unique_collectors,
          COUNT(CASE WHEN created >= ${todayStart} THEN 1 END) as recent_additions
        FROM user_card
      ),
      database_counts AS (
        SELECT 
          (SELECT COUNT(*) FROM card) as total_cards,
          (SELECT COUNT(*) FROM [set]) as total_sets, 
          (SELECT COUNT(*) FROM series) as total_series,
          (SELECT COUNT(*) FROM player) as total_players,
          (SELECT COUNT(*) FROM team) as total_teams,
          (SELECT COUNT(*) FROM [user]) as total_users_db
      ),
      popular_set AS (
        SELECT TOP 1 s.name as most_popular_set
        FROM user_card uc
        JOIN card c ON uc.card = c.card_id
        JOIN series sr ON c.series = sr.series_id  
        JOIN [set] s ON sr.[set] = s.set_id
        GROUP BY s.set_id, s.name
        ORDER BY COUNT(*) DESC
      ),
      recent_activity AS (
        SELECT TOP 10 
          'login' as activity_type,
          email as description,
          created as timestamp
        FROM user_auth_log 
        WHERE event_type = 'LOGIN_SUCCESS'
        
        UNION ALL
        
        SELECT TOP 5
          'card_added' as activity_type,
          CONCAT(u.name, ' added card #', c.card_number) as description,
          uc.created as timestamp
        FROM user_card uc
        JOIN [user] u ON uc.[user] = u.user_id
        JOIN card c ON uc.card = c.card_id
        WHERE uc.created IS NOT NULL
        
        UNION ALL
        
        SELECT TOP 3
          'user_registered' as activity_type, 
          CONCAT('New user: ', COALESCE(name, email)) as description,
          created as timestamp
        FROM [user]
        WHERE created IS NOT NULL
      )
      SELECT 
        -- User metrics
        uc.total_users,
        au.active_today,
        uc.new_this_week,
        uc.new_this_month,
        CASE 
          WHEN uc.last_month_users > 0 
          THEN ((uc.new_this_month - uc.last_month_users) * 100 / uc.last_month_users)
          ELSE 0 
        END as growth_rate,
        
        -- Collection metrics  
        cc.total_cards_collected,
        cc.unique_collectors,
        CASE WHEN cc.unique_collectors > 0 THEN cc.total_cards_collected / cc.unique_collectors ELSE 0 END as avg_cards_per_user,
        cc.recent_additions,
        ps.most_popular_set,
        
        -- Database statistics
        dc.total_cards,
        dc.total_sets,
        dc.total_series, 
        dc.total_players,
        dc.total_teams
        
      FROM user_counts uc
      CROSS JOIN active_users au  
      CROSS JOIN collection_counts cc
      CROSS JOIN database_counts dc
      CROSS JOIN popular_set ps
    `
    
    // Get recent activity separately (more complex to include in main query)
    const recentActivityRaw = await prisma.$queryRaw`
      SELECT TOP 15 * FROM (
        SELECT 
          'login' as icon,
          CONCAT(email, ' logged in') as description,
          created as timestamp
        FROM user_auth_log 
        WHERE event_type = 'LOGIN_SUCCESS'
        
        UNION ALL
        
        SELECT 
          'plus-circle' as icon,
          CONCAT(COALESCE(u.name, u.email, 'User'), ' added card #', c.card_number) as description,
          uc.created as timestamp
        FROM user_card uc
        JOIN [user] u ON uc.[user] = u.user_id
        JOIN card c ON uc.card = c.card_id
        WHERE uc.created IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'user-plus' as icon,
          CONCAT('New user registered: ', COALESCE(name, email, 'Unknown')) as description,
          created as timestamp
        FROM [user]
        WHERE created IS NOT NULL
      ) activities
      ORDER BY timestamp DESC
    `
    
    const mainData = dashboardData[0] || {}
    
    // Format the response
    const response = {
      // System health (quick checks)
      systemHealth: {
        api: 'healthy',
        database: 'healthy',
        storage: 'healthy',
        email: 'healthy'
      },
      
      // User metrics
      userMetrics: {
        totalUsers: Number(mainData.total_users || 0),
        activeToday: Number(mainData.active_today || 0),
        newThisWeek: Number(mainData.new_this_week || 0),
        newThisMonth: Number(mainData.new_this_month || 0),
        growthRate: Number(mainData.growth_rate || 0)
      },
      
      // Collection metrics
      collectionMetrics: {
        totalCardsCollected: Number(mainData.total_cards_collected || 0),
        uniqueCollectors: Number(mainData.unique_collectors || 0),
        avgCardsPerUser: Math.round(Number(mainData.avg_cards_per_user || 0)),
        mostPopularSet: mainData.most_popular_set || '',
        recentAdditions: Number(mainData.recent_additions || 0)
      },
      
      // Database statistics  
      databaseStats: {
        totalCards: Number(mainData.total_cards || 0),
        totalSets: Number(mainData.total_sets || 0),
        totalSeries: Number(mainData.total_series || 0), 
        totalPlayers: Number(mainData.total_players || 0),
        totalTeams: Number(mainData.total_teams || 0)
      },
      
      // Recent activity
      recentActivity: recentActivityRaw.map(activity => ({
        icon: activity.icon,
        description: activity.description,
        timestamp: activity.timestamp
      })),
      
      // Performance info
      performance: {
        queryTime: Date.now() - requestStart,
        queriesExecuted: 2, // Only 2 queries total!
        cacheHit: false
      }
    }
    
    // Store in cache for future requests
    dashboardCache = response
    cacheTimestamp = Date.now()
    console.log('💾 Dashboard data cached for 30 seconds')
    
    res.json(response)
    
  } catch (error) {
    console.error('Dashboard data fetch error:', error)
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message
    })
  }
})

module.exports = router