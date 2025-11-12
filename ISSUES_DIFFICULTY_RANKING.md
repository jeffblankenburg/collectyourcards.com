# GitHub Issues - Difficulty Ranking

**Generated:** January 2025
**Purpose:** Rank all open issues by implementation difficulty and time required

---

## 🟢 EASY - Quick Wins (1-3 Days Each)

### Issue #22: Saving card edits needs to at least appear faster
**Difficulty:** ⭐ (1/5)
**Estimated Time:** 1-2 days
**Type:** UX/Performance Optimization

**Why Easy:**
- Simple async/await pattern optimization
- Close modal immediately after validation
- Show toast notification while processing in background
- No database schema changes
- No complex logic changes

**Implementation:**
1. Move heavy processing (image upload) to background
2. Close modal after quick validation
3. Show "Saving..." toast notification
4. Update UI when complete
5. Handle errors gracefully with toast messages

**Blockers:** None

---

### Issue #17: Card Detail page is slow to load
**Difficulty:** ⭐⭐ (2/5)
**Estimated Time:** 2-3 days
**Type:** Performance Optimization

**Why Easy:**
- Already have query optimization experience
- Likely N+1 query problem or missing indexes
- Server-side only changes (no UI work)
- Can test with real production data
- Similar to previously solved performance issues

**Implementation:**
1. Profile the `/api/card/:seriesSlug/:cardNumber/:playerName` endpoint
2. Identify slow queries (likely joins on card_player_teams, teams, players)
3. Add missing indexes or optimize JOINs
4. Consider caching frequently accessed cards
5. Reduce payload size if needed

**Known Issues:**
- CardDetail.jsx:158 makes API call to `/api/card/:seriesSlug/:cardNumber/:playerName`
- Then fetches ALL series cards (line 235: `limit=10000`)
- Then fetches parallel series (line 287)
- Could optimize by combining queries or lazy loading

**Blockers:** None

---

### Issue #13: Edit card modal on admin/cards needs help
**Difficulty:** ⭐⭐ (2/5)
**Estimated Time:** 2-3 days
**Type:** UI/UX Improvement

**Why Easy:**
- Already have modal styling patterns from other modals
- Front/back image selection exists in other components
- Mainly CSS and UI restructuring
- No complex business logic

**Implementation:**
1. Refactor modal to match other modal styles (QuickEditModal, AddCardModal)
2. Add clear card number and series display at top
3. Add image selection dropdowns (front/back)
4. Integrate with existing image upload system
5. Test with admin users

**Blockers:** None

---

## 🟡 MEDIUM - Feature Development (2-4 Weeks Each)

### Issue #28: Social Features - Following/Followers Management
**Difficulty:** ⭐⭐⭐ (3/5)
**Estimated Time:** 2-3 weeks
**Type:** Feature Implementation

**Why Medium:**
- Database schema mostly exists (user_follow table)
- Need to build UI pages for followers/following lists
- Need API endpoints for social interactions
- Activity feed requires new table
- Privacy controls needed

**Implementation Phases:**
1. **Week 1:** API endpoints
   - GET /api/social/following
   - GET /api/social/followers
   - GET /api/social/mutual
   - POST /api/social/follow
   - DELETE /api/social/unfollow

2. **Week 2:** UI Pages
   - Following/Followers list page
   - User profile enhancements
   - Follow/unfollow buttons
   - Privacy settings

3. **Week 3:** Activity Feed
   - Create activity_feed table
   - Track user actions
   - Display feed on profile
   - Pagination/infinite scroll

**Dependencies:**
- User profiles exist
- Authentication working

**Blockers:** None

---

### Issue #27: Recommendation Engine - "What Am I Missing?"
**Difficulty:** ⭐⭐⭐ (3/5)
**Estimated Time:** 3-4 weeks
**Type:** Feature Implementation with Complex Queries

**Why Medium:**
- Complex SQL queries needed
- Multiple recommendation algorithms
- Background job processing needed
- Caching strategy required
- No external dependencies

**Implementation Phases:**
1. **Week 1:** Set Completion Recommendations
   - Query to find sets >50% complete
   - Calculate missing cards
   - Rank by completion percentage

2. **Week 2:** Player/Team Recommendations
   - Identify top collected players
   - Recommend significant cards (rookies, autos)
   - Team-based recommendations

3. **Week 3:** Similar Collectors
   - Privacy-preserving aggregation
   - Find collectors with similar collections
   - Recommend commonly owned cards

4. **Week 4:** Background Jobs & Caching
   - Set up job queue for recommendation calculation
   - Cache recommendations per user
   - API endpoints for retrieval
   - Refresh triggers on collection changes

**Dependencies:**
- User collections exist
- Card/set data complete

**Blockers:** None

---

### Issue #30: Automated Spreadsheet Generation System
**Difficulty:** ⭐⭐⭐ (3/5)
**Estimated Time:** 3-4 weeks
**Type:** Infrastructure + Feature

**Why Medium:**
- Clear specification in SPREADSHEET_GENERATION_PLAN.md
- Need Azure Function for background processing
- ExcelJS library well-documented
- Azure Blob Storage integration needed
- Job queue system needed

**Implementation Phases:**
1. **Week 1:** Database Changes
   - Add columns to set table (checklist_blob_url, etc.)
   - Create job queue table
   - Create change tracking system

2. **Week 2:** Excel Generation Worker
   - Set up Azure Function
   - Implement ExcelJS generation
   - Upload to Azure Blob Storage
   - Test with sample sets

3. **Week 3:** Change Detection & Queue
   - Prisma middleware for DB operations
   - Identify affected sets
   - Queue regeneration jobs (with debouncing)

4. **Week 4:** Integration & Testing
   - CDN integration
   - Version management (keep 3 versions)
   - Automatic cleanup
   - Testing with production data

**Dependencies:**
- Azure account and resources
- Blob storage configured

**Blockers:** Azure Function deployment pipeline

---

## 🟠 HARD - Major Features (2-4 Months Each)

### Issue #23: Achievement System Implementation
**Difficulty:** ⭐⭐⭐⭐ (4/5)
**Estimated Time:** 2-3 months
**Type:** Complex Feature with Extensive Logic

**Why Hard:**
- 1200+ achievements to implement
- Complex tracking logic across entire system
- Real-time achievement checking
- Database schema with 7 new tables
- Leaderboard system
- Social features (sharing, following)
- Streak tracking
- 15 different categories

**Implementation Phases:**
1. **Phase 1:** Core Infrastructure (3 weeks)
   - Create 7 database tables
   - Achievement tracking service
   - API endpoints for achievements
   - Admin achievement management UI

2. **Phase 2:** Basic Achievements (3 weeks)
   - Collector achievements (200)
   - Set achievements (150)
   - Implement tracking hooks throughout app

3. **Phase 3:** Advanced Achievements (3 weeks)
   - Player/team achievements (300)
   - Special card achievements (200)
   - Financial achievements (100)

4. **Phase 4:** Social & Competitive (3 weeks)
   - Leaderboards
   - Achievement sharing
   - Streaks
   - Social features

**Dependencies:**
- User collections
- All card data
- Social features (#28) recommended first

**Blockers:** Large scope, needs dedicated focus

---

### Issue #9: Full Accounting System
**Difficulty:** ⭐⭐⭐⭐ (4/5)
**Estimated Time:** 3-4 months
**Type:** Complex Financial System

**Why Hard:**
- Complex financial calculations
- Batch inventory tracking (shipping materials)
- Multi-source sales tracking (eBay, COMC, in-person)
- Cost basis calculations over time
- Profit/loss reporting by set/series
- Asset valuation integration
- Tax reporting considerations
- Data export (CSV, tax forms)

**Implementation Phases:**
1. **Phase 1:** Database Schema (2 weeks)
   - sales table
   - shipping_materials table
   - shipping_material_batches table
   - sale_costs table
   - profit_reports table

2. **Phase 2:** Sales Tracking (3 weeks)
   - Record individual sales
   - Link to user_card
   - Track shipping materials used
   - Calculate fees (eBay, PayPal, etc.)
   - Associate costs with sales

3. **Phase 3:** Inventory Management (3 weeks)
   - Batch tracking for shipping materials
   - Cost per unit calculation
   - Automatic batch selection (FIFO)
   - Inventory alerts

4. **Phase 4:** Reporting & Analytics (3 weeks)
   - Profit/loss by set/series
   - Break-even analysis
   - ROI calculations
   - Asset value tracking
   - Tax reporting exports

5. **Phase 5:** UI & UX (3 weeks)
   - Sales entry form
   - Inventory management UI
   - Dashboard with charts
   - Report generation
   - CSV import/export

**Dependencies:**
- User collections
- Card valuation system (future)

**Blockers:** Requires deep financial domain knowledge

---

### Issue #24: eBay Integration System
**Difficulty:** ⭐⭐⭐⭐ (4/5)
**Estimated Time:** 2-3 months
**Type:** External API Integration with AI

**Why Hard:**
- OAuth 2.0 flow with eBay
- Webhook integration for purchase notifications
- AI-powered card detection and matching
- Uncertain card matching requires user review queue
- "In Transit" status management
- Rate limiting and API quota management
- Error handling for external service

**Implementation Phases:**
1. **Phase 1:** OAuth & Authentication (2 weeks)
   - eBay OAuth 2.0 flow
   - Token management and refresh
   - User account linking
   - API credentials management

2. **Phase 2:** Purchase Detection (2 weeks)
   - eBay webhook setup
   - Purchase notification handling
   - Parse eBay order data
   - Store in ebay_purchases table

3. **Phase 3:** AI Card Detection (3-4 weeks)
   - Train/use AI model for sports card detection
   - Extract card details from title/description/images
   - Match to database cards
   - Confidence scoring

4. **Phase 4:** User Review Queue (2 weeks)
   - UI for uncertain matches
   - Manual card selection
   - Bulk approval
   - "In Transit" status
   - Automatic collection addition on delivery

5. **Phase 5:** Sync & Maintenance (2 weeks)
   - Periodic sync jobs
   - Error handling and retries
   - User notification system
   - Settings and preferences

**Dependencies:**
- eBay Developer Account
- Database schema exists (✅)
- AI model for card detection (may need OpenAI API or custom model)

**Blockers:**
- eBay API approval process
- AI model training/selection

---

### Issue #29: Vouch & Trust System
**Difficulty:** ⭐⭐⭐⭐ (4/5)
**Estimated Time:** 2-3 months
**Type:** Complex Social System with Game Theory

**Why Hard:**
- Complex trust score algorithm (4 components)
- Weighted vouch calculations
- Dispute resolution system
- Prevent gaming/abuse
- Transaction history integration
- Community standing calculations
- Time-decay factors
- Revocation system

**Implementation Phases:**
1. **Phase 1:** Database Schema (2 weeks)
   - user_vouches table
   - vouch_transactions table
   - trust_scores table
   - trust_score_history table

2. **Phase 2:** Vouch System (3 weeks)
   - Vouch giving/receiving API
   - Vouch types (Transaction, Interaction, Knowledge)
   - Validation and fraud prevention
   - Revocation system

3. **Phase 3:** Trust Score Calculation (4 weeks)
   - Weighted vouch points algorithm
   - Transaction history component
   - Community standing component
   - Time factor component
   - Background job for recalculation

4. **Phase 4:** Dispute Resolution (3 weeks)
   - Dispute reporting
   - Admin review workflow
   - Vouch revocation for disputes
   - Trust score adjustments

5. **Phase 5:** UI & Integration (2 weeks)
   - Trust badges
   - User profiles
   - Transaction eligibility checks
   - Vouch history display

**Dependencies:**
- User system
- Social features (#28)
- Transaction system (future)

**Blockers:**
- Need to define transaction system first
- Complex algorithm requires testing and tuning

---

## 🔴 VERY HARD - Platform Development (6+ Months Each)

### Issue #26: Crowdsourcing System
**Difficulty:** ⭐⭐⭐⭐⭐ (5/5)
**Estimated Time:** 6-8 months
**Type:** Entire Economic & Quality Control System

**Why Very Hard:**
- Complete credit economy (virtual currency)
- Multi-tiered verification system
- Micro-task marketplace
- Quality assurance workflows
- Domain expertise tracking and badges
- Collaborative editing with conflict resolution
- Achievement integration
- Credit earning and redemption
- Subscription offset calculations
- Fraud prevention
- Gamification elements

**Implementation Phases:**
1. **Phase 1:** Credit Economy (4 weeks)
   - credit_ledger table
   - Credit earning rules
   - Credit redemption system
   - Subscription offset calculations
   - Admin credit management

2. **Phase 2:** Submission System (5 weeks)
   - submission_queue table
   - Card data submission forms
   - Series/set definition forms
   - Photo upload and processing
   - Batch submission tools

3. **Phase 3:** Review System (6 weeks)
   - review_queue table
   - Multi-tiered verification (Community → Expert)
   - Review assignment algorithm
   - Quality metrics tracking
   - Reputation system

4. **Phase 4:** Domain Expertise (4 weeks)
   - domain_expertise table
   - Specialty badges (Sport, Era, Manufacturer)
   - Expert certification process
   - Higher credit rates for experts
   - Expert-only tasks

5. **Phase 5:** Quality Assurance (4 weeks)
   - quality_metrics table
   - Accuracy tracking
   - Error detection
   - Contributor scoring
   - Automated quality checks

6. **Phase 6:** Gamification & Achievements (3 weeks)
   - Crowdsourcing achievements
   - Leaderboards
   - Recognition system
   - Credit multipliers

7. **Phase 7:** Collaborative Editing (4 weeks)
   - Version control for data
   - Conflict resolution
   - Edit history
   - Rollback capabilities

**Dependencies:**
- Achievement system (#23)
- User reputation system
- Payment processing (for subscription offsets)

**Blockers:**
- Massive scope
- Economic model needs careful design
- Legal/financial implications
- Requires community engagement strategy

---

### Issue #25: React Native Mobile Apps (iOS & Android)
**Difficulty:** ⭐⭐⭐⭐⭐ (5/5)
**Estimated Time:** 12 weeks (3 months) - Per MOBILE_APP_PLAN.md
**Type:** Entire New Platform

**Why Very Hard:**
- Completely new codebase (React Native)
- Offline-first architecture with SQLite
- Data synchronization logic
- Image caching strategy
- App Store submission process (iOS & Android)
- Push notifications setup
- Card scanning/OCR integration
- Native device features (camera, storage)
- Performance optimization for mobile
- Testing on multiple devices
- App store review process

**Implementation Phases (12 weeks):**

1. **Phase 1: Foundation (Weeks 1-2)**
   - Set up React Native with Expo
   - Configure TypeScript
   - Set up navigation (Expo Router)
   - Basic authentication flow
   - API integration

2. **Phase 2: Core Features (Weeks 3-5)**
   - Collection management
   - Card listing and detail views
   - Search and filtering
   - Basic CRUD operations
   - User profile

3. **Phase 3: Offline & Sync (Weeks 6-7)**
   - SQLite setup
   - Offline data storage
   - Sync logic (bidirectional)
   - Conflict resolution
   - Image caching

4. **Phase 4: Enhanced Features (Weeks 8-10)**
   - Push notifications
   - Card scanning/OCR
   - Photo gallery
   - Social features
   - Multiple view modes (grid, list)

5. **Phase 5: Polish & Launch (Weeks 11-12)**
   - Performance optimization
   - Bug fixes
   - Testing on devices
   - App Store submission
   - Google Play submission

**Dependencies:**
- API endpoints stable and versioned
- Authentication works cross-platform
- Image hosting supports mobile

**Blockers:**
- Apple Developer Account ($99/year)
- Google Play Developer ($25 one-time)
- Requires iOS device for testing
- App Store review can take 1-2 weeks

---

## 📊 Summary Matrix

| Issue | Difficulty | Time Estimate | Priority | Dependencies |
|-------|------------|---------------|----------|--------------|
| #22 - Save card edits faster | ⭐ | 1-2 days | HIGH | None |
| #17 - Card Detail page slow | ⭐⭐ | 2-3 days | HIGH | None |
| #13 - Edit card modal | ⭐⭐ | 2-3 days | MEDIUM | None |
| #28 - Social Features | ⭐⭐⭐ | 2-3 weeks | MEDIUM | None |
| #27 - Recommendation Engine | ⭐⭐⭐ | 3-4 weeks | MEDIUM | None |
| #30 - Spreadsheet Generation | ⭐⭐⭐ | 3-4 weeks | MEDIUM | Azure |
| #23 - Achievement System | ⭐⭐⭐⭐ | 2-3 months | MEDIUM | #28 helpful |
| #9 - Accounting System | ⭐⭐⭐⭐ | 3-4 months | LOW | None |
| #24 - eBay Integration | ⭐⭐⭐⭐ | 2-3 months | LOW | eBay API |
| #29 - Vouch & Trust System | ⭐⭐⭐⭐ | 2-3 months | LOW | #28 |
| #26 - Crowdsourcing System | ⭐⭐⭐⭐⭐ | 6-8 months | LOW | #23 |
| #25 - Mobile Apps | ⭐⭐⭐⭐⭐ | 3 months | MEDIUM | None |

---

## 🎯 Recommended Order

### Sprint 1: Quick Wins (1 week)
1. #22 - Save card edits faster (1-2 days)
2. #17 - Card Detail page slow (2-3 days)
3. #13 - Edit card modal (2-3 days)

**Rationale:** High user impact, low effort, builds momentum

---

### Sprint 2: Foundation Features (6-8 weeks)
4. #28 - Social Features (2-3 weeks)
5. #27 - Recommendation Engine (3-4 weeks)
6. #30 - Spreadsheet Generation (3-4 weeks)

**Rationale:** Medium complexity, enables other features, good user value

---

### Sprint 3: Major Features (Choose 1-2 based on business needs)
- Option A: #23 - Achievement System (2-3 months) - High engagement, gamification
- Option B: #24 - eBay Integration (2-3 months) - Unique feature, competitive advantage
- Option C: #9 - Accounting System (3-4 months) - Premium feature, monetization opportunity

**Rationale:** These are substantial features that will define the platform

---

### Sprint 4: Advanced Systems (Choose based on resources)
- #29 - Vouch & Trust System (if social/marketplace is core)
- #26 - Crowdsourcing System (if data quality is bottleneck)
- #25 - Mobile Apps (if user base demands mobile)

**Rationale:** These are strategic bets that require significant investment

---

## 💡 Strategic Recommendations

### Immediate Focus (Next 2 Weeks)
- **Do all three quick wins** (#22, #17, #13)
- These improve core user experience
- Low risk, high reward
- Builds confidence in execution

### Q1 2025 Focus
- **Social Features** (#28) - Enables community growth
- **Recommendation Engine** (#27) - Increases engagement
- **Spreadsheet Generation** (#30) - Reduces manual work

### Q2 2025 Focus
- **Achievement System** (#23) if engagement is priority
- **eBay Integration** (#24) if automation is priority
- **Accounting System** (#9) if monetization is priority

### Long-Term Strategy
- **Mobile Apps** (#25) - Wait until web platform is feature-complete
- **Crowdsourcing** (#26) - Wait until user base is large enough
- **Vouch System** (#29) - Wait until social features are established

---

*Last Updated: January 2025*
