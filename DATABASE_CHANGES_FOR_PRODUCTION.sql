-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains SQL scripts that need to be run on production.
-- Scripts should be IDEMPOTENT - safe to run multiple times without errors.
--
-- After running scripts in production, move them to the archive section
-- at the bottom or clear the file.
-- ============================================================================

-- Add buyer_zip_code field to sale table
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'buyer_zip_code'
)
BEGIN
  ALTER TABLE sale ADD buyer_zip_code VARCHAR(20) NULL;
END
GO

-- Add bulk_card_count field to sale table (for bulk sales to track card count)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'bulk_card_count'
)
BEGIN
  ALTER TABLE sale ADD bulk_card_count INT NULL;
END
GO

