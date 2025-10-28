# "What Am I Missing?" Recommendation Engine

## Overview
Help collectors discover cards they should add to their collection based on what they already own. Smart recommendations based on collecting patterns, incomplete sets, and similar collectors.

## Recommendation Types

### 1. Set Completion Recommendations
*"You have 43/50 cards from 1989 Score Football - Complete the set!"*

**Logic:**
- Find all sets where user owns >50% of cards
- Calculate % complete
- Show missing cards with estimated value
- Priority: Higher % complete = higher recommendation priority

### 2. Player Collection Recommendations
*"You have 12 cards of Wayne Gretzky - Add these 8 rookies!"*

**Logic:**
- Identify top 10 players by card count
- Find cards of those players not in collection
- Filter by: rookie cards, autographs, rare parallels
- Show by relevance (rookie > auto > numbered)

### 3. Team Collection Recommendations
*"You're collecting Toronto Blue Jays - Missing these key cards"*

**Logic:**
- Identify primary teams (most cards)
- Find significant cards: rookies, HOF players, championships
- Show gaps in team collection

### 4. Series Completion Recommendations
*"Complete your 1991 Topps Base Set - 23 cards remaining"*

**Logic:**
- Find series where user owns >40%
- Show missing cards in numerical order
- Highlight affordable vs expensive gaps

### 5. Similar Collector Recommendations
*"Collectors like you also have these cards"*

**Logic (Advanced):**
- Find users with similar collections (overlap analysis)
- Identify commonly owned cards user doesn't have
- Weight by rarity and value
- Privacy-preserving (anonymous aggregation)

## Database Schema

### New Table: `recommendation_cache`
```sql
CREATE TABLE recommendation_cache (
  cache_id bigint IDENTITY(1,1) PRIMARY KEY,
  user_id bigint NOT NULL FOREIGN KEY REFERENCES [user](user_id),
  recommendation_type nvarchar(50), -- 'set_completion', 'player', 'team', etc.
  entity_id bigint, -- set_id, player_id, or team_id
  entity_name nvarchar(255),

  -- Recommendation data
  cards_owned int,
  cards_total int,
  completion_pct decimal(5,2),
  missing_cards nvarchar(MAX), -- JSON array of card_ids
  estimated_cost money,

  -- Metadata
  priority_score int, -- 0-100, for sorting
  generated_at datetime DEFAULT GETDATE(),

  INDEX IX_user_recommendations (user_id, priority_score DESC),
  INDEX IX_type (recommendation_type)
)
```

### Update `user_card` table
```sql
-- Add recommendation tracking
ALTER TABLE user_card ADD
  is_recommendation bit DEFAULT 0,
  recommended_at datetime NULL,
  recommendation_source nvarchar(50) NULL -- 'set_completion', 'player', etc.
```

## API Endpoints

### 1. Get Recommendations
```
GET /api/recommendations
Query: ?type=all|sets|players|teams&limit=10
Response: {
  recommendations: [
    {
      type: 'set_completion',
      entity_id: 123,
      entity_name: '1989 Score Football',
      cards_owned: 43,
      cards_total: 50,
      completion_pct: 86,
      missing_cards: [...], // Array of card objects
      estimated_cost: 45.99,
      priority_score: 92
    }
  ]
}
```

### 2. Get Missing Cards for Entity
```
GET /api/recommendations/missing-cards
Query: ?type=set|series|player|team&id=123
Response: { missing_cards: [...], stats: {...} }
```

### 3. Mark Recommendation as Acted Upon
```
POST /api/recommendations/{cache_id}/dismiss
```

### 4. Refresh Recommendations
```
POST /api/recommendations/refresh
```

## Frontend Components

### 1. New Page: `/recommendations` or `/what-am-i-missing`
- Tab navigation: All | Sets | Players | Teams | Similar Collectors
- Recommendation cards with:
  - Progress bar (% complete)
  - Missing card count
  - Estimated cost
  - "View Missing Cards" button
  - "Dismiss" button

### 2. Component: `RecommendationCard.jsx`
```jsx
<RecommendationCard
  type="set_completion"
  title="1989 Score Football"
  progress={86}
  cardsOwned={43}
  cardsTotal={50}
  estimatedCost={45.99}
  onViewMissing={() => ...}
  onDismiss={() => ...}
/>
```

### 3. Component: `MissingCardsModal.jsx`
- Shows cards needed to complete a set/collection
- Sortable table
- "Add to Wishlist" button
- Quick links to eBay/COMC for each card
- Bulk "Add All to Wishlist" option

### 4. CollectionDashboard Integration
- "Recommendations" widget in sidebar
- Top 3 recommendations with quick view
- "See All Recommendations" link

## Algorithm Details

### Set Completion Score (0-100)
```javascript
priority_score = (completion_pct * 0.7) +
                 (affordability_factor * 0.2) +
                 (recency_factor * 0.1)

affordability_factor = 100 - (estimated_cost / user_avg_card_value * 100)
recency_factor = cards_added_last_30_days > 0 ? 100 : 50
```

### Similar Collector Matching
1. Find users with >20% collection overlap
2. Identify cards they have that user doesn't
3. Weight by: rarity, value, multiple owners
4. Privacy: Never expose individual user data

### Refresh Strategy
- Regenerate on card add/remove
- Background job: Daily for all active users
- On-demand: User clicks "Refresh Recommendations"
- Cache for 24 hours

## User Stories

### Story 1: Set Completion
> As a collector, I want to know which sets I'm close to completing so I can focus my purchases.

### Story 2: Player Focus
> As a Wayne Gretzky collector, I want to see which Gretzky cards I don't have yet, prioritized by significance.

### Story 3: Budget Planning
> As a collector, I want to know the estimated cost to complete a set before I commit to finishing it.

### Story 4: Discovery
> As a new collector, I want to discover what cards similar collectors own that I might like.

## Privacy & Ethics

- **Anonymous Aggregation**: Never show "John Doe owns this card"
- **Opt-Out**: Users can disable recommendation tracking
- **No Price Gouging**: Don't inflate prices in recommendations
- **Transparent**: Explain why each card is recommended

## Future Enhancements (Phase 2)

- **AI-Powered**: ML model learns user preferences
- **Price Alerts**: Notify when recommended cards drop in price
- **Trade Matching**: "User X has cards you want, you have cards they want"
- **Investment Recommendations**: "Cards likely to appreciate"
- **Challenge Mode**: "Complete this set in 30 days"
- **Completion Badges**: Award achievements for completing sets
- **Social Sharing**: Share completion progress with friends

## Implementation Priority

### Phase 1 (MVP)
1. Set Completion Recommendations
2. Series Completion Recommendations
3. Basic UI on /recommendations page

### Phase 2
1. Player Collection Recommendations
2. Team Collection Recommendations
3. Price estimation integration

### Phase 3
1. Similar Collector Recommendations
2. ML-powered personalization
3. Trade matching system

---

*Status: Planning Phase - Not yet implemented*
*Last updated: 2025*
