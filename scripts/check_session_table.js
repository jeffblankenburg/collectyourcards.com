/**
 * Check UserSession table schema to identify mismatch
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkSessionTable() {
  try {
    console.log('🔍 Checking user_session table schema...')
    
    // Check table schema using raw SQL
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_session' 
      ORDER BY ORDINAL_POSITION
    `
    
    console.log('📋 user_session table columns:')
    columns.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`)
    })
    
    // Try to create a test session to see the exact error
    console.log('\n🧪 Testing session creation...')
    try {
      await prisma.userSession.create({
        data: {
          user_id: 1n,
          token_hash: 'test_hash_123',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          ip_address: '127.0.0.1',
          user_agent: 'test',
          last_accessed: new Date()
        }
      })
      console.log('✅ Test session creation successful')
    } catch (error) {
      console.log('❌ Test session creation failed:', error.message)
      console.log('Error details:', error.meta)
    }
    
  } catch (error) {
    console.error('❌ Error checking session table:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSessionTable()