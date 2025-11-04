-- =============================================
-- Add Slug Columns to Tables
-- Purpose: Store permanent, URL-safe slugs for all entities
-- Date: 2025-01-04
-- =============================================

-- Add slug columns to tables
ALTER TABLE [set] ADD slug NVARCHAR(255) NULL;
ALTER TABLE series ADD slug NVARCHAR(255) NULL;
ALTER TABLE player ADD slug NVARCHAR(255) NULL;
ALTER TABLE team ADD slug NVARCHAR(255) NULL;

GO

-- =============================================
-- Populate Slug Columns with Generated Slugs
-- Using algorithm: lowercase, & -> and, remove ', replace special chars with -, trim -
-- =============================================

-- Populate set slugs
UPDATE [set]
SET slug =
  REPLACE(
    REPLACE(
      LOWER(
        REPLACE(
          REPLACE(
            REPLACE(name, '&', 'and'),  -- Convert & to and
            '''', ''                     -- Remove apostrophes
          ),
          ' ', '-'                       -- Replace spaces with hyphens
        )
      ),
      '--', '-'                          -- Replace double hyphens
    ),
    '/', '-'                             -- Replace slashes with hyphens
  );

-- Clean up set slugs - remove special chars and trim hyphens
UPDATE [set]
SET slug =
  LTRIM(RTRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(slug, '.', ''),
              '(', ''),
            ')', ''),
          ',', ''),
        '!', ''),
      '?', '')
  , '-'));

-- Remove leading/trailing hyphens from set slugs
UPDATE [set]
SET slug =
  CASE
    WHEN LEFT(slug, 1) = '-' THEN SUBSTRING(slug, 2, LEN(slug))
    ELSE slug
  END;

UPDATE [set]
SET slug =
  CASE
    WHEN RIGHT(slug, 1) = '-' THEN SUBSTRING(slug, 1, LEN(slug) - 1)
    ELSE slug
  END;

GO

-- Populate series slugs (same algorithm)
UPDATE series
SET slug =
  REPLACE(
    REPLACE(
      LOWER(
        REPLACE(
          REPLACE(
            REPLACE(name, '&', 'and'),
            '''', ''
          ),
          ' ', '-'
        )
      ),
      '--', '-'
    ),
    '/', '-'
  );

-- Clean up series slugs
UPDATE series
SET slug =
  LTRIM(RTRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(slug, '.', ''),
              '(', ''),
            ')', ''),
          ',', ''),
        '!', ''),
      '?', '')
  , '-'));

-- Remove leading/trailing hyphens from series slugs
UPDATE series
SET slug =
  CASE
    WHEN LEFT(slug, 1) = '-' THEN SUBSTRING(slug, 2, LEN(slug))
    ELSE slug
  END;

UPDATE series
SET slug =
  CASE
    WHEN RIGHT(slug, 1) = '-' THEN SUBSTRING(slug, 1, LEN(slug) - 1)
    ELSE slug
  END;

GO

-- Populate player slugs (first name + last name)
UPDATE player
SET slug =
  REPLACE(
    REPLACE(
      LOWER(
        REPLACE(
          CONCAT(
            REPLACE(first_name, '''', ''),
            '-',
            REPLACE(last_name, '''', '')
          ),
          ' ', '-'
        )
      ),
      '--', '-'
    ),
    '/', '-'
  );

-- Clean up player slugs
UPDATE player
SET slug =
  LTRIM(RTRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(slug, '.', ''),
              '(', ''),
            ')', ''),
          ',', ''),
        '!', ''),
      '?', '')
  , '-'));

-- Remove leading/trailing hyphens from player slugs
UPDATE player
SET slug =
  CASE
    WHEN LEFT(slug, 1) = '-' THEN SUBSTRING(slug, 2, LEN(slug))
    ELSE slug
  END;

UPDATE player
SET slug =
  CASE
    WHEN RIGHT(slug, 1) = '-' THEN SUBSTRING(slug, 1, LEN(slug) - 1)
    ELSE slug
  END;

GO

-- Populate team slugs
UPDATE team
SET slug =
  REPLACE(
    REPLACE(
      LOWER(
        REPLACE(
          REPLACE(
            REPLACE(name, '&', 'and'),
            '''', ''
          ),
          ' ', '-'
        )
      ),
      '--', '-'
    ),
    '/', '-'
  );

-- Clean up team slugs
UPDATE team
SET slug =
  LTRIM(RTRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(slug, '.', ''),
              '(', ''),
            ')', ''),
          ',', ''),
        '!', ''),
      '?', '')
  , '-'));

-- Remove leading/trailing hyphens from team slugs
UPDATE team
SET slug =
  CASE
    WHEN LEFT(slug, 1) = '-' THEN SUBSTRING(slug, 2, LEN(slug))
    ELSE slug
  END;

UPDATE team
SET slug =
  CASE
    WHEN RIGHT(slug, 1) = '-' THEN SUBSTRING(slug, 1, LEN(slug) - 1)
    ELSE slug
  END;

GO

-- =============================================
-- Make slug columns NOT NULL after population
-- =============================================

GO

-- =============================================
-- Verification Queries
-- =============================================

-- Check for any NULL slugs (should be 0)
SELECT 'Sets with NULL slugs' as check_type, COUNT(*) as count FROM [set] WHERE slug IS NULL;
SELECT 'Series with NULL slugs' as check_type, COUNT(*) as count FROM series WHERE slug IS NULL;
SELECT 'Players with NULL slugs' as check_type, COUNT(*) as count FROM player WHERE slug IS NULL;
SELECT 'Teams with NULL slugs' as check_type, COUNT(*) as count FROM team WHERE slug IS NULL;

-- Check for duplicate slugs (should be 0 for sets, players, teams)
SELECT 'Duplicate set slugs' as check_type, COUNT(*) as count
FROM (SELECT slug FROM [set] GROUP BY slug HAVING COUNT(*) > 1) as dupes;

SELECT 'Duplicate player slugs' as check_type, COUNT(*) as count
FROM (SELECT slug FROM player GROUP BY slug HAVING COUNT(*) > 1) as dupes;

SELECT 'Duplicate team slugs' as check_type, COUNT(*) as count
FROM (SELECT slug FROM team GROUP BY slug HAVING COUNT(*) > 1) as dupes;

-- Show sample slugs for verification
SELECT TOP 10 name, slug FROM [set] WHERE name LIKE '%&%' ORDER BY name;
SELECT TOP 10 name, slug FROM series WHERE name LIKE '%&%' ORDER BY name;
SELECT TOP 10 CONCAT(first_name, ' ', last_name) as name, slug FROM player ORDER BY player_id;
SELECT TOP 10 name, slug FROM team ORDER BY name;

GO
