-- =============================================
-- Column Customization Feature - ROLLBACK Script
-- CollectYourCards.com
-- =============================================
-- Purpose: Complete rollback of column customization feature
-- Created: 2025-10-28
-- WARNING: This will delete ALL user column preferences
-- =============================================

USE CollectYourCards;
GO

PRINT '========================================';
PRINT 'ROLLING BACK Column Customization Feature';
PRINT 'WARNING: This will delete all user preferences';
PRINT '========================================';
PRINT '';

-- =============================================
-- Drop indexes first
-- =============================================
PRINT 'Dropping indexes...';

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_table_preferences_composite' AND object_id = OBJECT_ID('user_table_preferences'))
BEGIN
    DROP INDEX IX_user_table_preferences_composite ON user_table_preferences;
    PRINT '  ✓ Dropped IX_user_table_preferences_composite';
END
ELSE
    PRINT '  - IX_user_table_preferences_composite does not exist';

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_table_preferences_user' AND object_id = OBJECT_ID('user_table_preferences'))
BEGIN
    DROP INDEX IX_user_table_preferences_user ON user_table_preferences;
    PRINT '  ✓ Dropped IX_user_table_preferences_user';
END
ELSE
    PRINT '  - IX_user_table_preferences_user does not exist';

PRINT '';

-- =============================================
-- Drop table
-- =============================================
PRINT 'Dropping table...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'user_table_preferences')
BEGIN
    DROP TABLE user_table_preferences;
    PRINT '  ✓ Dropped user_table_preferences table';
END
ELSE
    PRINT '  - user_table_preferences table does not exist';

PRINT '';
PRINT '========================================';
PRINT 'Rollback Complete!';
PRINT '';
PRINT 'Next steps to complete rollback:';
PRINT '  1. Remove /server/routes/user-table-preferences.js';
PRINT '  2. Remove /client/src/utils/tableColumnDefinitions.js';
PRINT '  3. Remove /client/src/components/ColumnPicker.jsx';
PRINT '  4. Restore original CardTable.jsx (git checkout)';
PRINT '  5. Restart server to remove API routes';
PRINT '';
PRINT '========================================';
GO
