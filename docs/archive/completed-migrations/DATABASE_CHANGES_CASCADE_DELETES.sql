-- Cascade Delete Configuration for Foreign Key Constraints
-- Date: January 2025
-- Purpose: Configure foreign keys to cascade delete to prevent orphaned records
--          and allow proper deletion of parent records

-- ============================================================================
-- user_player Table
-- ============================================================================
-- Purpose: Tracks player page views for analytics
-- Issue: FK constraint prevented deletion of players when user_player records existed

-- Drop existing constraint
ALTER TABLE user_player DROP CONSTRAINT FK_user_player_player;

-- Recreate with CASCADE DELETE
-- When a player is deleted, automatically delete all user_player tracking records
ALTER TABLE user_player
ADD CONSTRAINT FK_user_player_player
FOREIGN KEY (player)
REFERENCES player(player_id)
ON DELETE CASCADE;

-- Verification query:
-- SELECT fk.name as constraint_name, delete_referential_action_desc
-- FROM sys.foreign_keys fk
-- JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
-- JOIN sys.tables t ON fkc.parent_object_id = t.object_id
-- WHERE t.name = 'user_player' AND fk.name = 'FK_user_player_player';
-- Expected: delete_referential_action_desc = CASCADE

-- ============================================================================
-- Additional Cascade Delete Candidates (Review Needed)
-- ============================================================================
-- Other tables that may need cascade delete configuration:
-- - player_team -> player (when player is deleted)
-- - card_player_team -> player_team (when player_team is deleted)
-- - user_card -> card (when card is deleted)
-- - user_list_card -> user_list (when list is deleted)
-- - card_comments -> card (when card is deleted)
--
-- Note: Each should be evaluated for business logic requirements before enabling cascade
