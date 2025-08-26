-- Add player_count column to team table
-- This should be run manually in production

-- Step 1: Add the column with default value
ALTER TABLE team 
ADD player_count INT DEFAULT 0;

-- Step 2: Populate the column with current player counts
UPDATE team 
SET player_count = (
    SELECT COUNT(DISTINCT pt.player) 
    FROM player_team pt 
    WHERE pt.team = team.team_id
)
WHERE team.team_id IS NOT NULL;

-- Step 3: Add index for performance (optional but recommended)
CREATE INDEX idx_team_player_count ON team(player_count DESC);

-- Verification query - show top 20 teams with their card and player counts
SELECT TOP 20
    name,
    card_count,
    player_count,
    team_id
FROM team
WHERE card_count > 0
ORDER BY card_count DESC;