import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminQueryTesterScoped.css'

function AdminQueryTester() {
  const [sqlQuery, setSqlQuery] = useState('')
  const [testUserId, setTestUserId] = useState('1')
  const [queryResults, setQueryResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [achievements, setAchievements] = useState([])
  const [selectedAchievement, setSelectedAchievement] = useState('')
  const [queryHistory, setQueryHistory] = useState([])
  
  const { addToast } = useToast()

  useEffect(() => {
    fetchUsers()
    fetchAchievements()
    loadQueryHistory()
  }, [])

  // Update page title
  useEffect(() => {
    document.title = 'Admin Query Tester - Collect Your Cards'
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users')
      setUsers(response.data.slice(0, 20)) // Limit to first 20 users for dropdown
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchAchievements = async () => {
    try {
      const response = await axios.get('/api/admin/achievements')
      setAchievements(response.data.achievements || [])
    } catch (error) {
      console.error('Error fetching achievements:', error)
    }
  }

  const loadQueryHistory = () => {
    const saved = localStorage.getItem('admin-query-history')
    if (saved) {
      try {
        setQueryHistory(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading query history:', error)
      }
    }
  }

  const saveToHistory = (query, userId) => {
    const newEntry = {
      query: query.trim(),
      userId,
      timestamp: new Date().toISOString(),
      id: Date.now()
    }
    
    const updatedHistory = [newEntry, ...queryHistory.slice(0, 9)] // Keep last 10
    setQueryHistory(updatedHistory)
    localStorage.setItem('admin-query-history', JSON.stringify(updatedHistory))
  }

  const validateQuery = (query) => {
    const cleanQuery = query.trim().toUpperCase()
    
    // Must start with SELECT
    if (!cleanQuery.startsWith('SELECT')) {
      return { valid: false, error: 'Query must start with SELECT' }
    }
    
    // Check for dangerous keywords
    const dangerousKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
      'EXEC', 'EXECUTE', 'SP_', 'XP_', 'BULK', 'BACKUP', 'RESTORE'
    ]
    
    for (const keyword of dangerousKeywords) {
      if (cleanQuery.includes(keyword)) {
        return { valid: false, error: `Dangerous keyword detected: ${keyword}` }
      }
    }
    
    // Check for SQL injection patterns
    const injectionPatterns = [
      /;\s*--/, // Comment injection
      /;\s*\/\*/, // Block comment injection
      /'\s*OR\s+'1'\s*=\s*'1/, // Classic OR injection
      /'\s*OR\s+1\s*=\s*1/, // Numeric OR injection
      /UNION\s+SELECT/i // Union injection
    ]
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: 'Potential SQL injection pattern detected' }
      }
    }
    
    return { valid: true }
  }

  const executeQuery = async () => {
    if (!sqlQuery.trim()) {
      addToast('Please enter a SQL query', 'error')
      return
    }
    
    if (!testUserId) {
      addToast('Please select a user ID', 'error')
      return
    }

    const validation = validateQuery(sqlQuery)
    if (!validation.valid) {
      addToast(validation.error, 'error')
      return
    }

    setLoading(true)
    setQueryResults(null)

    try {
      const response = await axios.post('/api/admin/test-query', {
        query: sqlQuery,
        userId: testUserId
      })
      
      setQueryResults(response.data)
      saveToHistory(sqlQuery, testUserId)
      addToast('Query executed successfully', 'success')
      
    } catch (error) {
      console.error('Query execution error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Query execution failed'
      addToast(errorMessage, 'error')
      
      setQueryResults({
        success: false,
        error: errorMessage,
        executionTime: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const loadAchievementQuery = (achievementId) => {
    const achievement = achievements.find(a => a.achievement_id.toString() === achievementId)
    if (achievement && achievement.requirement_query) {
      setSqlQuery(achievement.requirement_query)
      setSelectedAchievement(achievementId)
    }
  }

  const loadHistoryQuery = (entry) => {
    setSqlQuery(entry.query)
    setTestUserId(entry.userId)
  }

  const clearResults = () => {
    setQueryResults(null)
    setSqlQuery('')
    setSelectedAchievement('')
  }

  const formatResult = (value) => {
    if (value === null) return 'NULL'
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'number') return value.toLocaleString()
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (value instanceof Date) return value.toISOString()
    return String(value)
  }

  return (
    <div className="admin-query-tester">
      <div className="page-header">
        <div className="header-content">
          <h1>
            <Icon name="search" size={32} />
            SQL Query Tester
          </h1>
          <p>Test achievement queries and validate SQL with secure SELECT-only execution</p>
        </div>
      </div>

      <div className="query-tester-container">
        <div className="query-input-section">
          <div className="input-row">
            <div className="input-group">
              <label htmlFor="testUserId">Test User:</label>
              <select
                id="testUserId"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                className="user-select"
              >
                <option value="">Select a user...</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name} ({user.email}) - ID: {user.user_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="achievementSelect">Load Achievement Query:</label>
              <select
                id="achievementSelect"
                value={selectedAchievement}
                onChange={(e) => loadAchievementQuery(e.target.value)}
                className="achievement-select"
              >
                <option value="">Select an achievement...</option>
                {achievements.map(achievement => (
                  <option key={achievement.achievement_id} value={achievement.achievement_id}>
                    #{achievement.achievement_id}: {achievement.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="query-input-group">
            <label htmlFor="sqlQuery">SQL Query (SELECT only):</label>
            <textarea
              id="sqlQuery"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT COUNT(*) FROM user_card WHERE [user] = @user_id"
              rows={8}
              className="query-textarea"
            />
            <div className="query-hints">
              <Icon name="info" size={16} />
              <span>Use @user_id parameter for user-specific queries. Only SELECT statements are allowed.</span>
            </div>
          </div>

          <div className="button-row">
            <button
              onClick={executeQuery}
              disabled={loading || !sqlQuery.trim() || !testUserId}
              className="execute-button primary"
            >
              {loading ? (
                <>
                  <Icon name="loader" size={16} className="spinning" />
                  Executing...
                </>
              ) : (
                <>
                  <Icon name="play" size={16} />
                  Execute Query
                </>
              )}
            </button>
            
            <button
              onClick={clearResults}
              className="clear-button secondary"
            >
              <Icon name="x" size={16} />
              Clear
            </button>
          </div>
        </div>

        {queryResults && (
          <div className="query-results-section">
            <h3>
              <Icon name={queryResults.success ? "check-circle" : "alert-circle"} size={20} />
              Query Results
            </h3>
            
            <div className="result-summary">
              <span className={`status ${queryResults.success ? 'success' : 'error'}`}>
                {queryResults.success ? 'SUCCESS' : 'ERROR'}
              </span>
              <span className="execution-time">
                Execution time: {queryResults.executionTime}ms
              </span>
              {queryResults.rowCount !== undefined && (
                <span className="row-count">
                  Rows returned: {queryResults.rowCount}
                </span>
              )}
            </div>

            {queryResults.success ? (
              <div className="result-data">
                {queryResults.result && queryResults.result.length > 0 ? (
                  <div className="result-table-container">
                    <table className="result-table">
                      <thead>
                        <tr>
                          {Object.keys(queryResults.result[0]).map(key => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResults.result.map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, i) => (
                              <td key={i}>{formatResult(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-results">
                    <Icon name="database" size={24} />
                    <p>Query executed successfully but returned no results</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="error-message">
                <Icon name="alert-triangle" size={20} />
                <pre>{queryResults.error}</pre>
              </div>
            )}
          </div>
        )}

        {queryHistory.length > 0 && (
          <div className="query-history-section">
            <h3>
              <Icon name="clock" size={20} />
              Query History
            </h3>
            <div className="history-list">
              {queryHistory.map(entry => (
                <div key={entry.id} className="history-entry">
                  <div className="history-header">
                    <span className="history-time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="history-user">User ID: {entry.userId}</span>
                    <button
                      onClick={() => loadHistoryQuery(entry)}
                      className="load-button"
                    >
                      <Icon name="upload" size={14} />
                      Load
                    </button>
                  </div>
                  <div className="history-query">
                    <code>{entry.query.substring(0, 100)}{entry.query.length > 100 ? '...' : ''}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminQueryTester