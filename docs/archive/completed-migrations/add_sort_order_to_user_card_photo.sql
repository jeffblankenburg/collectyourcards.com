-- Script to add sort_order column to user_card_photo table
-- Author: Claude
-- Date: 2024-08-20
-- Purpose: Enable photo ordering for user card photos (max 5 photos, sort_order 1 = primary)

-- Check if column already exists before adding
IF NOT EXISTS (
    SELECT * 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'user_card_photo' 
    AND COLUMN_NAME = 'sort_order'
)
BEGIN
    -- Add sort_order column
    ALTER TABLE user_card_photo
    ADD sort_order INT NOT NULL DEFAULT 1;
    
    PRINT 'Added sort_order column to user_card_photo table';
END
ELSE
BEGIN
    PRINT 'sort_order column already exists in user_card_photo table';
END
GO

-- Add check constraint to ensure sort_order is between 1 and 5
IF NOT EXISTS (
    SELECT * 
    FROM sys.check_constraints 
    WHERE name = 'CK_user_card_photo_sort_order'
)
BEGIN
    ALTER TABLE user_card_photo
    ADD CONSTRAINT CK_user_card_photo_sort_order 
    CHECK (sort_order >= 1 AND sort_order <= 5);
    
    PRINT 'Added check constraint for sort_order (1-5)';
END
GO

-- Create index on user_card and sort_order for efficient queries
IF NOT EXISTS (
    SELECT * 
    FROM sys.indexes 
    WHERE name = 'IX_user_card_photo_user_card_sort_order'
)
BEGIN
    CREATE INDEX IX_user_card_photo_user_card_sort_order
    ON user_card_photo (user_card, sort_order);
    
    PRINT 'Added index on user_card and sort_order';
END
GO

-- Update existing records to have sequential sort_order if any exist
-- This assigns sort_order based on created date
IF EXISTS (SELECT 1 FROM user_card_photo) 
   AND EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_card_photo' AND COLUMN_NAME = 'sort_order')
BEGIN
    EXEC sp_executesql N'
        WITH CTE AS (
            SELECT 
                user_card_photo_id,
                ROW_NUMBER() OVER (PARTITION BY user_card ORDER BY created, user_card_photo_id) as rn
            FROM user_card_photo
        )
        UPDATE ucp
        SET sort_order = CTE.rn
        FROM user_card_photo ucp
        INNER JOIN CTE ON ucp.user_card_photo_id = CTE.user_card_photo_id';
    
    PRINT 'Updated existing records with sequential sort_order values';
END

-- Verify the changes (using dynamic SQL to avoid compilation errors)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_card_photo' AND COLUMN_NAME = 'sort_order')
BEGIN
    EXEC sp_executesql N'
        SELECT 
            ''Table: user_card_photo'' as Description,
            COUNT(*) as TotalRecords,
            COUNT(DISTINCT user_card) as UniqueUserCards,
            MAX(sort_order) as MaxSortOrder
        FROM user_card_photo';

    -- Show sample of data with new column
    EXEC sp_executesql N'
        SELECT TOP 10
            user_card_photo_id,
            user_card,
            sort_order,
            created
        FROM user_card_photo
        ORDER BY user_card, sort_order';
END
ELSE
BEGIN
    PRINT 'Verification skipped - sort_order column not found';
END