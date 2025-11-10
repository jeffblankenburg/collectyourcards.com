# Claude Development Notes

## 🚨 CRITICAL: HOW TO WORK WITH THIS USER (READ FIRST - EVERY SESSION)

New tasks can be found in the GitHub Issues for this project.

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

---

## 🚨 CORE OPERATIONAL INFORMATION

### Important Facts & Credentials
- **Database password**: Password123
- **Admin user**: `cardcollector@jeffblankenburg.com` / `testpassword`
- **You never need to start or restart the servers. Ever.**

### 🚨 Database Location & Connection (CRITICAL - NEVER FORGET!)
- **Location**: Docker container named `collect-cards-db`
- **Image**: `mcr.microsoft.com/mssql/server:2022-latest`
- **Port**: localhost:1433 (mapped from container)
- **Connection**: `sqlserver://localhost:1433;database=CollectYourCards;user=sa;password=Password123;...`
- **Current Status**: ✅ FULLY RESTORED - **793,740 cards, 6,965 players, 135 teams**
- **Commands**:
  - `docker ps` - check container status
  - `docker logs collect-cards-db` - view SQL Server logs
  - `lsof -i :1433` - verify port usage

### Critical UI/UX Rules
- **NEVER USE JAVASCRIPT ALERTS** - Always use toast messages or inline error displays instead
- **NO MANUAL PAGINATION** - Never implement manual pagination (Previous/Next buttons, page numbers). Always use infinite scrolling for better UX
- **ADMIN TABLES FIRST COLUMN**: Always show database ID as first column in all admin tables for debugging/query purposes
- Use toast notifications for all success/error feedback
- Prefer inline validation and error messages in forms

### 📱 Responsive Design Requirements (MANDATORY)
- **MOBILE-FIRST APPROACH**: Every page MUST work perfectly on mobile devices (320px+)
- **REQUIRED BREAKPOINTS**: 320px, 480px, 768px, 1024px, 1200px+
- **TOUCH-FRIENDLY**: Minimum 44px touch targets for buttons/links
- **NO HORIZONTAL SCROLL**: Never allow horizontal scrolling on any screen size
- **GRID RESPONSIVENESS**: Use `auto-fit, minmax(280px, 1fr)` or smaller for mobile compatibility
- **NAVIGATION**: Must remain accessible on all screen sizes (implement hamburger menu for mobile)
- **TESTING REQUIREMENT**: Test every page at 320px, 768px, 1024px, and 1440px widths

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

#### 3. Database ID Privacy (ABSOLUTE RULE)
- **NEVER SHOW DATABASE IDS**: Database IDs must NEVER be shown in URLs or on screen
- **NO ID EXPOSURE**: Do not expose internal database IDs to users under any circumstances
- **USE ALTERNATIVE IDENTIFIERS**: Use slugs, natural keys, or other user-friendly identifiers instead

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

---



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

#### ⚠️ BIGINT SERIALIZATION RULES (CRITICAL)
**ALL BigInt fields MUST be converted to Number or String before JSON response:**

## 📚 ADDITIONAL DOCUMENTATION

For detailed historical information, completed features, and comprehensive database schema documentation, see:
- **CLAUDE_ARCHIVE.md** - Completed implementations, detailed schemas, API specs, UI component details
- **ACHIEVEMENTS.md** - Complete achievement system documentation
- **CROWDSOURCING.md** - Crowdsourcing strategy and implementation plan
- **DATABASE_CHANGE_TRACKING.md** - Production database change log
- **DATABASE_CHANGES_FOR_PRODUCTION.sql** - Ready-to-run production SQL scripts
- **PRODUCTION_CHANGES_NEEDED.md** - Pending production updates

---

*Last updated: January 2025*
