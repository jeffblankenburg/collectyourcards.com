#!/usr/bin/env node

/**
 * Script to optimize database connections in production
 * This updates the DATABASE_URL to include proper connection pooling settings
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 Optimizing production database connections...\n')

// Connection pool settings for production
const poolSettings = {
  pool_max: 10,               // Maximum connections in pool
  pool_min: 2,                // Minimum connections to maintain
  pool_idle_timeout: 60000,   // Idle timeout (1 minute)
  connectionTimeout: 30000,   // Connection timeout (30 seconds)
  pool_acquire_timeout: 60000 // Acquire timeout (1 minute)
}

// Parse existing DATABASE_URL
function updateDatabaseUrl(url) {
  // Check if URL already has pool settings
  if (url.includes('pool_max')) {
    console.log('⚠️  Connection pool settings already present in DATABASE_URL')
    return url
  }

  // Add pool settings to the URL
  const separator = url.includes('?') ? ';' : ';'
  const poolParams = Object.entries(poolSettings)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
  
  return `${url}${separator}${poolParams}`
}

// Instructions for production deployment
console.log('📋 PRODUCTION DEPLOYMENT INSTRUCTIONS:\n')
console.log('1. Update your Azure App Service configuration:')
console.log('   - Go to Azure Portal > Your App Service > Configuration > Application settings')
console.log('   - Update DATABASE_URL to include these connection pool parameters:\n')

Object.entries(poolSettings).forEach(([key, value]) => {
  console.log(`     ${key}=${value}`)
})

console.log('\n2. Example DATABASE_URL format:')
console.log('   sqlserver://server.database.windows.net:1433;database=CollectYourCards;')
console.log('   user=youruser;password=yourpassword;encrypt=true;trustServerCertificate=false;')
console.log('   connectionTimeout=30000;pool_max=10;pool_min=2;pool_idle_timeout=60000;pool_acquire_timeout=60000\n')

console.log('3. Replace the players-list.js route:')
console.log('   - Upload server/routes/players-list-optimized.js to production')
console.log('   - Rename it to players-list.js to replace the existing file\n')

console.log('4. Upload the new utility file:')
console.log('   - Create server/utils/ directory if it doesn\'t exist')
console.log('   - Upload server/utils/prisma-pool-manager.js\n')

console.log('5. Restart the App Service:')
console.log('   az webapp restart --name collect-your-cards --resource-group collectyourcards-rg\n')

console.log('6. Monitor the application:')
console.log('   az webapp log tail --name collect-your-cards --resource-group collectyourcards-rg\n')

console.log('✅ Script complete. Follow the instructions above to deploy to production.\n')

// Create a deployment checklist
const checklist = `
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
`

fs.writeFileSync('PRODUCTION_DEPLOYMENT_CHECKLIST.md', checklist)
console.log('📝 Created PRODUCTION_DEPLOYMENT_CHECKLIST.md for deployment tracking.\n')