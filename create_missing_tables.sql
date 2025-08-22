-- Create missing tables for user collection functionality

-- Create grading_agencies table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'grading_agencies')
BEGIN
    CREATE TABLE grading_agencies (
        grading_agency_id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(MAX) NOT NULL,
        abbreviation NVARCHAR(10) NOT NULL
    );
    
    -- Insert common grading agencies
    INSERT INTO grading_agencies (name, abbreviation) VALUES 
    ('Professional Sports Authenticator', 'PSA'),
    ('Beckett Grading Services', 'BGS'),
    ('Sportscard Guaranty', 'SGC'),
    ('Certified Sports Guaranty', 'CSG'),
    ('Hybrid Grading Approach', 'HGA'),
    ('Global Authentication Inc.', 'GAI'),
    ('Professional Grading Experts', 'PGX'),
    ('Authentication Services & Grading', 'ASG'),
    ('Card Grading Authentication', 'CGA');
    
    PRINT 'Created grading_agencies table with sample data';
END
ELSE
    PRINT 'grading_agencies table already exists';

-- Create user_locations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_locations')
BEGIN
    CREATE TABLE user_locations (
        user_location_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        [user] BIGINT NOT NULL,
        location NVARCHAR(MAX) NOT NULL,
        card_count INT NOT NULL DEFAULT 0,
        is_dashboard BIT NOT NULL DEFAULT 1,
        FOREIGN KEY ([user]) REFERENCES [user](user_id) ON DELETE CASCADE
    );
    
    PRINT 'Created user_locations table';
END
ELSE
    PRINT 'user_locations table already exists';

-- Update UserCard table to add missing fields if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_cards') AND name = 'aftermarket_auto')
BEGIN
    ALTER TABLE user_cards ADD aftermarket_auto BIT NOT NULL DEFAULT 0;
    PRINT 'Added aftermarket_auto column to user_cards';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_cards') AND name = 'grade_id')
BEGIN
    ALTER TABLE user_cards ADD grade_id NVARCHAR(50);
    PRINT 'Added grade_id column to user_cards';
END

PRINT 'All missing tables and columns have been created/added';