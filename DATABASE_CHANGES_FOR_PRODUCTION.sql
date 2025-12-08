-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains SQL scripts that need to be run on production.
-- Scripts should be IDEMPOTENT - safe to run multiple times without errors.
--
-- After running scripts in production, move them to the archive section
-- at the bottom or clear the file.
-- ============================================================================

-- Add buyer_zip_code field to sale table
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'buyer_zip_code'
)
BEGIN
  ALTER TABLE sale ADD buyer_zip_code VARCHAR(20) NULL;
END
GO

-- Add bulk_card_count field to sale table (for bulk sales to track card count)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'bulk_card_count'
)
BEGIN
  ALTER TABLE sale ADD bulk_card_count INT NULL;
END
GO

-- Create admin_set_view table for tracking recently viewed sets in admin
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'admin_set_view'
)
BEGIN
  CREATE TABLE admin_set_view (
    admin_set_view_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    set_id INT NOT NULL,
    last_viewed DATETIME2 NOT NULL DEFAULT GETDATE(),
    view_count INT NOT NULL DEFAULT 1,
    CONSTRAINT FK_admin_set_view_user FOREIGN KEY (user_id) REFERENCES [user](user_id) ON DELETE CASCADE,
    CONSTRAINT FK_admin_set_view_set FOREIGN KEY (set_id) REFERENCES [set](set_id) ON DELETE CASCADE,
    CONSTRAINT UQ_admin_set_view_user_set UNIQUE (user_id, set_id)
  );

  CREATE INDEX IX_admin_set_view_user_id ON admin_set_view(user_id);
  CREATE INDEX IX_admin_set_view_last_viewed ON admin_set_view(last_viewed DESC);
END
GO

-- Add card_count column to player_team table for performance optimization
-- This eliminates expensive COUNT queries when loading players list
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'player_team' AND COLUMN_NAME = 'card_count'
)
BEGIN
  ALTER TABLE player_team ADD card_count INT NOT NULL DEFAULT 0;
  PRINT 'card_count column added to player_team';
END
GO

-- Populate card_count for all player_team records
-- This query counts cards per player_team from card_player_team table
UPDATE pt
SET pt.card_count = ISNULL(counts.cnt, 0)
FROM player_team pt
LEFT JOIN (
  SELECT cpt.player_team, COUNT(DISTINCT cpt.card) as cnt
  FROM card_player_team cpt
  GROUP BY cpt.player_team
) counts ON pt.player_team_id = counts.player_team;
GO

-- Create index on player_team.card_count for faster sorting
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_player_team_card_count' AND object_id = OBJECT_ID('player_team')
)
BEGIN
  CREATE INDEX IX_player_team_card_count ON player_team(card_count DESC);
END
GO

