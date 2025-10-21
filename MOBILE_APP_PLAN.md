# CollectYourCards Mobile App - Complete Development Plan

**Last Updated:** January 2025
**Status:** Planning Phase
**Target Platforms:** iOS (App Store) & Android (Google Play)
**Estimated Timeline:** 12 weeks to submission

---

## Table of Contents

1. [Technology Decision: React Native](#1-technology-decision-react-native)
2. [Repository Architecture](#2-repository-architecture)
3. [Mobile UI/UX Strategy](#3-mobile-uiux-strategy)
4. [API Integration](#4-api-integration)
5. [Offline & Sync Architecture](#5-offline--sync-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Development Roadmap](#7-development-roadmap)
8. [App Store Requirements](#8-app-store-requirements)
9. [Budget & Resources](#9-budget--resources)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Technology Decision: React Native

### ✅ RECOMMENDED: React Native with Expo

**Why NOT Pure Native (Swift/Kotlin)?**
- **0% code sharing** between iOS and Android = 3× development cost
- Requires specialized iOS and Android developers
- Slower iteration and feature parity issues
- Longer time to market

**Why React Native?**

| Criterion | React Native | Pure Native |
|-----------|--------------|-------------|
| Code Sharing | 80-90% | 0% |
| Development Speed | Fast | Slow |
| Team Expertise | ✅ React devs ready | ❌ Need new hires |
| App Store Ready | ✅ Yes | ✅ Yes |
| Performance | Excellent for CRUD | Excellent |
| Maintenance Cost | 1× codebase | 3× codebases |
| Time to Market | 12 weeks | 30+ weeks |

**Key Advantages for Your Use Case:**
- Your app is primarily **CRUD operations** (CollectYourCards excels at this)
- Your team already knows **React** (instant productivity)
- Share business logic with web app (authentication, validation, formatting)
- App Store compliant (React Native apps are indistinguishable from native)
- **Expo** simplifies build process, OTA updates, and deployment

**Trade-offs (Minor for Your Use Case):**
- Slightly larger app size (~40MB vs ~20MB) - negligible on modern devices
- Rare edge cases require native modules - extensive library ecosystem available

**Verdict:** React Native is the optimal choice for CollectYourCards mobile apps.

---

## 2. Repository Architecture

### Monorepo Structure (Recommended)

```
collectyourcards.com/
├── .github/
│   └── workflows/
│       ├── web-ci.yml
│       ├── mobile-ios.yml
│       └── mobile-android.yml
│
├── client/                      # EXISTING - Web React App
│   ├── src/
│   └── package.json
│
├── server/                      # EXISTING - Express API
│   ├── routes/
│   ├── middleware/
│   └── package.json
│
├── mobile/                      # NEW - React Native App
│   ├── app/                     # Expo Router (file-based routing)
│   │   ├── (auth)/             # Auth stack
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/             # Main app tabs
│   │   │   ├── collection.tsx
│   │   │   ├── search.tsx
│   │   │   ├── add.tsx
│   │   │   └── profile.tsx
│   │   ├── card/
│   │   │   └── [id].tsx        # Card detail (dynamic route)
│   │   └── _layout.tsx
│   │
│   ├── components/              # Reusable UI components
│   │   ├── cards/
│   │   │   ├── CardGridItem.tsx
│   │   │   ├── CardListItem.tsx
│   │   │   └── CardDetailView.tsx
│   │   ├── forms/
│   │   │   ├── CardForm.tsx
│   │   │   └── SearchBar.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── services/                # Business logic
│   │   ├── api.ts              # API client (axios)
│   │   ├── database.ts         # SQLite wrapper
│   │   ├── sync.ts             # Sync engine
│   │   ├── storage.ts          # AsyncStorage wrapper
│   │   └── images.ts           # Image caching
│   │
│   ├── store/                   # State management
│   │   ├── authStore.ts        # User auth state
│   │   ├── collectionStore.ts  # Collection data
│   │   └── syncStore.ts        # Sync status
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useCollection.ts
│   │   ├── useSync.ts
│   │   └── useOffline.ts
│   │
│   ├── constants/
│   │   ├── config.ts           # App configuration
│   │   └── theme.ts            # Colors, spacing, typography
│   │
│   ├── types/                   # TypeScript types
│   │   ├── card.ts
│   │   ├── user.ts
│   │   └── api.ts
│   │
│   ├── assets/
│   │   ├── icon.png            # App icon (1024x1024)
│   │   ├── splash.png          # Splash screen
│   │   └── adaptive-icon.png   # Android adaptive icon
│   │
│   ├── ios/                     # iOS native code (auto-generated)
│   ├── android/                 # Android native code (auto-generated)
│   ├── app.json                 # Expo config
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                      # NEW - Code shared between web & mobile
│   ├── utils/
│   │   ├── formatters.ts       # Date, currency, card number formatting
│   │   ├── validators.ts       # Input validation
│   │   └── constants.ts        # API endpoints, error messages
│   ├── types/
│   │   ├── card.ts             # Card type definitions
│   │   ├── user.ts             # User type definitions
│   │   └── api.ts              # API response types
│   └── package.json
│
├── docs/
│   └── MOBILE_APP_PLAN.md      # This document
│
└── package.json                 # Root package.json (monorepo scripts)
```

### Monorepo Benefits

1. **Code Sharing:** Utilities, types, and constants used by both web and mobile
2. **Single CI/CD:** One pipeline for all platforms
3. **Consistent Versioning:** Single source of truth
4. **Easier Code Review:** All changes in one PR
5. **Dependency Management:** Shared packages managed centrally

### Root package.json Scripts

```json
{
  "scripts": {
    "web:dev": "cd client && npm run dev",
    "mobile:dev": "cd mobile && npm start",
    "mobile:ios": "cd mobile && npm run ios",
    "mobile:android": "cd mobile && npm run android",
    "server:dev": "cd server && npm run dev",
    "install:all": "npm install && cd client && npm install && cd ../mobile && npm install && cd ../server && npm install",
    "build:web": "cd client && npm run build",
    "build:mobile:ios": "cd mobile && eas build --platform ios",
    "build:mobile:android": "cd mobile && eas build --platform android"
  }
}
```

---

## 3. Mobile UI/UX Strategy

### The Table Display Challenge

**Problem:** CollectionTable has 18+ columns:
- Edit, Favorite, Code, Card #, Player, Series, Serial #, Color, Photos, Auto, Relic, Purchase $, Estimated $, Current $, Location, Added, Grade, AM Auto, Notes, Production Code, Delete

**Solution:** Mobile-first component architecture with multiple view modes

### View Modes

#### A. Card Grid View (Primary - Pinterest Style)

**Best For:** Browsing collection, visual discovery
**Screen Layout:**
```
┌─────────────────────────────────┐
│ 🏠 Collection      🔍 ⚙️        │  Header (sticky)
├─────────────────────────────────┤
│ ┌────────┐  ┌────────┐         │
│ │ [IMG]  │  │ [IMG]  │         │  2-col grid (phone)
│ │        │  │        │         │  3-col grid (tablet)
│ │ M.Trout│  │ R.Acuña│         │
│ │ #27 RC │  │ #1 AUTO│         │
│ │ PSA 10 │  │ $275   │         │
│ └────────┘  └────────┘         │
│ ┌────────┐  ┌────────┐         │
│ │ [IMG]  │  │ [IMG]  │         │  Infinite scroll
│ └────────┘  └────────┘         │
└─────────────────────────────────┘
```

**Card Data Shown:**
- Thumbnail image (primary photo)
- Player name (truncated if long)
- Card number + special badges (RC, AUTO, RELIC)
- Price OR grade (user preference)
- Favorite star (if applicable)

**Component:**
```tsx
// mobile/components/cards/CardGridItem.tsx
interface CardGridItemProps {
  card: Card
  onPress: () => void
  onFavorite: () => void
}

export const CardGridItem: React.FC<CardGridItemProps> = ({ card, onPress, onFavorite }) => {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Image source={{ uri: card.thumbnail_url }} style={styles.image} />
      <View style={styles.badges}>
        {card.is_rookie && <Badge>RC</Badge>}
        {card.is_autograph && <Badge color="blue">AUTO</Badge>}
        {card.is_relic && <Badge color="purple">RELIC</Badge>}
      </View>
      <Text style={styles.player}>{card.player_names}</Text>
      <Text style={styles.cardNumber}>#{card.card_number}</Text>
      <Text style={styles.price}>{formatCurrency(card.purchase_price)}</Text>
      <Pressable onPress={onFavorite} style={styles.favorite}>
        <Icon name={card.is_special ? 'star' : 'star-outline'} />
      </Pressable>
    </Pressable>
  )
}
```

#### B. Compact List View (Alternative)

**Best For:** Scanning, searching for specific cards
**Screen Layout:**
```
┌─────────────────────────────────┐
│ [IMG] Mike Trout #27 RC    $450 │  ← Swipe actions
│       2011 Topps Update • PSA10 │
├─────────────────────────────────┤
│ [IMG] Ronald Acuña Jr. #1  $275 │
│       2018 Bowman Chrome • BGS9 │
└─────────────────────────────────┘
```

**Swipe Actions:**
- Swipe left: Delete, Edit
- Swipe right: Favorite

**Component:**
```tsx
// mobile/components/cards/CardListItem.tsx
<Swipeable
  renderLeftActions={renderFavoriteAction}
  renderRightActions={renderDeleteAction}
>
  <View style={styles.row}>
    <Image source={{ uri: card.thumbnail_url }} style={styles.thumbnail} />
    <View style={styles.content}>
      <Text style={styles.title}>
        {card.player_names} #{card.card_number} {badges}
      </Text>
      <Text style={styles.subtitle}>
        {card.series_name} • {card.grade}
      </Text>
    </View>
    <Text style={styles.price}>{formatCurrency(card.purchase_price)}</Text>
  </View>
</Swipeable>
```

#### C. Card Detail View (Full Screen)

**Best For:** Viewing all data, editing, photos
**Screen Layout:**
```
┌─────────────────────────────────┐
│ ← Back                    ⋮     │  Header
├─────────────────────────────────┤
│                                 │
│     [LARGE CARD IMAGE]          │  Pinch to zoom
│        (Swipe for photos)       │  Swipe gallery
│                                 │
├─────────────────────────────────┤
│ ⭐ Favorite  ✏️ Edit  🗑️ Delete  │  Action buttons
├─────────────────────────────────┤
│ Info | Pricing | Photos | More │  Tabs (swipeable)
├─────────────────────────────────┤
│                                 │
│ Player:      Mike Trout         │
│ Card #:      27                 │  Scrollable content
│ Series:      2011 Topps Update  │
│ Serial #:    45/99              │
│ Color:       Red                │
│ Grade:       PSA 10             │
│ Location:    Office - Box A     │
│ Added:       01/15/2024         │
│ Notes:       Purchased eBay...  │
│                                 │
└─────────────────────────────────┘
```

**Tabbed Content:**
- **Info:** Card details, player, series
- **Pricing:** Purchase price, estimated value, current value, price history
- **Photos:** Image gallery with upload
- **More:** Comments, activity log, sharing

#### D. Bottom Sheet (For Quick Stats)

**Best For:** Collection stats, filters
**Implementation:**
```tsx
import BottomSheet from '@gorhom/bottom-sheet'

<BottomSheet snapPoints={['25%', '50%', '90%']}>
  <View>
    <Text>Collection Stats</Text>
    <Text>Total Cards: {collection.length}</Text>
    <Text>Total Value: {formatCurrency(totalValue)}</Text>
  </View>
</BottomSheet>
```

### Navigation Structure

**Bottom Tab Navigator:**
```
┌─────────────────────────────────┐
│                                 │
│        Screen Content           │
│                                 │
├─────────────────────────────────┤
│  🏠      🔍      ➕      👤     │  Bottom tabs (always visible)
│  Home   Search   Add   Profile  │
└─────────────────────────────────┘
```

**Tab Screens:**
1. **Collection** (`collection.tsx`)
   - View modes: Grid/List toggle
   - Sort: Date added, Player name, Value
   - Filter: RC, Auto, Relic, Grade, Location
   - Search bar (sticky)

2. **Search** (`search.tsx`)
   - Global search across ALL cards in database
   - Advanced filters
   - Recent searches

3. **Add** (`add.tsx`)
   - Quick add (scan barcode)
   - Manual entry form
   - Import from photo (OCR future feature)

4. **Profile** (`profile.tsx`)
   - User info
   - Collection stats
   - Settings
   - Sync status

### Mobile-Specific UI Components

**1. Pull to Refresh**
```tsx
<ScrollView
  refreshControl={
    <RefreshControl refreshing={syncing} onRefresh={handleSync} />
  }
>
  {cards.map(card => <CardGridItem key={card.card_id} card={card} />)}
</ScrollView>
```

**2. Infinite Scroll**
```tsx
<FlatList
  data={cards}
  renderItem={({ item }) => <CardGridItem card={item} />}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={isLoading ? <LoadingSpinner /> : null}
/>
```

**3. Search with Debounce**
```tsx
const [searchQuery, setSearchQuery] = useState('')
const debouncedSearch = useDebounce(searchQuery, 300)

useEffect(() => {
  if (debouncedSearch) {
    searchCards(debouncedSearch)
  }
}, [debouncedSearch])
```

**4. Offline Indicator**
```tsx
import NetInfo from '@react-native-community/netinfo'

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected)
    })
    return unsubscribe
  }, [])

  if (!isOffline) return null

  return (
    <View style={styles.banner}>
      <Text>✈️ Offline Mode - Changes will sync when online</Text>
    </View>
  )
}
```

---

## 4. API Integration

### Strategy: Reuse Existing APIs

**Your current API is 95% mobile-ready:**
- ✅ RESTful architecture
- ✅ JWT authentication
- ✅ JSON responses
- ✅ Rate limiting
- ✅ Error handling
- ✅ CORS configured

### Required API Enhancements

#### A. Mobile-Optimized Collection Endpoint (Optional)

**Problem:** Current `/api/collection` returns ALL cards with full JOINs (slow on mobile)

**Solution:** Add paginated, lightweight endpoint

```javascript
// server/routes/mobile.js (NEW FILE)
const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')

// Lightweight collection for mobile grid view
router.get('/collection/mobile', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, sort = 'date_added', order = 'desc' } = req.query
    const userId = BigInt(req.user.userId)
    const offset = (page - 1) * limit

    const cards = await prisma.$queryRaw`
      SELECT
        uc.user_card_id,
        uc.card,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        uc.purchase_price,
        uc.is_special,
        uc.serial_number,
        uc.grade,
        -- Concatenated player names
        (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
         FROM card_player_team cpt
         JOIN player_team pt ON cpt.player_team = pt.player_team_id
         JOIN player p ON pt.player = p.player_id
         WHERE cpt.card = c.card_id) AS player_names,
        -- Series name
        s.name AS series_name,
        -- Thumbnail URL (if exists)
        (SELECT TOP 1 ucp.image_url
         FROM user_card_photo ucp
         WHERE ucp.user_card = uc.user_card_id
         ORDER BY ucp.is_primary DESC) AS thumbnail_url
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      WHERE uc.user = ${userId}
        AND uc.is_active = 1
      ORDER BY ${sort} ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    // Serialize BigInt fields
    const serialized = cards.map(card => ({
      user_card_id: Number(card.user_card_id),
      card_id: Number(card.card),
      card_number: card.card_number,
      player_names: card.player_names,
      series_name: card.series_name,
      is_rookie: Boolean(card.is_rookie),
      is_autograph: Boolean(card.is_autograph),
      is_relic: Boolean(card.is_relic),
      is_special: Boolean(card.is_special),
      purchase_price: card.purchase_price ? Number(card.purchase_price).toFixed(2) : null,
      serial_number: card.serial_number,
      grade: card.grade,
      thumbnail_url: card.thumbnail_url
    }))

    res.json({
      success: true,
      cards: serialized,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore: cards.length === Number(limit)
      }
    })
  } catch (error) {
    console.error('Mobile collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch collection' })
  }
})

module.exports = router
```

**Add to server.js:**
```javascript
const mobileRoutes = require('./routes/mobile')
app.use('/api/mobile', mobileRoutes)
```

#### B. Sync Endpoints

**Delta Sync (Changes Since Timestamp):**
```javascript
// Get changes since last sync
router.get('/sync/changes', authMiddleware, async (req, res) => {
  try {
    const { since } = req.query // ISO timestamp
    const userId = BigInt(req.user.userId)
    const sinceDate = new Date(since)

    const changes = await prisma.$queryRaw`
      SELECT
        uc.user_card_id,
        uc.card,
        uc.date_added,
        uc.date_modified,
        uc.is_active,
        -- All other fields
      FROM user_card uc
      WHERE uc.user = ${userId}
        AND (uc.date_modified > ${sinceDate} OR uc.date_added > ${sinceDate})
    `

    res.json({
      success: true,
      changes: changes.map(serializeCard),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Batch upload changes from mobile
router.post('/sync/batch', authMiddleware, async (req, res) => {
  try {
    const { changes } = req.body // Array of { action, entity, data }
    const userId = BigInt(req.user.userId)
    const results = []

    for (const change of changes) {
      if (change.action === 'CREATE') {
        // Insert new card
      } else if (change.action === 'UPDATE') {
        // Update existing card
      } else if (change.action === 'DELETE') {
        // Soft delete card
      }
      results.push({ id: change.id, status: 'success' })
    }

    res.json({ success: true, results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

### API Client (Mobile)

```typescript
// mobile/services/api.ts
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { queueOfflineRequest } from './sync'

const api = axios.create({
  baseURL: __DEV__
    ? 'http://localhost:5174/api'  // Development
    : 'https://collectyourcards.com/api',  // Production
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Add JWT token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - Handle errors, offline, token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    // Network error - queue for later
    if (error.code === 'ECONNABORTED' || !error.response) {
      const netInfo = await NetInfo.fetch()
      if (!netInfo.isConnected) {
        await queueOfflineRequest(error.config)
        throw new Error('Request queued - offline mode')
      }
    }

    // Unauthorized - token expired
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken')
      // Navigate to login
    }

    throw error
  }
)

// API methods
export const collectionApi = {
  getCards: (page = 1, limit = 50) =>
    api.get('/mobile/collection/mobile', { params: { page, limit } }),

  getCardDetail: (cardId: number) =>
    api.get(`/user-cards/${cardId}`),

  createCard: (cardData: CardInput) =>
    api.post('/user-cards', cardData),

  updateCard: (cardId: number, cardData: Partial<CardInput>) =>
    api.put(`/user-cards/${cardId}`, cardData),

  deleteCard: (cardId: number) =>
    api.delete(`/user-cards/${cardId}`)
}

export const syncApi = {
  getChanges: (since: string) =>
    api.get('/sync/changes', { params: { since } }),

  uploadBatch: (changes: SyncChange[]) =>
    api.post('/sync/batch', { changes })
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (userData: RegisterInput) =>
    api.post('/auth/register', userData),

  getProfile: () =>
    api.get('/auth/profile')
}

export default api
```

---

## 5. Offline & Sync Architecture

### Strategy: Offline-First with Optimistic UI

**Core Principles:**
1. All data stored locally in SQLite
2. App works fully offline
3. Changes sync automatically when online
4. Optimistic updates (instant UI feedback)
5. Conflict resolution on sync

### A. Local Database (SQLite)

**Schema Design:**
```sql
-- mobile/services/schema.sql

-- Cards table (mirrors server user_card)
CREATE TABLE cards (
  user_card_id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL,
  card_number TEXT,
  player_names TEXT,           -- Denormalized for performance
  series_name TEXT,             -- Denormalized
  is_rookie INTEGER DEFAULT 0,
  is_autograph INTEGER DEFAULT 0,
  is_relic INTEGER DEFAULT 0,
  is_special INTEGER DEFAULT 0,
  purchase_price REAL,
  estimated_value REAL,
  current_value REAL,
  serial_number TEXT,
  grade TEXT,
  grading_agency TEXT,
  location TEXT,
  notes TEXT,
  thumbnail_url TEXT,
  date_added TEXT,              -- ISO string
  date_modified TEXT,           -- ISO string
  server_updated_at TEXT,       -- For conflict detection
  synced INTEGER DEFAULT 1,     -- 1 = synced, 0 = pending
  deleted INTEGER DEFAULT 0     -- Soft delete flag
);

CREATE INDEX idx_cards_synced ON cards(synced);
CREATE INDEX idx_cards_deleted ON cards(deleted);
CREATE INDEX idx_cards_player ON cards(player_names);

-- Photos table
CREATE TABLE photos (
  photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_card_id INTEGER,
  image_url TEXT,
  local_path TEXT,              -- Cached file path
  is_primary INTEGER DEFAULT 0,
  uploaded INTEGER DEFAULT 0,   -- 0 = pending upload
  FOREIGN KEY (user_card_id) REFERENCES cards(user_card_id)
);

-- Sync queue (operations to perform when online)
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,         -- 'CREATE', 'UPDATE', 'DELETE'
  entity TEXT NOT NULL,         -- 'card', 'photo'
  entity_id INTEGER,
  data TEXT,                    -- JSON payload
  created_at TEXT,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(retry_count);

-- Sync metadata
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Store last_sync_time, user_id, etc.
INSERT INTO sync_metadata (key, value) VALUES ('last_sync_time', NULL);
INSERT INTO sync_metadata (key, value) VALUES ('user_id', NULL);
```

**Database Wrapper:**
```typescript
// mobile/services/database.ts
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabase('collectyourcards.db')

export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      // Create tables (use schema.sql content)
      tx.executeSql(/* CREATE TABLE cards ... */);
      tx.executeSql(/* CREATE TABLE photos ... */);
      tx.executeSql(/* CREATE TABLE sync_queue ... */);
      tx.executeSql(/* CREATE TABLE sync_metadata ... */);
    }, reject, resolve)
  })
}

export const cardQueries = {
  // Get all cards
  getAll: (): Promise<Card[]> => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM cards WHERE deleted = 0 ORDER BY date_added DESC',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  },

  // Get single card
  getById: (id: number): Promise<Card | null> => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM cards WHERE user_card_id = ?',
          [id],
          (_, { rows }) => resolve(rows._array[0] || null),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  },

  // Insert card
  insert: (card: Card): Promise<number> => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO cards (user_card_id, card_id, card_number, player_names, ...)
           VALUES (?, ?, ?, ?, ...)`,
          [card.user_card_id, card.card_id, card.card_number, card.player_names, ...],
          (_, { insertId }) => resolve(insertId),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  },

  // Update card
  update: (id: number, changes: Partial<Card>): Promise<void> => {
    const fields = Object.keys(changes).map(k => `${k} = ?`).join(', ')
    const values = [...Object.values(changes), id]

    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `UPDATE cards SET ${fields}, synced = 0, date_modified = ? WHERE user_card_id = ?`,
          [...values, new Date().toISOString()],
          () => resolve(),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  },

  // Soft delete
  delete: (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'UPDATE cards SET deleted = 1, synced = 0 WHERE user_card_id = ?',
          [id],
          () => resolve(),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  }
}
```

### B. Sync Engine

**Sync Flow:**
```
1. User opens app
2. Check internet connection
3. If online:
   a. Get last_sync_time from metadata
   b. Fetch server changes: GET /api/sync/changes?since={last_sync_time}
   c. Apply server changes to local SQLite
   d. Get pending changes from sync_queue
   e. Upload to server: POST /api/sync/batch
   f. Update last_sync_time
4. If offline:
   - Continue using local data
   - Queue all changes
```

**Implementation:**
```typescript
// mobile/services/sync.ts
import NetInfo from '@react-native-community/netinfo'
import { syncApi } from './api'
import { cardQueries } from './database'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SyncStatus {
  syncing: boolean
  lastSync: Date | null
  pendingChanges: number
  error: string | null
}

class SyncManager {
  private syncing = false
  private listeners: ((status: SyncStatus) => void)[] = []

  async performSync(): Promise<SyncStatus> {
    if (this.syncing) {
      return this.getStatus()
    }

    this.syncing = true
    this.notifyListeners()

    try {
      // Check connectivity
      const netInfo = await NetInfo.fetch()
      if (!netInfo.isConnected) {
        throw new Error('No internet connection')
      }

      // Step 1: Pull changes from server
      await this.pullServerChanges()

      // Step 2: Push local changes to server
      await this.pushLocalChanges()

      // Step 3: Update last sync time
      await this.updateLastSyncTime()

      this.syncing = false
      this.notifyListeners()

      return this.getStatus()
    } catch (error) {
      this.syncing = false
      this.notifyListeners()
      throw error
    }
  }

  private async pullServerChanges() {
    const lastSync = await AsyncStorage.getItem('last_sync_time')
    const since = lastSync || new Date(0).toISOString()

    const response = await syncApi.getChanges(since)
    const { changes } = response.data

    // Apply changes to local database
    for (const change of changes) {
      if (change.deleted) {
        await cardQueries.delete(change.user_card_id)
      } else {
        const existing = await cardQueries.getById(change.user_card_id)
        if (existing) {
          // Check for conflicts
          if (existing.synced === 0 && existing.date_modified > change.date_modified) {
            // Conflict: local is newer - skip (will push local version)
            console.warn('Conflict detected:', change.user_card_id)
          } else {
            // Server is newer - apply
            await cardQueries.update(change.user_card_id, { ...change, synced: 1 })
          }
        } else {
          // New card from server
          await cardQueries.insert({ ...change, synced: 1 })
        }
      }
    }
  }

  private async pushLocalChanges() {
    // Get all unsynced changes
    const unsyncedCards = await this.getUnsyncedCards()

    if (unsyncedCards.length === 0) return

    // Build batch payload
    const changes = unsyncedCards.map(card => ({
      action: card.user_card_id > 1000000 ? 'CREATE' : 'UPDATE', // Temp IDs > 1M
      entity: 'card',
      data: card
    }))

    // Upload to server
    const response = await syncApi.uploadBatch(changes)

    // Mark as synced
    for (const result of response.data.results) {
      if (result.status === 'success') {
        await cardQueries.update(result.id, { synced: 1 })
      }
    }
  }

  private async getUnsyncedCards(): Promise<Card[]> {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM cards WHERE synced = 0',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => { reject(error); return false; }
        )
      })
    })
  }

  private async updateLastSyncTime() {
    const now = new Date().toISOString()
    await AsyncStorage.setItem('last_sync_time', now)
  }

  async getStatus(): Promise<SyncStatus> {
    const lastSync = await AsyncStorage.getItem('last_sync_time')
    const pendingCount = await this.getUnsyncedCards()

    return {
      syncing: this.syncing,
      lastSync: lastSync ? new Date(lastSync) : null,
      pendingChanges: pendingCount.length,
      error: null
    }
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners() {
    const status = this.getStatus()
    this.listeners.forEach(listener => listener(status))
  }
}

export const syncManager = new SyncManager()
```

**Usage in Components:**
```tsx
// mobile/app/(tabs)/collection.tsx
import { syncManager } from '@/services/sync'
import { useEffect, useState } from 'react'

export default function CollectionScreen() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>()

  useEffect(() => {
    // Subscribe to sync status
    const unsubscribe = syncManager.subscribe(setSyncStatus)

    // Perform initial sync
    syncManager.performSync()

    return unsubscribe
  }, [])

  return (
    <View>
      {syncStatus?.syncing && <Text>Syncing...</Text>}
      {syncStatus?.pendingChanges > 0 && (
        <Text>{syncStatus.pendingChanges} changes pending</Text>
      )}
      {/* Collection content */}
    </View>
  )
}
```

### C. Background Sync

**Auto-sync when app comes to foreground:**
```typescript
// mobile/app/_layout.tsx
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { syncManager } from '@/services/sync'

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - sync
        syncManager.performSync().catch(console.error)
      }
    })

    return () => subscription.remove()
  }, [])

  return <Stack />
}
```

### D. Image Caching

**Strategy: Three-tier caching**
```typescript
// mobile/services/images.ts
import * as FileSystem from 'expo-file-system'
import { Image } from 'expo-image'

const CACHE_DIR = FileSystem.cacheDirectory + 'images/'

// Ensure cache directory exists
FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })

export const imageCache = {
  // Get cached image or download
  async getImage(url: string): Promise<string> {
    if (!url) return ''

    const filename = url.split('/').pop() || ''
    const localPath = CACHE_DIR + filename

    // Check if already cached
    const info = await FileSystem.getInfoAsync(localPath)
    if (info.exists) {
      return localPath
    }

    // Download and cache
    try {
      const download = await FileSystem.downloadAsync(url, localPath)
      return download.uri
    } catch (error) {
      console.error('Image download failed:', error)
      return url // Fallback to remote URL
    }
  },

  // Clear cache
  async clearCache() {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
    await FileSystem.makeDirectoryAsync(CACHE_DIR)
  }
}

// Usage in components
<Image
  source={{ uri: await imageCache.getImage(card.thumbnail_url) }}
  placeholder={{ uri: 'data:image/png;base64,iVBORw0KG...' }}  // Blur placeholder
  transition={200}
/>
```

---

## 6. Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "expo": "~50.0.0",
    "expo-router": "~3.4.0",
    "react": "18.2.0",
    "react-native": "0.73.0",

    "axios": "^1.6.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "@react-native-community/netinfo": "^11.2.0",
    "expo-sqlite": "~13.0.0",
    "expo-file-system": "~16.0.0",
    "expo-image": "~1.10.0",
    "expo-image-picker": "~14.7.0",

    "react-navigation": "^6.1.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "@react-navigation/stack": "^6.3.0",

    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.17.0",

    "react-native-paper": "^5.12.0",
    "react-native-reanimated": "~3.6.0",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-safe-area-context": "4.8.0",
    "react-native-screens": "~3.29.0",

    "@gorhom/bottom-sheet": "^4.6.0",
    "react-native-swipe-list-view": "^3.2.9"
  },
  "devDependencies": {
    "@types/react": "~18.2.45",
    "@types/react-native": "~0.73.0",
    "typescript": "^5.3.0"
  }
}
```

### State Management

**Zustand Stores:**
```typescript
// mobile/store/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const response = await authApi.login(email, password)
    const { token, user } = response.data

    await AsyncStorage.setItem('authToken', token)
    set({ user, token, isAuthenticated: true })
  },

  logout: async () => {
    await AsyncStorage.removeItem('authToken')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadUser: async () => {
    const token = await AsyncStorage.getItem('authToken')
    if (token) {
      const response = await authApi.getProfile()
      set({ user: response.data.user, token, isAuthenticated: true })
    }
  }
}))
```

---

## 7. Development Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Week 1: Project Setup**
- [ ] Initialize Expo project: `npx create-expo-app mobile --template blank-typescript`
- [ ] Configure monorepo structure
- [ ] Set up shared utilities folder
- [ ] Install dependencies
- [ ] Configure TypeScript
- [ ] Set up Expo Router (file-based navigation)
- [ ] Create basic app structure (tabs, auth stack)

**Week 2: Authentication**
- [ ] Design login/register screens
- [ ] Implement API client with Zustand
- [ ] JWT token storage (AsyncStorage)
- [ ] Auth state management
- [ ] Protected routes
- [ ] Error handling & validation

**Deliverable:** Working authentication flow

---

### Phase 2: Core Features (Weeks 3-5)

**Week 3: Collection View**
- [ ] SQLite database setup
- [ ] Card grid component
- [ ] Card list component (alternative view)
- [ ] View toggle (grid/list)
- [ ] Pull to refresh
- [ ] Infinite scroll
- [ ] Loading states

**Week 4: Card Detail & Search**
- [ ] Card detail screen (full data)
- [ ] Image gallery (swipe)
- [ ] Tabbed sections (info, pricing, photos)
- [ ] Search functionality
- [ ] Filter UI (bottom sheet)
- [ ] Sort options

**Week 5: Card Management**
- [ ] Add card form
- [ ] Edit card form
- [ ] Delete card (with confirmation)
- [ ] Favorite toggle
- [ ] Form validation
- [ ] Optimistic updates

**Deliverable:** Core CRUD operations working

---

### Phase 3: Offline & Sync (Weeks 6-7)

**Week 6: Offline Support**
- [ ] SQLite schema implementation
- [ ] Offline CRUD operations
- [ ] Sync queue system
- [ ] Offline indicator UI
- [ ] Pending changes display

**Week 7: Sync Engine**
- [ ] Pull server changes (delta sync)
- [ ] Push local changes (batch upload)
- [ ] Conflict resolution
- [ ] Background sync
- [ ] Sync status UI
- [ ] Error handling & retry logic

**Deliverable:** Full offline capability with sync

---

### Phase 4: Enhanced Features (Weeks 8-10)

**Week 8: Images**
- [ ] Image picker (camera/library)
- [ ] Image upload
- [ ] Image caching (FileSystem)
- [ ] Image gallery
- [ ] Photo management (delete, set primary)
- [ ] Thumbnail generation

**Week 9: Social & Notifications**
- [ ] Push notification setup (Expo Notifications)
- [ ] Comment system
- [ ] Notification preferences
- [ ] Achievement badges
- [ ] Share functionality

**Week 10: Profile & Settings**
- [ ] User profile screen
- [ ] Collection stats
- [ ] Settings (sync preferences, cache management)
- [ ] About screen
- [ ] Logout

**Deliverable:** Feature-complete app

---

### Phase 5: Polish & Launch (Weeks 11-12)

**Week 11: Testing & Optimization**
- [ ] Performance profiling
- [ ] Memory leak detection
- [ ] Bundle size optimization
- [ ] Image optimization
- [ ] Accessibility (VoiceOver, TalkBack)
- [ ] Beta testing (TestFlight, Play Internal Testing)
- [ ] Bug fixes

**Week 12: App Store Submission**
- [ ] App icon (1024x1024)
- [ ] Splash screens (all sizes)
- [ ] Screenshots (iPhone, iPad, Android)
- [ ] App Store description
- [ ] Privacy policy update
- [ ] iOS submission (App Store Connect)
- [ ] Android submission (Google Play Console)
- [ ] Marketing materials

**Deliverable:** Apps live in stores

---

## 8. App Store Requirements

### iOS App Store

**Requirements:**
- Apple Developer Account: **$99/year**
- App icon: 1024×1024 PNG (no alpha)
- Screenshots:
  - iPhone 6.5" (1242×2688) - 3 required
  - iPhone 5.5" (1242×2208) - 3 required
  - iPad Pro 12.9" (2048×2732) - Optional
- Privacy policy URL
- App description (max 4000 chars)
- Keywords (max 100 chars)
- Age rating
- Minimum iOS version: 13.0+

**Submission Process:**
1. Build with EAS: `eas build --platform ios`
2. Upload to App Store Connect
3. Fill metadata
4. Submit for review (1-3 days)
5. Approval & release

---

### Google Play Store

**Requirements:**
- Google Play Developer Account: **$25 one-time**
- App icon: 512×512 PNG
- Feature graphic: 1024×500 JPG/PNG
- Screenshots:
  - Phone (1080×1920 min) - 2 required
  - 7" tablet (1200×1920 min) - Optional
  - 10" tablet (1920×1200 min) - Optional
- Privacy policy URL
- App description (max 4000 chars)
- Short description (max 80 chars)
- Content rating questionnaire
- Minimum Android version: 5.0+ (API 21)

**Submission Process:**
1. Build with EAS: `eas build --platform android`
2. Upload AAB to Play Console
3. Fill metadata
4. Create release (internal/closed/open testing)
5. Submit for review (1-7 days)
6. Approval & rollout

---

## 9. Budget & Resources

### Development Costs

| Item | Cost (Outsourced) | Cost (In-House) |
|------|-------------------|-----------------|
| Development (12 weeks) | $80,000 - $120,000 | $0 (existing team) |
| Design/UI/UX | $10,000 - $20,000 | $0 (use existing) |
| Testing/QA | $5,000 - $10,000 | Minimal |

### Infrastructure Costs (Annual)

| Item | Cost |
|------|------|
| Apple Developer | $99/year |
| Google Play Developer | $25 one-time |
| Push Notifications (Firebase) | Free tier OK |
| Analytics (Firebase/Sentry) | Free tier OK |
| App Store Optimization Tools | $0 - $500/year |

**Total First Year:** $100k-$150k (outsourced) OR $0-$1,000 (in-house)

### Team Requirements

**Option A: In-House (Recommended)**
- 1 React Native developer (can be existing React web dev)
- 1 designer (part-time, can reuse web designs)
- 1 QA tester (part-time)

**Option B: Outsourced**
- Mobile development agency
- Fixed-price contract: $80k-$120k
- Timeline: 12-16 weeks

---

## 10. Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| React Native performance issues | Low | Medium | Use FlatList virtualization, lazy loading |
| Offline sync conflicts | Medium | Medium | Implement conflict resolution UI |
| SQLite storage limits | Low | Low | SQLite supports GB-scale databases |
| App Store rejection | Medium | High | Follow guidelines, use TestFlight beta |
| Push notification issues | Low | Low | Use Expo Notifications (tested solution) |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | High | Marketing plan, web app cross-promotion |
| Ongoing maintenance burden | Medium | Medium | Choose stable, popular libraries |
| Platform policy changes | Low | Medium | Monitor Apple/Google developer news |

---

## Success Metrics

**Launch Goals (3 months):**
- 1,000+ downloads
- 100+ active daily users
- 4.0+ star rating
- 80%+ retention (week 1)

**Long-Term Goals (12 months):**
- 10,000+ downloads
- 1,000+ active daily users
- Featured in "New Apps We Love" (App Store)
- 90%+ feature parity with web app

---

## Next Steps

1. **Review & approve this plan** ✅
2. **Set up development environment:**
   - Install Expo CLI: `npm install -g expo-cli`
   - Install EAS CLI: `npm install -g eas-cli`
   - Set up iOS Simulator (Mac) or Android Emulator
3. **Initialize mobile project:**
   - `cd collectyourcards.com`
   - `npx create-expo-app mobile --template blank-typescript`
4. **Create shared utilities folder**
5. **Build authentication POC** (Week 1 goal)

---

**Questions? Concerns? Modifications needed?**

This plan is a living document. Update as requirements change or new insights emerge.
