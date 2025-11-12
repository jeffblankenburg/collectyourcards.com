-- =============================================
-- Assign Colors to Parallel Series
-- =============================================
-- This script assigns color_id to parallel series based on color keywords in their names
-- Created: 2025-01-15
-- =============================================

-- Color keyword mappings (in order of specificity)
-- Note: More specific patterns should be checked first

PRINT 'Starting parallel series color assignment...'
PRINT ''

-- Track updates
DECLARE @UpdateCount INT = 0

-- Aqua/Cyan
UPDATE series
SET color = 1 -- Aqua
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%Aqua%' OR name LIKE '%Cyan%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Aqua/Cyan: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Black
UPDATE series
SET color = 2 -- Black
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Black%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Black: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Blue (must check before Light Blue, Navy Blue, Royal Blue, Sky Blue)
UPDATE series
SET color = 3 -- Blue
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Blue%'
  AND name NOT LIKE '%Light Blue%'
  AND name NOT LIKE '%Navy Blue%'
  AND name NOT LIKE '%Royal Blue%'
  AND name NOT LIKE '%Sky Blue%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Blue: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Bronze
UPDATE series
SET color = 33 -- Bronze
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Bronze%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Bronze: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Brown
UPDATE series
SET color = 34 -- Brown
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Brown%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Brown: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Camouflage/Camo
UPDATE series
SET color = 7 -- Camouflage
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%Camouflage%' OR name LIKE '%Camo%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Camouflage: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Chartreuse
UPDATE series
SET color = 21 -- Chartreuse
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Chartreuse%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Chartreuse: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Copper
UPDATE series
SET color = 31 -- Copper
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Copper%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Copper: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Fuchsia
UPDATE series
SET color = 25 -- Fuchsia
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Fuchsia%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Fuchsia: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Gold (must check before Rose Gold)
UPDATE series
SET color = 4 -- Gold
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Gold%'
  AND name NOT LIKE '%Rose Gold%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Gold: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Green (must check before Lime Green, Jade Green)
UPDATE series
SET color = 6 -- Green
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Green%'
  AND name NOT LIKE '%Lime Green%'
  AND name NOT LIKE '%Jade Green%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Green: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Jade Green
UPDATE series
SET color = 27 -- Jade Green
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Jade Green%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Jade Green: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Light Blue
UPDATE series
SET color = 5 -- Light Blue
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Light Blue%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Light Blue: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Light Pink
UPDATE series
SET color = 8 -- Light Pink
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Light Pink%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Light Pink: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Lime Green
UPDATE series
SET color = 20 -- Lime Green
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Lime Green%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Lime Green: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Magenta
UPDATE series
SET color = 12 -- Magenta
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Magenta%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Magenta: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Navy Blue
UPDATE series
SET color = 30 -- Navy Blue
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Navy Blue%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Navy Blue: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Orange
UPDATE series
SET color = 9 -- Orange
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Orange%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Orange: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Pink (must check after Light Pink and Rose Gold)
UPDATE series
SET color = 26 -- Pink
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Pink%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Pink: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Platinum (and Ice - typically platinum colored)
UPDATE series
SET color = 10 -- Platinum
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%Platinum%' OR name LIKE '%Ice%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Platinum/Ice: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Purple
UPDATE series
SET color = 14 -- Purple
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Purple%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Purple: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Rainbow (Refractors, X-Fractors, Prisms, etc.)
UPDATE series
SET color = 18 -- Rainbow
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%Refractor%'
       OR name LIKE '%fractor%'
       OR name LIKE '%X-Fractor%'
       OR name LIKE '%Prism%'
       OR name LIKE '%Mojo%'
       OR name LIKE '%Atomic%'
       OR name LIKE '%Shimmer%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Rainbow (Refractors/Prisms): ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Red
UPDATE series
SET color = 15 -- Red
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Red%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Red: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Rose Gold
UPDATE series
SET color = 22 -- Rose Gold
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Rose Gold%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Rose Gold: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Royal Blue
UPDATE series
SET color = 16 -- Royal Blue
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Royal Blue%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Royal Blue: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Sapphire
UPDATE series
SET color = 32 -- Sapphire
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Sapphire%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Sapphire: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Sepia
UPDATE series
SET color = 28 -- Sepia
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Sepia%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Sepia: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Silver
UPDATE series
SET color = 17 -- Silver
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Silver%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Silver: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Sky Blue
UPDATE series
SET color = 24 -- Sky Blue
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Sky Blue%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Sky Blue: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Teal
UPDATE series
SET color = 29 -- Teal
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Teal%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Teal: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- White (Clear can be considered white)
UPDATE series
SET color = 19 -- White
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%White%' OR name LIKE '%Clear%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'White/Clear: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Yellow
UPDATE series
SET color = 13 -- Yellow
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Yellow%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Yellow: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Independence Day (Red, White, Blue theme - use Red as most prominent)
UPDATE series
SET color = 15 -- Red
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Independence Day%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Independence Day: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Vintage Stock (Sepia/aged look)
UPDATE series
SET color = 28 -- Sepia
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Vintage Stock%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Vintage Stock: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Negative (Inverted colors - use Black & White)
UPDATE series
SET color = 23 -- Black & White
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND name LIKE '%Negative%'
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Negative: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Glossy/Foilboard (Reflective finish - use Silver)
UPDATE series
SET color = 17 -- Silver
WHERE parallel_of_series IS NOT NULL
  AND color IS NULL
  AND (name LIKE '%Glossy%' OR name LIKE '%Foilboard%' OR name LIKE '%Foil%')
SELECT @UpdateCount = @@ROWCOUNT
PRINT 'Glossy/Foil: ' + CAST(@UpdateCount AS VARCHAR(10)) + ' series updated'

-- Summary
PRINT ''
PRINT '================================================'
PRINT 'Color assignment complete!'
PRINT ''

SELECT
    'Remaining parallels without color: ' + CAST(COUNT(*) AS VARCHAR(10)) as Status
FROM series
WHERE parallel_of_series IS NOT NULL AND color IS NULL

PRINT '================================================'
