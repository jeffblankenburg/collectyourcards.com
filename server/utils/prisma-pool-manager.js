const { PrismaClient } = require('@prisma/client')

// Global Prisma instance with optimized connection settings
let globalPrisma = null

function getPrismaClient() {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // Connection pool configuration for production
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })

    // Ensure connection pool is configured properly
    globalPrisma.$connect().catch(err => {
      console.error('Failed to connect to database:', err)
      process.exit(1)
    })

    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await globalPrisma.$disconnect()
    })
  }

  return globalPrisma
}

// Helper function to run queries in batches to avoid connection exhaustion
async function runBatchedQueries(items, queryFunction, batchSize = 5) {
  const results = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(item => queryFunction(item))
    )
    results.push(...batchResults)
  }
  
  return results
}

// Helper function to run a single query with retry logic
async function runQueryWithRetry(queryFunction, maxRetries = 3, delayMs = 1000) {
  let lastError = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFunction()
    } catch (error) {
      lastError = error
      
      // Check if it's a connection pool error
      if (error.code === 'P2024') {
        console.warn(`Connection pool exhausted, attempt ${attempt}/${maxRetries}`)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
          continue
        }
      }
      
      throw error
    }
  }
  
  throw lastError
}

module.exports = {
  getPrismaClient,
  runBatchedQueries,
  runQueryWithRetry
}