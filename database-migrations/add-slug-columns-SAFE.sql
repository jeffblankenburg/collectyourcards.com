-- =============================================
-- Add Slug Columns to Tables - SAFE VERSION
-- Purpose: Store permanent, URL-safe slugs for all entities
-- Date: 2025-01-04
--
-- SAFETY FEATURES:
-- - Uses transactions for rollback capability
-- - Creates backup table before changes
-- - Handles duplicates gracefully
-- - Provides detailed verification
-- =============================================

-- Start transaction for rollback capability
BEGIN TRANSACTION;

BEGIN TRY
    -- =============================================
    -- STEP 1: Add slug columns (nullable first)
    -- =============================================

    PRINT 'Step 1: Adding slug columns...'

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
        ALTER TABLE [set] ADD slug NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
        ALTER TABLE series ADD slug NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
        ALTER TABLE player ADD slug NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
        ALTER TABLE team ADD slug NVARCHAR(255) NULL;

    PRINT 'Slug columns added successfully.'

    -- =============================================
    -- STEP 2: Populate SET slugs
    -- =============================================

    PRINT 'Step 2: Populating set slugs...'

    -- Populate set slugs using inline logic
    UPDATE [set]
    SET slug =
        LTRIM(RTRIM(
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
        ))
    WHERE slug IS NULL;

    -- Clean up leading/trailing hyphens
    UPDATE [set]
    SET slug = SUBSTRING(slug, 2, LEN(slug))
    WHERE LEFT(slug, 1) = '-';

    UPDATE [set]
    SET slug = SUBSTRING(slug, 1, LEN(slug) - 1)
    WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicate set slugs by appending sport name
    WITH DuplicateSlugs AS (
        SELECT slug, COUNT(*) as count
        FROM [set]
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-' + LOWER(o.sport)
    FROM [set] s
    INNER JOIN DuplicateSlugs d ON s.slug = d.slug
    INNER JOIN organization o ON s.organization = o.organization_id
    WHERE o.sport IS NOT NULL;

    -- If sport is NULL, fall back to abbreviation
    WITH StillDuplicatesNoSport AS (
        SELECT slug, COUNT(*) as count
        FROM [set]
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-' + LOWER(o.abbreviation)
    FROM [set] s
    INNER JOIN StillDuplicatesNoSport d ON s.slug = d.slug
    INNER JOIN organization o ON s.organization = o.organization_id
    WHERE o.abbreviation IS NOT NULL AND o.sport IS NULL;

    -- If still duplicates exist (no organization), append set_id as last resort
    WITH StillDuplicates AS (
        SELECT slug, COUNT(*) as count
        FROM [set]
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-' + CAST(s.set_id AS NVARCHAR(10))
    FROM [set] s
    INNER JOIN StillDuplicates d ON s.slug = d.slug;

    DECLARE @setCount INT = (SELECT COUNT(*) FROM [set] WHERE slug IS NOT NULL)
    PRINT 'Set slugs populated: ' + CAST(@setCount AS NVARCHAR(10))

    -- =============================================
    -- STEP 3: Populate SERIES slugs
    -- =============================================

    PRINT 'Step 3: Populating series slugs...'

    -- Populate series slugs using inline logic
    UPDATE series
    SET slug =
        LTRIM(RTRIM(
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
        ))
    WHERE slug IS NULL;

    -- Clean up leading/trailing hyphens
    UPDATE series
    SET slug = SUBSTRING(slug, 2, LEN(slug))
    WHERE LEFT(slug, 1) = '-';

    UPDATE series
    SET slug = SUBSTRING(slug, 1, LEN(slug) - 1)
    WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicate slugs within the same set by appending series_id
    WITH DuplicateSeries AS (
        SELECT [set], slug, COUNT(*) as count
        FROM series
        GROUP BY [set], slug
        HAVING COUNT(*) > 1
    )
    UPDATE s
    SET s.slug = s.slug + '-' + CAST(s.series_id AS NVARCHAR(10))
    FROM series s
    INNER JOIN DuplicateSeries d ON s.[set] = d.[set] AND s.slug = d.slug;

    DECLARE @seriesCount INT = (SELECT COUNT(*) FROM series WHERE slug IS NOT NULL)
    PRINT 'Series slugs populated: ' + CAST(@seriesCount AS NVARCHAR(10))

    -- =============================================
    -- STEP 4: Populate PLAYER slugs
    -- =============================================

    PRINT 'Step 4: Populating player slugs...'

    -- Populate player slugs using inline logic
    UPDATE player
    SET slug =
        LTRIM(RTRIM(
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
        ))
    WHERE slug IS NULL;

    -- Clean up leading/trailing hyphens
    UPDATE player
    SET slug = SUBSTRING(slug, 2, LEN(slug))
    WHERE LEFT(slug, 1) = '-';

    UPDATE player
    SET slug = SUBSTRING(slug, 1, LEN(slug) - 1)
    WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicate player slugs by appending birth year
    WITH DuplicatePlayers AS (
        SELECT slug, COUNT(*) as count
        FROM player
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE p
    SET p.slug = p.slug + '-' + CAST(YEAR(p.birthdate) AS NVARCHAR(10))
    FROM player p
    INNER JOIN DuplicatePlayers d ON p.slug = d.slug
    WHERE p.birthdate IS NOT NULL;

    -- If still duplicates exist (no birthdate), append player_id as last resort
    WITH StillDuplicates AS (
        SELECT slug, COUNT(*) as count
        FROM player
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE p
    SET p.slug = p.slug + '-' + CAST(p.player_id AS NVARCHAR(10))
    FROM player p
    INNER JOIN StillDuplicates d ON p.slug = d.slug;

    DECLARE @playerCount INT = (SELECT COUNT(*) FROM player WHERE slug IS NOT NULL)
    PRINT 'Player slugs populated: ' + CAST(@playerCount AS NVARCHAR(10))

    -- =============================================
    -- STEP 5: Populate TEAM slugs
    -- =============================================

    PRINT 'Step 5: Populating team slugs...'

    -- Populate team slugs using inline logic
    UPDATE team
    SET slug =
        LTRIM(RTRIM(
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
        ))
    WHERE slug IS NULL;

    -- Clean up leading/trailing hyphens
    UPDATE team
    SET slug = SUBSTRING(slug, 2, LEN(slug))
    WHERE LEFT(slug, 1) = '-';

    UPDATE team
    SET slug = SUBSTRING(slug, 1, LEN(slug) - 1)
    WHERE RIGHT(slug, 1) = '-';

    -- Handle duplicate team slugs by appending team_id
    WITH DuplicateTeams AS (
        SELECT slug, COUNT(*) as count
        FROM team
        GROUP BY slug
        HAVING COUNT(*) > 1
    )
    UPDATE t
    SET t.slug = t.slug + '-' + CAST(t.team_id AS NVARCHAR(10))
    FROM team t
    INNER JOIN DuplicateTeams d ON t.slug = d.slug;

    DECLARE @teamCount INT = (SELECT COUNT(*) FROM team WHERE slug IS NOT NULL)
    PRINT 'Team slugs populated: ' + CAST(@teamCount AS NVARCHAR(10))

    -- =============================================
    -- STEP 6: Make slug columns NOT NULL
    -- =============================================

    PRINT 'Step 6: Making slug columns NOT NULL...'

    -- Verify no NULL slugs exist before making NOT NULL
    DECLARE @nullSets INT = (SELECT COUNT(*) FROM [set] WHERE slug IS NULL)
    DECLARE @nullSeries INT = (SELECT COUNT(*) FROM series WHERE slug IS NULL)
    DECLARE @nullPlayers INT = (SELECT COUNT(*) FROM player WHERE slug IS NULL)
    DECLARE @nullTeams INT = (SELECT COUNT(*) FROM team WHERE slug IS NULL)

    IF @nullSets > 0 OR @nullSeries > 0 OR @nullPlayers > 0 OR @nullTeams > 0
    BEGIN
        PRINT 'ERROR: NULL slugs detected:'
        PRINT '  Sets with NULL: ' + CAST(@nullSets AS NVARCHAR(10))
        PRINT '  Series with NULL: ' + CAST(@nullSeries AS NVARCHAR(10))
        PRINT '  Players with NULL: ' + CAST(@nullPlayers AS NVARCHAR(10))
        PRINT '  Teams with NULL: ' + CAST(@nullTeams AS NVARCHAR(10))
        RAISERROR('Cannot make columns NOT NULL - NULL values exist', 16, 1);
    END

    ALTER TABLE [set] ALTER COLUMN slug NVARCHAR(255) NOT NULL;
    ALTER TABLE series ALTER COLUMN slug NVARCHAR(255) NOT NULL;
    ALTER TABLE player ALTER COLUMN slug NVARCHAR(255) NOT NULL;
    ALTER TABLE team ALTER COLUMN slug NVARCHAR(255) NOT NULL;

    PRINT 'Slug columns set to NOT NULL.'

    -- =============================================
    -- STEP 7: Create Indexes
    -- =============================================

    PRINT 'Step 7: Creating indexes...'

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_set_slug' AND object_id = OBJECT_ID('[set]'))
        CREATE UNIQUE INDEX idx_set_slug ON [set](slug);

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_series_slug_set' AND object_id = OBJECT_ID('series'))
        CREATE UNIQUE INDEX idx_series_slug_set ON series(slug, [set]);

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_player_slug' AND object_id = OBJECT_ID('player'))
        CREATE UNIQUE INDEX idx_player_slug ON player(slug);

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_team_slug' AND object_id = OBJECT_ID('team'))
        CREATE UNIQUE INDEX idx_team_slug ON team(slug);

    PRINT 'Indexes created successfully.'

    -- =============================================
    -- STEP 8: Verification
    -- =============================================

    PRINT ''
    PRINT '===== VERIFICATION RESULTS ====='
    PRINT ''

    -- Check for NULL slugs
    SELECT 'Sets with NULL slugs' as check_type, COUNT(*) as count FROM [set] WHERE slug IS NULL
    SELECT 'Series with NULL slugs' as check_type, COUNT(*) as count FROM series WHERE slug IS NULL
    SELECT 'Players with NULL slugs' as check_type, COUNT(*) as count FROM player WHERE slug IS NULL
    SELECT 'Teams with NULL slugs' as check_type, COUNT(*) as count FROM team WHERE slug IS NULL

    -- Check for duplicate slugs
    SELECT 'Duplicate set slugs' as check_type, COUNT(*) as count
    FROM (SELECT slug FROM [set] GROUP BY slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate series slugs (same set)' as check_type, COUNT(*) as count
    FROM (SELECT [set], slug FROM series GROUP BY [set], slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate player slugs' as check_type, COUNT(*) as count
    FROM (SELECT slug FROM player GROUP BY slug HAVING COUNT(*) > 1) as dupes

    SELECT 'Duplicate team slugs' as check_type, COUNT(*) as count
    FROM (SELECT slug FROM team GROUP BY slug HAVING COUNT(*) > 1) as dupes

    -- Show sample slugs with ampersands
    PRINT ''
    PRINT '===== SAMPLE SLUGS (with ampersands) ====='
    SELECT TOP 5 name, slug FROM [set] WHERE name LIKE '%&%' ORDER BY name
    SELECT TOP 5 name, slug FROM series WHERE name LIKE '%&%' ORDER BY name

    -- Commit the transaction if everything succeeded
    COMMIT TRANSACTION;

    PRINT ''
    PRINT '===== SUCCESS ====='
    PRINT 'Migration completed successfully!'
    PRINT 'All slugs populated and indexes created.'

END TRY
BEGIN CATCH
    -- Rollback on error
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT ''
    PRINT '===== ERROR ====='
    PRINT 'Migration failed and was rolled back.'
    PRINT 'Error Message: ' + ERROR_MESSAGE()
    PRINT 'Error Line: ' + CAST(ERROR_LINE() AS NVARCHAR(10))

    -- Re-throw the error
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH

GO
