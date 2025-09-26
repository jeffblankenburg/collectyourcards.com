-- =============================================================================
-- SOCIAL FEATURES DATABASE SCHEMA (PRODUCTION SAFE)
-- Created: January 2025
-- Purpose: Create all database tables for comments, notifications, and social features
-- SAFE FOR PRODUCTION: Includes existence checks for all objects
-- =============================================================================

-- NOTE: Run these in order, as some tables have foreign key dependencies

PRINT 'Starting Social Features Database Schema Installation...'
PRINT '============================================================'

-- =============================================================================
-- 1. UNIVERSAL COMMENTS TABLE
-- =============================================================================
-- Supports comments on cards, series, and sets
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'universal_comments')
BEGIN
    PRINT 'Creating universal_comments table...'
    CREATE TABLE universal_comments (
        comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        comment_type VARCHAR(10) NOT NULL CHECK (comment_type IN ('card', 'series', 'set')),
        item_id BIGINT NOT NULL,
        comment_text NVARCHAR(MAX) NOT NULL,
        parent_comment_id BIGINT NULL,
        comment_status VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (comment_status IN ('visible', 'pending_review', 'hidden', 'deleted')),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NULL,
        is_edited BIT NOT NULL DEFAULT 0,
        is_deleted BIT NOT NULL DEFAULT 0,
        deleted_at DATETIME NULL,
        deleted_by BIGINT NULL,
        
        -- Foreign keys
        CONSTRAINT FK_universal_comments_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_universal_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES universal_comments(comment_id),
        CONSTRAINT FK_universal_comments_deleted_by FOREIGN KEY (deleted_by) REFERENCES [user](user_id)
    );
    PRINT '✓ universal_comments table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ universal_comments table already exists - skipping'
END

-- Indexes for universal_comments
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_universal_comments_type_item')
BEGIN
    PRINT 'Creating index IX_universal_comments_type_item...'
    CREATE INDEX IX_universal_comments_type_item ON universal_comments (comment_type, item_id);
    PRINT '✓ IX_universal_comments_type_item created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_universal_comments_user')
BEGIN
    PRINT 'Creating index IX_universal_comments_user...'
    CREATE INDEX IX_universal_comments_user ON universal_comments (user_id);
    PRINT '✓ IX_universal_comments_user created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_universal_comments_created')
BEGIN
    PRINT 'Creating index IX_universal_comments_created...'
    CREATE INDEX IX_universal_comments_created ON universal_comments (created_at DESC);
    PRINT '✓ IX_universal_comments_created created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_universal_comments_status')
BEGIN
    PRINT 'Creating index IX_universal_comments_status...'
    CREATE INDEX IX_universal_comments_status ON universal_comments (comment_status);
    PRINT '✓ IX_universal_comments_status created'
END

-- =============================================================================
-- 2. USER ITEM SUBSCRIPTIONS TABLE
-- =============================================================================
-- Track which items users are subscribed to for notifications
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_item_subscriptions')
BEGIN
    PRINT 'Creating user_item_subscriptions table...'
    CREATE TABLE user_item_subscriptions (
        subscription_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('card', 'series', 'set')),
        item_id BIGINT NOT NULL,
        subscribed_at DATETIME NOT NULL DEFAULT GETDATE(),
        is_active BIT NOT NULL DEFAULT 1,
        
        -- Foreign keys
        CONSTRAINT FK_user_item_subscriptions_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        
        -- Unique constraint to prevent duplicate subscriptions
        CONSTRAINT UQ_user_item_subscriptions UNIQUE (user_id, item_type, item_id)
    );
    PRINT '✓ user_item_subscriptions table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ user_item_subscriptions table already exists - skipping'
END

-- Indexes for user_item_subscriptions
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_item_subscriptions_user')
BEGIN
    PRINT 'Creating index IX_user_item_subscriptions_user...'
    CREATE INDEX IX_user_item_subscriptions_user ON user_item_subscriptions (user_id);
    PRINT '✓ IX_user_item_subscriptions_user created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_item_subscriptions_item')
BEGIN
    PRINT 'Creating index IX_user_item_subscriptions_item...'
    CREATE INDEX IX_user_item_subscriptions_item ON user_item_subscriptions (item_type, item_id);
    PRINT '✓ IX_user_item_subscriptions_item created'
END

-- =============================================================================
-- 3. USER NOTIFICATIONS TABLE
-- =============================================================================
-- Store all user notifications
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_notifications')
BEGIN
    PRINT 'Creating user_notifications table...'
    CREATE TABLE user_notifications (
        notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        related_comment_id BIGINT NULL,
        related_user_id BIGINT NULL,
        item_type VARCHAR(10) NULL CHECK (item_type IN ('card', 'series', 'set')),
        item_id BIGINT NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_user_notifications_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_user_notifications_comment FOREIGN KEY (related_comment_id) REFERENCES universal_comments(comment_id),
        CONSTRAINT FK_user_notifications_related_user FOREIGN KEY (related_user_id) REFERENCES [user](user_id)
    );
    PRINT '✓ user_notifications table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ user_notifications table already exists - skipping'
END

-- Indexes for user_notifications
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_notifications_user_unread')
BEGIN
    PRINT 'Creating index IX_user_notifications_user_unread...'
    CREATE INDEX IX_user_notifications_user_unread ON user_notifications (user_id, is_read, created_at DESC);
    PRINT '✓ IX_user_notifications_user_unread created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_notifications_created')
BEGIN
    PRINT 'Creating index IX_user_notifications_created...'
    CREATE INDEX IX_user_notifications_created ON user_notifications (created_at DESC);
    PRINT '✓ IX_user_notifications_created created'
END

-- =============================================================================
-- 4. USER PROFILE ENHANCEMENTS
-- =============================================================================
-- Add username and social features to user table (if not already exists)
PRINT 'Checking user table enhancements...'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'username')
BEGIN
    PRINT 'Adding username column to user table...'
    ALTER TABLE [user] ADD username NVARCHAR(50) NULL;
    PRINT '✓ username column added'
END
ELSE
    PRINT '⚠ username column already exists'

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_username')
BEGIN
    PRINT 'Creating unique index on username...'
    CREATE UNIQUE INDEX IX_user_username ON [user] (username) WHERE username IS NOT NULL;
    PRINT '✓ IX_user_username index created'
END
ELSE
    PRINT '⚠ IX_user_username index already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'bio')
BEGIN
    PRINT 'Adding bio column to user table...'
    ALTER TABLE [user] ADD bio NVARCHAR(500) NULL;
    PRINT '✓ bio column added'
END
ELSE
    PRINT '⚠ bio column already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'avatar_url')
BEGIN
    PRINT 'Adding avatar_url column to user table...'
    ALTER TABLE [user] ADD avatar_url NVARCHAR(500) NULL;
    PRINT '✓ avatar_url column added'
END
ELSE
    PRINT '⚠ avatar_url column already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'is_public_profile')
BEGIN
    PRINT 'Adding is_public_profile column to user table...'
    ALTER TABLE [user] ADD is_public_profile BIT NOT NULL DEFAULT 1;
    PRINT '✓ is_public_profile column added'
END
ELSE
    PRINT '⚠ is_public_profile column already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'is_muted')
BEGIN
    PRINT 'Adding is_muted column to user table...'
    ALTER TABLE [user] ADD is_muted BIT NOT NULL DEFAULT 0;
    PRINT '✓ is_muted column added'
END
ELSE
    PRINT '⚠ is_muted column already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'muted_at')
BEGIN
    PRINT 'Adding muted_at column to user table...'
    ALTER TABLE [user] ADD muted_at DATETIME NULL;
    PRINT '✓ muted_at column added'
END
ELSE
    PRINT '⚠ muted_at column already exists'

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'muted_by')
BEGIN
    PRINT 'Adding muted_by column and constraint to user table...'
    ALTER TABLE [user] ADD muted_by BIGINT NULL;
    PRINT '✓ muted_by column added'
END
ELSE
    PRINT '⚠ muted_by column already exists'

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_user_muted_by')
BEGIN
    PRINT 'Adding FK_user_muted_by constraint...'
    ALTER TABLE [user] ADD CONSTRAINT FK_user_muted_by FOREIGN KEY (muted_by) REFERENCES [user](user_id);
    PRINT '✓ FK_user_muted_by constraint added'
END
ELSE
    PRINT '⚠ FK_user_muted_by constraint already exists'

-- =============================================================================
-- 5. USER FAVORITE CARDS TABLE
-- =============================================================================
-- Store user's favorite cards for profile display
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_favorite_cards')
BEGIN
    PRINT 'Creating user_favorite_cards table...'
    CREATE TABLE user_favorite_cards (
        favorite_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        user_card_id BIGINT NOT NULL,
        sort_order INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_user_favorite_cards_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_user_favorite_cards_user_card FOREIGN KEY (user_card_id) REFERENCES user_card(user_card_id),
        
        -- Unique constraint to prevent duplicate favorites
        CONSTRAINT UQ_user_favorite_cards UNIQUE (user_id, user_card_id)
    );
    PRINT '✓ user_favorite_cards table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ user_favorite_cards table already exists - skipping'
END

-- Index for user_favorite_cards
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_favorite_cards_user_sort')
BEGIN
    PRINT 'Creating index IX_user_favorite_cards_user_sort...'
    CREATE INDEX IX_user_favorite_cards_user_sort ON user_favorite_cards (user_id, sort_order);
    PRINT '✓ IX_user_favorite_cards_user_sort created'
END

-- =============================================================================
-- 6. CONTENT MODERATION TABLES
-- =============================================================================
-- Track content reports from users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'content_reports')
BEGIN
    PRINT 'Creating content_reports table...'
    CREATE TABLE content_reports (
        report_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        reporter_user_id BIGINT NOT NULL,
        comment_id BIGINT NOT NULL,
        report_reason VARCHAR(50) NOT NULL,
        report_details NVARCHAR(1000) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_content_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_content_reports_comment FOREIGN KEY (comment_id) REFERENCES universal_comments(comment_id),
        CONSTRAINT FK_content_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES [user](user_id)
    );
    PRINT '✓ content_reports table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ content_reports table already exists - skipping'
END

-- Index for content_reports
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_content_reports_status')
BEGIN
    PRINT 'Creating index IX_content_reports_status...'
    CREATE INDEX IX_content_reports_status ON content_reports (status, created_at DESC);
    PRINT '✓ IX_content_reports_status created'
END

-- =============================================================================
-- 7. MODERATION ACTION LOG
-- =============================================================================
-- Log all moderation actions for audit trail
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'moderation_actions')
BEGIN
    PRINT 'Creating moderation_actions table...'
    CREATE TABLE moderation_actions (
        action_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        moderator_user_id BIGINT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('comment', 'user')),
        target_id BIGINT NOT NULL,
        reason NVARCHAR(500) NULL,
        details NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_moderation_actions_moderator FOREIGN KEY (moderator_user_id) REFERENCES [user](user_id)
    );
    PRINT '✓ moderation_actions table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ moderation_actions table already exists - skipping'
END

-- Indexes for moderation_actions
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_moderation_actions_moderator')
BEGIN
    PRINT 'Creating index IX_moderation_actions_moderator...'
    CREATE INDEX IX_moderation_actions_moderator ON moderation_actions (moderator_user_id, created_at DESC);
    PRINT '✓ IX_moderation_actions_moderator created'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_moderation_actions_target')
BEGIN
    PRINT 'Creating index IX_moderation_actions_target...'
    CREATE INDEX IX_moderation_actions_target ON moderation_actions (target_type, target_id);
    PRINT '✓ IX_moderation_actions_target created'
END

-- =============================================================================
-- 8. ACHIEVEMENT SYSTEM TABLES (Future)
-- =============================================================================
-- Achievement definitions
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievements')
BEGIN
    PRINT 'Creating achievements table...'
    CREATE TABLE achievements (
        achievement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NOT NULL,
        category VARCHAR(50) NOT NULL,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic')),
        points INT NOT NULL DEFAULT 0,
        icon_name VARCHAR(50) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ achievements table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ achievements table already exists - skipping'
END

-- User achievement progress
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_achievements')
BEGIN
    PRINT 'Creating user_achievements table...'
    CREATE TABLE user_achievements (
        user_achievement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        achievement_id BIGINT NOT NULL,
        progress INT NOT NULL DEFAULT 0,
        target_value INT NOT NULL,
        is_completed BIT NOT NULL DEFAULT 0,
        completed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_user_achievements_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_user_achievements_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id),
        
        -- Unique constraint
        CONSTRAINT UQ_user_achievements UNIQUE (user_id, achievement_id)
    );
    PRINT '✓ user_achievements table created successfully'
END
ELSE
BEGIN
    PRINT '⚠ user_achievements table already exists - skipping'
END

-- Index for user_achievements
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_achievements_user')
BEGIN
    PRINT 'Creating index IX_user_achievements_user...'
    CREATE INDEX IX_user_achievements_user ON user_achievements (user_id, is_completed);
    PRINT '✓ IX_user_achievements_user created'
END

-- =============================================================================
-- 9. INSERT SAMPLE DATA
-- =============================================================================
-- Insert some basic achievements (only if they don't exist)
PRINT 'Checking sample achievement data...'

IF NOT EXISTS (SELECT * FROM achievements WHERE name = 'First Comment')
BEGIN
    PRINT 'Inserting sample achievements...'
    INSERT INTO achievements (name, description, category, tier, points) VALUES
    ('First Comment', 'Post your first comment on a card', 'Engagement', 'Common', 5),
    ('Conversation Starter', 'Have 5 people reply to your comments', 'Engagement', 'Uncommon', 10),
    ('Card Collector', 'Add 100 cards to your collection', 'Collection', 'Common', 15),
    ('Series Master', 'Complete an entire series', 'Collection', 'Rare', 25),
    ('Community Helper', 'Have 10 of your comments liked by others', 'Social', 'Uncommon', 10);
    PRINT '✓ Sample achievements inserted successfully'
END
ELSE
BEGIN
    PRINT '⚠ Sample achievements already exist - skipping'
END

-- =============================================================================
-- 10. COMPLETION SUMMARY
-- =============================================================================
PRINT ''
PRINT '============================================================'
PRINT 'SOCIAL FEATURES DATABASE SCHEMA INSTALLATION COMPLETE!'
PRINT '============================================================'
PRINT ''
PRINT 'Tables Created/Modified:'
PRINT '  1. universal_comments - Comments on cards, series, and sets'
PRINT '  2. user_item_subscriptions - Notification subscriptions'  
PRINT '  3. user_notifications - User notification system'
PRINT '  4. user_favorite_cards - Users favorite cards for profiles'
PRINT '  5. content_reports - Content moderation reports'
PRINT '  6. moderation_actions - Moderation action audit log'
PRINT '  7. achievements - Achievement definitions'
PRINT '  8. user_achievements - User achievement progress'
PRINT ''
PRINT 'User Table Enhancements Added:'
PRINT '  - username (NVARCHAR(50)) - Unique username for profiles'
PRINT '  - bio (NVARCHAR(500)) - User bio text'
PRINT '  - avatar_url (NVARCHAR(500)) - Profile picture URL'
PRINT '  - is_public_profile (BIT) - Profile visibility setting'
PRINT '  - is_muted (BIT) - User mute status for moderation'
PRINT '  - muted_at (DATETIME) - When user was muted'
PRINT '  - muted_by (BIGINT) - Who muted the user'
PRINT ''
PRINT 'Features Now Available:'
PRINT '  ✓ Universal commenting system'
PRINT '  ✓ User notifications'
PRINT '  ✓ Public user profiles'
PRINT '  ✓ Content moderation'
PRINT '  ✓ Achievement system foundation'
PRINT '  ✓ Favorite cards showcase'
PRINT ''
PRINT 'Next Steps:'
PRINT '  1. Update your API endpoints to use these tables'
PRINT '  2. Implement frontend components for social features'
PRINT '  3. Add notification processing logic'
PRINT '  4. Configure content moderation workflows'
PRINT ''
PRINT 'All database objects created safely with existence checks!'
PRINT '============================================================'

-- =============================================================================
-- DATABASE CHANGE TRACKING DOCUMENTATION
-- =============================================================================
/*
Add this to your DATABASE_CHANGE_TRACKING.md file:

## Social Features Implementation (January 2025)

### Tables Added:
1. `universal_comments` - Comments on cards, series, and sets
2. `user_item_subscriptions` - Notification subscriptions
3. `user_notifications` - User notification system
4. `user_favorite_cards` - User's favorite cards for profiles
5. `content_reports` - Content moderation reports
6. `moderation_actions` - Moderation action audit log
7. `achievements` - Achievement definitions
8. `user_achievements` - User achievement progress

### User Table Enhancements:
- `username` (NVARCHAR(50)) - Unique username for profiles
- `bio` (NVARCHAR(500)) - User bio text
- `avatar_url` (NVARCHAR(500)) - Profile picture URL
- `is_public_profile` (BIT) - Profile visibility setting
- `is_muted` (BIT) - User mute status for moderation
- `muted_at` (DATETIME) - When user was muted
- `muted_by` (BIGINT) - Who muted the user

### Features Enabled:
- Universal commenting system
- User notifications
- Public user profiles
- Content moderation
- Achievement system foundation
- Favorite cards showcase

### Safety Features:
- All objects include existence checks
- Safe for multiple executions
- Foreign key constraints included
- Performance indexes added
- Sample data only inserted if missing
*/