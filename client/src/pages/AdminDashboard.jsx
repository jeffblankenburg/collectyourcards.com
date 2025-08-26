import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminDashboard.css'

function AdminDashboard() {
  const { user } = useAuth()
  const { addToast } = useToast()
  
  // State for various metrics
  const [systemHealth, setSystemHealth] = useState({
    api: 'checking',
    database: 'checking',
    storage: 'checking',
    email: 'checking'
  })
  
  const [userMetrics, setUserMetrics] = useState({
    totalUsers: 0,
    activeToday: 0,
    newThisWeek: 0,
    newThisMonth: 0,
    growthRate: 0
  })
  
  const [collectionMetrics, setCollectionMetrics] = useState({
    totalCardsCollected: 0,
    uniqueCollectors: 0,
    avgCardsPerUser: 0,
    mostPopularSet: '',
    recentAdditions: 0
  })
  
  const [databaseStats, setDatabaseStats] = useState({
    totalCards: 0,
    totalSets: 0,
    totalSeries: 0,
    totalPlayers: 0,
    totalTeams: 0,
    dataCompleteness: 0
  })
  
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadDashboardData()
    // Refresh health status every 30 seconds
    const healthInterval = setInterval(checkSystemHealth, 30000)
    return () => clearInterval(healthInterval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Single optimized API call for all dashboard data
      const startTime = performance.now()
      const response = await axios.get('/api/admin/dashboard')
      const endTime = performance.now()
      
      console.log(`Dashboard loaded in ${Math.round(endTime - startTime)}ms using ${response.data.performance?.queriesExecuted || 'unknown'} queries`)
      
      // Update all state from single response
      setSystemHealth(response.data.systemHealth || {
        api: 'healthy',
        database: 'healthy', 
        storage: 'healthy',
        email: 'healthy'
      })
      
      setUserMetrics(response.data.userMetrics || {
        totalUsers: 0,
        activeToday: 0,
        newThisWeek: 0,
        newThisMonth: 0,
        growthRate: 0
      })
      
      setCollectionMetrics(response.data.collectionMetrics || {
        totalCardsCollected: 0,
        uniqueCollectors: 0,
        avgCardsPerUser: 0,
        mostPopularSet: '',
        recentAdditions: 0
      })
      
      setDatabaseStats({
        ...response.data.databaseStats,
        dataCompleteness: calculateCompleteness(response.data.databaseStats)
      })
      
      setRecentActivity(response.data.recentActivity || [])
      
      addToast(`Dashboard loaded in ${Math.round(endTime - startTime)}ms`, 'success')
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      addToast('Failed to load dashboard data', 'error')
      
      // Fallback to individual API calls if optimized endpoint fails
      console.log('Falling back to individual API calls...')
      await Promise.all([
        checkSystemHealth(),
        loadUserMetrics(),
        loadCollectionMetrics(), 
        loadDatabaseStats(),
        loadRecentActivity()
      ])
    } finally {
      setLoading(false)
    }
  }

  const checkSystemHealth = async () => {
    try {
      // Check API health
      const apiHealth = await axios.get('/api/health')
      setSystemHealth(prev => ({ ...prev, api: apiHealth.data.status === 'OK' ? 'healthy' : 'error' }))
      
      // Check database status
      try {
        const dbStatus = await axios.get('/api/database/status')
        setSystemHealth(prev => ({ ...prev, database: dbStatus.data.connected ? 'healthy' : 'error' }))
      } catch {
        setSystemHealth(prev => ({ ...prev, database: 'error' }))
      }
      
      // Check Azure storage (if we have thumbnail URLs in database)
      setSystemHealth(prev => ({ ...prev, storage: 'healthy' })) // Simplified for now
      
      // Check email service
      setSystemHealth(prev => ({ ...prev, email: 'healthy' })) // Simplified for now
      
    } catch (error) {
      console.error('Health check failed:', error)
      setSystemHealth(prev => ({ ...prev, api: 'error' }))
    }
  }

  const loadUserMetrics = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/users')
      setUserMetrics(response.data)
    } catch (error) {
      console.error('Failed to load user metrics:', error)
    }
  }

  const loadCollectionMetrics = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/collections')
      setCollectionMetrics(response.data)
    } catch (error) {
      console.error('Failed to load collection metrics:', error)
    }
  }

  const loadDatabaseStats = async () => {
    try {
      const response = await axios.get('/api/database/status')
      if (response.data.counts) {
        setDatabaseStats({
          totalCards: response.data.counts.cards || 0,
          totalSets: response.data.counts.sets || 0,
          totalSeries: response.data.counts.series || 0,
          totalPlayers: response.data.counts.players || 0,
          totalTeams: response.data.counts.teams || 0,
          dataCompleteness: calculateCompleteness(response.data.counts)
        })
      }
    } catch (error) {
      console.error('Failed to load database stats:', error)
    }
  }

  const loadRecentActivity = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/recent-activity')
      setRecentActivity(response.data.activities || [])
    } catch (error) {
      console.error('Failed to load recent activity:', error)
    }
  }

  const calculateCompleteness = (counts) => {
    // Simple calculation based on expected maximums (your database is actually complete!)
    const expectations = {
      cards: 800000,
      sets: 2000,
      series: 10000,
      players: 7000,
      teams: 140
    }
    
    let total = 0
    let score = 0
    
    Object.keys(expectations).forEach(key => {
      if (counts[key]) {
        total++
        score += Math.min(counts[key] / expectations[key], 1)
      }
    })
    
    return total > 0 ? Math.round((score / total) * 100) : 0
  }

  const getHealthIcon = (status) => {
    switch(status) {
      case 'healthy':
        return <Icon name="check-circle" size={16} className="health-icon healthy" />
      case 'warning':
        return <Icon name="alert-circle" size={16} className="health-icon warning" />
      case 'error':
        return <Icon name="x-circle" size={16} className="health-icon error" />
      default:
        return <Icon name="activity" size={16} className="health-icon checking spinning" />
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <button className="refresh-btn" onClick={loadDashboardData}>
          <Icon name="refresh-cw" size={16} />
          Refresh
        </button>
      </div>

      {/* System Health Status Bar */}
      <div className="health-status-bar">
        <h3>System Health</h3>
        <div className="health-items">
          <div className="health-item">
            {getHealthIcon(systemHealth.api)}
            <span>API</span>
          </div>
          <div className="health-item">
            {getHealthIcon(systemHealth.database)}
            <span>Database</span>
          </div>
          <div className="health-item">
            {getHealthIcon(systemHealth.storage)}
            <span>Storage</span>
          </div>
          <div className="health-item">
            {getHealthIcon(systemHealth.email)}
            <span>Email</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* User Metrics Section */}
        <div className="dashboard-section user-metrics">
          <h2>
            <Icon name="users" size={20} />
            User Metrics
          </h2>
          <div className="metrics-grid">
            <div className="metric-card primary">
              <div className="metric-value">{formatNumber(userMetrics.totalUsers)}</div>
              <div className="metric-label">Total Users</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{userMetrics.activeToday}</div>
              <div className="metric-label">Active Today</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">+{userMetrics.newThisWeek}</div>
              <div className="metric-label">New This Week</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">+{userMetrics.newThisMonth}</div>
              <div className="metric-label">New This Month</div>
            </div>
          </div>
          {userMetrics.growthRate > 0 && (
            <div className="growth-indicator positive">
              <Icon name="trending-up" size={16} />
              {userMetrics.growthRate}% growth vs last month
            </div>
          )}
        </div>

        {/* Collection Activity Section */}
        <div className="dashboard-section collection-metrics">
          <h2>
            <Icon name="layers" size={20} />
            Collection Activity
          </h2>
          <div className="metrics-grid">
            <div className="metric-card primary">
              <div className="metric-value">{formatNumber(collectionMetrics.totalCardsCollected)}</div>
              <div className="metric-label">Cards Collected</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{collectionMetrics.uniqueCollectors}</div>
              <div className="metric-label">Active Collectors</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{Math.round(collectionMetrics.avgCardsPerUser)}</div>
              <div className="metric-label">Avg Cards/User</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">+{collectionMetrics.recentAdditions}</div>
              <div className="metric-label">Added Today</div>
            </div>
          </div>
          {collectionMetrics.mostPopularSet && (
            <div className="popular-info">
              <Icon name="star" size={16} />
              Most popular: {collectionMetrics.mostPopularSet}
            </div>
          )}
        </div>

        {/* Database Statistics Section */}
        <div className="dashboard-section database-stats">
          <h2>
            <Icon name="database" size={20} />
            Database Statistics
          </h2>
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Total Cards</span>
              <span className="stat-value">{formatNumber(databaseStats.totalCards)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Sets</span>
              <span className="stat-value">{formatNumber(databaseStats.totalSets)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Series</span>
              <span className="stat-value">{formatNumber(databaseStats.totalSeries)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Players</span>
              <span className="stat-value">{formatNumber(databaseStats.totalPlayers)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Teams</span>
              <span className="stat-value">{formatNumber(databaseStats.totalTeams)}</span>
            </div>
          </div>
          <div className="completeness-bar">
            <div className="completeness-label">Data Completeness</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${databaseStats.dataCompleteness}%` }}></div>
            </div>
            <div className="completeness-value">{databaseStats.dataCompleteness}%</div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="dashboard-section recent-activity">
          <h2>
            <Icon name="activity" size={20} />
            Recent Activity
          </h2>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <div className="no-activity">No recent activity</div>
            ) : (
              recentActivity.slice(0, 10).map((activity, index) => (
                <div key={index} className="activity-item">
                  <Icon name={activity.icon || 'circle'} size={14} />
                  <span className="activity-text">{activity.description}</span>
                  <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section quick-actions">
          <h2>
            <Icon name="zap" size={20} />
            Quick Actions
          </h2>
          <div className="action-buttons">
            <button className="action-btn" onClick={() => window.location.href = '/admin/import'}>
              <Icon name="upload" size={16} />
              Import Spreadsheet
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/admin/users'}>
              <Icon name="user-plus" size={16} />
              Add User
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/admin/sets'}>
              <Icon name="plus-circle" size={16} />
              Add Set
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/status'}>
              <Icon name="monitor" size={16} />
              System Status
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard