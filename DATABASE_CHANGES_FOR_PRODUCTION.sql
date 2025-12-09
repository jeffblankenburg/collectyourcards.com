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
