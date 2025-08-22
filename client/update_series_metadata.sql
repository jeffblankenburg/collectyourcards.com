-- Add metadata columns to series table for performance optimization
-- This script adds pre-calculated columns and populates them once

-- Step 1: Add new columns to series table
ALTER TABLE series ADD 
    min_print_run int NULL,
    max_print_run int NULL,
    print_run_variations int NULL,
    print_run_display nvarchar(50) NULL,
    primary_color_name nvarchar(100) NULL,
    primary_color_hex nvarchar(10) NULL,
    color_variations int NULL;

-- Step 2: Populate the metadata for all series
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

-- Step 3: Update series-list API to use these pre-calculated values
-- (This will be done in the next step by updating the Node.js file)

SELECT 'Series metadata update completed' as status;