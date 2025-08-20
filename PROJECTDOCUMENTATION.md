# Collect Your Cards - Comprehensive Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Requirements](#core-requirements)
3. [Database Schema](#database-schema)
4. [Features Implemented](#features-implemented)
5. [UI/UX Decisions](#uiux-decisions)
6. [Technical Architecture](#technical-architecture)
7. [Unbreakable Tenets](#unbreakable-tenets)
8. [API Endpoints](#api-endpoints)
9. [Authentication & Security](#authentication--security)
10. [Performance Optimizations](#performance-optimizations)
11. [Deployment Requirements](#deployment-requirements)
12. [Known Issues & Solutions](#known-issues--solutions)

---

## Project Overview

**Collect Your Cards** is a comprehensive trading card collection management system designed for serious collectors. The application allows users to browse a vast database of trading cards, manage their personal collections, track card values, and gain insights into their collecting patterns.

### Primary Goals
- Provide a fast, intuitive interface for browsing millions of trading cards
- Enable collectors to easily manage and track their personal collections
- Offer insights and analytics about collection value and completeness
- Support multiple users with secure, isolated collections
- Scale to handle large datasets (10,000,000+ cards, 10,000+ series, 50,000+ players)

### Target Users
- Serious trading card collectors
- Card shop owners tracking inventory
- Collectors wanting to track collection value
- Users seeking to complete specific sets or series

---

## Core Requirements

### Functional Requirements
1. **Browse & Search**
   - Search across players, teams, series, and cards
   - Filter by year, manufacturer, team, color, attributes
   - View detailed information for each entity
   - Support for parallel series relationships

2. **Collection Management**
   - Add/remove cards from personal collection
   - Track quantity owned of each card
   - Mark cards as special/favorite
   - Track card condition and grading
   - Record purchase price and current value

3. **User Dashboard**
   - Collection statistics (total cards, unique series, players)
   - Collection value tracking (estimated and current)
   - Collection health score and recommendations
   - Recent activity feed
   - Goal tracking and completion progress

4. **Performance**
   - Sub-second response times for searches
   - Infinite scrolling for large datasets
   - Optimistic UI updates
   - Minimal page refreshes

### Non-Functional Requirements
- **Scalability**: Handle millions of cards, thousands of users
- **Security**: JWT-based authentication, secure API endpoints
- **Responsiveness**: Mobile-friendly design
- **Reliability**: Graceful error handling, data consistency
- **Accessibility**: Keyboard navigation, screen reader support

---

## Database Schema

### Core Tables

#### Users
```sql
- user_id (BIGINT, Primary Key)
- email (VARCHAR, Unique, Required)
- name (VARCHAR)
- password_hash (VARCHAR)
- created (DATETIME)
- modified (DATETIME)
```

#### Cards
```sql
- card_id (INT, Primary Key)
- card_number (VARCHAR)
- series (INT, Foreign Key → Series)
- color (INT, Foreign Key → Colors)
- print_run (INT)
- is_autograph (BIT)
- is_relic (BIT)
- is_rookie (BIT)
- notes (TEXT)
- sort_order (INT)
```

#### Series
```sql
- series_id (INT, Primary Key)
- name (VARCHAR, Required)
- set (INT, Foreign Key → Sets)
- parallel_of_series (INT, Foreign Key → Series, Self-reference)
- card_count (INT, Calculated/Cached)
- front_image_path (VARCHAR)
- back_image_path (VARCHAR)
```

#### Sets
```sql
- set_id (INT, Primary Key)
- name (VARCHAR, Required)
- year (INT, Required)
- manufacturer (INT, Foreign Key → Manufacturers)
- organization (INT, Foreign Key → Organizations)
```

#### Players
```sql
- player_id (INT, Primary Key)
- first_name (VARCHAR)
- last_name (VARCHAR)
- nick_name (VARCHAR)
- birthdate (DATE)
- is_hof (BIT)
- card_count (INT, Calculated/Cached)
```

#### Teams
```sql
- team_id (INT, Primary Key)
- name (VARCHAR, Required)
- city (VARCHAR)
- mascot (VARCHAR)
- abbreviation (VARCHAR(3))
- primary_color (VARCHAR(7), Hex color)
- secondary_color (VARCHAR(7), Hex color)
- organization (INT, Foreign Key → Organizations)
- card_count (INT, Calculated/Cached)
```

#### User_Cards (Collection)
```sql
- user_card_id (BIGINT, Primary Key)
- user (BIGINT, Foreign Key → Users)
- card (INT, Foreign Key → Cards)
- quantity (INT, Default: 1)
- grade (DECIMAL)
- grading_agency (VARCHAR)
- is_special (BIT)
- purchase_price (DECIMAL)
- estimated_value (DECIMAL)
- current_value (DECIMAL)
- created (DATETIME)
- modified (DATETIME)
```

#### Junction Tables
- **Card_Player_Teams**: Links cards to player-team combinations
- **Player_Teams**: Links players to teams (with optional years)
- **User_Players**: Tracks recently viewed players per user
- **User_Series**: Tracks recently viewed series per user

### Database Indexes (Critical for Performance)
```sql
CREATE INDEX idx_card_series ON cards(series);
CREATE INDEX idx_card_player_team_card ON card_player_teams(card);
CREATE INDEX idx_card_player_team_player_team ON card_player_teams(player_team);
CREATE INDEX idx_player_team_player ON player_teams(player);
CREATE INDEX idx_player_team_team ON player_teams(team);
CREATE INDEX idx_user_card_user ON user_cards(user);
CREATE INDEX idx_user_card_card ON user_cards(card);
CREATE INDEX idx_series_set ON series(set);
CREATE INDEX idx_series_parallel ON series(parallel_of_series);
```

---

## Features Implemented

### 1. Browse & Discovery
- **Entity Search**: Unified search across players, series, and teams
- **Card Tables**: AG-Grid implementation with infinite scrolling
- **Disambiguation**: Handle multiple players/series with same name
- **Parallel Series**: Display and navigate parallel/variant relationships
- **Quick Navigation**: Direct links between related entities

### 2. Collection Management
- **Quick Add**: One-click add to collection from any card table
- **Bulk Operations**: Add multiple cards at once
- **Collection View**: Dedicated page showing only owned cards
- **Ownership Indicators**: Visual badges and row highlighting for owned cards
- **Quantity Tracking**: Track multiple copies of the same card

### 3. User Experience
- **Dashboard**: Comprehensive overview of collection statistics
- **Collection Health**: Score and recommendations for collection improvement
- **Goal Tracking**: Automatic goals based on series completion
- **Recent Activity**: Track recently added cards and viewed players
- **Value Tracking**: Monitor collection value over time

### 4. Search & Filtering
- **Multi-field Search**: Search across card numbers, players, series
- **Smart Search**: Handle partial matches and multi-word queries
- **Type-ahead**: Suggestions while typing
- **Filter Persistence**: Remember filters during navigation

### 5. Performance Features
- **Infinite Scrolling**: Load cards on demand as user scrolls
- **Lazy Loading**: Load images and data only when needed
- **Optimistic Updates**: Update UI before server confirmation
- **Caching**: Cache frequently accessed data
- **Pagination**: Server-side pagination for large datasets

---

## UI/UX Decisions

### Design Principles
1. **Clarity Over Cleverness**: Simple, obvious interfaces
2. **Performance First**: Speed is a feature
3. **Mobile Responsive**: Works on all screen sizes, claude doctor
4. **Consistent Patterns**: Same interactions work everywhere
5. **Progressive Disclosure**: Show details on demand

### Visual Design System

#### Color Palette
First and foremost, this should look clean and modern.  Not for children, but also not some clunky business application.

```css
/* Primary Colors */
--primary: #4f46e5;      /* Indigo - Primary actions */
--primary-hover: #4338ca; /* Darker indigo - Hover states */

/* Success/Collection */
--success: #10b981;      /* Green - Owned cards, success */
--success-light: #f0fdf4; /* Light green - Owned card backgrounds */

/* Status Colors */
--warning: #f59e0b;      /* Amber - Warnings */
--error: #dc2626;        /* Red - Errors */
--info: #3b82f6;         /* Blue - Information */

/* Neutrals */
--gray-50: #f9fafb;      /* Lightest backgrounds */
--gray-100: #f3f4f6;     /* Light backgrounds */
--gray-500: #6b7280;     /* Muted text */
--gray-900: #1f2937;     /* Primary text */
```

#### Component Patterns

**Cards & Tables**
- White background with subtle shadow
- 8px border radius
- Clear headers with uppercase labels
- Hover states for interactive elements

**Buttons**
- Primary: Filled background, white text
- Secondary: Outlined, colored text
- Consistent padding: 8px 16px
- Clear hover and disabled states

**Feedback Messages**
- Toast notifications (non-blocking)
- Auto-dismiss after 3-5 seconds
- Color-coded by type (success/error/warning)
- Slide-in animation from top

**Owned Card Indicators**
- Green badge with count (e.g., "2")
- Light green row background
- 3px green left border
- Darker green on hover

### Navigation Structure
```
/                     → Home
/dashboard           → User dashboard with all relevant data at their fingertips
/browse              → Browse all cards with search
/collection          → User's collection (protected)
/series              → All series index
/series/:slug        → Series detail with cards
/players             → All players index  
/player/:slug        → Player detail with cards
/sets                → All sets index
/set/:slug           → Set detail with series
/login               → User login
/signup              → User registration
```

---

## Technical Architecture

### Frontend Stack
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **State Management**: React Context (AuthContext)
- **Data Grid**: AG-Grid Community Edition
- **Styling**: CSS Modules + Global styles
- **HTTP Client**: Native fetch with auth headers

### Backend Stack
- **Runtime**: Node.js with Express
- **Database ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **CORS**: Enabled for development

### API Architecture
- RESTful design principles
- JWT-based authentication
- Consistent error handling
- BigInt support for large IDs
- Pagination on all list endpoints

---

## Unbreakable Tenets

### ⚠️ THESE RULES MUST NEVER BE BROKEN ⚠️

1. **Infinite Scrolling Implementation**
   - ALWAYS use AG-Grid's built-in virtual scrolling
   - NEVER re-implement scroll detection logic
   - Use `onBodyScroll` event with proper throttling (1000ms minimum)
   - Check for `hasMore` before loading
   - Prevent duplicate loads with `isLoadingMore` flag

2. **Database Performance**
   - ALWAYS include proper indexes before deployment
   - NEVER fetch all cards without pagination
   - Limit default page size to 100 records
   - Use calculated/cached counts (card_count fields)
   - Include user collection data only when authenticated

3. **API Consistency**
   - ALL protected endpoints require JWT authentication
   - ALL list endpoints must support pagination
   - ALL responses use consistent error format
   - ALWAYS convert BigInt to Number for JSON serialization
   - Use `optionalAuth` middleware for public endpoints that benefit from auth

4. **URL Patterns**
   - Frontend routes: Use slug format (e.g., `/player/shane-bieber`)
   - Image paths: Store relative, serve through static middleware
   - NEVER use relative API URLs in frontend

5. **State Management**
   - Authentication state in AuthContext
   - Collection data fetched on-demand
   - No global state for card data
   - Refresh data after mutations
   - Clear error states on retry

6. **User Experience**
   - Quick Add buttons on all card tables when logged in
   - Visual indicators for owned cards (badge + highlighting)
   - Loading states for all async operations
   - Error boundaries around major components
   - Toast notifications for user actions (non-blocking)

7. **Search Implementation**
   - Split multi-word searches into individual terms
   - Search across multiple fields with OR logic
   - Return players, series, AND teams from entity search
   - Support partial matches (contains, not exact)
   - Case-insensitive search

---

## API Endpoints

### Public Endpoints

#### Search & Browse
```
GET /api/cards
  Query params: page, limit, series_id, player_id, search
  Returns: { cards: [], pagination: {} }
  Auth: Optional (includes user_cards if authenticated)

GET /api/search/entities?search=term
  Returns: { players: [], series: [], teams: [] }
  Auth: None required

GET /api/series
  Returns: Array of all series with set information
  Auth: None required

GET /api/series/search?name=term
  Returns: Series matching name
  Auth: None required

GET /api/players/search/:playerSlug
  Returns: Players matching slug format
  Auth: None required

GET /api/players/popular
  Returns: 20 most viewed players across all users
  Auth: None required
```

### Protected Endpoints (Require Authentication)

#### User Collection
```
GET /api/collection/stats
  Returns: { totalCards, totalValue, uniqueSeries, uniquePlayers, recentActivity }
  Auth: Required

GET /api/collection/insights
  Returns: { duplicateCount, cardsNeedingCondition, collectionHealth }
  Auth: Required

GET /api/collection/goals
  Returns: Array of collection goals with progress
  Auth: Required

GET /api/user/cards
  Returns: User's complete collection
  Auth: Required

POST /api/user/cards
  Body: { cardId, quantity, grade, purchase_price, etc. }
  Returns: Created user_card record
  Auth: Required

PUT /api/user/cards/:userCardId
  Body: { updates }
  Returns: Updated user_card record
  Auth: Required

DELETE /api/user/cards/:userCardId
  Returns: Success message
  Auth: Required
```

#### User Activity
```
GET /api/players/recent
  Returns: 20 most recently viewed players for user
  Auth: Required

POST /api/players/visit
  Body: { playerId }
  Returns: Success (records visit, maintains 20 most recent)
  Auth: Required
```

#### Authentication
```
POST /api/auth/signup
  Body: { email, password, name }
  Returns: { token, user }

POST /api/auth/login
  Body: { email, password }
  Returns: { token, user }

GET /api/auth/me
  Returns: Current user information
  Auth: Required
```

---

## Authentication & Security

### JWT Implementation
```javascript
// Token structure
{
  userId: "1234567890",
  email: "user@example.com",
  name: "John Doe",
  iat: 1234567890,
  exp: 1234567890
}

// Token expiry: 7 days
// Storage: localStorage
// Header format: Authorization: Bearer <token>
```

### Security Measures
1. Password hashing with bcrypt (10 rounds)
2. JWT tokens with 7-day expiry
3. Secure headers on all API responses
4. Input validation on all endpoints
5. SQL injection prevention via Prisma ORM
6. CORS configured for production domain

### User Roles
- **User**: Can manage own collection
- **Admin**: Can edit card database (future)

---

## Performance Optimizations

### Database Optimizations
1. **Cached Counts**: Pre-calculated `card_count` on teams, players, series
2. **Compound Indexes**: Multi-column indexes for common queries
3. **Eager Loading**: Include related data in single query
4. **Pagination**: Server-side pagination with limits
5. **Query Optimization**: Raw SQL for complex aggregations

### Frontend Optimizations
1. **Virtual Scrolling**: AG-Grid handles large datasets
2. **Lazy Loading**: Components loaded on demand
3. **Image Optimization**: Serve appropriate sizes
4. **Bundle Splitting**: Separate vendor and app bundles
5. **Memoization**: useMemo for expensive calculations

### API Optimizations
1. **Response Caching**: 15-minute cache for static data
2. **Compression**: gzip responses
3. **Connection Pooling**: Reuse database connections
4. **Batch Operations**: Multiple operations in single request
5. **Partial Responses**: Only send required fields

---

## Deployment Requirements

### Azure App Service Requirements
1. **Node.js Version**: 18.x or higher
2. **Environment Variables**:
   ```
   NODE_ENV=production
   DATABASE_URL=<Azure SQL connection string>
   JWT_SECRET=<secure random string>
   PORT=<Azure assigned port>
   ```
3. **Startup Command**: `node server.js`
4. **Health Check Endpoint**: `/api/health` (to implement)

### Database Migration
1. **From SQLite to MSSQL/Azure SQL**:
   - Update Prisma schema for SQL Server provider
   - Adjust data types (BIGINT → BIGINT, etc.)
   - Update connection string format
   - Run migrations with `prisma migrate deploy`

2. **Schema Changes for SQL Server**:
   ```prisma
   datasource db {
     provider = "sqlserver"
     url      = env("DATABASE_URL")
   }
   ```

3. **Connection String Format**:
   ```
   sqlserver://server:port;database=dbname;user=username;password=pass;encrypt=true
   ```

### Build Process
```bash
# Frontend build
npm run build

# Database setup
npx prisma generate
npx prisma migrate deploy

# Start server
node server.js
```

### Static Assets
- Serve built React app from Express
- Configure for SPA routing (catch-all to index.html)
- Serve images from `/public/images`

---

## Known Issues & Solutions

### Issue 1: Infinite Scroll Triggering Multiple Times
**Problem**: Scroll events fire repeatedly, causing duplicate API calls
**Solution**: Implement throttling (1000ms) and `isLoadingMore` flag check

### Issue 2: BigInt JSON Serialization
**Problem**: JavaScript can't serialize BigInt to JSON
**Solution**: Convert BigInt to Number in `convertBigInts` helper

### Issue 3: Player Search Not Finding Full Names
**Problem**: Searching "Cleveland Guardians" doesn't find the player
**Solution**: Split multi-word searches and search each word independently

### Issue 4: API 404 Errors for Collection Endpoints
**Problem**: Collection endpoints return 404 when not authenticated
**Solution**: Check authentication before calling protected endpoints

### Issue 5: Database Timeout on Large Queries
**Problem**: Missing indexes cause slow queries
**Solution**: Add proper indexes on all foreign keys and search fields

### Issue 6: CORS Issues in Development
**Problem**: Frontend can't reach backend on different ports
**Solution**: Enable CORS with proper origin configuration

### Issue 7: React Double-Rendering in Development
**Problem**: StrictMode causes effects to run twice
**Solution**: Use cleanup functions and handle idempotency

---

## Future Enhancements

### High Priority
1. **Trading/Marketplace**: User-to-user trading system
2. **Want Lists**: Track cards users are seeking
3. **Price History**: Track card values over time
4. **Mobile App**: Native iOS/Android applications
5. **Bulk Import**: CSV/Excel import for collections

### Medium Priority
1. **Social Features**: Follow other collectors
2. **Collection Sharing**: Public collection URLs
3. **Advanced Analytics**: Market trends, investment tracking
4. **Card Images**: Upload/display actual card images
5. **Grading Integration**: Connect to PSA/BGS APIs

### Low Priority
1. **Forums/Community**: Discussion boards
2. **Blog/News**: Card market news
3. **Auction Tracking**: eBay integration
4. **Print Run Tracking**: Detailed parallel information
5. **Team Collections**: Shared team/group collections

---

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start database (if using local)
npx prisma generate
npx prisma migrate dev

# Seed database (if needed)
npx prisma db seed

# Start backend server
node server.js

# Start frontend dev server
npm run dev

# Run both concurrently
npm run dev:all
```

### Production Build
```bash
# Build frontend
npm run build

# Generate Prisma client
npx prisma generate

# Deploy database changes
npx prisma migrate deploy

# Start production server
NODE_ENV=production node server.js
```

### Database Management
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# View database
npx prisma studio

# Update counts
node scripts/updateTeamCardCounts.js
```

---

## Testing Checklist

### Critical User Flows
- [ ] User can sign up with email/password
- [ ] User can log in and receive JWT token
- [ ] User can search for players/series/teams
- [ ] User can view player detail with all cards
- [ ] User can view series detail with all cards
- [ ] User can add card to collection (Quick Add)
- [ ] User can see owned cards highlighted
- [ ] User can view collection dashboard
- [ ] User can remove cards from collection
- [ ] Infinite scroll works without duplicates
- [ ] Search returns relevant results
- [ ] Authentication persists on refresh

### Performance Tests
- [ ] Load 1000+ cards without lag
- [ ] Scroll through 500+ cards smoothly
- [ ] Search responds in <500ms
- [ ] Page loads in <2 seconds
- [ ] API responses in <200ms (cached)

### Edge Cases
- [ ] Handle players with same name
- [ ] Handle series with same name
- [ ] Handle missing data gracefully
- [ ] Handle network errors with retry
- [ ] Handle expired JWT tokens
- [ ] Handle concurrent updates

---

## Contact & Support

### Development Team
- Lead Developer: [Your Name]
- Database Administrator: [DBA Name]
- UI/UX Designer: [Designer Name]

### Resources
- GitHub Repository: https://github.com/jeffblankenburg/collect-your-cards
- Documentation: This file
- Issue Tracker: GitHub Issues
- Deployment Guide: [Link to Azure guide]

---

## Version History

### Version 1.0 (Current)
- Initial release with core features
- User authentication and collection management
- Browse and search functionality
- Collection dashboard and insights
- Quick Add feature with visual indicators

### Planned for Version 2.0
- Azure SQL Database integration
- Azure App Service deployment
- Enhanced performance optimizations
- Mobile-responsive improvements
- Bulk operations support

---

## License & Copyright

Copyright (c) 2024 Collect Your Cards
All rights reserved.

This is proprietary software. Unauthorized copying, modification, or distribution is strictly prohibited.

---

## Appendix A: Sample Data Structures

### Card Object
```json
{
  "card_id": 12345,
  "card_number": "100",
  "series": 1,
  "series_rel": {
    "series_id": 1,
    "name": "2024 Topps Series 1",
    "set_rel": {
      "name": "2024 Topps",
      "year": 2024,
      "manufacturer_rel": {
        "name": "Topps"
      }
    }
  },
  "card_player_teams": [{
    "player_team_rel": {
      "player_rel": {
        "player_id": 1,
        "first_name": "Shane",
        "last_name": "Bieber"
      },
      "team_rel": {
        "team_id": 1,
        "name": "Cleveland Guardians",
        "abbreviation": "CLE"
      }
    }
  }],
  "user_cards": [{
    "user_card_id": 1,
    "quantity": 2,
    "grade": 9.5,
    "current_value": 25.00
  }],
  "is_rookie": false,
  "is_autograph": false,
  "is_relic": false,
  "print_run": 99
}
```

### User Collection Stats
```json
{
  "totalCards": 1250,
  "totalValue": {
    "estimated": 5000.00,
    "current": 5500.00
  },
  "uniqueSeries": 45,
  "uniquePlayers": 230,
  "recentActivity": [
    {
      "cardId": 12345,
      "cardNumber": "100",
      "player": "Shane Bieber",
      "series": "2024 Topps Series 1",
      "addedDate": "2024-03-01T12:00:00Z",
      "value": 25.00
    }
  ]
}
```

---

*End of Documentation - Version 1.0 - Last Updated: January 2024*