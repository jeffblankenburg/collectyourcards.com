-- Admin Moderation Features Database Changes
-- Date: December 7, 2024
-- Purpose: Add user muting capability and improve comment management

-- 1. Add is_muted field to user table for moderation
ALTER TABLE [user] 
ADD is_muted BIT NOT NULL DEFAULT 0;

-- 2. Add muted_at timestamp for tracking when user was muted
ALTER TABLE [user] 
ADD muted_at DATETIME NULL;

-- 3. Add muted_by field to track which admin muted the user
ALTER TABLE [user] 
ADD muted_by BIGINT NULL;

-- 4. Add foreign key constraint for muted_by (references admin user)
ALTER TABLE [user] 
ADD CONSTRAINT FK_user_muted_by 
FOREIGN KEY (muted_by) REFERENCES [user](user_id);

-- 5. Add index for faster queries on muted users
CREATE INDEX IX_user_is_muted ON [user](is_muted);

-- 6. Add index for recent comments queries (if not exists)
-- This will help with admin dashboard performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_card_comments_created_desc')
BEGIN
    CREATE INDEX IX_card_comments_created_desc ON card_comments(created DESC);
END

-- 7. Add comment_status field to card_comments for soft delete/moderation
-- (hidden, visible, deleted, pending_review)
ALTER TABLE card_comments 
ADD comment_status NVARCHAR(20) NOT NULL DEFAULT 'visible';

-- 8. Add index for comment status
CREATE INDEX IX_card_comments_status ON card_comments(comment_status);

-- 9. Add deleted_at timestamp for audit trail
ALTER TABLE card_comments 
ADD deleted_at DATETIME NULL;

-- 10. Add deleted_by field to track which admin deleted the comment
ALTER TABLE card_comments 
ADD deleted_by BIGINT NULL;

-- 11. Add foreign key constraint for deleted_by
ALTER TABLE card_comments 
ADD CONSTRAINT FK_card_comments_deleted_by 
FOREIGN KEY (deleted_by) REFERENCES [user](user_id);