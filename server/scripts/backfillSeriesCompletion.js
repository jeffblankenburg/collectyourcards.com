/**
 * Backfill Script: User Series Completion
 *
 * This script populates the user_series_completion table with data
 * for all existing users and series combinations.
 *
 * Usage: node server/scripts/backfillSeriesCompletion.js
 */

const { prisma } = require('../config/prisma-singleton')
const { updateUserSeriesCompletion } = require('../utils/updateSeriesCompletion')

async function backfillSeriesCompletion() {
  console.log('Starting series completion backfill...')
  const startTime = Date.now()

  try {
    // Get all users who have at least one card in their collection
    console.log('Fetching users with collections...')
    const users = await prisma.$queryRaw`
      SELECT DISTINCT [user] as user_id,
        (SELECT email FROM [user] WHERE user_id = user_card.[user]) as email
      FROM user_card
    `
    console.log(`Found ${users.length} users with collections`)

    // Get all series that have at least one card
    console.log('Fetching series with cards...')
    const seriesList = await prisma.$queryRaw`
      SELECT s.series_id, s.name, COUNT(c.card_id) as card_count
      FROM series s
      LEFT JOIN card c ON s.series_id = c.series
      GROUP BY s.series_id, s.name
      HAVING COUNT(c.card_id) > 0
      ORDER BY s.name
    `
    console.log(`Found ${seriesList.length} series with cards`)

    const totalOperations = users.length * seriesList.length
    console.log(`Will process ${totalOperations.toLocaleString()} user-series combinations`)

    let processed = 0
    let completed = 0
    let errors = 0

    // Process each user
    for (const user of users) {
      console.log(`\nProcessing user: ${user.email} (${user.user_id})`)

      for (const series of seriesList) {
        try {
          const result = await updateUserSeriesCompletion(user.user_id, series.series_id)

          processed++

          if (result.isComplete) {
            completed++
            console.log(`  ✓ Complete: ${series.name} (${result.ownedCount}/${result.totalCards})`)
          }

          // Log progress every 100 operations
          if (processed % 100 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
            const remaining = totalOperations - processed
            const eta = (remaining / rate).toFixed(0)

            console.log(`Progress: ${processed}/${totalOperations} (${(processed/totalOperations*100).toFixed(1)}%) | ${rate}/sec | ETA: ${eta}s | Completed: ${completed}`)
          }
        } catch (error) {
          errors++
          console.error(`  ✗ Error for series ${series.series_id}: ${error.message}`)
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n' + '='.repeat(60))
    console.log('Backfill Complete!')
    console.log('='.repeat(60))
    console.log(`Total processed: ${processed.toLocaleString()}`)
    console.log(`Completed series: ${completed.toLocaleString()}`)
    console.log(`Errors: ${errors}`)
    console.log(`Duration: ${duration}s`)
    console.log(`Average rate: ${(processed / duration).toFixed(1)} records/sec`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('Fatal error during backfill:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillSeriesCompletion()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
