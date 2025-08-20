/**
 * Check user password hash format
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUserPassword() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'cardcollector@jeffblankenburg.com' },
      select: {
        user_id: true,
        email: true,
        password_hash: true,
        role: true,
        is_active: true,
        is_verified: true
      }
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    console.log('📋 User data:')
    console.log(`- Email: ${user.email}`)
    console.log(`- Password Hash: ${user.password_hash}`)
    console.log(`- Password Hash Type: ${typeof user.password_hash}`)
    console.log(`- Password Hash Length: ${user.password_hash ? user.password_hash.length : 'null'}`)
    console.log(`- Role: ${user.role}`)
    console.log(`- Is Active: ${user.is_active}`)
    console.log(`- Is Verified: ${user.is_verified}`)
    
  } catch (error) {
    console.error('❌ Error checking user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserPassword()