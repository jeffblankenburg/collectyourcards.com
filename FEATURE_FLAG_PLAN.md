# Feature Flag System - Implementation Plan

## Overview
A lightweight feature flag system to toggle UI features without requiring code deployments. Uses database-backed storage with server-side in-memory caching for performance.

## Architecture

### Database Layer
- **Single table**: `feature_flag`
- **No per-user queries**: Flags are global, cached in memory
- **Audit trail**: Track who changed what and when

### Server Cache Layer
- **In-memory cache**: Refresh every 5 minutes (configurable)
- **Force refresh API**: Admin can trigger immediate cache update
- **Fast lookups**: O(1) object key access

### Client Layer
- **React Context**: Single fetch on app load
- **Hook API**: `useFeatureFlag('flag_name')`
- **Graceful defaults**: Returns `false` if flag doesn't exist

## Database Schema

```sql
CREATE TABLE feature_flag (
  flag_id INT IDENTITY(1,1) PRIMARY KEY,
  flag_name NVARCHAR(100) UNIQUE NOT NULL,
  enabled BIT NOT NULL DEFAULT 0,
  description NVARCHAR(500),
  updated_at DATETIME DEFAULT GETDATE(),
  updated_by NVARCHAR(100)
);

-- Initial flags
INSERT INTO feature_flag (flag_name, enabled, description) VALUES
('show_coming_soon_ribbon', 1, 'Show Coming Soon ribbon on sets with 0 cards'),
('enable_sport_filters', 1, 'Show sport filter buttons on sets page'),
('enable_notifications', 1, 'Enable notification system'),
('enable_comments', 1, 'Enable comment system'),
('show_rainbow_view', 1, 'Show rainbow view for card parallels');
```

## Server Implementation

### Feature Flag Utility (`server/utils/featureFlags.js`)

```javascript
const { prisma } = require('../config/prisma-singleton')

let featureFlagsCache = null
let lastFetchTime = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function getFeatureFlags(forceRefresh = false) {
  const now = Date.now()

  // Return cache if valid
  if (!forceRefresh && featureFlagsCache && (now - lastFetchTime < CACHE_DURATION)) {
    return featureFlagsCache
  }

  // Fetch from DB
  const flags = await prisma.feature_flag.findMany()

  // Convert to easy lookup object: { flag_name: true/false }
  featureFlagsCache = flags.reduce((acc, flag) => {
    acc[flag.flag_name] = flag.enabled
    return acc
  }, {})

  lastFetchTime = now
  console.log('Feature flags cache refreshed:', Object.keys(featureFlagsCache).length, 'flags')

  return featureFlagsCache
}

function isFeatureEnabled(flagName) {
  return featureFlagsCache?.[flagName] ?? false
}

// Initialize cache on server startup
getFeatureFlags()

module.exports = { getFeatureFlags, isFeatureEnabled }
```

### Public API Route (`server/routes/feature-flags.js`)

```javascript
const express = require('express')
const router = express.Router()
const { getFeatureFlags } = require('../utils/featureFlags')

// GET /api/feature-flags - Public endpoint for client
router.get('/', async (req, res) => {
  try {
    const flags = await getFeatureFlags()
    res.json({ flags })
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    res.status(500).json({ error: 'Failed to fetch feature flags' })
  }
})

module.exports = router
```

### Admin API Routes (`server/routes/admin-feature-flags.js`)

```javascript
const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { getFeatureFlags } = require('../utils/featureFlags')
const { requireAdmin } = require('../middleware/auth')

// GET /api/admin/feature-flags - List all flags
router.get('/', requireAdmin, async (req, res) => {
  try {
    const flags = await prisma.feature_flag.findMany({
      orderBy: { flag_name: 'asc' }
    })
    res.json({ flags })
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    res.status(500).json({ error: 'Failed to fetch feature flags' })
  }
})

// PUT /api/admin/feature-flags/:flagName - Toggle flag
router.put('/:flagName', requireAdmin, async (req, res) => {
  try {
    const { flagName } = req.params
    const { enabled } = req.body

    await prisma.feature_flag.update({
      where: { flag_name: flagName },
      data: {
        enabled,
        updated_at: new Date(),
        updated_by: req.user?.email || 'unknown'
      }
    })

    // Force cache refresh immediately
    await getFeatureFlags(true)

    res.json({ success: true, flagName, enabled })
  } catch (error) {
    console.error('Error updating feature flag:', error)
    res.status(500).json({ error: 'Failed to update feature flag' })
  }
})

// POST /api/admin/feature-flags - Create new flag
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { flag_name, enabled, description } = req.body

    const flag = await prisma.feature_flag.create({
      data: {
        flag_name,
        enabled: enabled ?? false,
        description,
        updated_by: req.user?.email || 'unknown'
      }
    })

    // Force cache refresh
    await getFeatureFlags(true)

    res.json({ success: true, flag })
  } catch (error) {
    console.error('Error creating feature flag:', error)
    res.status(500).json({ error: 'Failed to create feature flag' })
  }
})

// DELETE /api/admin/feature-flags/:flagName - Delete flag
router.delete('/:flagName', requireAdmin, async (req, res) => {
  try {
    const { flagName } = req.params

    await prisma.feature_flag.delete({
      where: { flag_name: flagName }
    })

    // Force cache refresh
    await getFeatureFlags(true)

    res.json({ success: true, flagName })
  } catch (error) {
    console.error('Error deleting feature flag:', error)
    res.status(500).json({ error: 'Failed to delete feature flag' })
  }
})

module.exports = router
```

## Client Implementation

### Feature Flags Context (`client/src/contexts/FeatureFlagsContext.jsx`)

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const FeatureFlagsContext = createContext({})

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch feature flags once on app load
    axios.get('/api/feature-flags')
      .then(res => {
        setFlags(res.data.flags || {})
        console.log('Feature flags loaded:', Object.keys(res.data.flags || {}).length)
      })
      .catch(err => {
        console.error('Failed to load feature flags:', err)
        setFlags({}) // Default to empty/disabled
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// Hook to check if a feature is enabled
export const useFeatureFlag = (flagName) => {
  const { flags } = useContext(FeatureFlagsContext)
  return flags[flagName] ?? false
}

// Hook to get all flags (for debugging/admin)
export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext)
  return context
}
```

### App.jsx Integration

```javascript
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext'

function App() {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <ToastProvider>
          {/* rest of app */}
        </ToastProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  )
}
```

### Admin Dashboard Component (`client/src/pages/AdminFeatureFlags.jsx`)

```javascript
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'

function AdminFeatureFlags() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    loadFlags()
  }, [])

  const loadFlags = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/feature-flags')
      setFlags(response.data.flags || [])
    } catch (error) {
      console.error('Error loading flags:', error)
      addToast('Failed to load feature flags', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleFlag = async (flagName, currentValue) => {
    try {
      await axios.put(`/api/admin/feature-flags/${flagName}`, {
        enabled: !currentValue
      })
      addToast(`Feature flag "${flagName}" ${!currentValue ? 'enabled' : 'disabled'}`, 'success')
      loadFlags() // Refresh list
    } catch (error) {
      console.error('Error toggling flag:', error)
      addToast('Failed to toggle feature flag', 'error')
    }
  }

  return (
    <div className="admin-feature-flags-page">
      <div className="admin-header">
        <h1>
          <Icon name="toggle" size={32} />
          Feature Flags
        </h1>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : (
        <div className="flags-list">
          {flags.map(flag => (
            <div key={flag.flag_id} className="flag-item">
              <div className="flag-info">
                <h3>{flag.flag_name}</h3>
                <p>{flag.description}</p>
                <small>
                  Last updated: {new Date(flag.updated_at).toLocaleString()}
                  {flag.updated_by && ` by ${flag.updated_by}`}
                </small>
              </div>
              <button
                className={`toggle-btn ${flag.enabled ? 'active' : ''}`}
                onClick={() => toggleFlag(flag.flag_name, flag.enabled)}
              >
                <Icon name={flag.enabled ? 'check' : 'x'} size={20} />
                {flag.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminFeatureFlags
```

## Usage Examples

### Simple Toggle

```javascript
function SetCard({ set }) {
  const showComingSoon = useFeatureFlag('show_coming_soon_ribbon')

  return (
    <div className="setcard-container">
      {showComingSoon && set.card_count === 0 && (
        <div className="setcard-coming-soon-ribbon">
          <span>Coming Soon</span>
        </div>
      )}
    </div>
  )
}
```

### Conditional Rendering

```javascript
function SetsPage() {
  const showSportFilters = useFeatureFlag('enable_sport_filters')

  return (
    <div>
      {showSportFilters && (
        <div className="sport-filter-panel">
          {/* filter buttons */}
        </div>
      )}
    </div>
  )
}
```

### Feature-Gated Routes

```javascript
function AppRoutes() {
  const commentsEnabled = useFeatureFlag('enable_comments')

  return (
    <Routes>
      <Route path="/series/:slug" element={<SeriesDetail />} />
      {commentsEnabled && (
        <Route path="/comments" element={<CommentsPage />} />
      )}
    </Routes>
  )
}
```

## Initial Feature Flags to Create

1. **`show_coming_soon_ribbon`** - Show "Coming Soon" ribbon on sets with 0 cards
2. **`enable_sport_filters`** - Show sport filter buttons on sets page
3. **`enable_notifications`** - Enable notification system
4. **`enable_comments`** - Enable comment system
5. **`show_rainbow_view`** - Show rainbow view for card parallels
6. **`enable_achievements`** - Enable achievement system
7. **`enable_ebay_integration`** - Enable eBay integration features
8. **`show_mobile_nav`** - Show mobile navigation (for testing)
9. **`enable_bulk_actions`** - Enable bulk card actions

## Benefits

✅ **No per-user DB queries** - Single cache shared across all users
✅ **No code deployments** - Toggle features via admin UI
✅ **Fast performance** - In-memory lookups after initial cache
✅ **Persistent** - Survives server restarts
✅ **Near real-time** - 5-minute cache (or force refresh)
✅ **Admin-friendly** - Simple toggle interface
✅ **Auditable** - Track changes with timestamps and user info
✅ **Safe defaults** - Returns `false` if flag doesn't exist

## Migration Strategy

1. **Phase 1**: Create database table and seed initial flags
2. **Phase 2**: Implement server-side cache and API routes
3. **Phase 3**: Create client context and hooks
4. **Phase 4**: Build admin UI for managing flags
5. **Phase 5**: Migrate existing features to use flags (optional)

## Monitoring & Debugging

### Server Logs
```javascript
console.log('Feature flags cache refreshed:', Object.keys(flags).length, 'flags')
```

### Client Debug Hook
```javascript
export const useFeatureFlagsDebug = () => {
  const { flags, loading } = useFeatureFlags()

  useEffect(() => {
    console.table(flags)
  }, [flags])

  return { flags, loading }
}
```

### Admin Dashboard Stats
- Total flags count
- Enabled vs disabled breakdown
- Last refresh timestamp
- Most recently changed flags

## Future Enhancements

- **User-specific flags**: Allow per-user or role-based overrides
- **A/B testing**: Random assignment for percentage rollouts
- **Scheduled flags**: Auto-enable/disable at specific times
- **Flag dependencies**: "Flag X requires Flag Y to be enabled"
- **Remote config**: Azure App Configuration integration
- **Analytics**: Track which users see which features

---

**Status**: Planning Phase
**Priority**: Medium
**Estimated Effort**: 4-6 hours
**Dependencies**: None
