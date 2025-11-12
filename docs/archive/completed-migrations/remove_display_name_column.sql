-- Remove display_name column from user table
-- This field is no longer needed as we'll use username for display purposes

-- Check if column exists before dropping
IF COL_LENGTH('[user]', 'display_name') IS NOT NULL
BEGIN
    ALTER TABLE [user] DROP COLUMN display_name;
    PRINT 'display_name column dropped from user table';
END
ELSE
BEGIN
    PRINT 'display_name column does not exist in user table';
END