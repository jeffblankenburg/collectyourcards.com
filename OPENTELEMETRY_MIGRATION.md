# OpenTelemetry Migration Guide

## Overview
This guide covers migrating from Dynatrace OneAgent SDK to OpenTelemetry with Azure Application Insights integration.

## Why Migrate?

### Benefits of OpenTelemetry
- ✅ **Vendor-neutral**: Export to any backend (Application Insights, Datadog, Dynatrace, etc.)
- ✅ **Better Azure integration**: Native Application Insights support
- ✅ **Auto-instrumentation**: Automatic Express, HTTP, and database tracking
- ✅ **Modern standard**: CNCF-backed open source project
- ✅ **Lighter weight**: No agent installation required
- ✅ **Free**: No licensing costs
- ✅ **Better tracing**: Distributed tracing built-in
- ✅ **More community support**: Larger ecosystem

### What You Keep
- ✅ All custom event tracking (auth, API, database, etc.)
- ✅ Same API for tracking events
- ✅ Same middleware patterns
- ✅ System metrics
- ✅ Performance monitoring

### What You Gain
- ✅ Automatic HTTP request tracing
- ✅ Automatic database query tracing
- ✅ Distributed tracing across services
- ✅ Better error tracking
- ✅ Native Azure Application Insights dashboards
- ✅ Correlation IDs for request tracking

## Migration Steps

### Step 1: Install OpenTelemetry Packages

```bash
# Install core OpenTelemetry packages
npm install @opentelemetry/api \
            @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/sdk-metrics \
            @opentelemetry/sdk-trace-base \
            @opentelemetry/resources \
            @opentelemetry/semantic-conventions

# Install Azure Monitor exporter
npm install @azure/monitor-opentelemetry-exporter

# Remove Dynatrace package
npm uninstall @dynatrace/oneagent-sdk
```

### Step 2: Set Up Azure Application Insights

#### Create Application Insights Resource

```bash
# Using Azure CLI
az monitor app-insights component create \
  --app collectyourcards-insights \
  --location eastus \
  --resource-group your-resource-group \
  --application-type Node.JS

# Get the connection string
az monitor app-insights component show \
  --app collectyourcards-insights \
  --resource-group your-resource-group \
  --query connectionString -o tsv
```

#### Add Environment Variable

In Azure Portal → App Service → Configuration → Application settings:

```
Name: APPLICATIONINSIGHTS_CONNECTION_STRING
Value: InstrumentationKey=xxx;IngestionEndpoint=https://...;LiveEndpoint=https://...
```

For local development, add to `.env`:
```bash
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..."
SERVICE_NAME="collect-your-cards-api"
NODE_ENV="development"
```

### Step 3: Update Code References

#### Replace in `server/server-setup.js`

**OLD:**
```javascript
const dynatraceService = require('./services/dynatraceService');
app.use(dynatraceService.expressMiddleware());
```

**NEW:**
```javascript
const telemetryService = require('./services/telemetryService');
app.use(telemetryService.expressMiddleware());
```

#### Replace in `server/routes/auth.js`

**OLD:**
```javascript
const dynatraceService = require('../services/dynatraceService')

dynatraceService.trackAuthEvent(eventType, userId, email, success, {
  ip: req?.ip,
  userAgent: req?.get('User-Agent'),
  error: errorMessage
})
```

**NEW:**
```javascript
const telemetryService = require('../services/telemetryService')

telemetryService.trackAuthEvent(eventType, userId, email, success, {
  ip: req?.ip,
  userAgent: req?.get('User-Agent'),
  error: errorMessage
})
```

#### Replace in `server/routes/status.js`

**OLD:**
```javascript
const dynatraceService = require('../services/dynatraceService')

monitoring: dynatraceService.getStatus()
```

**NEW:**
```javascript
const telemetryService = require('../services/telemetryService')

monitoring: telemetryService.getStatus()
```

### Step 4: Delete Old Files

```bash
# Remove Dynatrace service
rm server/services/dynatraceService.js

# Remove old documentation (optional - or update it)
rm DYNATRACE_SETUP_GUIDE.md

# Remove Docker monitoring config if not using
rm docker-compose.monitoring.yml
```

### Step 5: Update package.json Scripts (Optional)

Add useful scripts for local development:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development nodemon server/server.js",
    "start": "NODE_ENV=production node server/server.js"
  }
}
```

### Step 6: Deploy and Verify

```bash
# Commit changes
git add .
git commit -m "Migrate from Dynatrace to OpenTelemetry with Application Insights"

# Push to trigger deployment
git push origin main

# Watch logs
az webapp log tail --name collectyourcards --resource-group your-resource-group
```

Look for:
```
🔍 OpenTelemetry initialized successfully - exporting to Azure Application Insights
```

## Viewing Your Telemetry

### In Azure Portal

1. **Go to Application Insights** → `collectyourcards-insights`

2. **Performance**: See request durations, dependencies, failures
   - Auto-tracked: All HTTP requests
   - Auto-tracked: All database queries
   - Custom metrics: Auth events, collection events, etc.

3. **Failures**: See errors with full stack traces
   - Automatic exception tracking
   - Correlated with requests

4. **Metrics**: Custom metrics and system metrics
   - Memory usage
   - API response times
   - Authentication success rates
   - Database operation duration

5. **Logs**: Query your telemetry data
   ```kusto
   traces
   | where message contains "Auth event"
   | project timestamp, message
   | order by timestamp desc
   ```

6. **Live Metrics**: Real-time telemetry as it happens
   - Request rates
   - Error rates
   - Memory usage
   - Active requests

### Create Custom Dashboard

1. **Go to Dashboards** → **New dashboard**
2. **Add tiles** for:
   - API response time trends
   - Authentication success/failure ratio
   - Database query performance
   - Memory usage over time
   - Error rate

### Set Up Alerts

Example alert for high error rate:

```bash
az monitor metrics alert create \
  --name "High API Error Rate" \
  --resource-group your-resource-group \
  --scopes $(az monitor app-insights component show \
    --app collectyourcards-insights \
    --resource-group your-resource-group \
    --query id -o tsv) \
  --condition "avg requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email your@email.com
```

## Query Examples (KQL)

### API Performance by Endpoint
```kusto
requests
| summarize avg(duration), count() by name
| order by avg_duration desc
```

### Authentication Events
```kusto
traces
| where message contains "Auth event"
| extend eventType = extract("event: (\\w+)", 1, message)
| summarize count() by eventType, bin(timestamp, 1h)
```

### Database Operation Performance
```kusto
dependencies
| where type == "SQL"
| summarize avg(duration), count() by target
| order by avg_duration desc
```

### Failed Requests with Context
```kusto
requests
| where success == false
| join kind=inner (traces) on operation_Id
| project timestamp, name, resultCode, message
```

### Memory Usage Trends
```kusto
customMetrics
| where name == "system.memory.usage"
| summarize avg(value) by type, bin(timestamp, 5m)
| render timechart
```

## What Auto-Instrumentation Gives You

OpenTelemetry auto-instruments these automatically:

### HTTP Requests
- All incoming requests to Express
- All outgoing HTTP calls
- Response times, status codes
- Request/response headers (configurable)

### Database Queries
- SQL queries with timing
- Query parameters (sanitized)
- Connection pool metrics

### Distributed Tracing
- Correlation IDs across services
- Parent-child span relationships
- Full request trace visualization

### Exception Tracking
- Uncaught exceptions
- Handled errors
- Stack traces with source maps

## Comparison: Before vs After

### Before (Dynatrace)
```javascript
// Manual middleware
app.use(dynatraceService.expressMiddleware());

// Manual tracking
dynatraceService.trackAPICall(endpoint, method, time, status, userId)

// Agent required
// Linux container challenges
// Licensing costs
// Single vendor
```

### After (OpenTelemetry)
```javascript
// Auto-instrumentation handles most tracking
// Custom events for business logic
telemetryService.trackAuthEvent(...)

// No agent required
// Works everywhere
// Free and open source
// Multi-vendor support
// Better Azure integration
// More detailed tracing
```

## Development vs Production

### Development Mode
Without `APPLICATIONINSIGHTS_CONNECTION_STRING`:
- Telemetry exports to **console**
- See all events in terminal
- No cost, no configuration needed
- Perfect for local debugging

### Production Mode
With `APPLICATIONINSIGHTS_CONNECTION_STRING`:
- Telemetry exports to **Application Insights**
- Full dashboards and alerting
- Query capabilities
- Long-term storage

## Cost Considerations

### Application Insights Pricing
- **First 5 GB/month**: Free
- **Additional data**: ~$2.30/GB
- **Typical usage**: 2-3 GB/month for small apps
- **Your app**: Likely stays within free tier

### Data Retention
- **Default**: 90 days
- **Extended**: Up to 2 years (additional cost)

### Cost Control
```javascript
// Sample only 10% of requests if needed
instrumentations: [
  getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      requestHook: (span, request) => {
        // Sample only 10% of requests
        if (Math.random() > 0.1) {
          span.setAttribute('sampled', false)
        }
      }
    }
  })
]
```

## Troubleshooting

### "OpenTelemetry initialization failed"
- Check `APPLICATIONINSIGHTS_CONNECTION_STRING` is set correctly
- Verify connection string format
- Ensure Azure resource exists

### "No telemetry appearing in Application Insights"
- Wait 2-3 minutes for initial data
- Check connection string is correct
- Verify app is making requests
- Check Azure Portal → Application Insights → Live Metrics

### "Too much telemetry data"
- Adjust sampling rate
- Filter noisy endpoints
- Disable auto-instrumentation for specific libraries

## Migration Checklist

- [ ] Install OpenTelemetry packages
- [ ] Create Application Insights resource
- [ ] Get connection string
- [ ] Add `APPLICATIONINSIGHTS_CONNECTION_STRING` to Azure
- [ ] Replace `dynatraceService` with `telemetryService` in code
- [ ] Update `server-setup.js`
- [ ] Update `auth.js`
- [ ] Update `status.js`
- [ ] Remove old `dynatraceService.js` file
- [ ] Uninstall `@dynatrace/oneagent-sdk`
- [ ] Test locally
- [ ] Deploy to production
- [ ] Verify telemetry in Application Insights
- [ ] Create custom dashboard
- [ ] Set up alerts

## Next Steps

1. **Create custom dashboards** for your business metrics
2. **Set up alerts** for critical issues
3. **Explore distributed tracing** for complex operations
4. **Add custom spans** for detailed operation tracking
5. **Integrate with Azure Monitor** for infrastructure metrics

## Support Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/instrumentation/js/)
- [Azure Monitor OpenTelemetry](https://docs.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable)
- [Application Insights Queries](https://docs.microsoft.com/en-us/azure/azure-monitor/logs/get-started-queries)
- [KQL Reference](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/)
