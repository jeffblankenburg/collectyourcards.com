/**
 * Daily Statistics Refresh Utility
 * Automatically refreshes database stats cache once per day
 */

const axios = require('axios')

class DailyStatsRefresh {
  constructor() {
    this.isRunning = false
    this.refreshInterval = null
    this.baseUrl = process.env.CLIENT_URL || 'http://localhost:3001'
  }

  // Start the daily refresh scheduler
  start() {
    if (this.isRunning) return
    
    console.log('📊 Starting daily stats refresh scheduler...')
    
    // Calculate time until next midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(1, 0, 0, 0) // Refresh at 1 AM
    
    const msUntilTomorrow = tomorrow.getTime() - now.getTime()
    
    // Set initial timeout for first refresh
    setTimeout(() => {
      this.refreshStats()
      
      // Then set daily interval (24 hours)
      this.refreshInterval = setInterval(() => {
        this.refreshStats()
      }, 24 * 60 * 60 * 1000) // 24 hours
      
    }, msUntilTomorrow)
    
    this.isRunning = true
    
    const hours = Math.floor(msUntilTomorrow / (1000 * 60 * 60))
    const minutes = Math.floor((msUntilTomorrow % (1000 * 60 * 60)) / (1000 * 60))
    console.log(`📅 Next stats refresh scheduled in ${hours}h ${minutes}m`)
  }

  // Stop the scheduler
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
    this.isRunning = false
    console.log('📊 Daily stats refresh scheduler stopped')
  }

  // Manual refresh trigger
  async refreshStats() {
    try {
      console.log('📊 Executing daily database stats refresh...')
      
      const response = await axios.post(`${this.baseUrl}/api/database-stats/refresh`)
      
      if (response.data?.stats) {
        const { cards, players, teams } = response.data.stats
        console.log('✅ Stats refreshed successfully:', {
          cards: cards?.toLocaleString(),
          players: players?.toLocaleString(), 
          teams: teams?.toLocaleString(),
          lastUpdated: response.data.refreshedAt
        })
      }
    } catch (error) {
      console.error('❌ Failed to refresh daily stats:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      
      // Don't crash the app if stats refresh fails
      // The API will fall back to cached data or defaults
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRefresh: this.refreshInterval ? 'Scheduled' : 'Not scheduled'
    }
  }
}

// Create singleton instance
const dailyStatsRefresh = new DailyStatsRefresh()

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  dailyStatsRefresh.start()
}

module.exports = { dailyStatsRefresh }