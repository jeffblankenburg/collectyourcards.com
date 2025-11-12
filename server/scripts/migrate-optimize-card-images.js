/**
 * Migration Script: Optimize Card Images
 *
 * This script processes all existing cards that have a reference_user_card set
 * but don't yet have optimized images (front_image_path / back_image_path).
 *
 * It will:
 * 1. Find all cards with reference_user_card but missing optimized images
 * 2. Download the original user_card photos
 * 3. Optimize them (resize to 300px height, compress to JPEG)
 * 4. Upload to Azure Storage card-optimized container
 * 5. Update card records with the optimized image URLs
 *
 * Usage: node server/scripts/migrate-optimize-card-images.js
 */

const { PrismaClient } = require('@prisma/client')
const { processCardImage } = require('../utils/image-optimizer')

const prisma = new PrismaClient()

async function migrateCardImages() {
  console.log('🔍 Finding cards with reference_user_card but missing optimized images...\n')

  try {
    // Find all cards that have a reference but no optimized images
    const cardsToProcess = await prisma.card.findMany({
      where: {
        reference_user_card: {
          not: null
        },
        OR: [
          { front_image_path: null },
          { back_image_path: null }
        ]
      },
      select: {
        card_id: true,
        card_number: true,
        reference_user_card: true,
        front_image_path: true,
        back_image_path: true,
        user_card_card_reference_user_cardTouser_card: {
          select: {
            user_card_id: true,
            user_card_photo_user_card_photo_user_cardTouser_card: {
              orderBy: {
                sort_order: 'asc'
              },
              select: {
                photo_url: true,
                sort_order: true
              }
            }
          }
        }
      }
    })

    if (cardsToProcess.length === 0) {
      console.log('✓ No cards found that need image optimization')
      console.log('All cards with references already have optimized images.')
      return
    }

    console.log(`Found ${cardsToProcess.length} card(s) to process:\n`)

    let successCount = 0
    let errorCount = 0
    const errors = []

    for (const card of cardsToProcess) {
      const cardId = Number(card.card_id)
      const displayName = `Card #${card.card_number || 'Unknown'} (ID: ${cardId})`

      console.log(`\n📸 Processing: ${displayName}`)

      try {
        const userCard = card.user_card_card_reference_user_cardTouser_card
        if (!userCard) {
          console.log(`   ⚠️  Reference user_card ${card.reference_user_card} not found`)
          errorCount++
          errors.push({ cardId, error: 'Reference user_card not found' })
          continue
        }

        const photos = userCard.user_card_photo_user_card_photo_user_cardTouser_card
        if (!photos || photos.length === 0) {
          console.log(`   ⚠️  No photos found for reference user_card`)
          errorCount++
          errors.push({ cardId, error: 'No photos found' })
          continue
        }

        // Get front and back photos (sort_order 1 = front, 2 = back)
        const frontPhoto = photos.find(p => p.sort_order === 1)
        const backPhoto = photos.find(p => p.sort_order === 2)

        const updateData = {}

        // Process front image if missing and available
        if (!card.front_image_path && frontPhoto?.photo_url) {
          console.log(`   → Processing front image...`)
          try {
            const frontUrl = await processCardImage(frontPhoto.photo_url, cardId, 'front')
            updateData.front_image_path = frontUrl
            console.log(`   ✓ Front image optimized`)
          } catch (err) {
            console.log(`   ✗ Front image failed: ${err.message}`)
          }
        } else if (card.front_image_path) {
          console.log(`   ✓ Front image already exists`)
        } else {
          console.log(`   - No front image available`)
        }

        // Process back image if missing and available
        if (!card.back_image_path && backPhoto?.photo_url) {
          console.log(`   → Processing back image...`)
          try {
            const backUrl = await processCardImage(backPhoto.photo_url, cardId, 'back')
            updateData.back_image_path = backUrl
            console.log(`   ✓ Back image optimized`)
          } catch (err) {
            console.log(`   ✗ Back image failed: ${err.message}`)
          }
        } else if (card.back_image_path) {
          console.log(`   ✓ Back image already exists`)
        } else {
          console.log(`   - No back image available`)
        }

        // Update card if we processed any images
        if (Object.keys(updateData).length > 0) {
          await prisma.card.update({
            where: { card_id: cardId },
            data: updateData
          })
          successCount++
          console.log(`   ✓ Card updated successfully`)
        } else {
          console.log(`   - No updates needed`)
        }

      } catch (err) {
        console.error(`   ✗ Error processing card: ${err.message}`)
        errorCount++
        errors.push({ cardId, error: err.message })
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('Migration Complete!')
    console.log('='.repeat(60))
    console.log(`Total cards processed: ${cardsToProcess.length}`)
    console.log(`Successful: ${successCount}`)
    console.log(`Errors: ${errorCount}`)

    if (errors.length > 0) {
      console.log('\nErrors encountered:')
      errors.forEach(({ cardId, error }) => {
        console.log(`  - Card ${cardId}: ${error}`)
      })
    }

  } catch (error) {
    console.error('Fatal error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateCardImages()
  .then(() => {
    console.log('\n✓ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n✗ Migration script failed:', error)
    process.exit(1)
  })
