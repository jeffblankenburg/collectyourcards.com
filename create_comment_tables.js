// Script to create comment system tables using Prisma
const { PrismaClient } = require('@prisma/client')

async function createCommentTables() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Creating universal comment system tables...')
    
    // Create universal_comments table
    await prisma.$executeRaw`
      CREATE TABLE universal_comments (
        comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        comment_type VARCHAR(10) NOT NULL CHECK (comment_type IN ('card', 'series', 'set')),
        item_id BIGINT NOT NULL,
        comment_text NVARCHAR(MAX) NOT NULL,
        parent_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NULL,
        is_edited BIT NOT NULL DEFAULT 0,
        is_deleted BIT NOT NULL DEFAULT 0
      );
    `
    
    // Create indexes for universal_comments
    await prisma.$executeRaw`CREATE INDEX IX_comments_type_item ON universal_comments (comment_type, item_id);`
    await prisma.$executeRaw`CREATE INDEX IX_comments_user ON universal_comments (user_id);`
    await prisma.$executeRaw`CREATE INDEX IX_comments_created ON universal_comments (created_at DESC);`
    
    console.log('✅ Created universal_comments table with indexes')
    
    // Create user_item_subscriptions table
    await prisma.$executeRaw`
      CREATE TABLE user_item_subscriptions (
        subscription_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('card', 'series', 'set')),
        item_id BIGINT NOT NULL,
        subscribed_at DATETIME NOT NULL DEFAULT GETDATE(),
        is_active BIT NOT NULL DEFAULT 1,
        UNIQUE (user_id, item_type, item_id)
      );
    `
    
    // Create indexes for user_item_subscriptions  
    await prisma.$executeRaw`CREATE INDEX IX_subscriptions_user ON user_item_subscriptions (user_id);`
    await prisma.$executeRaw`CREATE INDEX IX_subscriptions_item ON user_item_subscriptions (item_type, item_id);`
    
    console.log('✅ Created user_item_subscriptions table with indexes')
    
    // Create user_notifications table
    await prisma.$executeRaw`
      CREATE TABLE user_notifications (
        notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        notification_type VARCHAR(50) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        related_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
        related_user_id BIGINT NULL REFERENCES [user](user_id),
        item_type VARCHAR(10) NULL CHECK (item_type IN ('card', 'series', 'set')),
        item_id BIGINT NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    `
    
    // Create index for user_notifications
    await prisma.$executeRaw`CREATE INDEX IX_notifications_user_unread ON user_notifications (user_id, is_read, created_at DESC);`
    
    console.log('✅ Created user_notifications table with indexes')
    
    console.log('🎉 All comment system tables created successfully!')
    
  } catch (error) {
    console.error('❌ Error creating comment tables:', error)
    
    // If tables already exist, that's fine
    if (error.message.includes('There is already an object named')) {
      console.log('ℹ️  Tables already exist, skipping creation')
    } else {
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createCommentTables().catch(console.error)