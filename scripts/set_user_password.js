/**
 * Set password hash for existing user
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function setUserPassword() {
  try {
    const email = 'cardcollector@jeffblankenburg.com'
    const password = 'testpassword'
    
    console.log(`🔧 Setting password for user: ${email}`)
    
    // Generate password hash
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)
    
    console.log(`🔐 Generated password hash: ${passwordHash.substring(0, 30)}...`)
    
    // Update user with password hash
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { password_hash: passwordHash },
      select: {
        user_id: true,
        email: true,
        role: true,
        is_active: true,
        is_verified: true
      }
    })
    
    console.log('✅ Password updated successfully!')
    console.log('📋 Updated user:')
    console.log(`- Email: ${updatedUser.email}`)
    console.log(`- Role: ${updatedUser.role}`)
    console.log(`- Is Active: ${updatedUser.is_active}`)
    console.log(`- Is Verified: ${updatedUser.is_verified}`)
    
    // Test the password
    console.log('\n🧪 Testing password verification...')
    const user = await prisma.user.findUnique({
      where: { email },
      select: { password_hash: true }
    })
    
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log(`✅ Password verification: ${isValid ? 'SUCCESS' : 'FAILED'}`)
    
  } catch (error) {
    console.error('❌ Error setting password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setUserPassword()