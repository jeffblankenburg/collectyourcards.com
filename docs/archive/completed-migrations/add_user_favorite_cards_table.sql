-- Add user_favorite_cards table for profile favorite card showcasing
-- This allows users to select up to 5 cards from their collection to display on their public profile

CREATE TABLE user_favorite_cards (
  favorite_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_card_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME NOT NULL DEFAULT GETDATE(),
  
  -- Foreign key constraints
  CONSTRAINT FK_user_favorite_cards_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
  CONSTRAINT FK_user_favorite_cards_user_card FOREIGN KEY (user_card_id) REFERENCES user_card(user_card_id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate favorites
  CONSTRAINT UK_user_favorite_cards_user_card UNIQUE (user_id, user_card_id),
  
  -- Ensure sort_order is valid (1-5)
  CONSTRAINT CK_user_favorite_cards_sort_order CHECK (sort_order >= 1 AND sort_order <= 5)
);

-- Create indexes for performance
CREATE INDEX idx_user_favorite_cards_user ON user_favorite_cards(user_id, sort_order);
CREATE INDEX idx_user_favorite_cards_user_card ON user_favorite_cards(user_card_id);