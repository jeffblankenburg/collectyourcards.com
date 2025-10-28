-- Collection View Sharing Feature
-- Allows users to create shareable, dynamically-filtered views of their collection
-- Created: 2025-01-XX

-- Create collection_view table
CREATE TABLE collection_view (
  collection_view_id bigint IDENTITY(1,1) PRIMARY KEY,
  [user] bigint NOT NULL,
  name nvarchar(255) NOT NULL,
  slug nvarchar(255) NOT NULL UNIQUE,
  description nvarchar(MAX),

  -- Filter Configuration stored as JSON
  -- Example: {"locationIds":[1,2],"teamIds":[5],"filters":{"rookies":true,"autos":false}}
  filter_config nvarchar(MAX) NOT NULL,

  -- Metadata
  is_public bit DEFAULT 1,
  view_count int DEFAULT 0,
  created_at datetime DEFAULT GETDATE(),
  updated_at datetime DEFAULT GETDATE(),

  -- Foreign key
  CONSTRAINT FK_collection_view_user FOREIGN KEY ([user]) REFERENCES [user](user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IX_collection_view_user ON collection_view([user]);
CREATE UNIQUE INDEX IX_collection_view_slug ON collection_view(slug);
CREATE INDEX IX_collection_view_public ON collection_view(is_public, created_at DESC);

-- Comments
EXEC sp_addextendedproperty
  @name = N'MS_Description',
  @value = N'Stores saved collection views with filters for sharing',
  @level0type = N'SCHEMA', @level0name = N'dbo',
  @level1type = N'TABLE',  @level1name = N'collection_view';

EXEC sp_addextendedproperty
  @name = N'MS_Description',
  @value = N'JSON configuration storing all applied filters: locations, teams, card types, etc.',
  @level0type = N'SCHEMA', @level0name = N'dbo',
  @level1type = N'TABLE',  @level1name = N'collection_view',
  @level2type = N'COLUMN', @level2name = N'filter_config';

EXEC sp_addextendedproperty
  @name = N'MS_Description',
  @value = N'URL-friendly slug for sharing. Format: {sanitized-name}-{random-5char}',
  @level0type = N'SCHEMA', @level0name = N'dbo',
  @level1type = N'TABLE',  @level1name = N'collection_view',
  @level2type = N'COLUMN', @level2name = N'slug';
