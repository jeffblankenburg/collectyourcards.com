-- Migration: Add spreadsheet generation support
-- Date: 2025-01-27
-- Description: Adds fields and tables to support automated spreadsheet generation

-- Add spreadsheet fields to set table
ALTER TABLE [set] ADD 
  checklist_blob_url NVARCHAR(MAX) NULL,
  checklist_generated_at DATETIME NULL,
  checklist_generation_status VARCHAR(50) NULL DEFAULT 'pending', -- 'pending', 'current', 'generating', 'failed'
  checklist_file_size INT NULL,
  checklist_format VARCHAR(20) NULL DEFAULT 'csv'; -- 'csv', 'xlsx', 'pdf'

-- Create queue table for managing generation jobs
CREATE TABLE spreadsheet_generation_queue (
  queue_id INT PRIMARY KEY IDENTITY(1,1),
  set_id INT NOT NULL,
  priority INT DEFAULT 5,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  queued_at DATETIME DEFAULT GETDATE(),
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  error_message NVARCHAR(MAX) NULL,
  retry_count INT DEFAULT 0,
  CONSTRAINT FK_queue_set FOREIGN KEY (set_id) REFERENCES [set](set_id)
);

-- Add index for efficient queue processing
CREATE INDEX IX_queue_status_priority ON spreadsheet_generation_queue(status, priority DESC, queued_at);

-- Create log table for tracking generation history
CREATE TABLE spreadsheet_generation_log (
  log_id INT PRIMARY KEY IDENTITY(1,1),
  set_id INT NOT NULL,
  trigger_type VARCHAR(50) NOT NULL, -- 'card_update', 'series_update', 'set_update', 'manual', 'scheduled'
  trigger_details NVARCHAR(MAX) NULL, -- JSON with specifics
  generated_at DATETIME DEFAULT GETDATE(),
  file_size INT NULL,
  generation_time_ms INT NULL,
  success BIT NOT NULL DEFAULT 1,
  error_message NVARCHAR(MAX) NULL,
  blob_url NVARCHAR(MAX) NULL,
  CONSTRAINT FK_log_set FOREIGN KEY (set_id) REFERENCES [set](set_id)
);

-- Add index for efficient log queries
CREATE INDEX IX_log_set_generated ON spreadsheet_generation_log(set_id, generated_at DESC);

-- Add stored procedure to queue a regeneration job
GO
CREATE PROCEDURE QueueSpreadsheetGeneration
  @SetId INT,
  @Priority INT = 5,
  @TriggerType VARCHAR(50) = 'manual'
AS
BEGIN
  -- Check if there's already a pending job for this set
  IF NOT EXISTS (
    SELECT 1 FROM spreadsheet_generation_queue 
    WHERE set_id = @SetId AND status IN ('pending', 'processing')
  )
  BEGIN
    INSERT INTO spreadsheet_generation_queue (set_id, priority, status)
    VALUES (@SetId, @Priority, 'pending');
  END
  ELSE
  BEGIN
    -- Update priority if new priority is higher
    UPDATE spreadsheet_generation_queue 
    SET priority = CASE WHEN @Priority > priority THEN @Priority ELSE priority END
    WHERE set_id = @SetId AND status = 'pending';
  END
END;
GO

-- Add stored procedure to get next job from queue
CREATE PROCEDURE GetNextGenerationJob
AS
BEGIN
  DECLARE @QueueId INT;
  
  -- Get the highest priority pending job
  SELECT TOP 1 @QueueId = queue_id
  FROM spreadsheet_generation_queue
  WHERE status = 'pending'
  ORDER BY priority DESC, queued_at ASC;
  
  -- Mark it as processing
  IF @QueueId IS NOT NULL
  BEGIN
    UPDATE spreadsheet_generation_queue
    SET status = 'processing', started_at = GETDATE()
    WHERE queue_id = @QueueId;
    
    -- Return the job details
    SELECT q.*, s.name as set_name, s.year as set_year
    FROM spreadsheet_generation_queue q
    INNER JOIN [set] s ON q.set_id = s.set_id
    WHERE q.queue_id = @QueueId;
  END
END;
GO