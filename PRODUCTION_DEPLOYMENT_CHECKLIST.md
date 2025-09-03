
# Production Deployment Checklist

## Database Connection Optimization

### 1. Update DATABASE_URL in Azure App Service
- [ ] Go to Azure Portal > App Service > Configuration
- [ ] Update DATABASE_URL with connection pool settings:
  - pool_max=10
  - pool_min=2
  - pool_idle_timeout=60000
  - connectionTimeout=30000
  - pool_acquire_timeout=60000

### 2. Deploy Code Changes
- [ ] Upload server/utils/prisma-pool-manager.js
- [ ] Replace server/routes/players-list.js with players-list-optimized.js
- [ ] Verify all files uploaded successfully

### 3. Restart Application
- [ ] Run: az webapp restart --name collect-your-cards --resource-group collectyourcards-rg
- [ ] Monitor logs: az webapp log tail --name collect-your-cards --resource-group collectyourcards-rg

### 4. Verification
- [ ] Test /api/players-list endpoint
- [ ] Check for P2024 errors in logs
- [ ] Monitor connection pool metrics in Dynatrace
- [ ] Verify page load performance

### 5. Rollback Plan
- [ ] Keep backup of original players-list.js
- [ ] Document original DATABASE_URL configuration
- [ ] Have rollback commands ready

## Expected Improvements
- Reduced connection pool exhaustion errors (P2024)
- Faster page load times for player lists
- Better handling of concurrent requests
- Improved overall application stability
