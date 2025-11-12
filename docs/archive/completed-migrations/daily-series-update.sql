-- ================================================================
-- DAILY SERIES METADATA UPDATE
-- ================================================================
-- Updates the following series table fields:
-- - print_run_variations
-- - min_print_run  
-- - max_print_run
-- - print_run_display
-- - rookie_count
-- ================================================================

PRINT 'Starting daily series metadata update at ' + CONVERT(VARCHAR(19), GETDATE(), 120)

UPDATE s SET
    print_run_variations = calc.print_run_variations,
    min_print_run = calc.min_print_run,
    max_print_run = calc.max_print_run,
    print_run_display = CASE 
        WHEN calc.print_run_variations = 0 OR calc.min_print_run IS NULL THEN NULL
        WHEN calc.print_run_variations = 1 THEN '/' + CAST(calc.min_print_run AS VARCHAR(10))
        ELSE 'up to /' + CAST(calc.max_print_run AS VARCHAR(10))
    END,
    rookie_count = calc.rookie_count
FROM series s
INNER JOIN (
    SELECT 
        c.series,
        COUNT(DISTINCT CASE WHEN c.print_run IS NOT NULL THEN c.print_run END) as print_run_variations,
        MIN(c.print_run) as min_print_run,
        MAX(c.print_run) as max_print_run,
        SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_count
    FROM card c
    WHERE c.series IS NOT NULL
    GROUP BY c.series
) calc ON s.series_id = calc.series

PRINT 'Series metadata update completed at ' + CONVERT(VARCHAR(19), GETDATE(), 120)

-- Show summary
SELECT 
    'Daily Update Summary' as Report,
    COUNT(*) as TotalSeriesUpdated,
    COUNT(CASE WHEN print_run_display IS NOT NULL THEN 1 END) as SeriesWithPrintRuns,
    COUNT(CASE WHEN rookie_count > 0 THEN 1 END) as SeriesWithRookies,
    SUM(rookie_count) as TotalRookieCards,
    AVG(CAST(print_run_variations AS FLOAT)) as AvgPrintRunVariations
FROM series 
WHERE card_count > 0