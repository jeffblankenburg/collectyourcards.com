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
-- SHIPPING_CONFIG TABLE - ADD DESCRIPTION FIELD
-- Added: 2025-12-05
-- Purpose: Add optional description field for shipping configurations
-- ============================================================================

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'shipping_config')
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'shipping_config' AND COLUMN_NAME = 'description'
    )
    BEGIN
        ALTER TABLE shipping_config ADD description NVARCHAR(255) NULL;
        PRINT 'Added description column to shipping_config table';
    END
    ELSE
    BEGIN
        PRINT 'description column already exists on shipping_config table';
    END
END
ELSE
BEGIN
    PRINT 'shipping_config table does not exist - skipping';
END
GO

-- ============================================================================
-- SELLING_PLATFORM TABLE - ADD PAYMENT_FEE_PCT FIELD
-- Added: 2025-12-05
-- Purpose: Add payment processing fee percentage (e.g., PayPal fees)
-- ============================================================================

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'selling_platform')
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'selling_platform' AND COLUMN_NAME = 'payment_fee_pct'
    )
    BEGIN
        ALTER TABLE selling_platform ADD payment_fee_pct DECIMAL(5,2) NULL;
        PRINT 'Added payment_fee_pct column to selling_platform table';
    END
    ELSE
    BEGIN
        PRINT 'payment_fee_pct column already exists on selling_platform table';
    END
END
ELSE
BEGIN
    PRINT 'selling_platform table does not exist - skipping';
END
GO

-- ============================================================================
-- SUPPLY_TYPE TABLE - CREATE OR ADD MISSING COLUMNS
-- Added: 2025-12-05
-- Purpose: Supply types for sellers (penny sleeves, top loaders, etc.)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'supply_type')
BEGIN
    CREATE TABLE supply_type (
        supply_type_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_supply_type_user FOREIGN KEY (user_id)
            REFERENCES [user](user_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_supply_type_user ON supply_type(user_id);
    CREATE INDEX IX_supply_type_user_active ON supply_type(user_id, is_active);

    PRINT 'Created supply_type table with indexes';
END
ELSE
BEGIN
    -- Add user_id if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_type' AND COLUMN_NAME = 'user_id')
    BEGIN
        ALTER TABLE supply_type ADD user_id BIGINT NULL;
        PRINT 'Added user_id column to supply_type table';
    END
    ELSE
    BEGIN
        PRINT 'user_id column already exists on supply_type table';
    END

    -- Add description if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_type' AND COLUMN_NAME = 'description')
    BEGIN
        ALTER TABLE supply_type ADD description NVARCHAR(255) NULL;
        PRINT 'Added description column to supply_type table';
    END
    ELSE
    BEGIN
        PRINT 'description column already exists on supply_type table';
    END

    -- Add is_active if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_type' AND COLUMN_NAME = 'is_active')
    BEGIN
        ALTER TABLE supply_type ADD is_active BIT NOT NULL DEFAULT 1;
        PRINT 'Added is_active column to supply_type table';
    END
    ELSE
    BEGIN
        PRINT 'is_active column already exists on supply_type table';
    END

    -- Add created if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_type' AND COLUMN_NAME = 'created')
    BEGIN
        ALTER TABLE supply_type ADD created DATETIME NOT NULL DEFAULT GETDATE();
        PRINT 'Added created column to supply_type table';
    END
    ELSE
    BEGIN
        PRINT 'created column already exists on supply_type table';
    END

    PRINT 'supply_type table already exists - checked for missing columns';
END
GO

-- ============================================================================
-- SUPPLY_BATCH TABLE - CREATE OR ADD MISSING COLUMNS
-- Added: 2025-12-05
-- Purpose: Supply batch purchases with FIFO tracking
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'supply_batch')
BEGIN
    CREATE TABLE supply_batch (
        supply_batch_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        supply_type_id INT NOT NULL,
        purchase_date DATETIME NOT NULL,
        quantity_purchased INT NOT NULL,
        total_cost DECIMAL(10,2) NOT NULL,
        cost_per_unit DECIMAL(10,6) NOT NULL,
        quantity_remaining INT NOT NULL,
        is_depleted BIT NOT NULL DEFAULT 0,
        notes NVARCHAR(255) NULL,
        image_url NVARCHAR(500) NULL,
        source_url NVARCHAR(500) NULL,
        created DATETIME NOT NULL DEFAULT GETDATE(),
        updated DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_supply_batch_user FOREIGN KEY (user_id)
            REFERENCES [user](user_id) ON DELETE CASCADE,
        CONSTRAINT FK_supply_batch_supply_type FOREIGN KEY (supply_type_id)
            REFERENCES supply_type(supply_type_id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_supply_batch_user ON supply_batch(user_id);
    CREATE INDEX IX_supply_batch_supply_type ON supply_batch(supply_type_id);
    CREATE INDEX IX_supply_batch_fifo ON supply_batch(user_id, supply_type_id, is_depleted, purchase_date);

    PRINT 'Created supply_batch table with indexes';
END
ELSE
BEGIN
    -- Add is_depleted if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'is_depleted')
    BEGIN
        ALTER TABLE supply_batch ADD is_depleted BIT NOT NULL DEFAULT 0;
        PRINT 'Added is_depleted column to supply_batch table';
    END
    ELSE
    BEGIN
        PRINT 'is_depleted column already exists on supply_batch table';
    END

    -- Add updated if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'updated')
    BEGIN
        ALTER TABLE supply_batch ADD updated DATETIME NOT NULL DEFAULT GETDATE();
        PRINT 'Added updated column to supply_batch table';
    END
    ELSE
    BEGIN
        PRINT 'updated column already exists on supply_batch table';
    END

    -- Add image_url if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'image_url')
    BEGIN
        ALTER TABLE supply_batch ADD image_url NVARCHAR(500) NULL;
        PRINT 'Added image_url column to supply_batch table';
    END
    ELSE
    BEGIN
        PRINT 'image_url column already exists on supply_batch table';
    END

    -- Add source_url if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'supply_batch' AND COLUMN_NAME = 'source_url')
    BEGIN
        ALTER TABLE supply_batch ADD source_url NVARCHAR(500) NULL;
        PRINT 'Added source_url column to supply_batch table';
    END
    ELSE
    BEGIN
        PRINT 'source_url column already exists on supply_batch table';
    END

    PRINT 'supply_batch table already exists - checked for missing columns';
END
GO

-- ============================================================================
-- SHIPPING_CONFIG_ITEM TABLE - CREATE IF NOT EXISTS
-- Added: 2025-12-05
-- Purpose: Items in a shipping configuration (BOM - bill of materials)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'shipping_config_item')
BEGIN
    CREATE TABLE shipping_config_item (
        shipping_config_item_id INT IDENTITY(1,1) PRIMARY KEY,
        shipping_config_id INT NOT NULL,
        supply_type_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_shipping_config_item_config FOREIGN KEY (shipping_config_id)
            REFERENCES shipping_config(shipping_config_id) ON DELETE CASCADE,
        CONSTRAINT FK_shipping_config_item_supply_type FOREIGN KEY (supply_type_id)
            REFERENCES supply_type(supply_type_id) ON DELETE NO ACTION,
        CONSTRAINT UQ_shipping_config_item UNIQUE (shipping_config_id, supply_type_id)
    );

    CREATE INDEX IX_shipping_config_item_config ON shipping_config_item(shipping_config_id);
    CREATE INDEX IX_shipping_config_item_supply_type ON shipping_config_item(supply_type_id);

    PRINT 'Created shipping_config_item table with indexes';
END
ELSE
BEGIN
    PRINT 'shipping_config_item table already exists';
END
GO

-- ============================================================================
-- SEED GLOBAL PRODUCT TYPES
-- Added: 2025-12-05
-- Purpose: Insert default global product types (user_id = NULL)
--          These are shared across all sellers
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM product_type WHERE user_id IS NULL)
BEGIN
    INSERT INTO product_type (user_id, name, slug, description, is_active, display_order, created)
    VALUES
        (NULL, 'Hobby Box', 'hobby_box', NULL, 1, 0, GETDATE()),
        (NULL, 'Hobby Case', 'hobby_case', NULL, 1, 1, GETDATE()),
        (NULL, 'Retail Blaster', 'retail_blaster', NULL, 1, 2, GETDATE()),
        (NULL, 'Retail Hanger', 'retail_hanger', NULL, 1, 3, GETDATE()),
        (NULL, 'Retail Mega', 'retail_mega', NULL, 1, 4, GETDATE()),
        (NULL, 'Retail Cello', 'retail_cello', NULL, 1, 5, GETDATE()),
        (NULL, 'Other', 'other', NULL, 1, 99, GETDATE());

    PRINT 'Inserted 7 global product types';
END
ELSE
BEGIN
    PRINT 'Global product types already exist - skipping';
END
GO

-- ============================================================================
-- SALE_ORDER TABLE - Add shipping_config_id
-- Added: 2025-12-05
-- Purpose: Allow orders (combined shipments) to have a shipping config
--          for base supplies, with additional supplies added via order_supply_usage
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_order' AND COLUMN_NAME = 'shipping_config_id')
BEGIN
    ALTER TABLE sale_order ADD shipping_config_id INT NULL;
    
    ALTER TABLE sale_order ADD CONSTRAINT FK_sale_order_shipping_config
        FOREIGN KEY (shipping_config_id) REFERENCES shipping_config(shipping_config_id);
    
    CREATE INDEX IX_sale_order_shipping_config ON sale_order(shipping_config_id);
    
    PRINT 'Added shipping_config_id to sale_order table with FK and index';
END
ELSE
BEGIN
    PRINT 'shipping_config_id already exists on sale_order table';
END
GO

