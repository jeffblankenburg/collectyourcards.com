# Production Database Connection Optimization Plan

## Critical Issues Found

### 1. Multiple PrismaClient Instances (CRITICAL)
- **34 separate PrismaClient instances** across the application
- Each creates its own connection pool
- Total potential connections: 34 × 3 = **102 connections**
- Azure SQL Database limits vary by tier (typically 60-300 for standard tiers)

### 2. Connection Pool Exhaustion from Promise.all
- `players-list.js`: 50+ parallel queries per request
- `admin-series.js`: N parallel queries for series
- `admin-sets.js`: N parallel queries for year counts
- Multiple other routes with similar patterns

### 3. Concurrency Impact
With dozens of concurrent users:
- Each user spawns multiple connections
- Connection pool exhausts quickly
- All subsequent requests fail with P2024 errors
- Application becomes unresponsive

## Solution Implementation

### Phase 1: Single PrismaClient Instance (IMMEDIATE)

1. **Replace all PrismaClient instances with singleton:**
```javascript
// OLD (in every file)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// NEW
const { prisma } = require('../config/prisma-singleton')
```

Files to update:
- [ ] server/routes/players.js
- [ ] server/routes/series-list.js
- [ ] server/routes/admin-teams.js
- [ ] server/routes/admin-cards.js
- [ ] server/routes/search.js
- [ ] server/routes/admin-colors.js
- [ ] server/routes/user-collection-stats.js
- [ ] server/routes/admin-series.js
- [ ] server/routes/user-cards.js
- [ ] server/routes/spreadsheet-generation.js
- [ ] server/routes/grading-agencies.js
- [ ] server/routes/user-locations.js
- [ ] server/routes/admin-users.js
- [ ] server/routes/admin-analytics.js
- [ ] server/routes/series-by-set.js
- [ ] server/routes/teams-list.js
- [ ] server/routes/sets-list.js
- [ ] server/routes/players-list.js
- [ ] server/routes/card-detail.js
- [ ] server/routes/admin-sets.js
- [ ] server/routes/auth.js
- [ ] server/routes/status.js
- [ ] server/routes/user-collection-cards.js
- [ ] server/routes/simple-card-detail.js
- [ ] server/routes/player-team-search.js
- [ ] server/routes/teams.js
- [ ] server/middleware/auth.js
- [ ] server/routes/admin-players.js
- [ ] server/routes/cards.js

### Phase 2: Optimize DATABASE_URL (IMMEDIATE)

Update Azure App Service configuration:
```
sqlserver://server.database.windows.net:1433;database=CollectYourCards;
user=youruser;password=yourpassword;encrypt=true;trustServerCertificate=false;
connectionTimeout=30000;pool_max=25;pool_min=5;pool_idle_timeout=60000;
pool_acquire_timeout=60000;statement_timeout=30000
```

Key parameters:
- `pool_max=25`: Increase from 3 to 25 connections
- `pool_min=5`: Maintain 5 idle connections
- `pool_idle_timeout=60000`: Keep idle connections for 1 minute
- `statement_timeout=30000`: Kill queries running over 30 seconds

### Phase 3: Replace Promise.all Patterns (HIGH PRIORITY)

1. **players-list.js** - Already have optimized version ready
2. **admin-series.js** - Needs optimization
3. **admin-sets.js** - Needs optimization

### Phase 4: Connection Monitoring

Add connection pool monitoring:
```javascript
// Add to server startup
setInterval(async () => {
  const metrics = await prisma.$metrics.json()
  console.log('Connection pool:', metrics.counters.find(m => m.key === 'prisma_pool_connections_open'))
}, 60000) // Every minute
```

## Azure SQL Database Tier Recommendations

For production with dozens of concurrent users:

### Current Issues:
- Basic/S0 tier: 60 connection limit
- Standard S1: 90 connections
- Standard S2: 120 connections

### Recommended:
- **Standard S3 or higher**: 200+ connections
- **Premium P1**: 300 connections
- **Or use Elastic Pool**: Share connections across databases

### Connection Formula:
```
Required Connections = (Concurrent Users × Avg Queries per Request) / Pool Efficiency
Example: 50 users × 3 queries × 0.5 efficiency = 75 connections needed
```

## Deployment Steps

1. **Test locally first**
2. **Deploy singleton update**
3. **Update DATABASE_URL in Azure**
4. **Deploy optimized routes one by one**
5. **Monitor Dynatrace for improvements**
6. **Scale Azure SQL if needed**

## Expected Results

### Before:
- P2024 errors under moderate load
- 102+ potential connections
- Cascade failures
- Poor user experience

### After:
- Single shared pool of 25 connections
- Efficient connection reuse
- No P2024 errors
- 10x better concurrency handling
- Consistent performance

## Emergency Rollback

If issues occur:
1. Revert DATABASE_URL to original
2. Restart App Service
3. Monitor logs
4. Scale up Azure SQL tier temporarily

## Long-term Optimizations

1. **Implement Redis caching** for frequently accessed data
2. **Use read replicas** for read-heavy queries
3. **Implement connection pooling proxy** (PgBouncer equivalent)
4. **Consider microservices** to isolate connection pools
5. **Implement GraphQL** to reduce query overhead