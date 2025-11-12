-- Script to remove the trg_generate_random_code trigger from production
-- Date: 2024-01-24
-- Purpose: Remove the automatic random code generation trigger from user_card table
-- The random code generation will be handled by application code instead

USE CollectYourCards;
GO

-- Check if trigger exists and drop it
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_generate_random_code')
BEGIN
    DROP TRIGGER trg_generate_random_code;
    PRINT 'Trigger trg_generate_random_code has been removed successfully.';
END
ELSE
BEGIN
    PRINT 'Trigger trg_generate_random_code does not exist (already removed).';
END
GO

-- Verify the trigger has been removed
SELECT 
    name as TriggerName,
    OBJECT_NAME(parent_id) as TableName,
    create_date as CreatedDate,
    modify_date as ModifiedDate
FROM sys.triggers 
WHERE OBJECT_NAME(parent_id) = 'user_card';
GO

-- Expected result: Should only show trg_update_user_location_card_count trigger
-- The trg_generate_random_code trigger should no longer appear in the list