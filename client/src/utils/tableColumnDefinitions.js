/**
 * Table Column Definitions
 *
 * Centralized configuration for customizable table columns
 * Used by CardTable, CollectionTable, etc. with ColumnPicker component
 *
 * Column Properties:
 * - id: Unique identifier for the column
 * - label: Display name in column picker and table header
 * - defaultVisible: Whether column is shown by default
 * - alwaysVisible: If true, user cannot hide this column
 * - mobileVisible: Whether to show on mobile (<768px) by default
 * - sortable: Whether the column can be sorted
 * - width: CSS width value or 'auto'
 * - description: Help text for column picker (optional)
 */

export const CARD_TABLE_COLUMNS = {
  // Core columns (always visible or default visible)
  card_number: {
    id: 'card_number',
    label: 'Card #',
    defaultVisible: true,
    alwaysVisible: true, // Card number is essential
    mobileVisible: true,
    sortable: true,
    width: '120px',
    description: 'Card number from the series'
  },

  player: {
    id: 'player',
    label: 'Player(s)',
    defaultVisible: true,
    alwaysVisible: true, // Player name is essential
    mobileVisible: true,
    sortable: true,
    width: 'auto',
    description: 'Player names and teams'
  },

  series: {
    id: 'series',
    label: 'Series',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: 'auto',
    description: 'Series name'
  },

  // Attribute columns (shown by default)
  color: {
    id: 'color',
    label: 'Color',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: 'auto',
    description: 'Card color/parallel'
  },

  print_run: {
    id: 'print_run',
    label: 'Print Run',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'Numbered print run (e.g., /99)'
  },

  auto: {
    id: 'auto',
    label: 'Auto',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Autograph indicator'
  },

  relic: {
    id: 'relic',
    label: 'Relic',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Relic/memorabilia indicator'
  },

  sp: {
    id: 'sp',
    label: 'SP',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Short print indicator'
  },

  // Optional columns (hidden by default)
  notes: {
    id: 'notes',
    label: 'Notes',
    defaultVisible: false, // Often empty, hide by default
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: 'auto',
    description: 'Additional card notes'
  },

  production_code: {
    id: 'production_code',
    label: 'Production Code',
    defaultVisible: false, // Advanced feature, hide by default
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: '150px',
    description: 'Series production code'
  },

  shop: {
    id: 'shop',
    label: 'Shop',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: '80px',
    description: 'Find card on marketplaces'
  },

  // User-specific columns (only shown when authenticated)
  owned: {
    id: 'owned',
    label: 'Owned',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: true,
    sortable: false,
    width: '60px',
    description: 'Number of copies you own',
    requiresAuth: true
  }
}

export const COLLECTION_TABLE_COLUMNS = {
  // Core columns
  card_number: {
    id: 'card_number',
    label: 'Card #',
    defaultVisible: true,
    alwaysVisible: true,
    mobileVisible: true,
    sortable: true,
    width: '120px',
    description: 'Card number from the series'
  },

  player: {
    id: 'player',
    label: 'Player(s)',
    defaultVisible: true,
    alwaysVisible: true,
    mobileVisible: true,
    sortable: true,
    width: 'auto',
    description: 'Player names and teams'
  },

  series: {
    id: 'series',
    label: 'Series',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: 'auto',
    description: 'Series name'
  },

  // Collection-specific columns
  serial_number: {
    id: 'serial_number',
    label: 'Serial #',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '100px',
    description: 'Serial number on your card (e.g., 45/99)'
  },

  location: {
    id: 'location',
    label: 'Location',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '150px',
    description: 'Where the card is stored'
  },

  grade: {
    id: 'grade',
    label: 'Grade',
    defaultVisible: false, // Most cards aren't graded
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '100px',
    description: 'Grading score'
  },

  grading_agency: {
    id: 'grading_agency',
    label: 'Grading Agency',
    defaultVisible: false, // Most cards aren't graded
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'Who graded the card (PSA, BGS, etc.)'
  },

  purchase_price: {
    id: 'purchase_price',
    label: 'Purchase Price',
    defaultVisible: false, // Private financial info
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'How much you paid for the card'
  },

  estimated_value: {
    id: 'estimated_value',
    label: 'Estimated Value',
    defaultVisible: false, // Optional financial tracking
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '140px',
    description: 'Estimated current value'
  },

  current_value: {
    id: 'current_value',
    label: 'Current Value',
    defaultVisible: false, // Optional financial tracking
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'Latest market value'
  },

  color: {
    id: 'color',
    label: 'Color',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: 'auto',
    description: 'Card color/parallel'
  },

  print_run: {
    id: 'print_run',
    label: 'Print Run',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'Numbered print run (e.g., /99)'
  },

  auto: {
    id: 'auto',
    label: 'Auto',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Autograph indicator'
  },

  relic: {
    id: 'relic',
    label: 'Relic',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Relic/memorabilia indicator'
  },

  sp: {
    id: 'sp',
    label: 'SP',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '80px',
    description: 'Short print indicator'
  },

  aftermarket_autograph: {
    id: 'aftermarket_autograph',
    label: 'Aftermarket Auto',
    defaultVisible: false, // Rare case
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: '140px',
    description: 'Card signed after production'
  },

  is_special: {
    id: 'is_special',
    label: 'Favorite',
    defaultVisible: true,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '90px',
    description: 'Marked as favorite card'
  },

  date_added: {
    id: 'date_added',
    label: 'Date Added',
    defaultVisible: false, // Optional metadata
    alwaysVisible: false,
    mobileVisible: false,
    sortable: true,
    width: '120px',
    description: 'When you added this card'
  },

  notes: {
    id: 'notes',
    label: 'Notes',
    defaultVisible: false,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: 'auto',
    description: 'Your personal notes'
  },

  production_code: {
    id: 'production_code',
    label: 'Production Code',
    defaultVisible: false,
    alwaysVisible: false,
    mobileVisible: false,
    sortable: false,
    width: '150px',
    description: 'Series production code'
  }
}

/**
 * Get default visible columns for a table
 * @param {string} tableName - Name of the table ('card_table' or 'collection_table')
 * @returns {string[]} Array of column IDs that should be visible by default
 */
export function getDefaultVisibleColumns(tableName) {
  const columns = tableName === 'collection_table'
    ? COLLECTION_TABLE_COLUMNS
    : CARD_TABLE_COLUMNS

  return Object.values(columns)
    .filter(col => col.defaultVisible)
    .map(col => col.id)
}

/**
 * Get mobile-friendly columns (for responsive defaults)
 * @param {string} tableName - Name of the table
 * @returns {string[]} Array of column IDs optimized for mobile
 */
export function getMobileVisibleColumns(tableName) {
  const columns = tableName === 'collection_table'
    ? COLLECTION_TABLE_COLUMNS
    : CARD_TABLE_COLUMNS

  return Object.values(columns)
    .filter(col => col.mobileVisible)
    .map(col => col.id)
}

/**
 * Check if user is on mobile device
 * @returns {boolean}
 */
export function isMobileDevice() {
  return window.innerWidth < 768
}
