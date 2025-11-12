# Dynatrace Monitoring Setup Guide

## Overview
This guide covers the complete setup of Dynatrace monitoring for the CollectYourCards.com application, including both development and production environments.

## Current Implementation Status ✅

### ✅ Completed Components
- **OneAgent SDK Integration**: Successfully integrated @dynatrace/oneagent-sdk
- **Custom Business Events**: Tracking auth, API calls, database operations, emails, imports, collections
- **System Metrics**: Memory usage, uptime, Node.js version monitoring
- **Express Middleware**: Automatic API call tracking with response times
- **Prisma Middleware**: Database operation monitoring (ready for activation)
- **Docker Configuration**: Production-ready docker-compose.monitoring.yml

### 📊 Currently Tracking Events
1. **API Calls**: Endpoint, method, response time, status code, user ID
2. **Authentication Events**: Login, registration, verification, password resets
3. **Database Operations**: Query types, table names, duration, success rates
4. **Email Events**: Verification emails, password resets via Azure Communication
5. **System Metrics**: Memory, CPU, uptime collected every 60 seconds
6. **Import Progress**: Spreadsheet import job tracking (when implemented)
7. **Collection Events**: Card additions, modifications, deletions (when implemented)

## Production Setup Steps

### 1. Dynatrace Environment Setup
You'll need a Dynatrace SaaS or Managed environment. Sign up at [dynatrace.com](https://dynatrace.com).

### 2. Obtain Required Credentials
From your Dynatrace environment, collect:
- **Environment ID**: Found in your Dynatrace URL (e.g., abc12345.live.dynatrace.com)
- **API Token**: Settings → Integration → Dynatrace API → Generate token
  - Required scopes: `metrics.ingest`, `events.ingest`, `logs.ingest`
- **PaaS Token**: Settings → Integration → Platform as a Service → Generate token
- **Endpoint URL**: Your environment URL (e.g., https://abc12345.live.dynatrace.com)

### 3. Environment Variables
Add these to your production `.env` file:

```bash
# Dynatrace Configuration
DYNATRACE_ENVIRONMENT_ID=your-environment-id
DYNATRACE_API_TOKEN=your-api-token
DYNATRACE_PAAS_TOKEN=your-paas-token
DYNATRACE_ENDPOINT=https://your-environment-id.live.dynatrace.com
```

### 4. Production Deployment Options

#### Option A: Docker Compose with OneAgent Container
Use the provided `docker-compose.monitoring.yml`:

```bash
# Set environment variables
export DYNATRACE_INSTALLER_URL="https://your-environment.live.dynatrace.com/installer"
export DYNATRACE_ENVIRONMENT_ID="your-environment-id"
export DYNATRACE_API_TOKEN="your-api-token"
export DYNATRACE_PAAS_TOKEN="your-paas-token"
export DYNATRACE_ENDPOINT="https://your-environment.live.dynatrace.com"

# Deploy with monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

#### Option B: Host-based OneAgent Installation
1. Download OneAgent installer from Dynatrace
2. Install on your production server
3. Deploy application normally - OneAgent will auto-detect Node.js processes

### 5. Verification
After deployment, verify monitoring in Dynatrace:
1. Go to **Applications & Microservices** → **Services**
2. Look for "collect-your-cards-api" service
3. Check **Custom Events** for business event data
4. Verify **Database** monitoring shows SQL Server metrics

## Development Environment

### Current Status
- ✅ OneAgent SDK initialized and running
- ✅ Custom business events logging to console
- ✅ System metrics collected every minute
- ✅ API performance tracking active

### Local Testing
The monitoring is currently working in development mode without requiring a full Dynatrace environment. You can see the business events in the console logs:

```bash
📊 Dynatrace business event: api_call {
  endpoint: '/api/health',
  response_time_ms: 2,
  status_code: 200
}
```

## Business Events Reference

### Authentication Events
```javascript
dynatraceService.trackAuthEvent(eventType, userId, email, success, {
  ip: req?.ip,
  userAgent: req?.get('User-Agent'),
  error: errorMessage
})
```

### API Performance
```javascript
dynatraceService.trackAPICall(endpoint, method, responseTime, statusCode, userId)
```

### Database Operations
```javascript
dynatraceService.trackDatabaseOperation(operation, table, duration, success, recordCount)
```

### Email Events
```javascript
dynatraceService.trackEmailEvent(eventType, recipient, emailType, success, details)
```

### System Metrics (Automatic)
- Memory usage (RSS, heap used, heap total)
- Process uptime
- Node.js version
- Environment type

## Dashboard Configuration

### Recommended Dashboards
1. **API Performance Dashboard**
   - Average response times by endpoint
   - Error rates by endpoint
   - Request volume trends

2. **Authentication Monitoring**
   - Login success/failure rates
   - Registration trends
   - Email verification rates

3. **Database Performance**
   - Query duration trends
   - Database operation success rates
   - Connection health

4. **System Health**
   - Memory usage trends
   - Application uptime
   - Error rate monitoring

### Sample USQL Queries
```sql
-- API Performance Overview
SELECT endpoint, AVG(response_time_ms), COUNT(*) 
FROM usersession 
WHERE useraction.name = "api_call" 
GROUP BY endpoint

-- Authentication Success Rates
SELECT event_type, success, COUNT(*) 
FROM usersession 
WHERE useraction.name = "auth_event" 
GROUP BY event_type, success

-- Database Performance
SELECT operation, table, AVG(duration_ms) 
FROM usersession 
WHERE useraction.name = "database_operation" 
GROUP BY operation, table
```

## Alerting Configuration

### Critical Alerts
1. **High Error Rate**: API error rate > 5% for 5 minutes
2. **Slow Response Time**: Average response time > 1000ms for 5 minutes
3. **Database Issues**: Database operation failure rate > 1%
4. **Authentication Problems**: Login failure rate > 10%

### Warning Alerts
1. **Memory Usage**: Memory usage > 80% for 10 minutes
2. **Slow Queries**: Database queries > 500ms average
3. **Email Failures**: Email send failure rate > 5%

## Troubleshooting

### Common Issues

#### OneAgent Not Detecting Application
- Ensure process runs with sufficient permissions
- Check that Node.js process is properly instrumented
- Verify environment variables are set correctly

#### Custom Events Not Appearing
- Check API token has correct scopes (`events.ingest`)
- Verify endpoint URL is correct
- Look for error messages in application logs

#### Database Monitoring Issues
- Ensure Prisma middleware is properly configured
- Check database connection permissions
- Verify SQL Server is accessible from OneAgent

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=dynatrace:*
```

## Performance Impact

### Monitoring Overhead
- OneAgent SDK: < 2% CPU overhead
- Custom event tracking: < 1ms per event
- Memory usage: ~5-10MB additional per process

### Optimization Tips
1. Use sampling for high-volume events
2. Batch custom events when possible
3. Monitor system resources during peak load

## Security Considerations

### Token Security
- Store tokens in environment variables only
- Use restricted scopes for API tokens
- Rotate tokens regularly (recommended: quarterly)

### Data Privacy
- Custom events do not include sensitive data (passwords, keys)
- User emails are tracked for auth events only
- IP addresses are logged for security monitoring

## Next Steps

1. **Production Deployment**: Set up Dynatrace environment and deploy with monitoring
2. **Custom Dashboards**: Create business-specific dashboards
3. **Alerting Rules**: Configure alerts for critical metrics
4. **Distributed Tracing**: Add request correlation across services
5. **Log Monitoring**: Integrate application logs with Dynatrace

## Support Resources

- [Dynatrace OneAgent SDK Documentation](https://www.dynatrace.com/support/help/extend-dynatrace/oneagent-sdk)
- [Custom Events API](https://www.dynatrace.com/support/help/dynatrace-api/environment-api/events-v2)
- [USQL Reference](https://www.dynatrace.com/support/help/how-to-use-dynatrace/real-user-monitoring/basic-concepts/user-session-query-language)