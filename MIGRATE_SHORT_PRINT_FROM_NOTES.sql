-- ============================================================================
-- MIGRATION SCRIPT: Set is_short_print from notes field
-- ============================================================================
-- This script identifies cards with "SP" in their notes field, sets
-- is_short_print = 1, and removes the SP notation from the notes.
--
-- Patterns matched (case-insensitive):
--  - "SP" (standalone)
--  - "SP:" followed by text
--  - "SP-" followed by text
--  - "(SP)" in parentheses
--  - "S.P." with periods
--  - " SP " with spaces
--  - "Short Print" full text
--
-- Date: 2025-01-11
-- Status: READY FOR EXECUTION
-- ============================================================================

-- First, let's see how many cards will be affected
PRINT 'Preview of cards that will be updated:'
PRINT '========================================'

SELECT
    card_id,
    card_number,
    notes,
    is_short_print AS current_is_short_print
FROM card
WHERE notes IS NOT NULL
  AND (
    notes LIKE '%SP%'
    OR notes LIKE '%sp%'
    OR notes LIKE '%S.P.%'
    OR notes LIKE '%s.p.%'
    OR LOWER(notes) LIKE '%short print%'
  )
ORDER BY card_id

PRINT ''
PRINT 'Total cards to update:'
SELECT COUNT(*) AS affected_cards
FROM card
WHERE notes IS NOT NULL
  AND is_short_print = 0  -- Only count cards not already marked
  AND (
    notes LIKE '%SP%'
    OR notes LIKE '%sp%'
    OR notes LIKE '%S.P.%'
    OR notes LIKE '%s.p.%'
    OR LOWER(notes) LIKE '%short print%'
  )

PRINT ''
PRINT 'Press any key to continue with the update, or Ctrl+C to cancel...'
PRINT ''

-- Uncomment the following lines when ready to execute the migration
-- ============================================================================
-- BEGIN TRANSACTION

-- Update cards: Set is_short_print = 1 and clean notes
UPDATE card
SET
    is_short_print = 1,
    notes = LTRIM(RTRIM(
        -- Remove various SP patterns
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
            'Short Print', ''),  -- Full text
            'short print', ''),  -- lowercase
            'SHORT PRINT', ''),  -- uppercase
            '(SP)', ''),         -- parentheses
            '(sp)', ''),         -- lowercase paren
            'SP:', ''),          -- colon separator
            'sp:', ''),          -- lowercase colon
            'SP-', ''),          -- dash separator
            'sp-', ''),          -- lowercase dash
            'S.P.', ''),         -- periods
            's.p.', ''),         -- lowercase periods
            ' SP ', ' '),        -- standalone with spaces
            ' sp ', ' '),        -- lowercase with spaces
            'SP', ''),           -- plain SP
            'sp', ''),           -- lowercase sp
            '  ', ' ')           -- clean up double spaces
    ))
WHERE notes IS NOT NULL
  AND (
    notes LIKE '%SP%'
    OR notes LIKE '%sp%'
    OR notes LIKE '%S.P.%'
    OR notes LIKE '%s.p.%'
    OR LOWER(notes) LIKE '%short print%'
  )

-- Show results
PRINT ''
PRINT 'Migration Results:'
PRINT '=================='
PRINT 'Cards updated:'
SELECT @@ROWCOUNT AS cards_updated

-- Show sample of updated records
PRINT ''
PRINT 'Sample of updated records (first 20):'
SELECT TOP 20
    card_id,
    card_number,
    notes AS cleaned_notes,
    is_short_print
FROM card
WHERE is_short_print = 1
  AND (
    notes IS NULL
    OR notes = ''
    OR LEN(LTRIM(RTRIM(notes))) = 0
  )
ORDER BY card_id DESC

-- Set empty notes to NULL for consistency
UPDATE card
SET notes = NULL
WHERE notes IS NOT NULL
  AND (
    notes = ''
    OR LEN(LTRIM(RTRIM(notes))) = 0
  )

PRINT ''
PRINT 'Cleaned up empty notes fields'
SELECT @@ROWCOUNT AS empty_notes_cleaned

-- Verification query
PRINT ''
PRINT 'Verification - Total short print cards:'
SELECT
    COUNT(*) AS total_short_print_cards,
    COUNT(CASE WHEN notes IS NOT NULL AND notes LIKE '%SP%' THEN 1 END) AS still_has_sp_in_notes
FROM card
WHERE is_short_print = 1

-- COMMIT TRANSACTION
-- ============================================================================

-- If everything looks good, uncomment the BEGIN TRANSACTION and COMMIT lines above
-- to make the changes permanent.
--
-- To rollback if needed (must be done before COMMIT):
-- ROLLBACK TRANSACTION
