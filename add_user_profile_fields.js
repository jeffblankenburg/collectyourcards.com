// Script to add user profile fields to the database
const { PrismaClient } = require('@prisma/client')

async function addUserProfileFields() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Adding user profile fields to database...')
    
    // Add username field (unique, required)
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD username NVARCHAR(50) NULL
    `
    console.log('✅ Added username field')
    
    // Add display_name field (what shows publicly)
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD display_name NVARCHAR(100) NULL
    `
    console.log('✅ Added display_name field')
    
    // Add bio field for profile description
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD bio NVARCHAR(500) NULL
    `
    console.log('✅ Added bio field')
    
    // Add avatar_url field for profile pictures
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD avatar_url NVARCHAR(500) NULL
    `
    console.log('✅ Added avatar_url field')
    
    // Add is_public_profile field for privacy control
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD is_public_profile BIT NOT NULL DEFAULT 1
    `
    console.log('✅ Added is_public_profile field')
    
    // Add website field (optional)
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD website NVARCHAR(255) NULL
    `
    console.log('✅ Added website field')
    
    // Add location field (optional)
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD user_location NVARCHAR(100) NULL
    `
    console.log('✅ Added user_location field')
    
    // Add profile_completed field to track setup progress
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ADD profile_completed BIT NOT NULL DEFAULT 0
    `
    console.log('✅ Added profile_completed field')
    
    // Create unique index on username (after we populate it)
    console.log('📝 Note: Will create unique index on username after populating default values')
    
    // Generate default usernames for existing users
    console.log('🔄 Generating default usernames for existing users...')
    
    const existingUsers = await prisma.$queryRaw`
      SELECT user_id, first_name, last_name, email 
      FROM [user] 
      WHERE username IS NULL
    `
    
    for (const user of existingUsers) {
      // Generate username from email or name
      let username = null
      
      if (user.email) {
        // Use email prefix as base
        username = user.email.split('@')[0]
      } else if (user.first_name && user.last_name) {
        // Use first.last as base
        username = `${user.first_name.toLowerCase()}.${user.last_name.toLowerCase()}`
      } else {
        // Fallback to user ID
        username = `user${user.user_id}`
      }
      
      // Clean username (alphanumeric + dots/underscores only)
      username = username
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .substring(0, 30)
      
      // Ensure uniqueness by checking and appending numbers if needed
      let finalUsername = username
      let counter = 1
      
      while (true) {
        const existing = await prisma.$queryRaw`
          SELECT user_id FROM [user] WHERE username = ${finalUsername}
        `
        
        if (existing.length === 0) {
          break
        }
        
        finalUsername = `${username}${counter}`
        counter++
      }
      
      // Update user with generated username and display_name
      await prisma.$executeRaw`
        UPDATE [user] 
        SET username = ${finalUsername},
            display_name = ${user.first_name && user.last_name ? 
              `${user.first_name} ${user.last_name}` : 
              finalUsername
            }
        WHERE user_id = ${Number(user.user_id)}
      `
      
      console.log(`  Generated username "${finalUsername}" for user ${user.user_id}`)
    }
    
    // Now create the unique index on username
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IX_user_username ON [user] (username)
    `
    console.log('✅ Created unique index on username')
    
    // Make username NOT NULL now that all users have one
    await prisma.$executeRaw`
      ALTER TABLE [user] 
      ALTER COLUMN username NVARCHAR(50) NOT NULL
    `
    console.log('✅ Made username field required')
    
    console.log('🎉 User profile system database setup complete!')
    console.log('')
    console.log('📝 New fields added:')
    console.log('- username (unique identifier)')
    console.log('- display_name (public display name)')
    console.log('- bio (profile description)')
    console.log('- avatar_url (profile picture)')
    console.log('- is_public_profile (privacy control)')
    console.log('- website (optional URL)')
    console.log('- user_location (optional location)')
    console.log('- profile_completed (setup progress)')
    
  } catch (error) {
    console.error('❌ Error adding user profile fields:', error)
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some fields may already exist, continuing...')
    } else {
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
addUserProfileFields().catch(console.error)