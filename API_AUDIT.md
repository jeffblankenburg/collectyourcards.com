# API Audit - Complete Gap Analysis

## Executive Summary

**Current State**: Internal-use API that grew organically to serve the frontend
**Target State**: Professional API that third-party developers could build apps on
**Gap**: Significant - missing table stakes features that any data API should have

---

## Table Stakes (Missing)

These aren't "nice to have" - they're baseline expectations for any data API:

### 1. Entity-Specific Search
```
GET /api/players/search?q=trout     → Players only
GET /api/teams/search?q=angels      → Teams only
GET /api/sets/search?q=topps        → Sets only
GET /api/cards/search?q=rookie      → Cards only
```
**Current**: Only universal search that mixes all entity types

### 2. Relationship Traversal
```
GET /api/players/:id/cards          → All cards featuring this player
GET /api/players/:id/teams          → Teams this player has been on
GET /api/teams/:id/players          → All players on this team
GET /api/teams/:id/cards            → All cards for this team
GET /api/sets/:id/series            → All series in this set
GET /api/series/:id/cards           → All cards in this series
```
**Current**: Must use filters on `/api/cards` or piece together from multiple calls

### 3. Bulk Operations
```
GET /api/cards?ids=1,2,3,4,5        → Get multiple cards in one request
POST /api/user/cards/bulk           → Add multiple cards to collection
DELETE /api/user/cards/bulk         → Remove multiple cards
```
**Current**: One card at a time only

### 4. Autocomplete/Typeahead
```
GET /api/autocomplete?q=tro&type=player    → ["Mike Trout", "Trevor Story", ...]
GET /api/autocomplete?q=top&type=set       → ["2024 Topps", "2024 Topps Chrome", ...]
```
**Current**: None - must do full search and filter client-side

### 5. Consistent Filtering
```
GET /api/cards?team_id=5&is_rookie=true&year=2024&color=gold
GET /api/cards?print_run_max=100           → Cards /100 or less
GET /api/cards?exclude_types=sp            → Exclude short prints
```
**Current**: Inconsistent - some endpoints support some filters

### 6. Sorting
```
GET /api/cards?sort=print_run              → Ascending by print run
GET /api/cards?sort=-year,player_name      → Descending year, then player name
```
**Current**: Very limited, inconsistent across endpoints

### 7. Field Selection
```
GET /api/cards?fields=card_id,card_number,player_name
```
**Current**: Always returns full objects

### 8. Pagination Headers
```
Link: <...?page=2>; rel="next", <...?page=10>; rel="last"
X-Total-Count: 1500
X-Page: 1
X-Per-Page: 50
```
**Current**: Pagination data buried in response body, inconsistent format

---

## Missing Endpoints by Entity

### Players
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/players` | List all players | ✅ (as /players-list) |
| `GET /api/players/:id` | Get player by ID | ✅ |
| `GET /api/players/search` | Search players | ❌ |
| `GET /api/players/:id/cards` | Player's cards | ❌ |
| `GET /api/players/:id/teams` | Player's teams | ❌ (admin only) |
| `GET /api/players/:id/stats` | Card counts, etc. | ❌ |
| `GET /api/players/by-team/:teamId` | Players on team | ❌ |

### Teams
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/teams` | List all teams | ✅ (as /teams-list) |
| `GET /api/teams/:id` | Get team by ID | ✅ |
| `GET /api/teams/search` | Search teams | ❌ |
| `GET /api/teams/:id/players` | Team's players | ❌ |
| `GET /api/teams/:id/cards` | Team's cards | ❌ |
| `GET /api/teams/by-slug/:slug` | Get by URL slug | ❌ |
| `GET /api/teams/by-sport/:sport` | Filter by sport | ❌ |
| `GET /api/teams/by-league/:league` | Filter by league | ❌ |

### Sets
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/sets` | List all sets | ✅ (as /sets-list) |
| `GET /api/sets/:id` | Get set by ID | ❌ |
| `GET /api/sets/search` | Search sets | ✅ (as /sets-list/search) |
| `GET /api/sets/:id/series` | Set's series | ❌ (exists as /series-by-set) |
| `GET /api/sets/:id/cards` | Set's cards | ❌ |
| `GET /api/sets/by-year/:year` | Filter by year | ❌ (admin only) |
| `GET /api/sets/by-manufacturer/:mfg` | Filter by manufacturer | ❌ |

### Series
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/series` | List all series | ✅ (as /series-list) |
| `GET /api/series/:id` | Get series by ID | ✅ |
| `GET /api/series/search` | Search series | ✅ |
| `GET /api/series/:id/cards` | Series' cards | ❌ |
| `GET /api/series/:id/checklist` | Printable checklist | ❌ |
| `GET /api/series/:id/parallels` | Related parallel series | ❌ |

### Cards
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/cards` | List/search cards | ✅ |
| `GET /api/cards/:id` | Get card by ID | ✅ |
| `GET /api/cards/search` | Dedicated search | ❌ (uses list endpoint) |
| `GET /api/cards/rainbow` | Parallel variations | ✅ |
| `GET /api/cards/by-player/:id` | Cards for player | ❌ |
| `GET /api/cards/by-team/:id` | Cards for team | ❌ |
| `GET /api/cards/by-series/:id` | Cards in series | ❌ |
| `GET /api/cards/rookies` | Rookie cards only | ❌ |
| `GET /api/cards/autographs` | Auto cards only | ❌ |
| `GET /api/cards/numbered` | Numbered cards | ❌ |

---

## Missing Standard Features

### Caching & Performance
- ❌ `Cache-Control` headers
- ❌ `ETag` headers for conditional requests
- ❌ `Last-Modified` headers
- ❌ Compression documentation
- ❌ Batch/bulk endpoints

### Error Handling
- ❌ Consistent error response format
- ❌ Error codes (not just messages)
- ❌ Request ID for debugging
- ❌ Rate limit headers (`X-RateLimit-*`)

### Documentation
- ❌ OpenAPI/Swagger specification (machine-readable)
- ❌ SDKs (JavaScript, Python)
- ❌ Changelog
- ❌ Deprecation policy

### Real-Time
- ❌ Webhooks for data changes
- ❌ WebSocket support
- ❌ Change feed/audit log

---

## Use Case Analysis

### Mobile App Developer Needs
| Need | Available? |
|------|------------|
| Search players by name | ❌ (universal only) |
| Get player's cards | ❌ |
| Autocomplete search | ❌ |
| Offline-friendly pagination | ❌ |
| Thumbnail images | ✅ |
| Filter by card type | Partial |

### Collection App Developer Needs
| Need | Available? |
|------|------------|
| Add card to collection | ✅ |
| Add multiple cards at once | ❌ |
| Get collection stats | ✅ |
| Export collection | ❌ |
| Compare collections | ❌ |
| Series completion % | ❌ |

### Price Tracking App Developer Needs
| Need | Available? |
|------|------------|
| Get card details | ✅ |
| Historical pricing | ❌ |
| Market trends | ❌ |
| Population reports | Partial |
| Comparable sales | ❌ |

---

## Priority Implementation Order

### Phase 1: Table Stakes (Must Have)
1. Entity-specific search endpoints
2. Relationship traversal endpoints
3. Consistent filtering across all list endpoints
4. Standardized pagination (headers + response format)
5. Bulk card lookup (`?ids=1,2,3`)

### Phase 2: Developer Experience
1. OpenAPI specification
2. Consistent error format with codes
3. Rate limit headers
4. Request ID tracking
5. Caching headers

### Phase 3: Advanced Features
1. Autocomplete/typeahead
2. Sorting on all list endpoints
3. Field selection
4. Bulk write operations
5. Export endpoints

### Phase 4: Real-Time & Analytics
1. Webhooks
2. Change feed
3. Popular/trending data
4. Collection statistics (aggregate)

---

## Recommended Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 1500,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "links": {
    "self": "/api/players?limit=50&offset=0",
    "next": "/api/players?limit=50&offset=50",
    "last": "/api/players?limit=50&offset=1450"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "PLAYER_NOT_FOUND",
    "message": "Player with ID 12345 not found",
    "requestId": "abc-123-def"
  }
}
```

---

## Next Actions

1. [ ] Add `GET /api/players/search`
2. [ ] Add `GET /api/teams/search`
3. [ ] Add `GET /api/players/:id/cards`
4. [ ] Add `GET /api/players/:id/teams`
5. [ ] Add `GET /api/teams/:id/players`
6. [ ] Add `GET /api/teams/:id/cards`
7. [ ] Add `GET /api/sets/:id`
8. [ ] Add `GET /api/sets/:id/series`
9. [ ] Add `GET /api/series/:id/cards`
10. [ ] Add `GET /api/cards?ids=1,2,3` bulk lookup
11. [ ] Add `GET /api/autocomplete`
12. [ ] Standardize pagination headers
13. [ ] Standardize error responses
14. [ ] Add sorting to all list endpoints
15. [ ] Document rate limits in headers

---

*This API serves its frontend well, but is not ready for third-party developers. The gaps are fundamental, not edge cases.*

*Last Updated: January 2026*
