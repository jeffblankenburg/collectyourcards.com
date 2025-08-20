/**
 * Verify test user email for authentication testing
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyTestUser() {
  try {
    const email = 'cardcollector@jeffblankenburg.com'
    
    console.log(`🔧 Verifying email for user: ${email}`)
    
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        is_verified: true,
        verification_token: null // Clear the verification token
      },
      select: {
        user_id: true,
        email: true,
        role: true,
        is_active: true,
        is_verified: true
      }
    })
    
    console.log('✅ User email verified successfully!')
    console.log('📋 Updated user:')
    console.log(`- Email: ${updatedUser.email}`)
    console.log(`- Role: ${updatedUser.role}`)
    console.log(`- Is Active: ${updatedUser.is_active}`)
    console.log(`- Is Verified: ${updatedUser.is_verified}`)
    
  } catch (error) {
    console.error('❌ Error verifying user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyTestUser()