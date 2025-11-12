-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains SQL scripts that need to be run on production
-- ============================================================================

-- ============================================================================
-- 2025-01-11: Add is_short_print column to card table
-- Description: Adds is_short_print column to track short print cards (cards
--              with lower print runs than standard cards in a set). Column
--              follows same pattern as is_rookie, is_autograph, is_relic.
--              Also migrates existing cards with "SP" in notes field.
-- ============================================================================

SET QUOTED_IDENTIFIER ON;

PRINT '';
PRINT '============================================================================';
PRINT 'SHORT PRINT MIGRATION';
PRINT '============================================================================';
PRINT '';

-- Check if column already exists
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'is_short_print'
)
BEGIN
    PRINT 'Adding is_short_print column to card table...';

    ALTER TABLE card
    ADD is_short_print BIT NOT NULL DEFAULT 0;

    PRINT 'Column added successfully!';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'Column is_short_print already exists. Skipping column creation.';
    PRINT '';
END

-- Verify the column exists
SELECT
    c.name as column_name,
    t.name as data_type,
    c.is_nullable,
    ISNULL(dc.definition, 'No default') as default_value
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('card')
AND c.name = 'is_short_print';

PRINT '';
PRINT 'Checking cards with SP in notes...';
PRINT '';

-- Check how many cards will be affected
SELECT COUNT(*) AS affected_cards
FROM card
WHERE notes IS NOT NULL
  AND is_short_print = 0
  AND (
    notes LIKE '%SP%'
    OR notes LIKE '%sp%'
    OR notes LIKE '%S.P.%'
    OR notes LIKE '%s.p.%'
    OR LOWER(notes) LIKE '%short print%'
  );

PRINT '';
PRINT 'Starting migration...';
PRINT '';

BEGIN TRANSACTION;

-- Update cards: Set is_short_print = 1 and clean notes
UPDATE card
SET
    is_short_print = 1,
    notes = LTRIM(RTRIM(
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
        REPLACE(
        REPLACE(
        REPLACE(notes,
            'Short Print', ''),
            'short print', ''),
            'SHORT PRINT', ''),
            '(SP)', ''),
            '(sp)', ''),
            'SP:', ''),
            'sp:', ''),
            'SP-', ''),
            'sp-', ''),
            'S.P.', ''),
            's.p.', ''),
            ' SP ', ' '),
            ' sp ', ' '),
            'SP', ''),
            'sp', ''),
            '  ', ' ')
    ))
WHERE notes IS NOT NULL
  AND (
    notes LIKE '%SP%'
    OR notes LIKE '%sp%'
    OR notes LIKE '%S.P.%'
    OR notes LIKE '%s.p.%'
    OR LOWER(notes) LIKE '%short print%'
  );

PRINT 'Cards updated with is_short_print = 1:';
SELECT @@ROWCOUNT AS cards_updated;

-- Clean up leading and trailing commas/spaces from notes
-- Handle leading comma with space: ", text" → "text"
UPDATE card
SET notes =
  CASE
    WHEN LEFT(notes, 2) = ', ' THEN SUBSTRING(notes, 3, LEN(notes))
    WHEN LEFT(notes, 1) = ',' THEN LTRIM(SUBSTRING(notes, 2, LEN(notes)))
    ELSE notes
  END
WHERE notes LIKE ',%';

PRINT 'Notes with leading commas cleaned:';
SELECT @@ROWCOUNT AS leading_commas_cleaned;

-- Handle trailing comma with space: "text ," → "text" or "text," → "text"
UPDATE card
SET notes =
  CASE
    WHEN RIGHT(notes, 2) = ' ,' THEN SUBSTRING(notes, 1, LEN(notes) - 2)
    WHEN RIGHT(notes, 1) = ',' THEN RTRIM(SUBSTRING(notes, 1, LEN(notes) - 1))
    ELSE notes
  END
WHERE notes LIKE '%,';

PRINT 'Notes with trailing commas cleaned:';
SELECT @@ROWCOUNT AS trailing_commas_cleaned;

-- Final cleanup: trim any extra spaces
UPDATE card
SET notes = LTRIM(RTRIM(notes))
WHERE notes LIKE ' %' OR notes LIKE '% ';

PRINT 'Extra spaces trimmed:';
SELECT @@ROWCOUNT AS spaces_trimmed;

-- Set empty notes to NULL for consistency
UPDATE card
SET notes = NULL
WHERE notes IS NOT NULL
  AND (
    notes = ''
    OR LEN(LTRIM(RTRIM(notes))) = 0
  );

PRINT 'Empty notes set to NULL:';
SELECT @@ROWCOUNT AS empty_notes_cleaned;

COMMIT TRANSACTION;

PRINT '';
PRINT 'Migration completed successfully!';
PRINT '';

-- Verification query
PRINT 'Verification - Total short print cards:';
SELECT
    COUNT(*) AS total_short_print_cards,
    COUNT(CASE WHEN notes IS NOT NULL AND notes LIKE '%SP%' THEN 1 END) AS still_has_sp_in_notes
FROM card
WHERE is_short_print = 1;

PRINT '';
PRINT 'Sample of updated records (first 10):';
SELECT TOP 10
    card_id,
    card_number,
    notes AS cleaned_notes,
    is_short_print
FROM card
WHERE is_short_print = 1
ORDER BY card_id;

PRINT '';
PRINT '============================================================================';
PRINT 'MIGRATION COMPLETE';
PRINT '============================================================================';
PRINT '';

-- ============================================================================
-- 2025-01-12: Add front_image_path and back_image_path columns to card table
-- Description: Adds columns to store web-optimized card image URLs for
--              performance (carousel, card detail pages). Used by Issue #33
--              image optimization system. Original user uploads remain
--              separate in user_card_photo table.
-- ============================================================================

PRINT '';
PRINT '============================================================================';
PRINT 'CARD IMAGE OPTIMIZATION - ADD IMAGE PATH COLUMNS';
PRINT '============================================================================';
PRINT '';

-- Check if front_image_path column already exists
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'front_image_path'
)
BEGIN
    PRINT 'Adding front_image_path column to card table...';

    ALTER TABLE card
    ADD front_image_path NVARCHAR(MAX) NULL;

    PRINT 'Column front_image_path added successfully!';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'Column front_image_path already exists. Skipping column creation.';
    PRINT '';
END

-- Check if back_image_path column already exists
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'back_image_path'
)
BEGIN
    PRINT 'Adding back_image_path column to card table...';

    ALTER TABLE card
    ADD back_image_path NVARCHAR(MAX) NULL;

    PRINT 'Column back_image_path added successfully!';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'Column back_image_path already exists. Skipping column creation.';
    PRINT '';
END

-- Verify the columns exist
PRINT 'Verifying columns...';
SELECT
    c.name as column_name,
    t.name as data_type,
    c.is_nullable,
    c.max_length
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('card')
AND c.name IN ('front_image_path', 'back_image_path')
ORDER BY c.name;

PRINT '';
PRINT '============================================================================';
PRINT 'IMAGE PATH COLUMNS MIGRATION COMPLETE';
PRINT '============================================================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Deploy code changes to production';
PRINT '2. Run migration script: node server/scripts/migrate-optimize-card-images.js';
PRINT '3. This will populate front_image_path and back_image_path for existing cards';
PRINT '';
