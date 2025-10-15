-- =============================================
-- User Follow System - Production Deployment
-- =============================================
-- Feature: LinkedIn-style follow/friendship system
-- Created: 2025-01-13
-- Status: READY FOR PRODUCTION
-- =============================================

-- Create user_follow table (only if it doesn't exist)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_follow')
BEGIN
    CREATE TABLE user_follow (
    user_follow_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    follower_user_id BIGINT NOT NULL,
    following_user_id BIGINT NOT NULL,
    created DATETIME2 NOT NULL DEFAULT GETDATE(),

    -- Foreign keys
    CONSTRAINT FK_user_follow_follower FOREIGN KEY (follower_user_id)
        REFERENCES [user](user_id) ON DELETE NO ACTION,
    CONSTRAINT FK_user_follow_following FOREIGN KEY (following_user_id)
        REFERENCES [user](user_id) ON DELETE NO ACTION,

    -- Prevent self-follows
    CONSTRAINT CK_user_follow_not_self CHECK (follower_user_id != following_user_id),

    -- Unique constraint: can't follow same user twice
    CONSTRAINT UQ_user_follow_pair UNIQUE (follower_user_id, following_user_id)
);

    -- Create indexes for performance
    CREATE INDEX IX_user_follow_follower ON user_follow(follower_user_id);
    CREATE INDEX IX_user_follow_following ON user_follow(following_user_id);
    CREATE INDEX IX_user_follow_created ON user_follow(created);
END;

GO

-- =============================================
-- Useful Views
-- =============================================

-- View: Get all friendships (reciprocal follows)
-- Note: Renamed from user_friendships to avoid conflicts with existing table
DROP VIEW IF EXISTS vw_user_friendships;
GO

CREATE VIEW vw_user_friendships AS
SELECT
    uf1.follower_user_id as user1_id,
    uf1.following_user_id as user2_id,
    uf1.created as user1_followed_at,
    uf2.created as user2_followed_at,
    CASE
        WHEN uf1.created > uf2.created THEN uf1.created
        ELSE uf2.created
    END as friendship_established_at
FROM user_follow uf1
INNER JOIN user_follow uf2
    ON uf1.follower_user_id = uf2.following_user_id
    AND uf1.following_user_id = uf2.follower_user_id
WHERE uf1.follower_user_id < uf1.following_user_id;

GO

-- =============================================
-- Stored Procedures
-- =============================================

-- Get follow stats for a user
DROP PROCEDURE IF EXISTS sp_get_user_follow_stats;
GO

CREATE PROCEDURE sp_get_user_follow_stats
    @user_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM user_follow WHERE following_user_id = @user_id) as followers_count,
        (SELECT COUNT(*) FROM user_follow WHERE follower_user_id = @user_id) as following_count,
        (SELECT COUNT(*) FROM vw_user_friendships
         WHERE user1_id = @user_id OR user2_id = @user_id) as friends_count;
END;

GO

-- Check follow status between two users
DROP PROCEDURE IF EXISTS sp_check_follow_status;
GO

CREATE PROCEDURE sp_check_follow_status
    @follower_user_id BIGINT,
    @following_user_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CASE WHEN EXISTS(
            SELECT 1 FROM user_follow
            WHERE follower_user_id = @follower_user_id
            AND following_user_id = @following_user_id
        ) THEN 1 ELSE 0 END as is_following,

        CASE WHEN EXISTS(
            SELECT 1 FROM user_follow
            WHERE follower_user_id = @following_user_id
            AND following_user_id = @follower_user_id
        ) THEN 1 ELSE 0 END as is_followed_by,

        CASE WHEN EXISTS(
            SELECT 1 FROM user_follow uf1
            INNER JOIN user_follow uf2
                ON uf1.follower_user_id = uf2.following_user_id
                AND uf1.following_user_id = uf2.follower_user_id
            WHERE uf1.follower_user_id = @follower_user_id
            AND uf1.following_user_id = @following_user_id
        ) THEN 1 ELSE 0 END as are_friends;
END;

GO

PRINT 'User follow system created successfully';
PRINT 'Table: user_follow';
PRINT 'View: vw_user_friendships';
PRINT 'Stored Procedures: sp_get_user_follow_stats, sp_check_follow_status';
