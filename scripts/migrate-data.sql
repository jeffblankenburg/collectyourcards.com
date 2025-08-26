-- Migrate existing data
UPDATE s 
SET s.color = c.color_id
FROM series s
INNER JOIN color c ON LOWER(LTRIM(RTRIM(s.primary_color_name))) = LOWER(LTRIM(RTRIM(c.name)))
WHERE s.primary_color_name IS NOT NULL 
  AND s.primary_color_name != '';

-- For any remaining series with primary_color_hex but no name match,
-- try to match by hex value
UPDATE s 
SET s.color = c.color_id
FROM series s
INNER JOIN color c ON LOWER(LTRIM(RTRIM(s.primary_color_hex))) = LOWER(LTRIM(RTRIM(c.hex_value)))
WHERE s.color IS NULL 
  AND s.primary_color_hex IS NOT NULL 
  AND s.primary_color_hex != '';

-- Report on migration status
SELECT 
    COUNT(*) as total_series,
    SUM(CASE WHEN color IS NOT NULL THEN 1 ELSE 0 END) as migrated_series,
    SUM(CASE WHEN primary_color_name IS NOT NULL AND primary_color_name != '' AND color IS NULL THEN 1 ELSE 0 END) as unmigrated_with_color_name,
    SUM(CASE WHEN primary_color_hex IS NOT NULL AND primary_color_hex != '' AND color IS NULL THEN 1 ELSE 0 END) as unmigrated_with_color_hex
FROM series;