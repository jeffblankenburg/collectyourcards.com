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
-- PRODUCT_TYPE TABLE (Updated)
-- Added: 2024-12-04
-- Updated: 2025-12-04 - Made user_id nullable for global/system types
-- Purpose: Product types for purchases (hobby box, case, etc.)
--          user_id NULL = global/system type, user_id = user-specific type
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_type')
BEGIN
    CREATE TABLE product_type (
        product_type_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NULL,  -- NULL = global/system type
        name NVARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL,
        description NVARCHAR(255) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        display_order INT NOT NULL DEFAULT 0,
        created DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_product_type_user FOREIGN KEY (user_id)
            REFERENCES [user](user_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_product_type_user ON product_type(user_id);
    CREATE INDEX IX_product_type_user_active ON product_type(user_id, is_active);
    CREATE INDEX IX_product_type_user_slug ON product_type(user_id, slug);

    PRINT 'Created product_type table with indexes';
END
ELSE
BEGIN
    -- Make user_id nullable if it isn't already
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'product_type' AND COLUMN_NAME = 'user_id' AND IS_NULLABLE = 'NO'
    )
    BEGIN
        ALTER TABLE product_type ALTER COLUMN user_id BIGINT NULL;
        PRINT 'Made product_type.user_id nullable';
    END
    ELSE
    BEGIN
        PRINT 'product_type table already exists with nullable user_id';
    END
END
GO

-- ============================================================================
-- SALE_STATUS TABLE
-- Added: 2025-12-04
-- Purpose: Lookup table for sale statuses (listed, sold, shipped, etc.)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sale_status')
BEGIN
    CREATE TABLE sale_status (
        sale_status_id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL,
        slug VARCHAR(50) NOT NULL,
        description NVARCHAR(255) NULL,
        color VARCHAR(20) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        display_order INT NOT NULL DEFAULT 0,
        created DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT UQ_sale_status_slug UNIQUE (slug)
    );

    CREATE INDEX IX_sale_status_active ON sale_status(is_active);

    -- Seed default statuses
    INSERT INTO sale_status (name, slug, description, color, display_order) VALUES
        ('Listed', 'listed', 'Card is listed for sale', '#3b82f6', 0),
        ('Sold', 'sold', 'Card has been sold', '#10b981', 1),
        ('Shipped', 'shipped', 'Card has been shipped', '#8b5cf6', 2),
        ('Delivered', 'delivered', 'Card has been delivered', '#06b6d4', 3),
        ('Cancelled', 'cancelled', 'Sale was cancelled', '#ef4444', 4),
        ('Returned', 'returned', 'Card was returned', '#f97316', 5);

    PRINT 'Created sale_status table with default values';
END
ELSE
BEGIN
    PRINT 'sale_status table already exists';
END
GO

-- ============================================================================
-- USER TABLE - ADD SELLER ACCESS FIELDS
-- Added: 2025-12-04
-- Purpose: Add seller_role and seller_expires for seller access control
--          seller_role: NULL = no access, 'basic', 'pro', 'enterprise'
--          seller_expires: Optional expiration date for seller access
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'user' AND COLUMN_NAME = 'seller_role'
)
BEGIN
    ALTER TABLE [user] ADD seller_role NVARCHAR(50) NULL;
    PRINT 'Added seller_role column to user table';
END
ELSE
BEGIN
    PRINT 'seller_role column already exists on user table';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'user' AND COLUMN_NAME = 'seller_expires'
)
BEGIN
    ALTER TABLE [user] ADD seller_expires DATETIME NULL;
    PRINT 'Added seller_expires column to user table';
END
ELSE
BEGIN
    PRINT 'seller_expires column already exists on user table';
END
GO

-- ============================================================================
-- SUPPLY_BATCH TABLE - ADD IMAGE_URL AND SOURCE_URL FIELDS
-- Added: 2025-12-05
-- Purpose: Add image_url for product photos and source_url for purchase links
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'image_url'
)
BEGIN
    ALTER TABLE supply_batch ADD image_url NVARCHAR(500) NULL;
    PRINT 'Added image_url column to supply_batch table';
END
ELSE
BEGIN
    PRINT 'image_url column already exists on supply_batch table';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'source_url'
)
BEGIN
    ALTER TABLE supply_batch ADD source_url NVARCHAR(500) NULL;
    PRINT 'Added source_url column to supply_batch table';
END
ELSE
BEGIN
    PRINT 'source_url column already exists on supply_batch table';
END
GO

