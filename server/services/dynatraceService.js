const dynatrace = require('@dynatrace/oneagent-sdk')

class DynatraceService {
  constructor() {
    this.api = null
    this.isEnabled = false
    this.eventStats = {
      totalEvents: 0,
      eventTypes: {},
      lastEventTime: null,
      startTime: new Date()
    }
    this.init()
  }

  init() {
    try {
      // Initialize Dynatrace OneAgent SDK
      this.api = dynatrace.createInstance()
      this.isEnabled = true
      console.log('🔍 Dynatrace OneAgent SDK initialized successfully')
    } catch (error) {
      console.warn('⚠️ Dynatrace OneAgent SDK initialization failed:', error.message)
      console.warn('   Monitoring will be disabled. Install OneAgent or check configuration.')
      this.isEnabled = false
    }
  }

  // Custom business event tracking
  addCustomBusinessEvent(eventName, properties = {}) {
    if (!this.isEnabled) return

    try {
      // Add timestamp and source to all events
      const eventData = {
        ...properties,
        timestamp: new Date().toISOString(),
        source: 'collect-your-cards-api'
      }

      // Update event statistics
      this.eventStats.totalEvents++
      this.eventStats.eventTypes[eventName] = (this.eventStats.eventTypes[eventName] || 0) + 1
      this.eventStats.lastEventTime = new Date()

      // Use custom attributes method if available
      if (this.api && typeof this.api.addCustomRequestAttribute === 'function') {
        // Add custom attributes to current request
        Object.keys(eventData).forEach(key => {
          this.api.addCustomRequestAttribute(key, String(eventData[key]))
        })
      }

      console.log(`📊 Dynatrace business event: ${eventName}`, eventData)
    } catch (error) {
      console.error('Failed to add Dynatrace business event:', error)
    }
  }

  // Track authentication events
  trackAuthEvent(eventType, userId, email, success, details = {}) {
    this.addCustomBusinessEvent('auth_event', {
      event_type: eventType,
      user_id: userId,
      email: email,
      success: success,
      ip_address: details.ip,
      user_agent: details.userAgent,
      error_message: details.error
    })
  }

  // Track API performance
  trackAPICall(endpoint, method, responseTime, statusCode, userId = null) {
    this.addCustomBusinessEvent('api_call', {
      endpoint: endpoint,
      http_method: method,
      response_time_ms: responseTime,
      status_code: statusCode,
      user_id: userId
    })
  }

  // Track database operations
  trackDatabaseOperation(operation, table, duration, success, recordCount = null) {
    this.addCustomBusinessEvent('database_operation', {
      operation: operation,
      table: table,
      duration_ms: duration,
      success: success,
      record_count: recordCount
    })
  }

  // Track email events
  trackEmailEvent(eventType, recipient, emailType, success, details = {}) {
    this.addCustomBusinessEvent('email_event', {
      event_type: eventType,
      recipient: recipient,
      email_type: emailType,
      success: success,
      provider: 'azure_communication',
      ...details
    })
  }

  // Track import job progress
  trackImportProgress(jobId, stage, totalRows, processedRows, errorCount) {
    this.addCustomBusinessEvent('import_progress', {
      job_id: jobId,
      stage: stage,
      total_rows: totalRows,
      processed_rows: processedRows,
      error_count: errorCount,
      completion_percentage: totalRows > 0 ? (processedRows / totalRows * 100).toFixed(2) : 0
    })
  }

  // Track card collection events
  trackCollectionEvent(eventType, userId, cardId, details = {}) {
    this.addCustomBusinessEvent('collection_event', {
      event_type: eventType,
      user_id: userId,
      card_id: cardId,
      ...details
    })
  }

  // Track system performance metrics
  trackSystemMetrics() {
    if (!this.isEnabled) return

    try {
      const memUsage = process.memoryUsage()
      const uptime = process.uptime()

      this.addCustomBusinessEvent('system_metrics', {
        memory_rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        memory_heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memory_heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        uptime_seconds: Math.round(uptime),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      })
    } catch (error) {
      console.error('Failed to track system metrics:', error)
    }
  }

  // Express middleware for automatic API monitoring
  expressMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) return next()

      const startTime = Date.now()
      const originalSend = res.send

      // Override res.send to capture response
      res.send = function(data) {
        const responseTime = Date.now() - startTime
        
        // Track the API call
        dynatraceService.trackAPICall(
          req.originalUrl,
          req.method,
          responseTime,
          res.statusCode,
          req.user?.userId || null
        )

        // Call original send
        return originalSend.call(this, data)
      }

      next()
    }
  }

  // Prisma middleware for database monitoring
  prismaMiddleware() {
    return async (params, next) => {
      if (!this.isEnabled) return next(params)

      const startTime = Date.now()
      let success = true
      let error = null

      try {
        const result = await next(params)
        return result
      } catch (err) {
        success = false
        error = err.message
        throw err
      } finally {
        const duration = Date.now() - startTime
        
        this.trackDatabaseOperation(
          params.action,
          params.model,
          duration,
          success,
          null // Record count would need to be extracted from result
        )

        if (error) {
          console.error(`Database operation failed: ${params.action} on ${params.model}:`, error)
        }
      }
    }
  }

  // Health check for monitoring status
  getStatus() {
    const uptime = Math.floor((new Date() - this.eventStats.startTime) / 1000)
    const eventsPerMinute = uptime > 0 ? Math.round((this.eventStats.totalEvents / uptime) * 60) : 0
    
    return {
      dynatrace_enabled: this.isEnabled,
      sdk_version: this.isEnabled ? 'OneAgent SDK 1.5.0' : null,
      agent_state: this.isEnabled ? 'active' : 'disabled',
      custom_events_tracked: [
        'auth_event', 'api_call', 'database_operation', 
        'email_event', 'import_progress', 'collection_event', 'system_metrics'
      ],
      statistics: {
        total_events: this.eventStats.totalEvents,
        events_by_type: this.eventStats.eventTypes,
        last_event_time: this.eventStats.lastEventTime?.toISOString() || null,
        uptime_seconds: uptime,
        events_per_minute: eventsPerMinute,
        service_started: this.eventStats.startTime.toISOString()
      }
    }
  }
}

// Create singleton instance
const dynatraceService = new DynatraceService()

// Start periodic system metrics collection
if (dynatraceService.isEnabled) {
  setInterval(() => {
    dynatraceService.trackSystemMetrics()
  }, 60000) // Every minute
}

module.exports = dynatraceService