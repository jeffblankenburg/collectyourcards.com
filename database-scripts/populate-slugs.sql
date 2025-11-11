-- ============================================================================
-- POPULATE SLUG COLUMNS
-- ============================================================================
-- Purpose: Populate slug columns added by SCHEMA_SYNC_PRODUCTION.sql
-- Safety: This script is idempotent - it only updates rows with empty slugs
-- Run this AFTER running SCHEMA_SYNC_PRODUCTION.sql
--
-- Generated: 2025-01-10
-- Related: GitHub #16 - SQL Schema Creep
-- ============================================================================

PRINT '==================================================================='
PRINT 'SLUG POPULATION SCRIPT'
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT '==================================================================='
PRINT ''

-- ============================================================================
-- SECTION 1: POPULATE PLAYER SLUGS
-- ============================================================================
PRINT 'SECTION 1: Populating player slugs...'
PRINT ''

-- Check if player.slug column exists
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
BEGIN
    DECLARE @player_count INT
    SELECT @player_count = COUNT(*) FROM player WHERE slug = '' OR slug IS NULL

    IF @player_count > 0
    BEGIN
        PRINT '  [+] Updating ' + CAST(@player_count AS VARCHAR) + ' player slugs...'

        UPDATE player
        SET slug = LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            TRIM(CONCAT(ISNULL(first_name, ''), '-', ISNULL(last_name, ''))),
                            ' ', '-'
                        ),
                        '''', ''
                    ),
                    '.', ''
                ),
                '--', '-'
            )
        )
        WHERE slug = '' OR slug IS NULL;

        PRINT '      SUCCESS: ' + CAST(@player_count AS VARCHAR) + ' player slugs updated'
    END
    ELSE
    BEGIN
        PRINT '  [✓] All player slugs are already populated'
    END

    -- Handle any duplicates by appending player_id
    DECLARE @duplicate_count INT
    SELECT @duplicate_count = COUNT(*)
    FROM (
        SELECT slug, COUNT(*) as cnt
        FROM player
        WHERE slug != ''
        GROUP BY slug
        HAVING COUNT(*) > 1
    ) dups

    IF @duplicate_count > 0
    BEGIN
        PRINT '  [!] WARNING: ' + CAST(@duplicate_count AS VARCHAR) + ' duplicate slug(s) found'
        PRINT '      Appending player_id to resolve duplicates...'

        ;WITH DuplicateSlugs AS (
            SELECT player_id, slug,
                ROW_NUMBER() OVER (PARTITION BY slug ORDER BY player_id) as rn
            FROM player
            WHERE slug IN (
                SELECT slug FROM player WHERE slug != '' GROUP BY slug HAVING COUNT(*) > 1
            )
        )
        UPDATE player
        SET slug = player.slug + '-' + CAST(player.player_id AS VARCHAR)
        FROM player
        INNER JOIN DuplicateSlugs ON player.player_id = DuplicateSlugs.player_id
        WHERE DuplicateSlugs.rn > 1;

        PRINT '      SUCCESS: Duplicates resolved'
    END
END
ELSE
BEGIN
    PRINT '  [!] SKIPPED: player.slug column does not exist'
END

PRINT ''

-- ============================================================================
-- SECTION 2: POPULATE SERIES SLUGS
-- ============================================================================
PRINT 'SECTION 2: Populating series slugs...'
PRINT ''

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
BEGIN
    DECLARE @series_count INT
    SELECT @series_count = COUNT(*) FROM series WHERE slug = '' OR slug IS NULL

    IF @series_count > 0
    BEGIN
        PRINT '  [+] Updating ' + CAST(@series_count AS VARCHAR) + ' series slugs...'

        UPDATE series
        SET slug = LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(ISNULL(name, 'series-' + CAST(series_id AS VARCHAR))),
                                ' ', '-'
                            ),
                            '''', ''
                        ),
                        '.', ''
                    ),
                    '/', '-'
                ),
                '--', '-'
            )
        )
        WHERE slug = '' OR slug IS NULL;

        PRINT '      SUCCESS: ' + CAST(@series_count AS VARCHAR) + ' series slugs updated'
    END
    ELSE
    BEGIN
        PRINT '  [✓] All series slugs are already populated'
    END

    -- Handle duplicates within the same set
    DECLARE @series_duplicate_count INT
    SELECT @series_duplicate_count = COUNT(*)
    FROM (
        SELECT slug, [set], COUNT(*) as cnt
        FROM series
        WHERE slug != ''
        GROUP BY slug, [set]
        HAVING COUNT(*) > 1
    ) dups

    IF @series_duplicate_count > 0
    BEGIN
        PRINT '  [!] WARNING: ' + CAST(@series_duplicate_count AS VARCHAR) + ' duplicate series slug(s) found'
        PRINT '      Appending series_id to resolve duplicates...'

        ;WITH DuplicateSlugs AS (
            SELECT series_id, slug, [set],
                ROW_NUMBER() OVER (PARTITION BY slug, [set] ORDER BY series_id) as rn
            FROM series s1
            WHERE slug != ''
            AND EXISTS (
                SELECT 1
                FROM series s2
                WHERE s2.slug = s1.slug
                AND s2.[set] = s1.[set]
                GROUP BY s2.slug, s2.[set]
                HAVING COUNT(*) > 1
            )
        )
        UPDATE series
        SET slug = series.slug + '-' + CAST(series.series_id AS VARCHAR)
        FROM series
        INNER JOIN DuplicateSlugs ON series.series_id = DuplicateSlugs.series_id
        WHERE DuplicateSlugs.rn > 1;

        PRINT '      SUCCESS: Duplicates resolved'
    END
END
ELSE
BEGIN
    PRINT '  [!] SKIPPED: series.slug column does not exist'
END

PRINT ''

-- ============================================================================
-- SECTION 3: POPULATE SET SLUGS
-- ============================================================================
PRINT 'SECTION 3: Populating set slugs...'
PRINT ''

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
BEGIN
    DECLARE @set_count INT
    SELECT @set_count = COUNT(*) FROM [set] WHERE slug = '' OR slug IS NULL

    IF @set_count > 0
    BEGIN
        PRINT '  [+] Updating ' + CAST(@set_count AS VARCHAR) + ' set slugs...'

        UPDATE [set]
        SET slug = LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(ISNULL(name, 'set-' + CAST(set_id AS VARCHAR))),
                                ' ', '-'
                            ),
                            '''', ''
                        ),
                        '.', ''
                    ),
                    '/', '-'
                ),
                '--', '-'
            )
        )
        WHERE slug = '' OR slug IS NULL;

        PRINT '      SUCCESS: ' + CAST(@set_count AS VARCHAR) + ' set slugs updated'
    END
    ELSE
    BEGIN
        PRINT '  [✓] All set slugs are already populated'
    END

    -- Handle duplicates by appending year or set_id
    DECLARE @set_duplicate_count INT
    SELECT @set_duplicate_count = COUNT(*)
    FROM (
        SELECT slug, COUNT(*) as cnt
        FROM [set]
        WHERE slug != ''
        GROUP BY slug
        HAVING COUNT(*) > 1
    ) dups

    IF @set_duplicate_count > 0
    BEGIN
        PRINT '  [!] WARNING: ' + CAST(@set_duplicate_count AS VARCHAR) + ' duplicate set slug(s) found'
        PRINT '      Appending year/set_id to resolve duplicates...'

        ;WITH DuplicateSlugs AS (
            SELECT set_id, slug, year,
                ROW_NUMBER() OVER (PARTITION BY slug ORDER BY year DESC, set_id) as rn
            FROM [set]
            WHERE slug IN (
                SELECT slug FROM [set] WHERE slug != '' GROUP BY slug HAVING COUNT(*) > 1
            )
        )
        UPDATE [set]
        SET slug = CASE
            WHEN DuplicateSlugs.year IS NOT NULL
            THEN [set].slug + '-' + CAST(DuplicateSlugs.year AS VARCHAR)
            ELSE [set].slug + '-' + CAST([set].set_id AS VARCHAR)
        END
        FROM [set]
        INNER JOIN DuplicateSlugs ON [set].set_id = DuplicateSlugs.set_id
        WHERE DuplicateSlugs.rn > 1;

        PRINT '      SUCCESS: Duplicates resolved'
    END
END
ELSE
BEGIN
    PRINT '  [!] SKIPPED: set.slug column does not exist'
END

PRINT ''

-- ============================================================================
-- SECTION 4: POPULATE TEAM SLUGS
-- ============================================================================
PRINT 'SECTION 4: Populating team slugs...'
PRINT ''

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
BEGIN
    DECLARE @team_count INT
    SELECT @team_count = COUNT(*) FROM team WHERE slug = '' OR slug IS NULL

    IF @team_count > 0
    BEGIN
        PRINT '  [+] Updating ' + CAST(@team_count AS VARCHAR) + ' team slugs...'

        UPDATE team
        SET slug = LOWER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(ISNULL(name, 'team-' + CAST(team_id AS VARCHAR))),
                                ' ', '-'
                            ),
                            '''', ''
                        ),
                        '.', ''
                    ),
                    '/', '-'
                ),
                '--', '-'
            )
        )
        WHERE slug = '' OR slug IS NULL;

        PRINT '      SUCCESS: ' + CAST(@team_count AS VARCHAR) + ' team slugs updated'
    END
    ELSE
    BEGIN
        PRINT '  [✓] All team slugs are already populated'
    END

    -- Handle duplicates by appending city or team_id
    DECLARE @team_duplicate_count INT
    SELECT @team_duplicate_count = COUNT(*)
    FROM (
        SELECT slug, COUNT(*) as cnt
        FROM team
        WHERE slug != ''
        GROUP BY slug
        HAVING COUNT(*) > 1
    ) dups

    IF @team_duplicate_count > 0
    BEGIN
        PRINT '  [!] WARNING: ' + CAST(@team_duplicate_count AS VARCHAR) + ' duplicate team slug(s) found'
        PRINT '      Appending city/team_id to resolve duplicates...'

        ;WITH DuplicateSlugs AS (
            SELECT team_id, slug, city,
                ROW_NUMBER() OVER (PARTITION BY slug ORDER BY team_id) as rn
            FROM team
            WHERE slug IN (
                SELECT slug FROM team WHERE slug != '' GROUP BY slug HAVING COUNT(*) > 1
            )
        )
        UPDATE team
        SET slug = CASE
            WHEN DuplicateSlugs.city IS NOT NULL AND DuplicateSlugs.city != ''
            THEN team.slug + '-' + LOWER(REPLACE(DuplicateSlugs.city, ' ', '-'))
            ELSE team.slug + '-' + CAST(team.team_id AS VARCHAR)
        END
        FROM team
        INNER JOIN DuplicateSlugs ON team.team_id = DuplicateSlugs.team_id
        WHERE DuplicateSlugs.rn > 1;

        PRINT '      SUCCESS: Duplicates resolved'
    END
END
ELSE
BEGIN
    PRINT '  [!] SKIPPED: team.slug column does not exist'
END

PRINT ''

-- ============================================================================
-- SECTION 5: VERIFICATION
-- ============================================================================
PRINT 'SECTION 5: Verifying slug population...'
PRINT ''

DECLARE @empty_slugs TABLE (
    table_name NVARCHAR(128),
    empty_count INT
)

-- Check for empty player slugs
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
BEGIN
    INSERT INTO @empty_slugs
    SELECT 'player', COUNT(*) FROM player WHERE slug = '' OR slug IS NULL
    HAVING COUNT(*) > 0
END

-- Check for empty series slugs
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
BEGIN
    INSERT INTO @empty_slugs
    SELECT 'series', COUNT(*) FROM series WHERE slug = '' OR slug IS NULL
    HAVING COUNT(*) > 0
END

-- Check for empty set slugs
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
BEGIN
    INSERT INTO @empty_slugs
    SELECT 'set', COUNT(*) FROM [set] WHERE slug = '' OR slug IS NULL
    HAVING COUNT(*) > 0
END

-- Check for empty team slugs
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
BEGIN
    INSERT INTO @empty_slugs
    SELECT 'team', COUNT(*) FROM team WHERE slug = '' OR slug IS NULL
    HAVING COUNT(*) > 0
END

-- Report results
IF EXISTS (SELECT 1 FROM @empty_slugs)
BEGIN
    PRINT '  [!] WARNING: The following tables still have empty slugs:'
    SELECT '      - ' + table_name + ': ' + CAST(empty_count AS VARCHAR) + ' empty slugs' AS [Empty Slugs]
    FROM @empty_slugs
END
ELSE
BEGIN
    PRINT '  [✓] All slugs are populated successfully'
END

PRINT ''
PRINT '==================================================================='
PRINT 'SLUG POPULATION COMPLETE'
PRINT 'Finished: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT '==================================================================='
PRINT ''
PRINT 'IMPORTANT NOTES:'
PRINT '1. All URL-friendly slugs have been generated'
PRINT '2. Duplicates were resolved by appending unique identifiers'
PRINT '3. Special characters (apostrophes, periods, slashes) were removed'
PRINT '4. Spaces were converted to hyphens'
PRINT ''
PRINT 'Next steps:'
PRINT '- Verify slugs are appropriate for your URLs'
PRINT '- Test application URL routing with new slugs'
PRINT '- Update any hardcoded references to slug values'
PRINT ''
