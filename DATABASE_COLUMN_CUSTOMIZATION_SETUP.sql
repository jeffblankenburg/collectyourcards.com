-- =============================================
-- Column Customization Feature - Database Setup
-- CollectYourCards.com
-- =============================================
-- Purpose: Allow users to customize which columns they see in tables
-- Created: 2025-10-28
-- Feature: GitHub-style column visibility management
-- =============================================

USE CollectYourCards;
GO

PRINT '========================================';
PRINT 'Creating Column Customization Feature';
PRINT '========================================';
PRINT '';

-- =============================================
-- Create user_table_preferences table
-- =============================================
PRINT 'Creating user_table_preferences table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_table_preferences')
BEGIN
    CREATE TABLE user_table_preferences (
        preference_id BIGINT PRIMARY KEY IDENTITY(1,1),
        [user] BIGINT NOT NULL,
        table_name NVARCHAR(100) NOT NULL,
        visible_columns NVARCHAR(MAX) NOT NULL, -- JSON array of column IDs
        column_order NVARCHAR(MAX) NULL, -- JSON array for future drag-and-drop ordering
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),

        -- Ensure one preference row per user per table
        CONSTRAINT UQ_user_table_preferences UNIQUE ([user], table_name),

        -- Foreign key to user table
        CONSTRAINT FK_user_table_preferences_user FOREIGN KEY ([user])
            REFERENCES [user](user_id) ON DELETE CASCADE
    );

    PRINT '  ✓ Created user_table_preferences table';
END
ELSE
BEGIN
    PRINT '  - user_table_preferences table already exists';
END

-- =============================================
-- Create indexes for performance
-- =============================================
PRINT 'Creating indexes...';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_table_preferences_user' AND object_id = OBJECT_ID('user_table_preferences'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_table_preferences_user
    ON user_table_preferences([user])
    INCLUDE (table_name, visible_columns, column_order);

    PRINT '  ✓ Created IX_user_table_preferences_user';
END
ELSE
BEGIN
    PRINT '  - IX_user_table_preferences_user already exists';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_table_preferences_composite' AND object_id = OBJECT_ID('user_table_preferences'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_table_preferences_composite
    ON user_table_preferences([user], table_name)
    INCLUDE (visible_columns, column_order);

    PRINT '  ✓ Created IX_user_table_preferences_composite';
END
ELSE
BEGIN
    PRINT '  - IX_user_table_preferences_composite already exists';
END

PRINT '';

-- =============================================
-- Add sample data for testing (optional)
-- =============================================
PRINT 'Setup complete!';
PRINT '';
PRINT 'Table Information:';
PRINT '  • Table: user_table_preferences';
PRINT '  • Purpose: Store user column visibility preferences';
PRINT '  • Supported tables: card_table, collection_table';
PRINT '  • Foreign key: Cascades on user deletion';
PRINT '';
PRINT '========================================';
GO
