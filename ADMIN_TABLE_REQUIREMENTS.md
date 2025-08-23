# Admin Table Requirements Documentation

## Universal Requirements (All Tables)

### ✅ COMPLETED
1. **Remove row number columns** - No incrementing row number column needed universally
2. **Replace JavaScript alerts** - Use custom confirmation dialogs instead of `window.confirm()`
3. **Remove breadcrumbing** - Header breadcrumb navigation is redundant with quick jump menu
4. **Auto-scroll for new rows** - When adding rows, scroll to bottom to make them visible
5. **Full-width tables** - Utilize full screen width on PC screens with responsive design
6. **Boolean checkboxes** - All boolean values represented with interactive checkboxes
7. **No-wrap columns** - Important columns (name fields) never truncate or wrap

### 🔄 IN PROGRESS  
8. **Client-side search filtering** - Load data once, filter locally without new API calls
9. **Resizable columns** - All columns need to be resizable in every table
10. **Dynamic dropdowns** - Organization, set, parallel_of_series dropdowns

## Table-Specific Requirements

### Teams Table
- ✅ **team_Id**: Not clickable within Teams table
- 🔄 **organization**: Dropdown list from organization table (show name, store organization_id)
- ✅ **card_count**: Visible but read-only (not editable)

### Series Table  
- ✅ **series_id**: Not clickable within Series table
- 🔄 **name**: Never truncate or wrap - most important data for users
- 🔄 **set**: Dropdown of all possible sets (show name, store set_id)
- 🔄 **card_count**: SHOULD be editable (reported set card count)
- 🔄 **card_entered_count**: Should NOT be editable (actual entered count)
- 🔄 **parallel_of_series**: Dropdown showing only series from same set that are not parallels themselves
- 🔄 **Image upload fields**: front_image_path and back_image_path should allow Azure blob storage uploads
- ❌ **Hide fields**: min_print_run, max_print_run, print_run_variations, print_run_display (not shown/editable)
- ❌ **Schema fix needed**: Replace color_name, color_hex, color_variations with single color_id foreign key

### Sets Table
- ✅ **set_id**: Not clickable within Sets table  
- 🔄 **name**: Never truncate or wrap - most important data for users
- 🔄 **organization**: Dropdown list from organization table
- 🔄 **card_count**: Not editable (computed)
- 🔄 **series_count**: Not editable (computed)
- 🔄 **is_complete**: Checkbox representation

### Colors Table
- ✅ **color_id**: Not clickable within Colors table
- ✅ **created**: Hidden (not shown)

### Grading Agencies Table
- ✅ **grading_agency_id**: Not clickable within Grading Agencies table
- ✅ **created**: Hidden (not shown)

## Technical Implementation Details

### Field Configuration System
```javascript
TABLE_FIELD_CONFIG = {
  [tableName]: {
    hiddenFields: [],           // Fields not shown in UI
    readonlyFields: [],         // Visible but not editable  
    dropdownFields: {           // Dynamic dropdowns from related tables
      [fieldName]: { 
        sourceTable: 'table_name',
        valueField: 'id_field',
        displayField: 'display_field',
        filter: (item, currentRow) => boolean  // Optional filter function
      }
    },
    booleanFields: [],          // Fields to render as checkboxes
    noWrapFields: [],           // Fields that should never truncate
    editableFields: []          // Explicitly editable (overrides readonly rules)
  }
}
```

### Database Schema Changes Needed
1. **Series table**: Replace individual color fields with single `color_id` foreign key to colors table

### UI/UX Improvements Needed
1. **Dropdown implementation** for all foreign key relationships
2. **Checkbox widgets** for all boolean fields
3. **Column resizing** with draggable handles
4. **No-wrap CSS** for critical columns like 'name'
5. **Client-side filtering** instead of API calls for search
6. **Image upload widgets** for Azure blob storage integration

## Status Legend
- ✅ **COMPLETED**: Fully implemented and working
- 🔄 **IN PROGRESS**: Partially implemented, needs completion
- ❌ **NOT STARTED**: Requirements documented but not implemented

## Priority Order
1. Boolean checkboxes (high visual impact)
2. Dropdown fields (critical for data integrity) 
3. No-wrap columns (usability)
4. Client-side search (performance)
5. Column resizing (nice-to-have)
6. Image uploads (future enhancement)
7. Database schema fixes (requires coordination)