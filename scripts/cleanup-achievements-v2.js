#!/usr/bin/env node

/**
 * Achievement Cleanup Script V2
 * Removes impossible achievements based on actual table structure
 * Run with: node scripts/cleanup-achievements-v2.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Achievement names to DELETE (features don't exist or are impossible)
const ACHIEVEMENTS_TO_DELETE = [
  // Trading (no trading system)
  'First Trade',
  'Trade Master',
  'Trading Expert',
  'Cross Country Trade',
  'International Trade',
  
  // Marketplace (no marketplace)
  'First Sale',
  'Market Maker',
  'Profitable Sale',
  'Quick Flip',
  
  // Social features that don't exist  
  'Social Butterfly',
  'Popular Collector',
  'Influencer',
  'Trending Post',
  
  // Import features that likely don't work
  'Bulk Import Master',
  'Spreadsheet Wizard',
  
  // Wantlist (doesn't exist)
  'Wishlist Builder',
  'Wishlist Fulfilled',
  
  // Unrealistic milestones
  'Millionaire Collection', // $1M value
  'Card Museum', // 100K cards
]

// Subcategories that might have impossible achievements
const SUBCATEGORIES_TO_REVIEW = [
  'Social', // Only keep comment-related
  'Trading',
  'Marketplace',
  'Events',
  'Challenges'
]

async function cleanupAchievements() {
  try {
    console.log('🧹 Starting achievement cleanup...\n')

    // 1. Get current count
    const beforeCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM achievements
    `
    console.log(`📊 Current achievements: ${beforeCount[0].count}`)

    // 2. Delete specific impossible achievements by name
    console.log('\n🎯 Removing impossible achievements by name...')
    let deletedCount = 0
    for (const name of ACHIEVEMENTS_TO_DELETE) {
      try {
        // First get the achievement ID
        const achievement = await prisma.$queryRaw`
          SELECT achievement_id FROM achievements WHERE name = ${name}
        `
        
        if (achievement.length > 0) {
          const achievementId = achievement[0].achievement_id
          
          // Delete in proper order for foreign key constraints
          await prisma.$executeRaw`
            DELETE FROM achievement_history WHERE achievement_id = ${achievementId}
          `
          await prisma.$executeRaw`
            DELETE FROM user_achievements WHERE achievement_id = ${achievementId}
          `
          const result = await prisma.$executeRaw`
            DELETE FROM achievements WHERE achievement_id = ${achievementId}
          `
          
          if (result > 0) {
            console.log(`   ✅ Deleted: ${name}`)
            deletedCount += result
          }
        }
      } catch (err) {
        console.log(`   ⚠️  Error deleting ${name}: ${err.message}`)
      }
    }
    console.log(`   Total deleted by name: ${deletedCount}`)

    // 3. Review problematic subcategories
    console.log('\n📁 Reviewing problematic subcategories...')
    for (const subcategory of SUBCATEGORIES_TO_REVIEW) {
      const achievements = await prisma.$queryRaw`
        SELECT achievement_id, name, description
        FROM achievements
        WHERE subcategory = ${subcategory}
      `
      
      if (achievements.length > 0) {
        console.log(`\n   ${subcategory}: Found ${achievements.length} achievements`)
        
        // Delete all trading/marketplace subcategories
        if (subcategory === 'Trading' || subcategory === 'Marketplace') {
          // Get all achievement IDs first
          const achievementIds = await prisma.$queryRaw`
            SELECT achievement_id FROM achievements WHERE subcategory = ${subcategory}
          `
          
          // Delete related data first
          for (const ach of achievementIds) {
            await prisma.$executeRaw`
              DELETE FROM achievement_history WHERE achievement_id = ${ach.achievement_id}
            `
            await prisma.$executeRaw`
              DELETE FROM user_achievements WHERE achievement_id = ${ach.achievement_id}
            `
          }
          
          // Then delete the achievements
          const deleted = await prisma.$executeRaw`
            DELETE FROM achievements
            WHERE subcategory = ${subcategory}
          `
          console.log(`     🗑️  Deleted all ${deleted} ${subcategory} achievements`)
        } else {
          // List them for manual review
          achievements.forEach(a => {
            console.log(`     - ${a.name}: ${a.description}`)
          })
        }
      }
    }

    // 4. Delete achievements with impossible requirement values
    console.log('\n🔍 Finding achievements with unrealistic requirements...')
    const unrealistic = await prisma.$queryRaw`
      SELECT achievement_id, name, requirement_value
      FROM achievements
      WHERE requirement_type = 'total_cards' AND requirement_value > 10000
         OR requirement_type = 'collection_value' AND requirement_value > 100000
    `
    
    for (const ach of unrealistic) {
      console.log(`   Removing unrealistic: ${ach.name} (requirement: ${ach.requirement_value})`)
      
      // Delete related data first
      await prisma.$executeRaw`
        DELETE FROM achievement_history WHERE achievement_id = ${ach.achievement_id}
      `
      await prisma.$executeRaw`
        DELETE FROM user_achievements WHERE achievement_id = ${ach.achievement_id}
      `
      await prisma.$executeRaw`
        DELETE FROM achievements 
        WHERE achievement_id = ${ach.achievement_id}
      `
    }

    // 5. Clean up orphaned records
    console.log('\n🧼 Cleaning up orphaned records for deleted achievements...')
    
    // Clean up orphaned achievement history
    const historyCleanup = await prisma.$executeRaw`
      DELETE FROM achievement_history
      WHERE achievement_id NOT IN (
        SELECT achievement_id FROM achievements
      )
    `
    console.log(`   Cleaned ${historyCleanup} orphaned achievement history records`)
    
    // Clean up orphaned user achievements  
    const progressCleanup = await prisma.$executeRaw`
      DELETE FROM user_achievements
      WHERE achievement_id NOT IN (
        SELECT achievement_id FROM achievements
      )
    `
    console.log(`   Cleaned ${progressCleanup} orphaned user achievement records`)

    // 6. Update user stats
    console.log('\n📊 Updating user achievement statistics...')
    await prisma.$executeRaw`
      WITH UserAchievementTotals AS (
        SELECT 
          ua.user_id,
          COUNT(*) as total_achievements,
          SUM(a.points) as total_points,
          SUM(CASE WHEN a.tier = 'common' THEN 1 ELSE 0 END) as common_achievements,
          SUM(CASE WHEN a.tier = 'uncommon' THEN 1 ELSE 0 END) as uncommon_achievements,
          SUM(CASE WHEN a.tier = 'rare' THEN 1 ELSE 0 END) as rare_achievements,
          SUM(CASE WHEN a.tier = 'epic' THEN 1 ELSE 0 END) as epic_achievements,
          SUM(CASE WHEN a.tier = 'legendary' THEN 1 ELSE 0 END) as legendary_achievements,
          SUM(CASE WHEN a.tier = 'mythic' THEN 1 ELSE 0 END) as mythic_achievements
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.achievement_id
        WHERE ua.is_completed = 1
        GROUP BY ua.user_id
      )
      UPDATE user_achievement_stats
      SET 
        total_achievements = uat.total_achievements,
        total_points = uat.total_points,
        common_achievements = uat.common_achievements,
        uncommon_achievements = uat.uncommon_achievements,
        rare_achievements = uat.rare_achievements,
        epic_achievements = uat.epic_achievements,
        legendary_achievements = uat.legendary_achievements,
        mythic_achievements = uat.mythic_achievements,
        last_updated = GETDATE()
      FROM UserAchievementTotals uat
      WHERE user_achievement_stats.user_id = uat.user_id
    `

    // 7. Final count
    const afterCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM achievements
    `

    // 8. Show remaining achievements by subcategory
    const remaining = await prisma.$queryRaw`
      SELECT subcategory, COUNT(*) as count
      FROM achievements
      GROUP BY subcategory
      ORDER BY count DESC
    `

    console.log('\n✅ Cleanup Complete!')
    console.log('=' * 50)
    console.log(`📊 Final Statistics:`)
    console.log(`   Achievements before: ${beforeCount[0].count}`)
    console.log(`   Achievements after: ${afterCount[0].count}`)
    console.log(`   Total removed: ${beforeCount[0].count - afterCount[0].count}`)
    
    console.log('\n📁 Remaining achievements by subcategory:')
    remaining.forEach(cat => {
      console.log(`   ${cat.subcategory}: ${cat.count}`)
    })

    // 9. List some achievements that actually work
    console.log('\n✅ Sample working achievements (keep these):')
    const working = await prisma.$queryRaw`
      SELECT TOP 10 name, description, subcategory, requirement_value
      FROM achievements
      WHERE subcategory IN ('Card Count', 'Card Types', 'Grading', 'Organization')
        AND requirement_value <= 1000
      ORDER BY requirement_value
    `
    working.forEach(a => {
      console.log(`   - ${a.name}: ${a.description} (${a.subcategory})`)
    })

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
async function main() {
  console.log('🏆 ACHIEVEMENT SYSTEM CLEANUP V2')
  console.log('=' * 50)
  
  await cleanupAchievements()
  
  console.log('\n✨ Cleanup complete!')
  console.log('💡 Tip: Visit /admin/achievements to fine-tune remaining achievements')
  console.log('💡 The achievement hooks will automatically handle:')
  console.log('   - Collection milestones (card counts)')
  console.log('   - Card type achievements (rookies, autos, relics)')
  console.log('   - Grading achievements')
  console.log('   - Organization achievements (locations)')
}

main().catch(console.error)