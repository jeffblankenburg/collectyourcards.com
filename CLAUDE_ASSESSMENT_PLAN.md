# CollectYourCards.com - Comprehensive Improvement Plan

**Date:** October 28, 2025
**Based On:** COPILOT_ASSESSMENT.md
**Current Health Score:** 58/100
**Target Health Score:** 85/100
**Timeline:** 8-week sprint plan with ongoing maintenance

---

## Executive Summary

This plan addresses all issues identified in the Copilot assessment, organized into 4 phases over 8 weeks. The plan focuses on **immediate security fixes**, **test coverage improvements**, **performance optimization**, and **code quality enhancements**. Each phase includes specific tasks, success metrics, and implementation guidance.

**Key Priorities:**
1. Security fixes (Week 1)
2. Test coverage from 10.74% → 70% (Weeks 1-6)
3. Performance optimization: Bundle size 926KB → <500KB (Weeks 2-4)
4. Code quality: Refactor large files, fix linting (Weeks 3-6)
5. Mobile optimization (Weeks 5-8)

---

## Phase 0: Immediate Security Fixes (Week 1, Days 1-2)

### Critical Security Issues - **DO FIRST**

#### Task 0.1: Fix .env Security Risk
**Priority:** 🔴 CRITICAL
**Time Estimate:** 2 hours

**Actions:**
1. Verify `.env` is not in git history:
   ```bash
   git log --all --full-history -- .env
   ```

2. Add `.env` to `.gitignore` immediately:
   ```bash
   echo ".env" >> .gitignore
   echo ".env.*" >> .gitignore
   echo "!.env.example" >> .gitignore
   ```

3. If `.env` was committed, rotate ALL secrets:
   - Generate new JWT_SECRET
   - Rotate Azure Communication Services key
   - Rotate eBay API credentials (sandbox and production)
   - Update database password
   - Update all Azure secrets

4. Create `.env.example` template (no secrets):
   ```bash
   cp .env .env.example
   # Replace all values with placeholders
   sed -i 's/=.*/=YOUR_VALUE_HERE/g' .env.example
   ```

5. Update all environment configuration in Azure App Service

**Success Criteria:**
- ✅ `.env` not in git history
- ✅ `.env` in `.gitignore`
- ✅ All secrets rotated if exposed
- ✅ `.env.example` created for reference

---

#### Task 0.2: SQL Injection Audit & Fix
**Priority:** 🔴 CRITICAL
**Time Estimate:** 4 hours

**Issue:** Found direct string interpolation in WHERE clauses (cards.js lines 53-54)

**Actions:**
1. Search for all string interpolation in SQL:
   ```bash
   grep -r "LIKE.*\${" server/routes/
   grep -r "WHERE.*\${" server/routes/
   grep -r "AND.*\${" server/routes/
   ```

2. Replace with parameterized queries:
   ```javascript
   // ❌ DANGEROUS
   WHERE LOWER(p2.first_name) LIKE LOWER('%${firstName}%')

   // ✅ SAFE
   WHERE LOWER(p2.first_name) LIKE LOWER(CONCAT('%', @firstName, '%'))
   ```

3. Use Prisma's `Prisma.sql` template tag for raw queries:
   ```javascript
   const result = await prisma.$queryRaw`
     SELECT * FROM card
     WHERE card_number LIKE ${`%${cardNumber}%`}
   `
   ```

4. Run sql-injection-protection tests
5. Add test cases for injection attempts

**Success Criteria:**
- ✅ Zero direct string interpolation in SQL
- ✅ All queries use parameterization
- ✅ SQL injection tests passing
- ✅ New test cases for edge cases

---

#### Task 0.3: Dependency Security Audit
**Priority:** 🔴 HIGH
**Time Estimate:** 1 hour

**Actions:**
```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Review breaking changes
npm audit fix --force

# Update package-lock.json
npm install
```

**Success Criteria:**
- ✅ Zero high/critical vulnerabilities
- ✅ All dependencies up to date
- ✅ No breaking changes introduced

---

## Phase 1: Foundation & Quick Wins (Week 1-2)

### Goal: Fix immediate issues, enable quality gates, start test coverage

---

#### Task 1.1: Fix ESLint Configuration
**Priority:** 🔴 HIGH
**Time Estimate:** 3 hours

**Actions:**
1. Create `eslint.config.js` for ESLint v9+:
   ```javascript
   import js from '@eslint/js'
   import react from 'eslint-plugin-react'
   import reactHooks from 'eslint-plugin-react-hooks'

   export default [
     js.configs.recommended,
     {
       files: ['**/*.{js,jsx}'],
       plugins: {
         react,
         'react-hooks': reactHooks
       },
       rules: {
         'no-console': ['warn', { allow: ['error', 'warn'] }],
         'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
         'prefer-const': 'error',
         'no-var': 'error',
         'react/prop-types': 'off', // Using TypeScript or PropTypes
         'react-hooks/rules-of-hooks': 'error',
         'react-hooks/exhaustive-deps': 'warn'
       },
       languageOptions: {
         ecmaVersion: 2022,
         sourceType: 'module',
         globals: {
           process: 'readonly',
           console: 'readonly',
           __dirname: 'readonly',
           module: 'readonly',
           require: 'readonly'
         }
       }
     }
   ]
   ```

2. Update package.json scripts:
   ```json
   {
     "scripts": {
       "lint": "eslint .",
       "lint:fix": "eslint . --fix"
     }
   }
   ```

3. Run linter and fix auto-fixable issues:
   ```bash
   npm run lint:fix
   ```

4. Add pre-commit hook (optional):
   ```bash
   npx husky install
   npx husky add .husky/pre-commit "npm run lint"
   ```

**Success Criteria:**
- ✅ `npm run lint` executes without errors
- ✅ ESLint catches common issues
- ✅ CI/CD can run linting checks

---

#### Task 1.2: Fix Icon Component Duplicate Key
**Priority:** 🟡 MEDIUM
**Time Estimate:** 15 minutes

**Actions:**
1. Find duplicate 'monitor' key in `/client/src/components/Icon.jsx` (line 224)
2. Determine which monitor icon to keep
3. Rename or remove duplicate
4. Test all pages that use monitor icon

**Success Criteria:**
- ✅ No duplicate keys in iconMap
- ✅ All pages render correctly

---

#### Task 1.3: Fix Async Operation Leaks in Tests
**Priority:** 🟡 MEDIUM
**Time Estimate:** 2 hours

**Actions:**
1. Add proper cleanup to all tests:
   ```javascript
   afterEach(async () => {
     await prisma.$disconnect()
     // Close any open connections
   })

   afterAll(async () => {
     await cleanup()
   })
   ```

2. Find all pending timers:
   ```javascript
   jest.useFakeTimers()
   // ... test code
   jest.runAllTimers()
   jest.useRealTimers()
   ```

3. Remove `--forceExit` flag from package.json once fixed

4. Run tests with leak detection:
   ```bash
   npm test -- --detectOpenHandles --detectLeaks
   ```

**Success Criteria:**
- ✅ Tests don't require `--forceExit`
- ✅ No open handles reported
- ✅ Clean test execution

---

#### Task 1.4: Remove Excessive Console Logs
**Priority:** 🟡 MEDIUM
**Time Estimate:** 4 hours

**Current:** 653 console.log statements in server routes

**Actions:**
1. Create proper server-side logger:
   ```javascript
   // server/utils/logger.js
   const winston = require('winston')

   const logger = winston.createLogger({
     level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json()
     ),
     transports: [
       new winston.transports.File({ filename: 'error.log', level: 'error' }),
       new winston.transports.File({ filename: 'combined.log' }),
       ...(process.env.NODE_ENV !== 'production'
         ? [new winston.transports.Console({
             format: winston.format.simple()
           })]
         : [])
     ]
   })

   module.exports = logger
   ```

2. Replace console.log throughout server:
   ```javascript
   // ❌ Before
   console.log('User logged in:', userId)

   // ✅ After
   logger.info('User logged in', { userId })
   ```

3. Search and replace:
   ```bash
   # Find all console.log
   grep -r "console\.log" server/routes/

   # Replace systematically
   # Keep console.error for critical errors
   # Replace console.log with logger.debug/info
   ```

4. Add environment check for remaining logs:
   ```javascript
   const isDev = process.env.NODE_ENV === 'development'
   if (isDev) console.log('Debug info:', data)
   ```

**Success Criteria:**
- ✅ <50 console.log statements
- ✅ Structured logging with winston
- ✅ Production logs clean and useful
- ✅ No sensitive data in logs

---

#### Task 1.5: Implement Code Splitting
**Priority:** 🔴 HIGH
**Time Estimate:** 4 hours

**Current Bundle:** 926KB JavaScript, 656KB CSS

**Actions:**
1. Add lazy loading to React routes:
   ```javascript
   // client/src/App.jsx
   import { lazy, Suspense } from 'react'

   // ❌ Before
   import CollectionDashboard from './pages/CollectionDashboard'

   // ✅ After
   const CollectionDashboard = lazy(() => import('./pages/CollectionDashboard'))
   const PlayerDetail = lazy(() => import('./pages/PlayerDetail'))
   const TeamDetail = lazy(() => import('./pages/TeamDetail'))
   const SeriesDetail = lazy(() => import('./pages/SeriesDetail'))
   const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

   // Wrap routes with Suspense
   <Suspense fallback={<LoadingSpinner />}>
     <Route path="/collection" element={<CollectionDashboard />} />
   </Suspense>
   ```

2. Split by feature modules:
   ```javascript
   // Separate admin bundle
   const AdminRoutes = lazy(() => import('./routes/AdminRoutes'))

   // Separate import feature
   const ImportWizard = lazy(() => import('./components/ImportWizard'))
   ```

3. Configure Vite for optimal chunking:
   ```javascript
   // vite.config.js
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'vendor': ['react', 'react-dom', 'react-router-dom'],
             'ui': ['lucide-react'],
             'utils': ['axios', 'date-fns'],
             'admin': [
               './src/pages/AdminDashboard',
               './src/pages/admin/*'
             ]
           }
         }
       },
       chunkSizeWarningLimit: 500
     }
   })
   ```

4. Measure bundle size:
   ```bash
   npm run build
   # Check dist/ folder sizes
   ```

**Expected Impact:**
- Initial bundle: 926KB → 200-300KB (67% reduction)
- Admin bundle: Separate ~150KB chunk
- Faster page loads, especially on mobile

**Success Criteria:**
- ✅ Initial bundle <500KB
- ✅ No Vite warnings about chunk size
- ✅ Page load time improved

---

#### Task 1.6: Add Database Indexes
**Priority:** 🔴 HIGH
**Time Estimate:** 3 hours

**Actions:**
1. Analyze query patterns from routes
2. Create index script:
   ```sql
   -- Add to DATABASE_CHANGES_FOR_PRODUCTION.sql

   -- Card queries (most common)
   CREATE INDEX idx_card_series_color ON card(series, color);
   CREATE INDEX idx_card_number ON card(card_number);

   -- Series queries
   CREATE INDEX idx_series_set_name ON series([set], name);
   CREATE INDEX idx_series_slug ON series(slug);

   -- Player queries
   CREATE INDEX idx_player_name ON player(last_name, first_name);
   CREATE INDEX idx_player_hof ON player(is_hof) WHERE is_hof = 1;

   -- User card queries
   CREATE INDEX idx_user_card_user_location ON user_card([user], user_location);
   CREATE INDEX idx_user_card_user_card ON user_card([user], card);
   CREATE INDEX idx_user_card_special ON user_card([user], is_special) WHERE is_special = 1;

   -- Card player team junction
   CREATE INDEX idx_cpt_card ON card_player_team(card);
   CREATE INDEX idx_cpt_player_team ON card_player_team(player_team);

   -- Player team junction
   CREATE INDEX idx_player_team_player ON player_team(player);
   CREATE INDEX idx_player_team_team ON player_team(team);

   -- User queries
   CREATE INDEX idx_user_email ON [user](email);
   CREATE INDEX idx_user_username ON [user](username);

   -- Achievement queries
   CREATE INDEX idx_user_achievement_user ON user_achievement([user]);
   CREATE INDEX idx_user_achievement_achievement ON user_achievement(achievement);
   ```

3. Test query performance before/after:
   ```sql
   SET STATISTICS TIME ON;
   SET STATISTICS IO ON;

   -- Run common queries and compare
   SELECT * FROM card WHERE series = 123 AND color = 1;
   ```

4. Document in DATABASE_CHANGE_TRACKING.md

**Expected Impact:**
- Query performance: 100-500ms → 10-50ms
- Reduced database CPU usage
- Better handling of large datasets

**Success Criteria:**
- ✅ All indexes created
- ✅ Query performance improved
- ✅ No negative impact on writes

---

#### Task 1.7: Start Test Coverage - Critical Paths (Target: 30%)
**Priority:** 🔴 CRITICAL
**Time Estimate:** 20 hours (Week 1-2)

**Focus Areas:**

##### 1.7.1 User Card Management Tests (Priority 1)
**Current:** 9.37% → **Target:** 70%

```javascript
// tests/routes/user-cards.test.js

describe('User Card Management', () => {
  describe('POST /api/user/cards - Add to Collection', () => {
    test('should add card to collection', async () => {
      const card = await createTestCard()
      const user = await createTestUser()
      const token = createAuthToken(user)

      const response = await request(app)
        .post('/api/user/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          card_id: card.card_id,
          serial_number: 5,
          purchase_price: 29.99
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.card.serial_number).toBe(5)
    })

    test('should validate required fields', async () => { /* ... */ })
    test('should handle duplicate cards', async () => { /* ... */ })
    test('should require authentication', async () => { /* ... */ })
  })

  describe('PUT /api/user/cards/:id - Update Card', () => {
    test('should update card details', async () => { /* ... */ })
    test('should update location', async () => { /* ... */ })
    test('should validate ownership', async () => { /* ... */ })
  })

  describe('DELETE /api/user/cards/:id - Remove Card', () => {
    test('should remove card from collection', async () => { /* ... */ })
    test('should require ownership', async () => { /* ... */ })
  })
})
```

##### 1.7.2 Search Functionality Tests (Priority 2)
**Current:** 83.77% → **Target:** 95%+

Cover missing lines:
- Error handling (lines 23-25, 51, 71-72)
- Edge cases (lines 100-101, 136-137)
- Concurrent requests (lines 480-485)
- Performance with large datasets (lines 794-800)

```javascript
describe('Search Edge Cases', () => {
  test('should handle special characters in query', async () => { /* ... */ })
  test('should handle empty results', async () => { /* ... */ })
  test('should handle concurrent searches', async () => { /* ... */ })
  test('should timeout long-running queries', async () => { /* ... */ })
})
```

##### 1.7.3 Authentication Tests (Priority 3)
**Current:** Partial → **Target:** 100%

```javascript
describe('Authentication Middleware', () => {
  test('should accept valid JWT', async () => { /* ... */ })
  test('should reject expired JWT', async () => { /* ... */ })
  test('should reject invalid JWT', async () => { /* ... */ })
  test('should handle missing token', async () => { /* ... */ })
  test('should require verified email for protected routes', async () => { /* ... */ })
  test('should require admin for admin routes', async () => { /* ... */ })
})
```

**Success Criteria:**
- ✅ Test coverage reaches 30%
- ✅ User card management: 70%+
- ✅ Search: 95%+
- ✅ Authentication: 100%
- ✅ All critical paths tested

---

## Phase 2: Test Coverage & Refactoring (Week 3-4)

### Goal: Reach 50% test coverage, refactor large files

---

#### Task 2.1: Import System Tests (Priority 1)
**Priority:** 🔴 CRITICAL
**Time Estimate:** 16 hours
**Current:** 0% (2,360 lines) → **Target:** 70%

**Test Coverage Plan:**

```javascript
// tests/routes/import.test.js

describe('Import System - File Upload', () => {
  test('should accept valid Excel file', async () => {
    const file = createMockExcelFile()
    const response = await uploadFile(file)
    expect(response.status).toBe(200)
  })

  test('should reject non-Excel files', async () => { /* ... */ })
  test('should reject files > 10MB', async () => { /* ... */ })
  test('should handle corrupted Excel files', async () => { /* ... */ })
})

describe('Import System - Excel Parsing', () => {
  test('should parse standard format', async () => { /* ... */ })
  test('should handle missing columns', async () => { /* ... */ })
  test('should handle extra columns', async () => { /* ... */ })
  test('should parse various date formats', async () => { /* ... */ })
  test('should handle empty rows', async () => { /* ... */ })
})

describe('Import System - Player/Team Matching', () => {
  test('should match exact player names', async () => { /* ... */ })
  test('should match single-name players (Ichiro)', async () => { /* ... */ })
  test('should handle accented characters (José)', async () => { /* ... */ })
  test('should match team abbreviations', async () => { /* ... */ })
  test('should handle team city variations', async () => { /* ... */ })
  test('should suggest matches for ambiguous names', async () => { /* ... */ })
})

describe('Import System - Card Matching', () => {
  test('should match by card number', async () => { /* ... */ })
  test('should match parallel cards', async () => { /* ... */ })
  test('should detect consecutive duplicates', async () => { /* ... */ })
  test('should NOT merge non-consecutive duplicates', async () => { /* ... */ })
})

describe('Import System - Database Operations', () => {
  test('should create user_card records in transaction', async () => { /* ... */ })
  test('should rollback on error', async () => { /* ... */ })
  test('should handle large imports (1000+ cards)', async () => { /* ... */ })
  test('should track progress correctly', async () => { /* ... */ })
})

describe('Import System - Error Handling', () => {
  test('should report validation errors', async () => { /* ... */ })
  test('should handle database connection errors', async () => { /* ... */ })
  test('should provide detailed error messages', async () => { /* ... */ })
})
```

**Test Fixtures Needed:**
- Sample Excel files (valid, invalid, edge cases)
- Mock database data (players, teams, cards)
- Mock user sessions

**Success Criteria:**
- ✅ 70%+ test coverage
- ✅ All matching algorithms tested
- ✅ Error handling verified
- ✅ Performance tested with large datasets

---

#### Task 2.2: eBay Integration Tests (Priority 2)
**Priority:** 🔴 HIGH
**Time Estimate:** 12 hours
**Current:** 0% (~1,500 lines) → **Target:** 70%

**Files to Test:**
- ebay.js
- ebay-auth.js
- ebay-sync.js
- ebay-testing.js

**Test Strategy:**
1. Mock all external eBay API calls
2. Test authentication flow
3. Test purchase detection
4. Test card matching engine
5. Test sync operations

```javascript
// tests/routes/ebay.test.js

// Mock eBay API
jest.mock('../services/ebay-client', () => ({
  authenticate: jest.fn(),
  fetchOrders: jest.fn(),
  fetchOrderDetails: jest.fn()
}))

describe('eBay Integration - Authentication', () => {
  test('should initiate OAuth flow', async () => { /* ... */ })
  test('should exchange code for token', async () => { /* ... */ })
  test('should refresh expired token', async () => { /* ... */ })
  test('should handle authentication errors', async () => { /* ... */ })
})

describe('eBay Integration - Purchase Detection', () => {
  test('should detect new card purchases', async () => { /* ... */ })
  test('should skip non-card purchases', async () => { /* ... */ })
  test('should parse card details from title', async () => { /* ... */ })
  test('should handle multiple cards in one order', async () => { /* ... */ })
})

describe('eBay Integration - Card Matching', () => {
  test('should match to existing cards', async () => { /* ... */ })
  test('should suggest similar cards if no match', async () => { /* ... */ })
  test('should handle ambiguous matches', async () => { /* ... */ })
})

describe('eBay Integration - Sync Operations', () => {
  test('should sync new orders', async () => { /* ... */ })
  test('should update existing orders', async () => { /* ... */ })
  test('should handle pagination', async () => { /* ... */ })
  test('should throttle API requests', async () => { /* ... */ })
})
```

**Success Criteria:**
- ✅ 70%+ test coverage
- ✅ All API calls mocked
- ✅ Error handling verified
- ✅ Rate limiting tested

---

#### Task 2.3: Achievement System Tests (Priority 3)
**Priority:** 🟡 MEDIUM
**Time Estimate:** 8 hours
**Current:** 0% → **Target:** 80%

```javascript
// tests/services/achievementEngine.test.js

describe('Achievement Engine - Trigger Logic', () => {
  test('should award First Card achievement', async () => {
    const user = await createTestUser()
    await addCardToCollection(user, testCard)

    const achievements = await checkAchievements(user)
    expect(achievements).toContainEqual(
      expect.objectContaining({ achievement_id: FIRST_CARD_ID })
    )
  })

  test('should award milestone achievements (10, 50, 100 cards)', async () => { /* ... */ })
  test('should award team achievements', async () => { /* ... */ })
  test('should award player achievements', async () => { /* ... */ })
  test('should award set completion', async () => { /* ... */ })
})

describe('Achievement Engine - Retroactive Processing', () => {
  test('should process existing collection for new achievements', async () => { /* ... */ })
  test('should handle large collections efficiently', async () => { /* ... */ })
})

describe('Achievement Engine - User Progress', () => {
  test('should track progress for multi-tier achievements', async () => { /* ... */ })
  test('should update progress on relevant actions', async () => { /* ... */ })
})
```

**Success Criteria:**
- ✅ 80%+ test coverage
- ✅ All achievement types tested
- ✅ Retroactive processing verified
- ✅ Performance acceptable

---

#### Task 2.4: Refactor Large Route Files
**Priority:** 🟡 MEDIUM
**Time Estimate:** 20 hours

**Target Files:**

##### 2.4.1 import.js (2,360 lines → 4 files)

Split into modules:

```
server/routes/import/
├── import.js (main router, ~200 lines)
├── upload.js (file handling, ~400 lines)
├── validation.js (Excel parsing, ~600 lines)
├── matching.js (player/team/card matching, ~800 lines)
└── commit.js (database operations, ~400 lines)
```

**Refactoring approach:**
```javascript
// server/routes/import.js (main router)
const express = require('express')
const router = express.Router()
const { handleUpload } = require('./import/upload')
const { validateData } = require('./import/validation')
const { matchCards } = require('./import/matching')
const { commitToDatabase } = require('./import/commit')

router.post('/upload', handleUpload)
router.post('/validate', validateData)
router.post('/match', matchCards)
router.post('/commit', commitToDatabase)

module.exports = router
```

##### 2.4.2 user-profile.js (1,305 lines → 4 files)

Split into:
```
server/routes/user-profile/
├── profile.js (main router)
├── read.js (GET operations)
├── update.js (PUT operations)
├── favorites.js (favorite management)
└── username.js (username changes)
```

##### 2.4.3 admin-sets.js (1,250 lines → 3 files)

Split into:
```
server/routes/admin/sets/
├── sets.js (main router)
├── read.js (GET operations)
├── write.js (POST/PUT/DELETE)
└── series.js (series management)
```

##### 2.4.4 admin-players.js (986 lines → 3 files)

Split into:
```
server/routes/admin/players/
├── players.js (main router)
├── crud.js (CRUD operations)
└── teams.js (player-team associations)
```

##### 2.4.5 search.js (862 lines → 3 files)

Split into:
```
server/routes/search/
├── search.js (main router)
├── cards.js (card search)
├── players.js (player search)
└── teams.js (team search)
```

**Refactoring Process:**
1. Write comprehensive tests BEFORE refactoring
2. Extract logical modules one at a time
3. Run tests after each extraction
4. Update imports across codebase
5. Document new structure

**Success Criteria:**
- ✅ No file >500 lines
- ✅ All tests still passing
- ✅ Functionality unchanged
- ✅ Imports updated correctly

---

#### Task 2.5: Implement Virtual Scrolling
**Priority:** 🔴 HIGH
**Time Estimate:** 8 hours

**Problem:** Loading 10,000+ cards at once causes 343ms delays

**Solution:** Use `react-window` for virtualization

**Implementation:**

```bash
npm install react-window
```

```javascript
// client/src/components/tables/VirtualizedCollectionTable.jsx
import { FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

const VirtualizedCollectionTable = ({ cards, onCardClick, onEditCard }) => {
  const Row = ({ index, style }) => {
    const card = cards[index]
    return (
      <div style={style} className="card-row">
        <CardRow
          card={card}
          onCardClick={onCardClick}
          onEditCard={onEditCard}
        />
      </div>
    )
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <FixedSizeList
          height={height}
          itemCount={cards.length}
          itemSize={120} // Height of each card row
          width={width}
          overscanCount={5} // Pre-render 5 rows above/below viewport
        >
          {Row}
        </FixedSizeList>
      )}
    </AutoSizer>
  )
}
```

**Implement in:**
- CollectionDashboard
- SeriesDetail (Rainbow View)
- PlayerDetail
- TeamDetail

**Expected Impact:**
- Initial render: 343ms → <50ms (85% faster)
- Support 100,000+ cards
- Eliminate performance warnings

**Success Criteria:**
- ✅ No "[Violation] handler took Xms" warnings
- ✅ Smooth scrolling with 10,000+ cards
- ✅ Memory usage stable

---

## Phase 3: Performance & Mobile (Week 5-6)

### Goal: Reach 70% test coverage, optimize CSS, mobile optimization

---

#### Task 3.1: Complete Test Coverage to 70%
**Priority:** 🔴 CRITICAL
**Time Estimate:** 20 hours

**Remaining Areas:**

##### 3.1.1 Email Service Tests
**Current:** 0% (300 lines) → **Target:** 80%

```javascript
// tests/services/emailService.test.js

// Mock Azure Communication Services
jest.mock('@azure/communication-email')

describe('Email Service', () => {
  test('should send verification email', async () => { /* ... */ })
  test('should send password reset email', async () => { /* ... */ })
  test('should handle template rendering', async () => { /* ... */ })
  test('should retry on transient failures', async () => { /* ... */ })
  test('should log delivery failures', async () => { /* ... */ })
})
```

##### 3.1.2 Photo Management Tests
**Current:** 0% (583 lines) → **Target:** 75%

```javascript
// tests/routes/user-card-photos.test.js

// Mock Azure Blob Storage
jest.mock('@azure/storage-blob')

describe('Photo Management', () => {
  test('should upload photo to Azure Blob', async () => { /* ... */ })
  test('should generate thumbnail', async () => { /* ... */ })
  test('should update photo sort order', async () => { /* ... */ })
  test('should delete photo from Azure', async () => { /* ... */ })
  test('should validate file type', async () => { /* ... */ })
  test('should validate file size', async () => { /* ... */ })
  test('should require ownership', async () => { /* ... */ })
})
```

##### 3.1.3 User Lists Tests
**Current:** 0% (829 lines) → **Target:** 70%

```javascript
// tests/routes/user-lists.test.js

describe('User Lists', () => {
  test('should create list', async () => { /* ... */ })
  test('should add cards to list', async () => { /* ... */ })
  test('should remove cards from list', async () => { /* ... */ })
  test('should set visibility (public/private)', async () => { /* ... */ })
  test('should share list via URL', async () => { /* ... */ })
  test('should delete list', async () => { /* ... */ })
})
```

##### 3.1.4 Spreadsheet Generation Tests
**Current:** 0% (655 lines) → **Target:** 70%

```javascript
// tests/services/spreadsheet-generation.test.js

describe('Spreadsheet Generation', () => {
  test('should generate Excel with correct format', async () => { /* ... */ })
  test('should handle large collections (10,000+ cards)', async () => { /* ... */ })
  test('should apply filters correctly', async () => { /* ... */ })
  test('should format currency values', async () => { /* ... */ })
  test('should timeout if taking too long', async () => { /* ... */ })
})
```

##### 3.1.5 Admin Feature Tests
**Current:** 0-20% → **Target:** 70%

```javascript
// tests/routes/admin-*.test.js

describe('Admin Sets Management', () => {
  test('should require admin role', async () => { /* ... */ })
  test('should create set', async () => { /* ... */ })
  test('should update set', async () => { /* ... */ })
  test('should delete set', async () => { /* ... */ })
  test('should log all actions', async () => { /* ... */ })
})

// Similar for:
// - admin-players.test.js
// - admin-teams.test.js
// - admin-series.test.js
// - admin-cards.test.js
// - admin-moderation.test.js
```

##### 3.1.6 Integration Tests

```javascript
// tests/integration/card-workflow.test.js

describe('Card Workflow Integration', () => {
  test('should complete full card workflow', async () => {
    // 1. User searches for card
    // 2. Views card detail
    // 3. Adds to collection
    // 4. Uploads photo
    // 5. Updates values
    // 6. Views in collection dashboard
  })
})

// tests/integration/import-workflow.test.js
describe('Import Workflow Integration', () => {
  test('should complete full import workflow', async () => {
    // 1. Upload spreadsheet
    // 2. Validate data
    // 3. Match cards
    // 4. Review matches
    // 5. Confirm import
    // 6. Verify cards in collection
  })
})
```

**Success Criteria:**
- ✅ Overall test coverage: 70%+
- ✅ Email service: 80%+
- ✅ Photo management: 75%+
- ✅ User lists: 70%+
- ✅ Spreadsheet generation: 70%+
- ✅ Admin features: 70%+
- ✅ Integration tests passing

---

#### Task 3.2: CSS Optimization
**Priority:** 🟡 MEDIUM
**Time Estimate:** 12 hours

**Current:** 96 CSS files, 656KB bundle

**Goal:** Reduce to <200KB

**Actions:**

##### 3.2.1 Audit CSS Usage
```bash
# Install PurgeCSS
npm install -D @fullhuman/postcss-purgecss

# Configure in vite.config.js
import purgecss from '@fullhuman/postcss-purgecss'

export default {
  css: {
    postcss: {
      plugins: [
        purgecss({
          content: ['./src/**/*.{js,jsx,html}'],
          safelist: ['active', 'open', 'modal-open'] // Keep these
        })
      ]
    }
  }
}
```

##### 3.2.2 Consolidate Scoped CSS
**Issue:** Multiple `*Scoped.css` files suggest inconsistent patterns

**Approach:**
1. Create design system variables:
```css
/* client/src/styles/design-system.css */
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;

  /* Borders */
  --border-radius: 0.375rem;
  --border-width: 1px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.15);
}
```

2. Create shared component styles:
```css
/* client/src/styles/components.css */
.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.card {
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-lg);
}
```

3. Convert component-specific CSS to use design system
4. Remove duplicate styles

##### 3.2.3 Implement CSS Modules Consistently
```javascript
// Use CSS modules for component-specific styles
import styles from './CollectionDashboard.module.css'

<div className={styles.dashboard}>
  <div className={styles.header}>
    {/* ... */}
  </div>
</div>
```

**Expected Impact:**
- CSS bundle: 656KB → <200KB (70% reduction)
- Consistent styling
- Easier maintenance
- Fewer conflicts

**Success Criteria:**
- ✅ CSS bundle <200KB
- ✅ Design system implemented
- ✅ No duplicate styles
- ✅ All pages styled correctly

---

#### Task 3.3: Mobile Navigation
**Priority:** 🔴 HIGH
**Time Estimate:** 8 hours

**Requirement:** Hamburger menu for screens <768px

**Implementation:**

```javascript
// client/src/components/MobileNavigation.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import './MobileNavigation.css'

const MobileNavigation = ({ isAuthenticated, user }) => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const navItems = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/collection', label: 'My Collection', icon: 'collections', auth: true },
    { path: '/search', label: 'Search', icon: 'search' },
    { path: '/teams', label: 'Teams', icon: 'users' },
    { path: '/players', label: 'Players', icon: 'user' },
    { path: '/achievements', label: 'Achievements', icon: 'trophy', auth: true },
    { path: '/profile', label: 'Profile', icon: 'user-circle', auth: true }
  ]

  return (
    <>
      <button
        className="mobile-nav-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
      >
        <Icon name={isOpen ? 'x' : 'menu'} size={24} />
      </button>

      {isOpen && (
        <div className="mobile-nav-overlay" onClick={() => setIsOpen(false)}>
          <nav className="mobile-nav" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              {user && (
                <div className="mobile-nav-user">
                  <Icon name="user" size={20} />
                  <span>{user.username || user.email}</span>
                </div>
              )}
            </div>

            <ul className="mobile-nav-items">
              {navItems
                .filter(item => !item.auth || isAuthenticated)
                .map(item => (
                  <li key={item.path}>
                    <button
                      onClick={() => {
                        navigate(item.path)
                        setIsOpen(false)
                      }}
                    >
                      <Icon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
            </ul>

            <div className="mobile-nav-footer">
              {isAuthenticated ? (
                <button onClick={handleLogout}>
                  <Icon name="log-out" size={20} />
                  <span>Logout</span>
                </button>
              ) : (
                <button onClick={() => navigate('/login')}>
                  <Icon name="log-in" size={20} />
                  <span>Login</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
```

**Styles:**
```css
/* client/src/components/MobileNavigation.css */
.mobile-nav-toggle {
  display: none;
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.mobile-nav-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 0.2s ease;
}

.mobile-nav {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 80%;
  max-width: 320px;
  background: white;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s ease;
}

.mobile-nav-items {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.mobile-nav-items li button {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 1rem;
  border: none;
  background: none;
  font-size: 1rem;
  text-align: left;
  border-radius: 0.5rem;
  transition: background 0.2s ease;
  min-height: 44px; /* Touch-friendly */
}

.mobile-nav-items li button:hover,
.mobile-nav-items li button:active {
  background: #f3f4f6;
}

/* Show only on mobile */
@media (max-width: 768px) {
  .mobile-nav-toggle {
    display: block;
  }

  .desktop-nav {
    display: none;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

**Success Criteria:**
- ✅ Hamburger menu visible on mobile
- ✅ Smooth animations
- ✅ Touch-friendly (44px targets)
- ✅ Accessible (keyboard navigation)

---

#### Task 3.4: Responsive Design Testing
**Priority:** 🔴 HIGH
**Time Estimate:** 12 hours

**Test all pages at breakpoints:**
- 320px (iPhone SE)
- 375px (iPhone 12/13/14)
- 390px (iPhone 14 Pro)
- 428px (iPhone 14 Pro Max)
- 768px (iPad)
- 1024px (iPad Pro)
- 1440px (Desktop)

**Pages to test:**
1. Home
2. Collection Dashboard
3. Card Detail
4. Player Detail
5. Team Detail
6. Series Detail
7. Search Results
8. Import Page
9. Profile
10. Admin Dashboard

**Issues to fix:**
- Horizontal scroll
- Text overflow
- Image sizing
- Button touch targets
- Form usability
- Table responsiveness
- Grid layouts

**Testing tools:**
```bash
# Chrome DevTools device emulation
# Real device testing (iOS Safari, Android Chrome)
# Responsive Design Checker online tools
```

**Document mobile-specific CSS:**
```css
/* Mobile-first approach */
.collection-grid {
  display: grid;
  grid-template-columns: 1fr; /* Single column on mobile */
  gap: 1rem;
}

@media (min-width: 480px) {
  .collection-grid {
    grid-template-columns: repeat(2, 1fr); /* 2 columns */
  }
}

@media (min-width: 768px) {
  .collection-grid {
    grid-template-columns: repeat(3, 1fr); /* 3 columns */
  }
}

@media (min-width: 1024px) {
  .collection-grid {
    grid-template-columns: repeat(4, 1fr); /* 4 columns */
  }
}

@media (min-width: 1440px) {
  .collection-grid {
    grid-template-columns: repeat(5, 1fr); /* 5 columns */
  }
}
```

**Success Criteria:**
- ✅ No horizontal scroll at any breakpoint
- ✅ All touch targets ≥44px
- ✅ Text readable without zoom
- ✅ Images sized appropriately
- ✅ Forms usable on mobile

---

#### Task 3.5: Implement Request Caching
**Priority:** 🟡 MEDIUM
**Time Estimate:** 6 hours

**Install React Query:**
```bash
npm install @tanstack/react-query
```

**Setup:**
```javascript
// client/src/App.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... */}
    </QueryClientProvider>
  )
}
```

**Convert API calls to use React Query:**
```javascript
// Before
const [cards, setCards] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchCards = async () => {
    try {
      const response = await axios.get('/api/user/collection/cards')
      setCards(response.data.cards)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  fetchCards()
}, [])

// After
import { useQuery } from '@tanstack/react-query'

const { data: cards, isLoading, error } = useQuery({
  queryKey: ['userCards'],
  queryFn: async () => {
    const response = await axios.get('/api/user/collection/cards')
    return response.data.cards
  }
})
```

**Benefits:**
- Automatic caching
- Background refetching
- Optimistic updates
- Reduced API calls
- Better loading states

**Success Criteria:**
- ✅ React Query integrated
- ✅ Major API calls converted
- ✅ Reduced duplicate requests
- ✅ Faster perceived performance

---

#### Task 3.6: Implement Response Compression
**Priority:** 🟡 MEDIUM
**Time Estimate:** 2 hours

**Install compression middleware:**
```bash
npm install compression
```

**Configure:**
```javascript
// server/server-setup.js
const compression = require('compression')

app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  }
}))
```

**Expected Impact:**
- JSON responses: 50-70% smaller
- HTML responses: 60-80% smaller
- Faster data transfer
- Reduced bandwidth costs

**Success Criteria:**
- ✅ Compression enabled
- ✅ Response sizes reduced
- ✅ No performance degradation

---

## Phase 4: Polish & Documentation (Week 7-8)

### Goal: Frontend tests, security hardening, documentation

---

#### Task 4.1: Frontend Component Tests
**Priority:** 🟡 MEDIUM
**Time Estimate:** 20 hours

**Install testing libraries:**
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest
```

**Configure Vitest:**
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js'
  }
})
```

**Test critical components:**

```javascript
// tests/components/CollectionTable.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CollectionTable from '../../src/components/tables/CollectionTable'

describe('CollectionTable', () => {
  const mockCards = [
    { card_id: 1, card_number: '1', player: 'Mike Trout' },
    { card_id: 2, card_number: '2', player: 'Shohei Ohtani' }
  ]

  test('renders cards', () => {
    render(<CollectionTable cards={mockCards} />)
    expect(screen.getByText('Mike Trout')).toBeInTheDocument()
    expect(screen.getByText('Shohei Ohtani')).toBeInTheDocument()
  })

  test('handles search', async () => {
    render(<CollectionTable cards={mockCards} />)
    const searchInput = screen.getByPlaceholderText('Search...')

    await userEvent.type(searchInput, 'Trout')

    await waitFor(() => {
      expect(screen.getByText('Mike Trout')).toBeInTheDocument()
      expect(screen.queryByText('Shohei Ohtani')).not.toBeInTheDocument()
    })
  })

  test('handles card click', async () => {
    const onCardClick = jest.fn()
    render(<CollectionTable cards={mockCards} onCardClick={onCardClick} />)

    await userEvent.click(screen.getByText('Mike Trout'))

    expect(onCardClick).toHaveBeenCalledWith(mockCards[0])
  })
})
```

**Components to test:**
- CollectionTable
- CardDetailModal
- QuickEditModal
- ImportWizard
- SearchBar
- TeamFilterCircles
- SavedViewsDropdown
- PhotoCountHover
- Icon

**Success Criteria:**
- ✅ 50%+ frontend coverage
- ✅ Critical user paths tested
- ✅ All interactive components tested

---

#### Task 4.2: E2E Tests with Playwright
**Priority:** 🟡 MEDIUM
**Time Estimate:** 16 hours

**Install Playwright:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Configure:**
```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } }
  ]
})
```

**Critical user journeys:**

```javascript
// tests/e2e/user-registration.spec.js
import { test, expect } from '@playwright/test'

test('complete user registration flow', async ({ page }) => {
  // 1. Navigate to registration
  await page.goto('/register')

  // 2. Fill form
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'TestPassword123!')
  await page.fill('[name="confirmPassword"]', 'TestPassword123!')

  // 3. Submit
  await page.click('button[type="submit"]')

  // 4. Verify success message
  await expect(page.locator('.toast')).toContainText('verification email')

  // 5. Check email (mock)
  const verificationLink = await getVerificationLink('test@example.com')

  // 6. Click verification link
  await page.goto(verificationLink)

  // 7. Verify account activated
  await expect(page.locator('.toast')).toContainText('verified')

  // 8. Login
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'TestPassword123!')
  await page.click('button[type="submit"]')

  // 9. Verify logged in
  await expect(page.locator('.user-menu')).toBeVisible()
})
```

```javascript
// tests/e2e/card-collection.spec.js
test('add card to collection workflow', async ({ page }) => {
  // 1. Login
  await login(page, 'test@example.com', 'password')

  // 2. Search for card
  await page.goto('/search')
  await page.fill('[name="search"]', '2023 Topps Chrome Mike Trout')
  await page.click('button[type="submit"]')

  // 3. View card detail
  await page.click('.card-result:first-child')
  await expect(page).toHaveURL(/\/card\//)

  // 4. Add to collection
  await page.click('button:has-text("Add to Collection")')

  // 5. Fill details
  await page.fill('[name="serial_number"]', '25')
  await page.fill('[name="purchase_price"]', '49.99')
  await page.selectOption('[name="location"]', 'My Office')

  // 6. Save
  await page.click('button:has-text("Save")')

  // 7. Verify success
  await expect(page.locator('.toast')).toContainText('Added to collection')

  // 8. Navigate to collection
  await page.goto('/collection')

  // 9. Verify card appears
  await expect(page.locator('.collection-table')).toContainText('Mike Trout')
  await expect(page.locator('.collection-table')).toContainText('25/99')
})
```

```javascript
// tests/e2e/import-workflow.spec.js
test('import spreadsheet workflow', async ({ page }) => {
  await login(page, 'test@example.com', 'password')

  // 1. Navigate to import
  await page.goto('/import')

  // 2. Upload file
  await page.setInputFiles('[type="file"]', './tests/fixtures/sample-import.xlsx')

  // 3. Wait for parsing
  await expect(page.locator('.parsing-status')).toContainText('Parsed')

  // 4. Review matches
  await expect(page.locator('.match-summary')).toContainText('50 cards matched')

  // 5. Confirm import
  await page.click('button:has-text("Confirm Import")')

  // 6. Wait for completion
  await expect(page.locator('.import-complete')).toBeVisible({ timeout: 30000 })

  // 7. Verify in collection
  await page.goto('/collection')
  const cardCount = await page.locator('.stat-value').first().textContent()
  expect(parseInt(cardCount)).toBeGreaterThanOrEqual(50)
})
```

**Test scenarios:**
1. User registration → verification → login
2. Search → card detail → add to collection
3. Import spreadsheet → review → confirm
4. Collection dashboard → filters → card management
5. Photo upload → sort → delete
6. Achievement unlock → notification → view
7. Create list → add cards → share
8. Admin moderation → review → action

**Success Criteria:**
- ✅ All critical journeys tested
- ✅ Tests passing on Chrome, Safari, mobile
- ✅ Screenshots on failures
- ✅ CI/CD integration

---

#### Task 4.3: Security Hardening
**Priority:** 🔴 HIGH
**Time Estimate:** 8 hours

##### 4.3.1 Implement CSRF Protection

```bash
npm install csurf
```

```javascript
// server/server-setup.js
const csrf = require('csurf')

// Enable CSRF protection
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
})

// Apply to all POST/PUT/DELETE routes
app.use(csrfProtection)

// Send token to client
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

// Client includes token in requests
// axios.defaults.headers.common['X-CSRF-Token'] = csrfToken
```

##### 4.3.2 Add Security Headers

```javascript
// server/server-setup.js
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}))

app.use(helmet.noSniff())
app.use(helmet.frameguard({ action: 'deny' }))
app.use(helmet.xssFilter())
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }))

// Add CSP reporting
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.ebay.com'],
    reportUri: '/api/csp-violations'
  }
}))

// CSP violation reporting endpoint
app.post('/api/csp-violations', express.json({ type: 'application/csp-report' }), (req, res) => {
  logger.warn('CSP violation', req.body)
  res.status(204).end()
})
```

##### 4.3.3 Audit Dependencies

```bash
# Check vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Review manual fixes needed
npm audit --production
```

##### 4.3.4 Review Input Sanitization

Verify all user inputs are sanitized:
```javascript
// server/middleware/inputSanitization.js - verify this is applied everywhere
const sanitize = require('mongo-sanitize')
const validator = require('validator')

const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitize(req.body)

    // Additional sanitization for specific fields
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key])
      }
    })
  }

  // Sanitize query
  if (req.query) {
    req.query = sanitize(req.query)
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitize(req.params)
  }

  next()
}
```

**Success Criteria:**
- ✅ CSRF protection enabled
- ✅ Security headers configured
- ✅ No high/critical vulnerabilities
- ✅ All inputs sanitized
- ✅ CSP violations monitored

---

#### Task 4.4: Performance Monitoring
**Priority:** 🟡 MEDIUM
**Time Estimate:** 6 hours

**Add performance tracking:**

```javascript
// server/middleware/metrics.js
const responseTime = require('response-time')
const logger = require('../utils/logger')

// Track response times
app.use(responseTime((req, res, time) => {
  logger.info('Request completed', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: time,
    userAgent: req.get('user-agent')
  })

  // Alert on slow requests
  if (time > 1000) {
    logger.warn('Slow request detected', {
      method: req.method,
      path: req.path,
      duration: time
    })
  }

  // Track in Dynatrace (already integrated)
  if (process.env.DYNATRACE_ENABLED === 'true') {
    dynatraceService.trackMetric('response_time', time, {
      method: req.method,
      path: req.path,
      status: res.statusCode
    })
  }
}))
```

**Add database query monitoring:**

```javascript
// server/prisma-singleton.js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' }
  ]
})

// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 500) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params
    })
  }
})
```

**Add metrics endpoint:**

```javascript
// server/routes/metrics.js
const express = require('express')
const router = express.Router()
const { requireAdmin } = require('../middleware/auth')

let metrics = {
  requests: 0,
  errors: 0,
  slowRequests: 0,
  errorsByEndpoint: new Map(),
  requestsByEndpoint: new Map()
}

// Middleware to track metrics
const trackMetrics = (req, res, next) => {
  metrics.requests++

  const endpoint = `${req.method} ${req.path}`
  metrics.requestsByEndpoint.set(
    endpoint,
    (metrics.requestsByEndpoint.get(endpoint) || 0) + 1
  )

  next()
}

// Expose metrics (admin only)
router.get('/metrics', requireAdmin, (req, res) => {
  res.json({
    ...metrics,
    errorsByEndpoint: Object.fromEntries(metrics.errorsByEndpoint),
    requestsByEndpoint: Object.fromEntries(metrics.requestsByEndpoint),
    timestamp: new Date().toISOString()
  })
})

module.exports = { router, trackMetrics }
```

**Success Criteria:**
- ✅ Response times tracked
- ✅ Slow queries logged
- ✅ Metrics exposed for monitoring
- ✅ Integration with Dynatrace

---

#### Task 4.5: Documentation
**Priority:** 🟡 MEDIUM
**Time Estimate:** 12 hours

**Create comprehensive documentation:**

##### 4.5.1 API_REFERENCE.md

Document all 86 endpoints:

```markdown
# API Reference

## Authentication

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "cardcollector" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "user_id": "1",
    "email": "user@example.com",
    "username": "cardcollector"
  }
}
```

**Status Codes:**
- 201: Successfully created
- 400: Validation error
- 409: Email already exists
- 500: Server error

---

### POST /api/auth/login
Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "1",
    "email": "user@example.com",
    "username": "cardcollector",
    "role": "user",
    "is_verified": true
  }
}
```

**Status Codes:**
- 200: Success
- 400: Invalid credentials
- 403: Account locked
- 404: User not found

<!-- Continue for all 86 endpoints... -->
```

##### 4.5.2 ARCHITECTURE.md

```markdown
# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React)                       │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │   Pages   │  │ Components│  │  Contexts/Hooks  │   │
│  └───────────┘  └───────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                    HTTPS / REST API
                          │
┌─────────────────────────────────────────────────────────┐
│                  Server (Express.js)                     │
│  ┌─────────┐  ┌───────────┐  ┌────────────────────┐   │
│  │  Routes │  │Middleware │  │  Services/Utils     │   │
│  └─────────┘  └───────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                    Prisma ORM
                          │
┌─────────────────────────────────────────────────────────┐
│              SQL Server 2022 (Docker)                    │
│  793,740 cards • 6,965 players • 135 teams              │
└─────────────────────────────────────────────────────────┘

External Services:
- Azure Blob Storage (Card photos)
- Azure Communication Services (Email)
- eBay API (Purchase detection)
- Dynatrace (Monitoring)
```

## Key Technologies

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Vite** - Build tool
- **Axios** - HTTP client
- **Lucide React** - Icons

### Backend
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **bcrypt** - Password hashing
- **jsonwebtoken** - Authentication
- **helmet** - Security headers
- **express-validator** - Input validation
- **winston** - Logging

### Database
- **SQL Server 2022** - Primary database
- Docker container for local development
- Azure SQL Database in production

### Infrastructure
- **Azure App Service** - Hosting
- **Azure Blob Storage** - File storage
- **Azure Communication Services** - Email
- **GitHub Actions** - CI/CD
- **Dynatrace** - APM monitoring

## Data Flow

### User Registration Flow
```
User → Client → POST /api/auth/register → Server
  → Validate input
  → Hash password
  → Create user in database
  → Generate verification token
  → Send verification email (Azure)
  → Return success response
```

### Card Search Flow
```
User → Client → GET /api/search/cards?q=trout → Server
  → Validate query
  → Build SQL query with Prisma
  → Execute database query
  → Format results (serialize BigInt)
  → Return cards
  → Client displays results
```

<!-- Continue with more flows... -->
```

##### 4.5.3 CONTRIBUTING.md

```markdown
# Contributing to CollectYourCards.com

## Development Setup

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### Local Setup

1. Clone repository:
```bash
git clone https://github.com/yourusername/collectyourcards.com.git
cd collectyourcards.com
```

2. Start database:
```bash
docker start collect-cards-db
# OR if not exists
docker run -d --name collect-cards-db \
  -e "ACCEPT_EULA=Y" \
  -e "SA_PASSWORD=Password123" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

3. Install dependencies:
```bash
npm install
cd client && npm install && cd ..
```

4. Setup environment:
```bash
cp .env.example .env
# Edit .env with your values
```

5. Run migrations:
```bash
npx prisma migrate dev
```

6. Start development servers:
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

## Coding Standards

### JavaScript/React
- Use functional components with hooks
- Use `const` over `let`, never `var`
- Follow ESLint rules
- Write descriptive variable names
- Comment complex logic

### File Naming
- Components: PascalCase (e.g., `CardDetail.jsx`)
- Utilities: camelCase (e.g., `logger.js`)
- CSS: Match component (e.g., `CardDetail.css`)

### Git Workflow
1. Create feature branch: `git checkout -b feature/description`
2. Make changes
3. Write tests
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit with descriptive message
7. Push and create PR
8. Wait for CI/CD checks
9. Request review

### Testing Requirements
- All new features must have tests
- Maintain 70%+ coverage
- Test happy path and error cases
- Integration tests for critical flows

### Code Review Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] No console.logs
- [ ] BigInt fields serialized
- [ ] SQL queries parameterized
- [ ] Error handling present
- [ ] Responsive on mobile
- [ ] Documented if complex

## Never Do
- ❌ Use JavaScript alerts (use toasts)
- ❌ Commit .env file
- ❌ Delete database without permission
- ❌ Show database IDs to users
- ❌ Use manual pagination (use infinite scroll)
- ❌ Write clever/complex code (keep it simple)

## Questions?
See CLAUDE.md for detailed standards and conventions.
```

##### 4.5.4 TROUBLESHOOTING.md

```markdown
# Troubleshooting Guide

## Common Issues

### Database Connection Failed

**Symptom:** Cannot connect to SQL Server

**Solutions:**
1. Verify container is running:
   ```bash
   docker ps | grep collect-cards-db
   ```

2. Check port 1433 is available:
   ```bash
   lsof -i :1433
   ```

3. Verify credentials in .env:
   ```
   DATABASE_URL="sqlserver://localhost:1433;database=CollectYourCards;user=sa;password=Password123;..."
   ```

4. Restart container:
   ```bash
   docker restart collect-cards-db
   ```

---

### Tests Failing with "Cannot convert BigInt to JSON"

**Symptom:** Tests fail with BigInt serialization error

**Solution:** Ensure all BigInt fields are converted before JSON response:
```javascript
// ❌ Wrong
res.json({ card_id: row.card_id })

// ✅ Correct
res.json({ card_id: Number(row.card_id) })
```

---

### Bundle Size Warnings

**Symptom:** Vite warns about chunks exceeding 500KB

**Solutions:**
1. Implement code splitting (see Task 1.5)
2. Check for large dependencies:
   ```bash
   npx vite-bundle-visualizer
   ```
3. Use dynamic imports for large features

---

### Import Not Matching Cards

**Symptom:** Spreadsheet import shows 0 matches

**Solutions:**
1. Verify Excel format matches template
2. Check card numbers are correct format
3. Ensure series/set names match database
4. Check for typos in player names
5. Review import logs for specific errors

---

### Photos Not Uploading

**Symptom:** Photo upload fails with 500 error

**Solutions:**
1. Verify Azure Blob Storage credentials in .env
2. Check file size (max 10MB)
3. Verify file type (JPG, PNG only)
4. Check Azure storage account access
5. Review server logs for specific error

---

### Email Not Sending

**Symptom:** Verification emails not received

**Solutions:**
1. Check spam folder
2. Verify Azure Communication Services in .env
3. Check email service logs
4. Verify sender domain configured in Azure
5. Test with different email provider

---

### Slow Page Load

**Symptom:** Pages take >3 seconds to load

**Solutions:**
1. Check network tab for large requests
2. Enable code splitting
3. Implement virtual scrolling for large lists
4. Add database indexes
5. Enable response compression
6. Check for N+1 query problems

---

### Mobile Display Issues

**Symptom:** Horizontal scrolling or overlapping elements

**Solutions:**
1. Test at actual breakpoint (320px, 768px, etc.)
2. Check for fixed width elements
3. Use `max-width: 100%` for images
4. Ensure grid uses `auto-fit` or `auto-fill`
5. Add viewport meta tag
6. Test on real device

## Getting Help

1. Check CLAUDE.md for standards
2. Search GitHub issues
3. Check API_REFERENCE.md for endpoint docs
4. Review ARCHITECTURE.md for system design
5. Create GitHub issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details
```

**Success Criteria:**
- ✅ API_REFERENCE.md complete
- ✅ ARCHITECTURE.md with diagrams
- ✅ CONTRIBUTING.md for developers
- ✅ TROUBLESHOOTING.md for common issues
- ✅ All docs up to date

---

## Success Metrics

### Phase 0 (Week 1, Days 1-2)
- [ ] .env security verified
- [ ] SQL injection eliminated
- [ ] Dependencies updated

### Phase 1 (Week 1-2)
- [ ] ESLint working
- [ ] Test coverage: 30%
- [ ] Bundle size: <650KB (30% reduction)
- [ ] Console.logs: <300 (50% reduction)
- [ ] Database indexes added

### Phase 2 (Week 3-4)
- [ ] Test coverage: 50%
- [ ] Import system: 70% coverage
- [ ] Large files refactored (<500 lines each)
- [ ] Virtual scrolling implemented

### Phase 3 (Week 5-6)
- [ ] Test coverage: 70%
- [ ] CSS bundle: <200KB
- [ ] Mobile navigation complete
- [ ] All pages responsive
- [ ] Request caching implemented

### Phase 4 (Week 7-8)
- [ ] Frontend tests: 50%+
- [ ] E2E tests passing
- [ ] CSRF protection enabled
- [ ] Security audit complete
- [ ] Documentation complete

### Final Metrics
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Test Coverage | 10.74% | 70% | 🎯 |
| Bundle Size (JS) | 926 KB | <500 KB | 🎯 |
| Bundle Size (CSS) | 656 KB | <200 KB | 🎯 |
| Console Logs | 653 | <50 | 🎯 |
| Route Files >500 lines | 8 | 0 | 🎯 |
| Security Score | B+ | A | 🎯 |
| Mobile Score | F | A | 🎯 |
| Health Score | 58/100 | 85/100 | 🎯 |

---

## Timeline Summary

| Week | Phase | Key Deliverables |
|------|-------|------------------|
| 1 | 0 & 1 | Security fixes, ESLint, code splitting, 30% test coverage |
| 2 | 1 | Database indexes, console logs cleanup, user card tests |
| 3 | 2 | Import system tests, eBay tests, start refactoring |
| 4 | 2 | Complete refactoring, virtual scrolling, 50% coverage |
| 5 | 3 | Email/photo/admin tests, CSS optimization |
| 6 | 3 | Mobile navigation, responsive design, 70% coverage |
| 7 | 4 | Frontend tests, E2E tests, performance monitoring |
| 8 | 4 | Security hardening, documentation, final polish |

---

## Risk Mitigation

### High Risk Tasks
1. **Refactoring large files** - Risk of breaking functionality
   - Mitigation: Write comprehensive tests first, refactor incrementally

2. **SQL injection fixes** - Risk of breaking queries
   - Mitigation: Thorough testing, gradual rollout

3. **Bundle size optimization** - Risk of breaking imports
   - Mitigation: Test all routes, monitor build output

### Dependencies
- Database must remain stable throughout
- .env security fix blocks other security work
- Test coverage required before refactoring
- Frontend tests require backend stability

### Contingencies
- If timeline slips, prioritize security and test coverage
- If breaking changes occur, rollback capability required
- If tests reveal critical bugs, fix before continuing
- If bundle size reduction insufficient, consider additional tools

---

## Maintenance Plan (Post-Implementation)

### Ongoing Tasks
1. **Monitor test coverage** - Maintain 70%+ on all new code
2. **Review security weekly** - Check for new vulnerabilities
3. **Track performance** - Monitor metrics dashboard
4. **Update documentation** - Keep current with code changes
5. **Dependency updates** - Monthly npm audit and updates

### Quality Gates
- All PRs must:
  - Pass ESLint
  - Pass all tests
  - Maintain coverage
  - Pass security scan
  - Be reviewed by 1+ developer
  - Document any breaking changes

### Continuous Improvement
- Review metrics quarterly
- Identify new bottlenecks
- Plan optimization sprints
- Gather user feedback
- Update roadmap

---

## Conclusion

This plan addresses all critical issues identified in the Copilot assessment:
- ✅ Security vulnerabilities (Phase 0)
- ✅ Test coverage 10% → 70% (Phases 1-3)
- ✅ Performance optimization (Phases 1-3)
- ✅ Code quality improvements (Phases 2-4)
- ✅ Mobile optimization (Phase 3)
- ✅ Documentation (Phase 4)

**Expected Outcome:** Health score improvement from 58/100 to 85/100 in 8 weeks.

The foundation is solid - this plan transforms it into a production-ready, scalable, well-tested platform.

---

*Plan Created By: Claude (Anthropic)*
*Date: October 28, 2025*
*Based On: COPILOT_ASSESSMENT.md*
*Timeline: 8-week sprint*
*Target: 85/100 health score*
