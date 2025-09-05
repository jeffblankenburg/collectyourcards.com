-- Universal comments system database tables
-- Run this script against your SQL Server database

-- Universal comments table - supports cards, series, and sets
CREATE TABLE universal_comments (
  comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  comment_type VARCHAR(10) NOT NULL CHECK (comment_type IN ('card', 'series', 'set')),
  item_id BIGINT NOT NULL, -- References card_id, series_id, or set_id
  comment_text NVARCHAR(MAX) NOT NULL,
  parent_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME NULL,
  is_edited BIT NOT NULL DEFAULT 0,
  is_deleted BIT NOT NULL DEFAULT 0,
  INDEX IX_comments_type_item (comment_type, item_id),
  INDEX IX_comments_user (user_id),
  INDEX IX_comments_created (created_at DESC)
);

-- User subscriptions to items for notifications
CREATE TABLE user_item_subscriptions (
  subscription_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('card', 'series', 'set')),
  item_id BIGINT NOT NULL,
  subscribed_at DATETIME NOT NULL DEFAULT GETDATE(),
  is_active BIT NOT NULL DEFAULT 1,
  UNIQUE (user_id, item_type, item_id),
  INDEX IX_subscriptions_user (user_id),
  INDEX IX_subscriptions_item (item_type, item_id)
);

-- Notifications table
CREATE TABLE user_notifications (
  notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  notification_type VARCHAR(50) NOT NULL,
  title NVARCHAR(255) NOT NULL,
  message NVARCHAR(MAX) NOT NULL,
  related_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
  related_user_id BIGINT NULL REFERENCES [user](user_id),
  item_type VARCHAR(10) NULL CHECK (item_type IN ('card', 'series', 'set')),
  item_id BIGINT NULL,
  is_read BIT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  INDEX IX_notifications_user_unread (user_id, is_read, created_at DESC)
);