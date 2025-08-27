#!/usr/bin/env node

/**
 * Series Metadata Update Script
 * 
 * Updates calculated fields in the series table:
 * - print_run_variations, min_print_run, max_print_run, print_run_display
 * - rookie_count
 * 
 * Usage:
 *   node scripts/update-series-metadata.js
 * 
 * Environment variables required:
 *   DATABASE_URL - SQL Server connection string
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function updateSeriesMetadata() {
  const startTime = Date.now()
  
  try {
    console.log('🔄 Starting series metadata update...')
    
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'update-series-metadata.sql')
    const sqlScript = fs.readFileSync(sqlPath, 'utf8')
    
    // Execute the SQL script
    await prisma.$executeRawUnsafe(sqlScript)
    
    // Get final statistics
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_series,
        COUNT(CASE WHEN print_run_display IS NOT NULL THEN 1 END) as with_print_runs,
        COUNT(CASE WHEN rookie_count > 0 THEN 1 END) as with_rookies,
        COUNT(CASE WHEN min_print_run IS NOT NULL THEN 1 END) as with_min_print_run,
        COUNT(CASE WHEN max_print_run IS NOT NULL THEN 1 END) as with_max_print_run,
        AVG(CAST(print_run_variations AS FLOAT)) as avg_print_variations
      FROM series 
      WHERE card_count > 0
    `)
    
    const stat = stats[0]
    const duration = Date.now() - startTime
    
    console.log('✅ Series metadata update completed!')
    console.log(`📊 Statistics:`)
    console.log(`   - Total series updated: ${stat.total_series}`)
    console.log(`   - Series with print run display: ${stat.with_print_runs}`)
    console.log(`   - Series with rookie cards: ${stat.with_rookies}`)
    console.log(`   - Series with min print run: ${stat.with_min_print_run}`)
    console.log(`   - Series with max print run: ${stat.with_max_print_run}`)
    console.log(`   - Average print run variations: ${Math.round(stat.avg_print_variations * 100) / 100}`)
    console.log(`⏱️  Completed in ${duration}ms`)
    
    return {
      success: true,
      duration,
      stats: stat
    }
    
  } catch (error) {
    console.error('❌ Error updating series metadata:', error)
    
    // Log detailed error for debugging
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    })
    
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  updateSeriesMetadata()
    .then(result => {
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('Script failed:', error)
      process.exit(1)
    })
}

module.exports = updateSeriesMetadata