import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminDashboardScoped.css'

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
  const [spreadsheetQueue, setSpreadsheetQueue] = useState({
    queue_length: 0,
    jobs: []
  })
  const [checklistStats, setChecklistStats] = useState({
    total_complete_sets: 0,
    sets_with_checklists: 0,
    sets_without_checklists: 0,
    sets: []
  })
  const [checklistGeneration, setChecklistGeneration] = useState({
    generating: false,
    progress: null,
    results: null
  })
  const [moderationStats, setModerationStats] = useState({
    comments: {
      visible_last_7_days: 0,
      deleted_last_7_days: 0,
      pending_review: 0,
      total_last_24_hours: 0
    },
    users: {
      muted: 0
    }
  })
  const [recentComments, setRecentComments] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [aggregateUpdates, setAggregateUpdates] = useState({
    updating: false,
    lastUpdated: null,
    results: []
  })

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
    document.title = 'Admin Dashboard - Collect Your Cards'
    loadDashboardData()
    loadSpreadsheetQueue()
    loadChecklistStats()

    // Refresh health status and queue every 30 seconds
    const healthInterval = setInterval(checkSystemHealth, 30000)
    const queueInterval = setInterval(loadSpreadsheetQueue, 10000) // More frequent for queue

    return () => {
      clearInterval(healthInterval)
      clearInterval(queueInterval)
    }
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
      
      // Load moderation data separately
      try {
        const config = {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
        
        const moderationResponse = await axios.get('/api/admin/moderation/stats', config)
        setModerationStats(moderationResponse.data)
        
        const commentsResponse = await axios.get('/api/admin/moderation/recent-comments', config)
        setRecentComments(commentsResponse.data.comments || [])
        
        console.log('Loaded moderation data:', {
          stats: moderationResponse.data,
          commentsCount: commentsResponse.data.comments?.length || 0
        })
      } catch (moderationError) {
        console.error('Error loading moderation data:', moderationError)
        // Don't show toast for moderation errors, just log them
      }
      
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

  const loadSpreadsheetQueue = async () => {
    try {
      const response = await axios.get('/api/spreadsheet-generation/queue')
      setSpreadsheetQueue(response.data)
    } catch (error) {
      console.error('Failed to load spreadsheet queue:', error)
      // Don't show error toast for this since it runs frequently
    }
  }

  const loadChecklistStats = async () => {
    try {
      const response = await axios.get('/api/spreadsheet-generation/complete-sets')
      setChecklistStats(response.data)
    } catch (error) {
      console.error('Failed to load checklist stats:', error)
    }
  }

  const generateAllChecklists = async () => {
    setChecklistGeneration({ generating: true, progress: 'Starting...', results: null })

    try {
      addToast('Starting bulk checklist generation...', 'info')
      const response = await axios.post('/api/spreadsheet-generation/generate-all-complete')

      setChecklistGeneration({
        generating: false,
        progress: null,
        results: response.data
      })

      if (response.data.generated > 0) {
        addToast(`Generated ${response.data.generated} checklists successfully!`, 'success')
      }
      if (response.data.failed > 0) {
        addToast(`${response.data.failed} checklists failed to generate`, 'warning')
      }

      // Reload checklist stats
      loadChecklistStats()
    } catch (error) {
      console.error('Error generating checklists:', error)
      setChecklistGeneration({ generating: false, progress: null, results: null })
      addToast(`Failed to generate checklists: ${error.response?.data?.message || error.message}`, 'error')
    }
  }

  const generateSingleChecklist = async (setId, setName) => {
    try {
      addToast(`Generating checklist for ${setName}...`, 'info')
      const response = await axios.post(`/api/spreadsheet-generation/generate/${setId}`)

      addToast(`Checklist generated for ${setName}!`, 'success')

      // Reload checklist stats
      loadChecklistStats()
    } catch (error) {
      console.error('Error generating checklist:', error)
      addToast(`Failed to generate checklist: ${error.response?.data?.message || error.message}`, 'error')
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

  // Moderation Functions
  const deleteComment = async (commentId) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.delete(`/api/admin/moderation/comments/${commentId}`, config)
      addToast('Comment deleted successfully', 'success')
      
      // Remove from local state
      setRecentComments(prev => prev.filter(comment => comment.comment_id !== commentId))
      
      // Update stats
      setModerationStats(prev => ({
        ...prev,
        comments: {
          ...prev.comments,
          deleted_last_7_days: prev.comments.deleted_last_7_days + 1,
          visible_last_7_days: Math.max(0, prev.comments.visible_last_7_days - 1)
        }
      }))
    } catch (error) {
      console.error('Error deleting comment:', error)
      addToast('Failed to delete comment', 'error')
    }
  }

  const muteUser = async (userId, username) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.post(`/api/admin/moderation/users/${userId}/mute`, {
        reason: 'Inappropriate content'
      }, config)
      addToast(`User ${username} muted successfully`, 'success')
      
      // Update local state
      setRecentComments(prev => 
        prev.map(comment => 
          comment.user.user_id === userId 
            ? { ...comment, user: { ...comment.user, is_muted: true } }
            : comment
        )
      )
      
      // Update stats
      setModerationStats(prev => ({
        ...prev,
        users: {
          ...prev.users,
          muted: prev.users.muted + 1
        }
      }))
    } catch (error) {
      console.error('Error muting user:', error)
      addToast('Failed to mute user', 'error')
    }
  }

  const unmuteUser = async (userId, username) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.post(`/api/admin/moderation/users/${userId}/unmute`, {}, config)
      addToast(`User ${username} unmuted successfully`, 'success')
      
      // Update local state
      setRecentComments(prev => 
        prev.map(comment => 
          comment.user.user_id === userId 
            ? { ...comment, user: { ...comment.user, is_muted: false } }
            : comment
        )
      )
      
      // Update stats
      setModerationStats(prev => ({
        ...prev,
        users: {
          ...prev.users,
          muted: Math.max(0, prev.users.muted - 1)
        }
      }))
    } catch (error) {
      console.error('Error unmuting user:', error)
      addToast('Failed to unmute user', 'error')
    }
  }

  const getEntityUrl = (comment) => {
    const { comment_type, entity_slug, entity_year, card_number, card_set_slug } = comment
    
    if (comment_type === 'series' && entity_slug && entity_year) {
      return `/series/${entity_slug}`
    } else if (comment_type === 'set' && entity_slug && entity_year) {
      return `/sets/${entity_year}/${entity_slug}`
    } else if (comment_type === 'card' && card_set_slug && card_number && entity_slug) {
      // Format: /card/set-slug/number/player-name
      return `/card/${card_set_slug}/${card_number}/${entity_slug}`
    }
    
    return null
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
        return <div className="card-icon-spinner small health-icon checking"></div>
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

  const updateAggregates = async (type) => {
    setAggregateUpdates(prev => ({ ...prev, updating: type }))
    
    try {
      const response = await axios.post(`/api/admin/aggregates/update`, { type })
      
      if (response.data.success) {
        addToast(`Successfully updated ${type} aggregates: ${response.data.rowsUpdated} rows updated`, 'success')
        setAggregateUpdates(prev => ({
          ...prev,
          lastUpdated: new Date().toISOString(),
          results: [
            { type, rowsUpdated: response.data.rowsUpdated, timestamp: new Date().toISOString() },
            ...prev.results.slice(0, 9) // Keep last 10 results
          ]
        }))
        // Reload dashboard data to show updated counts
        loadDatabaseStats()
      } else {
        addToast(`Failed to update ${type} aggregates`, 'error')
      }
    } catch (error) {
      console.error('Error updating aggregates:', error)
      addToast(`Error updating ${type}: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setAggregateUpdates(prev => ({ ...prev, updating: false }))
    }
  }

  const updateAllAggregates = async () => {
    const types = ['rookie_count', 'card_entered_count', 'card_count', 'player_card_count', 'team_card_count', 'series_print_run']

    for (const type of types) {
      await updateAggregates(type)
    }
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

        {/* Aggregate Updates Section */}
        <div className="dashboard-section aggregate-updates">
          <h2>
            <Icon name="refresh-cw" size={20} />
            Update Aggregate Data
          </h2>
          
          <div className="aggregate-info">
            <p>Update database aggregate fields that may become out of sync. These operations recalculate counts based on actual data.</p>
            {aggregateUpdates.lastUpdated && (
              <div className="last-updated">
                Last updated: {formatTimeAgo(aggregateUpdates.lastUpdated)}
              </div>
            )}
          </div>

          <div className="aggregate-buttons">
            <button 
              className="aggregate-btn"
              onClick={() => updateAggregates('rookie_count')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="user-check" size={16} />
              Update Rookie Counts
            </button>
            
            <button 
              className="aggregate-btn"
              onClick={() => updateAggregates('card_entered_count')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="layers" size={16} />
              Update Cards Entered
            </button>
            
            <button 
              className="aggregate-btn"
              onClick={() => updateAggregates('card_count')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="credit-card" size={16} />
              Update Card Counts
            </button>
            
            <button 
              className="aggregate-btn"
              onClick={() => updateAggregates('player_card_count')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="users" size={16} />
              Update Player Card Counts
            </button>
            
            <button
              className="aggregate-btn"
              onClick={() => updateAggregates('team_card_count')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="flag" size={16} />
              Update Team Card Counts
            </button>

            <button
              className="aggregate-btn"
              onClick={() => updateAggregates('series_print_run')}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="hash" size={16} />
              Update Series Print Runs
            </button>

            <button
              className="aggregate-btn update-all"
              onClick={updateAllAggregates}
              disabled={aggregateUpdates.updating}
            >
              <Icon name="refresh-cw" size={16} />
              Update All Aggregates
            </button>
          </div>
          
          {aggregateUpdates.updating && (
            <div className="updating-status">
              <div className="card-icon-spinner small"></div>
              <span>Updating {aggregateUpdates.updating}...</span>
            </div>
          )}
          
          {aggregateUpdates.results.length > 0 && (
            <div className="recent-updates">
              <h4>Recent Updates</h4>
              <ul>
                {aggregateUpdates.results.slice(0, 5).map((result, idx) => (
                  <li key={idx}>
                    <span className="update-type">{result.type}</span>
                    <span className="update-count">{result.rowsUpdated} rows</span>
                    <span className="update-time">{formatTimeAgo(result.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Checklist Generation Section */}
        <div className="dashboard-section checklist-generation">
          <h2>
            <Icon name="file-text" size={20} />
            Checklist Generation
          </h2>

          <div className="checklist-stats">
            <div className="stat-items">
              <div className="stat-item">
                <span className="stat-number">{checklistStats.total_complete_sets}</span>
                <span className="stat-label">Complete Sets</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{checklistStats.sets_with_checklists}</span>
                <span className="stat-label">Have Checklists</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{checklistStats.sets_without_checklists}</span>
                <span className="stat-label">Need Generation</span>
              </div>
            </div>
          </div>

          <div className="checklist-actions">
            <button
              className="aggregate-btn update-all"
              onClick={generateAllChecklists}
              disabled={checklistGeneration.generating || checklistStats.sets_without_checklists === 0}
            >
              {checklistGeneration.generating ? (
                <>
                  <div className="card-icon-spinner small"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Icon name="download" size={16} />
                  Generate All Missing Checklists
                </>
              )}
            </button>
          </div>

          {checklistGeneration.results && (
            <div className="generation-results">
              <h4>Generation Results</h4>
              <div className="results-summary">
                <span className="success">{checklistGeneration.results.generated} generated</span>
                {checklistGeneration.results.failed > 0 && (
                  <span className="failed">{checklistGeneration.results.failed} failed</span>
                )}
              </div>
            </div>
          )}

          {checklistStats.sets_without_checklists > 0 && checklistStats.sets.filter(s => !s.checklist_blob_url).length > 0 && (
            <div className="sets-needing-checklists">
              <h4>Sets Without Checklists ({checklistStats.sets_without_checklists})</h4>
              <div className="sets-list">
                {checklistStats.sets
                  .filter(set => !set.checklist_blob_url)
                  .slice(0, 10)
                  .map(set => (
                    <div key={set.set_id} className="set-item">
                      <div className="set-info">
                        <span className="set-name">{set.name}</span>
                        <span className="set-year">({set.year})</span>
                        <span className="set-cards">{formatNumber(set.card_count)} cards</span>
                      </div>
                      <button
                        className="action-btn small"
                        onClick={() => generateSingleChecklist(set.set_id, set.name)}
                        title="Generate checklist"
                      >
                        <Icon name="download" size={14} />
                      </button>
                    </div>
                  ))}
                {checklistStats.sets_without_checklists > 10 && (
                  <div className="more-sets">
                    And {checklistStats.sets_without_checklists - 10} more...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Moderation Section */}
        <div className="dashboard-section moderation-section">
          <h2>
            <Icon name="shield" size={20} />
            Content Moderation
          </h2>
          
          {/* Moderation Stats */}
          <div className="moderation-stats">
            <div className="stat-group">
              <h3>Comments (Last 7 Days)</h3>
              <div className="stat-items">
                <div className="stat-item">
                  <span className="stat-number">{moderationStats.comments.visible_last_7_days}</span>
                  <span className="stat-label">Visible</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{moderationStats.comments.deleted_last_7_days}</span>
                  <span className="stat-label">Deleted</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{moderationStats.comments.pending_review}</span>
                  <span className="stat-label">Pending</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{moderationStats.comments.total_last_24_hours}</span>
                  <span className="stat-label">Last 24h</span>
                </div>
              </div>
            </div>
            <div className="stat-group">
              <h3>Users</h3>
              <div className="stat-items">
                <div className="stat-item">
                  <span className="stat-number">{moderationStats.users.muted}</span>
                  <span className="stat-label">Muted</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Comments for Moderation */}
          <div className="recent-comments">
            <h3>Recent Comments (Last 7 Days)</h3>
            {recentComments.length === 0 ? (
              <div className="empty-state">
                <Icon name="message-square" size={32} />
                <p>No recent comments to moderate</p>
              </div>
            ) : (
              <div className="comments-list">
                {recentComments.map(comment => (
                  <div key={comment.comment_id} className="comment-item">
                    <div className="comment-header">
                      <div className="user-info">
                        <div className="user-avatar">
                          {comment.user.avatar_url ? (
                            <img src={comment.user.avatar_url} alt={comment.user.username} />
                          ) : (
                            <Icon name="user" size={16} />
                          )}
                        </div>
                        <span className="username">{comment.user.username}</span>
                        {comment.user.is_muted && (
                          <span className="mute-badge">MUTED</span>
                        )}
                      </div>
                      <div className="comment-meta">
                        <span className="timestamp">{formatTimeAgo(comment.created_at)}</span>
                        <span className="entity-type">{comment.comment_type}</span>
                      </div>
                    </div>
                    
                    <div className="comment-content">
                      {comment.comment_text.length > 200 
                        ? `${comment.comment_text.substring(0, 200)}...`
                        : comment.comment_text
                      }
                    </div>
                    
                    <div className="comment-context">
                      {getEntityUrl(comment) ? (
                        <a 
                          href={getEntityUrl(comment)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="entity-link"
                        >
                          <Icon name="external-link" size={14} />
                          {comment.entity_name}
                        </a>
                      ) : (
                        <span className="entity-name">{comment.entity_name}</span>
                      )}
                    </div>
                    
                    <div className="comment-actions">
                      <button
                        className="action-btn delete"
                        onClick={() => deleteComment(comment.comment_id)}
                        title="Delete comment"
                      >
                        <Icon name="trash" size={14} />
                        Delete
                      </button>
                      
                      {comment.user.is_muted ? (
                        <button
                          className="action-btn unmute"
                          onClick={() => unmuteUser(comment.user.user_id, comment.user.username)}
                          title="Unmute user"
                        >
                          <Icon name="mic" size={14} />
                          Unmute
                        </button>
                      ) : (
                        <button
                          className="action-btn mute"
                          onClick={() => muteUser(comment.user.user_id, comment.user.username)}
                          title="Mute user"
                        >
                          <Icon name="mic-off" size={14} />
                          Mute
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* Spreadsheet Generation Queue */}
        <div className="dashboard-section spreadsheet-queue">
          <h2>
            <Icon name="import" size={20} />
            Spreadsheet Generation Queue
            {spreadsheetQueue.queue_length > 0 && (
              <span className="queue-badge">{spreadsheetQueue.queue_length}</span>
            )}
          </h2>
          
          {spreadsheetQueue.queue_length === 0 ? (
            <div className="no-queue-items">
              <Icon name="check-circle" size={24} className="success-icon" />
              <p>No jobs in queue</p>
              <span className="queue-status">All spreadsheet generation jobs are complete</span>
            </div>
          ) : (
            <div className="queue-list">
              {spreadsheetQueue.jobs.map(job => (
                <div key={job.queue_id} className={`queue-item ${job.status}`}>
                  <div className="queue-item-header">
                    <div className="queue-item-title">
                      <Icon name={job.status === 'processing' ? 'activity' : 'clock'} 
                            size={14} 
                            className={job.status === 'processing' ? 'spinning' : ''} />
                      <span className="set-name">{job.set_name}</span>
                      <span className="set-year">({job.set_year})</span>
                    </div>
                    <div className="queue-item-status">
                      <span className={`status-badge ${job.status}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="queue-item-details">
                    <span className="queue-detail">
                      <Icon name="target" size={12} />
                      Priority: {job.priority}
                    </span>
                    <span className="queue-detail">
                      <Icon name="clock" size={12} />
                      Queued: {formatTimeAgo(job.queued_at)}
                    </span>
                    {job.started_at && (
                      <span className="queue-detail">
                        <Icon name="activity" size={12} />
                        Started: {formatTimeAgo(job.started_at)}
                      </span>
                    )}
                    {job.retry_count > 0 && (
                      <span className="queue-detail retry">
                        <Icon name="refresh-cw" size={12} />
                        Retries: {job.retry_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="queue-footer">
            <span className="refresh-info">
              <Icon name="refresh-cw" size={12} />
              Updates every 10 seconds
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section quick-actions">
          <h2>
            <Icon name="zap" size={20} />
            Quick Actions
          </h2>
          <div className="action-buttons">
            <button className="action-btn" onClick={() => window.location.href = '/seller'}>
              <Icon name="dollar-sign" size={16} />
              Seller Dashboard
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/admin/cards-needing-reference'}>
              <Icon name="image" size={16} />
              Assign Card Images
            </button>
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