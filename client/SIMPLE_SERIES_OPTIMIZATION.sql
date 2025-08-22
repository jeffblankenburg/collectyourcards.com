-- ================================================================
-- SIMPLE SERIES OPTIMIZATION - 3 COLUMNS ONLY
-- ================================================================
-- This adds exactly 3 columns to the series table for performance:
-- 1. print_run_variations (int) - how many different print runs exist
-- 2. print_run (int) - the print run value if uniform, NULL if varied  
-- 3. color (int) - foreign key to color table if uniform, NULL if varied
-- ================================================================

-- REQUIRES YOUR APPROVAL BEFORE RUNNING!

-- Step 1: Add the 3 columns
ALTER TABLE series ADD 
    print_run_variations int NULL,
    print_run int NULL,
    color int NULL;

-- Step 2: Add foreign key constraint for color
ALTER TABLE series 
ADD CONSTRAINT FK_series_color 
FOREIGN KEY (color) REFERENCES color(color_id);

-- Step 3: Populate the data
UPDATE s SET
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

-- Verification query
SELECT 
    'Update completed' as status,
    COUNT(*) as total_series,
    COUNT(CASE WHEN print_run IS NOT NULL THEN 1 END) as uniform_print_runs,
    COUNT(CASE WHEN color IS NOT NULL THEN 1 END) as uniform_colors
FROM series 
WHERE card_count > 0;