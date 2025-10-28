# SQL Injection Vulnerability Audit

**Date:** October 28, 2025
**Severity:** 🔴 CRITICAL
**Total Vulnerabilities Found:** 20+

---

## Critical Vulnerabilities (Direct User Input in LIKE Clauses)

### 1. routes/cards.js
**Lines:** 53-54, 68
**Vulnerable Parameters:** `firstName`, `lastName`, `series_name`
```javascript
// ❌ VULNERABLE
AND LOWER(p2.first_name) LIKE LOWER('%${firstName}%')
AND LOWER(p2.last_name) LIKE LOWER('%${lastName}%')
whereConditions.push(`LOWER(s.name) LIKE LOWER('%${series_name}%')`)
```

### 2. routes/admin-achievements.js
**Line:** 62
**Vulnerable Parameter:** `search`
```javascript
// ❌ VULNERABLE
whereConditions.push(`(a.name LIKE '%${search}%' OR a.description LIKE '%${search}%')`)
```

### 3. routes/card-detail.js
**Line:** 144
**Vulnerable Parameter:** `seriesSlug`
```javascript
// ❌ VULNERABLE
AND s.name LIKE '%${seriesSlug.replace(/-/g, '%')}%'
```

### 4. routes/player-team-search.js
**Lines:** 56-60
**Vulnerable Parameter:** `searchTerm` (5 instances)
```javascript
// ❌ VULNERABLE
p.first_name LIKE '%${searchTerm}%'
p.last_name LIKE '%${searchTerm}%'
p.nick_name LIKE '%${searchTerm}%'
CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%'
CONCAT(p.first_name, ' ', p.nick_name, ' ', p.last_name) LIKE '%${searchTerm}%'
```

### 5. routes/players-list.js
**Lines:** 39-42
**Vulnerable Parameter:** `searchTerm` (4 instances)
```javascript
// ❌ VULNERABLE
p.first_name LIKE '%${searchTerm}%'
p.last_name LIKE '%${searchTerm}%'
p.nick_name LIKE '%${searchTerm}%'
CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%'
```

### 6. routes/players-list-optimized.js
**Lines:** 45-48
**Vulnerable Parameter:** `searchTerm` (4 instances)
```javascript
// ❌ VULNERABLE
p.first_name LIKE '%${searchTerm}%'
p.last_name LIKE '%${searchTerm}%'
p.nick_name LIKE '%${searchTerm}%'
CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%'
```

### 7. routes/simple-card-detail.js
**Lines:** 92, 128
**Vulnerable Parameters:** `part`, `normalizedCardNumber`
```javascript
// ❌ VULNERABLE
STRING_AGG(LOWER(CONCAT(p.first_name, ' ', p.last_name)), ', ') LIKE '%${part.replace(/'/g, "''")}%'
WHERE (c.card_number LIKE '%${normalizedCardNumber}%' OR '${normalizedCardNumber}' LIKE '%' + c.card_number + '%')
```

---

## High Priority Vulnerabilities (Unparameterized Numeric IDs)

### 8. routes/cards.js
**Lines:** 63, 99, 102, 251, 252, 267, 421
**Issue:** Direct interpolation of numeric IDs and IN clauses
```javascript
// ⚠️  VULNERABLE
WHERE pt3.team = ${parseInt(team_id)}
WHERE cpt.card IN (${cardIds.join(',')})
AND c.card_number = '${card_number.replace(/'/g, "''")}'
```

### 9. routes/admin-achievements.js
**Lines:** 213, 279, 307, 332, 375, 381, 387
**Issue:** Direct BigInt interpolation
```javascript
// ⚠️  VULNERABLE
WHERE achievement_id = ${BigInt(id)}
```

### 10. routes/teams.js
**Lines:** 19, 41
**Issue:** Direct numeric interpolation
```javascript
// ⚠️  VULNERABLE
WHERE team_id = ${parseInt(team_id)}
WHERE [user] = ${userId} AND team = ${parseInt(team_id)}
```

### 11. routes/user-collection-cards.js
**Lines:** 48, 58, 61, 67, 87
**Issue:** Direct interpolation in WHERE clauses
```javascript
// ⚠️  VULNERABLE
WHERE uc.[user] = ${parseInt(userId)}
WHERE uc.user_location IN (${locationFilter})
AND c.series = ${seriesFilter}
```

### 12. routes/user-locations.js
**Lines:** 45, 139, 169
**Issue:** Direct BigInt interpolation
```javascript
// ⚠️  VULNERABLE
AND uc.[user] = ${BigInt(parseInt(userId))}
```

---

## Fix Strategy

### Immediate Priorities (This Sprint)
1. ✅ **routes/cards.js** - Most critical, heavily used API
2. ✅ **routes/player-team-search.js** - Public search endpoint
3. ✅ **routes/players-list.js** - Public listing
4. ✅ **routes/card-detail.js** - High traffic endpoint
5. ✅ **routes/admin-achievements.js** - Admin with elevated privileges

### Short Term (Week 2)
6. routes/players-list-optimized.js
7. routes/simple-card-detail.js
8. routes/user-collection-cards.js
9. routes/teams.js
10. routes/user-locations.js

---

## Proper Fix Patterns

### Pattern 1: Prisma $queryRaw with Template Literals
```javascript
// ✅ SECURE - Prisma parameterized query
const result = await prisma.$queryRaw`
  SELECT * FROM card c
  WHERE LOWER(c.card_number) LIKE LOWER(${`%${cardNumber}%`})
`
```

### Pattern 2: Escape and Parameterize
```javascript
// ✅ SECURE - For LIKE queries
const searchPattern = `%${searchTerm}%`
const result = await prisma.$queryRaw`
  SELECT * FROM player p
  WHERE p.first_name LIKE ${searchPattern}
`
```

### Pattern 3: IN Clause with Array
```javascript
// ✅ SECURE - Array parameterization
const cardIds = [1, 2, 3]
const result = await prisma.$queryRaw`
  SELECT * FROM card
  WHERE card_id IN (${Prisma.join(cardIds)})
`
```

### Pattern 4: Multiple Parameters
```javascript
// ✅ SECURE - Multiple parameters
const result = await prisma.$queryRaw`
  SELECT * FROM card c
  WHERE c.series = ${seriesId}
    AND c.card_number = ${cardNumber}
    AND LOWER(c.notes) LIKE LOWER(${`%${searchTerm}%`})
`
```

---

## Testing Strategy

For each fixed file:
1. ✅ Write unit test with SQL injection attempt
2. ✅ Verify query still returns correct results
3. ✅ Test edge cases (special characters, empty strings, null)
4. ✅ Performance test (ensure no regression)
5. ✅ Integration test with real data

---

## Progress Tracking

- [x] **cards.js (Lines: 53-54, 68, 86, 95, 100, 176, 334)** ✅ FIXED
  - Added `escapeLikePattern()` helper function
  - Added `validateNumericId()` helper function
  - Fixed player name LIKE queries (lines 71-72, 79-80)
  - Fixed series_name LIKE query (line 95)
  - Fixed team_id validation (line 86)
  - Fixed series_id validation (line 100)
  - Fixed card_number escaping (line 105)
  - Fixed IN clause validation (lines 156-158, 312-314)
  - All user inputs now properly escaped/validated

- [ ] admin-achievements.js (Line: 62, 213, 279, 307, 332, 375, 381, 387)
- [ ] card-detail.js (Lines: 142-144)
- [ ] player-team-search.js (Lines: 56-60)
- [ ] players-list.js (Lines: 39-42, 92, 134, 186)
- [ ] players-list-optimized.js (Lines: 45-48)
- [ ] simple-card-detail.js (Lines: 92, 128)
- [ ] user-collection-cards.js (Lines: 48, 58, 61, 67, 87)
- [ ] teams.js (Lines: 19, 41)
- [ ] user-locations.js (Lines: 45, 139, 169)

---

**Status:** IN PROGRESS (1 of 10 files complete)
**Next Step:** Continue with other critical files or proceed to dependency audit
