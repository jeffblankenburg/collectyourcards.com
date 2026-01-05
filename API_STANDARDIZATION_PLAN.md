# API Standardization Plan

## Current State

- **276+ unique endpoints** called by the frontend
- **24 endpoints** documented in api-registry.js (9% coverage)
- **67% of endpoints** are custom/ad-hoc paths (not RESTful)
- **Inconsistent patterns** across similar resources

---

## The Goal

Every piece of functionality in the app should:
1. Go through a documented API endpoint
2. Follow RESTful conventions
3. Be in the api-registry.js
4. Have consistent request/response formats

---

## Path Inconsistencies to Fix

### Players
| Current | Should Be |
|---------|-----------|
| `GET /api/players-list` | `GET /api/players` |
| `GET /api/players/:id` | ✅ Keep |
| `GET /api/admin/players/:id/teams` | `GET /api/players/:id/teams` (public) |
| `GET /api/admin/players/:id/cards` | `GET /api/players/:id/cards` (public) |
| `POST /api/players/track-visit` | Remove or move to analytics |
| ❌ Missing | `GET /api/players/search?q=` |
| ❌ Missing | `GET /api/players/by-team/:teamId` |

### Teams
| Current | Should Be |
|---------|-----------|
| `GET /api/teams-list` | `GET /api/teams` |
| `GET /api/teams/:id` | ✅ Keep |
| `POST /api/teams/track-visit` | Remove or move to analytics |
| ❌ Missing | `GET /api/teams/search?q=` |
| ❌ Missing | `GET /api/teams/:id/players` |
| ❌ Missing | `GET /api/teams/:id/cards` |
| ❌ Missing | `GET /api/teams/by-slug/:slug` |

### Sets
| Current | Should Be |
|---------|-----------|
| `GET /api/sets-list` | `GET /api/sets` |
| `GET /api/sets-list/search` | `GET /api/sets/search` |
| `GET /api/admin/sets/by-year/:year` | `GET /api/sets?year=:year` or `GET /api/sets/by-year/:year` (public) |
| ❌ Missing | `GET /api/sets/:id` |
| ❌ Missing | `GET /api/sets/:id/series` |
| ❌ Missing | `GET /api/sets/:id/cards` |

### Series
| Current | Should Be |
|---------|-----------|
| `GET /api/series-list` | `GET /api/series` |
| `GET /api/series-list/:id` | `GET /api/series/:id` |
| `GET /api/series-list/search` | `GET /api/series/search` |
| `GET /api/series-by-set/:setId` | `GET /api/sets/:setId/series` |
| ❌ Missing | `GET /api/series/:id/cards` |
| ❌ Missing | `GET /api/series/:id/checklist` |

### Cards
| Current | Should Be |
|---------|-----------|
| `GET /api/cards` | ✅ Keep (but add proper filters) |
| `GET /api/cards/:id` | ✅ Keep |
| `GET /api/cards/carousel` | ✅ Keep |
| `GET /api/cards/rainbow` | ✅ Keep |
| `GET /api/cards/parallel-series` | ✅ Keep |
| ❌ Missing | `GET /api/cards/search?q=` |
| ❌ Missing | `GET /api/cards?ids=1,2,3` (bulk) |

### User Collection
| Current | Should Be |
|---------|-----------|
| `GET /api/user/cards/:cardId` | ✅ Keep |
| `POST /api/user/cards` | ✅ Keep |
| `PUT /api/user/cards/:id` | ✅ Keep |
| `DELETE /api/user/cards/:id` | ✅ Keep |
| `GET /api/user/collection/cards/minimal` | `GET /api/user/collection?fields=minimal` |
| `GET /api/user/collection/cards` | `GET /api/user/collection` |
| ❌ Missing | `POST /api/user/cards/bulk` (standardize) |
| ❌ Missing | `DELETE /api/user/cards/bulk` |
| ❌ Missing | `GET /api/user/collection/export` |

### Search
| Current | Should Be |
|---------|-----------|
| `GET /api/search/universal-v3` | `GET /api/search?q=` |
| `GET /api/search/series` | `GET /api/series/search` |
| ❌ Missing | `GET /api/players/search` |
| ❌ Missing | `GET /api/teams/search` |
| ❌ Missing | `GET /api/cards/search` |
| ❌ Missing | `GET /api/autocomplete?q=&type=` |

---

## Duplicate/Redundant Endpoints

### Search Versions
- `/api/search/universal` (v1)
- `/api/search/universal-v2` (v2)
- `/api/search/universal-v3` (v3)

**Action**: Consolidate to single `/api/search` endpoint

### Admin Sets
- `/api/admin/sets`
- `/api/admin/sets-optimized/*`

**Action**: Consolidate, use query params for optimization hints

### Profile Updates
- `PUT /api/profile/update`
- `PUT /api/profile/update-username`
- `PUT /api/profile/change-password`

**Action**: Consolidate to `PUT /api/profile` with field-specific updates or `PATCH /api/profile`

---

## Non-RESTful Patterns to Fix

### Track Visit Endpoints
```
POST /api/players/track-visit
POST /api/teams/track-visit
```
**Problem**: Side-effect endpoints mixed with data endpoints
**Solution**: Move to `/api/analytics/track` or handle client-side

### Action Verbs in URLs
```
POST /api/admin/aggregates/update
POST /api/admin/achievements/recalculate
POST /api/supplies/calculate-cost
POST /api/supplies/batches/:id/deplete
```
**Problem**: Verbs belong in HTTP methods, not URLs
**Solution**:
- `POST /api/admin/aggregates` (with action in body)
- `POST /api/admin/achievements/recalculate` → Keep (it's a command)
- `POST /api/supplies/cost-calculation` → Resource noun

### Nested Resource Inconsistency
```
GET /api/admin/players/:id/teams     # Nested
GET /api/player-team-search          # Flat
GET /api/series-by-set/:setId        # Flat with preposition
```
**Solution**: Standardize on nested resources:
- `GET /api/players/:id/teams`
- `GET /api/players/:id/cards`
- `GET /api/sets/:id/series`

---

## Response Format Standardization

### Current (Inconsistent)
```javascript
// Some endpoints
{ players: [...], total: 100 }

// Other endpoints
{ success: true, data: [...], meta: { total: 100 } }

// Others
{ cards: [...], pagination: { total: 100, page: 1 } }
```

### Standard Format (All Endpoints)
```javascript
// List response
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 1500,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}

// Single item response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Player with ID 123 not found"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Public Endpoints (Table Stakes)
1. Add `/api/players/search`
2. Add `/api/teams/search`
3. Add `/api/sets/:id`
4. Add `/api/players/:id/cards` (public version)
5. Add `/api/players/:id/teams` (public version)
6. Add `/api/teams/:id/players`
7. Add `/api/teams/:id/cards`
8. Add `/api/sets/:id/series`
9. Add `/api/series/:id/cards`
10. Add `/api/autocomplete`

### Phase 2: Path Consolidation
1. Redirect `/api/players-list` → `/api/players`
2. Redirect `/api/teams-list` → `/api/teams`
3. Redirect `/api/sets-list` → `/api/sets`
4. Redirect `/api/series-list` → `/api/series`
5. Redirect `/api/series-by-set/:id` → `/api/sets/:id/series`
6. Consolidate search versions to `/api/search`

### Phase 3: Response Standardization
1. Create response wrapper middleware
2. Update all endpoints to use standard format
3. Add pagination headers
4. Add rate limit headers

### Phase 4: Documentation
1. Add all endpoints to api-registry.js
2. Generate OpenAPI spec
3. Update /developers page
4. Add code examples

### Phase 5: Frontend Refactor
1. Update all frontend API calls to use new paths
2. Remove deprecated endpoint usage
3. Add API client wrapper for consistent handling

---

## Endpoints to Add (Complete List)

### Public Read Endpoints
- [ ] `GET /api/players` (consolidate from /players-list)
- [ ] `GET /api/players/search?q=`
- [ ] `GET /api/players/:id/cards`
- [ ] `GET /api/players/:id/teams`
- [ ] `GET /api/players/:id/stats`
- [ ] `GET /api/teams` (consolidate from /teams-list)
- [ ] `GET /api/teams/search?q=`
- [ ] `GET /api/teams/:id/players`
- [ ] `GET /api/teams/:id/cards`
- [ ] `GET /api/teams/by-slug/:slug`
- [ ] `GET /api/sets` (consolidate from /sets-list)
- [ ] `GET /api/sets/:id`
- [ ] `GET /api/sets/:id/series`
- [ ] `GET /api/sets/:id/cards`
- [ ] `GET /api/series` (consolidate from /series-list)
- [ ] `GET /api/series/:id` (consolidate from /series-list/:id)
- [ ] `GET /api/series/:id/cards`
- [ ] `GET /api/series/:id/checklist`
- [ ] `GET /api/cards/search?q=`
- [ ] `GET /api/cards?ids=1,2,3` (bulk lookup)
- [ ] `GET /api/autocomplete?q=&type=`

### User Collection Endpoints
- [ ] `POST /api/user/cards/bulk`
- [ ] `DELETE /api/user/cards/bulk`
- [ ] `GET /api/user/collection/export`
- [ ] `GET /api/user/collection/by-series/:id/completion`

### Standard Response Wrapper
- [ ] Create middleware for standard responses
- [ ] Add to all routes

---

## Migration Strategy

### For Path Changes
1. Add new endpoint at standard path
2. Keep old endpoint, add deprecation warning header
3. Update frontend to use new path
4. After 30 days, remove old endpoint

### For Response Format Changes
1. Add `Accept: application/vnd.cyc.v2+json` header support
2. Default to new format
3. Old format available via `Accept: application/vnd.cyc.v1+json`
4. Deprecate v1 after migration complete

---

## Success Metrics

- [ ] 100% of frontend calls use documented endpoints
- [ ] 100% of endpoints in api-registry.js
- [ ] 0 custom/ad-hoc paths (all RESTful)
- [ ] Consistent response format across all endpoints
- [ ] All list endpoints support: filtering, sorting, pagination
- [ ] All endpoints return standard error format

---

*Last Updated: January 2026*
