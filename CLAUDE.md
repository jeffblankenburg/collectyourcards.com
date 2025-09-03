# Claude Development Notes

## 🚨 CORE OPERATIONAL INFORMATION

### Important Facts & Credentials
- **Database password**: Password123
- **Admin user**: `cardcollector@jeffblankenburg.com` / `testpassword`

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

#### 📊 Mobile Analytics & Testing
- [ ] **Mobile usage tracking** - Screen sizes, touch patterns, performance
- [ ] **Mobile-specific error monitoring** - Touch events, orientation changes
- [ ] **Performance benchmarks** - Load times on 3G/4G networks
- [ ] **User testing** - Real collector feedback on mobile experience

### 🗣️ Social Features & Community System (IN DEVELOPMENT)

#### Card Comments System
- [ ] **Non-threaded discussions** on every card detail page
- [ ] **Authentication required** to post, edit, or delete comments  
- [ ] **Real-time comment updates** with WebSocket integration
- [ ] **Comment editing** - 15 minute window after posting
- [ ] **Rate limiting** - Maximum 5 comments per minute per user
- [ ] **Auto-subscription** - Users automatically subscribed to cards they comment on

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

#### Notification System
- [ ] **eBay-style notification bell** with unread count badge
- [ ] **Real-time notifications** via WebSocket
- [ ] **Notification types**: Comments, messages, system announcements
- [ ] **Notification preferences**: Granular control
- [ ] **Email integration**: Optional email notifications
- [ ] **Auto-cleanup**: 30-day retention

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

## 📚 COMPLETED SYSTEMS (Reference Only)

### ✅ Authentication System (FULLY IMPLEMENTED)
- **Complete user registration** with email verification via Azure Communication Services
- **Secure login** with JWT tokens and session management
- **Password reset** functionality with time-limited tokens
- **Role-based permissions**: user, data_admin, admin, superadmin
- **Account security**: Rate limiting, password complexity, account lockout after failed attempts
- **Audit logging**: All authentication events logged with IP/user agent
- **Session management**: Multiple sessions supported, individual and bulk logout
- **Middleware available**:
  - `authMiddleware` - JWT authentication 
  - `requireRole(roles)` - Role-based access control
  - `requireAdmin` - Admin only access
  - `requireDataAdmin` - Data admin or higher
  - `requireSuperAdmin` - Super admin only
- **Email templates**: Professional HTML emails for verification and password reset
- **Protected routes**: All user-specific endpoints use authentication middleware

### ✅ Test Suite Infrastructure (FULLY IMPLEMENTED)
- **Test Infrastructure**: Jest with supertest for API testing
- **Test Environment**: Separate .env.test configuration with mock email service
- **Authentication Tests**: Complete coverage of all 9 auth endpoints
- **Middleware Tests**: Auth middleware, role-based access, rate limiting
- **Status Endpoint Tests**: Health checks, database status, endpoint monitoring
- **Integration Tests**: End-to-end API testing with request/response validation
- **Unit Tests**: Individual component testing with proper mocking
- **Test Coverage**: 70% threshold for branches, functions, lines, statements
- **Mock Services**: Email service mocked to prevent actual emails during testing
- **Test Database**: Separate test database configuration (CollectYourCardsTest)

### ✅ Dynatrace Monitoring (FULLY OPERATIONAL)
- **OneAgent SDK**: Successfully integrated @dynatrace/oneagent-sdk package
- **Business Events**: 7 types of custom events actively tracked
- **System Metrics**: Memory, uptime, Node.js version collected every 60 seconds
- **API Performance**: Response times and status codes for all endpoints
- **Production Ready**: Docker Compose configuration with OneAgent container
- **Setup Guide**: Complete instructions in `DYNATRACE_SETUP_GUIDE.md`
- **Custom Dashboards**: USQL queries and dashboard configurations provided
- **Performance Impact**: < 2% CPU overhead, ~5-10MB memory per process
- **Zero Application Disruption**: Monitoring failures don't affect app functionality

### ✅ Status Page System (FULLY IMPLEMENTED)
- **Hidden diagnostics page at /status** showing all system health metrics
- **Auto-refreshes every 30 seconds**
- **Displays**: Frontend status, Backend API health, Database connectivity, All API endpoints, Environment info, Performance metrics
- **Available API endpoints**:
  - `/api/health` - Backend health check
  - `/api/database/status` - Database connectivity and record counts
  - `/api/endpoints/status` - List of all registered API endpoints
  - `/api/environment` - Sanitized environment information

### ✅ Database Restoration (COMPLETED Aug 12, 2025)
- **Complete database restore from .bacpac backup file**
- **793,740 cards** - fully restored and verified
- **6,965 players** - fully restored and verified  
- **135 teams** - fully restored and verified
- All missing tables recreated (import_jobs, duplicate_detection, user tracking, etc.)
- All schema compatibility issues resolved
- BigInt serialization issues in JWT responses fixed
- Prisma client regenerated to match current database schema

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