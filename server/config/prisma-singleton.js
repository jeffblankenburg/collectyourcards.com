/**
 * Prisma Singleton - Re-exports from config/prisma.js
 *
 * This file exists for backwards compatibility.
 * All Prisma access should go through config/prisma.js which is the single source of truth.
 */

const prisma = require('./prisma')

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

// Re-export the global prisma instance
module.exports = { prisma, executeWithRetry }

// For backwards compatibility with getPrismaClient() calls
module.exports.getPrismaClient = () => prisma