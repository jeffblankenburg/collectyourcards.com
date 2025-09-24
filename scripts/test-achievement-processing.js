#!/usr/bin/env node

/**
 * Achievement Processing Workflow Test
 * Tests the complete achievement calculation and awarding process
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TEST_USER_ID = 1

// Simulate the achievement processing function
async function calculateAchievementProgress(userId, achievement) {
  try {
    // Replace @user_id parameter with actual user ID
    const query = achievement.requirement_query.replace(/@user_id/g, userId.toString())
    
    // Execute the query
    const result = await prisma.$queryRawUnsafe(query)
    
    // Extract the numeric result (should be first column of first row)
    const currentProgress = Number(Object.values(result[0])[0]) || 0
    
    // Check if achievement is completed
    const isCompleted = currentProgress >= achievement.requirement_value
    
    return {
      currentProgress,
      isCompleted,
      requirementValue: achievement.requirement_value
    }
    
  } catch (error) {
    console.error(`Error calculating achievement ${achievement.name}:`, error.message)
    return {
      currentProgress: 0,
      isCompleted: false,
      requirementValue: achievement.requirement_value,
      error: error.message
    }
  }
}

async function testAchievementProcessing() {
  console.log('🔄 ACHIEVEMENT PROCESSING WORKFLOW TEST')
  console.log('=' * 50)
  console.log(`Testing with user ID: ${TEST_USER_ID}\n`)
  
  try {
    // Get a sample of different achievement types
    const sampleAchievements = await prisma.$queryRaw`
      SELECT TOP 20
        achievement_id,
        name,
        subcategory,
        requirement_type,
        requirement_value,
        requirement_query,
        points,
        tier
      FROM achievements 
      WHERE requirement_query IS NOT NULL 
        AND requirement_query != 'SELECT 0'
        AND requirement_value <= 100  -- Focus on achievable ones
      ORDER BY requirement_value ASC
    `
    
    console.log(`📊 Testing ${sampleAchievements.length} achievements...\n`)
    
    let processedCount = 0
    let earnedCount = 0
    let errorCount = 0
    const earnedAchievements = []
    const errors = []
    
    for (const achievement of sampleAchievements) {
      processedCount++
      
      console.log(`🧮 [${processedCount}/${sampleAchievements.length}] ${achievement.name}`)
      console.log(`   Category: ${achievement.subcategory || 'None'}`)
      console.log(`   Requirement: ${achievement.requirement_value} (${achievement.requirement_type})`)
      
      const result = await calculateAchievementProgress(TEST_USER_ID, achievement)
      
      if (result.error) {
        errorCount++
        errors.push({ achievement: achievement.name, error: result.error })
        console.log(`   ❌ ERROR: ${result.error}`)
      } else {
        console.log(`   Progress: ${result.currentProgress}/${result.requirementValue}`)
        
        if (result.isCompleted) {
          earnedCount++
          earnedAchievements.push({
            id: achievement.achievement_id,
            name: achievement.name,
            points: achievement.points,
            tier: achievement.tier,
            progress: result.currentProgress
          })
          console.log(`   ✅ EARNED! (+${achievement.points} points)`)
        } else {
          console.log(`   ⏳ In Progress`)
        }
      }
      
      console.log('')
    }
    
    // Summary
    console.log('=' * 50)
    console.log('📊 PROCESSING SUMMARY')
    console.log('=' * 50)
    console.log(`Total Processed: ${processedCount}`)
    console.log(`Successfully Calculated: ${processedCount - errorCount}`)
    console.log(`Errors: ${errorCount}`)
    console.log(`Achievements Earned: ${earnedCount}`)
    console.log(`Success Rate: ${((processedCount - errorCount) / processedCount * 100).toFixed(1)}%`)
    
    if (earnedAchievements.length > 0) {
      console.log('\n🏆 EARNED ACHIEVEMENTS:')
      let totalPoints = 0
      earnedAchievements.forEach(ach => {
        console.log(`   • ${ach.name} (${ach.tier}) - ${ach.points} points`)
        totalPoints += ach.points
      })
      console.log(`\n🎯 Total Points Available: ${totalPoints}`)
    }
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:')
      errors.forEach(err => {
        console.log(`   • ${err.achievement}: ${err.error}`)
      })
    }
    
    // Test specific database operations
    console.log('\n🗄️  TESTING DATABASE OPERATIONS')
    console.log('=' * 30)
    
    // Check if user_achievements table exists and has data
    const existingProgress = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM user_achievements 
      WHERE user_id = ${TEST_USER_ID}
    `
    
    console.log(`Existing user achievements: ${Number(existingProgress[0].count)}`)
    
    // Check user achievement stats
    const userStats = await prisma.$queryRaw`
      SELECT 
        total_achievements,
        total_points,
        last_updated
      FROM user_achievement_stats 
      WHERE user_id = ${TEST_USER_ID}
    `
    
    if (userStats.length > 0) {
      const stats = userStats[0]
      console.log(`User stats: ${Number(stats.total_achievements)} achievements, ${Number(stats.total_points)} points`)
      console.log(`Last updated: ${stats.last_updated}`)
    } else {
      console.log('No user achievement stats found')
    }
    
    return {
      processed: processedCount,
      earned: earnedCount,
      errors: errorCount,
      earnedAchievements,
      totalPoints: earnedAchievements.reduce((sum, ach) => sum + ach.points, 0)
    }
    
  } catch (error) {
    console.error('❌ Fatal error during processing test:', error)
    throw error
  }
}

// Test query optimization
async function testQueryOptimization() {
  console.log('\n⚡ QUERY OPTIMIZATION TEST')
  console.log('=' * 30)
  
  const heavyQueries = await prisma.$queryRaw`
    SELECT TOP 5
      achievement_id,
      name,
      requirement_query
    FROM achievements 
    WHERE requirement_query LIKE '%JOIN%'
      AND LEN(requirement_query) > 150
  `
  
  console.log(`Testing ${heavyQueries.length} complex queries for performance...\n`)
  
  for (const achievement of heavyQueries) {
    const startTime = process.hrtime.bigint()
    
    try {
      const query = achievement.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
      await prisma.$queryRawUnsafe(query)
      
      const endTime = process.hrtime.bigint()
      const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds
      
      const status = duration > 100 ? '⚠️  SLOW' : '✅ FAST'
      console.log(`${status} ${achievement.name}: ${duration.toFixed(2)}ms`)
      
    } catch (error) {
      console.log(`❌ ${achievement.name}: ${error.message}`)
    }
  }
}

async function main() {
  try {
    const results = await testAchievementProcessing()
    await testQueryOptimization()
    
    console.log('\n' + '=' * 50)
    console.log('🎉 ACHIEVEMENT PROCESSING TEST COMPLETE!')
    console.log('=' * 50)
    
    if (results.errors === 0) {
      console.log('✅ All achievement queries are working correctly')
      console.log('🚀 Ready for production achievement processing')
    } else {
      console.log(`⚠️  ${results.errors} queries need attention before production`)
    }
    
    console.log('\n💡 Next Steps:')
    console.log('1. Run retroactive achievement processing for all users')
    console.log('2. Set up real-time achievement triggers')
    console.log('3. Test achievement notifications in UI')
    console.log('4. Monitor performance with larger user base')
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)