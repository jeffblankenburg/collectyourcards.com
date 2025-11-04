# Slug Migration Summary

## Overview
Migrated from dynamic slug generation to storing slugs in the database for permanent, stable URLs.

## Changes Made

### 1. Database Migration
**File:** `/database-migrations/add-slug-columns.sql`

- Added `slug` column to `set`, `series`, `player`, and `team` tables
- Populated slugs using algorithm: lowercase, `&` → `and`, remove `'`, replace special chars with `-`
- Created unique indexes for fast lookups
- Made columns NOT NULL after population

**Run this SQL script on both development and production databases**

### 2. Server-Side Updates

#### Updated Files:
1. **`/server/routes/sets-list.js`**
   - Added `slug` to SELECT query
   - Included `slug` in response

2. **`/server/routes/series-by-set.js`**
   - Added `slug` to SELECT query
   - Included `slug` in response

3. **`/server/routes/admin-sets.js`**
   - Updated `findSetBySlug()` to query by slug column
   - Updated `findSeriesBySlug()` to query by slug column
   - Generate and save slug on set creation
   - Regenerate slug on set update (if name changed)
   - Generate and save slug on series creation
   - Regenerate slug on series update (if name changed)

### 3. Client-Side Updates

#### Updated Files:
1. **`/client/src/pages/SeriesDetail.jsx`**
   - Changed from `generateSlug(set.name) === setSlug` to `set.slug === setSlug`
   - Changed from `generateSlug(s.name) === seriesSlug` to `s.slug === seriesSlug`

## Benefits

✅ **Permanent URLs** - URLs won't break when slug algorithm changes
✅ **Faster Lookups** - Indexed column vs. dynamic generation
✅ **Consistency** - No more client/server synchronization issues
✅ **Customizable** - Can manually override slugs if needed
✅ **SEO Friendly** - Stable URLs improve search engine ranking

## Next Steps

### For Development:
1. **First:** Run `/database-migrations/add-sport-column.sql` on development database
2. **Then:** Run `/database-migrations/add-slug-columns-SAFE.sql` on development database
3. Restart development server
4. Test URLs with ampersands (e.g., "Allen & Ginter")
5. Test duplicate set names (e.g., "Donruss" for MLB vs NFL)

### For Production:
1. **Before deploying code:**
   - Run `/database-migrations/add-sport-column.sql` on production database
   - Verify sport values are correct for all organizations
   - Run `/database-migrations/add-slug-columns-SAFE.sql` on production database
   - Verify all verification queries return expected results
   - Check for any NULL slugs or duplicate slugs

2. **Update Prisma Schema (if needed):**
   - Add `sport` field to organization model in schema.prisma
   - Run `npx prisma db pull` to sync schema with database
   - Run `npx prisma generate` to update Prisma client

3. **After database migration:**
   - Deploy updated server code
   - Deploy updated client code
   - Test key URLs to ensure they work

## Testing Checklist

- [ ] Sets with ampersands (e.g., "2022 Topps Allen & Ginter")
- [ ] Sets with apostrophes (e.g., "1970 Topps")
- [ ] Series with special characters
- [ ] Creating new sets (slug auto-generated)
- [ ] Updating existing sets (slug auto-updated)
- [ ] Creating new series (slug auto-generated)
- [ ] Updating existing series (slug auto-updated)

## Rollback Plan

If issues occur:
1. Don't remove database columns (just in case)
2. Revert server code to previous version (re-enable dynamic generation)
3. Revert client code to previous version
4. Investigate and fix issues
5. Re-deploy

## Duplicate Slug Handling

### Sets - Sport Disambiguation
When the same set name exists for multiple sports (e.g., "2025 Donruss" for MLB and NFL):
- **First occurrence:** `2025-donruss`
- **Subsequent duplicates:** `2025-donruss-mlb`, `2025-donruss-nfl`
- Uses sport name from organization.sport column for disambiguation
- **Prerequisite:** Run `add-sport-column.sql` first to add sport column to organization table

### Series - Scoped to Set
Series slugs are unique within their set (not globally):
- URL provides context: `/sets/2025/2025-donruss-mlb/base` vs `/sets/2025/2025-donruss-nfl/base`
- Database index: `(slug, set)` - already handles this correctly
- No global uniqueness needed

### Players - Birth Year Disambiguation
When multiple players share the same name (e.g., "Frank Thomas"):
- **First occurrence:** `frank-thomas`
- **Subsequent duplicates:** `frank-thomas-1968`, `frank-thomas-1990`
- Uses birth year for disambiguation

## URL Examples

### Before Migration:
```
/sets/2022/2022-topps-allen-ginter/2022-topps-allen-ginter-mini-a-g-back
```
(Broken because `&` was removed from slug)

### After Migration:
```
/sets/2022/2022-topps-allen-and-ginter/2022-topps-allen-and-ginter-mini-a-and-g-back
```
(Working because slug is stored as `2022-topps-allen-and-ginter`)

### Duplicate Handling Examples:
```
/sets/2025/2025-donruss-mlb/base           (MLB Donruss)
/sets/2025/2025-donruss-nfl/base           (NFL Donruss)
/players/frank-thomas-1968                  (White Sox Frank Thomas)
/players/frank-thomas-1990                  (Blue Jays Frank Thomas)
```

## Notes

- The `generateSlug()` function is still used for creating new slugs
- Old `generateSlug()` function remains in place for backwards compatibility
- All slug generation is now done server-side on create/update
- Client-side only uses stored slugs from API responses
