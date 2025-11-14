/**
 * Telemetry Test Script
 *
 * Tests OpenTelemetry configuration by sending test logs, traces, and metrics to Dynatrace.
 * Run this script to verify your Dynatrace integration is working.
 *
 * Usage: node test-telemetry.js
 */

require('dotenv').config()
const telemetryService = require('./server/services/telemetryService')

console.log('\n🧪 Starting Telemetry Test...\n')

// Wait for telemetry to initialize
setTimeout(() => {
  console.log('📋 Telemetry Status:')
  const status = telemetryService.getStatus()
  console.log(JSON.stringify(status, null, 2))
  console.log('\n')

  // Test different log levels
  console.log('📝 Testing log levels...\n')

  telemetryService.logInfo('Test INFO log - Application started', {
    test_type: 'telemetry_test',
    timestamp: new Date().toISOString()
  })

  telemetryService.logWarn('Test WARN log - High memory usage detected', {
    test_type: 'telemetry_test',
    memory_usage_mb: 256
  })

  telemetryService.logError('Test ERROR log - Database connection failed', new Error('Connection timeout'), {
    test_type: 'telemetry_test',
    connection_string: 'hidden'
  })

  telemetryService.logDebug('Test DEBUG log - SQL query executed', {
    test_type: 'telemetry_test',
    query: 'SELECT * FROM player',
    duration_ms: 45
  })

  // Test auth event
  console.log('🔐 Testing auth event...\n')
  telemetryService.trackAuthEvent('login', 1, 'test@example.com', true, {
    ip: '127.0.0.1',
    userAgent: 'test-script'
  })

  // Test API call
  console.log('🌐 Testing API call tracking...\n')
  telemetryService.trackAPICall('/api/test', 'GET', 125, 200, 1)

  // Test database operation
  console.log('💾 Testing database operation...\n')
  telemetryService.trackDatabaseOperation('SELECT', 'player', 45, true, 100)

  console.log('✅ All test events sent!\n')
  console.log('⏳ Waiting 10 seconds for data to export to Dynatrace...\n')

  // Give time for batching and export
  setTimeout(async () => {
    console.log('📊 Final statistics:')
    const finalStatus = telemetryService.getStatus()
    console.log(JSON.stringify(finalStatus.statistics, null, 2))

    console.log('\n🎉 Test complete! Check your Dynatrace tenant for:')
    console.log('   - Traces at: https://ncp88608.apps.dynatrace.com/ui/distributed-tracing')
    console.log('   - Metrics at: https://ncp88608.apps.dynatrace.com/ui/metrics')
    console.log('   - Logs at: https://ncp88608.apps.dynatrace.com/ui/log-monitoring')
    console.log('\n   Service Name: collect-your-cards-api')
    console.log('   Environment: development')
    console.log('   Test Type Attribute: telemetry_test\n')

    // Graceful shutdown
    console.log('🛑 Shutting down telemetry service...\n')
    await telemetryService.shutdown()

    console.log('✨ Done!\n')
    process.exit(0)
  }, 10000)
}, 1000)
