const { PrismaClient } = require('@prisma/client')
require('dotenv').config()

const prisma = new PrismaClient()

async function updateRookieCounts() {
  console.log('🏈 Starting rookie count update...')
  
  try {
    // Get all series with their rookie counts
    const rookieCountQuery = `
      SELECT 
        s.series_id,
        s.name,
        ISNULL(COUNT(c.card_id), 0) as rookie_count
      FROM series s
      LEFT JOIN card c ON s.series_id = c.series
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      WHERE c.is_rookie = 1 OR c.is_rookie IS NULL
      GROUP BY s.series_id, s.name
      ORDER BY s.name
    `
    
    console.log('📊 Calculating rookie counts by series...')
    const rookieCounts = await prisma.$queryRawUnsafe(rookieCountQuery)
    
    console.log(`📈 Found ${rookieCounts.length} series to update`)
    
    let updated = 0
    let errors = 0
    
    // Update each series with its rookie count
    for (const series of rookieCounts) {
      try {
        const rookieCount = Number(series.rookie_count)
        
        await prisma.series.update({
          where: { series_id: BigInt(series.series_id) },
          data: { rookie_count: rookieCount }
        })
        
        if (rookieCount > 0) {
          console.log(`✅ ${series.name}: ${rookieCount} rookies`)
        }
        
        updated++
      } catch (error) {
        console.error(`❌ Error updating ${series.name}:`, error.message)
        errors++
      }
    }
    
    console.log('\n🎉 Rookie count update completed!')
    console.log(`✅ Updated: ${updated} series`)
    console.log(`❌ Errors: ${errors} series`)
    
    // Show some stats
    const totalRookies = rookieCounts.reduce((sum, s) => sum + Number(s.rookie_count), 0)
    const seriesWithRookies = rookieCounts.filter(s => Number(s.rookie_count) > 0).length
    
    console.log(`\n📊 Summary:`)
    console.log(`Total rookie cards: ${totalRookies.toLocaleString()}`)
    console.log(`Series with rookies: ${seriesWithRookies}`)
    console.log(`Series without rookies: ${rookieCounts.length - seriesWithRookies}`)
    
  } catch (error) {
    console.error('💥 Script failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateRookieCounts()