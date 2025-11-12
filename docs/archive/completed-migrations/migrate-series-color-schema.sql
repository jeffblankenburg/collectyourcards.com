-- Migration script to change series color fields to foreign key relationship
-- This script will:
-- 1. Add a new 'color' column to the series table
-- 2. Migrate existing primary_color_name data to the new color foreign key
-- 3. Drop the old color columns after migration is complete

-- Step 1: Add the new color column to series table
ALTER TABLE series ADD color INT NULL;

-- Step 2: Create index for the new foreign key
CREATE INDEX IX_series_color ON series(color);

-- Step 3: Add foreign key constraint
ALTER TABLE series ADD CONSTRAINT FK_series_color 
FOREIGN KEY (color) REFERENCES color(color_id);

-- Step 4: Migrate existing data
-- For each series with a primary_color_name, try to find matching color record
UPDATE s 
SET s.color = c.color_id
FROM series s
INNER JOIN color c ON LOWER(TRIM(s.primary_color_name)) = LOWER(TRIM(c.name))
WHERE s.primary_color_name IS NOT NULL 
  AND s.primary_color_name != '';

-- Step 5: For any remaining series with primary_color_hex but no name match,
-- try to match by hex value
UPDATE s 
SET s.color = c.color_id
FROM series s
INNER JOIN color c ON LOWER(TRIM(s.primary_color_hex)) = LOWER(TRIM(c.hex_value))
WHERE s.color IS NULL 
  AND s.primary_color_hex IS NOT NULL 
  AND s.primary_color_hex != '';

-- Step 6: Report on migration status
SELECT 
    COUNT(*) as total_series,
    SUM(CASE WHEN color IS NOT NULL THEN 1 ELSE 0 END) as migrated_series,
    SUM(CASE WHEN primary_color_name IS NOT NULL AND primary_color_name != '' AND color IS NULL THEN 1 ELSE 0 END) as unmigrated_with_color_name,
    SUM(CASE WHEN primary_color_hex IS NOT NULL AND primary_color_hex != '' AND color IS NULL THEN 1 ELSE 0 END) as unmigrated_with_color_hex
FROM series;

-- Step 7: Show any series that couldn't be migrated for manual review
SELECT series_id, name, primary_color_name, primary_color_hex
FROM series 
WHERE (primary_color_name IS NOT NULL AND primary_color_name != '' OR 
       primary_color_hex IS NOT NULL AND primary_color_hex != '') 
  AND color IS NULL;

-- After verifying the migration is successful, uncomment these lines to drop old columns:
-- ALTER TABLE series DROP COLUMN primary_color_name;
-- ALTER TABLE series DROP COLUMN primary_color_hex;
-- ALTER TABLE series DROP COLUMN color_variations;