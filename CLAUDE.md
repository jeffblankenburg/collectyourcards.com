# Claude Development Notes

## Important Facts:
- The database password is Password123

## STATUS PAGE (ALWAYS MAINTAIN)
- **Hidden diagnostics page at /status** showing all system health metrics
- Must be updated whenever new endpoints or monitorable entities are added
- Displays: Frontend status, Backend API health, Database connectivity, All API endpoints, Environment info, Performance metrics
- Auto-refreshes every 30 seconds
- Available API endpoints for monitoring:
  - `/api/health` - Backend health check
  - `/api/database/status` - Database connectivity and record counts
  - `/api/endpoints/status` - List of all registered API endpoints
  - `/api/environment` - Sanitized environment information

## CRITICAL UI/UX RULES
- **NEVER USE JAVASCRIPT ALERTS** - Always use toast messages or inline error displays instead
- **NO MANUAL PAGINATION** - Never implement manual pagination (Previous/Next buttons, page numbers). Always use infinite scrolling for better UX
- **ADMIN TABLES FIRST COLUMN**: Always show database ID as first column in all admin tables for debugging/query purposes
- **ICONOGRAPHY REVIEW NEEDED**: All application icons need comprehensive review for consistency, appropriateness, and sports-card specific relevance
- Use toast notifications for all success/error feedback
- Prefer inline validation and error messages in forms

## 📱 RESPONSIVE DESIGN (MANDATORY FOR ALL PAGES)
- **MOBILE-FIRST APPROACH**: Every page MUST work perfectly on mobile devices (320px+)
- **REQUIRED BREAKPOINTS**:
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

## AUTHENTICATION SYSTEM (FULLY IMPLEMENTED)
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

## COMPREHENSIVE TEST SUITE (FULLY IMPLEMENTED)
- **Test Infrastructure**: Jest with supertest for API testing
- **Test Environment**: Separate .env.test configuration with mock email service
- **Authentication Tests**: Complete coverage of all 9 auth endpoints
  - User registration with email verification
  - Login/logout with JWT validation  
  - Email verification and resend functionality
  - Password reset with time-limited tokens
  - Protected profile endpoints
  - Rate limiting validation
- **Middleware Tests**: Auth middleware, role-based access, rate limiting
- **Status Endpoint Tests**: Health checks, database status, endpoint monitoring
- **Integration Tests**: End-to-end API testing with request/response validation
- **Unit Tests**: Individual component testing with proper mocking
- **Test Coverage**: 70% threshold for branches, functions, lines, statements
- **Mock Services**: Email service mocked to prevent actual emails during testing
- **Test Database**: Separate test database configuration (CollectYourCardsTest)
- **Error Handling**: Comprehensive test coverage of error scenarios
- **Performance Tests**: Response time validation for critical endpoints

## Development Guidelines
- Always run lint and typecheck commands after making changes
- Use consistent styling patterns across components
- Follow existing code conventions in the codebase

## Testing
- Test functionality after implementation
- Ensure all API endpoints work correctly
- Verify user experience flows

## Location Management
- Locations are managed inline within the Collection page
- Quick location creation is available in all location dropdowns
- No separate locations page - everything integrated into Collection

## Card Management
- Add to Collection modal matches Edit dialog design
- Double-click to edit functionality on collection cards
- Delete functionality with confirmation dialogs
- All monetary values show 2 decimal places

## 🗣️ SOCIAL FEATURES & COMMUNITY SYSTEM (IN DEVELOPMENT)

### Card Comments System
- **Non-threaded discussions** on every card detail page
- **Authentication required** to post, edit, or delete comments  
- **Real-time comment updates** with WebSocket integration
- **Comment editing** - 15 minute window after posting
- **Rate limiting** - Maximum 5 comments per minute per user
- **Auto-subscription** - Users automatically subscribed to cards they comment on

### Community Moderation & Safety
#### Content Filtering Options:
- **Profanity Filter**: Automatic detection and filtering of inappropriate language
- **Keyword Blacklist**: Admin-configurable list of prohibited words/phrases
- **Content Analysis**: Integration with Azure Content Moderator API for automated screening
- **User Reporting System**: Community-driven reporting of inappropriate content
- **Spam Detection**: Pattern recognition for repetitive/promotional content

#### Moderation Tools:
- **Admin Dashboard**: Full comment moderation with approve/reject/edit capabilities
- **User Reputation System**: Trust scores based on community behavior
- **Temporary Suspensions**: Time-based commenting restrictions
- **Permanent Bans**: Complete platform access removal for severe violations
- **Comment Queue**: Pre-approval system for new users or flagged content
- **Audit Trail**: Complete logging of all moderation actions

#### Community Guidelines Enforcement:
- **Automated Warnings**: System-generated messages for borderline content
- **Escalation Paths**: Multi-tier review process for reported content
- **Appeal System**: Users can contest moderation decisions
- **Transparency Reports**: Regular community updates on moderation activities

### Notification System
- **eBay-style notification bell** with unread count badge in header
- **Real-time notifications** via WebSocket connections
- **Notification Types**:
  - Comments on cards you own
  - Comments on cards you've previously commented on
  - Direct messages received
  - System announcements and updates
  - Moderation actions affecting your account
- **Notification Preferences**: Granular control over notification types
- **Email Integration**: Optional email notifications for important events
- **Auto-cleanup**: Read notifications deleted after 30 days

### Direct Messaging System (FUTURE)
#### Core Features:
- **One-to-one messaging** between registered users
- **Message threads** with conversation history
- **Real-time delivery** with read receipts
- **Message search** and filtering capabilities
- **File attachments** (images, documents) with size limits
- **Message encryption** for privacy protection

#### Privacy & Safety:
- **Block/Unblock Users**: Comprehensive user blocking system
- **Message Reporting**: Report inappropriate direct messages
- **Content Filtering**: Same moderation tools apply to private messages
- **Privacy Settings**: Control who can message you (everyone, friends, nobody)

### Group Messaging System (FUTURE - PHASE 2)
#### Planned Features:
- **Topic-based channels** (similar to Discord)
- **Card-specific discussion rooms** automatically created for popular cards
- **Team/League channels** for collectors of specific teams
- **Moderated channels** with appointed community moderators
- **Role-based permissions** in group channels
- **Channel discovery** and subscription system

### Database Schema Extensions
#### New Tables Required:
```sql
card_comments - Comment system for card discussions
notifications - User notification management  
user_card_subscriptions - Notification preference tracking
direct_messages - Private messaging between users
message_threads - Conversation grouping
user_blocks - User blocking relationships
content_reports - Community reporting system
moderation_actions - Admin action audit trail  
user_reputation - Community trust scoring
group_channels - Future group messaging
channel_members - Group membership tracking
```

### API Endpoints Structure:
```
# Comments
GET/POST   /api/cards/:cardId/comments
PUT/DELETE /api/comments/:commentId

# Notifications  
GET        /api/notifications
PUT        /api/notifications/:id/read
POST       /api/notifications/mark-all-read

# Direct Messages (Future)
GET/POST   /api/messages
GET        /api/messages/threads
PUT        /api/messages/:id

# Moderation
GET/POST   /api/admin/reports
PUT        /api/admin/moderation/:actionId
```

### Technical Implementation Notes:
- **WebSocket Integration**: Real-time updates for comments and notifications
- **Content Moderation API**: Azure Content Moderator for automated screening
- **Rate Limiting**: Aggressive limits on social actions to prevent spam
- **Caching Strategy**: Redis caching for frequently accessed comments/notifications
- **Mobile Optimization**: All social features fully responsive
- **Accessibility**: Full screen reader support and keyboard navigation

## Current Architecture
- Frontend: React with Vite
- Backend: Express.js with Prisma ORM
- Database: **SQL Server 2022 running in Docker container**
- Authentication: **Comprehensive JWT-based system with email verification**
- Email Service: Azure Communication Services
- Security: Rate limiting, password hashing (bcrypt), account lockout protection

### 🚨 DATABASE LOCATION (CRITICAL - NEVER FORGET!)
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

## 📊 SQL SERVER SCHEMA REFERENCE (CRITICAL - ALWAYS CHECK!)

### ⚠️ BIGINT SERIALIZATION RULES
**ALL BigInt fields MUST be converted to Number or String before JSON response:**
```javascript
// ALWAYS DO THIS:
card_id: Number(row.card_id)
// OR THIS:
card_id: row.card_id.toString()
// NEVER THIS:
card_id: row.card_id  // Will cause "Cannot convert BigInt to JSON" error
```

### 📋 Core Tables Schema

#### `card` Table
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
| created_month | date | YES | |

#### `user_card` Table  
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
| card_variation | **bigint** | YES | FK - **REQUIRES SERIALIZATION** |
| grading_agency | int | YES | |
| grade | decimal | YES | |
| grade_id | **bigint** | YES | **REQUIRES SERIALIZATION** |
| aftermarket_autograph | bit | YES | |
| is_for_sale | bit | YES | |
| is_wanted | bit | YES | |
| is_special | bit | YES | |
| is_labeled | bit | YES | |
| user_location | **bigint** | YES | FK - **REQUIRES SERIALIZATION** |
| random_code | nvarchar(MAX) | YES | |
| created | datetime | YES | |
| ebay_purchase_id | **bigint** | YES | **REQUIRES SERIALIZATION** |

#### `series` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| series_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| name | nvarchar(MAX) | YES | |
| set | int | YES | FK to set |
| card_count | int | NO | Default: 0 |
| created | datetime | NO | |
| card_entered_count | int | YES | |
| is_base | bit | YES | |
| parallel_of_series | **bigint** | YES | **REQUIRES SERIALIZATION** |
| front_image_path | nvarchar(MAX) | YES | |
| back_image_path | nvarchar(MAX) | YES | |
| min_print_run | int | YES | |
| max_print_run | int | YES | |
| print_run_variations | int | YES | |
| print_run_display | nvarchar(50) | YES | |
| rookie_count | int | YES | |
| color | int | YES | FK to color |

#### `user` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| user_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| name | nvarchar(MAX) | YES | Display name |
| email | nvarchar(255) | YES | Unique |
| created | datetime | YES | |
| created_at | datetime | YES | |
| first_name | nvarchar(100) | YES | |
| last_name | nvarchar(100) | YES | |
| is_active | bit | YES | Default: true |
| is_verified | bit | YES | Default: false |
| last_login | datetime | YES | |
| locked_until | datetime | YES | |
| login_attempts | int | YES | Default: 0 |
| password_hash | nvarchar(500) | YES | |
| reset_token | nvarchar(500) | YES | |
| reset_token_expires | datetime | YES | |
| role | nvarchar(50) | YES | Default: 'user' |
| updated_at | datetime | YES | |
| verification_token | nvarchar(500) | YES | |

#### `player` Table  
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| player_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| first_name | nvarchar(MAX) | YES | |
| last_name | nvarchar(MAX) | YES | |
| nick_name | nvarchar(MAX) | YES | |
| birthdate | datetime | YES | |
| created | datetime | YES | |
| is_hof | bit | YES | Hall of Fame |
| card_count | int | YES | |

#### `team` Table
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| team_Id | int | NO | Primary key - Regular int, not bigint |
| name | nvarchar(MAX) | YES | Full team name (includes city) |
| city | nvarchar(MAX) | YES | |
| mascot | nvarchar(MAX) | YES | |
| abbreviation | nvarchar(MAX) | YES | |
| organization | int | YES | FK to organization |
| created | datetime | NO | |
| primary_color | nvarchar(MAX) | YES | |
| secondary_color | nvarchar(MAX) | YES | |
| card_count | int | YES | |
| player_count | int | YES | |

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

### 💰 Money Field Formatting
```javascript
// Money fields return as decimal objects
// Always format to 2 decimal places for display
purchase_price: row.purchase_price ? Number(row.purchase_price).toFixed(2) : '0.00'
```

### 📝 Text Field Notes
- `nvarchar(MAX)` fields can contain Unicode characters
- `nvarchar(-1)` in schema info means MAX length
- Always handle NULL values appropriately

### 🔗 Junction & Auth Tables

#### `card_player_team` Table (Junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| card_player_team_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| card | **bigint** | YES | FK to card - **REQUIRES SERIALIZATION** |
| player_team | **bigint** | YES | FK to player_team - **REQUIRES SERIALIZATION** |
| created | datetime | NO | |

#### `player_team` Table (Junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| player_team_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| player | **bigint** | YES | FK to player - **REQUIRES SERIALIZATION** |
| team | int | YES | FK to team - Regular int |
| created | datetime | NO | |

#### `user_session` Table (Auth)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| session_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| user_id | **bigint** | NO | FK to user - **REQUIRES SERIALIZATION** |
| session_token | nvarchar(500) | NO | |
| expires_at | datetime | NO | |
| created | datetime | NO | |
| last_accessed | datetime | YES | |
| ip_address | varchar(45) | YES | |
| user_agent | varchar(500) | YES | |
| token_hash | nvarchar(500) | YES | |

#### `user_auth_log` Table (Auth)
| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| log_id | **bigint** | NO | Primary key - **REQUIRES SERIALIZATION** |
| user_id | **bigint** | YES | FK to user - **REQUIRES SERIALIZATION** |
| email | nvarchar(255) | YES | |
| event_type | varchar(50) | NO | |
| ip_address | varchar(45) | YES | |
| user_agent | varchar(500) | YES | |
| success | bit | NO | Default: true |
| error_message | nvarchar(MAX) | YES | |
| created | datetime | NO | |

### 🚨 DATABASE CHANGES (CRITICAL - ALWAYS CHECK!)
- **📋 MUST READ**: `DATABASE_CHANGE_TRACKING.md` - Complete change log for production
- **📋 MUST READ**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` - Ready-to-run SQL for production
- **🚨 RULE**: Every database change MUST be documented in tracking file immediately
- **✅ PRODUCTION SYNC**: All database changes applied to production (Aug 15, 2025)

## 🎊 MAJOR RESTORATION COMPLETE (Aug 12, 2025)

### ✅ Database Restoration Status
- **Complete database restore from .bacpac backup file**
- **793,740 cards** - fully restored and verified
- **6,965 players** - fully restored and verified  
- **135 teams** - fully restored and verified
- All missing tables recreated (import_jobs, duplicate_detection, user tracking, etc.)
- All schema compatibility issues resolved

### ✅ Authentication System Status  
- **Login system working perfectly** - frontend authentication successful
- Fixed BigInt serialization issues in JWT responses
- User/UserSession/UserAuthLog tables fully functional
- Admin user: `cardcollector@jeffblankenburg.com` / `testpassword`
- Prisma client regenerated to match current database schema

### ✅ Import System Status
- **6-stage spreadsheet import system ready for testing**
- All API endpoints mounted and secured with authentication
- User successfully accessed import UI and attempted series detection
- Stage 1 (Series Detection) UI fully functional
- Stages 2-6 ready for completion and testing

### 📋 IMMEDIATE NEXT STEPS
1. **Fix remaining BigInt serialization issues** in admin/import API endpoints (500 errors)
2. **Test import system** with reference spreadsheets (full end-to-end testing)
3. **Complete Stages 4-6** of import system (Entity Save, Card Review, Card Import)
4. **Implement enhanced fuzzy matching** for players/teams
5. **Implement database backup strategy** to prevent future data loss

### 🔧 Key Scripts Created During Restoration
- `update_user_table.js` - Fixed authentication tables
- `fix_auth_log_columns.js` - Renamed action_type to event_type
- `fix_session_table.js` - Added missing session columns
- `restore_all_missing_tables.js` - Comprehensive table restoration
- `new_tables_to_restore.sql` - Complete restoration script

## Data Field Notes
- **Team names**: Use `team.name` only (already includes city) - do NOT concatenate with `team.city`
- **Player names**: Use `first_name + last_name` format
- **Location fields**: `location` (name) and `location_id` (ID) - maintain both for proper display and updates
- **Color columns**: Always center-align color value tags in table columns (`textAlign: 'center'`)

# 🚨 CORE DEVELOPMENT STANDARDS (NEVER VIOLATE)

## 1. Feature Request Management
- **RECORD EVERY REQUEST**: All feature requests, no matter how small, must be documented immediately
- **ORGANIZED TRACKING**: Keep feature lists organized, prioritized, and tidy
- **COMPLETION TRACKING**: Mark features as completed when delivered

## 2. Database Protection (CRITICAL)
- **NEVER DELETE DATABASE**: Under no circumstances delete the database without explicit instruction
- **NEVER DELETE RECORDS**: Do not delete database records without explicit user permission
- **BACKUP BEFORE CHANGES**: Always ensure data safety before schema modifications
- **AUDIT ALL CHANGES**: Log all database modifications for accountability

## 3. Database ID Privacy (ABSOLUTE RULE)
- **NEVER SHOW DATABASE IDS**: Database IDs must NEVER be shown in URLs or on screen
- **NO ID EXPOSURE**: Do not expose internal database IDs to users under any circumstances
- **USE ALTERNATIVE IDENTIFIERS**: Use slugs, natural keys, or other user-friendly identifiers instead
- **SECURITY BY DESIGN**: Database IDs are internal implementation details and must remain hidden

## 4. Test-Driven Development (MANDATORY)
- **TESTS BEFORE CODE**: Always write tests before implementing new features
- **ALL TESTS MUST PASS**: Before writing new code, ensure all existing tests pass
- **NEW TESTS MUST PASS**: New code must make the new tests pass
- **NO UNTESTED CODE**: Every feature must have corresponding test coverage

## 5. CI/CD Pipeline (ZERO FAILURES)
- **CLEAN PIPELINE**: Maintain clean CI/CD between local → GitHub → Azure production
- **NO FAILED GATES**: GitHub CI/CD integration gates must never fail
- **AUTOMATED DEPLOYMENT**: Ensure seamless deployment process
- **ROLLBACK CAPABILITY**: Always maintain ability to rollback changes

## 6. Monitoring & Diagnostics (FULLY IMPLEMENTED)
- **DYNATRACE INTEGRATION**: ✅ Complete OneAgent SDK integration with custom business events
- **EASY DIAGNOSIS**: ✅ Comprehensive tracking of API calls, auth events, database operations
- **PERFORMANCE TRACKING**: ✅ Real-time monitoring with response times and system metrics  
- **PROACTIVE ALERTING**: 📋 Production alerts configuration ready (see DYNATRACE_SETUP_GUIDE.md)

## 7. Code Quality Standards
- **NO CLEVER CODE**: Avoid clever/complex solutions in favor of clear, understandable code
- **CONSISTENT NAMING**: Use clear, consistent naming conventions throughout
- **READABLE CODE**: Code should be self-documenting and easy to understand
- **UNIFORM PATTERNS**: Follow established patterns consistently across codebase

## 8. Production Synchronization (CRITICAL)
- **IMMEDIATE DOCUMENTATION**: Document all dev changes that need production updates
- **SCHEMA CHANGES**: Track all database schema modifications for production
- **ENVIRONMENT VARIABLES**: Document new/changed .env requirements
- **CONFIGURATION UPDATES**: Track all config changes needed in production
- **DEPLOYMENT CHECKLIST**: Maintain checklist of production update requirements

## Production Change Tracking
When making development changes that affect production, immediately update:
- `PRODUCTION_CHANGES_NEEDED.md` - List of pending production updates
- Include: database schema changes, environment variables, configuration updates
- Mark as completed when applied to production environment

## 🔍 DYNATRACE MONITORING (FULLY OPERATIONAL)

### ✅ Current Implementation Status
- **OneAgent SDK**: Successfully integrated @dynatrace/oneagent-sdk package
- **Business Events**: 7 types of custom events actively tracked
- **System Metrics**: Memory, uptime, Node.js version collected every 60 seconds
- **API Performance**: Response times and status codes for all endpoints
- **Production Ready**: Docker Compose configuration with OneAgent container

### 📊 Active Monitoring Components
1. **API Call Tracking**: Every endpoint call with response time, status code, user ID
   ```javascript
   📊 Dynatrace business event: api_call {
     endpoint: '/api/health',
     response_time_ms: 2,
     status_code: 200,
     user_id: null
   }
   ```

2. **Authentication Events**: Login, registration, verification, password resets
   - Success/failure rates
   - IP address and user agent tracking
   - Error message logging for debugging

3. **Database Operations**: Prisma query monitoring (middleware ready)
   - Query duration tracking
   - Operation success rates
   - Table-specific performance metrics

4. **Email Events**: Azure Communication Services integration
   - Email send success/failure tracking
   - Verification and password reset emails

5. **System Health**: Automatic resource monitoring
   - Memory usage (RSS, heap)
   - Process uptime
   - Node.js version tracking
   - Environment identification

6. **Import Progress**: Spreadsheet import job tracking (when implemented)
   - Stage completion percentages
   - Error count tracking
   - Row processing statistics

7. **Collection Events**: Card management activities (when implemented)
   - Add/edit/delete operations
   - User activity patterns

### 🚀 Production Deployment
- **Setup Guide**: Complete instructions in `DYNATRACE_SETUP_GUIDE.md`
- **Docker Integration**: Production-ready `docker-compose.monitoring.yml`
- **Environment Variables**: 4 required variables for production (documented)
- **Custom Dashboards**: USQL queries and dashboard configurations provided

### 📈 Performance Impact
- **CPU Overhead**: < 2% additional load
- **Memory Usage**: ~5-10MB per process
- **Event Latency**: < 1ms per tracked event
- **Zero Application Disruption**: Monitoring failures don't affect app functionality

### 🔔 Alerting Strategy
Ready-to-implement alerts for:
- API error rates > 5%
- Response times > 1000ms
- Database failures > 1%
- Authentication issues > 10%
- Memory usage > 80%

### 🛡️ Security & Privacy
- No sensitive data in custom events (passwords, keys excluded)
- Secure token-based authentication with Dynatrace
- IP tracking limited to authentication events for security
- Environment variable protection for all credentials