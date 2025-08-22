-- ================================================================
-- PRODUCTION SERIES METADATA OPTIMIZATION SCRIPT
-- ================================================================
-- This script adds pre-calculated metadata columns to the series table
-- for dramatic performance improvement on the series listing page.
-- 
-- BEFORE RUNNING: Back up your database!
-- ESTIMATED TIME: 5-10 minutes depending on data size
-- ================================================================

-- Step 1: Add new metadata columns to series table
-- These will store pre-calculated values instead of computing them each time
ALTER TABLE series ADD 
    min_print_run int NULL,
    max_print_run int NULL,
    print_run_variations int NULL,
    print_run_display nvarchar(50) NULL,
    primary_color_name nvarchar(100) NULL,
    primary_color_hex nvarchar(10) NULL,
    color_variations int NULL;

-- Step 2: Populate the metadata for all series
-- This calculates print run and color information once and stores it
UPDATE s SET
    min_print_run = calc.min_print_run,
    max_print_run = calc.max_print_run,
    print_run_variations = calc.print_run_variations,
    print_run_display = CASE 
        WHEN calc.min_print_run IS NOT NULL AND calc.max_print_run IS NOT NULL THEN
            CASE 
                WHEN calc.print_run_variations = 1 THEN '/' + CAST(calc.min_print_run AS varchar(10))
                ELSE 'up to /' + CAST(calc.max_print_run AS varchar(10))
            END
        ELSE NULL
    END,
    primary_color_name = calc.primary_color_name,
    primary_color_hex = calc.primary_color_hex,
    color_variations = calc.color_variations
FROM series s
INNER JOIN (
    SELECT 
        c.series,
        MIN(c.print_run) as min_print_run,
        MAX(c.print_run) as max_print_run,
        COUNT(DISTINCT c.print_run) as print_run_variations,
        COUNT(DISTINCT c.color) as color_variations,
        (SELECT TOP 1 color_rel.name 
         FROM card c2 
         LEFT JOIN color color_rel ON c2.color = color_rel.color_id 
         WHERE c2.series = c.series AND color_rel.name IS NOT NULL
         GROUP BY color_rel.name 
         ORDER BY COUNT(*) DESC) as primary_color_name,
        (SELECT TOP 1 color_rel.hex_value 
         FROM card c3 
         LEFT JOIN color color_rel ON c3.color = color_rel.color_id 
         WHERE c3.series = c.series AND color_rel.hex_value IS NOT NULL
         GROUP BY color_rel.hex_value 
         ORDER BY COUNT(*) DESC) as primary_color_hex
    FROM card c
    GROUP BY c.series
) calc ON s.series_id = calc.series;

-- Step 3: Verify the update
SELECT 
    'Series metadata update completed' as status,
    COUNT(*) as total_series_updated,
    COUNT(CASE WHEN print_run_display IS NOT NULL THEN 1 END) as series_with_print_runs,
    COUNT(CASE WHEN primary_color_name IS NOT NULL THEN 1 END) as series_with_colors
FROM series 
WHERE card_count > 0;

-- Step 4: Sample of updated data (for verification)
SELECT TOP 10
    name,
    card_count,
    print_run_display,
    primary_color_name,
    CASE WHEN parallel_of_series IS NOT NULL THEN 'Yes' ELSE 'No' END as is_parallel
FROM series 
WHERE card_count > 0
ORDER BY card_count DESC;

-- ================================================================
-- AFTER RUNNING THIS SCRIPT:
-- 1. Deploy the updated Node.js API code that uses these columns
-- 2. Test the /api/series-list endpoint - it should be much faster
-- 3. The series landing page should load in under 1 second
-- ================================================================