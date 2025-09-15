-- Achievement System Tables - Simple Working Version
-- Run this in your development database

USE CollectYourCards;
GO

PRINT 'Creating Achievement System Tables...';

-- 1. Achievement Categories
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_categories')
BEGIN
    CREATE TABLE achievement_categories (
        category_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500),
        icon NVARCHAR(255),
        display_order INT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT '✓ Created achievement_categories table';
END
GO

-- 2. Achievements
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievements')
BEGIN
    CREATE TABLE achievements (
        achievement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        category_id BIGINT REFERENCES achievement_categories(category_id),
        subcategory NVARCHAR(100),
        name NVARCHAR(200) NOT NULL UNIQUE,
        description NVARCHAR(500) NOT NULL,
        points INT NOT NULL DEFAULT 10,
        tier NVARCHAR(20) CHECK (tier IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic')),
        icon_url NVARCHAR(500),
        requirement_type NVARCHAR(50),
        requirement_value INT,
        requirement_query NVARCHAR(MAX),
        completion_query NVARCHAR(MAX),
        is_active BIT DEFAULT 1,
        is_secret BIT DEFAULT 0,
        is_repeatable BIT DEFAULT 0,
        cooldown_days INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME
    );
    CREATE INDEX IX_achievements_category ON achievements(category_id);
    CREATE INDEX IX_achievements_active ON achievements(is_active);
    CREATE INDEX IX_achievements_tier ON achievements(tier);
    PRINT '✓ Created achievements table';
END
GO

-- 3. User Achievements
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_achievements')
BEGIN
    CREATE TABLE user_achievements (
        user_achievement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        progress INT DEFAULT 0,
        progress_percentage DECIMAL(5,2) DEFAULT 0,
        is_completed BIT DEFAULT 0,
        completed_at DATETIME,
        points_awarded INT,
        times_completed INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        last_progress_update DATETIME
    );
    CREATE UNIQUE INDEX IX_user_achievements_unique ON user_achievements(user_id, achievement_id);
    CREATE INDEX IX_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IX_user_achievements_achievement ON user_achievements(achievement_id);
    CREATE INDEX IX_user_achievements_completed ON user_achievements(is_completed, completed_at DESC);
    PRINT '✓ Created user_achievements table';
END
GO

-- 4. User Achievement Stats
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_achievement_stats')
BEGIN
    CREATE TABLE user_achievement_stats (
        stat_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id) UNIQUE,
        total_points INT DEFAULT 0,
        total_achievements INT DEFAULT 0,
        common_achievements INT DEFAULT 0,
        uncommon_achievements INT DEFAULT 0,
        rare_achievements INT DEFAULT 0,
        epic_achievements INT DEFAULT 0,
        legendary_achievements INT DEFAULT 0,
        mythic_achievements INT DEFAULT 0,
        completion_percentage DECIMAL(5,2) DEFAULT 0,
        longest_streak INT DEFAULT 0,
        current_streak INT DEFAULT 0,
        last_achievement_date DATETIME,
        achievement_rate DECIMAL(10,2) DEFAULT 0,
        points_rank INT,
        achievements_rank INT,
        percentile_rank DECIMAL(5,2),
        updated_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✓ Created user_achievement_stats table';
END
GO

-- 5. Achievement History
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_history')
BEGIN
    CREATE TABLE achievement_history (
        history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        action NVARCHAR(50),
        previous_progress INT,
        new_progress INT,
        points_change INT DEFAULT 0,
        trigger_event NVARCHAR(100),
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_achievement_history_user ON achievement_history(user_id, created_at DESC);
    CREATE INDEX IX_achievement_history_achievement ON achievement_history(achievement_id, created_at DESC);
    PRINT '✓ Created achievement_history table';
END
GO

-- 6. User Streaks
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_streaks')
BEGIN
    CREATE TABLE user_streaks (
        streak_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        streak_type NVARCHAR(50) NOT NULL,
        current_count INT DEFAULT 0,
        longest_count INT DEFAULT 0,
        last_activity_date DATE,
        streak_start_date DATE,
        is_active BIT DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME
    );
    CREATE UNIQUE INDEX IX_user_streaks_unique ON user_streaks(user_id, streak_type);
    CREATE INDEX IX_user_streaks_user ON user_streaks(user_id);
    CREATE INDEX IX_user_streaks_type ON user_streaks(streak_type);
    PRINT '✓ Created user_streaks table';
END
GO

-- 7. Achievement Notifications
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_notifications')
BEGIN
    CREATE TABLE achievement_notifications (
        notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT REFERENCES achievements(achievement_id),
        notification_type NVARCHAR(50),
        title NVARCHAR(200),
        message NVARCHAR(500),
        icon_url NVARCHAR(500),
        points_awarded INT,
        is_sent BIT DEFAULT 0,
        is_read BIT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        sent_at DATETIME,
        read_at DATETIME
    );
    CREATE INDEX IX_notifications_user ON achievement_notifications(user_id, is_read, created_at DESC);
    PRINT '✓ Created achievement_notifications table';
END
GO

-- 8. Achievement Series
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_series')
BEGIN
    CREATE TABLE achievement_series (
        series_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        series_name NVARCHAR(200) NOT NULL,
        description NVARCHAR(500),
        category_id BIGINT REFERENCES achievement_categories(category_id),
        total_points INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Created achievement_series table';
END
GO

-- 9. Achievement Series Members
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_series_members')
BEGIN
    CREATE TABLE achievement_series_members (
        member_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        series_id BIGINT NOT NULL REFERENCES achievement_series(series_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        series_order INT DEFAULT 0
    );
    CREATE UNIQUE INDEX IX_series_members_unique ON achievement_series_members(series_id, achievement_id);
    PRINT '✓ Created achievement_series_members table';
END
GO

PRINT 'Achievement tables created successfully!';

-- Insert basic categories
IF NOT EXISTS (SELECT * FROM achievement_categories)
BEGIN
    INSERT INTO achievement_categories (name, description, display_order) VALUES
    ('Collection Milestones', 'Achievements for growing your card collection', 1),
    ('Rookie Cards', 'Achievements for collecting rookie cards', 2),
    ('Special Cards', 'Achievements for autographs, relics, and numbered cards', 3),
    ('Value & Investment', 'Achievements for collection value milestones', 4),
    ('Community & Social', 'Achievements for community participation', 5),
    ('Streaks & Activity', 'Achievements for consistent activity', 6);
    
    PRINT '✓ Inserted 6 basic achievement categories';
END
GO

PRINT 'Achievement system database setup complete!';