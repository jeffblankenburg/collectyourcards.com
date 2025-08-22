-- ================================================================
-- DAILY TEAM CARD COUNT UPDATE SCRIPT
-- ================================================================
-- This script recalculates the card_count field in the team table
-- by counting actual cards associated with each team.
-- 
-- SCHEDULE: Run daily (recommended: 2 AM when usage is low)
-- ESTIMATED TIME: 2-5 minutes depending on data size
-- PURPOSE: Keep team.card_count synchronized with actual card data
-- ================================================================

-- Step 1: Log the update start
PRINT 'Starting daily team card count update at ' + CONVERT(varchar, GETDATE(), 120);

-- Step 2: Create a temporary table with calculated counts
SELECT 
    t.team_id,
    t.name as team_name,
    t.card_count as old_count,
    ISNULL(COUNT(DISTINCT c.card_id), 0) as new_count,
    (ISNULL(COUNT(DISTINCT c.card_id), 0) - t.card_count) as difference
INTO #TeamCountUpdate
FROM team t
LEFT JOIN player_team pt ON t.team_id = pt.team
LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
LEFT JOIN card c ON cpt.card = c.card_id
GROUP BY t.team_id, t.name, t.card_count;

-- Step 3: Show summary of changes before applying
PRINT 'Summary of card count changes:';
SELECT 
    COUNT(*) as total_teams,
    SUM(CASE WHEN difference != 0 THEN 1 ELSE 0 END) as teams_changed,
    SUM(CASE WHEN difference > 0 THEN 1 ELSE 0 END) as teams_increased,
    SUM(CASE WHEN difference < 0 THEN 1 ELSE 0 END) as teams_decreased,
    MAX(ABS(difference)) as max_change,
    SUM(difference) as total_difference
FROM #TeamCountUpdate;

-- Step 4: Show teams with significant changes (optional - for monitoring)
PRINT 'Teams with changes > 100 cards:';
SELECT 
    team_name,
    old_count,
    new_count,
    difference
FROM #TeamCountUpdate
WHERE ABS(difference) > 100
ORDER BY ABS(difference) DESC;

-- Step 5: Update the team table with new counts
UPDATE team 
SET card_count = u.new_count
FROM team t
INNER JOIN #TeamCountUpdate u ON t.team_id = u.team_id
WHERE t.card_count != u.new_count;

-- Step 6: Report results
DECLARE @UpdatedTeams int = @@ROWCOUNT;
PRINT 'Updated card counts for ' + CAST(@UpdatedTeams as varchar(10)) + ' teams';

-- Step 7: Cleanup
DROP TABLE #TeamCountUpdate;

-- Step 8: Log completion
PRINT 'Daily team card count update completed at ' + CONVERT(varchar, GETDATE(), 120);

-- ================================================================
-- VERIFICATION QUERY (run after update to verify)
-- ================================================================
-- Uncomment the following to verify a few teams manually:

/*
SELECT TOP 5
    t.team_id,
    t.name,
    t.card_count as stored_count,
    COUNT(DISTINCT c.card_id) as actual_count,
    (COUNT(DISTINCT c.card_id) - t.card_count) as difference
FROM team t
LEFT JOIN player_team pt ON t.team_id = pt.team
LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
LEFT JOIN card c ON cpt.card = c.card_id
WHERE t.card_count > 1000  -- Focus on teams with significant card counts
GROUP BY t.team_id, t.name, t.card_count
ORDER BY t.card_count DESC;
*/

-- ================================================================
-- SCHEDULED JOB SETUP (for production)
-- ================================================================
-- To create a SQL Server Agent job for daily execution:
--
-- 1. Open SQL Server Management Studio
-- 2. Connect to your SQL Server instance
-- 3. Expand "SQL Server Agent" in Object Explorer
-- 4. Right-click "Jobs" and select "New Job..."
-- 5. Name: "Daily Team Card Count Update"
-- 6. Add a step with this script
-- 7. Set schedule to run daily at 2:00 AM
-- 8. Configure notifications as needed
-- ================================================================