# eBay Auto-Collection Integration System

## Overview
Users can connect their eBay account to automatically detect card purchases and add them to their "In Transit" collection. This system uses AI-powered card detection to identify purchases and match them to our database.

## Implementation Phases

### Phase 1: Foundation & Authentication (Week 1-2)

#### eBay Developer Setup
- [ ] Register eBay Developer account and create application
- [ ] Obtain sandbox and production API credentials  
- [ ] Set up OAuth 2.0 flow for user consent
- [ ] Configure rate limiting and API access permissions

#### Database Schema (✅ ALREADY IMPLEMENTED)
The following tables already exist in our database:

```sql
-- eBay account linking
TABLE user_ebay_accounts:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user table
- ebay_user_id (nvarchar(255), NOT NULL) - eBay's internal user ID
- ebay_username (nvarchar(255), NULLABLE) - eBay public username
- access_token (nvarchar(MAX), NOT NULL) - OAuth access token (encrypted)
- refresh_token (nvarchar(MAX), NULLABLE) - OAuth refresh token
- token_expires_at (datetime, NULLABLE) - Token expiration timestamp
- scope_permissions (nvarchar(MAX), NULLABLE) - Granted OAuth scopes
- last_sync_at (datetime, NULLABLE) - Last successful sync
- is_active (bit, NOT NULL) - Account active status
- created_at (datetime, NOT NULL) - Account link date
- updated_at (datetime, NOT NULL) - Last modification

-- eBay purchase tracking
TABLE ebay_purchases:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user
- ebay_account_id (bigint, NULLABLE) - FK to user_ebay_accounts
- ebay_item_id (nvarchar(255), NOT NULL) - eBay item identifier
- ebay_transaction_id (nvarchar(255), NULLABLE) - Transaction ID
- ebay_order_id (nvarchar(255), NULLABLE) - Order ID
- title (nvarchar(MAX), NOT NULL) - eBay listing title
- purchase_date (datetime, NOT NULL) - When purchased
- price (decimal, NOT NULL) - Purchase price
- currency (varchar(3), NOT NULL) - Currency code (USD, etc)
- quantity (int, NOT NULL) - Items purchased
- seller_name (nvarchar(255), NULLABLE) - Seller username
- seller_feedback_score (int, NULLABLE) - Seller's feedback rating
- image_url (nvarchar(MAX), NULLABLE) - eBay item image URL
- ebay_category_id (int, NULLABLE) - eBay category
- category_path (nvarchar(MAX), NULLABLE) - Full category breadcrumb
- item_condition (nvarchar(50), NULLABLE) - Item condition
- is_sports_card (bit, NULLABLE) - AI detected as sports card
- card_confidence (decimal, NULLABLE) - Sports card detection confidence
- detected_sport (nvarchar(50), NULLABLE) - Auto-detected sport
- detected_year (int, NULLABLE) - Auto-detected year
- detected_brand (nvarchar(100), NULLABLE) - Auto-detected brand/set
- detected_series (nvarchar(255), NULLABLE) - Auto-detected series
- detected_player (nvarchar(255), NULLABLE) - Auto-detected player
- status (varchar(50), NOT NULL) - Processing status
- user_notes (nvarchar(MAX), NULLABLE) - User's manual notes
- matched_card_id (bigint, NULLABLE) - FK to matched card
- match_confidence (decimal, NULLABLE) - Match confidence score
- manual_match (bit, NOT NULL) - User manually matched
- processed_at (datetime, NULLABLE) - Processing timestamp
- created_at (datetime, NOT NULL) - Record creation
- updated_at (datetime, NOT NULL) - Last update

-- eBay sync tracking
TABLE ebay_sync_logs:
- id (bigint, NOT NULL) - Primary key
- user_id (bigint, NOT NULL) - FK to user
- ebay_account_id (bigint, NULLABLE) - FK to user_ebay_accounts
- sync_type (varchar(50), NOT NULL) - 'full', 'incremental', 'manual'
- sync_start (datetime, NOT NULL) - Sync start time
- sync_end (datetime, NULLABLE) - Sync completion time
- items_processed (int, NOT NULL) - Total items processed
- sports_cards_found (int, NOT NULL) - Cards detected as sports cards
- new_purchases (int, NOT NULL) - New purchases found
- errors_encountered (int, NOT NULL) - Error count
- error_details (nvarchar(MAX), NULLABLE) - Error descriptions
- status (varchar(50), NOT NULL) - 'pending', 'running', 'completed', 'failed'

-- eBay account deletion tracking (GDPR compliance)
TABLE ebay_deletion_log:
- log_id (bigint, NOT NULL) - Primary key
- username (nvarchar(255), NOT NULL) - eBay username
- user_id (nvarchar(255), NOT NULL) - eBay user ID
- eias_token (nvarchar(MAX), NULLABLE) - Account deletion token
- deletion_date (datetime2, NULLABLE) - When account was deleted
- processed (bit, NULLABLE) - Whether deletion was processed
- created_at (datetime2, NULLABLE) - Log entry creation
```

#### Backend Infrastructure
- [ ] Create `/api/ebay/auth/*` endpoints for OAuth flow
- [ ] Implement secure token storage with encryption
- [ ] Add automatic token refresh mechanism
- [ ] Build eBay API client wrapper with rate limiting

### Phase 2: Purchase Detection & Sync (Week 3-4)

#### Real-time Purchase Monitoring
- [ ] eBay webhook integration for instant purchase notifications
- [ ] Fallback periodic sync job (every 15 minutes)
- [ ] Purchase data extraction and validation
- [ ] Error handling and retry logic

#### Purchase Detection Flow
1. **Webhook Notification**: eBay sends purchase event
2. **Data Extraction**: Parse purchase details from eBay API
3. **Sports Card Classification**: AI determines if item is a sports card
4. **Database Storage**: Store purchase in `ebay_purchases` table
5. **Processing Queue**: Add to card matching queue

### Phase 3: AI-Powered Card Detection (Week 5-6)

#### Card Detection Engine
```javascript
// Example detection pipeline
const cardDetection = {
  titleParsing: {
    // Extract: "2023 Topps Chrome Ronald Acuna Jr PSA 10"
    player: "Ronald Acuna Jr",
    year: 2023,
    brand: "Topps",
    series: "Chrome", 
    condition: "PSA 10"
  },
  categoryFiltering: {
    // Focus on eBay sports card categories
    sportsCards: [261328, 212, 213], // eBay category IDs
    confidence: 0.95
  },
  databaseMatching: {
    // Fuzzy search against our 793k+ cards
    exactMatch: 0.95,
    fuzzyMatch: 0.75,
    suggestions: []
  }
}
```

#### Smart Matching Logic
- **High Confidence (>85%)**: Auto-add to "In Transit To Me"
- **Medium Confidence (50-84%)**: User review queue
- **Low Confidence (<50%)**: Manual review with suggestions

#### Machine Learning Improvements
- [ ] Track user approval/rejection patterns
- [ ] Improve detection algorithms based on feedback
- [ ] Build training dataset from successful matches

### Phase 4: User Interface & Experience (Week 7-8)

#### eBay Account Management
- [ ] Settings page for eBay account linking
- [ ] OAuth consent flow UI
- [ ] Account status display (connected/disconnected)
- [ ] Sync history and error logs

#### Purchase Review System
- [ ] Review queue for pending matches
- [ ] Approve/reject interface with card previews
- [ ] Manual card selection with search
- [ ] Override system for training AI

#### Notification Integration
- [ ] Real-time purchase detection alerts
- [ ] Auto-addition confirmations
- [ ] Review queue notifications
- [ ] Email digest options

## API Endpoints

### Authentication
```
POST   /api/ebay/auth/initiate     - Start OAuth process
GET    /api/ebay/auth/callback     - Handle OAuth callback  
POST   /api/ebay/auth/refresh      - Refresh expired tokens
DELETE /api/ebay/auth/disconnect   - Unlink eBay account
GET    /api/ebay/auth/status       - Check connection status
```

### Purchase Management
```
POST /api/ebay/sync/manual         - Trigger manual sync
GET  /api/ebay/purchases           - Get purchase history
PUT  /api/ebay/purchases/:id/match - Override card match
GET  /api/ebay/purchases/pending   - Get items needing review
POST /api/ebay/purchases/:id/add   - Add to collection
```

### Webhooks
```
POST /api/ebay/webhooks/purchase   - eBay purchase notification
POST /api/ebay/webhooks/account    - Account deletion notification
```

## Security & Privacy

### Data Protection
- **Token Encryption**: All eBay tokens encrypted at rest using AES-256
- **Minimal Storage**: Only store necessary purchase information
- **User Control**: Easy account unlinking and data deletion
- **GDPR Compliance**: Comprehensive deletion logging

### API Security
- **Rate Limiting**: Respect eBay API limits with exponential backoff
- **Webhook Validation**: Verify eBay webhook signatures
- **Error Handling**: Graceful degradation on API failures
- **Audit Logging**: Track all eBay integration activities

## Success Metrics

### User Adoption
- % of users who link eBay accounts
- Average time from signup to first eBay connection
- User retention after connecting eBay

### Match Accuracy
- Auto-match success rate (high confidence)
- User approval rate for medium confidence matches
- False positive/negative rates

### Performance
- Average processing time per purchase
- API response times and error rates
- User satisfaction scores

## Risk Mitigation

### Technical Risks
- **eBay API Changes**: Regular monitoring and adaptation
- **Rate Limiting**: Conservative usage with queuing system
- **Data Loss**: Comprehensive backup and recovery procedures

### Business Risks
- **Policy Compliance**: Regular review of eBay ToS and guidelines
- **User Privacy**: Strict data handling and transparency
- **Match Quality**: Conservative confidence thresholds

## Future Enhancements

### Additional Marketplaces
- COMC (Check Out My Cards) integration
- Sportlots marketplace support
- Facebook Marketplace detection
- Heritage Auctions tracking

### Advanced Features
- **Price Tracking**: Monitor card value changes over time
- **Duplicate Detection**: Identify similar cards across purchases
- **Collection Analytics**: Purchase pattern analysis
- **Smart Notifications**: Predictive alerts for wanted cards

### AI Improvements
- **Image Recognition**: OCR for card details from photos
- **Condition Assessment**: Automatic condition grading
- **Market Analysis**: Price trend predictions
- **Personalization**: Custom detection based on user preferences

## Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1-2  | Foundation | eBay Developer setup, OAuth endpoints, API client |
| 3-4  | Detection | Webhook integration, purchase sync, basic AI |
| 5-6  | Matching | Advanced card detection, fuzzy matching, confidence scoring |
| 7-8  | Interface | User settings, review queue, notifications |
| 9+   | Polish | Testing, optimization, documentation, launch |

## Getting Started

1. **eBay Developer Registration**: Apply for developer account
2. **API Credentials**: Obtain sandbox and production keys
3. **Database Verification**: Confirm all tables exist and are properly indexed
4. **Development Environment**: Set up eBay sandbox for testing
5. **Initial Implementation**: Start with basic OAuth flow

This system will revolutionize how collectors manage their purchases, automatically bridging the gap between buying and cataloging cards!