-- ================================================================
-- FIXED SERIES OPTIMIZATION - Run each step separately
-- ================================================================

-- STEP 1: Check if columns already exist (since first part succeeded)
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'series' 
AND COLUMN_NAME IN ('print_run_variations', 'print_run', 'color');

-- If columns exist, skip to Step 3. If not, run Step 2 first:

-- STEP 2: Add foreign key constraint (only if columns exist)
-- ALTER TABLE series 
-- ADD CONSTRAINT FK_series_color 
-- FOREIGN KEY (color) REFERENCES color(color_id);

-- STEP 3: Populate the data (this is what failed)
UPDATE series SET
    print_run_variations = calc.print_run_variations,
    print_run = CASE 
        WHEN calc.print_run_variations = 1 THEN calc.uniform_print_run
        ELSE NULL
    END,
    color = CASE 
        WHEN calc.color_variations = 1 THEN calc.uniform_color
        ELSE NULL
    END
FROM series s
INNER JOIN (
    SELECT 
        c.series,
        COUNT(DISTINCT c.print_run) as print_run_variations,
        COUNT(DISTINCT c.color) as color_variations,
        MIN(c.print_run) as uniform_print_run,
        MIN(c.color) as uniform_color
    FROM card c
    GROUP BY c.series
) calc ON s.series_id = calc.series;

-- STEP 4: Add foreign key constraint if not already added
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_series_color')
BEGIN
    ALTER TABLE series 
    ADD CONSTRAINT FK_series_color 
    FOREIGN KEY (color) REFERENCES color(color_id);
END

-- STEP 5: Verification
SELECT 
    'Update completed' as status,
    COUNT(*) as total_series,
    COUNT(CASE WHEN print_run IS NOT NULL THEN 1 END) as uniform_print_runs,
    COUNT(CASE WHEN color IS NOT NULL THEN 1 END) as uniform_colors
FROM series 
WHERE card_count > 0;