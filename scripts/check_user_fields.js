/**
 * Check what fields the user table actually has
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUserFields() {
  try {
    console.log('🔍 Checking user record structure...')
    
    const user = await prisma.user.findUnique({
      where: { email: 'cardcollector@jeffblankenburg.com' },
      select: {
        user_id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
        created: true
      }
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    console.log('📋 User record fields:')
    console.log(`- user_id: ${user.user_id}`)
    console.log(`- email: ${user.email}`)
    console.log(`- name: ${user.name}`)
    console.log(`- role: ${user.role}`)
    console.log(`- is_active: ${user.is_active}`)
    console.log(`- is_verified: ${user.is_verified}`)
    console.log(`- created: ${user.created}`)
    
    // Check database schema for user table
    console.log('\n🗄️ Checking database schema...')
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user' 
      ORDER BY ORDINAL_POSITION
    `
    
    console.log('\n📋 Database columns:')
    columns.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`)
    })
    
  } catch (error) {
    console.error('❌ Error checking user fields:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserFields()