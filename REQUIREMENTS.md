# Collect Your Cards - Feature Requirements

## User Collection Management

### 1. Collection Page Inline Editing
- **Location**: `/collection` page
- **Requirement**: Users need the ability to edit the card data that came from `user_card` table in the database
- **Editable Fields**: 
  - Serial number
  - Location
  - Purchase price
  - Purchase date
  - Current value
  - Grade
  - Notes
  - Special flags (for sale, wanted, etc.)
- **Restriction**: Users should NOT be able to edit data from the `card` table (core card metadata)

### 2. Add to Collection from Card Listings
- **Location**: `/players/`, `/series/` detail pages, and anywhere cards are listed
- **Requirement**: Authenticated users should be able to easily add a card to their collection
- **Implementation**: 
  - "Add to Collection" button on each card row
  - Modal/dialog to collect additional data:
    - Serial number
    - Location (dropdown from user's locations)
    - Purchase price
    - Purchase date
    - Quantity
    - Grade (if applicable)
    - Notes
- **Scope**: This capability should be available anywhere a list of cards is shown

### 3. Location Management System
- **Requirement**: Authenticated users need a dedicated interface to manage storage locations
- **Features**:
  - Create new locations (name, description)
  - Edit existing locations
  - Delete locations (with warning if cards are assigned)
  - View list of cards assigned to each location
  - Move cards between locations (bulk operations)
- **Access**: Available from user settings or dedicated `/locations` page

### 4. Delete Cards from Collection
- **Location**: `/collection` page
- **Implementation**:
  - Red X button at the end of each row
  - Confirmation dialog with card details
  - "Are you sure you want to remove [Card Name] from your collection?"
  - Prevent accidental deletions
- **UX**: Clear visual indication, hover states, confirmation required

## Data Administration Features

### 5. Data Admin Role and Card Editing Workflow
- **New User Role**: "data_admin"
- **Capabilities**:
  - See edit button on all card tables when browsing
  - Submit corrections for card metadata
  - Cannot directly modify production data
  
- **Workflow**:
  1. Data admin finds incorrect card data
  2. Clicks edit button on card row
  3. Opens edit form with current values
  4. Submits changes with reason/notes
  5. Changes saved to `card_change_requests` staging table
  6. All admin users receive email notification
  7. Email contains:
     - User who submitted change
     - Card details
     - Old values vs New values comparison
     - Reason for change
     - Approve/Deny buttons
  8. Approval commits changes to production `card` table
  9. Denial marks request as rejected with optional reason
  
- **Staging Table Schema** (`card_change_requests`):
  ```sql
  - request_id (primary key)
  - card_id (foreign key)
  - requested_by (user_id)
  - requested_at (timestamp)
  - status (pending/approved/denied)
  - old_values (JSON)
  - new_values (JSON)
  - change_reason (text)
  - reviewed_by (user_id, nullable)
  - reviewed_at (timestamp, nullable)
  - review_notes (text, nullable)
  ```

## Technical Requirements

### Database Changes Needed:
1. Add `card_change_requests` table
2. Add `data_admin` role to user permissions
3. Ensure `user_card` table has all necessary fields for user-specific data
4. Add `locations` table for user-defined storage locations

### API Endpoints Needed:
1. `PUT /api/collection/:id` - Update user_card data
2. `POST /api/collection/add` - Add card to collection with metadata
3. `DELETE /api/collection/:id` - Remove card from collection
4. `GET/POST/PUT/DELETE /api/locations` - Location CRUD operations
5. `POST /api/cards/:id/request-change` - Submit card data change request
6. `GET /api/admin/change-requests` - View pending change requests
7. `POST /api/admin/change-requests/:id/approve` - Approve change
8. `POST /api/admin/change-requests/:id/deny` - Deny change

### Email Notifications:
- Use existing email service (SendGrid/similar)
- Template for change request notifications
- Include secure approve/deny links with tokens
- Log all email notifications

### Security Considerations:
- Validate user ownership before allowing user_card edits
- Ensure data_admin role is properly checked
- Sanitize all user inputs
- Audit trail for all data modifications
- Rate limiting on change requests

## Admin Card Management

### 6. Admin Cards Page with Advanced Search and Inline Editing
- **Location**: `/admin/cards`
- **Search Feature**:
  - Same player search box as used on `/players` page
  - Autocomplete functionality
  - Debounced search
  - Show player details in dropdown
  - Filter cards by selected player(s)
  
- **Table Display**:
  - Similar table structure to other card listings
  - Optimized for data management tasks
  - Sortable columns
  - Pagination with adjustable page size
  
- **Inline Editable Fields**:
  - **Print Run**: Numeric input with validation
  - **Color**: Dropdown or autocomplete from colors table
  - **Attributes**: Multi-select checkboxes (rookie, autograph, relic, etc.)
  - **Notes**: Text field with auto-expand
  - **Series**: Dropdown/autocomplete from series table
  - **Player(s)**: Multi-select with player search
  - **Card Number**: Text input with format validation
  
- **UX Requirements**:
  - Click to edit any cell
  - Auto-save on blur or Enter key
  - Visual indication of edit mode (highlight, border)
  - Loading spinner during save
  - Success/error feedback
  - Undo capability for recent changes
  - Keyboard navigation between cells
  - Tab to move to next field
  - Escape to cancel edit
  
- **Technical Implementation**:
  - Optimistic UI updates
  - Debounced auto-save
  - Validation before save
  - Batch updates for multiple changes
  - Change history/audit log
  - Conflict resolution for concurrent edits

### 7. Bulk Operations
- **Features**:
  - Select multiple cards with checkboxes
  - Bulk edit common fields
  - Bulk assign to series
  - Bulk update attributes
  - Export selected cards
  - Delete multiple cards (with confirmation)
  
- **Safety**:
  - Preview changes before applying
  - Rollback capability
  - Audit trail for all bulk operations

## Implementation Priority:
1. Delete cards from collection (simplest)
2. Inline editing of user_card data
3. Add to collection from card listings
4. Admin cards page with search and inline editing
5. Location management system
6. Data admin role and staging workflow
7. Bulk operations

## Notes:
- All features should maintain existing UI/UX patterns
- Mobile responsiveness required
- Performance optimization for large collections
- Comprehensive error handling and user feedback
- Inline editing should feel instant and seamless
- All admin operations should be logged for audit purposes