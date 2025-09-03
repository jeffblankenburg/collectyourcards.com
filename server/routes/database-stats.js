const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const router = express.Router()

// Cache for database stats (refreshed daily)
let cachedStats = {
  cards: 0,
  players: 0,
  teams: 0,
  lastUpdated: null
}

// Check if cache needs refresh (older than 24 hours)
function needsCacheRefresh() {
  if (!cachedStats.lastUpdated) return true
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return cachedStats.lastUpdated < oneDayAgo
}

// Refresh cache with latest database counts
async function refreshDatabaseStats() {
  try {
    console.log('📊 Refreshing database stats cache...')
    
    // Single optimized query to get all counts
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM card) as card_count,
        (SELECT COUNT(*) FROM player) as player_count,
        (SELECT COUNT(*) FROM team) as team_count
    `
    
    const result = await prisma.$queryRawUnsafe(statsQuery)
    const stats = result[0]
    
    cachedStats = {
      cards: Number(stats.card_count),
      players: Number(stats.player_count),
      teams: Number(stats.team_count),
      lastUpdated: new Date()
    }
    
    console.log('📊 Stats cache updated:', {
      cards: cachedStats.cards.toLocaleString(),
      players: cachedStats.players.toLocaleString(),
      teams: cachedStats.teams.toLocaleString()
    })
    
    return cachedStats
  } catch (error) {
    console.error('❌ Failed to refresh database stats:', error)
    // Return existing cache or defaults on error
    return cachedStats.lastUpdated ? cachedStats : {
      cards: 793740,
      players: 6965,
      teams: 135,
      lastUpdated: new Date(),
      error: 'Failed to fetch current data'
    }
  }
}

// GET /api/database-stats - Get cached database statistics
router.get('/', async (req, res) => {
  try {
    // Check if we need to refresh cache
    if (needsCacheRefresh()) {
      await refreshDatabaseStats()
    }
    
    res.json({
      stats: cachedStats,
      isCached: !needsCacheRefresh(),
      cacheAge: cachedStats.lastUpdated ? 
        Math.floor((Date.now() - cachedStats.lastUpdated.getTime()) / (1000 * 60)) : null // minutes
    })
  } catch (error) {
    console.error('Error getting database stats:', error)
    
    // Return fallback data if cache fails
    res.json({
      stats: {
        cards: 793740,
        players: 6965,
        teams: 135,
        lastUpdated: new Date(),
        error: 'Using fallback data'
      },
      isCached: false,
      error: error.message
    })
  }
})

// POST /api/database-stats/refresh - Force refresh cache (admin only)
router.post('/refresh', async (req, res) => {
  try {
    const refreshedStats = await refreshDatabaseStats()
    
    res.json({
      message: 'Database stats cache refreshed successfully',
      stats: refreshedStats,
      refreshedAt: new Date()
    })
  } catch (error) {
    console.error('Error refreshing database stats:', error)
    res.status(500).json({
      error: 'Failed to refresh database stats',
      message: error.message
    })
  }
})

// Initialize cache on startup
setTimeout(async () => {
  if (needsCacheRefresh()) {
    await refreshDatabaseStats()
  }
}, 5000) // Wait 5 seconds after startup

module.exports = router