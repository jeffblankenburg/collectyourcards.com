-- ============================================================================
-- PRODUCTION DATABASE UPDATE - Add Index for Cards Needing Reference Query
-- ============================================================================
-- Run this in Azure Data Studio or Azure Portal Query Editor
-- Connect to: collectyourcards production database
-- ============================================================================
--
-- This index dramatically improves performance of the "cards needing reference"
-- admin page by allowing SQL Server to quickly find cards without reference images
-- ============================================================================

-- Check if index exists
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('card')
    AND name = 'IX_card_reference_user_card'
)
BEGIN
    PRINT 'Creating index on card.reference_user_card...';

    CREATE NONCLUSTERED INDEX IX_card_reference_user_card
    ON card (reference_user_card)
    INCLUDE (card_id, card_number, series)
    WHERE reference_user_card IS NULL;

    PRINT 'Index created successfully!';
    PRINT 'This is a filtered index that only indexes cards without reference images.';
END
ELSE
BEGIN
    PRINT 'Index IX_card_reference_user_card already exists';
END

-- Verify index was created
SELECT
    i.name as index_name,
    i.type_desc as index_type,
    CASE WHEN i.has_filter = 1 THEN i.filter_definition ELSE 'No filter' END as filter,
    c.name as column_name
FROM sys.indexes i
LEFT JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
LEFT JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('card')
AND i.name = 'IX_card_reference_user_card'
ORDER BY ic.key_ordinal;

PRINT '';
PRINT 'Index created successfully!';
PRINT 'The cards-needing-reference query should now be MUCH faster.';
