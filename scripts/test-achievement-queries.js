#!/usr/bin/env node

/**
 * Achievement Query Test Suite
 * Comprehensive testing of all achievement requirement queries
 * Validates query syntax, logic, and expected results
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Test data setup - we'll use the existing admin user for tests
const TEST_USER_ID = 1 // Admin user: cardcollector@jeffblankenburg.com

class AchievementQueryTester {
  constructor() {
    this.totalTests = 0
    this.passedTests = 0
    this.failedTests = 0
    this.errors = []
    this.testResults = []
  }

  async runTest(testName, testFunc) {
    this.totalTests++
    try {
      console.log(`🧪 Testing: ${testName}`)
      const result = await testFunc()
      
      if (result.passed) {
        this.passedTests++
        console.log(`✅ PASS: ${testName}`)
        if (result.details) {
          console.log(`   Details: ${result.details}`)
        }
      } else {
        this.failedTests++
        console.log(`❌ FAIL: ${testName}`)
        console.log(`   Reason: ${result.reason}`)
        this.errors.push({ test: testName, reason: result.reason })
      }
      
      this.testResults.push({ name: testName, ...result })
      console.log('')
      
    } catch (error) {
      this.failedTests++
      console.log(`❌ ERROR: ${testName}`)
      console.log(`   Error: ${error.message}`)
      this.errors.push({ test: testName, reason: error.message })
      console.log('')
    }
  }

  // Test 1: Query Syntax Validation
  async testQuerySyntax() {
    return this.runTest('Query Syntax Validation', async () => {
      const achievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query IS NOT NULL
      `

      let syntaxErrors = []
      
      for (const ach of achievements) {
        const query = ach.requirement_query
        
        // Basic syntax checks
        if (!query || query.trim() === '') {
          syntaxErrors.push(`${ach.name}: Empty query`)
          continue
        }
        
        if (!query.toUpperCase().includes('SELECT')) {
          syntaxErrors.push(`${ach.name}: No SELECT statement`)
          continue
        }
        
        if (!query.includes('@user_id')) {
          syntaxErrors.push(`${ach.name}: Missing @user_id parameter`)
          continue
        }
        
        // Check for common SQL injection vulnerabilities
        if (query.includes(';') && !query.endsWith(';')) {
          syntaxErrors.push(`${ach.name}: Potential SQL injection (semicolon)`)
        }
        
        if (query.includes('--') || query.includes('/*')) {
          syntaxErrors.push(`${ach.name}: Potential SQL injection (comments)`)
        }
      }

      return {
        passed: syntaxErrors.length === 0,
        reason: syntaxErrors.length > 0 ? `${syntaxErrors.length} syntax errors found` : null,
        details: `Checked ${achievements.length} queries, ${syntaxErrors.length} errors`
      }
    })
  }

  // Test 2: Query Execution Test
  async testQueryExecution() {
    return this.runTest('Query Execution Test', async () => {
      const sampleQueries = await prisma.$queryRaw`
        SELECT TOP 20 achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query IS NOT NULL
        AND requirement_query != 'SELECT 0'
        ORDER BY achievement_id
      `

      let executionErrors = []
      
      for (const ach of sampleQueries) {
        try {
          // Replace @user_id with test user ID
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          
          // Execute the query
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          // Validate result
          if (!Array.isArray(result) || result.length === 0) {
            executionErrors.push(`${ach.name}: Query returned no results`)
          } else if (typeof result[0] !== 'object') {
            executionErrors.push(`${ach.name}: Query returned invalid result type`)
          }
          
        } catch (error) {
          executionErrors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: executionErrors.length === 0,
        reason: executionErrors.length > 0 ? `${executionErrors.length} execution errors` : null,
        details: `Tested ${sampleQueries.length} queries, ${executionErrors.length} failed`
      }
    })
  }

  // Test 3: Card Count Queries
  async testCardCountQueries() {
    return this.runTest('Card Count Queries', async () => {
      const cardCountAchievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query, requirement_value
        FROM achievements 
        WHERE subcategory = 'Card Count' 
        OR requirement_query LIKE '%COUNT(*) FROM user_card WHERE%'
      `

      let errors = []
      
      for (const ach of cardCountAchievements) {
        try {
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          const count = Object.values(result[0])[0]
          
          if (typeof count !== 'number' && typeof count !== 'bigint') {
            errors.push(`${ach.name}: Expected number, got ${typeof count}`)
          }
          
          if (Number(count) < 0) {
            errors.push(`${ach.name}: Negative count returned`)
          }
          
        } catch (error) {
          errors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} card count errors` : null,
        details: `Tested ${cardCountAchievements.length} card count queries`
      }
    })
  }

  // Test 4: Rookie Card Queries
  async testRookieCardQueries() {
    return this.runTest('Rookie Card Queries', async () => {
      const rookieAchievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query LIKE '%is_rookie = 1%'
      `

      let errors = []
      
      for (const ach of rookieAchievements) {
        try {
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          const count = Object.values(result[0])[0]
          
          if (Number(count) < 0) {
            errors.push(`${ach.name}: Negative rookie count`)
          }
          
          // Rookie count should be <= total card count
          const totalCards = await prisma.$queryRaw`
            SELECT COUNT(*) as total FROM user_card WHERE [user] = ${TEST_USER_ID}
          `
          
          if (Number(count) > Number(totalCards[0].total)) {
            errors.push(`${ach.name}: Rookie count exceeds total cards`)
          }
          
        } catch (error) {
          errors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} rookie query errors` : null,
        details: `Tested ${rookieAchievements.length} rookie card queries`
      }
    })
  }

  // Test 5: Collection Value Queries
  async testCollectionValueQueries() {
    return this.runTest('Collection Value Queries', async () => {
      const valueAchievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query LIKE '%SUM%current_value%estimated_value%'
      `

      let errors = []
      
      for (const ach of valueAchievements) {
        try {
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          const value = Object.values(result[0])[0]
          
          if (value !== null && Number(value) < 0) {
            errors.push(`${ach.name}: Negative collection value`)
          }
          
          if (value !== null && !isFinite(Number(value))) {
            errors.push(`${ach.name}: Invalid number format`)
          }
          
        } catch (error) {
          errors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} value query errors` : null,
        details: `Tested ${valueAchievements.length} collection value queries`
      }
    })
  }

  // Test 6: Unique Player Queries
  async testUniquePlayerQueries() {
    return this.runTest('Unique Player Queries', async () => {
      const playerAchievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query LIKE '%COUNT(DISTINCT pt.player)%'
      `

      let errors = []
      
      for (const ach of playerAchievements) {
        try {
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          const count = Object.values(result[0])[0]
          
          if (Number(count) < 0) {
            errors.push(`${ach.name}: Negative player count`)
          }
          
          // Player count should be reasonable (not exceed total players in DB)
          if (Number(count) > 10000) {
            errors.push(`${ach.name}: Unreasonably high player count`)
          }
          
        } catch (error) {
          errors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} player query errors` : null,
        details: `Tested ${playerAchievements.length} unique player queries`
      }
    })
  }

  // Test 7: Comment Queries
  async testCommentQueries() {
    return this.runTest('Comment Queries', async () => {
      const commentAchievements = await prisma.$queryRaw`
        SELECT achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query LIKE '%universal_comments%'
      `

      let errors = []
      
      for (const ach of commentAchievements) {
        try {
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          const result = await prisma.$queryRawUnsafe(testQuery)
          
          const count = Object.values(result[0])[0]
          
          if (Number(count) < 0) {
            errors.push(`${ach.name}: Negative comment count`)
          }
          
        } catch (error) {
          errors.push(`${ach.name}: ${error.message}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} comment query errors` : null,
        details: `Tested ${commentAchievements.length} comment queries`
      }
    })
  }

  // Test 8: Parameter Injection Safety
  async testParameterSafety() {
    return this.runTest('Parameter Injection Safety', async () => {
      const sampleQuery = `
        SELECT COUNT(*) FROM user_card WHERE [user] = @user_id
      `

      let errors = []
      
      // Test with malicious inputs
      const maliciousInputs = [
        "1; DROP TABLE user_card; --",
        "1 OR 1=1",
        "1' OR '1'='1",
        "NULL",
        "-1",
        "999999999"
      ]

      for (const maliciousInput of maliciousInputs) {
        try {
          const testQuery = sampleQuery.replace(/@user_id/g, maliciousInput)
          await prisma.$queryRawUnsafe(testQuery)
          // If this doesn't throw an error with obvious SQL injection, that's concerning
          if (maliciousInput.includes('DROP') || maliciousInput.includes('OR 1=1')) {
            errors.push(`Potential SQL injection vulnerability with input: ${maliciousInput}`)
          }
        } catch (error) {
          // Errors are expected for malicious inputs - this is good
          console.log(`   🛡️  Blocked malicious input: ${maliciousInput}`)
        }
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? `${errors.length} security vulnerabilities` : null,
        details: `Tested ${maliciousInputs.length} malicious inputs`
      }
    })
  }

  // Test 9: Performance Test
  async testQueryPerformance() {
    return this.runTest('Query Performance Test', async () => {
      const complexQueries = await prisma.$queryRaw`
        SELECT TOP 10 achievement_id, name, requirement_query
        FROM achievements 
        WHERE requirement_query LIKE '%JOIN%'
        AND LEN(requirement_query) > 200
      `

      let slowQueries = []
      
      for (const ach of complexQueries) {
        try {
          const startTime = Date.now()
          const testQuery = ach.requirement_query.replace(/@user_id/g, TEST_USER_ID.toString())
          await prisma.$queryRawUnsafe(testQuery)
          const duration = Date.now() - startTime
          
          if (duration > 1000) { // Queries taking more than 1 second
            slowQueries.push(`${ach.name}: ${duration}ms`)
          }
          
        } catch (error) {
          slowQueries.push(`${ach.name}: Error - ${error.message}`)
        }
      }

      return {
        passed: slowQueries.length === 0,
        reason: slowQueries.length > 0 ? `${slowQueries.length} slow queries` : null,
        details: `Tested ${complexQueries.length} complex queries, ${slowQueries.length} were slow`
      }
    })
  }

  // Test 10: Data Consistency
  async testDataConsistency() {
    return this.runTest('Data Consistency Test', async () => {
      let errors = []
      
      try {
        // Test that card counts are consistent across different queries
        const basicCount = await prisma.$queryRaw`
          SELECT COUNT(*) as total FROM user_card WHERE [user] = ${TEST_USER_ID}
        `
        
        const rookieCount = await prisma.$queryRaw`
          SELECT COUNT(*) as rookies 
          FROM user_card uc 
          INNER JOIN card c ON uc.card = c.card_id 
          WHERE uc.[user] = ${TEST_USER_ID} AND c.is_rookie = 1
        `
        
        const autographCount = await prisma.$queryRaw`
          SELECT COUNT(*) as autos 
          FROM user_card uc 
          INNER JOIN card c ON uc.card = c.card_id 
          WHERE uc.[user] = ${TEST_USER_ID} AND c.is_autograph = 1
        `
        
        const relicCount = await prisma.$queryRaw`
          SELECT COUNT(*) as relics 
          FROM user_card uc 
          INNER JOIN card c ON uc.card = c.card_id 
          WHERE uc.[user] = ${TEST_USER_ID} AND c.is_relic = 1
        `
        
        const total = Number(basicCount[0].total)
        const rookies = Number(rookieCount[0].rookies)
        const autos = Number(autographCount[0].autos)
        const relics = Number(relicCount[0].relics)
        
        if (rookies > total) {
          errors.push(`Rookie count (${rookies}) exceeds total cards (${total})`)
        }
        
        if (autos > total) {
          errors.push(`Autograph count (${autos}) exceeds total cards (${total})`)
        }
        
        if (relics > total) {
          errors.push(`Relic count (${relics}) exceeds total cards (${total})`)
        }
        
        console.log(`   📊 Test user collection: ${total} total, ${rookies} rookies, ${autos} autos, ${relics} relics`)
        
      } catch (error) {
        errors.push(`Data consistency check failed: ${error.message}`)
      }

      return {
        passed: errors.length === 0,
        reason: errors.length > 0 ? errors.join('; ') : null,
        details: 'Validated data relationships and constraints'
      }
    })
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 ACHIEVEMENT QUERY TEST SUITE')
    console.log('=' * 50)
    console.log(`Testing queries with user ID: ${TEST_USER_ID}\n`)

    await this.testQuerySyntax()
    await this.testQueryExecution()
    await this.testCardCountQueries()
    await this.testRookieCardQueries()
    await this.testCollectionValueQueries()
    await this.testUniquePlayerQueries()
    await this.testCommentQueries()
    await this.testParameterSafety()
    await this.testQueryPerformance()
    await this.testDataConsistency()

    this.printResults()
  }

  printResults() {
    console.log('\n' + '=' * 50)
    console.log('🎯 TEST RESULTS SUMMARY')
    console.log('=' * 50)
    console.log(`📊 Total Tests: ${this.totalTests}`)
    console.log(`✅ Passed: ${this.passedTests}`)
    console.log(`❌ Failed: ${this.failedTests}`)
    console.log(`📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`)

    if (this.failedTests > 0) {
      console.log('\n❌ FAILURES:')
      this.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.reason}`)
      })
    }

    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 ALL TESTS PASSED!')
      console.log('✅ Achievement queries are working correctly')
      console.log('🚀 Ready for production use')
    } else {
      console.log('\n⚠️  Some tests failed - review and fix issues before deploying')
    }

    console.log('\n💡 Next Steps:')
    console.log('1. Fix any failing tests')
    console.log('2. Run retroactive achievement processing')
    console.log('3. Test achievement calculation in UI')
    console.log('4. Monitor performance in production')
  }
}

// Run the test suite
async function main() {
  const tester = new AchievementQueryTester()
  
  try {
    await tester.runAllTests()
  } catch (error) {
    console.error('❌ Fatal error during testing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)