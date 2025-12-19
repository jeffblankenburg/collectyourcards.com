-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains SQL scripts that need to be run on production.
-- Scripts should be IDEMPOTENT - safe to run multiple times without errors.
--
-- After running scripts in production, move them to the archive section
-- at the bottom or clear the file.
-- ============================================================================


-- ===========================================================
-- User Feedback System Tables
-- Date: 2025-12-09
-- Description: Tables for user feedback, bug reports, feature requests
-- ===========================================================

-- Create feedback_submission table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'feedback_submission')
BEGIN
  CREATE TABLE feedback_submission (
    feedback_id BIGINT IDENTITY(1,1) NOT NULL,
    reference_number VARCHAR(20) NOT NULL,
    submission_type VARCHAR(20) NOT NULL,
    subject NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    email VARCHAR(255) NOT NULL,
    user_id BIGINT NULL,
    page_url VARCHAR(500) NOT NULL,
    user_agent VARCHAR(500) NULL,
    screen_resolution VARCHAR(50) NULL,
    console_logs NVARCHAR(MAX) NULL,
    screenshot_url VARCHAR(500) NULL,
    priority VARCHAR(20) NULL,
    steps_to_reproduce NVARCHAR(MAX) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    admin_notes NVARCHAR(MAX) NULL,
    github_issue_number INT NULL,
    github_issue_url VARCHAR(500) NULL,
    resolved_at DATETIME NULL,
    resolved_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_feedback_submission PRIMARY KEY (feedback_id),
    CONSTRAINT UQ_feedback_reference UNIQUE (reference_number),
    CONSTRAINT FK_feedback_submission_user FOREIGN KEY (user_id) REFERENCES [user](user_id) ON DELETE NO ACTION,
    CONSTRAINT FK_feedback_submission_resolver FOREIGN KEY (resolved_by) REFERENCES [user](user_id) ON DELETE NO ACTION
  );

  -- Create indexes for feedback_submission
  CREATE INDEX IX_feedback_submission_status ON feedback_submission(status);
  CREATE INDEX IX_feedback_submission_type ON feedback_submission(submission_type);
  CREATE INDEX IX_feedback_submission_user ON feedback_submission(user_id);
  CREATE INDEX IX_feedback_submission_created ON feedback_submission(created_at DESC);
  CREATE INDEX IX_feedback_submission_email ON feedback_submission(email);

  PRINT 'Created feedback_submission table with indexes';
END
ELSE
BEGIN
  PRINT 'feedback_submission table already exists';
END
GO

-- Create feedback_response table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'feedback_response')
BEGIN
  CREATE TABLE feedback_response (
    response_id BIGINT IDENTITY(1,1) NOT NULL,
    feedback_id BIGINT NOT NULL,
    responder_id BIGINT NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    is_internal BIT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_feedback_response PRIMARY KEY (response_id),
    CONSTRAINT FK_feedback_response_feedback FOREIGN KEY (feedback_id) REFERENCES feedback_submission(feedback_id) ON DELETE CASCADE,
    CONSTRAINT FK_feedback_response_responder FOREIGN KEY (responder_id) REFERENCES [user](user_id) ON DELETE NO ACTION
  );

  -- Create indexes for feedback_response
  CREATE INDEX IX_feedback_response_feedback ON feedback_response(feedback_id);
  CREATE INDEX IX_feedback_response_responder ON feedback_response(responder_id);

  PRINT 'Created feedback_response table with indexes';
END
ELSE
BEGIN
  PRINT 'feedback_response table already exists';
END
GO

-- ===========================================================
-- Fix Bulk-Added Card Random Codes
-- Date: 2025-12-15
-- Description: Generate new random codes for user_card records with
--              codes longer than 4 characters (caused by bug in
--              BulkCardModal generating 8-char uppercase-only codes)
-- ===========================================================

-- First, show how many records will be affected
DECLARE @affected_count INT;
SELECT @affected_count = COUNT(*) FROM user_card WHERE LEN(random_code) > 4;
PRINT 'Records with random_code > 4 characters: ' + CAST(@affected_count AS VARCHAR(10));

-- Generate new 4-character random codes using mixed case + digits
-- Character set: 0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ
-- (excludes ambiguous characters like l, I, O, 0 in some positions)
UPDATE user_card
SET random_code = (
    SELECT
        SUBSTRING('0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ', ABS(CHECKSUM(NEWID())) % 60 + 1, 1) +
        SUBSTRING('0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ', ABS(CHECKSUM(NEWID())) % 60 + 1, 1) +
        SUBSTRING('0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ', ABS(CHECKSUM(NEWID())) % 60 + 1, 1) +
        SUBSTRING('0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ', ABS(CHECKSUM(NEWID())) % 60 + 1, 1)
)
WHERE LEN(random_code) > 4;

PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' user_card records with new random codes';
GO

-- ===========================================================
-- Regenerate Missing Series Slugs
-- Date: 2025-12-17
-- Description: Generate slugs for any series with NULL or empty slugs
--              Uses same algorithm as client-side generateSlug()
-- ===========================================================

-- First, show how many series are missing slugs
DECLARE @missing_slugs INT;
SELECT @missing_slugs = COUNT(*) FROM series WHERE slug IS NULL OR slug = '';
PRINT 'Series with missing slugs: ' + CAST(@missing_slugs AS VARCHAR(10));

-- Generate slugs for series with NULL or empty slugs
-- Algorithm: lowercase, & -> and, remove apostrophes, special chars -> hyphens, clean up double hyphens
UPDATE series
SET slug = LTRIM(RTRIM(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(
                                        REPLACE(
                                            REPLACE(
                                                REPLACE(
                                                    REPLACE(
                                                        LOWER(name),
                                                        '&', 'and'
                                                    ),
                                                    '''', ''
                                                ),
                                                ' ', '-'
                                            ),
                                            '/', '-'
                                        ),
                                        '.', ''
                                    ),
                                    '(', ''
                                ),
                                ')', ''
                            ),
                            ',', ''
                        ),
                        '!', ''
                    ),
                    '?', ''
                ),
                ':', ''
            ),
            '--', '-'
        ),
        '--', '-'
    )
))
WHERE slug IS NULL OR slug = '';

-- Clean leading hyphens
UPDATE series SET slug = SUBSTRING(slug, 2, LEN(slug))
WHERE LEFT(slug, 1) = '-';

-- Clean trailing hyphens
UPDATE series SET slug = SUBSTRING(slug, 1, LEN(slug) - 1)
WHERE RIGHT(slug, 1) = '-';

PRINT 'Generated slugs for ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' series';
GO

-- ===========================================================
-- User Wrapped (Year in Review) Table
-- Date: 2025-12-19
-- Description: Cache table for user's annual collection statistics
-- ===========================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'user_wrapped')
BEGIN
  CREATE TABLE user_wrapped (
    wrapped_id BIGINT IDENTITY(1,1) NOT NULL,
    user_id BIGINT NOT NULL,
    year INT NOT NULL,
    stats_json NVARCHAR(MAX) NULL,
    generated_at DATETIME NOT NULL DEFAULT GETDATE(),
    share_token VARCHAR(32) NULL,
    share_image_url NVARCHAR(500) NULL,
    CONSTRAINT PK_user_wrapped PRIMARY KEY (wrapped_id),
    CONSTRAINT FK_user_wrapped_user FOREIGN KEY (user_id) REFERENCES [user](user_id) ON DELETE CASCADE,
    CONSTRAINT UQ_user_wrapped_user_year UNIQUE (user_id, year)
  );

  CREATE INDEX IX_user_wrapped_user_id ON user_wrapped(user_id);
  CREATE INDEX IX_user_wrapped_year ON user_wrapped(year);
  CREATE INDEX IX_user_wrapped_share_token ON user_wrapped(share_token);

  PRINT 'Created user_wrapped table';
END
ELSE
BEGIN
  PRINT 'user_wrapped table already exists';
END
GO
