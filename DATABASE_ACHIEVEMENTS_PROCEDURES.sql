-- Achievement System Stored Procedures
USE CollectYourCards;
GO

PRINT 'Creating Achievement System Stored Procedures...';

-- 1. Check User Achievement Progress
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
    
    IF @query IS NOT NULL AND @requirement IS NOT NULL
    BEGIN
        -- Replace @user_id in the query with actual user ID
        SET @query = REPLACE(@query, '@user_id', CAST(@userId AS NVARCHAR(20)));
        
        -- Execute the progress query using dynamic SQL
        BEGIN TRY
            DECLARE @result TABLE (progress INT);
            INSERT INTO @result EXEC sp_executesql @query;
            
            SELECT @progress = ISNULL(progress, 0) FROM @result;
        END TRY
        BEGIN CATCH
            PRINT 'Error executing query for achievement ' + CAST(@achievementId AS NVARCHAR(20)) + ': ' + ERROR_MESSAGE();
            SET @progress = 0;
        END CATCH
        
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
                points_awarded = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN @points ELSE ISNULL(points_awarded, 0) END,
                times_completed = CASE WHEN @isCompleted = 1 AND is_completed = 0 THEN ISNULL(times_completed, 0) + 1 ELSE times_completed END,
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

-- 2. Update User Achievement Stats
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
    
    -- Calculate stats from user_achievements joined with achievements
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
                completion_percentage, last_achievement_date, updated_at)
        VALUES (@userId, @totalPoints, @totalAchievements, @commonCount, @uncommonCount,
                @rareCount, @epicCount, @legendaryCount, @mythicCount,
                @completionPercentage, 
                (SELECT MAX(completed_at) FROM user_achievements WHERE user_id = @userId AND is_completed = 1),
                GETDATE());
END
GO

PRINT '✓ Created UpdateUserAchievementStats procedure';
PRINT 'Achievement stored procedures created successfully!';