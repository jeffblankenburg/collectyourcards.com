-- ============================================================================
-- PRODUCTION DEPLOYMENT SCRIPT: ACHIEVEMENT SYSTEM
-- ============================================================================
-- Run Date: Execute immediately after deploying achievement system code
-- Prerequisites: Backup database before running this script
-- Estimated Runtime: 5-10 minutes depending on database size
-- ============================================================================

-- Step 1: Verify we're in the correct database
USE CollectYourCards;
GO

PRINT '==========================================';
PRINT 'ACHIEVEMENT SYSTEM PRODUCTION DEPLOYMENT';
PRINT 'Started at: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '==========================================';
PRINT '';

-- ============================================================================
-- SECTION 1: CREATE ACHIEVEMENT TABLES
-- ============================================================================
PRINT 'SECTION 1: Creating Achievement Tables...';

-- 1.1 Achievement Categories Table
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
ELSE
    PRINT '• achievement_categories table already exists';

-- 1.2 Achievements Table
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
        requirement_type NVARCHAR(50), -- 'count', 'unique', 'value', 'streak', 'custom'
        requirement_value INT,
        requirement_query NVARCHAR(MAX), -- SQL query to check progress
        completion_query NVARCHAR(MAX), -- Optional query for completion check
        is_active BIT DEFAULT 1,
        is_secret BIT DEFAULT 0,
        is_repeatable BIT DEFAULT 0,
        cooldown_days INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME,
        INDEX IX_achievements_category (category_id),
        INDEX IX_achievements_active (is_active),
        INDEX IX_achievements_tier (tier)
    );
    PRINT '✓ Created achievements table';
END
ELSE
    PRINT '• achievements table already exists';

-- 1.3 User Achievements Table
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
        last_progress_update DATETIME,
        UNIQUE (user_id, achievement_id),
        INDEX IX_user_achievements_user (user_id),
        INDEX IX_user_achievements_achievement (achievement_id),
        INDEX IX_user_achievements_completed (is_completed, completed_at DESC)
    );
    PRINT '✓ Created user_achievements table';
END
ELSE
    PRINT '• user_achievements table already exists';

-- 1.4 Achievement Series Table
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
ELSE
    PRINT '• achievement_series table already exists';

-- 1.5 Achievement Series Members Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_series_members')
BEGIN
    CREATE TABLE achievement_series_members (
        member_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        series_id BIGINT NOT NULL REFERENCES achievement_series(series_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        series_order INT DEFAULT 0,
        UNIQUE (series_id, achievement_id)
    );
    PRINT '✓ Created achievement_series_members table';
END
ELSE
    PRINT '• achievement_series_members table already exists';

-- 1.6 User Achievement Stats Table
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
        achievement_rate DECIMAL(10,2) DEFAULT 0, -- achievements per day
        points_rank INT,
        achievements_rank INT,
        percentile_rank DECIMAL(5,2),
        updated_at DATETIME DEFAULT GETDATE()
    );
    PRINT '✓ Created user_achievement_stats table';
END
ELSE
    PRINT '• user_achievement_stats table already exists';

-- 1.7 Achievement History Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_history')
BEGIN
    CREATE TABLE achievement_history (
        history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        action NVARCHAR(50), -- 'started', 'progress_update', 'completed', 'reset'
        previous_progress INT,
        new_progress INT,
        points_change INT DEFAULT 0,
        trigger_event NVARCHAR(100), -- What caused this update
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        INDEX IX_achievement_history_user (user_id, created_at DESC),
        INDEX IX_achievement_history_achievement (achievement_id, created_at DESC)
    );
    PRINT '✓ Created achievement_history table';
END
ELSE
    PRINT '• achievement_history table already exists';

-- 1.8 User Streaks Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_streaks')
BEGIN
    CREATE TABLE user_streaks (
        streak_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        streak_type NVARCHAR(50) NOT NULL, -- 'login', 'card_addition', 'comment', etc.
        current_count INT DEFAULT 0,
        longest_count INT DEFAULT 0,
        last_activity_date DATE,
        streak_start_date DATE,
        is_active BIT DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME,
        UNIQUE (user_id, streak_type),
        INDEX IX_user_streaks_user (user_id),
        INDEX IX_user_streaks_type (streak_type)
    );
    PRINT '✓ Created user_streaks table';
END
ELSE
    PRINT '• user_streaks table already exists';

-- 1.9 Achievement Notifications Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_notifications')
BEGIN
    CREATE TABLE achievement_notifications (
        notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT REFERENCES achievements(achievement_id),
        notification_type NVARCHAR(50), -- 'achievement_unlocked', 'milestone_reached', etc.
        title NVARCHAR(200),
        message NVARCHAR(500),
        icon_url NVARCHAR(500),
        points_awarded INT,
        is_sent BIT DEFAULT 0,
        is_read BIT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        sent_at DATETIME,
        read_at DATETIME,
        INDEX IX_notifications_user (user_id, is_read, created_at DESC)
    );
    PRINT '✓ Created achievement_notifications table';
END
ELSE
    PRINT '• achievement_notifications table already exists';

-- 1.10 Achievement Challenges Table (for fraud prevention)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_challenges')
BEGIN
    CREATE TABLE achievement_challenges (
        challenge_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES [user](user_id),
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        challenge_type NVARCHAR(50), -- 'suspicious_progress', 'rapid_completion', etc.
        challenge_reason NVARCHAR(500),
        status NVARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        resolved_at DATETIME,
        resolved_by BIGINT REFERENCES [user](user_id),
        resolution_notes NVARCHAR(500)
    );
    PRINT '✓ Created achievement_challenges table';
END
ELSE
    PRINT '• achievement_challenges table already exists';

-- 1.11 Achievement Dependencies Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'achievement_dependencies')
BEGIN
    CREATE TABLE achievement_dependencies (
        dependency_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        required_achievement_id BIGINT NOT NULL REFERENCES achievements(achievement_id),
        UNIQUE (achievement_id, required_achievement_id)
    );
    PRINT '✓ Created achievement_dependencies table';
END
ELSE
    PRINT '• achievement_dependencies table already exists';

PRINT '';
PRINT 'SECTION 1 COMPLETE: All achievement tables created/verified';
PRINT '';

-- ============================================================================
-- SECTION 2: CREATE STORED PROCEDURES
-- ============================================================================
PRINT 'SECTION 2: Creating Stored Procedures...';

-- 2.1 Check User Achievement Progress
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'CheckUserAchievementProgress')
    DROP PROCEDURE CheckUserAchievementProgress;
GO

CREATE PROCEDURE CheckUserAchievementProgress
    @userId BIGINT,
    @achievementId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @query NVARCHAR(MAX);
    DECLARE @progress INT = 0;
    DECLARE @requirement INT;
    DECLARE @isCompleted BIT = 0;
    DECLARE @progressPercentage DECIMAL(5,2) = 0;
    DECLARE @points INT;
    
    -- Get achievement details
    SELECT 
        @query = requirement_query,
        @requirement = requirement_value,
        @points = points
    FROM achievements
    WHERE achievement_id = @achievementId AND is_active = 1;
    
    IF @query IS NOT NULL
    BEGIN
        -- Execute the progress query
        DECLARE @sql NVARCHAR(MAX) = REPLACE(@query, '@user_id', CAST(@userId AS NVARCHAR(20)));
        
        CREATE TABLE #TempProgress (progress INT);
        INSERT INTO #TempProgress EXEC sp_executesql @sql;
        
        SELECT @progress = ISNULL(progress, 0) FROM #TempProgress;
        DROP TABLE #TempProgress;
        
        -- Calculate completion
        IF @progress >= @requirement
        BEGIN
            SET @isCompleted = 1;
            SET @progressPercentage = 100;
        END
        ELSE
        BEGIN
            SET @progressPercentage = CAST(@progress AS DECIMAL(10,2)) / CAST(@requirement AS DECIMAL(10,2)) * 100;
        END
        
        -- Update or insert user achievement record
        MERGE user_achievements AS target
        USING (SELECT @userId AS user_id, @achievementId AS achievement_id) AS source
        ON target.user_id = source.user_id AND target.achievement_id = source.achievement_id
        WHEN MATCHED THEN
            UPDATE SET
                progress = @progress,
                progress_percentage = @progressPercentage,
                is_completed = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN 1 ELSE is_completed END,
                completed_at = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN GETDATE() ELSE completed_at END,
                points_awarded = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN @points ELSE points_awarded END,
                times_completed = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN times_completed + 1 ELSE times_completed END,
                last_progress_update = GETDATE()
        WHEN NOT MATCHED AND @progress > 0 THEN
            INSERT (user_id, achievement_id, progress, progress_percentage, is_completed, completed_at, points_awarded, times_completed, created_at, last_progress_update)
            VALUES (@userId, @achievementId, @progress, @progressPercentage, @isCompleted, 
                    CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END,
                    CASE WHEN @isCompleted = 1 THEN @points ELSE 0 END,
                    CASE WHEN @isCompleted = 1 THEN 1 ELSE 0 END,
                    GETDATE(), GETDATE());
    END
END
GO
PRINT '✓ Created CheckUserAchievementProgress procedure';

-- 2.2 Update User Achievement Stats
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'UpdateUserAchievementStats')
    DROP PROCEDURE UpdateUserAchievementStats;
GO

CREATE PROCEDURE UpdateUserAchievementStats
    @userId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @totalPoints INT = 0;
    DECLARE @totalAchievements INT = 0;
    DECLARE @commonCount INT = 0;
    DECLARE @uncommonCount INT = 0;
    DECLARE @rareCount INT = 0;
    DECLARE @epicCount INT = 0;
    DECLARE @legendaryCount INT = 0;
    DECLARE @mythicCount INT = 0;
    DECLARE @completionPercentage DECIMAL(5,2) = 0;
    DECLARE @totalPossibleAchievements INT = 0;
    
    -- Calculate stats
    SELECT 
        @totalPoints = ISNULL(SUM(ua.points_awarded), 0),
        @totalAchievements = COUNT(CASE WHEN ua.is_completed = 1 THEN 1 END),
        @commonCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Common' THEN 1 END),
        @uncommonCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Uncommon' THEN 1 END),
        @rareCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Rare' THEN 1 END),
        @epicCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Epic' THEN 1 END),
        @legendaryCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Legendary' THEN 1 END),
        @mythicCount = COUNT(CASE WHEN ua.is_completed = 1 AND a.tier = 'Mythic' THEN 1 END)
    FROM user_achievements ua
    JOIN achievements a ON ua.achievement_id = a.achievement_id
    WHERE ua.user_id = @userId;
    
    -- Get total possible achievements
    SELECT @totalPossibleAchievements = COUNT(*) 
    FROM achievements 
    WHERE is_active = 1 AND is_secret = 0;
    
    -- Calculate completion percentage
    IF @totalPossibleAchievements > 0
        SET @completionPercentage = CAST(@totalAchievements AS DECIMAL(10,2)) / CAST(@totalPossibleAchievements AS DECIMAL(10,2)) * 100;
    
    -- Update or insert stats
    MERGE user_achievement_stats AS target
    USING (SELECT @userId AS user_id) AS source
    ON target.user_id = source.user_id
    WHEN MATCHED THEN
        UPDATE SET
            total_points = @totalPoints,
            total_achievements = @totalAchievements,
            common_achievements = @commonCount,
            uncommon_achievements = @uncommonCount,
            rare_achievements = @rareCount,
            epic_achievements = @epicCount,
            legendary_achievements = @legendaryCount,
            mythic_achievements = @mythicCount,
            completion_percentage = @completionPercentage,
            last_achievement_date = (SELECT MAX(completed_at) FROM user_achievements WHERE user_id = @userId AND is_completed = 1),
            updated_at = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (user_id, total_points, total_achievements, common_achievements, uncommon_achievements, 
                rare_achievements, epic_achievements, legendary_achievements, mythic_achievements,
                completion_percentage, last_achievement_date)
        VALUES (@userId, @totalPoints, @totalAchievements, @commonCount, @uncommonCount,
                @rareCount, @epicCount, @legendaryCount, @mythicCount,
                @completionPercentage, 
                (SELECT MAX(completed_at) FROM user_achievements WHERE user_id = @userId AND is_completed = 1));
END
GO
PRINT '✓ Created UpdateUserAchievementStats procedure';

PRINT '';
PRINT 'SECTION 2 COMPLETE: Stored procedures created';
PRINT '';

-- ============================================================================
-- SECTION 3: INSERT ACHIEVEMENT CATEGORIES
-- ============================================================================
PRINT 'SECTION 3: Inserting Achievement Categories...';

-- Insert categories if they don't exist
IF NOT EXISTS (SELECT * FROM achievement_categories)
BEGIN
    INSERT INTO achievement_categories (name, description, icon, display_order) VALUES
    ('Collection Milestones', 'Achievements for growing your card collection', '📦', 1),
    ('Rookie Cards', 'Achievements for collecting rookie cards', '🌟', 2),
    ('Special Cards', 'Achievements for autographs, relics, and numbered cards', '✨', 3),
    ('Team Collections', 'Achievements for team-specific collections', '🏆', 4),
    ('Player Collections', 'Achievements for player-specific collections', '👤', 5),
    ('Set Completion', 'Achievements for completing sets and series', '📚', 6),
    ('Trading & Market', 'Achievements for trading and market activities', '💱', 7),
    ('Value & Investment', 'Achievements for collection value milestones', '💰', 8),
    ('Community & Social', 'Achievements for community participation', '👥', 9),
    ('Streaks & Activity', 'Achievements for consistent activity', '🔥', 10),
    ('Seasonal & Events', 'Limited-time and seasonal achievements', '🎉', 11),
    ('Expertise & Knowledge', 'Achievements for demonstrating card knowledge', '🎓', 12),
    ('Rarity Hunter', 'Achievements for finding rare and unique cards', '💎', 13),
    ('Grading & Authentication', 'Achievements for graded card collections', '🏅', 14),
    ('Legacy & Prestige', 'Elite achievements for dedicated collectors', '👑', 15);
    
    PRINT '✓ Inserted 15 achievement categories';
END
ELSE
    PRINT '• Achievement categories already exist';

PRINT '';
PRINT 'SECTION 3 COMPLETE: Categories ready';
PRINT '';

-- ============================================================================
-- SECTION 4: INSERT CORE ACHIEVEMENTS
-- ============================================================================
PRINT 'SECTION 4: Inserting Core Achievements...';

-- Execute the seed data script content
-- Note: This is the content from DATABASE_ACHIEVEMENTS_SEED.sql

-- Check if achievements already exist
IF NOT EXISTS (SELECT * FROM achievements)
BEGIN
    DECLARE @cat1 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Collection Milestones');
    DECLARE @cat2 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Rookie Cards');
    DECLARE @cat3 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Special Cards');
    DECLARE @cat8 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Value & Investment');
    DECLARE @cat9 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Community & Social');
    DECLARE @cat10 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Streaks & Activity');
    
    -- Collection Milestones
    INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat1, 'First Card', 'Add your first card to your collection', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Starting Five', 'Collect 5 cards', 10, 'Common', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Double Digits', 'Collect 10 cards', 10, 'Common', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Quarter Century', 'Collect 25 cards', 15, 'Uncommon', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Half Century', 'Collect 50 cards', 20, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Century Mark', 'Collect 100 cards', 25, 'Uncommon', 'count', 100, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Double Century', 'Collect 200 cards', 30, 'Rare', 'count', 200, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Quincentennial', 'Collect 500 cards', 50, 'Rare', 'count', 500, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, 'Millennium Collector', 'Collect 1,000 cards', 75, 'Epic', 'count', 1000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, '2K Club', 'Collect 2,000 cards', 100, 'Epic', 'count', 2000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, '5K Elite', 'Collect 5,000 cards', 150, 'Legendary', 'count', 5000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, '10K Legend', 'Collect 10,000 cards', 250, 'Legendary', 'count', 10000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
    (@cat1, '25K Master', 'Collect 25,000 cards', 500, 'Mythic', 'count', 25000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1);
    
    -- Rookie Card Achievements
    INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat2, 'First Rookie', 'Add your first rookie card', 10, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
    (@cat2, 'Rookie Five', 'Collect 5 rookie cards', 15, 'Uncommon', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
    (@cat2, 'Rookie Squad', 'Collect 10 rookie cards', 25, 'Uncommon', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
    (@cat2, 'Draft Class', 'Collect 25 rookie cards', 30, 'Rare', 'count', 25, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
    (@cat2, 'Rookie Showcase', 'Collect 50 rookie cards', 50, 'Rare', 'count', 50, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1);
    
    -- Special Card Achievements
    INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat3, 'First Signature', 'Add your first autographed card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
    (@cat3, 'Pen Pal', 'Collect 5 autographed cards', 50, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
    (@cat3, 'Signature Collection', 'Collect 10 autographed cards', 75, 'Epic', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
    (@cat3, 'First Relic', 'Add your first relic card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
    (@cat3, 'Relic Hunter', 'Collect 5 relic cards', 50, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
    (@cat3, 'Memory Lane', 'Collect 10 relic cards', 75, 'Epic', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1);
    
    -- Value & Investment Achievements
    INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat8, 'First Dollar', 'Collection value reaches $100', 10, 'Common', 'value', 100, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
    (@cat8, 'Benjamin Club', 'Collection value reaches $500', 25, 'Uncommon', 'value', 500, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
    (@cat8, 'Grand Collection', 'Collection value reaches $1,000', 50, 'Rare', 'value', 1000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
    (@cat8, 'Five Grand', 'Collection value reaches $5,000', 100, 'Epic', 'value', 5000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1);
    
    -- Community & Social Achievements
    INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat9, 'First Comment', 'Leave your first comment', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
    (@cat9, 'Conversationalist', 'Leave 10 comments', 15, 'Common', 'count', 10, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
    (@cat9, 'Discussion Leader', 'Leave 50 comments', 30, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
    (@cat9, 'Community Voice', 'Leave 100 comments', 50, 'Rare', 'count', 100, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1);
    
    -- Streaks & Activity Achievements
    INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
    (@cat10, 'Login Streaks', 'Welcome Back', 'Log in 2 days in a row', 5, 'Common', 'streak', 2, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
    (@cat10, 'Login Streaks', 'Regular Visitor', '7-day login streak', 10, 'Common', 'streak', 7, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
    (@cat10, 'Login Streaks', 'Dedicated Collector', '30-day login streak', 25, 'Uncommon', 'streak', 30, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
    (@cat10, 'Login Streaks', 'Daily Devotion', '60-day login streak', 50, 'Rare', 'streak', 60, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1);
    
    PRINT '✓ Inserted 37 core achievements';
END
ELSE
    PRINT '• Achievements already exist in database';

PRINT '';
PRINT 'SECTION 4 COMPLETE: Core achievements ready';
PRINT '';

-- ============================================================================
-- SECTION 5: CREATE ACHIEVEMENT SERIES
-- ============================================================================
PRINT 'SECTION 5: Creating Achievement Series...';

IF NOT EXISTS (SELECT * FROM achievement_series)
BEGIN
    INSERT INTO achievement_series (series_name, description, category_id) VALUES
    ('Card Count Collector', 'Progressive achievements for growing your collection size', 1),
    ('Rookie Card Hunter', 'Progressive achievements for collecting rookie cards', 2),
    ('Social Butterfly', 'Progressive achievements for community participation', 9);
    
    PRINT '✓ Created 3 achievement series';
END
ELSE
    PRINT '• Achievement series already exist';

PRINT '';
PRINT 'SECTION 5 COMPLETE: Achievement series created';
PRINT '';

-- ============================================================================
-- SECTION 6: RETROACTIVE ACHIEVEMENT CALCULATION
-- ============================================================================
PRINT 'SECTION 6: Calculating Retroactive Achievements...';
PRINT 'NOTE: This section calculates achievements for existing users';
PRINT 'Processing may take several minutes depending on user count...';
PRINT '';

-- Process achievements for all existing users
DECLARE @userId BIGINT;
DECLARE @processedCount INT = 0;
DECLARE @totalUsers INT = (SELECT COUNT(*) FROM [user] WHERE is_active = 1);

PRINT 'Total active users to process: ' + CAST(@totalUsers AS VARCHAR(10));
PRINT '';

DECLARE user_cursor CURSOR FOR 
    SELECT user_id FROM [user] WHERE is_active = 1 ORDER BY user_id;

OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @userId;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Process each achievement for this user
    DECLARE @achievementId BIGINT;
    DECLARE achievement_cursor CURSOR FOR 
        SELECT achievement_id FROM achievements WHERE is_active = 1;
    
    OPEN achievement_cursor;
    FETCH NEXT FROM achievement_cursor INTO @achievementId;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Check achievement progress
        EXEC CheckUserAchievementProgress @userId, @achievementId;
        
        FETCH NEXT FROM achievement_cursor INTO @achievementId;
    END
    
    CLOSE achievement_cursor;
    DEALLOCATE achievement_cursor;
    
    -- Update user stats
    EXEC UpdateUserAchievementStats @userId;
    
    SET @processedCount = @processedCount + 1;
    
    -- Show progress every 100 users
    IF @processedCount % 100 = 0
    BEGIN
        PRINT 'Processed ' + CAST(@processedCount AS VARCHAR(10)) + ' / ' + CAST(@totalUsers AS VARCHAR(10)) + ' users...';
    END
    
    FETCH NEXT FROM user_cursor INTO @userId;
END

CLOSE user_cursor;
DEALLOCATE user_cursor;

PRINT '';
PRINT '✓ Completed retroactive achievement calculation for ' + CAST(@processedCount AS VARCHAR(10)) + ' users';
PRINT '';

-- ============================================================================
-- SECTION 7: FINAL STATISTICS
-- ============================================================================
PRINT 'SECTION 7: Final Statistics';
PRINT '==========================================';

-- Show achievement statistics
DECLARE @totalAchievements INT = (SELECT COUNT(*) FROM achievements WHERE is_active = 1);
DECLARE @totalAwardedAchievements INT = (SELECT COUNT(*) FROM user_achievements WHERE is_completed = 1);
DECLARE @totalPoints INT = (SELECT ISNULL(SUM(points_awarded), 0) FROM user_achievements);
DECLARE @usersWithAchievements INT = (SELECT COUNT(DISTINCT user_id) FROM user_achievements WHERE is_completed = 1);

PRINT 'Total Achievements Available: ' + CAST(@totalAchievements AS VARCHAR(10));
PRINT 'Total Achievements Awarded: ' + CAST(@totalAwardedAchievements AS VARCHAR(10));
PRINT 'Total Points Awarded: ' + CAST(@totalPoints AS VARCHAR(10));
PRINT 'Users with Achievements: ' + CAST(@usersWithAchievements AS VARCHAR(10));

PRINT '';
PRINT '==========================================';
PRINT 'DEPLOYMENT COMPLETE!';
PRINT 'Completed at: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '==========================================';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Deploy application code with achievement features';
PRINT '2. Monitor achievement_notifications table for user engagement';
PRINT '3. Review achievement_history for activity patterns';
PRINT '4. Consider adding more achievements based on user behavior';
PRINT '';
GO