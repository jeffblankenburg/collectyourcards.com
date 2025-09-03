/**
 * Singleton Prisma Client for Production
 * This ensures only ONE Prisma instance exists across the entire application
 */

const { PrismaClient } = require('@prisma/client')

let prisma = null

// Production connection pool configuration
const productionConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  // Connection pool is configured via DATABASE_URL parameters
}

// Connection pool is configured via DATABASE_URL parameters:
// ?pool_max=25&pool_min=5&pool_idle_timeout=60000&connectionTimeout=30000

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient(productionConfig)
    
    // Log connection info in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Prisma Client initialized (singleton)')
    }
    
    // Ensure proper cleanup on exit
    process.on('beforeExit', async () => {
      await prisma.$disconnect()
    })
    
    // Handle termination signals
    process.on('SIGINT', async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  }
  
  return prisma
}

// Export singleton getter
module.exports = { getPrismaClient }

// Also export a direct reference for backwards compatibility
module.exports.prisma = getPrismaClient()