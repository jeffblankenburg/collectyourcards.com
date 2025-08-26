-- Drop unused columns from series table after migration to color foreign key
-- This removes the old color columns and unused photo_url field

-- Drop photo_url column (unused)
ALTER TABLE series DROP COLUMN photo_url;

-- Drop old color columns (replaced by foreign key)
ALTER TABLE series DROP COLUMN primary_color_name;
ALTER TABLE series DROP COLUMN primary_color_hex;
ALTER TABLE series DROP COLUMN color_variations;