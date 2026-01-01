-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains SQL scripts that need to be run on production.
-- Scripts should be IDEMPOTENT - safe to run multiple times without errors.
--
-- After running scripts in production, move them to the archive section
-- at the bottom or clear the file.
-- ============================================================================

-- ============================================================================
-- CROWDSOURCING SYSTEM - Set, Series, and Card Submissions
-- Date: 2025-12-31
-- Description: Tables for users to submit new sets, series, and cards for review
-- ============================================================================

-- Set Submissions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'set_submissions')
BEGIN
    CREATE TABLE set_submissions (
        submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,

        -- Proposed set data
        proposed_name NVARCHAR(255) NOT NULL,
        proposed_year INT NOT NULL,
        proposed_sport NVARCHAR(50) NOT NULL,
        proposed_manufacturer NVARCHAR(100) NULL,
        proposed_description NVARCHAR(MAX) NULL,

        -- Submission metadata
        submission_notes NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',

        -- If approved, link to created set (INT to match set.set_id)
        created_set_id INT NULL,

        -- Review info
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME NULL,
        review_notes NVARCHAR(MAX) NULL,

        -- Timestamps
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NULL,

        CONSTRAINT FK_set_submissions_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_set_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES [user](user_id),
        CONSTRAINT FK_set_submissions_created_set FOREIGN KEY (created_set_id) REFERENCES [set](set_id),
        CONSTRAINT CK_set_submissions_status CHECK (status IN ('pending', 'approved', 'rejected'))
    );

    CREATE INDEX IX_set_submissions_user ON set_submissions(user_id);
    CREATE INDEX IX_set_submissions_status ON set_submissions(status);
    CREATE INDEX IX_set_submissions_created ON set_submissions(created_at DESC);

    PRINT 'Created set_submissions table';
END
GO

-- Series Submissions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'series_submissions')
BEGIN
    CREATE TABLE series_submissions (
        submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,

        -- Target set (existing or pending submission) - INT to match set.set_id
        set_id INT NULL,
        set_submission_id BIGINT NULL,

        -- Proposed series data
        proposed_name NVARCHAR(255) NOT NULL,
        proposed_description NVARCHAR(MAX) NULL,
        proposed_base_card_count INT NULL,
        proposed_is_parallel BIT NOT NULL DEFAULT 0,
        proposed_parallel_name NVARCHAR(100) NULL,
        proposed_print_run INT NULL,

        -- Submission metadata
        submission_notes NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',

        -- If approved, link to created series
        created_series_id BIGINT NULL,

        -- Review info
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME NULL,
        review_notes NVARCHAR(MAX) NULL,

        -- Timestamps
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NULL,

        CONSTRAINT FK_series_submissions_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_series_submissions_set FOREIGN KEY (set_id) REFERENCES [set](set_id),
        CONSTRAINT FK_series_submissions_set_submission FOREIGN KEY (set_submission_id) REFERENCES set_submissions(submission_id),
        CONSTRAINT FK_series_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES [user](user_id),
        CONSTRAINT FK_series_submissions_created_series FOREIGN KEY (created_series_id) REFERENCES series(series_id),
        CONSTRAINT CK_series_submissions_status CHECK (status IN ('pending', 'approved', 'rejected')),
        CONSTRAINT CK_series_submissions_set_ref CHECK (set_id IS NOT NULL OR set_submission_id IS NOT NULL)
    );

    CREATE INDEX IX_series_submissions_user ON series_submissions(user_id);
    CREATE INDEX IX_series_submissions_set ON series_submissions(set_id);
    CREATE INDEX IX_series_submissions_status ON series_submissions(status);
    CREATE INDEX IX_series_submissions_created ON series_submissions(created_at DESC);

    PRINT 'Created series_submissions table';
END
GO

-- Card Submissions table (for new cards, not edits to existing)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'card_submissions')
BEGIN
    CREATE TABLE card_submissions (
        submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,

        -- Target series (existing or pending submission)
        series_id BIGINT NULL,
        series_submission_id BIGINT NULL,

        -- Batch tracking (for bulk submissions)
        batch_id NVARCHAR(50) NULL,
        batch_sequence INT NULL,

        -- Proposed card data
        proposed_card_number NVARCHAR(50) NOT NULL,
        proposed_player_names NVARCHAR(500) NULL,
        proposed_team_names NVARCHAR(500) NULL,
        proposed_is_rookie BIT NOT NULL DEFAULT 0,
        proposed_is_autograph BIT NOT NULL DEFAULT 0,
        proposed_is_relic BIT NOT NULL DEFAULT 0,
        proposed_is_short_print BIT NOT NULL DEFAULT 0,
        proposed_print_run INT NULL,
        proposed_notes NVARCHAR(MAX) NULL,

        -- Matched entities (filled in during review)
        matched_player_ids NVARCHAR(200) NULL,
        matched_team_ids NVARCHAR(200) NULL,

        -- Submission metadata
        submission_notes NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',

        -- If approved, link to created card
        created_card_id BIGINT NULL,

        -- Review info
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME NULL,
        review_notes NVARCHAR(MAX) NULL,

        -- Timestamps
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NULL,

        CONSTRAINT FK_card_submissions_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
        CONSTRAINT FK_card_submissions_series FOREIGN KEY (series_id) REFERENCES series(series_id),
        CONSTRAINT FK_card_submissions_series_submission FOREIGN KEY (series_submission_id) REFERENCES series_submissions(submission_id),
        CONSTRAINT FK_card_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES [user](user_id),
        CONSTRAINT FK_card_submissions_created_card FOREIGN KEY (created_card_id) REFERENCES card(card_id),
        CONSTRAINT CK_card_submissions_status CHECK (status IN ('pending', 'approved', 'rejected')),
        CONSTRAINT CK_card_submissions_series_ref CHECK (series_id IS NOT NULL OR series_submission_id IS NOT NULL)
    );

    CREATE INDEX IX_card_submissions_user ON card_submissions(user_id);
    CREATE INDEX IX_card_submissions_series ON card_submissions(series_id);
    CREATE INDEX IX_card_submissions_batch ON card_submissions(batch_id);
    CREATE INDEX IX_card_submissions_status ON card_submissions(status);
    CREATE INDEX IX_card_submissions_created ON card_submissions(created_at DESC);

    PRINT 'Created card_submissions table';
END
GO

-- Add new submission type counts to contributor_stats
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contributor_stats' AND COLUMN_NAME = 'set_submissions')
BEGIN
    ALTER TABLE contributor_stats ADD set_submissions INT NOT NULL DEFAULT 0;
    ALTER TABLE contributor_stats ADD series_submissions INT NOT NULL DEFAULT 0;
    ALTER TABLE contributor_stats ADD card_submissions INT NOT NULL DEFAULT 0;

    PRINT 'Added submission type columns to contributor_stats';
END
GO

-- ============================================================================
-- CROWDSOURCING ENHANCEMENTS - January 2026
-- Date: 2026-01-01
-- Description: Add parallel series parent tracking and color field for cards
-- ============================================================================

-- Add proposed_parallel_of_series to series_submissions for linking to parent series
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'series_submissions' AND COLUMN_NAME = 'proposed_parallel_of_series')
BEGIN
    ALTER TABLE series_submissions ADD proposed_parallel_of_series BIGINT NULL;
    PRINT 'Added proposed_parallel_of_series column to series_submissions';
END
GO

-- Add proposed_color to card_submissions for card color/variant info
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'card_submissions' AND COLUMN_NAME = 'proposed_color')
BEGIN
    ALTER TABLE card_submissions ADD proposed_color NVARCHAR(100) NULL;
    PRINT 'Added proposed_color column to card_submissions';
END
GO

