-- ============================================================================
-- PRODUCTION DATABASE UPDATE - Add Image Path Columns
-- ============================================================================
-- Run this in Azure Data Studio or Azure Portal Query Editor
-- Connect to: collectyourcards production database
-- ============================================================================

-- Add front_image_path column
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'front_image_path'
)
BEGIN
    PRINT 'Adding front_image_path column...';
    ALTER TABLE card ADD front_image_path NVARCHAR(MAX) NULL;
    PRINT 'Done!';
END
ELSE
BEGIN
    PRINT 'front_image_path already exists';
END

-- Add back_image_path column
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'back_image_path'
)
BEGIN
    PRINT 'Adding back_image_path column...';
    ALTER TABLE card ADD back_image_path NVARCHAR(MAX) NULL;
    PRINT 'Done!';
END
ELSE
BEGIN
    PRINT 'back_image_path already exists';
END

-- Verify columns were added
SELECT
    c.name as column_name,
    t.name as data_type,
    CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END as is_nullable
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('card')
AND c.name IN ('front_image_path', 'back_image_path')
ORDER BY c.name;

PRINT '';
PRINT 'Columns added successfully!';
PRINT 'You can now run the migration script.';
