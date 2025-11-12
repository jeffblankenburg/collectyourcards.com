-- =============================================
-- Add Unique Indexes for Slug Columns
-- Purpose: Enforce slug uniqueness at database level
-- Date: 2025-01-04
-- =============================================

-- First, check for existing duplicate slugs before creating indexes
PRINT 'Checking for duplicate slugs...'

DECLARE @SetDupes INT = (SELECT COUNT(*) FROM (SELECT slug FROM [set] GROUP BY slug HAVING COUNT(*) > 1) as d)
DECLARE @SeriesDupes INT = (SELECT COUNT(*) FROM (SELECT [set], slug FROM series GROUP BY [set], slug HAVING COUNT(*) > 1) as d)
DECLARE @PlayerDupes INT = (SELECT COUNT(*) FROM (SELECT slug FROM player GROUP BY slug HAVING COUNT(*) > 1) as d)
DECLARE @TeamDupes INT = (SELECT COUNT(*) FROM (SELECT slug FROM team GROUP BY slug HAVING COUNT(*) > 1) as d)

IF @SetDupes > 0 OR @SeriesDupes > 0 OR @PlayerDupes > 0 OR @TeamDupes > 0
BEGIN
    PRINT ''
    PRINT '===== WARNING: DUPLICATE SLUGS DETECTED ====='
    PRINT 'Set duplicates: ' + CAST(@SetDupes AS NVARCHAR(10))
    PRINT 'Series duplicates: ' + CAST(@SeriesDupes AS NVARCHAR(10))
    PRINT 'Player duplicates: ' + CAST(@PlayerDupes AS NVARCHAR(10))
    PRINT 'Team duplicates: ' + CAST(@TeamDupes AS NVARCHAR(10))
    PRINT ''
    PRINT 'You must fix duplicates before creating unique indexes.'
    PRINT 'Run the duplicate fixing queries below:'
    PRINT ''

    -- Show duplicate sets
    IF @SetDupes > 0
    BEGIN
        PRINT '-- Duplicate Sets:'
        SELECT slug, COUNT(*) as count, STRING_AGG(CAST(set_id AS NVARCHAR(10)), ', ') as set_ids
        FROM [set]
        GROUP BY slug
        HAVING COUNT(*) > 1
    END

    -- Show duplicate players
    IF @PlayerDupes > 0
    BEGIN
        PRINT '-- Duplicate Players:'
        SELECT slug, COUNT(*) as count, STRING_AGG(CONCAT(first_name, ' ', last_name), ', ') as names
        FROM player
        GROUP BY slug
        HAVING COUNT(*) > 1
    END

    RAISERROR('Cannot create unique indexes - duplicate slugs exist. See output above.', 16, 1)
END
ELSE
BEGIN
    PRINT 'No duplicates found. Proceeding with index creation...'
    PRINT ''

    -- Create unique indexes
    PRINT 'Creating unique indexes...'

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_set_slug' AND object_id = OBJECT_ID('[set]'))
    BEGIN
        CREATE UNIQUE INDEX idx_set_slug ON [set](slug);
        PRINT 'Created: idx_set_slug'
    END
    ELSE
        PRINT 'Already exists: idx_set_slug'

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_series_slug_set' AND object_id = OBJECT_ID('series'))
    BEGIN
        CREATE UNIQUE INDEX idx_series_slug_set ON series(slug, [set]);
        PRINT 'Created: idx_series_slug_set'
    END
    ELSE
        PRINT 'Already exists: idx_series_slug_set'

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_player_slug' AND object_id = OBJECT_ID('player'))
    BEGIN
        CREATE UNIQUE INDEX idx_player_slug ON player(slug);
        PRINT 'Created: idx_player_slug'
    END
    ELSE
        PRINT 'Already exists: idx_player_slug'

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_team_slug' AND object_id = OBJECT_ID('team'))
    BEGIN
        CREATE UNIQUE INDEX idx_team_slug ON team(slug);
        PRINT 'Created: idx_team_slug'
    END
    ELSE
        PRINT 'Already exists: idx_team_slug'

    PRINT ''
    PRINT '===== SUCCESS ====='
    PRINT 'All unique indexes created successfully!'
END

GO
