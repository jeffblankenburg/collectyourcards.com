-- =============================================
-- COMPLETE SLUG MIGRATION - ALL-IN-ONE
-- Purpose: Reset and regenerate all slugs with proper duplicate handling
-- Date: 2025-01-04
--
-- This script:
-- 1. Drops existing indexes
-- 2. Clears all existing slugs
-- 3. Adds slug columns if they don't exist
-- 4. Generates fresh slugs with proper algorithm
-- 5. Handles duplicates intelligently
-- 6. Creates unique indexes
-- 7. Validates everything worked
--
-- SAFE: Uses transaction for rollback on any error
-- =============================================

BEGIN TRANSACTION;

BEGIN TRY
    PRINT '===== SLUG MIGRATION STARTING ====='
    PRINT ''

    -- =============================================
    -- STEP 1: Drop existing indexes (if any)
    -- =============================================

    PRINT 'Step 1: Dropping existing indexes...'

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_set_slug' AND object_id = OBJECT_ID('[set]'))
    BEGIN
        DROP INDEX idx_set_slug ON [set];
        PRINT '  Dropped: idx_set_slug'
    END

    -- Drop old scoped index if it exists
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_series_slug_set' AND object_id = OBJECT_ID('series'))
    BEGIN
        DROP INDEX idx_series_slug_set ON series;
        PRINT '  Dropped: idx_series_slug_set (old scoped index)'
    END

    -- Drop new global index if it exists
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_series_slug' AND object_id = OBJECT_ID('series'))
    BEGIN
        DROP INDEX idx_series_slug ON series;
        PRINT '  Dropped: idx_series_slug'
    END

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_player_slug' AND object_id = OBJECT_ID('player'))
    BEGIN
        DROP INDEX idx_player_slug ON player;
        PRINT '  Dropped: idx_player_slug'
    END

    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_team_slug' AND object_id = OBJECT_ID('team'))
    BEGIN
        DROP INDEX idx_team_slug ON team;
        PRINT '  Dropped: idx_team_slug'
    END

    PRINT ''

    -- =============================================
    -- STEP 2: Add slug columns if they don't exist
    -- =============================================

    PRINT 'Step 2: Ensuring slug columns exist...'

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
    BEGIN
        ALTER TABLE [set] ADD slug NVARCHAR(255) NULL;
        PRINT '  Added: [set].slug'
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
    BEGIN
        ALTER TABLE series ADD slug NVARCHAR(255) NULL;
        PRINT '  Added: series.slug'
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
    BEGIN
        ALTER TABLE player ADD slug NVARCHAR(255) NULL;
        PRINT '  Added: player.slug'
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
    BEGIN
        ALTER TABLE team ADD slug NVARCHAR(255) NULL;
        PRINT '  Added: team.slug'
    END

    PRINT ''

    -- =============================================
    -- STEP 3: Make columns nullable (so we can clear them)
    -- =============================================

    PRINT 'Step 3: Making slug columns nullable...'

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug' AND is_nullable = 0)
    BEGIN
        ALTER TABLE [set] ALTER COLUMN slug NVARCHAR(255) NULL;
        PRINT '  Made [set].slug nullable'
    END

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug' AND is_nullable = 0)
    BEGIN
        ALTER TABLE series ALTER COLUMN slug NVARCHAR(255) NULL;
        PRINT '  Made series.slug nullable'
    END

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug' AND is_nullable = 0)
    BEGIN
        ALTER TABLE player ALTER COLUMN slug NVARCHAR(255) NULL;
        PRINT '  Made player.slug nullable'
    END

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug' AND is_nullable = 0)
    BEGIN
        ALTER TABLE team ALTER COLUMN slug NVARCHAR(255) NULL;
        PRINT '  Made team.slug nullable'
    END

    PRINT ''

    -- =============================================
    -- STEP 4: Clear all existing slugs
    -- =============================================

    PRINT 'Step 4: Clearing all existing slugs...'

    UPDATE [set] SET slug = NULL;
    PRINT '  Cleared ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' set slugs'

    UPDATE series SET slug = NULL;
    PRINT '  Cleared ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' series slugs'

    UPDATE player SET slug = NULL;
    PRINT '  Cleared ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' player slugs'

    UPDATE team SET slug = NULL;
    PRINT '  Cleared ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' team slugs'

    PRINT ''

    -- =============================================
    -- STEP 5: Generate SET slugs
    -- =============================================

    PRINT 'Step 5: Generating set slugs...'

    -- Generate base slugs
    UPDATE [set]
    SET slug = LTRIM(RTRIM(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            LOWER(name),
                                                            '&', 'and'
                                                        ),
                                                        '''', ''
                                                    ),
                                                    ' ', '-'
                                                ),
                                                '/', '-'
                                            ),
                                            '.', ''
                                        ),
                                        '(', ''
                                    ),
                                    ')', ''
                                ),
                                ',', ''
                            ),
                            '!', ''
                        ),
                        '?', ''
                    ),
                    '--', '-'
                ),
                '--', '-'
            ),
            '--', '-'
        )
    ));

    -- Clean leading hyphens
    UPDATE [set] SET slug = SUBSTRING(slug, 2, LEN(slug)) WHERE LEFT(slug, 1) = '-';

    -- Clean trailing hyphens
    UPDATE [set] SET slug = SUBSTRING(slug, 1, LEN(slug) - 1) WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicates: Use ROW_NUMBER to disambiguate each duplicate uniquely
    WITH RankedSets AS (
        SELECT
            s.set_id,
            s.slug,
            o.sport,
            o.abbreviation,
            ROW_NUMBER() OVER (PARTITION BY s.slug ORDER BY s.set_id) as rn,
            COUNT(*) OVER (PARTITION BY s.slug) as dup_count
        FROM [set] s
        LEFT JOIN organization o ON s.organization = o.organization_id
    )
    UPDATE s
    SET s.slug =
        CASE
            -- Not a duplicate - leave as is
            WHEN r.dup_count = 1 THEN s.slug
            -- Duplicate with sport - append sport
            WHEN r.dup_count > 1 AND r.sport IS NOT NULL THEN
                s.slug + '-' + LOWER(REPLACE(r.sport, ' ', '-'))
            -- Duplicate with abbreviation but no sport - append abbreviation
            WHEN r.dup_count > 1 AND r.abbreviation IS NOT NULL THEN
                s.slug + '-' + LOWER(r.abbreviation)
            -- Duplicate with neither - append set_id
            ELSE s.slug + '-' + CAST(s.set_id AS NVARCHAR(10))
        END
    FROM [set] s
    INNER JOIN RankedSets r ON s.set_id = r.set_id
    WHERE r.dup_count > 1;

    DECLARE @setDupesFixed INT = @@ROWCOUNT;
    PRINT '  Disambiguated ' + CAST(@setDupesFixed AS NVARCHAR(10)) + ' duplicate set slugs';

    -- Final safety check: if STILL duplicates after all that, force unique with set_id
    WITH RemainingDuplicates AS (
        SELECT slug
        FROM [set]
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-id' + CAST(s.set_id AS NVARCHAR(10))
    FROM [set] s
    INNER JOIN RemainingDuplicates d ON s.slug = d.slug;

    IF @@ROWCOUNT > 0
        PRINT '  WARNING: Forced uniqueness on ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' sets by appending ID'

    DECLARE @setCount INT = (SELECT COUNT(*) FROM [set] WHERE slug IS NOT NULL)
    PRINT '  Generated ' + CAST(@setCount AS NVARCHAR(10)) + ' set slugs'

    PRINT ''

    -- =============================================
    -- STEP 6: Generate SERIES slugs
    -- =============================================

    PRINT 'Step 6: Generating series slugs...'

    -- Generate base slugs
    UPDATE series
    SET slug = LTRIM(RTRIM(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            LOWER(name),
                                                            '&', 'and'
                                                        ),
                                                        '''', ''
                                                    ),
                                                    ' ', '-'
                                                ),
                                                '/', '-'
                                            ),
                                            '.', ''
                                        ),
                                        '(', ''
                                    ),
                                    ')', ''
                                ),
                                ',', ''
                            ),
                            '!', ''
                        ),
                        '?', ''
                    ),
                    '--', '-'
                ),
                '--', '-'
            ),
            '--', '-'
        )
    ));

    -- Clean leading hyphens
    UPDATE series SET slug = SUBSTRING(slug, 2, LEN(slug)) WHERE LEFT(slug, 1) = '-';

    -- Clean trailing hyphens
    UPDATE series SET slug = SUBSTRING(slug, 1, LEN(slug) - 1) WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicates: Make series slugs globally unique by appending set slug
    WITH RankedSeries AS (
        SELECT
            s.series_id,
            s.slug,
            s.[set],
            st.slug as set_slug,
            ROW_NUMBER() OVER (PARTITION BY s.slug ORDER BY s.series_id) as rn,
            COUNT(*) OVER (PARTITION BY s.slug) as dup_count
        FROM series s
        LEFT JOIN [set] st ON s.[set] = st.set_id
    )
    UPDATE s
    SET s.slug =
        CASE
            -- Not a duplicate - leave as is
            WHEN r.dup_count = 1 THEN s.slug
            -- Duplicate - append set slug to make globally unique
            WHEN r.dup_count > 1 AND r.set_slug IS NOT NULL THEN
                s.slug + '-' + r.set_slug
            -- Fallback - append series_id
            ELSE s.slug + '-' + CAST(s.series_id AS NVARCHAR(10))
        END
    FROM series s
    INNER JOIN RankedSeries r ON s.series_id = r.series_id
    WHERE r.dup_count > 1;

    DECLARE @seriesDupesFixed INT = @@ROWCOUNT;
    PRINT '  Disambiguated ' + CAST(@seriesDupesFixed AS NVARCHAR(10)) + ' duplicate series slugs';

    -- Final safety check: if STILL duplicates, force unique with series_id
    WITH RemainingDuplicates AS (
        SELECT slug
        FROM series
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-id' + CAST(s.series_id AS NVARCHAR(10))
    FROM series s
    INNER JOIN RemainingDuplicates d ON s.slug = d.slug;

    IF @@ROWCOUNT > 0
        PRINT '  WARNING: Forced uniqueness on ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' series by appending ID';

    DECLARE @seriesCount INT = (SELECT COUNT(*) FROM series WHERE slug IS NOT NULL)
    PRINT '  Generated ' + CAST(@seriesCount AS NVARCHAR(10)) + ' series slugs'

    PRINT ''

    -- =============================================
    -- STEP 7: Generate PLAYER slugs
    -- =============================================

    PRINT 'Step 7: Generating player slugs...'

    -- Generate base slugs
    UPDATE player
    SET slug = LTRIM(RTRIM(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            LOWER(CONCAT(first_name, ' ', last_name)),
                                                            '&', 'and'
                                                        ),
                                                        '''', ''
                                                    ),
                                                    ' ', '-'
                                                ),
                                                '/', '-'
                                            ),
                                            '.', ''
                                        ),
                                        '(', ''
                                    ),
                                    ')', ''
                                ),
                                ',', ''
                            ),
                            '!', ''
                        ),
                        '?', ''
                    ),
                    '--', '-'
                ),
                '--', '-'
            ),
            '--', '-'
        )
    ));

    -- Clean leading hyphens
    UPDATE player SET slug = SUBSTRING(slug, 2, LEN(slug)) WHERE LEFT(slug, 1) = '-';

    -- Clean trailing hyphens
    UPDATE player SET slug = SUBSTRING(slug, 1, LEN(slug) - 1) WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicates: Append birth year to ALL duplicates
    WITH DuplicatePlayers AS (
        SELECT slug
        FROM player
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE p
    SET p.slug = p.slug + '-' + CAST(YEAR(p.birthdate) AS NVARCHAR(10))
    FROM player p
    INNER JOIN DuplicatePlayers d ON p.slug = d.slug
    WHERE p.birthdate IS NOT NULL;

    -- Fallback: append player_id if no birthdate
    WITH StillDuplicates AS (
        SELECT slug
        FROM player
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE p
    SET p.slug = p.slug + '-' + CAST(p.player_id AS NVARCHAR(10))
    FROM player p
    INNER JOIN StillDuplicates d ON p.slug = d.slug;

    DECLARE @playerCount INT = (SELECT COUNT(*) FROM player WHERE slug IS NOT NULL)
    PRINT '  Generated ' + CAST(@playerCount AS NVARCHAR(10)) + ' player slugs'

    PRINT ''

    -- =============================================
    -- STEP 8: Generate TEAM slugs
    -- =============================================

    PRINT 'Step 8: Generating team slugs...'

    -- Generate base slugs
    UPDATE team
    SET slug = LTRIM(RTRIM(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        REPLACE(
                                                            LOWER(name),
                                                            '&', 'and'
                                                        ),
                                                        '''', ''
                                                    ),
                                                    ' ', '-'
                                                ),
                                                '/', '-'
                                            ),
                                            '.', ''
                                        ),
                                        '(', ''
                                    ),
                                    ')', ''
                                ),
                                ',', ''
                            ),
                            '!', ''
                        ),
                        '?', ''
                    ),
                    '--', '-'
                ),
                '--', '-'
            ),
            '--', '-'
        )
    ));

    -- Clean leading hyphens
    UPDATE team SET slug = SUBSTRING(slug, 2, LEN(slug)) WHERE LEFT(slug, 1) = '-';

    -- Clean trailing hyphens
    UPDATE team SET slug = SUBSTRING(slug, 1, LEN(slug) - 1) WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicates: append team_id to ALL duplicates
    WITH DuplicateTeams AS (
        SELECT slug
        FROM team
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE t
    SET t.slug = t.slug + '-' + CAST(t.team_id AS NVARCHAR(10))
    FROM team t
    INNER JOIN DuplicateTeams d ON t.slug = d.slug;

    DECLARE @teamCount INT = (SELECT COUNT(*) FROM team WHERE slug IS NOT NULL)
    PRINT '  Generated ' + CAST(@teamCount AS NVARCHAR(10)) + ' team slugs'

    PRINT ''

    -- =============================================
    -- STEP 9: Make columns NOT NULL
    -- =============================================

    PRINT 'Step 9: Setting columns to NOT NULL...'

    -- Verify no NULLs exist
    DECLARE @nullSets INT = (SELECT COUNT(*) FROM [set] WHERE slug IS NULL)
    DECLARE @nullSeries INT = (SELECT COUNT(*) FROM series WHERE slug IS NULL)
    DECLARE @nullPlayers INT = (SELECT COUNT(*) FROM player WHERE slug IS NULL)
    DECLARE @nullTeams INT = (SELECT COUNT(*) FROM team WHERE slug IS NULL)

    IF @nullSets > 0 OR @nullSeries > 0 OR @nullPlayers > 0 OR @nullTeams > 0
    BEGIN
        PRINT '  ERROR: NULL slugs detected!'
        PRINT '    Sets: ' + CAST(@nullSets AS NVARCHAR(10))
        PRINT '    Series: ' + CAST(@nullSeries AS NVARCHAR(10))
        PRINT '    Players: ' + CAST(@nullPlayers AS NVARCHAR(10))
        PRINT '    Teams: ' + CAST(@nullTeams AS NVARCHAR(10))
        RAISERROR('Cannot proceed - NULL slugs exist', 16, 1);
    END

    -- Check if columns are already NOT NULL before altering
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug' AND is_nullable = 1)
        ALTER TABLE [set] ALTER COLUMN slug NVARCHAR(255) NOT NULL;

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug' AND is_nullable = 1)
        ALTER TABLE series ALTER COLUMN slug NVARCHAR(255) NOT NULL;

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug' AND is_nullable = 1)
        ALTER TABLE player ALTER COLUMN slug NVARCHAR(255) NOT NULL;

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug' AND is_nullable = 1)
        ALTER TABLE team ALTER COLUMN slug NVARCHAR(255) NOT NULL;

    PRINT '  All slug columns set to NOT NULL'

    PRINT ''

    -- =============================================
    -- STEP 10: Create unique indexes
    -- =============================================

    PRINT 'Step 10: Creating unique indexes...'

    CREATE UNIQUE INDEX idx_set_slug ON [set](slug);
    PRINT '  Created: idx_set_slug'

    CREATE UNIQUE INDEX idx_series_slug ON series(slug);
    PRINT '  Created: idx_series_slug (globally unique)'

    CREATE UNIQUE INDEX idx_player_slug ON player(slug);
    PRINT '  Created: idx_player_slug'

    CREATE UNIQUE INDEX idx_team_slug ON team(slug);
    PRINT '  Created: idx_team_slug'

    PRINT ''

    -- =============================================
    -- STEP 11: Verification
    -- =============================================

    PRINT '===== VERIFICATION ====='
    PRINT ''

    -- Count NULL slugs (should be 0)
    SELECT 'NULL Slugs Check' as test, 'Sets' as entity, COUNT(*) as count FROM [set] WHERE slug IS NULL
    SELECT 'NULL Slugs Check' as test, 'Series' as entity, COUNT(*) as count FROM series WHERE slug IS NULL
    SELECT 'NULL Slugs Check' as test, 'Players' as entity, COUNT(*) as count FROM player WHERE slug IS NULL
    SELECT 'NULL Slugs Check' as test, 'Teams' as entity, COUNT(*) as count FROM team WHERE slug IS NULL

    -- Count duplicate slugs (should be 0)
    SELECT 'Duplicate Slugs Check' as test, 'Sets' as entity, COUNT(*) as count
    FROM (SELECT slug FROM [set] GROUP BY slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate Slugs Check' as test, 'Series (globally unique)' as entity, COUNT(*) as count
    FROM (SELECT slug FROM series GROUP BY slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate Slugs Check' as test, 'Players' as entity, COUNT(*) as count
    FROM (SELECT slug FROM player GROUP BY slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate Slugs Check' as test, 'Teams' as entity, COUNT(*) as count
    FROM (SELECT slug FROM team GROUP BY slug HAVING COUNT(*) > 1) as dupes

    -- Show sample slugs with ampersands (verify conversion to 'and')
    PRINT ''
    PRINT 'Sample slugs with ampersands (should show "and" instead of &):'
    SELECT TOP 5 name, slug FROM [set] WHERE name LIKE '%&%' ORDER BY name

    -- Show any remaining duplicate sets (should be empty)
    PRINT ''
    PRINT 'Remaining duplicate set slugs (should be empty):'
    SELECT slug, COUNT(*) as count, STRING_AGG(name, ' | ') as names
    FROM [set]
    GROUP BY slug
    HAVING COUNT(*) > 1

    -- Commit transaction if everything succeeded
    COMMIT TRANSACTION;

    PRINT ''
    PRINT '===== SUCCESS ====='
    PRINT 'Slug migration completed successfully!'
    PRINT 'All slugs generated, duplicates handled, indexes created.'

END TRY
BEGIN CATCH
    -- Rollback on any error
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT ''
    PRINT '===== ERROR ====='
    PRINT 'Migration failed and was rolled back.'
    PRINT 'Error: ' + ERROR_MESSAGE()
    PRINT 'Line: ' + CAST(ERROR_LINE() AS NVARCHAR(10))

    -- Re-throw error
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH

GO
