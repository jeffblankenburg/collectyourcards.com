import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './AdminTables.css'

const DATABASE_TABLES = [
  // Core Data Tables
  { name: 'card', displayName: 'Cards', category: 'Core Data', icon: 'card', description: 'All trading cards in the database' },
  { name: 'player', displayName: 'Players', category: 'Core Data', icon: 'user', description: 'Player information and statistics' },
  { name: 'team', displayName: 'Teams', category: 'Core Data', icon: 'users', description: 'Team data and organization details' },
  { name: 'series', displayName: 'Series', category: 'Core Data', icon: 'collection', description: 'Card series and set information' },
  { name: 'set', displayName: 'Sets', category: 'Core Data', icon: 'archive', description: 'Card set definitions and metadata' },
  
  // Reference Tables
  { name: 'color', displayName: 'Colors', category: 'Reference Data', icon: 'color', description: 'Color definitions for parallels' },
  { name: 'grading_agency', displayName: 'Grading Agencies', category: 'Reference Data', icon: 'star', description: 'Card grading company information' },
  { name: 'manufacturer', displayName: 'Manufacturers', category: 'Reference Data', icon: 'factory', description: 'Card manufacturer details' },
  { name: 'organization', displayName: 'Organizations', category: 'Reference Data', icon: 'building', description: 'Sports organization data' },
  
  // Relationship Tables
  { name: 'card_player_team', displayName: 'Card-Player-Team Links', category: 'Relationships', icon: 'link', description: 'Links cards to players and teams' },
  { name: 'player_team', displayName: 'Player-Team Links', category: 'Relationships', icon: 'link', description: 'Historical player team associations' },
  { name: 'card_variation', displayName: 'Card Variations', category: 'Relationships', icon: 'shuffle', description: 'Card variant and parallel information' },
  { name: 'player_alias', displayName: 'Player Aliases', category: 'Relationships', icon: 'alias', description: 'Alternative player names and nicknames' },
  
  // User Data Tables
  { name: 'user', displayName: 'Users', category: 'User Data', icon: 'user', description: 'User accounts and profiles' },
  { name: 'user_card', displayName: 'User Collections', category: 'User Data', icon: 'heart', description: 'Individual user card collections' },
  { name: 'user_location', displayName: 'User Locations', category: 'User Data', icon: 'map', description: 'User-defined storage locations' },
  { name: 'user_player', displayName: 'User Player Visits', category: 'User Data', icon: 'eye', description: 'Player page visit tracking' },
  { name: 'user_team', displayName: 'User Team Visits', category: 'User Data', icon: 'eye', description: 'Team page visit tracking' },
  { name: 'user_series', displayName: 'User Series Visits', category: 'User Data', icon: 'eye', description: 'Series page visit tracking' },
  
  // Import & Processing
  { name: 'import_job', displayName: 'Import Jobs', category: 'Import System', icon: 'upload', description: 'Data import job tracking' },
  { name: 'import_staging', displayName: 'Import Staging', category: 'Import System', icon: 'staging', description: 'Temporary import data staging' },
  { name: 'import_series_staging', displayName: 'Series Staging', category: 'Import System', icon: 'staging', description: 'Series import staging data' },
  { name: 'import_mapping', displayName: 'Import Mappings', category: 'Import System', icon: 'map', description: 'Import field mapping definitions' },
  { name: 'import_recovery_point', displayName: 'Recovery Points', category: 'Import System', icon: 'shield', description: 'Import rollback recovery points' },
  
  // Logs & Audit
  { name: 'admin_action_log', displayName: 'Admin Actions', category: 'Audit Logs', icon: 'activity', description: 'Administrative action audit trail' },
  { name: 'user_auth_log', displayName: 'Authentication Logs', category: 'Audit Logs', icon: 'lock', description: 'User authentication event logs' },
  { name: 'user_session', displayName: 'User Sessions', category: 'Audit Logs', icon: 'clock', description: 'Active user session tracking' },
  
  // eBay Integration
  { name: 'ebay_purchases', displayName: 'eBay Purchases', category: 'eBay Integration', icon: 'shopping', description: 'eBay purchase transaction data' },
  { name: 'user_ebay_accounts', displayName: 'eBay Accounts', category: 'eBay Integration', icon: 'link', description: 'Linked eBay account information' },
  { name: 'ebay_sync_logs', displayName: 'eBay Sync Logs', category: 'eBay Integration', icon: 'refresh', description: 'eBay data synchronization logs' },
  { name: 'ebay_deletion_log', displayName: 'eBay Deletions', category: 'eBay Integration', icon: 'trash', description: 'eBay account deletion tracking' },
  
  // Utilities & Processing
  { name: 'duplicate_detection_job', displayName: 'Duplicate Detection Jobs', category: 'Data Quality', icon: 'search', description: 'Duplicate record detection jobs' },
  { name: 'duplicate_player_group', displayName: 'Duplicate Player Groups', category: 'Data Quality', icon: 'users', description: 'Grouped duplicate player records' },
  { name: 'duplicate_player_member', displayName: 'Duplicate Members', category: 'Data Quality', icon: 'user', description: 'Individual duplicate player entries' },
  { name: 'staging_data', displayName: 'Staging Data', category: 'Data Quality', icon: 'database', description: 'Temporary data staging area' },
  { name: 'user_card_photo', displayName: 'Card Photos', category: 'Media', icon: 'image', description: 'User-uploaded card photos' }
]

function AdminTables() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-tables-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Administrative privileges required to access this page.</p>
          <Link to="/" className="back-home-btn">
            <Icon name="home" size={16} />
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  // Get unique categories
  const categories = ['all', ...new Set(DATABASE_TABLES.map(t => t.category))]

  // Filter tables
  const filteredTables = DATABASE_TABLES.filter(table => {
    const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         table.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         table.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || table.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const groupedTables = categories.reduce((acc, category) => {
    if (category === 'all') return acc
    acc[category] = filteredTables.filter(t => t.category === category)
    return acc
  }, {})

  return (
    <div className="admin-tables-page">
      <div className="admin-tables-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              <Icon name="shield" size={16} />
              Admin
            </Link>
            <Icon name="chevron-right" size={16} />
            <span>Database Tables</span>
          </div>
          <h1>Database Tables</h1>
          <p>Browse and manage all database tables ({DATABASE_TABLES.length} tables)</p>
        </div>
      </div>

      <div className="admin-tables-content">
        <div className="tables-controls">
          <div className="search-section">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="category-filter">
            <label>Category:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCategory === 'all' ? (
          // Show grouped by category
          Object.entries(groupedTables).map(([category, tables]) => (
            tables.length > 0 && (
              <div key={category} className="table-category-section">
                <div className="category-header">
                  <h2>{category}</h2>
                  <span className="table-count">{tables.length} tables</span>
                </div>
                <div className="tables-grid">
                  {tables.map(table => (
                    <Link
                      key={table.name}
                      to={`/admin/table/${table.name}`}
                      className="table-card"
                    >
                      <div className="table-icon">
                        <Icon name={table.icon} size={24} />
                      </div>
                      <div className="table-content">
                        <h3>{table.displayName}</h3>
                        <p className="table-name">({table.name})</p>
                        <p className="table-description">{table.description}</p>
                      </div>
                      <div className="table-arrow">
                        <Icon name="chevron-right" size={16} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          ))
        ) : (
          // Show filtered results
          <div className="table-category-section">
            <div className="category-header">
              <h2>
                {selectedCategory === 'all' ? 'All Tables' : selectedCategory}
              </h2>
              <span className="table-count">{filteredTables.length} tables</span>
            </div>
            <div className="tables-grid">
              {filteredTables.map(table => (
                <Link
                  key={table.name}
                  to={`/admin/table/${table.name}`}
                  className="table-card"
                >
                  <div className="table-icon">
                    <Icon name={table.icon} size={24} />
                  </div>
                  <div className="table-content">
                    <h3>{table.displayName}</h3>
                    <p className="table-name">({table.name})</p>
                    <p className="table-description">{table.description}</p>
                  </div>
                  <div className="table-arrow">
                    <Icon name="chevron-right" size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {filteredTables.length === 0 && (
          <div className="no-results">
            <Icon name="search" size={48} />
            <h3>No tables found</h3>
            <p>Try adjusting your search or category filter</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTables