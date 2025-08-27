# Automated Spreadsheet Generation System

## Overview
Implement an automated system that generates and maintains downloadable Excel spreadsheets for every set in the database. These spreadsheets will be automatically regenerated whenever relevant data changes, ensuring users always download the most current information.

## Key Features

### 1. Automatic Regeneration Triggers
- **Card Operations**: Add, edit, or delete any card
- **Series Operations**: Add, edit, delete series; change series order or assignment
- **Set Operations**: Rename set, update year, change manufacturer
- **Related Data**: Player name changes, team updates, color/parallel modifications

### 2. Generation Architecture

#### Backend Components
```
1. Change Detection Layer
   - Prisma middleware to intercept all database operations
   - Identify which sets are affected by each change
   - Queue regeneration jobs for affected sets

2. Job Queue System
   - Redis queue or database queue table
   - Debouncing: Wait 30 seconds after last change before processing
   - Deduplication: Prevent multiple jobs for same set
   - Priority system: Recently viewed sets get higher priority

3. Generation Worker Service
   - Background process (Azure Functions or dedicated worker)
   - Pulls jobs from queue
   - Generates comprehensive Excel file using ExcelJS
   - Uploads to Azure Blob Storage
   - Updates database with new blob URL and timestamp

4. Storage Strategy
   - Azure Blob Storage for generated files
   - Keep 3 versions (current + 2 previous)
   - CDN integration for fast global downloads
   - Automatic cleanup of old versions
```

#### Database Schema Changes
```sql
-- Add to 'set' table
ALTER TABLE [set] ADD 
  checklist_blob_url NVARCHAR(MAX),
  checklist_generated_at DATETIME,
  checklist_generation_status VARCHAR(50), -- 'current', 'generating', 'failed'
  checklist_file_size INT,
  checklist_format VARCHAR(20) -- 'xlsx', 'csv', 'pdf'

-- New queue table
CREATE TABLE spreadsheet_generation_queue (
  queue_id INT PRIMARY KEY IDENTITY,
  set_id INT FOREIGN KEY REFERENCES [set](set_id),
  priority INT DEFAULT 5,
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
  queued_at DATETIME DEFAULT GETDATE(),
  started_at DATETIME,
  completed_at DATETIME,
  error_message NVARCHAR(MAX),
  retry_count INT DEFAULT 0
)

-- Track what triggered regeneration
CREATE TABLE spreadsheet_generation_log (
  log_id INT PRIMARY KEY IDENTITY,
  set_id INT FOREIGN KEY REFERENCES [set](set_id),
  trigger_type VARCHAR(50), -- 'card_update', 'series_update', 'manual', etc.
  trigger_details NVARCHAR(MAX), -- JSON with specifics
  generated_at DATETIME,
  file_size INT,
  generation_time_ms INT
)
```

### 3. Excel Spreadsheet Format

#### Structure
- **Cover Sheet**: Set overview, statistics, last updated timestamp
- **Series Tabs**: One worksheet per series (Base Set, Rookies, Autographs, etc.)
- **Master Checklist**: Combined view of all cards
- **Statistics Tab**: Breakdown by player, team, parallel, etc.

#### Styling Features
- **Headers**: Bold, colored background matching set theme
- **Parallel Rows**: Cell backgrounds match actual parallel colors
- **Frozen Panes**: Headers and card numbers stay visible
- **Column Widths**: Auto-sized for optimal viewing
- **Conditional Formatting**: 
  - Highlight rookie cards
  - Different colors for autographs/relics
  - Print run indicators
- **Formulas**: 
  - Completion percentage
  - Total card count
  - Value calculations (if pricing data available)

#### Data Columns
1. Card Number
2. Player Name(s)
3. Team(s)
4. Rookie Status
5. Parallel/Color
6. Print Run
7. Autograph (Y/N)
8. Relic (Y/N)
9. Series Name
10. Notes
11. (For authenticated users) Owned Quantity
12. (For authenticated users) Location
13. (For authenticated users) Grade

### 4. User Experience

#### Public Interface
- Download button shows current status:
  - ✓ "Download Checklist" (ready)
  - ⟳ "Generating..." (in progress)
  - ⚠ "Generate Checklist" (needs generation)
- Display "Last updated: X minutes/hours/days ago"
- File size indicator
- Format selector (Excel, CSV, PDF)

#### Admin Interface
- Manual regeneration button (force update)
- Generation history log
- Error notifications
- Bulk regeneration tools
- Format configuration options

### 5. Implementation Phases

#### Phase 1: Foundation (Week 1)
- [ ] Database schema updates
- [ ] Basic queue system
- [ ] Manual generation trigger from admin
- [ ] Simple CSV generation
- [ ] Blob storage integration

#### Phase 2: Automation (Week 2)
- [ ] Prisma middleware for change detection
- [ ] Automatic queueing system
- [ ] Debouncing logic
- [ ] Background worker setup
- [ ] Basic Excel generation with ExcelJS

#### Phase 3: Enhanced Format (Week 3)
- [ ] Multi-tab Excel structure
- [ ] Styling and colors
- [ ] Formulas and statistics
- [ ] Conditional formatting
- [ ] Cover sheet with set imagery

#### Phase 4: Optimization (Week 4)
- [ ] CDN integration
- [ ] Caching strategy
- [ ] Performance monitoring
- [ ] Error recovery
- [ ] Version management

### 6. Technical Considerations

#### Performance
- Generation time target: < 30 seconds for large sets
- Use streaming for large datasets
- Implement progress tracking for long operations
- Queue priority based on set popularity/recency

#### Reliability
- Retry failed generations (max 3 attempts)
- Fallback to previous version if generation fails
- Alert admins on repeated failures
- Health checks for worker service

#### Scalability
- Horizontal scaling of worker processes
- Partitioned queue for load distribution
- Rate limiting to prevent overwhelming the system
- Scheduled regeneration during off-peak hours for non-critical updates

### 7. Monitoring & Analytics

#### Metrics to Track
- Generation frequency per set
- Average generation time
- File sizes
- Download counts
- Error rates
- Queue depth and processing time

#### Alerts
- Generation failures
- Queue backup (> 100 pending jobs)
- Unusually long generation times (> 2 minutes)
- Storage quota approaching limit

### 8. Future Enhancements
- **Multiple Formats**: PDF checklists, printable versions
- **Customization**: User preferences for column selection
- **Language Support**: Multi-language spreadsheets
- **Integration**: Direct upload to Google Sheets/OneDrive
- **Personalization**: Include user's collection data in download
- **Watermarking**: Add CollectYourCards.com branding
- **QR Codes**: Link back to digital version
- **API Access**: Allow third-party apps to fetch checklists

## Success Criteria
1. Zero manual intervention required for updates
2. All spreadsheets current within 5 minutes of data change
3. 99.9% generation success rate
4. Download time < 2 seconds globally via CDN
5. Support for sets with 10,000+ cards

## Notes
- Consider using Azure Durable Functions for orchestration
- Implement feature flags for gradual rollout
- A/B test different Excel formats with users
- Consider offering "premium" formats for paid users