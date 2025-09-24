-- Create user_notifications table if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'user_notifications')
BEGIN
  CREATE TABLE user_notifications (
    notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES [user](user_id),
    notification_type VARCHAR(50) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    related_comment_id BIGINT NULL,
    related_user_id BIGINT NULL REFERENCES [user](user_id),
    item_type VARCHAR(10) NULL CHECK (item_type IN ('card', 'series', 'set')),
    item_id BIGINT NULL,
    is_read BIT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    INDEX IX_notifications_user_unread (user_id, is_read, created_at DESC)
  );
  PRINT '✓ Created user_notifications table';
END
ELSE
BEGIN
  PRINT '✓ user_notifications table already exists';
END

-- Insert some sample notifications for user_id 1 for testing
IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE user_id = 1)
BEGIN
  INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
  VALUES 
    (1, 'system', 'Welcome to Collect Your Cards!', 'Thank you for joining our community of card collectors.', 0, DATEADD(hour, -2, GETDATE())),
    (1, 'collection', 'Collection milestone reached', 'Congratulations! You now have over 100 cards in your collection.', 0, DATEADD(hour, -6, GETDATE())),
    (1, 'achievement', 'Achievement unlocked!', 'You earned the "First Card" achievement for adding your first card to your collection.', 1, DATEADD(day, -1, GETDATE()));
  
  PRINT '✓ Added sample notifications for testing';
END
ELSE
BEGIN
  PRINT '✓ Sample notifications already exist';
END