/**
 * OpenTelemetry Service
 *
 * Provides observability for the CollectYourCards.com application.
 * Tracks traces, metrics, and custom events with Azure Application Insights integration.
 *
 * Features:
 * - Automatic Express.js instrumentation
 * - Custom business events (auth, collection, import)
 * - Performance metrics
 * - Distributed tracing
 * - Azure Application Insights export
 */

const { NodeSDK } = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { AzureMonitorTraceExporter } = require('@azure/monitor-opentelemetry-exporter')
const { Resource } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const { metrics, trace } = require('@opentelemetry/api')
const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base')
const { PeriodicExportingMetricReader, ConsoleMetricExporter } = require('@opentelemetry/sdk-metrics')

class TelemetryService {
  constructor() {
    this.sdk = null
    this.meter = null
    this.tracer = null
    this.isEnabled = false
    this.eventStats = {
      totalEvents: 0,
      eventTypes: {},
      lastEventTime: null,
      startTime: new Date()
    }

    // Custom metrics
    this.metrics = {
      apiCalls: null,
      authEvents: null,
      databaseOperations: null,
      systemMemory: null
    }
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  init() {
    try {
      const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
      const serviceName = process.env.SERVICE_NAME || 'collect-your-cards-api'
      const environment = process.env.NODE_ENV || 'development'

      // Create resource with service information
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
        })
      )

      // Configure exporters based on environment
      const traceExporter = connectionString
        ? new AzureMonitorTraceExporter({ connectionString })
        : new ConsoleSpanExporter()

      const metricReader = connectionString
        ? new PeriodicExportingMetricReader({
            exporter: new AzureMonitorTraceExporter({ connectionString }),
            exportIntervalMillis: 60000 // Export every 60 seconds
          })
        : new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: 60000
          })

      // Initialize SDK with auto-instrumentation
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Customize auto-instrumentation
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingPaths: ['/health', '/api/health']
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true
            },
            '@opentelemetry/instrumentation-fs': {
              enabled: false // Usually too noisy
            }
          })
        ]
      })

      this.sdk.start()

      // Get meter and tracer for custom instrumentation
      this.meter = metrics.getMeter(serviceName)
      this.tracer = trace.getTracer(serviceName)

      // Initialize custom metrics
      this.initializeMetrics()

      this.isEnabled = true

      const mode = connectionString ? 'Azure Application Insights' : 'console (development mode)'
      console.log(`🔍 OpenTelemetry initialized successfully - exporting to ${mode}`)

    } catch (error) {
      console.warn('⚠️ OpenTelemetry initialization failed:', error.message)
      console.warn('   Telemetry will be disabled. Check your configuration.')
      this.isEnabled = false
    }
  }

  /**
   * Initialize custom metrics
   */
  initializeMetrics() {
    if (!this.meter) return

    // API call metrics
    this.metrics.apiCalls = this.meter.createHistogram('api.request.duration', {
      description: 'API request duration in milliseconds',
      unit: 'ms'
    })

    this.metrics.apiCallCount = this.meter.createCounter('api.request.count', {
      description: 'Total number of API requests',
      unit: 'requests'
    })

    // Authentication metrics
    this.metrics.authEvents = this.meter.createCounter('auth.events', {
      description: 'Authentication events (login, registration, etc.)',
      unit: 'events'
    })

    // Database operation metrics
    this.metrics.databaseOperations = this.meter.createHistogram('database.operation.duration', {
      description: 'Database operation duration in milliseconds',
      unit: 'ms'
    })

    // System memory gauge (observable)
    this.meter.createObservableGauge('system.memory.usage', {
      description: 'Memory usage in MB',
      unit: 'MB'
    }).addCallback(result => {
      const memUsage = process.memoryUsage()
      result.observe(Math.round(memUsage.rss / 1024 / 1024), { type: 'rss' })
      result.observe(Math.round(memUsage.heapUsed / 1024 / 1024), { type: 'heap_used' })
      result.observe(Math.round(memUsage.heapTotal / 1024 / 1024), { type: 'heap_total' })
    })

    // System uptime gauge
    this.meter.createObservableGauge('system.uptime', {
      description: 'Process uptime in seconds',
      unit: 's'
    }).addCallback(result => {
      result.observe(Math.round(process.uptime()))
    })
  }

  /**
   * Track authentication events
   */
  trackAuthEvent(eventType, userId, email, success, details = {}) {
    if (!this.isEnabled) return

    try {
      const span = this.tracer.startSpan('auth.event', {
        attributes: {
          'auth.event_type': eventType,
          'auth.user_id': userId?.toString() || 'unknown',
          'auth.email': email,
          'auth.success': success,
          'auth.ip_address': details.ip || 'unknown',
          'auth.user_agent': details.userAgent || 'unknown',
          'auth.error': details.error || ''
        }
      })

      // Record metric
      if (this.metrics.authEvents) {
        this.metrics.authEvents.add(1, {
          event_type: eventType,
          success: success.toString()
        })
      }

      // Update internal stats
      this.updateStats('auth_event')

      span.end()

      console.log(`📊 Auth event: ${eventType} - ${success ? 'success' : 'failure'}`)
    } catch (error) {
      console.error('Failed to track auth event:', error)
    }
  }

  /**
   * Track API call performance
   */
  trackAPICall(endpoint, method, responseTime, statusCode, userId = null) {
    if (!this.isEnabled) return

    try {
      const attributes = {
        'http.route': endpoint,
        'http.method': method,
        'http.status_code': statusCode,
        'http.user_id': userId?.toString() || 'anonymous'
      }

      // Record histogram
      if (this.metrics.apiCalls) {
        this.metrics.apiCalls.record(responseTime, attributes)
      }

      // Record counter
      if (this.metrics.apiCallCount) {
        this.metrics.apiCallCount.add(1, attributes)
      }

      this.updateStats('api_call')
    } catch (error) {
      console.error('Failed to track API call:', error)
    }
  }

  /**
   * Track database operations
   */
  trackDatabaseOperation(operation, table, duration, success, recordCount = null) {
    if (!this.isEnabled) return

    try {
      const attributes = {
        'db.operation': operation,
        'db.table': table,
        'db.success': success.toString()
      }

      if (recordCount !== null) {
        attributes['db.record_count'] = recordCount
      }

      // Record histogram
      if (this.metrics.databaseOperations) {
        this.metrics.databaseOperations.record(duration, attributes)
      }

      this.updateStats('database_operation')
    } catch (error) {
      console.error('Failed to track database operation:', error)
    }
  }

  /**
   * Track email events
   */
  trackEmailEvent(eventType, recipient, emailType, success, details = {}) {
    if (!this.isEnabled) return

    try {
      const span = this.tracer.startSpan('email.event', {
        attributes: {
          'email.event_type': eventType,
          'email.recipient': recipient,
          'email.type': emailType,
          'email.success': success,
          'email.provider': 'azure_communication',
          ...details
        }
      })

      this.updateStats('email_event')

      span.end()

      console.log(`📧 Email event: ${emailType} to ${recipient} - ${success ? 'sent' : 'failed'}`)
    } catch (error) {
      console.error('Failed to track email event:', error)
    }
  }

  /**
   * Track import job progress
   */
  trackImportProgress(jobId, stage, totalRows, processedRows, errorCount) {
    if (!this.isEnabled) return

    try {
      const span = this.tracer.startSpan('import.progress', {
        attributes: {
          'import.job_id': jobId,
          'import.stage': stage,
          'import.total_rows': totalRows,
          'import.processed_rows': processedRows,
          'import.error_count': errorCount,
          'import.completion_percentage': totalRows > 0 ? (processedRows / totalRows * 100).toFixed(2) : 0
        }
      })

      this.updateStats('import_progress')

      span.end()
    } catch (error) {
      console.error('Failed to track import progress:', error)
    }
  }

  /**
   * Track card collection events
   */
  trackCollectionEvent(eventType, userId, cardId, details = {}) {
    if (!this.isEnabled) return

    try {
      const span = this.tracer.startSpan('collection.event', {
        attributes: {
          'collection.event_type': eventType,
          'collection.user_id': userId?.toString() || 'unknown',
          'collection.card_id': cardId?.toString() || 'unknown',
          ...details
        }
      })

      this.updateStats('collection_event')

      span.end()
    } catch (error) {
      console.error('Failed to track collection event:', error)
    }
  }

  /**
   * Express middleware for automatic request tracking
   */
  expressMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) return next()

      const startTime = Date.now()
      const originalSend = res.send

      // Override res.send to capture response
      res.send = function(data) {
        const responseTime = Date.now() - startTime

        // Track the API call
        telemetryService.trackAPICall(
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

  /**
   * Prisma middleware for database monitoring
   */
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
          null
        )

        if (error) {
          console.error(`Database operation failed: ${params.action} on ${params.model}:`, error)
        }
      }
    }
  }

  /**
   * Update internal statistics
   */
  updateStats(eventType) {
    this.eventStats.totalEvents++
    this.eventStats.eventTypes[eventType] = (this.eventStats.eventTypes[eventType] || 0) + 1
    this.eventStats.lastEventTime = new Date()
  }

  /**
   * Get service status
   */
  getStatus() {
    const uptime = Math.floor((new Date() - this.eventStats.startTime) / 1000)
    const eventsPerMinute = uptime > 0 ? Math.round((this.eventStats.totalEvents / uptime) * 60) : 0

    return {
      telemetry_enabled: this.isEnabled,
      framework: 'OpenTelemetry',
      version: require('@opentelemetry/api').version,
      exporter: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'Azure Application Insights' : 'Console',
      custom_events_tracked: [
        'auth_event', 'api_call', 'database_operation',
        'email_event', 'import_progress', 'collection_event'
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

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown()
      console.log('🔍 OpenTelemetry shut down gracefully')
    }
  }
}

// Create singleton instance
const telemetryService = new TelemetryService()

// Initialize on module load
telemetryService.init()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await telemetryService.shutdown()
})

module.exports = telemetryService
