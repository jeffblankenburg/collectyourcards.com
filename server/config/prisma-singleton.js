/**
 * Singleton Prisma Client for Production
 * This ensures only ONE Prisma instance exists across the entire application
 */

const { PrismaClient } = require('@prisma/client')

let prisma = null

// Production connection pool configuration
const productionConfig = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'], // Removed 'query' to reduce log noise
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
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
    
    // Production: Log connection pool status periodically
    if (process.env.NODE_ENV === 'production') {
      console.log('🔗 Prisma Client initialized for production')
      
      // Handle connection errors gracefully
      prisma.$on('error', (e) => {
        console.error('🚨 Prisma connection error:', e.message)
        if (e.message.includes('connection pool') || e.message.includes('P2024')) {
          console.error('⚠️  Connection pool exhausted - consider increasing pool size')
        }
      })
    }
    
    // Ensure proper cleanup on exit
    process.on('beforeExit', async () => {
      console.log('🔌 Disconnecting Prisma client...')
      await prisma.$disconnect()
    })
    
    // Handle termination signals
    process.on('SIGINT', async () => {
      console.log('🔌 SIGINT - Disconnecting Prisma client...')
      await prisma.$disconnect()
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      console.log('🔌 SIGTERM - Disconnecting Prisma client...')
      await prisma.$disconnect()
      process.exit(0)
    })
  }
  
  return prisma
}

// Wrapper for query execution with connection retry logic
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Only retry on connection pool timeouts
      if (error.code === 'P2024' && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Exponential backoff, max 5s
        console.warn(`🔄 Connection pool timeout, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // Re-throw non-retryable errors or if max retries exceeded
      throw error
    }
  }
  
  throw lastError
}

// Export singleton getter
module.exports = { getPrismaClient, executeWithRetry }

// Also export a direct reference for backwards compatibility
module.exports.prisma = getPrismaClient()