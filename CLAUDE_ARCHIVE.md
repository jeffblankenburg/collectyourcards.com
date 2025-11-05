# Claude Development Notes - Archive

This file contains historical implementation details, completed features, and reference documentation that has been moved from CLAUDE.md to reduce token usage while preserving important context.

---

## 🎉 COMPLETED MAJOR IMPLEMENTATIONS

### ✅ Comprehensive Crowdsourcing System Design (Jan 7, 2025)
- **Complete Crowdsourcing Strategy**: Created CROWDSOURCING.md with comprehensive implementation plan
- **Credit Economy System**: Designed $0.10 per credit system allowing users to earn subscription offsets
- **Multi-Tier Data Verification**: Implemented quality framework with Submitted → Under Review → Community Verified → Expert Verified tiers
- **120 Crowdsourcing Achievements**: Added complete achievement set to ACHIEVEMENTS.md covering all contribution activities
- **Trust-Based Rewards**: Credit multipliers based on Vouch System trust scores (1.0x to 2.0x)
- **Gamification Integration**: Xbox-style achievement system with progression levels from Rookie to Legend
- **Community Features**: Mentoring, collaborative projects, domain expertise tracking
- **Technical Architecture**: Database schema, API endpoints, and UI component specifications
- **Risk Mitigation**: Comprehensive strategies for quality control, economic sustainability, and community health
- **Implementation Roadmap**: 4-phase rollout plan with success metrics and KPIs

### ✅ Enhanced User Profile System (Jan 7, 2025)
- **Real Favorite Cards Display**: User profiles now show actual favorite cards (marked as special) using gallery-card component
- **Dynamic Collection Statistics**: Replaced hardcoded zeros with real collection stats (total cards, rookies, autos, relics, estimated value)
- **Recent Activity Feed**: Shows user's latest comments with proper context
- **Gallery-Style Card Display**: Updated favorite cards to match /collection gallery view styling (without random_code tags)
- **Favorite Star Integration**: Card detail pages now highlight favorites with star icon when user owns special cards
- **Responsive Card Grid**: Mobile-friendly favorite cards display with proper team colors and badges
- **Complete API Enhancement**: Enhanced `/api/profile/user/:username` with comprehensive card data including team info and navigation slugs

### ✅ Achievement System Documentation (Jan 7, 2025)
- **Comprehensive Achievement Database**: Complete `ACHIEVEMENTS.md` with 1000+ achievements across 15 categories
- **Xbox Gamerscore-Style Points**: 5-1000 point system with 6 tiers (Common to Mythic)
- **Complete Database Schema**: 8-table achievement system with progress tracking, history, and analytics
- **Anti-Gaming Safeguards**: Challenge system, community voting, fraud detection
- **Real-Time Processing**: Event-driven achievement unlocking architecture
- **Leaderboards & Analytics**: Global rankings, percentile calculations, success metrics

### ✅ Vouch & Trustworthiness System Design (Jan 7, 2025)
- **Complete Trust Framework**: Professional endorsement system distinct from social friendship
- **4 Vouch Types**: Transaction (100pts), Knowledge (75pts), Interaction (50pts), Character (200pts)
- **Trust Score Algorithm**: Weighted scoring with voucher credibility, relationship depth, verification levels
- **5 Trust Tiers**: New Collector → Bronze → Silver → Gold → Platinum with increasing benefits
- **Anti-Fraud Protection**: Sybil attack prevention, reciprocal vouch limits, network analysis
- **Complete Database Schema**: 7-table trust system with challenges, voting, analytics
- **Business Integration**: Transaction limits, escrow requirements, premium features based on trust

### ✅ Admin Comment URL Fix (Jan 7, 2025)
- **Fixed Card Navigation**: Admin recent comments now use correct `/card/set-slug/number/player-name` URL pattern
- **Enhanced SQL Queries**: Improved admin moderation endpoints with proper entity name resolution and URL construction
- **Player Name Slugification**: Proper slug generation for player names in card URLs

### ✅ Social & Profile Features (Jan 7, 2025)
- **Username system with real-time validation**: Full registration and profile management
- **Favorite Cards showcase**: Users can display 5 favorite cards on their profile
- **One-click social media sharing**: Share cards to Twitter, Facebook, Reddit, LinkedIn, Email
- **Activity Feed system**: Social media style feed showing recent comments on sets
- **Notification Bell**: Header notification system with unread counters and dropdown
- **Universal comment system**: Comments on cards, series, and sets with full moderation
- **Public user profiles**: Viewable profiles with collection stats and favorite cards
- **Profile management**: Complete settings page for bio, privacy, and username changes

#### Username Management (✅ COMPLETED)
- Registration username selection during signup
- Username availability checking with real-time validation
- Username change functionality
- Reserved username protection (block system routes and inappropriate names)
- Username history tracking (audit trail)

#### Favorite Cards Showcase (✅ COMPLETED)
- "My Top 5" profile section for selecting favorite cards
- Visual card display with fallback for missing images
- Easy card selection modal/interface
- Drag-and-drop reordering of top 5 cards
- Public display on user profiles
- Collection context showing rarity/value

#### Profile Enhancements (✅ COMPLETED)
- Public/private toggle for profile visibility
- Profile management page at /profile
- Bio and personal info (display name, bio, location, website)
- Collection statistics (card counts, values, rookie cards)

### ✅ Social Media Sharing (COMPLETED)
- Share individual cards from detail pages
- Platform integration: Twitter/X, Facebook, Reddit, LinkedIn, Email
- Rich media support with card images
- Auto-generated smart captions with card details
- Web Share API for native mobile sharing

---

## 📊 DATABASE SCHEMA REFERENCE - DETAILED DOCUMENTATION

### eBay Integration Database Schema (✅ ALREADY IMPLEMENTED)

```sql
-- eBay account linking
CREATE TABLE user_ebay_accounts (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  ebay_user_id NVARCHAR(255) NOT NULL,
  ebay_username NVARCHAR(255) NULL,
  access_token NVARCHAR(MAX) NOT NULL,
  refresh_token NVARCHAR(MAX) NULL,
  token_expires_at DATETIME NULL,
  scope_permissions NVARCHAR(MAX) NULL,
  last_sync_at DATETIME NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME NOT NULL DEFAULT GETDATE()
);

-- eBay purchase tracking
CREATE TABLE ebay_purchases (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  ebay_account_id BIGINT NULL REFERENCES user_ebay_accounts(id),
  ebay_item_id NVARCHAR(255) NOT NULL,
  ebay_transaction_id NVARCHAR(255) NULL,
  ebay_order_id NVARCHAR(255) NULL,
  title NVARCHAR(MAX) NOT NULL,
  purchase_date DATETIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  quantity INT NOT NULL DEFAULT 1,
  seller_name NVARCHAR(255) NULL,
  seller_feedback_score INT NULL,
  image_url NVARCHAR(MAX) NULL,
  ebay_category_id INT NULL,
  category_path NVARCHAR(MAX) NULL,
  item_condition NVARCHAR(50) NULL,
  is_sports_card BIT NULL,
  card_confidence DECIMAL(5,4) NULL,
  detected_sport NVARCHAR(50) NULL,
  detected_year INT NULL,
  detected_brand NVARCHAR(100) NULL,
  detected_series NVARCHAR(255) NULL,
  detected_player NVARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  user_notes NVARCHAR(MAX) NULL,
  matched_card_id BIGINT NULL REFERENCES card(card_id),
  match_confidence DECIMAL(5,4) NULL,
  manual_match BIT NOT NULL DEFAULT 0,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME NOT NULL DEFAULT GETDATE()
);

-- eBay sync tracking
CREATE TABLE ebay_sync_logs (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  ebay_account_id BIGINT NULL REFERENCES user_ebay_accounts(id),
  sync_type VARCHAR(50) NOT NULL,
  sync_start DATETIME NOT NULL,
  sync_end DATETIME NULL,
  items_processed INT NOT NULL DEFAULT 0,
  sports_cards_found INT NOT NULL DEFAULT 0,
  new_purchases INT NOT NULL DEFAULT 0,
  errors_encountered INT NOT NULL DEFAULT 0,
  error_details NVARCHAR(MAX) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- eBay account deletion tracking (GDPR compliance)
CREATE TABLE ebay_deletion_log (
  log_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(255) NOT NULL,
  user_id NVARCHAR(255) NOT NULL,
  eias_token NVARCHAR(MAX) NULL,
  deletion_date DATETIME2 NULL,
  processed BIT NULL DEFAULT 0,
  created_at DATETIME2 NULL DEFAULT GETDATE()
);
```

### Comment System Database Schema

```sql
-- Universal comments table - supports cards, series, and sets
CREATE TABLE universal_comments (
  comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  comment_type VARCHAR(10) NOT NULL CHECK (comment_type IN ('card', 'series', 'set')),
  item_id BIGINT NOT NULL,
  comment_text NVARCHAR(MAX) NOT NULL,
  parent_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME NULL,
  is_edited BIT NOT NULL DEFAULT 0,
  is_deleted BIT NOT NULL DEFAULT 0,
  INDEX IX_comments_type_item (comment_type, item_id),
  INDEX IX_comments_user (user_id),
  INDEX IX_comments_created (created_at DESC)
);

-- User subscriptions to items for notifications
CREATE TABLE user_item_subscriptions (
  subscription_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('card', 'series', 'set')),
  item_id BIGINT NOT NULL,
  subscribed_at DATETIME NOT NULL DEFAULT GETDATE(),
  is_active BIT NOT NULL DEFAULT 1,
  UNIQUE (user_id, item_type, item_id),
  INDEX IX_subscriptions_user (user_id),
  INDEX IX_subscriptions_item (item_type, item_id)
);

-- Notifications table
CREATE TABLE user_notifications (
  notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  notification_type VARCHAR(50) NOT NULL,
  title NVARCHAR(255) NOT NULL,
  message NVARCHAR(MAX) NOT NULL,
  related_comment_id BIGINT NULL REFERENCES universal_comments(comment_id),
  related_user_id BIGINT NULL REFERENCES [user](user_id),
  item_type VARCHAR(10) NULL CHECK (item_type IN ('card', 'series', 'set')),
  item_id BIGINT NULL,
  is_read BIT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT GETDATE(),
  INDEX IX_notifications_user_unread (user_id, is_read, created_at DESC)
);
```

### Activity Feed SQL Queries

#### Set-level Activity Feed
Shows activity from the set itself plus all child series and cards:

```sql
SELECT
  c.comment_id, c.comment_text, c.created_at,
  u.first_name, u.last_name,
  c.comment_type,
  CASE
    WHEN c.comment_type = 'card' THEN CONCAT(card.card_number, ' ', player.first_name, ' ', player.last_name)
    WHEN c.comment_type = 'series' THEN series.name
    WHEN c.comment_type = 'set' THEN 'Set Discussion'
  END as item_context
FROM universal_comments c
JOIN [user] u ON c.user_id = u.user_id
LEFT JOIN card ON c.comment_type = 'card' AND c.item_id = card.card_id
LEFT JOIN series ON c.comment_type = 'series' AND c.item_id = series.series_id
LEFT JOIN player ON card.player = player.player_id
WHERE
  (c.comment_type = 'set' AND c.item_id = @setId)
  OR (c.comment_type = 'series' AND c.item_id IN (SELECT series_id FROM series WHERE set = @setId))
  OR (c.comment_type = 'card' AND c.item_id IN (
    SELECT card.card_id FROM card
    JOIN series s ON card.series = s.series_id
    WHERE s.set = @setId
  ))
ORDER BY c.created_at DESC
```

#### Series-level Activity Feed
Shows series comments plus all card comments in that series:

```sql
SELECT
  c.comment_id, c.comment_text, c.created_at,
  u.first_name, u.last_name,
  c.comment_type,
  CASE
    WHEN c.comment_type = 'card' THEN CONCAT(card.card_number, ' ', player.first_name, ' ', player.last_name)
    WHEN c.comment_type = 'series' THEN 'Series Discussion'
  END as item_context
FROM universal_comments c
JOIN [user] u ON c.user_id = u.user_id
LEFT JOIN card ON c.comment_type = 'card' AND c.item_id = card.card_id
LEFT JOIN player ON card.player = player.player_id
WHERE
  (c.comment_type = 'series' AND c.item_id = @seriesId)
  OR (c.comment_type = 'card' AND c.item_id IN (
    SELECT card_id FROM card WHERE series = @seriesId
  ))
ORDER BY c.created_at DESC
```

---

## 🎨 UI COMPONENT SPECIFICATIONS

### Activity Feed Item Component
Each activity item shows:
- **User avatar/name** - Who commented
- **Timestamp** - When the comment was made
- **Context indicator** - "commented on [Card Name]" or "commented on this series"
- **Comment preview** - First line of comment with "read more" link
- **Jump button** - "View Card" or "View Series" to navigate to source

### Set Page Activity Feed
- **Tab system**: "Set Comments" | "All Activity"
- **All Activity tab** shows roll-up of everything in the set
- **Grouping**: Multiple comments from same user/item grouped together
- **Load more**: Paginated loading for large comment volumes

### Series Page Activity Feed
- **Inline activity section** below series information
- **Recent activity** from cards in the series
- **"Show all activity"** expands to full feed

### Social Media Sharing Content Template
```
"Check out this amazing [YEAR] [SET] [PLAYER] [CARD NUMBER] from my collection! 🏀⚾
[CARD IMAGE]
View my full collection at [SITE_URL]/[USERNAME]
#SportCards #[SPORT] #[PLAYER_NAME] #Collecting"
```

---

## 📜 HISTORICAL DATABASE RESTORATION NOTES

### Key Scripts Created During Database Restoration (Aug 12, 2025)
- `update_user_table.js` - Fixed authentication tables
- `fix_auth_log_columns.js` - Renamed action_type to event_type
- `fix_session_table.js` - Added missing session columns
- `restore_all_missing_tables.js` - Comprehensive table restoration
- `new_tables_to_restore.sql` - Complete restoration script

### Database Restoration Timeline
- **Last Restored**: August 12, 2025 from .bacpac file dated August 3, 2024
- **Final Status**: ✅ FULLY RESTORED - **793,740 cards, 6,965 players, 135 teams**
- **Production Sync**: All database changes applied to production (Aug 15, 2025)

---

## 🎯 API ENDPOINT SPECIFICATIONS

### Comment Endpoints
```javascript
GET    /api/comments/:type/:itemId          // Get comments for card/series/set
POST   /api/comments/:type/:itemId          // Add comment to card/series/set
PUT    /api/comments/:commentId             // Edit comment (within 15 min)
DELETE /api/comments/:commentId             // Delete comment
```

### Activity Feed Endpoints
```javascript
GET    /api/activity/:type/:itemId          // Get activity feed for item
GET    /api/activity/set/:setId             // Get all activity in a set
GET    /api/activity/series/:seriesId       // Get all activity in a series
```

### Notification Endpoints
```javascript
GET    /api/notifications                   // Get user notifications
PUT    /api/notifications/:id/read          // Mark notification as read
POST   /api/notifications/mark-all-read     // Mark all as read
DELETE /api/notifications/:id               // Delete notification
```

### Subscription Endpoints
```javascript
POST   /api/subscriptions/:type/:itemId     // Subscribe to item
DELETE /api/subscriptions/:type/:itemId     // Unsubscribe from item
GET    /api/subscriptions                   // Get user subscriptions
```

---

*This archive was created from CLAUDE.md to maintain essential context while reducing active token usage.*


## 📋 ACTIVE ROADMAPS & PENDING WORK

### 📱 Mobile Optimization Roadmap (HIGH PRIORITY)
*Target: Screens under 480px - Many card collectors are mobile-only users*

#### 🚨 Critical Mobile Features (Phase 1)
- [ ] **Mobile-first navigation system** - Hamburger menu, touch-friendly nav
- [ ] **Optimized card browsing experience** - Swipe gestures, infinite scroll, mobile card grid
- [ ] **Simplified search interface** - Large search bar, voice search, filter optimization
- [ ] **Mobile collection management** - Easy add/edit/delete with mobile-optimized forms
- [ ] **Touch-optimized modals and forms** - Full-screen modals on mobile, simplified inputs

#### 📱 Mobile UX Enhancements (Phase 2)
- [ ] **One-handed operation support** - Bottom navigation, thumb-friendly zones
- [ ] **Enhanced touch targets** - 44px minimum, generous spacing
- [ ] **Streamlined workflows** - Reduce steps for common tasks (add cards, search)
- [ ] **Mobile-optimized image viewing** - Pinch zoom, full-screen gallery
- [ ] **Offline-capable features** - Service worker, local storage, sync when online

#### ⚡ Mobile Performance (Phase 3)
- [ ] **Reduced bundle sizes** - Code splitting, lazy loading
- [ ] **Progressive image loading** - Blur placeholders, responsive images
- [ ] **Touch gesture optimization** - Native scroll, smooth animations
- [ ] **Mobile-specific caching** - Aggressive caching for mobile networks
- [ ] **PWA capabilities** - Install prompt, splash screen, app-like experience

### ⚡ Performance Optimization Roadmap (MEDIUM PRIORITY)

#### 🚀 Infinite Scroll Implementation (FUTURE)
- [ ] **Replace current "load all" approach** - Currently loading 10,000+ cards at once causes performance issues
- [ ] **Implement smooth infinite scrolling** - Load cards in batches of 100-200 as user scrolls
- [ ] **Maintain sort/filter state** - Preserve sorting and filtering during infinite scroll
- [ ] **Virtual scrolling for massive datasets** - Only render visible DOM elements for ultimate performance
- [ ] **Progressive data loading** - Prioritize visible content, lazy load off-screen data
- [ ] **Scroll position persistence** - Remember scroll position when navigating back to tables
- [ ] **Performance monitoring** - Track scroll performance metrics and optimize bottlenecks

#### ⚡ Current Performance Issues to Address
- [ ] **Chrome DevTools violations** - "[Violation] 'message' handler took 343ms" warnings from large dataset processing
- [ ] **Heavy DOM operations** - Large table rendering blocking main thread
- [ ] **Memory optimization** - Reduce memory footprint of large card collections
- [ ] **Image loading optimization** - Implement progressive/lazy loading for card images

### 🗣️ Social Features & Community System (IN DEVELOPMENT)

#### 💬 Universal Comment System (PRIORITY 1)
- [ ] **Multi-level commenting** - Comments on cards, series, and sets
- [ ] **Authentication required** to post, edit, or delete comments
- [ ] **Comment editing** - 15 minute window after posting
- [ ] **Rate limiting** - Maximum 5 comments per minute per user
- [ ] **Auto-subscription** - Users automatically subscribed to items they comment on or own

#### 🔔 Notification System (PRIORITY 1)
- [x] **Header notification icon** with unread count badge
- [x] **Core notifications**: Comment replies, new comments on owned cards, subscription activity
- [x] **Notification management**: Mark as read/unread, clear all, auto-cleanup after 30 days
- [x] **Click-to-navigate** - Each notification links to the relevant comment
- [x] **Hover dropdown** - Show recent notifications on icon hover
- [ ] **Dedicated notifications page** - Full notification history and management

#### Community Moderation & Safety
- [ ] **Profanity Filter**: Automatic detection and filtering
- [ ] **Keyword Blacklist**: Admin-configurable prohibited words
- [ ] **User Reporting System**: Community-driven reporting
- [ ] **Spam Detection**: Pattern recognition
- [ ] **Admin Dashboard**: Full comment moderation capabilities
- [ ] **Audit Trail**: Complete logging of moderation actions

### 🛒 eBay Integration System (PLANNING PHASE)
**Core Objective**: Automatically detect eBay purchases, match to database, add to "In Transit To Me" location

**Status**: Database schema complete (see CLAUDE_ARCHIVE.md), needs frontend UI and backend API implementation

### 📥 Import System Enhancements
- [x] **Paste data functionality** - Tab-separated data import (completed)
- [x] **Accent normalization** - Handle accented characters in team/player matching (completed)
- [x] **Consecutive duplicate detection** - Only merge consecutive rows with same card number (completed)
- [x] **Single-name player matching** - Match "Ichiro" to "Ichiro Suzuki" (completed)
- [ ] **Test import system** with reference spreadsheets
- [ ] **Enhanced fuzzy matching** for edge cases

### 🎯 Immediate Next Steps
1. **Test single-name player matching** - Verify "Ichiro" matches work
2. **Mobile navigation system** - Hamburger menu for screens < 768px
3. **Test full import workflow** - End-to-end spreadsheet import
4. **Implement basic comments** - Start with simple card comments
5. **Database backup automation** - Scheduled .bacpac exports

---

## 📊 LOGGING & OBSERVABILITY SYSTEM

### Overview
**Status**: ✅ FULLY IMPLEMENTED (January 2025)

A comprehensive, centralized logging system provides excellent visibility into production behavior, making debugging and monitoring significantly easier.

### Key Features
- **Centralized logger** with component-level context
- **Multiple log levels** (debug, info, warn, error) with easy control
- **Global axios interceptor** for automatic API call logging
- **Performance timing** built into logger
- **User context** automatically included with errors
- **Browser console control** for production debugging
- **Colored, emoji-tagged output** for easy scanning
- **No impact when disabled** - efficient and lightweight

### Quick Start

```javascript
// In any component
import { createLogger } from '../utils/logger'

const log = createLogger('ComponentName')

// Usage
log.info('Component mounted', { params })
log.debug('Fetching data', { id })
log.error('Failed to load', error)
log.performance('Data fetch', startTime)
log.success('Operation completed')
```

### Log Levels

| Level | When to Use | Production Default |
|-------|-------------|-------------------|
| `debug` | Detailed development info, variable dumps | Hidden |
| `info` | General state changes, successful operations | Shown |
| `warn` | Concerning but non-fatal issues | Shown |
| `error` | Errors and exceptions | Shown |

### Browser Console Control

Users can control logging in production via browser console:

```javascript
// Show all logs (including debug)
logControl.setLevel('debug')

// Show only info, warnings, and errors (default in production)
logControl.setLevel('info')

// Show only warnings and errors
logControl.setLevel('warn')

// Show only errors
logControl.setLevel('error')

// Disable all logging
logControl.setLevel('none')

// Check current log level
logControl.getLevel()

// Reset to default
logControl.reset()

// Show help
logControl.help()
```

### Global API Logging

All HTTP requests/responses are automatically logged via axios interceptor:

- **Request logging**: Method, URL, params shown
- **Response logging**: Status, duration, data size shown
- **Error logging**: Full error details with context
- **Performance tracking**: Automatic timing for all API calls

Example console output:
```
ℹ️ [14:23:45.123] [API] ✅ GET /api/cards?series_id=123 - 200 (234ms)
❌ [14:23:50.456] [API] ❌ POST /api/user/cards - 500 (1205ms)
```

### Components with Logging

All major page components have comprehensive logging:

- **RainbowView** - Set validation, card fetching, parallel loading
- **CardDetail** - Card loading, user collection, navigation, user actions
- **SeriesDetail** - Series data, stats calculation, parallel fetching
- **SeriesPage** - Set loading, series listing
- **PlayerDetail** - Player data, card filtering
- **PlayersLanding** - Player listing, search
- **TeamDetail** - Team data, roster loading
- **TeamsLanding** - Team listing, search
- **CollectionDashboard** - Collection stats, filtering

### Logging Best Practices

1. **Always log component mount** with relevant parameters
   ```javascript
   log.info('ComponentName mounted', { id, filters, isAuthenticated })
   ```

2. **Log data fetching operations** with performance timing
   ```javascript
   const startTime = performance.now()
   // ... fetch operation ...
   log.performance('Data fetch operation', startTime)
   ```

3. **Log user actions** for behavior tracking
   ```javascript
   log.info('User deleted card', { card_id, user_id })
   ```

4. **Log errors with full context**
   ```javascript
   log.error('Failed to save', {
     error: err.message,
     status: err.response?.status,
     data: err.response?.data
   })
   ```

5. **Use appropriate log levels**
   - `debug`: Variable dumps, detailed flow
   - `info`: Normal operations, state changes
   - `warn`: Recoverable issues, fallbacks
   - `error`: Failures, exceptions

### Production Debugging Workflow

When investigating issues in production:

1. **Open browser console**
2. **Enable appropriate logging**: `logControl.setLevel('debug')`
3. **Reproduce the issue**
4. **Review logs** for:
   - Component mount parameters
   - API call sequences and timing
   - Error messages with context
   - Performance bottlenecks
   - State changes and user actions
5. **Disable verbose logging**: `logControl.setLevel('info')`

### File Locations

- **Logger utility**: `/client/src/utils/logger.js`
- **Axios interceptor**: `/client/src/utils/axios-interceptor.js`
- **Initialization**: `/client/src/main.jsx` (axios interceptor setup)

### Example Console Output

```
ℹ️ [14:23:42.123] [RainbowView] RainbowView mounted {year: "2022", setSlug: "2022-topps-stadium-club-chrome", ...}
ℹ️ [14:23:42.145] [RainbowView] Starting rainbow card fetch {seriesSlug: "2022-topps-stadium-club-chrome", ...}
🔍 [14:23:42.150] [RainbowView] Fetching sets list for set validation {year: "2022", setSlug: "2022-topps-stadium-club-chrome"}
ℹ️ [14:23:42.389] [API] ✅ GET /api/sets-list - 200 (239ms)
✅ [14:23:42.395] [RainbowView] Found matching set: "2022 Topps Stadium Club Chrome" {set_id: 440, slug: "2022-topps-stadium-club-chrome"}
ℹ️ [14:23:42.623] [API] ✅ GET /api/card/2022-topps-stadium-club-chrome/2/bobby-witt-jr?set_id=440 - 200 (228ms)
⚡ [14:23:42.625] [RainbowView] Card fetch completed in 228ms
✅ [14:23:42.626] [RainbowView] Set validation passed - card is from correct set
ℹ️ [14:23:42.853] [API] ✅ GET /api/cards/rainbow?set_id=440&card_number=2 - 200 (227ms)
⚡ [14:23:42.855] [RainbowView] Rainbow fetch completed in 227ms
✅ [14:23:42.856] [RainbowView] Loaded 15 rainbow parallels
⚡ [14:23:42.857] [RainbowView] Complete rainbow view load completed in 707ms
```

### Benefits

- **Faster debugging**: See exactly what's happening in production
- **Better error diagnosis**: Full context with every error
- **Performance insights**: Automatic timing for all operations
- **User behavior tracking**: Understand how users interact with the site
- **Production troubleshooting**: Debug issues without deployment
- **No performance impact**: Lightweight and can be disabled completely

---