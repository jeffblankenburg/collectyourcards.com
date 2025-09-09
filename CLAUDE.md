# Claude Development Notes

## 🚨 CRITICAL: HOW TO WORK WITH THIS USER (READ FIRST - EVERY SESSION)

### Core Working Principles - NEVER FORGET THESE
1. **BE A SYSTEMATIC CODE ANALYST, NOT A GUESSER**
   - ALWAYS search for existing code patterns, dependencies, and conflicts BEFORE attempting fixes
   - Use grep, find, and comprehensive code analysis to understand root causes systematically  
   - Don't apply "band-aid" fixes - identify and solve the underlying architectural issue
   - Leverage your file search and cross-reference capabilities instead of making the user debug manually
   - This applies to CSS, JavaScript, database queries, API endpoints, configuration - EVERYTHING

2. **THINK LIKE AN EXPERT WITH DEEP SYSTEM KNOWLEDGE**
   - Consider how changes affect the entire system: dependencies, imports, inheritance, scoping
   - Look for naming conflicts, architectural patterns, and existing conventions
   - Analyze the broader codebase structure and established patterns before making changes
   - Understand the user is building maintainable, scalable, isolated components
   - Apply this expertise to ALL aspects: styling, logic, data flow, security, performance

3. **ISOLATION AND CONSISTENCY ARE SACRED** 
   - Never use generic names that could conflict across components (CSS classes, function names, etc.)
   - Every component should follow established naming conventions and scoping patterns
   - Prevent any kind of bleeding/conflicts between components at all costs
   - Example: Use `.collection-table-header-content` not `.header-content`, `handleCollectionSort` not `handleSort`

4. **METHODOLOGY: SEARCH → ANALYZE → SOLVE (FOR EVERYTHING)**
   - Step 1: Search codebase for related patterns, existing implementations, potential conflicts
   - Step 2: Analyze root cause using systematic thinking and architectural understanding
   - Step 3: Implement the correct solution that follows established patterns
   - Always explain your analysis process to build trust and demonstrate thoroughness

5. **RESPECT THE USER'S EXPERTISE AND TIME**
   - This user knows when you're applying band-aids vs real solutions (in any domain)
   - They can see issues in dev tools, logs, databases - you should find them systematically in code
   - Don't frustrate them by forgetting established working patterns or architectural decisions
   - Learn from their corrections immediately and apply those lessons to ALL similar situations

**If you forget these principles, you will frustrate this user immensely. Read this section at the start of every session.**

## 🚨 CORE OPERATIONAL INFORMATION

### Important Facts & Credentials
- **Database password**: Password123
- **Admin user**: `cardcollector@jeffblankenburg.com` / `testpassword`
- **You never need to start or restart the servers.  Ever.

### 🚨 Database Location & Connection (CRITICAL - NEVER FORGET!)
- **Location**: Docker container named `collect-cards-db`
- **Image**: `mcr.microsoft.com/mssql/server:2022-latest`
- **Port**: localhost:1433 (mapped from container)
- **Connection**: `sqlserver://localhost:1433;database=CollectYourCards;user=sa;password=Password123;...`
- **Current Status**: ✅ FULLY RESTORED - **793,740 cards, 6,965 players, 135 teams**
- **Last Restored**: August 12, 2025 from .bacpac file dated August 3, 2024
- **Commands**: 
  - `docker ps` - check container status
  - `docker logs collect-cards-db` - view SQL Server logs
  - `lsof -i :1433` - verify port usage

### Critical UI/UX Rules
- **NEVER USE JAVASCRIPT ALERTS** - Always use toast messages or inline error displays instead
- **NO MANUAL PAGINATION** - Never implement manual pagination (Previous/Next buttons, page numbers). Always use infinite scrolling for better UX
- **ADMIN TABLES FIRST COLUMN**: Always show database ID as first column in all admin tables for debugging/query purposes
- **ICONOGRAPHY REVIEW NEEDED**: All application icons need comprehensive review for consistency, appropriateness, and sports-card specific relevance
- Use toast notifications for all success/error feedback
- Prefer inline validation and error messages in forms

### 📱 Responsive Design Requirements (MANDATORY)
- **MOBILE-FIRST APPROACH**: Every page MUST work perfectly on mobile devices (320px+)
- **REQUIRED BREAKPOINTS**:
  - 320px: Standard minimum mobile width
  - 480px: Small phones
  - 768px: Tablets/large phones  
  - 1024px: Small desktops
  - 1200px+: Large screens
- **TOUCH-FRIENDLY**: Minimum 44px touch targets for buttons/links
- **NO HORIZONTAL SCROLL**: Never allow horizontal scrolling on any screen size
- **GRID RESPONSIVENESS**: Use `auto-fit, minmax(280px, 1fr)` or smaller for mobile compatibility
- **TYPOGRAPHY SCALING**: Font sizes must reduce appropriately on smaller screens
- **NAVIGATION**: Must remain accessible on all screen sizes (implement hamburger menu for mobile)
- **TESTING REQUIREMENT**: Test every page at 320px, 768px, 1024px, and 1440px widths
- **COMPONENT PRIORITY**: If a component doesn't fit on mobile, it should be hidden or redesigned, not cause overflow

### 🚨 Core Development Standards (NEVER VIOLATE)

#### 1. Feature Request Management
- **RECORD EVERY REQUEST**: All feature requests, no matter how small, must be documented immediately
- **ORGANIZED TRACKING**: Keep feature lists organized, prioritized, and tidy
- **COMPLETION TRACKING**: Mark features as completed when delivered

#### 2. Database Protection (CRITICAL)
- **NEVER DELETE DATABASE**: Under no circumstances delete the database without explicit instruction
- **NEVER DELETE RECORDS**: Do not delete database records without explicit user permission
- **BACKUP BEFORE CHANGES**: Always ensure data safety before schema modifications
- **AUDIT ALL CHANGES**: Log all database modifications for accountability
- **DATABASE CHANGES TRACKING**: 
  - `DATABASE_CHANGE_TRACKING.md` - Complete change log for production
  - `DATABASE_CHANGES_FOR_PRODUCTION.sql` - Ready-to-run SQL for production
  - Every database change MUST be documented in tracking file immediately
  - **✅ PRODUCTION SYNC**: All database changes applied to production (Aug 15, 2025)

#### 3. Database ID Privacy (ABSOLUTE RULE)
- **NEVER SHOW DATABASE IDS**: Database IDs must NEVER be shown in URLs or on screen
- **NO ID EXPOSURE**: Do not expose internal database IDs to users under any circumstances
- **USE ALTERNATIVE IDENTIFIERS**: Use slugs, natural keys, or other user-friendly identifiers instead
- **SECURITY BY DESIGN**: Database IDs are internal implementation details and must remain hidden

#### 4. Test-Driven Development (MANDATORY)
- **TESTS BEFORE CODE**: Always write tests before implementing new features
- **ALL TESTS MUST PASS**: Before writing new code, ensure all existing tests pass
- **NEW TESTS MUST PASS**: New code must make the new tests pass
- **NO UNTESTED CODE**: Every feature must have corresponding test coverage

#### 5. CI/CD Pipeline (ZERO FAILURES)
- **CLEAN PIPELINE**: Maintain clean CI/CD between local → GitHub → Azure production
- **NO FAILED GATES**: GitHub CI/CD integration gates must never fail
- **AUTOMATED DEPLOYMENT**: Ensure seamless deployment process
- **ROLLBACK CAPABILITY**: Always maintain ability to rollback changes

#### 6. Code Quality Standards
- **NO CLEVER CODE**: Avoid clever/complex solutions in favor of clear, understandable code
- **CONSISTENT NAMING**: Use clear, consistent naming conventions throughout
- **READABLE CODE**: Code should be self-documenting and easy to understand
- **UNIFORM PATTERNS**: Follow established patterns consistently across codebase

#### 7. Production Synchronization (CRITICAL)
- **IMMEDIATE DOCUMENTATION**: Document all dev changes that need production updates
- **SCHEMA CHANGES**: Track all database schema modifications for production
- **ENVIRONMENT VARIABLES**: Document new/changed .env requirements
- **CONFIGURATION UPDATES**: Track all config changes needed in production
- **DEPLOYMENT CHECKLIST**: Maintain checklist of production update requirements
- `PRODUCTION_CHANGES_NEEDED.md` - List of pending production updates

### Data Field Conventions
- **Team names**: Use `team.name` only (already includes city) - do NOT concatenate with `team.city`
- **Player names**: Use `first_name + last_name` format
- **Location fields**: `location` (name) and `location_id` (ID) - maintain both for proper display and updates
- **Color columns**: Always center-align color value tags in table columns (`textAlign: 'center'`)

## 🎉 RECENT MAJOR IMPLEMENTATIONS (READY FOR PRODUCTION)

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

#### 📊 Mobile Analytics & Testing
- [ ] **Mobile usage tracking** - Screen sizes, touch patterns, performance
- [ ] **Mobile-specific error monitoring** - Touch events, orientation changes
- [ ] **Performance benchmarks** - Load times on 3G/4G networks
- [ ] **User testing** - Real collector feedback on mobile experience

### 🛒 eBay Integration System (PLANNING PHASE)

#### Core Objective
**Automatically detect when a user purchases a sports card on eBay, match it to our database (if exists), and add it to their "In Transit To Me" location with notification.**

#### 🔐 eBay API Requirements
- [ ] **eBay Developer Account** - Register application with eBay Developer Program
- [ ] **OAuth 2.0 Integration** - Secure user consent flow for eBay account linking
- [ ] **API Credentials Management** - Store client ID, client secret, sandbox/production keys
- [ ] **User Consent Scopes** - Request access to:
  - `https://api.ebay.com/oauth/api_scope` - Basic API access
  - `https://api.ebay.com/oauth/api_scope/sell.account` - Account info
  - `https://api.ebay.com/oauth/api_scope/buy.order.readonly` - Purchase history

#### 📊 Existing eBay Database Schema (✅ ALREADY IMPLEMENTED)
```sql
-- eBay account linking (EXISTING TABLE: user_ebay_accounts)
TABLE user_ebay_accounts:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user table
- ebay_user_id (nvarchar(255), NOT NULL) - eBay's internal user ID
- ebay_username (nvarchar(255), NULLABLE) - eBay public username
- access_token (nvarchar(MAX), NOT NULL) - OAuth access token (encrypted)
- refresh_token (nvarchar(MAX), NULLABLE) - OAuth refresh token
- token_expires_at (datetime, NULLABLE) - Token expiration timestamp
- scope_permissions (nvarchar(MAX), NULLABLE) - Granted OAuth scopes
- last_sync_at (datetime, NULLABLE) - Last successful sync
- is_active (bit, NOT NULL) - Account active status
- created_at (datetime, NOT NULL) - Account link date
- updated_at (datetime, NOT NULL) - Last modification

-- eBay purchase tracking (EXISTING TABLE: ebay_purchases)  
TABLE ebay_purchases:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user
- ebay_account_id (bigint, NULLABLE) - FK to user_ebay_accounts
- ebay_item_id (nvarchar(255), NOT NULL) - eBay item identifier
- ebay_transaction_id (nvarchar(255), NULLABLE) - Transaction ID
- ebay_order_id (nvarchar(255), NULLABLE) - Order ID
- title (nvarchar(MAX), NOT NULL) - eBay listing title
- purchase_date (datetime, NOT NULL) - When purchased
- price (decimal, NOT NULL) - Purchase price
- currency (varchar(3), NOT NULL) - Currency code (USD, etc)
- quantity (int, NOT NULL) - Items purchased
- seller_name (nvarchar(255), NULLABLE) - Seller username
- seller_feedback_score (int, NULLABLE) - Seller's feedback rating
- image_url (nvarchar(MAX), NULLABLE) - eBay item image URL
- ebay_category_id (int, NULLABLE) - eBay category
- category_path (nvarchar(MAX), NULLABLE) - Full category breadcrumb
- item_condition (nvarchar(50), NULLABLE) - Item condition
- is_sports_card (bit, NULLABLE) - AI detected as sports card
- card_confidence (decimal, NULLABLE) - Sports card detection confidence
- detected_sport (nvarchar(50), NULLABLE) - Auto-detected sport
- detected_year (int, NULLABLE) - Auto-detected year
- detected_brand (nvarchar(100), NULLABLE) - Auto-detected brand/set
- detected_series (nvarchar(255), NULLABLE) - Auto-detected series
- detected_player (nvarchar(255), NULLABLE) - Auto-detected player
- status (varchar(50), NOT NULL) - Processing status
- user_notes (nvarchar(MAX), NULLABLE) - User's manual notes
- matched_card_id (bigint, NULLABLE) - FK to matched card
- match_confidence (decimal, NULLABLE) - Match confidence score
- manual_match (bit, NOT NULL) - User manually matched
- processed_at (datetime, NULLABLE) - Processing timestamp
- created_at (datetime, NOT NULL) - Record creation
- updated_at (datetime, NOT NULL) - Last update

-- eBay sync tracking (EXISTING TABLE: ebay_sync_logs)
TABLE ebay_sync_logs:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user
- ebay_account_id (bigint, NULLABLE) - FK to user_ebay_accounts
- sync_type (varchar(50), NOT NULL) - 'full', 'incremental', 'manual'
- sync_start (datetime, NOT NULL) - Sync start time
- sync_end (datetime, NULLABLE) - Sync completion time
- items_processed (int, NOT NULL) - Total items processed
- sports_cards_found (int, NOT NULL) - Cards detected as sports cards
- new_purchases (int, NOT NULL) - New purchases found
- errors_encountered (int, NOT NULL) - Error count
- error_details (nvarchar(MAX), NULLABLE) - Error descriptions
- status (varchar(50), NOT NULL) - 'pending', 'running', 'completed', 'failed'

-- eBay account deletion tracking (EXISTING TABLE: ebay_deletion_log)
TABLE ebay_deletion_log:
- log_id (bigint, NOT NULL) - Primary key
- username (nvarchar(255), NOT NULL) - eBay username
- user_id (nvarchar(255), NOT NULL) - eBay user ID
- eias_token (nvarchar(MAX), NULLABLE) - Account deletion token
- deletion_date (datetime2, NULLABLE) - When account was deleted
- processed (bit, NULLABLE) - Whether deletion was processed
- created_at (datetime2, NULLABLE) - Log entry creation
```

#### 🔄 eBay Integration Workflow Status

**✅ ALREADY IMPLEMENTED (Database Schema Complete):**
- **Database Tables**: All eBay tables exist with comprehensive schema
- **Account Linking Storage**: `user_ebay_accounts` with OAuth token storage
- **Purchase Tracking**: `ebay_purchases` with advanced AI detection fields
- **Sync Logging**: `ebay_sync_logs` with detailed sync metrics
- **Account Deletion Handling**: `ebay_deletion_log` for compliance

**🚧 IMPLEMENTATION NEEDED:**
1. **Frontend UI Components**:
   - [ ] eBay account linking interface in user settings
   - [ ] OAuth consent flow with eBay Developer API
   - [ ] Purchase review queue for manual matching
   - [ ] Sync status dashboard showing last sync, errors, etc.

2. **Backend API Integration**:
   - [ ] eBay OAuth flow endpoints (`/api/ebay/auth/*`)
   - [ ] Purchase sync job processor (`/api/ebay/sync`)
   - [ ] Card matching algorithm implementation
   - [ ] Background job scheduler for periodic syncing

3. **AI Detection & Matching**:
   - [ ] **Title parsing**: Extract player/year/set from eBay titles
   - [ ] **Sports card detection**: Populate `is_sports_card` and `card_confidence`
   - [ ] **Fuzzy matching**: Match to our card database using `detected_*` fields
   - [ ] **Auto-population**: Fill `detected_sport`, `detected_year`, `detected_brand`, `detected_series`, `detected_player`

4. **Automatic Addition Process**:
   - [ ] High confidence auto-add to "In Transit To Me" location
   - [ ] Medium confidence → review queue
   - [ ] Low confidence → manual review with suggestions

#### 🎯 Automatic Card Addition Process
1. **High Confidence Matches (>0.85)**:
   - [ ] Auto-add to "In Transit To Me" location
   - [ ] Set purchase price from eBay transaction
   - [ ] Generate notification: "We added [Card Name] from your eBay purchase"
   - [ ] Mark as `auto_added: true` for tracking

2. **Medium Confidence Matches (0.5-0.84)**:
   - [ ] Add to review queue with suggested match
   - [ ] Notification: "Review potential card match from eBay"
   - [ ] User can approve/reject/modify the match

3. **Low Confidence/No Match (<0.5)**:
   - [ ] Store purchase data without card match
   - [ ] Notification: "New eBay purchase detected - manual review needed"
   - [ ] Allow manual card selection or "not a card" marking

#### 📱 User Interface Components
- [ ] **Settings page**: eBay account linking/unlinking
- [ ] **Review queue**: Pending eBay matches requiring approval
- [ ] **Purchase history**: All eBay purchases with match status
- [ ] **Sync status**: Last sync time, next sync, manual sync button
- [ ] **Match overrides**: User can correct/train the matching algorithm

#### 🔔 Notification System Integration
- [ ] **Real-time notifications**: New purchases, matches found, review needed
- [ ] **Email notifications**: Daily digest of new additions
- [ ] **Push notifications**: Mobile PWA notifications for instant updates
- [ ] **Notification preferences**: Control what triggers notifications

#### 🔧 Technical Implementation Details
- [ ] **Background job processor**: Queue-based eBay sync jobs
- [ ] **Error handling**: API failures, token expiration, rate limiting
- [ ] **Data validation**: Verify purchase data integrity
- [ ] **Duplicate prevention**: Don't add same item multiple times
- [ ] **Privacy protection**: Encrypt stored eBay tokens
- [ ] **Audit logging**: Track all eBay integration activities

#### 🚨 Required User Locations
- [ ] **"In Transit To Me" location**: Auto-created for all users
- [ ] **Default location assignment**: Fallback if "In Transit" doesn't exist
- [ ] **Location preferences**: User can set preferred auto-add location

#### 📈 Analytics & Reporting
- [ ] **Match accuracy tracking**: Success rates of auto-matching
- [ ] **Purchase pattern analysis**: Most bought cards, spending trends
- [ ] **Sync performance**: API response times, error rates
- [ ] **User adoption metrics**: How many users link eBay accounts

#### 🛡️ Security & Privacy Considerations
- [ ] **Token encryption**: Store all eBay tokens encrypted at rest
- [ ] **Minimal data storage**: Only store necessary purchase information
- [ ] **User control**: Easy account unlinking and data deletion
- [ ] **API security**: Secure webhook endpoints with validation
- [ ] **Rate limiting**: Prevent abuse of eBay API integration

#### 🧪 Testing Strategy
- [ ] **eBay Sandbox testing**: Test all flows with fake purchases
- [ ] **Mock API responses**: Unit tests for matching algorithms
- [ ] **Edge case handling**: Weird titles, missing data, API errors
- [ ] **Performance testing**: Large purchase history imports
- [ ] **User acceptance testing**: Real collector feedback on accuracy

### 🗣️ Social Features & Community System (IN DEVELOPMENT)

#### 💬 Universal Comment System (PRIORITY 1 - TODAY)
##### Core Comment Features
- [ ] **Multi-level commenting** - Comments on cards, series, and sets
- [ ] **Authentication required** to post, edit, or delete comments  
- [ ] **Comment editing** - 15 minute window after posting
- [ ] **Rate limiting** - Maximum 5 comments per minute per user
- [ ] **Auto-subscription** - Users automatically subscribed to items they comment on or own

##### Comment Roll-Up Activity Feed
- [ ] **Hierarchical display** - Comments bubble up from cards → series → sets
- [ ] **Set-level activity feed** - Shows all comments from child series and cards
- [ ] **Series-level activity feed** - Shows all comments from child cards
- [ ] **Context preservation** - Each comment shows its origin (card name, series, etc.)
- [ ] **Smart aggregation** - Group multiple comments from same user/card when appropriate
- [ ] **Timestamp-based ordering** - Most recent activity first
- [ ] **Activity type indicators** - Icons showing if comment is on card/series/set

##### Comment Display Context
- [ ] **On Card Pages**: Show only card-specific comments
- [ ] **On Series Pages**: Show series comments + recent card comments from that series
- [ ] **On Set Pages**: Show set comments + activity feed from all series/cards
- [ ] **Comment attribution**: "John commented on 2024 Topps Update #123 Mike Trout"
- [ ] **Jump-to navigation**: Click to go directly to the commented item

##### Real-time Updates (PRIORITY 3 - LATER)
- [ ] **WebSocket integration** for live comment updates
- [ ] **Live activity feeds** - New comments appear without refresh
- [ ] **Typing indicators** - See who's currently writing a comment

#### Community Moderation & Safety
- [ ] **Profanity Filter**: Automatic detection and filtering
- [ ] **Keyword Blacklist**: Admin-configurable prohibited words
- [ ] **Content Analysis**: Azure Content Moderator API integration
- [ ] **User Reporting System**: Community-driven reporting
- [ ] **Spam Detection**: Pattern recognition
- [ ] **Admin Dashboard**: Full comment moderation capabilities
- [ ] **User Reputation System**: Trust scores
- [ ] **Temporary Suspensions**: Time-based restrictions
- [ ] **Comment Queue**: Pre-approval system
- [ ] **Audit Trail**: Complete logging of moderation actions

#### 🔔 Notification System (PRIORITY 1 - CURRENT)
##### Basic Notification Bell
- [x] **Header notification icon** with unread count badge
- [x] **Core notifications**:
  - "Someone commented on your card/series/set"
  - "Someone replied to your comment"
  - "New comment on a card you own"
  - "New activity in series/set you're subscribed to"
- [x] **Notification management**:
  - Mark as read/unread
  - Clear all notifications
  - Auto-cleanup after 30 days
- [x] **Click-to-navigate** - Each notification links to the relevant comment
- [x] **Hover dropdown** - Show recent notifications on icon hover
- [ ] **Dedicated notifications page** - Full notification history and management

##### Advanced Notifications (PRIORITY 3 - LATER)
- [ ] **Real-time delivery** via WebSocket
- [ ] **Notification preferences** - Granular control per type
- [ ] **Email integration** - Optional daily/weekly digests

## 🚀 SOCIAL & PROFILE FEATURES (✅ MAJOR IMPLEMENTATION COMPLETE!)

### ✨ Recently Completed Features
- ✅ **Username system with real-time validation** - Full registration and profile management
- ✅ **Favorite Cards showcase** - Users can display 5 favorite cards on their profile
- ✅ **One-click social media sharing** - Share cards to Twitter, Facebook, Reddit, LinkedIn, Email
- ✅ **Activity Feed system** - Social media style feed showing recent comments on sets
- ✅ **Notification Bell** - Header notification system with unread counters and dropdown
- ✅ **Universal comment system** - Comments on cards, series, and sets with full moderation
- ✅ **Public user profiles** - Viewable profiles with collection stats and favorite cards
- ✅ **Profile management** - Complete settings page for bio, privacy, and username changes

### 👤 Enhanced User Profile System
#### Username Management (✅ COMPLETED)
- [x] **Registration username selection**: Users must choose username during signup
- [x] **Username availability checking**: Real-time validation during registration
- [x] **Username change functionality**: Allow users to update their username
- [x] **Reserved username protection**: Block system routes and inappropriate names
- [x] **Username history tracking**: Audit trail for username changes

#### Favorite Cards Showcase (✅ COMPLETED)
- [x] **"My Top 5" profile section**: Users can select 5 favorite cards from their collection
- [x] **Visual card display**: Show card images in profile (with fallback for no images)
- [x] **Easy card selection**: Modal/interface to choose from user's collection
- [x] **Drag-and-drop reordering**: Users can reorder their top 5 cards
- [x] **Public display**: Favorite cards visible on public profiles
- [x] **Collection context**: Show rarity/value of showcased cards

#### Profile Enhancements
- [x] **Public/private toggle**: Control profile visibility
- [x] **Profile management page**: Complete settings interface at /profile
- [x] **Bio and personal info**: Display name, bio, location, website
- [x] **Collection statistics**: Card counts, values, rookie cards, etc.
- [ ] **Activity timeline**: Recent comments and collection updates
- [ ] **Achievement badges**: Milestones for collection size, activity, etc.

### 📱 Social Media Sharing (✅ COMPLETED - ONE-CLICK SHARING)
#### Card Sharing Features
- [x] **Share individual cards**: Direct sharing from card detail pages
- [x] **Platform integration**: Native sharing for Twitter/X, Facebook, Reddit, LinkedIn, Email
- [x] **Rich media support**: Include card images in shared posts
- [x] **Auto-generated content**: Smart captions with card details
- [x] **Web Share API**: Native mobile sharing on supported devices

#### Sharing Content Template
```
"Check out this amazing [YEAR] [SET] [PLAYER] [CARD NUMBER] from my collection! 🏀⚾
[CARD IMAGE]
View my full collection at [SITE_URL]/[USERNAME]
#SportCards #[SPORT] #[PLAYER_NAME] #Collecting"
```

#### Technical Implementation
- [ ] **Web Share API**: Native mobile sharing on supported devices
- [ ] **Fallback sharing**: Custom modal with copy-to-clipboard for unsupported platforms
- [ ] **Image optimization**: Proper sizing for different social platforms
- [ ] **Open Graph tags**: Rich previews when links are shared
- [ ] **Analytics tracking**: Monitor sharing activity and engagement

#### 📊 Database Schema Extensions for Comments
##### New Tables Required:

```sql
-- Universal comments table - supports cards, series, and sets
CREATE TABLE universal_comments (
  comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES [user](user_id),
  comment_type VARCHAR(10) NOT NULL CHECK (comment_type IN ('card', 'series', 'set')),
  item_id BIGINT NOT NULL, -- References card_id, series_id, or set_id
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

#### 🎯 API Endpoints Structure

```javascript
// Comment endpoints
GET    /api/comments/:type/:itemId          // Get comments for card/series/set
POST   /api/comments/:type/:itemId          // Add comment to card/series/set
PUT    /api/comments/:commentId             // Edit comment (within 15 min)
DELETE /api/comments/:commentId             // Delete comment

// Activity feed endpoints
GET    /api/activity/:type/:itemId          // Get activity feed for item
GET    /api/activity/set/:setId             // Get all activity in a set
GET    /api/activity/series/:seriesId       // Get all activity in a series

// Notification endpoints
GET    /api/notifications                   // Get user notifications
PUT    /api/notifications/:id/read          // Mark notification as read
POST   /api/notifications/mark-all-read     // Mark all as read
DELETE /api/notifications/:id               // Delete notification

// Subscription endpoints
POST   /api/subscriptions/:type/:itemId     // Subscribe to item
DELETE /api/subscriptions/:type/:itemId     // Unsubscribe from item
GET    /api/subscriptions                   // Get user subscriptions
```

#### 🔄 Activity Feed Roll-up Logic

##### Set-level Activity Feed
Shows activity from the set itself plus all child series and cards:
```sql
-- Get all comments in a set (set comments + series comments + card comments)
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

##### Series-level Activity Feed
Shows series comments plus all card comments in that series:
```sql
-- Get comments in a series (series comments + card comments in that series)
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

#### 🎨 UI Components for Activity Feeds

##### Activity Feed Item Component
Each activity item shows:
- **User avatar/name** - Who commented
- **Timestamp** - When the comment was made
- **Context indicator** - "commented on [Card Name]" or "commented on this series"
- **Comment preview** - First line of comment with "read more" link
- **Jump button** - "View Card" or "View Series" to navigate to source

##### Set Page Activity Feed
- **Tab system**: "Set Comments" | "All Activity" 
- **All Activity tab** shows roll-up of everything in the set
- **Grouping**: Multiple comments from same user/item grouped together
- **Load more**: Paginated loading for large comment volumes

##### Series Page Activity Feed  
- **Inline activity section** below series information
- **Recent activity** from cards in the series
- **"Show all activity"** expands to full feed
- [ ] **@ Mentions** - Notify when username is mentioned
- [ ] **Follow users** - Get notified of specific collectors' activity

#### Direct Messaging System (FUTURE)
- [ ] **One-to-one messaging** between users
- [ ] **Message threads** with history
- [ ] **Real-time delivery** with read receipts
- [ ] **File attachments** with size limits
- [ ] **Message encryption**
- [ ] **Block/Unblock Users**
- [ ] **Privacy Settings**

### 📥 Import System Completion
- [ ] **Fix remaining BigInt serialization issues** in admin/import API endpoints
- [ ] **Test import system** with reference spreadsheets
- [ ] **Complete Stages 4-6** of import system (Entity Save, Card Review, Card Import)
- [ ] **Implement enhanced fuzzy matching** for players/teams
- [ ] **Implement database backup strategy** to prevent future data loss


### 🎯 Immediate Next Steps
1. **Mobile navigation system** - Hamburger menu for screens < 768px
2. **Fix import system BigInt errors** - Complete serialization fixes
3. **Test full import workflow** - End-to-end spreadsheet import
4. **Implement basic comments** - Start with simple card comments
5. **Database backup automation** - Scheduled .bacpac exports

## 🔧 TECHNICAL REFERENCE

### Current Architecture
- **Frontend**: React with Vite
- **Backend**: Express.js with Prisma ORM
- **Database**: SQL Server 2022 running in Docker container
- **Authentication**: Comprehensive JWT-based system with email verification
- **Email Service**: Azure Communication Services
- **Security**: Rate limiting, password hashing (bcrypt), account lockout protection
- **Hosting**: Azure App Service (Production)

### 📊 SQL Server Schema Reference

#### ⚠️ BIGINT SERIALIZATION RULES
**ALL BigInt fields MUST be converted to Number or String before JSON response:**
```javascript
// ALWAYS DO THIS:
card_id: Number(row.card_id)
// OR THIS:
card_id: row.card_id.toString()
// NEVER THIS:
card_id: row.card_id  // Will cause "Cannot convert BigInt to JSON" error
```

#### 💰 Money Field Formatting
```javascript
// Money fields return as decimal objects
// Always format to 2 decimal places for display
purchase_price: row.purchase_price ? Number(row.purchase_price).toFixed(2) : '0.00'
```

#### 📋 Core Tables Schema

##### `card` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| card_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| sort_order | int | YES | |
| card_number | nvarchar(MAX) | YES | |
| is_rookie | bit | NO | Default: false |
| is_autograph | bit | NO | Default: false |
| is_relic | bit | NO | Default: false |
| print_run | int | YES | |
| series | **bigint** | YES | FK to series - **REQUIRES SERIALIZATION** |
| color | int | YES | FK to color |
| notes | nvarchar(MAX) | YES | |
| created | datetime | NO | |

##### `user_card` Table  
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| user_card_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| user | **bigint** | YES | FK to user - **REQUIRES SERIALIZATION** |
| card | **bigint** | YES | FK to card - **REQUIRES SERIALIZATION** |
| serial_number | int | YES | |
| purchase_price | money | YES | Returns as decimal - format with .toFixed(2) |
| estimated_value | money | YES | Returns as decimal - format with .toFixed(2) |
| current_value | money | YES | Returns as decimal - format with .toFixed(2) |
| photo | nvarchar(MAX) | YES | |
| notes | nvarchar(MAX) | YES | |
| grading_agency | int | YES | |
| grade | decimal | YES | |
| is_for_sale | bit | YES | |
| is_wanted | bit | YES | |
| is_special | bit | YES | |
| user_location | **bigint** | YES | FK - **REQUIRES SERIALIZATION** |

##### `series` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| series_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| name | nvarchar(MAX) | YES | |
| set | int | YES | FK to set |
| card_count | int | NO | Default: 0 |
| is_base | bit | YES | |
| parallel_of_series | **bigint** | YES | **REQUIRES SERIALIZATION** |
| front_image_path | nvarchar(MAX) | YES | |
| back_image_path | nvarchar(MAX) | YES | |
| min_print_run | int | YES | |
| max_print_run | int | YES | |
| print_run_display | nvarchar(50) | YES | |
| rookie_count | int | YES | |
| color | int | YES | FK to color |

##### `user` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| user_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| email | nvarchar(255) | YES | Unique |
| first_name | nvarchar(100) | YES | |
| last_name | nvarchar(100) | YES | |
| is_active | bit | YES | Default: true |
| is_verified | bit | YES | Default: false |
| role | nvarchar(50) | YES | Default: 'user' |
| password_hash | nvarchar(500) | YES | |

##### `player` Table  
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| player_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| first_name | nvarchar(MAX) | YES | |
| last_name | nvarchar(MAX) | YES | |
| birthdate | datetime | YES | |
| is_hof | bit | YES | Hall of Fame |
| card_count | int | YES | |

##### `team` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| team_Id | int | NO | Primary key - Regular int, not bigint |
| name | nvarchar(MAX) | YES | Full team name (includes city) |
| city | nvarchar(MAX) | YES | |
| mascot | nvarchar(MAX) | YES | |
| abbreviation | nvarchar(MAX) | YES | |
| organization | int | YES | FK to organization |
| primary_color | nvarchar(MAX) | YES | |
| secondary_color | nvarchar(MAX) | YES | |

#### 🔗 Junction & Auth Tables

##### `card_player_team` Table (Junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| card_player_team_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| card | **bigint** | YES | FK to card - **REQUIRES SERIALIZATION** |
| player_team | **bigint** | YES | FK to player_team - **REQUIRES SERIALIZATION** |

##### `player_team` Table (Junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| player_team_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| player | **bigint** | YES | FK to player - **REQUIRES SERIALIZATION** |
| team | int | YES | FK to team - Regular int |

##### `user_session` Table (Auth)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| session_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| user_id | **bigint** | NO | FK to user - **REQUIRES SERIALIZATION** |
| session_token | nvarchar(500) | NO | |
| expires_at | datetime | NO | |

##### `user_auth_log` Table (Auth)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| log_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| user_id | **bigint** | YES | FK to user - **REQUIRES SERIALIZATION** |
| event_type | varchar(50) | NO | |
| ip_address | varchar(45) | YES | |
| success | bit | NO | Default: true |

### 🔴 Common Serialization Mistakes to Avoid

```javascript
// ❌ WRONG - Will throw "Cannot convert BigInt to JSON"
res.json({
  card: {
    card_id: row.card_id,
    series_id: row.series_id
  }
})

// ✅ CORRECT
res.json({
  card: {
    card_id: Number(row.card_id),
    series_id: Number(row.series_id)
  }
})

// ✅ ALSO CORRECT (for IDs that might exceed JavaScript's safe integer)
res.json({
  card: {
    card_id: row.card_id.toString(),
    series_id: row.series_id.toString()
  }
})
```

### Database Schema Extensions for Social Features
```sql
-- Required new tables for social features
card_comments - Comment system for card discussions
notifications - User notification management  
user_card_subscriptions - Notification preference tracking
direct_messages - Private messaging between users
message_threads - Conversation grouping
user_blocks - User blocking relationships
content_reports - Community reporting system
moderation_actions - Admin action audit trail  
user_reputation - Community trust scoring
```

### Key Scripts Created During Restoration
- `update_user_table.js` - Fixed authentication tables
- `fix_auth_log_columns.js` - Renamed action_type to event_type
- `fix_session_table.js` - Added missing session columns
- `restore_all_missing_tables.js` - Comprehensive table restoration
- `new_tables_to_restore.sql` - Complete restoration script