-- =============================================
-- Reset Slug Columns
-- Purpose: Clear existing slugs to allow re-population with duplicate handling
-- Date: 2025-01-04
-- =============================================

BEGIN TRANSACTION;

BEGIN TRY
    PRINT 'Resetting slug columns to NULL...'
    PRINT ''

    -- Drop existing indexes if they exist (they would block the reset)
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_set_slug' AND object_id = OBJECT_ID('[set]'))
    BEGIN
        DROP INDEX idx_set_slug ON [set];
        PRINT 'Dropped index: idx_set_slug'
    END

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_series_slug_set' AND object_id = OBJECT_ID('series'))
    BEGIN
        DROP INDEX idx_series_slug_set ON series;
        PRINT 'Dropped index: idx_series_slug_set'
    END

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_player_slug' AND object_id = OBJECT_ID('player'))
    BEGIN
        DROP INDEX idx_player_slug ON player;
        PRINT 'Dropped index: idx_player_slug'
    END

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_team_slug' AND object_id = OBJECT_ID('team'))
    BEGIN
        DROP INDEX idx_team_slug ON team;
        PRINT 'Dropped index: idx_team_slug'
    END

    PRINT ''

    -- Reset slug columns to NULL
    UPDATE [set] SET slug = NULL;
    PRINT 'Reset ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' set slugs'

    UPDATE series SET slug = NULL;
    PRINT 'Reset ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' series slugs'

    UPDATE player SET slug = NULL;
    PRINT 'Reset ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' player slugs'

    UPDATE team SET slug = NULL;
    PRINT 'Reset ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' team slugs'

    PRINT ''
    PRINT '===== SUCCESS ====='
    PRINT 'All slugs have been reset to NULL.'
    PRINT 'Next step: Run add-slug-columns-SAFE.sql to regenerate with duplicate handling'

    COMMIT TRANSACTION;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT ''
    PRINT '===== ERROR ====='
    PRINT 'Reset failed and was rolled back.'
    PRINT 'Error Message: ' + ERROR_MESSAGE()

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH

GO
