-- =====================================
-- ACHIEVEMENT SYSTEM DATABASE SCHEMA
-- Comprehensive gamification framework
-- =====================================

-- Achievement categories for organization
CREATE TABLE achievement_categories (
    category_id INT PRIMARY KEY IDENTITY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    display_order INT,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME
);

-- Core achievement definitions
CREATE TABLE achievements (
    achievement_id BIGINT PRIMARY KEY IDENTITY,
    category_id INT NOT NULL FOREIGN KEY REFERENCES achievement_categories(category_id),
    subcategory VARCHAR(50),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    points INT NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic')),
    icon_url VARCHAR(500),
    requirement_type VARCHAR(50) NOT NULL, -- count, unique, value, streak, percentage, etc.
    requirement_value INT NOT NULL,
    requirement_query TEXT, -- SQL query to check achievement progress
    completion_query TEXT, -- SQL query to check if achievement is complete
    is_active BIT DEFAULT 1,
    is_secret BIT DEFAULT 0, -- Hidden until unlocked
    is_repeatable BIT DEFAULT 0, -- Can be earned multiple times
    cooldown_days INT DEFAULT 0, -- Days before can be earned again (if repeatable)
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME
);

-- User achievement progress and completion
CREATE TABLE user_achievements (
    user_achievement_id BIGINT PRIMARY KEY IDENTITY,
    user_id BIGINT NOT NULL FOREIGN KEY REFERENCES [user](user_id),
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    progress INT DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    is_completed BIT DEFAULT 0,
    completed_at DATETIME,
    points_awarded INT,
    notification_sent BIT DEFAULT 0,
    last_progress_update DATETIME DEFAULT GETDATE(),
    times_completed INT DEFAULT 0, -- For repeatable achievements
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    UNIQUE(user_id, achievement_id)
);

-- Achievement history tracking (for audit trail and analytics)
CREATE TABLE achievement_history (
    history_id BIGINT PRIMARY KEY IDENTITY,
    user_id BIGINT NOT NULL FOREIGN KEY REFERENCES [user](user_id),
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('earned', 'lost', 'progress', 'reset')),
    previous_progress INT,
    new_progress INT,
    points_change INT,
    trigger_event VARCHAR(100), -- what caused this change (e.g., 'card_added', 'card_removed')
    trigger_data TEXT, -- JSON data about the trigger
    created_at DATETIME DEFAULT GETDATE()
);

-- User achievement statistics (cached for performance)
CREATE TABLE user_achievement_stats (
    user_id BIGINT PRIMARY KEY FOREIGN KEY REFERENCES [user](user_id),
    total_points INT DEFAULT 0,
    total_achievements INT DEFAULT 0,
    common_achievements INT DEFAULT 0,
    uncommon_achievements INT DEFAULT 0,
    rare_achievements INT DEFAULT 0,
    epic_achievements INT DEFAULT 0,
    legendary_achievements INT DEFAULT 0,
    mythic_achievements INT DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    longest_streak INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    last_achievement_date DATETIME,
    achievement_rate DECIMAL(8,2), -- achievements per day
    points_rank INT, -- user's rank by total points
    achievements_rank INT, -- user's rank by total achievements
    percentile_rank INT, -- user's rank percentile among all users (1-100)
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME
);

-- Achievement dependencies (prerequisites)
CREATE TABLE achievement_dependencies (
    dependency_id BIGINT PRIMARY KEY IDENTITY,
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    required_achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    created_at DATETIME DEFAULT GETDATE(),
    UNIQUE(achievement_id, required_achievement_id)
);

-- Achievement series/chains for progressive achievements
CREATE TABLE achievement_series (
    series_id INT PRIMARY KEY IDENTITY,
    series_name VARCHAR(100) NOT NULL UNIQUE, -- e.g., "Card Count Collector"
    description TEXT,
    category_id INT FOREIGN KEY REFERENCES achievement_categories(category_id),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

-- Links achievements to their series
CREATE TABLE achievement_series_members (
    series_member_id BIGINT PRIMARY KEY IDENTITY,
    series_id INT NOT NULL FOREIGN KEY REFERENCES achievement_series(series_id),
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    series_order INT NOT NULL, -- Order within the series (1st, 2nd, 3rd, etc.)
    UNIQUE(series_id, achievement_id),
    UNIQUE(series_id, series_order)
);

-- Streak tracking for login, collection activity, etc.
CREATE TABLE user_streaks (
    streak_id BIGINT PRIMARY KEY IDENTITY,
    user_id BIGINT NOT NULL FOREIGN KEY REFERENCES [user](user_id),
    streak_type VARCHAR(50) NOT NULL, -- 'login', 'card_addition', 'comment', etc.
    current_count INT DEFAULT 0,
    longest_count INT DEFAULT 0,
    last_activity_date DATETIME,
    streak_start_date DATETIME,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    UNIQUE(user_id, streak_type)
);

-- Achievement events for seasonal/special achievements
CREATE TABLE achievement_events (
    event_id INT PRIMARY KEY IDENTITY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    point_multiplier DECIMAL(3,2) DEFAULT 1.00, -- 1.5x points during event
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

-- Links achievements to events
CREATE TABLE achievement_event_bonuses (
    bonus_id BIGINT PRIMARY KEY IDENTITY,
    event_id INT NOT NULL FOREIGN KEY REFERENCES achievement_events(event_id),
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    bonus_points INT DEFAULT 0,
    bonus_multiplier DECIMAL(3,2) DEFAULT 1.00,
    UNIQUE(event_id, achievement_id)
);

-- Achievement notifications queue
CREATE TABLE achievement_notifications (
    notification_id BIGINT PRIMARY KEY IDENTITY,
    user_id BIGINT NOT NULL FOREIGN KEY REFERENCES [user](user_id),
    achievement_id BIGINT NOT NULL FOREIGN KEY REFERENCES achievements(achievement_id),
    notification_type VARCHAR(20) CHECK (notification_type IN ('unlock', 'progress', 'milestone')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    icon_url VARCHAR(500),
    points_awarded INT,
    is_sent BIT DEFAULT 0,
    is_read BIT DEFAULT 0,
    sent_at DATETIME,
    read_at DATETIME,
    created_at DATETIME DEFAULT GETDATE()
);

-- Achievement leaderboards (cached for performance)
CREATE TABLE achievement_leaderboards (
    leaderboard_id BIGINT PRIMARY KEY IDENTITY,
    leaderboard_type VARCHAR(50) NOT NULL, -- 'total_points', 'monthly_points', 'category_points'
    category_id INT NULL FOREIGN KEY REFERENCES achievement_categories(category_id),
    period_start DATETIME,
    period_end DATETIME,
    user_id BIGINT NOT NULL FOREIGN KEY REFERENCES [user](user_id),
    score INT NOT NULL,
    rank_position INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    INDEX IX_leaderboard_type_period (leaderboard_type, period_start, period_end),
    INDEX IX_leaderboard_rank (leaderboard_type, rank_position)
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- User achievements indexes
CREATE INDEX IX_user_achievements_user_completed ON user_achievements(user_id, is_completed);
CREATE INDEX IX_user_achievements_completed_date ON user_achievements(completed_at DESC) WHERE is_completed = 1;
CREATE INDEX IX_user_achievements_progress ON user_achievements(user_id, progress_percentage);

-- Achievement history indexes
CREATE INDEX IX_achievement_history_user_date ON achievement_history(user_id, created_at DESC);
CREATE INDEX IX_achievement_history_achievement ON achievement_history(achievement_id, created_at DESC);
CREATE INDEX IX_achievement_history_trigger ON achievement_history(trigger_event, created_at DESC);

-- Achievement definitions indexes
CREATE INDEX IX_achievements_category ON achievements(category_id, is_active);
CREATE INDEX IX_achievements_tier ON achievements(tier, is_active);
CREATE INDEX IX_achievements_type ON achievements(requirement_type, is_active);

-- User stats indexes
CREATE INDEX IX_user_stats_points_rank ON user_achievement_stats(points_rank);
CREATE INDEX IX_user_stats_total_points ON user_achievement_stats(total_points DESC);
CREATE INDEX IX_user_stats_percentile ON user_achievement_stats(percentile_rank);

-- Notifications indexes
CREATE INDEX IX_notifications_user_unread ON achievement_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IX_notifications_unsent ON achievement_notifications(is_sent, created_at) WHERE is_sent = 0;

-- =====================================
-- INITIAL CATEGORY DATA
-- =====================================

INSERT INTO achievement_categories (name, description, icon, display_order) VALUES
('Collection Milestones', 'Achievements for reaching collection size goals', 'collection', 1),
('Rookie Cards', 'Achievements for collecting rookie cards', 'star', 2),
('Special Cards', 'Achievements for autographs, relics, and numbered cards', 'diamond', 3),
('Player Focus', 'Achievements for collecting specific players', 'user', 4),
('Vintage & Era', 'Achievements for collecting cards from specific time periods', 'clock', 5),
('Parallels & Inserts', 'Achievements for collecting parallel and insert cards', 'layers', 6),
('Brand Loyalty', 'Achievements for collecting specific manufacturers', 'tag', 7),
('Value & Investment', 'Achievements for collection value and graded cards', 'dollar-sign', 8),
('Community & Social', 'Achievements for social interactions and sharing', 'users', 9),
('Streaks & Activity', 'Achievements for consistent platform usage', 'calendar', 10),
('Sport Specific', 'Achievements specific to individual sports', 'trophy', 11),
('Aesthetic & Design', 'Achievements for unique card designs and features', 'eye', 12),
('Product Specific', 'Achievements for specific card products and sets', 'package', 13),
('Statistical', 'Achievements based on collection statistics', 'bar-chart', 14),
('Crowdsourcing', 'Achievements for contributing data to the platform', 'database', 15);

-- =====================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- =====================================

-- Procedure to update user achievement statistics
CREATE PROCEDURE UpdateUserAchievementStats(@user_id BIGINT)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Calculate current stats
    DECLARE @total_points INT, @total_achievements INT;
    DECLARE @common INT, @uncommon INT, @rare INT, @epic INT, @legendary INT, @mythic INT;
    DECLARE @completion_percentage DECIMAL(5,2), @last_achievement DATETIME;
    
    SELECT 
        @total_points = ISNULL(SUM(ua.points_awarded), 0),
        @total_achievements = COUNT(*),
        @common = SUM(CASE WHEN a.tier = 'Common' THEN 1 ELSE 0 END),
        @uncommon = SUM(CASE WHEN a.tier = 'Uncommon' THEN 1 ELSE 0 END),
        @rare = SUM(CASE WHEN a.tier = 'Rare' THEN 1 ELSE 0 END),
        @epic = SUM(CASE WHEN a.tier = 'Epic' THEN 1 ELSE 0 END),
        @legendary = SUM(CASE WHEN a.tier = 'Legendary' THEN 1 ELSE 0 END),
        @mythic = SUM(CASE WHEN a.tier = 'Mythic' THEN 1 ELSE 0 END),
        @last_achievement = MAX(ua.completed_at)
    FROM user_achievements ua
    INNER JOIN achievements a ON ua.achievement_id = a.achievement_id
    WHERE ua.user_id = @user_id AND ua.is_completed = 1;
    
    -- Calculate completion percentage
    DECLARE @total_available INT;
    SELECT @total_available = COUNT(*) FROM achievements WHERE is_active = 1 AND is_secret = 0;
    SET @completion_percentage = CASE WHEN @total_available > 0 THEN (@total_achievements * 100.0) / @total_available ELSE 0 END;
    
    -- Update or insert stats
    MERGE user_achievement_stats AS target
    USING (SELECT @user_id as user_id) AS source ON target.user_id = source.user_id
    WHEN MATCHED THEN
        UPDATE SET 
            total_points = @total_points,
            total_achievements = @total_achievements,
            common_achievements = @common,
            uncommon_achievements = @uncommon,
            rare_achievements = @rare,
            epic_achievements = @epic,
            legendary_achievements = @legendary,
            mythic_achievements = @mythic,
            completion_percentage = @completion_percentage,
            last_achievement_date = @last_achievement,
            updated_at = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (user_id, total_points, total_achievements, common_achievements, uncommon_achievements, 
                rare_achievements, epic_achievements, legendary_achievements, mythic_achievements,
                completion_percentage, last_achievement_date, created_at, updated_at)
        VALUES (@user_id, @total_points, @total_achievements, @common, @uncommon, @rare, @epic, 
                @legendary, @mythic, @completion_percentage, @last_achievement, GETDATE(), GETDATE());
END;

-- Procedure to check and update achievement progress
CREATE PROCEDURE CheckUserAchievementProgress(@user_id BIGINT, @achievement_id BIGINT)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @requirement_query NVARCHAR(MAX), @completion_query NVARCHAR(MAX);
    DECLARE @requirement_value INT, @current_progress INT;
    DECLARE @is_completed BIT = 0, @was_completed BIT;
    
    -- Get achievement details
    SELECT 
        @requirement_query = requirement_query,
        @completion_query = completion_query,
        @requirement_value = requirement_value
    FROM achievements 
    WHERE achievement_id = @achievement_id AND is_active = 1;
    
    -- Check if already completed
    SELECT @was_completed = ISNULL(is_completed, 0)
    FROM user_achievements 
    WHERE user_id = @user_id AND achievement_id = @achievement_id;
    
    -- Don't recheck if already completed (unless repeatable)
    IF @was_completed = 1 RETURN;
    
    -- Execute progress query to get current progress
    IF @requirement_query IS NOT NULL
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = REPLACE(@requirement_query, '@user_id', CAST(@user_id AS NVARCHAR(20)));
        DECLARE @progress_table TABLE (progress_value INT);
        INSERT INTO @progress_table EXEC sp_executesql @sql;
        SELECT @current_progress = progress_value FROM @progress_table;
    END
    
    -- Check if completed
    IF @completion_query IS NOT NULL
    BEGIN
        DECLARE @completion_sql NVARCHAR(MAX) = REPLACE(@completion_query, '@user_id', CAST(@user_id AS NVARCHAR(20)));
        DECLARE @completion_table TABLE (is_complete BIT);
        INSERT INTO @completion_table EXEC sp_executesql @completion_sql;
        SELECT @is_completed = is_complete FROM @completion_table;
    END
    ELSE
    BEGIN
        -- Default completion check: progress >= requirement
        SET @is_completed = CASE WHEN @current_progress >= @requirement_value THEN 1 ELSE 0 END;
    END
    
    -- Update or insert user achievement record
    MERGE user_achievements AS target
    USING (SELECT @user_id as user_id, @achievement_id as achievement_id) AS source 
        ON target.user_id = source.user_id AND target.achievement_id = source.achievement_id
    WHEN MATCHED THEN
        UPDATE SET 
            progress = @current_progress,
            progress_percentage = CASE WHEN @requirement_value > 0 THEN (@current_progress * 100.0) / @requirement_value ELSE 0 END,
            is_completed = @is_completed,
            completed_at = CASE WHEN @is_completed = 1 AND is_completed = 0 THEN GETDATE() ELSE completed_at END,
            points_awarded = CASE WHEN @is_completed = 1 AND is_completed = 0 THEN (SELECT points FROM achievements WHERE achievement_id = @achievement_id) ELSE points_awarded END,
            last_progress_update = GETDATE(),
            updated_at = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (user_id, achievement_id, progress, progress_percentage, is_completed, completed_at, points_awarded, last_progress_update, created_at, updated_at)
        VALUES (@user_id, @achievement_id, @current_progress, 
                CASE WHEN @requirement_value > 0 THEN (@current_progress * 100.0) / @requirement_value ELSE 0 END,
                @is_completed, 
                CASE WHEN @is_completed = 1 THEN GETDATE() ELSE NULL END,
                CASE WHEN @is_completed = 1 THEN (SELECT points FROM achievements WHERE achievement_id = @achievement_id) ELSE NULL END,
                GETDATE(), GETDATE(), GETDATE());
    
    -- If newly completed, create notification
    IF @is_completed = 1 AND @was_completed = 0
    BEGIN
        INSERT INTO achievement_notifications (user_id, achievement_id, notification_type, title, message, points_awarded, created_at)
        SELECT @user_id, @achievement_id, 'unlock', 
               'Achievement Unlocked: ' + name, 
               'Congratulations! You earned "' + name + '" for ' + CAST(points AS VARCHAR(10)) + ' points!',
               points,
               GETDATE()
        FROM achievements WHERE achievement_id = @achievement_id;
        
        -- Update user stats
        EXEC UpdateUserAchievementStats @user_id;
    END
END;