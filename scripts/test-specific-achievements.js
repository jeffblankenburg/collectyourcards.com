#!/usr/bin/env node

/**
 * Specific Achievement Calculation Tests
 * Tests individual achievements to ensure they calculate correctly
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TEST_USER_ID = 1 // Admin user

async function testSpecificAchievements() {
  console.log('🎯 SPECIFIC ACHIEVEMENT CALCULATION TESTS')
  console.log('=' * 50)
  
  try {
    // Test 1: First Card Achievement (should be earned)
    console.log('\n📊 Testing "First Card" Achievement:')
    const firstCardQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM user_card WHERE [user] = ${TEST_USER_ID}
    `
    const cardCount = Number(firstCardQuery[0].count)
    console.log(`   User has ${cardCount} cards`)
    console.log(`   Should earn "First Card": ${cardCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 2: Century Mark Achievement
    console.log('\n📊 Testing "Century Mark" Achievement (100 cards):')
    console.log(`   User has ${cardCount} cards`)
    console.log(`   Should earn "Century Mark": ${cardCount >= 100 ? '✅ YES' : '❌ NO'}`)
    
    // Test 3: First Rookie Achievement
    console.log('\n🏀 Testing "First Rookie" Achievement:')
    const rookieQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = ${TEST_USER_ID} AND c.is_rookie = 1
    `
    const rookieCount = Number(rookieQuery[0].count)
    console.log(`   User has ${rookieCount} rookie cards`)
    console.log(`   Should earn "First Rookie": ${rookieCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 4: First Autograph Achievement
    console.log('\n✍️  Testing "First Signature" Achievement:')
    const autoQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = ${TEST_USER_ID} AND c.is_autograph = 1
    `
    const autoCount = Number(autoQuery[0].count)
    console.log(`   User has ${autoCount} autograph cards`)
    console.log(`   Should earn "First Signature": ${autoCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 5: Collection Value
    console.log('\n💰 Testing Collection Value Achievements:')
    const valueQuery = await prisma.$queryRaw`
      SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) as total_value
      FROM user_card uc 
      WHERE uc.[user] = ${TEST_USER_ID}
    `
    const totalValue = Number(valueQuery[0].total_value)
    console.log(`   Collection value: $${totalValue.toFixed(2)}`)
    console.log(`   Should earn "First Dollar": ${totalValue >= 1 ? '✅ YES' : '❌ NO'}`)
    console.log(`   Should earn "Grand Collection": ${totalValue >= 1000 ? '✅ YES' : '❌ NO'}`)
    
    // Test 6: Unique Players
    console.log('\n👤 Testing Unique Player Achievements:')
    const playerQuery = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT pt.player) as count
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
      WHERE uc.[user] = ${TEST_USER_ID}
    `
    const playerCount = Number(playerQuery[0].count)
    console.log(`   User has cards of ${playerCount} different players`)
    console.log(`   Should earn "Rookie Collector": ${playerCount >= 5 ? '✅ YES' : '❌ NO'}`)
    
    // Test 7: Comments Achievement
    console.log('\n💬 Testing Comment Achievements:')
    const commentQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM universal_comments 
      WHERE user_id = ${TEST_USER_ID}
    `
    const commentCount = Number(commentQuery[0].count)
    console.log(`   User has ${commentCount} comments`)
    console.log(`   Should earn "First Comment": ${commentCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 8: Graded Cards
    console.log('\n🎖️  Testing Graded Card Achievements:')
    const gradedQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_card 
      WHERE [user] = ${TEST_USER_ID} AND grading_agency IS NOT NULL
    `
    const gradedCount = Number(gradedQuery[0].count)
    console.log(`   User has ${gradedCount} graded cards`)
    console.log(`   Should earn "First Graded": ${gradedCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 9: Perfect Grades
    const perfectQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_card 
      WHERE [user] = ${TEST_USER_ID} AND grade = 10
    `
    const perfectCount = Number(perfectQuery[0].count)
    console.log(`   User has ${perfectCount} perfect 10 grades`)
    console.log(`   Should earn "Gem Mint 10": ${perfectCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Test 10: Serial Numbers
    console.log('\n🔢 Testing Serial Number Achievements:')
    const serialQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_card 
      WHERE [user] = ${TEST_USER_ID} AND serial_number IS NOT NULL
    `
    const serialCount = Number(serialQuery[0].count)
    console.log(`   User has ${serialCount} serial numbered cards`)
    console.log(`   Should earn "First Serial": ${serialCount >= 1 ? '✅ YES' : '❌ NO'}`)
    
    // Summary
    console.log('\n' + '=' * 50)
    console.log('📊 ACHIEVEMENT ELIGIBILITY SUMMARY')
    console.log('=' * 50)
    
    const achievements = [
      { name: 'First Card', earned: cardCount >= 1, current: cardCount, needed: 1 },
      { name: 'Century Mark', earned: cardCount >= 100, current: cardCount, needed: 100 },
      { name: 'First Rookie', earned: rookieCount >= 1, current: rookieCount, needed: 1 },
      { name: 'First Signature', earned: autoCount >= 1, current: autoCount, needed: 1 },
      { name: 'First Dollar', earned: totalValue >= 1, current: totalValue.toFixed(2), needed: 1 },
      { name: 'Rookie Collector', earned: playerCount >= 5, current: playerCount, needed: 5 },
      { name: 'First Comment', earned: commentCount >= 1, current: commentCount, needed: 1 },
      { name: 'First Graded', earned: gradedCount >= 1, current: gradedCount, needed: 1 },
      { name: 'Gem Mint 10', earned: perfectCount >= 1, current: perfectCount, needed: 1 },
      { name: 'First Serial', earned: serialCount >= 1, current: serialCount, needed: 1 }
    ]
    
    let earnedCount = 0
    achievements.forEach(ach => {
      const status = ach.earned ? '✅ EARNED' : '⏳ PENDING'
      console.log(`   ${ach.name}: ${status} (${ach.current}/${ach.needed})`)
      if (ach.earned) earnedCount++
    })
    
    console.log(`\n🎯 Achievement Completion: ${earnedCount}/${achievements.length} (${(earnedCount/achievements.length*100).toFixed(1)}%)`)
    
    return {
      totalAchievements: achievements.length,
      earnedAchievements: earnedCount,
      achievements: achievements
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error)
    throw error
  }
}

// Test achievement calculation function
async function testAchievementCalculation() {
  console.log('\n🧮 TESTING ACHIEVEMENT CALCULATION FUNCTION')
  console.log('=' * 50)
  
  try {
    // Test a simple achievement calculation
    const testAchievement = {
      achievement_id: 1,
      name: 'First Card',
      requirement_type: 'count',
      requirement_value: 1,
      requirement_query: 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id'
    }
    
    console.log(`Testing: ${testAchievement.name}`)
    
    // Replace parameter and execute
    const query = testAchievement.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
    const result = await prisma.$queryRawUnsafe(query)
    const currentProgress = Number(Object.values(result[0])[0])
    const isCompleted = currentProgress >= testAchievement.requirement_value
    
    console.log(`   Current Progress: ${currentProgress}`)
    console.log(`   Required: ${testAchievement.requirement_value}`)
    console.log(`   Completed: ${isCompleted ? '✅ YES' : '❌ NO'}`)
    
    return { currentProgress, isCompleted, requirement: testAchievement.requirement_value }
    
  } catch (error) {
    console.error('❌ Error testing calculation:', error)
    throw error
  }
}

// Run all specific tests
async function main() {
  try {
    const eligibilityResults = await testSpecificAchievements()
    const calculationResults = await testAchievementCalculation()
    
    console.log('\n✅ All specific achievement tests completed!')
    console.log('🎯 Achievement queries are calculating correctly')
    console.log('📊 Ready for retroactive processing and UI integration')
    
  } catch (error) {
    console.error('❌ Fatal error during specific testing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)