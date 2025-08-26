# Team Player Count Implementation

## Overview
This implementation adds a pre-aggregated `player_count` column to the `team` table to improve performance by avoiding expensive subqueries on every API call.

## Database Changes Required

### 1. Add Column to Team Table
Run the SQL script manually in production:

```bash
# Execute the SQL file in your database
# File: ADD_PLAYER_COUNT_COLUMN.sql
```

This will:
- Add `player_count INT DEFAULT 0` column to the `team` table
- Populate it with current player counts
- Add an index for performance
- Show verification results

## Daily Maintenance

### 2. Set Up Daily Player Count Updates
The `player_count` column needs to be updated regularly as new players and teams are added.

**Option A: Cron Job (Linux/Mac)**
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/collectyourcards.com && node scripts/update-team-player-counts.js >> logs/player-count-update.log 2>&1
```

**Option B: Windows Scheduled Task**
- Task: Run `node scripts/update-team-player-counts.js`
- Schedule: Daily at 2:00 AM
- Working Directory: `/path/to/collectyourcards.com`

**Option C: Manual Execution**
```bash
cd /path/to/collectyourcards.com
node scripts/update-team-player-counts.js
```

### 3. Azure/Cloud Setup (if applicable)
For Azure App Service or similar cloud deployments, you can:
- Use Azure Functions with a timer trigger
- Use GitHub Actions with scheduled workflows
- Use the cloud provider's cron job equivalent

## Performance Impact

### Before (Subquery Approach)
- Each API call executed N subqueries (where N = number of teams returned)
- Query time: ~50-100ms per request
- Database load: High on large datasets

### After (Pre-aggregated Column)
- Single query with pre-calculated values
- Query time: ~5-10ms per request  
- Database load: Minimal
- Update frequency: Once daily (sufficient for player counts)

## Verification

After setup, verify the implementation:

1. **Check column exists:**
   ```sql
   SELECT TOP 5 name, card_count, player_count 
   FROM team 
   WHERE card_count > 0 
   ORDER BY card_count DESC
   ```

2. **Test API endpoint:**
   ```bash
   curl "http://localhost:3000/api/teams-list?limit=5"
   # Should return player_count for each team
   ```

3. **Run update script:**
   ```bash
   node scripts/update-team-player-counts.js
   # Should show statistics and completion message
   ```

## Rollback Plan

If issues occur, you can temporarily revert to subquery approach by restoring the previous version of `server/routes/teams-list.js` that includes the subqueries.

The `player_count` column can remain in the database (it won't hurt anything) and can be removed later if needed:

```sql
-- Only if you need to remove the column completely
ALTER TABLE team DROP COLUMN player_count;
```

## Monitoring

Monitor the daily update script:
- Check logs for successful completion
- Verify player counts are reasonable (e.g., Atlanta Braves should have ~224 players)
- Set up alerts if the script fails

Expected player count ranges:
- MLB teams: 150-400 players (historical roster changes)
- Most teams should have 200-350 players
- Very old/inactive teams may have fewer players