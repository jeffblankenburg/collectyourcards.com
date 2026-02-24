# Provisional Card System - Testing Workflow

This document outlines comprehensive tests for the new crowdsourcing provisional card system. Tests are organized by user role and workflow stage.

---

## Prerequisites

- Local development environment running
- Admin account: `cardcollector@jeffblankenburg.com` / `testpassword`
- Database with existing sets, series, players, and teams

---

## Part 1: User Submission Workflows

### Test 1.1: Submit Card with All Known Entities
**Goal:** Verify fully auto-resolved submission

1. Log in as any user
2. Submit a card with:
   - Player: "Mike Trout"
   - Team: "Los Angeles Angels"
   - Set: "2024 Topps Chrome"
   - Series: "Base" (or leave blank)
   - Card Number: "1"
   - Year: 2024

**Expected Results:**
- [ ] Card submission succeeds
- [ ] Set resolves to "2024 Topps Chrome" (confidence: 1.0)
- [ ] Series resolves to "2024 Topps Chrome" base series (confidence: 1.0)
- [ ] Player resolves to Mike Trout (confidence: 0.95)
- [ ] Team resolves to Los Angeles Angels
- [ ] `needs_review: false` (fully auto-resolved)
- [ ] Card appears in user's collection as "provisional"

---

### Test 1.2: Submit Card with Unknown Player
**Goal:** Verify new player flagged for review

1. Submit a card with:
   - Player: "John Completely Unknown Player"
   - Team: "New York Yankees"
   - Set: "2024 Topps"
   - Card Number: "999"
   - Year: 2024

**Expected Results:**
- [ ] Card submission succeeds
- [ ] Set resolves correctly
- [ ] Series resolves to base series
- [ ] Player NOT matched (`resolved_player_id: null`)
- [ ] Team IS matched (New York Yankees)
- [ ] `requires_new_player: true`
- [ ] `needs_review: true`
- [ ] Card appears in user's collection as "provisional"

---

### Test 1.3: Submit Card with Unknown Set
**Goal:** Verify new set flagged for review

1. Submit a card with:
   - Player: "Mike Trout"
   - Team: "Los Angeles Angels"
   - Set: "2099 Future Set That Doesn't Exist"
   - Card Number: "1"
   - Year: 2099

**Expected Results:**
- [ ] Card submission succeeds
- [ ] Set NOT matched (`resolved_set_id: null`)
- [ ] `requires_new_set: true`
- [ ] `requires_new_series: true` (can't match series without set)
- [ ] Player still resolves correctly
- [ ] `needs_review: true`

---

### Test 1.4: Submit Multi-Player Card
**Goal:** Verify multi-player parsing works

1. Submit a card with:
   - Player: "Mike Trout / Shohei Ohtani"
   - Team: "Los Angeles Angels"
   - Set: "2024 Topps Chrome"
   - Card Number: "DUAL-1"
   - Year: 2024

**Expected Results:**
- [ ] Card submission succeeds
- [ ] TWO player entries created in `provisional_card_player`
- [ ] Mike Trout resolved (position 1)
- [ ] Shohei Ohtani resolved (position 2)
- [ ] Both linked to Angels team

---

### Test 1.5: Submit Multi-Player Card with Different Teams
**Goal:** Verify multi-team parsing works

1. Submit a card with:
   - Player: "Mike Trout / Aaron Judge"
   - Team: "Los Angeles Angels / New York Yankees"
   - Set: "2024 Topps Chrome"
   - Card Number: "DUAL-2"
   - Year: 2024

**Expected Results:**
- [ ] TWO player entries created
- [ ] Mike Trout linked to Angels
- [ ] Aaron Judge linked to Yankees

---

### Test 1.6: Submit Card with Fuzzy Player Name
**Goal:** Verify fuzzy matching works

1. Submit a card with:
   - Player: "M. Trout" or "Trout, Mike"
   - Team: "Angels"
   - Set: "2024 Topps Chrome"
   - Card Number: "FUZZY-1"
   - Year: 2024

**Expected Results:**
- [ ] Player resolves to Mike Trout (may have lower confidence)
- [ ] Team resolves to Los Angeles Angels (partial match on "Angels")

---

### Test 1.7: Submit Multiple Cards in One Bundle
**Goal:** Verify batch submission works

1. Submit 3 cards in one request:
   - Card 1: Mike Trout, 2024 Topps Chrome, #1
   - Card 2: Aaron Judge, 2024 Topps Chrome, #2
   - Card 3: Unknown Player, 2024 Topps Chrome, #3

**Expected Results:**
- [ ] Single bundle created with `card_count: 3`
- [ ] Cards 1 and 2 auto-resolved
- [ ] Card 3 needs review
- [ ] `auto_resolved_count: 2`
- [ ] `needs_review_count: 1`
- [ ] Three user_card entries created (all provisional)

---

### Test 1.8: View My Provisional Cards
**Goal:** Verify user can see their submissions

1. After submitting cards, call `GET /api/crowdsource/my-provisional-cards`

**Expected Results:**
- [ ] Returns list of user's provisional cards
- [ ] Shows resolution status for each
- [ ] Shows bundle information

---

### Test 1.9: View My Bundles
**Goal:** Verify user can see their submission bundles

1. Call `GET /api/crowdsource/my-bundles`

**Expected Results:**
- [ ] Returns list of user's bundles
- [ ] Shows status (pending/approved/rejected)
- [ ] Shows card counts and review requirements

---

## Part 2: Admin Review Workflows

### Test 2.1: View Pending Bundles Queue
**Goal:** Verify admin queue shows pending submissions

1. Log in as admin
2. Call `GET /api/crowdsource/admin/bundles?status=pending`

**Expected Results:**
- [ ] Returns list of pending bundles
- [ ] Shows submitter info
- [ ] Shows `requires_new_*` flags
- [ ] Shows card counts
- [ ] Ordered by submission time (oldest first)

---

### Test 2.2: View Bundle Diff View
**Goal:** Verify admin can see submission details

1. Call `GET /api/crowdsource/admin/bundles/{bundleId}`

**Expected Results:**
- [ ] Returns bundle metadata
- [ ] Returns array of cards with:
  - [ ] `input` object (what user typed)
  - [ ] `resolution` object (what system matched)
  - [ ] `players` array with match details
- [ ] Clear indication of what needs review
- [ ] Confidence scores displayed

---

### Test 2.3: Approve Fully Resolved Bundle
**Goal:** Verify approval creates cards correctly

1. Find a bundle where all entities are resolved
2. Call `POST /api/crowdsource/admin/bundles/{bundleId}/approve`

**Expected Results:**
- [ ] Bundle status changes to "approved"
- [ ] New card(s) created in `card` table
- [ ] `card_player_team` links created
- [ ] `user_card` updated: `is_provisional = 0`, `card` linked
- [ ] `provisional_card.resolved_card_id` populated
- [ ] Contributor stats updated

---

### Test 2.4: Reject Bundle
**Goal:** Verify rejection workflow

1. Find a pending bundle
2. Call `POST /api/crowdsource/admin/bundles/{bundleId}/reject` with `review_notes`

**Expected Results:**
- [ ] Bundle status changes to "rejected"
- [ ] All provisional cards marked as "rejected"
- [ ] User's provisional `user_card` entries deleted
- [ ] Review notes stored
- [ ] Contributor stats updated (rejection counted)

---

### Test 2.5: Reject Without Notes (Should Fail)
**Goal:** Verify rejection requires explanation

1. Call `POST /api/crowdsource/admin/bundles/{bundleId}/reject` without `review_notes`

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates review notes are required

---

### Test 2.6: Approve Bundle with Unresolved Entities (Should Fail)
**Goal:** Verify approval blocked when entities missing

1. Find a bundle with unresolved set or series
2. Attempt to approve without resolving

**Expected Results:**
- [ ] Approval proceeds but card creation fails
- [ ] Error returned in `results.errors` array
- [ ] Message indicates missing resolution

---

## Part 3: Entity Resolution Workflows

### Test 3.1: Link to Existing Series
**Goal:** Verify admin can link to existing series

1. Find provisional card with unresolved series
2. Call `POST /api/crowdsource/admin/provisional-card/{cardId}/resolve-series`
   with `{ "series_id": {existingSeriesId} }`

**Expected Results:**
- [ ] `resolved_series_id` updated
- [ ] `series_match_confidence` set to 1.0
- [ ] Card ready for approval

---

### Test 3.2: Create New Series
**Goal:** Verify admin can create series inline

1. Find provisional card with unresolved series
2. Call `POST /api/crowdsource/admin/provisional-card/{cardId}/resolve-series`
   with `{ "name": "New Series Name" }`

**Expected Results:**
- [ ] New series created in `series` table
- [ ] Series linked to correct set
- [ ] `resolved_series_id` updated on provisional card
- [ ] Set's `series_count` incremented

---

### Test 3.3: Link to Existing Set
**Goal:** Verify admin can link to existing set

1. Find provisional card with unresolved set
2. Call `POST /api/crowdsource/admin/provisional-card/{cardId}/resolve-set`
   with `{ "set_id": {existingSetId} }`

**Expected Results:**
- [ ] `resolved_set_id` updated
- [ ] Card ready for series resolution

---

### Test 3.4: Create New Set
**Goal:** Verify admin can create set inline

1. Find provisional card with unresolved set
2. Call `POST /api/crowdsource/admin/provisional-card/{cardId}/resolve-set`
   with `{ "name": "New Set Name", "year": 2024 }`

**Expected Results:**
- [ ] New set created in `set` table
- [ ] Base series automatically created for set
- [ ] `resolved_set_id` updated on provisional card
- [ ] Slug generated correctly

---

### Test 3.5: Link to Existing Player
**Goal:** Verify admin can link to existing player

1. Find provisional card player with unresolved player
2. Call `POST /api/crowdsource/admin/provisional-card-player/{playerId}/resolve`
   with `{ "player_id": {existingPlayerId}, "team_id": {teamId} }`

**Expected Results:**
- [ ] `resolved_player_id` updated
- [ ] `resolved_player_team_id` created or linked
- [ ] `needs_review` set to false
- [ ] `match_confidence` set to 1.0

---

### Test 3.6: Create New Player
**Goal:** Verify admin can create player inline

1. Find provisional card player with unresolved player
2. Call `POST /api/crowdsource/admin/provisional-card-player/{playerId}/resolve`
   with `{ "first_name": "New", "last_name": "Player", "team_id": {teamId} }`

**Expected Results:**
- [ ] New player created in `player` table
- [ ] `player_team` link created
- [ ] `resolved_player_id` updated
- [ ] `resolved_player_team_id` updated
- [ ] Team's `player_count` incremented

---

## Part 4: Edge Cases and Error Handling

### Test 4.1: Submit Empty Cards Array
**Goal:** Verify validation

1. Call `POST /api/crowdsource/provisional-card` with `{ "cards": [] }`

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates 1-100 cards required

---

### Test 4.2: Submit More Than 100 Cards
**Goal:** Verify batch limit

1. Submit with 101 cards

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates max 100 cards

---

### Test 4.3: Submit Card Missing Required Fields
**Goal:** Verify field validation

1. Submit card without `player_name`

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates player name required

---

### Test 4.4: Approve Already Approved Bundle
**Goal:** Verify duplicate approval blocked

1. Approve a bundle
2. Try to approve again

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates bundle already approved

---

### Test 4.5: Resolve Series Before Set
**Goal:** Verify dependency order

1. Find card with unresolved set
2. Try to resolve series first

**Expected Results:**
- [ ] Returns 400 error
- [ ] Message indicates set must be resolved first

---

### Test 4.6: Rate Limiting
**Goal:** Verify submission rate limits

1. Submit many bundles rapidly

**Expected Results:**
- [ ] After limit reached, returns 429 error
- [ ] Rate limit headers present in response

---

## Part 5: Data Integrity Checks

### Test 5.1: Card Creation Integrity
**Goal:** Verify card created with all fields

After approving a bundle, check the created card:

- [ ] `card.series` matches resolved series
- [ ] `card.card_number` matches input
- [ ] `card.is_rookie`, `is_autograph`, etc. match input
- [ ] `card.color` matches resolved color (if any)
- [ ] `card_player_team` entries exist for all players

---

### Test 5.2: User Card Linking
**Goal:** Verify user_card properly transitioned

After approval:

- [ ] `user_card.card` points to new card
- [ ] `user_card.is_provisional` = 0
- [ ] `user_card.provisional_card_id` = NULL
- [ ] Original `serial_number`, `purchase_price`, etc. preserved

---

### Test 5.3: Contributor Stats
**Goal:** Verify stats tracking

After submissions and reviews:

- [ ] `bundle_submissions` incremented on submit
- [ ] `provisional_cards_submitted` incremented
- [ ] `provisional_cards_resolved` incremented on approval
- [ ] Stats reflect approval/rejection counts

---

### Test 5.4: Bundle Summary Flags
**Goal:** Verify bundle flags accurate

Check `suggestion_bundle` after submission:

- [ ] `requires_new_set` true only when set unresolved
- [ ] `requires_new_series` true only when series unresolved
- [ ] `requires_new_player` true only when player unresolved
- [ ] `requires_new_team` true only when team unresolved
- [ ] `auto_resolved_count` matches actual
- [ ] `needs_review_count` matches actual

---

## Part 6: UI Integration Tests (When Frontend Built)

### Test 6.1: Card Submission Form
- [ ] Form validates required fields
- [ ] Year picker works correctly
- [ ] Multi-player input supported
- [ ] Success message shows resolution summary
- [ ] Card appears in collection immediately

### Test 6.2: Collection View with Provisional Cards
- [ ] Provisional cards visually distinguished
- [ ] Provisional badge/indicator shown
- [ ] Clicking shows submission status

### Test 6.3: Admin Review Queue
- [ ] Queue shows pending bundles
- [ ] Sortable by date, submitter, flags
- [ ] Filter by `requires_new_*` flags
- [ ] Click opens diff view

### Test 6.4: Admin Diff View
- [ ] Side-by-side input vs. resolution
- [ ] Confidence scores color-coded
- [ ] Unresolved items highlighted
- [ ] Inline resolution forms work
- [ ] Approve/Reject buttons work

### Test 6.5: User Submission History
- [ ] Shows all user's bundles
- [ ] Status clearly indicated
- [ ] Rejection notes visible
- [ ] Can view individual card details

---

## API Endpoint Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/crowdsource/provisional-card` | Submit cards |
| GET | `/api/crowdsource/my-provisional-cards` | User's provisional cards |
| GET | `/api/crowdsource/my-bundles` | User's bundles |
| GET | `/api/crowdsource/admin/bundles` | Admin queue |
| GET | `/api/crowdsource/admin/bundles/:id` | Bundle diff view |
| POST | `/api/crowdsource/admin/bundles/:id/approve` | Approve bundle |
| POST | `/api/crowdsource/admin/bundles/:id/reject` | Reject bundle |
| POST | `/api/crowdsource/admin/provisional-card/:id/resolve-set` | Resolve set |
| POST | `/api/crowdsource/admin/provisional-card/:id/resolve-series` | Resolve series |
| POST | `/api/crowdsource/admin/provisional-card-player/:id/resolve` | Resolve player |

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Delete test bundles and related data
DELETE FROM user_card WHERE provisional_card_id IN (SELECT provisional_card_id FROM provisional_card WHERE bundle_id > {lastProductionBundleId});
DELETE FROM provisional_card_player WHERE provisional_card_id IN (SELECT provisional_card_id FROM provisional_card WHERE bundle_id > {lastProductionBundleId});
DELETE FROM provisional_card WHERE bundle_id > {lastProductionBundleId};
DELETE FROM suggestion_bundle WHERE bundle_id > {lastProductionBundleId};

-- Delete test players created
DELETE FROM player_team WHERE player IN (SELECT player_id FROM player WHERE first_name = 'Jane' AND last_name = 'Test Player');
DELETE FROM player WHERE first_name = 'Jane' AND last_name = 'Test Player';

-- Delete test cards created (be careful!)
-- DELETE FROM card_player_team WHERE card > {lastProductionCardId};
-- DELETE FROM card WHERE card_id > {lastProductionCardId};
```

---

*Document created: January 2026*
*System Version: Provisional Card System v1.0*
