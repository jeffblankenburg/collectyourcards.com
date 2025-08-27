const { app } = require('@azure/functions');
const sql = require('mssql');

app.timer('dailySeriesUpdate', {
    // Run daily at 2:00 AM UTC (cron: "0 0 2 * * *")
    schedule: '0 0 2 * * *',
    handler: async (myTimer, context) => {
        const startTime = Date.now();
        
        try {
            context.log('🔄 Starting daily series metadata update...');
            
            // Parse DATABASE_URL connection string
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
                throw new Error('DATABASE_URL environment variable not set');
            }
            
            // Extract connection details from DATABASE_URL
            // Format: sqlserver://server:port;database=db;user=user;password=pass;...
            const urlMatch = dbUrl.match(/sqlserver:\/\/([^:]+):(\d+);database=([^;]+);user=([^;]+);password=([^;]+)/);
            if (!urlMatch) {
                throw new Error('Invalid DATABASE_URL format');
            }
            
            const [, server, port, database, user, password] = urlMatch;
            
            const config = {
                server: server,
                database: database,
                user: user,
                password: password,
                options: {
                    encrypt: true,
                    trustServerCertificate: true // Match web app setting
                }
            };
            
            // Connect to database
            const pool = await sql.connect(config);
            
            // Execute the update query
            const result = await pool.request().query(`
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
            `);
            
            // Get summary statistics
            const stats = await pool.request().query(`
                SELECT 
                    COUNT(*) as TotalSeriesUpdated,
                    COUNT(CASE WHEN print_run_display IS NOT NULL THEN 1 END) as SeriesWithPrintRuns,
                    COUNT(CASE WHEN rookie_count > 0 THEN 1 END) as SeriesWithRookies,
                    SUM(rookie_count) as TotalRookieCards,
                    AVG(CAST(print_run_variations AS FLOAT)) as AvgPrintRunVariations
                FROM series 
                WHERE card_count > 0
            `);
            
            await pool.close();
            
            const duration = Date.now() - startTime;
            const summary = stats.recordset[0];
            
            context.log('✅ Series metadata update completed!');
            context.log(`📊 Updated ${summary.TotalSeriesUpdated} series in ${duration}ms`);
            context.log(`📊 Series with print runs: ${summary.SeriesWithPrintRuns}`);
            context.log(`📊 Series with rookies: ${summary.SeriesWithRookies}`);
            context.log(`📊 Total rookie cards: ${summary.TotalRookieCards}`);
            
            return {
                success: true,
                duration,
                stats: summary,
                rowsAffected: result.rowsAffected[0]
            };
            
        } catch (error) {
            context.log.error('❌ Error updating series metadata:', error);
            
            // Re-throw so Azure Functions marks this as failed
            throw new Error(`Series update failed: ${error.message}`);
        }
    }
});