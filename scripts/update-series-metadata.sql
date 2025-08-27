-- ================================================================
-- SERIES METADATA UPDATE SCRIPT
-- ================================================================
-- Updates calculated fields in the series table:
-- - print_run_variations: count of distinct print runs
-- - min_print_run: minimum print run value
-- - max_print_run: maximum print run value  
-- - print_run_display: formatted display string
-- - rookie_count: count of rookie cards
-- ================================================================

PRINT 'Starting series metadata update...'

-- Update all calculated fields in one query for efficiency
UPDATE s SET
    print_run_variations = calc.print_run_variations,
    min_print_run = calc.min_print_run,
    max_print_run = calc.max_print_run,
    print_run_display = CASE 
        -- Single print run: show as "/99"
        WHEN calc.print_run_variations = 1 AND calc.min_print_run IS NOT NULL 
        THEN '/' + CAST(calc.min_print_run AS VARCHAR(10))
        
        -- Multiple print runs: show as "up to /999" 
        WHEN calc.print_run_variations > 1 AND calc.max_print_run IS NOT NULL
        THEN 'up to /' + CAST(calc.max_print_run AS VARCHAR(10))
        
        -- No print runs or all null
        ELSE NULL
    END,
    rookie_count = calc.rookie_count
FROM series s
INNER JOIN (
    SELECT 
        c.series,
        -- Print run calculations
        COUNT(DISTINCT c.print_run) as print_run_variations,
        MIN(c.print_run) as min_print_run,
        MAX(c.print_run) as max_print_run,
        
        -- Rookie count
        SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_count
    FROM card c
    WHERE c.series IS NOT NULL
    GROUP BY c.series
) calc ON s.series_id = calc.series;

-- Get update statistics
DECLARE @total_updated INT, @with_print_runs INT, @with_rookies INT

SELECT 
    @total_updated = COUNT(*),
    @with_print_runs = COUNT(CASE WHEN print_run_display IS NOT NULL THEN 1 END),
    @with_rookies = COUNT(CASE WHEN rookie_count > 0 THEN 1 END)
FROM series 
WHERE card_count > 0;

PRINT 'Series metadata update completed:'
PRINT '- Total series updated: ' + CAST(@total_updated AS VARCHAR(10))
PRINT '- Series with print run info: ' + CAST(@with_print_runs AS VARCHAR(10))
PRINT '- Series with rookie cards: ' + CAST(@with_rookies AS VARCHAR(10))
PRINT 'Update completed at: ' + CONVERT(VARCHAR(19), GETDATE(), 120)