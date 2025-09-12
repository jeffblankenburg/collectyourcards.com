# Search Optimization - Connection Pool Fix

## Problem
The current search implementation makes **6 separate database queries** for each search request:
1. `searchCardsByNumberAndPlayer`
2. `searchCardsByNumber`  
3. `searchCardsByType`
4. `searchPlayers`
5. `searchTeams`
6. `searchSeries`

With only 10 connections in the pool and multiple concurrent users, this quickly exhausts available connections, causing P2024 timeout errors.

## Solution
Created `search-optimized.js` that consolidates all searches into a **single UNION ALL query**, reducing database connections by 83% (from 6 to 1).

### Benefits
- **83% reduction** in database connections per search
- **Faster response times** - single round trip to database
- **Better scalability** - can handle 6x more concurrent users
- **Automatic retry logic** for connection pool timeouts
- **Consistent relevance scoring** across all entity types

### Implementation Steps

#### 1. Test in Development First
```javascript
// In server-setup.js, temporarily add both routes:
app.use('/api/search', require('./routes/search'))           // Current
app.use('/api/search-v2', require('./routes/search-optimized')) // New
```

Test the new endpoint:
```
http://localhost:5173/api/search-v2/universal?q=trout&limit=20
```

#### 2. A/B Testing in Production
Deploy with both endpoints active, then gradually shift traffic:
- Monitor performance metrics
- Compare result quality
- Check error rates

#### 3. Full Migration
Once validated:
```javascript
// Replace in server-setup.js:
app.use('/api/search', require('./routes/search-optimized'))
```

## Technical Details

### Before (6 queries)
```
Search: "Mike Trout rookie"
- Query 1: Search cards by number
- Query 2: Search cards by player name  
- Query 3: Search cards by type (rookie)
- Query 4: Search players
- Query 5: Search teams
- Query 6: Search series
Total connections used: 6
```

### After (1 query)
```
Search: "Mike Trout rookie"
- Single UNION ALL query combining all entity searches
Total connections used: 1
```

### Connection Pool Math
- **Pool size**: 10 connections
- **Current**: Each search uses 6 connections = max 1.6 concurrent searches
- **Optimized**: Each search uses 1 connection = max 10 concurrent searches
- **Improvement**: 525% increase in concurrent capacity

## Query Optimization Features

### 1. Relevance Scoring
Each result gets a relevance score based on match quality:
- Exact matches: 100 points
- Primary field matches: 90 points  
- Secondary field matches: 80 points
- Partial matches: 70 points

### 2. Conditional Searches
Only searches requested categories:
- `category=all` - searches everything
- `category=players` - only player search
- `category=cards` - only card search

### 3. Efficient Grouping
Uses STRING_AGG to get all related data in single query:
- Player teams
- Card players
- Series colors

## Monitoring

### Key Metrics to Track
1. **Connection pool usage**: Should drop significantly
2. **P2024 errors**: Should be eliminated
3. **Response times**: Should improve 20-40%
4. **Concurrent users**: Should handle 5x more

### Azure Monitoring Queries
```sql
-- Check connection pool status
SELECT 
  COUNT(*) as active_connections,
  MAX(wait_time) as max_wait_ms,
  AVG(wait_time) as avg_wait_ms
FROM sys.dm_exec_requests
WHERE database_id = DB_ID()

-- Check for blocking
SELECT * FROM sys.dm_exec_requests 
WHERE blocking_session_id > 0
```

## Rollback Plan
If issues occur:
1. Revert server-setup.js to use original search.js
2. Restart Azure App Service
3. Original search will resume (with connection pool issues)

## Future Optimizations
1. **Add caching layer** - Redis cache for common searches
2. **Implement search indexing** - Full-text search indexes
3. **Add connection pooling middleware** - Queue requests when pool is busy
4. **Consider read replicas** - Separate read-only database for searches