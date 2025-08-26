const { PrismaClient } = require('@prisma/client')

// Global optimized Prisma client configuration
// This prevents connection pool exhaustion and improves performance

let prisma

if (process.env.NODE_ENV === 'production') {
  // Production: Single global instance with strict connection limits
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Optimized for Azure SQL Server production
    log: ['error', 'warn'], // Reduce logging in production
    __internal: {
      engine: {
        connectTimeout: 10000,      // 10 second connection timeout
        pool_timeout: 30,           // 30 second pool timeout  
        connection_limit: 10,       // Max 10 connections per instance
        schema_cache_size: 100,     // Cache schema for performance
        query_cache_size: 100       // Cache queries for performance
      }
    }
  })
} else {
  // Development: More permissive but still controlled
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: ['query', 'info', 'warn', 'error'], // Full logging in development
    __internal: {
      engine: {
        connectTimeout: 5000,       // 5 second connection timeout
        pool_timeout: 10,           // 10 second pool timeout
        connection_limit: 5,        // Max 5 connections in dev
        schema_cache_size: 50,      // Smaller cache in dev
        query_cache_size: 50        // Smaller cache in dev
      }
    }
  })
}

// Graceful shutdown handling
process.on('beforeExit', async () => {
  console.log('🔌 Disconnecting Prisma client...')
  await prisma.$disconnect()
})

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, disconnecting Prisma client...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, disconnecting Prisma client...')
  await prisma.$disconnect()
  process.exit(0)
})

// Connection verification with retry logic
async function ensureConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect()
      console.log('✅ Prisma client connected successfully')
      return true
    } catch (error) {
      console.error(`❌ Prisma connection attempt ${i + 1} failed:`, error.message)
      if (i === retries - 1) {
        throw error
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

// Initialize connection
ensureConnection().catch(error => {
  console.error('🚨 Failed to establish database connection:', error.message)
  process.exit(1)
})

module.exports = prisma