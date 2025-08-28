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
- **Connection**: `sqlserver://localhost:1433;database=CollectYourCards;user=sa;password=DevPassword123!;...`
- **Current Status**: ✅ FULLY RESTORED - **793,740 cards, 6,965 players, 135 teams**
- **Last Restored**: August 12, 2025 from .bacpac file dated August 3, 2024
- **Commands**: 
  - `docker ps` - check container status
  - `docker logs collect-cards-db` - view SQL Server logs
  - `lsof -i :1433` - verify port usage

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