/**
 * Script to fix user table schema issues
 * - Updates null values in required fields with proper defaults
 * - Ensures existing users can log in properly
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixUserSchema() {
  try {
    console.log('🔧 Starting user schema fix...')
    
    // Get all users with potential issues
    const users = await prisma.$queryRaw`
      SELECT user_id, email, role, is_active, is_verified, login_attempts 
      FROM [user] 
      WHERE role IS NULL OR is_active IS NULL OR is_verified IS NULL OR login_attempts IS NULL
    `
    
    console.log(`📋 Found ${users.length} users with schema issues`)
    
    if (users.length === 0) {
      console.log('✅ No users found with schema issues')
      return
    }
    
    // Display current problematic records
    console.log('\n📋 Users with issues:')
    users.forEach(user => {
      console.log(`- ${user.email}: role=${user.role}, is_active=${user.is_active}, is_verified=${user.is_verified}, login_attempts=${user.login_attempts}`)
    })
    
    // Fix the issues using raw SQL to handle null values properly
    console.log('\n🔧 Fixing schema issues...')
    
    // Update users with null role to 'user'
    const roleUpdates = await prisma.$executeRaw`
      UPDATE [user] 
      SET role = 'user' 
      WHERE role IS NULL
    `
    console.log(`✅ Updated ${roleUpdates} users with null role`)
    
    // Update users with null is_active to true
    const activeUpdates = await prisma.$executeRaw`
      UPDATE [user] 
      SET is_active = 1 
      WHERE is_active IS NULL
    `
    console.log(`✅ Updated ${activeUpdates} users with null is_active`)
    
    // Update users with null is_verified to false (default)
    const verifiedUpdates = await prisma.$executeRaw`
      UPDATE [user] 
      SET is_verified = 0 
      WHERE is_verified IS NULL
    `
    console.log(`✅ Updated ${verifiedUpdates} users with null is_verified`)
    
    // Update users with null login_attempts to 0 (default)
    const loginAttemptsUpdates = await prisma.$executeRaw`
      UPDATE [user] 
      SET login_attempts = 0 
      WHERE login_attempts IS NULL
    `
    console.log(`✅ Updated ${loginAttemptsUpdates} users with null login_attempts`)
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixes...')
    const remainingIssues = await prisma.$queryRaw`
      SELECT user_id, email, role, is_active, is_verified, login_attempts 
      FROM [user] 
      WHERE role IS NULL OR is_active IS NULL OR is_verified IS NULL OR login_attempts IS NULL
    `
    
    if (remainingIssues.length === 0) {
      console.log('✅ All schema issues have been resolved!')
      
      // Display all users after fix
      const allUsers = await prisma.user.findMany({
        select: {
          user_id: true,
          email: true,
          role: true,
          is_active: true,
          is_verified: true,
          login_attempts: true
        }
      })
      
      console.log('\n📋 All users after fix:')
      allUsers.forEach(user => {
        console.log(`- ${user.email}: role=${user.role}, is_active=${user.is_active}, is_verified=${user.is_verified}, login_attempts=${user.login_attempts}`)
      })
      
    } else {
      console.log(`❌ ${remainingIssues.length} users still have issues:`)
      remainingIssues.forEach(user => {
        console.log(`- ${user.email}: role=${user.role}, is_active=${user.is_active}, is_verified=${user.is_verified}, login_attempts=${user.login_attempts}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error fixing user schema:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixUserSchema()
  .catch(error => {
    console.error('Script failed:', error)
    process.exit(1)
  })