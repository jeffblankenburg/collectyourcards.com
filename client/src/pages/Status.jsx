import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './Status.css'

function Status() {
  const [systemStatus, setSystemStatus] = useState({
    loading: true,
    frontend: { status: 'checking' },
    backend: { status: 'checking' },
    database: { status: 'checking' },
    endpoints: [],
    environment: {},
    performance: {},
    errors: []
  })

  useEffect(() => {
    checkAllSystems()
    const interval = setInterval(checkAllSystems, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const checkAllSystems = async () => {
    const startTime = Date.now()
    const status = {
      loading: false,
      frontend: { status: 'operational', version: '1.0.0', timestamp: new Date().toISOString() },
      backend: { status: 'checking' },
      database: { status: 'checking' },
      endpoints: [],
      environment: {},
      performance: {},
      errors: []
    }

    try {
      // Check backend health
      const healthResponse = await axios.get('/api/health')
      status.backend = {
        status: 'operational',
        ...healthResponse.data,
        responseTime: Date.now() - startTime + 'ms'
      }

      // Check database status
      try {
        const dbResponse = await axios.get('/api/database/status')
        status.database = {
          status: 'operational',
          ...dbResponse.data
        }
      } catch (dbError) {
        status.database = {
          status: 'error',
          message: 'Database check failed',
          error: dbError.message
        }
        status.errors.push({ component: 'database', error: dbError.message })
      }

      // Check all API endpoints
      try {
        const endpointsResponse = await axios.get('/api/endpoints/status')
        status.endpoints = endpointsResponse.data.endpoints || []
      } catch (endpointsError) {
        status.endpoints = []
        status.errors.push({ component: 'endpoints', error: endpointsError.message })
      }

      // Get environment info
      try {
        const envResponse = await axios.get('/api/environment')
        status.environment = envResponse.data
      } catch (envError) {
        status.environment = { error: 'Could not fetch environment data' }
      }

      // Get Dynatrace monitoring status
      try {
        const dynatraceResponse = await axios.get('/api/dynatrace/status')
        status.dynatrace = {
          status: 'operational',
          ...dynatraceResponse.data
        }
      } catch (dynatraceError) {
        status.dynatrace = {
          status: 'error',
          message: 'Could not fetch Dynatrace status',
          error: dynatraceError.message
        }
        status.errors.push({ component: 'dynatrace', error: dynatraceError.message })
      }

    } catch (error) {
      status.backend = {
        status: 'error',
        message: 'Backend unreachable',
        error: error.message
      }
      status.database = {
        status: 'unknown',
        message: 'Cannot check - backend offline'
      }
      status.errors.push({ component: 'backend', error: error.message })
    }

    // Calculate overall performance metrics
    status.performance = {
      totalResponseTime: Date.now() - startTime + 'ms',
      timestamp: new Date().toISOString()
    }

    setSystemStatus(status)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational': return '#4CAF50'
      case 'degraded': return '#FFC107'
      case 'error': return '#F44336'
      case 'checking': return '#2196F3'
      default: return '#9E9E9E'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational': return '✅'
      case 'degraded': return '⚠️'
      case 'error': return '❌'
      case 'checking': return '🔄'
      default: return '❓'
    }
  }

  return (
    <div className="status-page">
      <div className="status-header">
        <h1>System Status Dashboard</h1>
        <button onClick={checkAllSystems} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {systemStatus.loading ? (
        <div className="loading">Checking all systems...</div>
      ) : (
        <>
          <div className="status-summary">
            <h2>Core Services</h2>
            <div className="status-grid">
              <div className="status-card">
                <h3>Frontend</h3>
                <div className="status-indicator" style={{ backgroundColor: getStatusColor(systemStatus.frontend.status) }}>
                  <span>{getStatusIcon(systemStatus.frontend.status)}</span>
                  <span>{systemStatus.frontend.status.toUpperCase()}</span>
                </div>
                <div className="status-details">
                  <p>Version: {systemStatus.frontend.version}</p>
                  <p>Port: 5174</p>
                </div>
              </div>

              <div className="status-card">
                <h3>Backend API</h3>
                <div className="status-indicator" style={{ backgroundColor: getStatusColor(systemStatus.backend.status) }}>
                  <span>{getStatusIcon(systemStatus.backend.status)}</span>
                  <span>{systemStatus.backend.status.toUpperCase()}</span>
                </div>
                <div className="status-details">
                  {systemStatus.backend.responseTime && <p>Response: {systemStatus.backend.responseTime}</p>}
                  {systemStatus.backend.environment && <p>Environment: {systemStatus.backend.environment}</p>}
                  <p>Port: 3001</p>
                </div>
              </div>

              <div className="status-card">
                <h3>Database</h3>
                <div className="status-indicator" style={{ backgroundColor: getStatusColor(systemStatus.database.status) }}>
                  <span>{getStatusIcon(systemStatus.database.status)}</span>
                  <span>{systemStatus.database.status.toUpperCase()}</span>
                </div>
                <div className="status-details">
                  {systemStatus.database.type && <p>Type: {systemStatus.database.type}</p>}
                  {systemStatus.database.tables && <p>Tables: {systemStatus.database.tables}</p>}
                  {systemStatus.database.records && (
                    <div>
                      <p>Cards: {systemStatus.database.records.cards || 0}</p>
                      <p>Players: {systemStatus.database.records.players || 0}</p>
                      <p>Teams: {systemStatus.database.records.teams || 0}</p>
                    </div>
                  )}
                  <p>Port: 1433 (Docker)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="endpoints-section">
            <h2>API Endpoints</h2>
            {systemStatus.endpoints.length > 0 ? (
              <div className="endpoints-grid">
                {systemStatus.endpoints.map((endpoint, index) => (
                  <div key={index} className="endpoint-card">
                    <div className="endpoint-header">
                      <span className="endpoint-method">{endpoint.method}</span>
                      <span className="endpoint-path">{endpoint.path}</span>
                    </div>
                    <div className="endpoint-status">
                      <span>{getStatusIcon(endpoint.status)}</span>
                      <span>{endpoint.status}</span>
                      {endpoint.responseTime && <span>{endpoint.responseTime}ms</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-endpoints">No endpoint monitoring data available</p>
            )}
          </div>

          {systemStatus.environment && Object.keys(systemStatus.environment).length > 0 && (
            <div className="environment-section">
              <h2>Environment Information</h2>
              <div className="environment-grid">
                {Object.entries(systemStatus.environment).map(([key, value]) => (
                  <div key={key} className="environment-item">
                    <span className="env-key">{key}:</span>
                    <span className="env-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {systemStatus.errors.length > 0 && (
            <div className="errors-section">
              <h2>Errors & Warnings</h2>
              <div className="errors-list">
                {systemStatus.errors.map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-component">{error.component}:</span>
                    <span className="error-message">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {systemStatus.dynatrace && (
            <div className="dynatrace-section">
              <h2>Dynatrace Monitoring</h2>
              
              <div className="status-grid">
                <div className="status-card">
                  <h3>Monitoring Status</h3>
                  <div className="status-indicator" style={{ backgroundColor: getStatusColor(systemStatus.dynatrace.status) }}>
                    <span>{getStatusIcon(systemStatus.dynatrace.status)}</span>
                    <span>{systemStatus.dynatrace.status.toUpperCase()}</span>
                  </div>
                  <div className="status-details">
                    <p>Enabled: {systemStatus.dynatrace.dynatrace_enabled ? 'Yes' : 'No'}</p>
                    <p>SDK: {systemStatus.dynatrace.sdk_version || 'Not initialized'}</p>
                    <p>State: {systemStatus.dynatrace.agent_state || 'Unknown'}</p>
                  </div>
                </div>

                {systemStatus.dynatrace.environment_config && (
                  <div className="status-card">
                    <h3>Environment Config</h3>
                    <div className="status-details">
                      <p><strong>Environment:</strong> {systemStatus.dynatrace.environment_config.DYNATRACE_ENVIRONMENT_ID}</p>
                      <p><strong>Endpoint:</strong> {systemStatus.dynatrace.environment_config.DYNATRACE_ENDPOINT}</p>
                      <p><strong>API Token:</strong> {systemStatus.dynatrace.environment_config.DYNATRACE_API_TOKEN}</p>
                      <p><strong>PaaS Token:</strong> {systemStatus.dynatrace.environment_config.DYNATRACE_PAAS_TOKEN}</p>
                    </div>
                  </div>
                )}

                {systemStatus.dynatrace.statistics && (
                  <div className="status-card">
                    <h3>Event Statistics</h3>
                    <div className="status-details">
                      <p><strong>Total Events:</strong> {systemStatus.dynatrace.statistics.total_events}</p>
                      <p><strong>Events/Min:</strong> {systemStatus.dynatrace.statistics.events_per_minute}</p>
                      <p><strong>Uptime:</strong> {systemStatus.dynatrace.statistics.uptime_seconds}s</p>
                      <p><strong>Last Event:</strong> {systemStatus.dynatrace.statistics.last_event_time ? new Date(systemStatus.dynatrace.statistics.last_event_time).toLocaleTimeString() : 'None'}</p>
                    </div>
                  </div>
                )}
              </div>

              {systemStatus.dynatrace.statistics?.events_by_type && Object.keys(systemStatus.dynatrace.statistics.events_by_type).length > 0 && (
                <div className="event-types-section">
                  <h3>Event Types</h3>
                  <div className="event-types-grid">
                    {Object.entries(systemStatus.dynatrace.statistics.events_by_type).map(([eventType, count]) => (
                      <div key={eventType} className="event-type-item">
                        <span className="event-type-name">{eventType}:</span>
                        <span className="event-type-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {systemStatus.dynatrace.real_environment_detected && systemStatus.dynatrace.dashboard_url && (
                <div className="dynatrace-links">
                  <h3>Quick Links</h3>
                  <div className="link-buttons">
                    <a href={systemStatus.dynatrace.dashboard_url} target="_blank" rel="noopener noreferrer" className="dynatrace-link">
                      🚀 Open Dynatrace Dashboard
                    </a>
                    <a href="/DYNATRACE_SETUP_GUIDE.md" target="_blank" rel="noopener noreferrer" className="setup-link">
                      📖 Setup Guide
                    </a>
                  </div>
                </div>
              )}

              {systemStatus.dynatrace.troubleshooting && systemStatus.dynatrace.troubleshooting.length > 0 && (
                <div className="troubleshooting-section">
                  <h3>Troubleshooting</h3>
                  <ul className="troubleshooting-list">
                    {systemStatus.dynatrace.troubleshooting.map((issue, index) => (
                      <li key={index} className="troubleshooting-item">⚠️ {issue}</li>
                    ))}
                  </ul>
                  <p className="data-delay-note">
                    📅 <strong>Note:</strong> {systemStatus.dynatrace.expected_data_delay}
                  </p>
                </div>
              )}

              {systemStatus.dynatrace.recent_events && systemStatus.dynatrace.recent_events.length > 0 && (
                <div className="recent-events-section">
                  <h3>Monitoring Info</h3>
                  <ul className="recent-events-list">
                    {systemStatus.dynatrace.recent_events.map((event, index) => (
                      <li key={index} className="recent-event-item">💡 {event}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="performance-section">
            <h2>Performance Metrics</h2>
            <div className="performance-grid">
              <div className="metric-item">
                <span className="metric-label">Total Check Time:</span>
                <span className="metric-value">{systemStatus.performance.totalResponseTime}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Last Updated:</span>
                <span className="metric-value">{new Date(systemStatus.performance.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Status