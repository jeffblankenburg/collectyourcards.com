import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminBeckettBrowserScoped.css'

/**
 * AdminBeckettBrowser - Browse and review Beckett checklist files
 *
 * This is a human-in-the-loop review tool for Beckett data.
 * No automated imports - just visual comparison with database.
 */
const AdminBeckettBrowser = () => {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [sortField, setSortField] = useState('year')
  const [sortDirection, setSortDirection] = useState('desc')

  // Check admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-beckett-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Admin privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  // Load files on mount
  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/beckett/files')
      setFiles(response.data.files || [])
    } catch (error) {
      console.error('Error loading Beckett files:', error)
      addToast('Failed to load Beckett files', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort files
  const filteredFiles = files
    .filter(file => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!file.filename.toLowerCase().includes(query) &&
            !file.setName?.toLowerCase().includes(query)) {
          return false
        }
      }
      // Year filter
      if (yearFilter && file.year !== parseInt(yearFilter)) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'year') {
        aVal = aVal || 0
        bVal = bVal || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (sortField === 'size') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      // String comparison
      aVal = String(aVal || '').toLowerCase()
      bVal = String(bVal || '').toLowerCase()
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  // Get unique years for filter dropdown
  const uniqueYears = [...new Set(files.map(f => f.year).filter(Boolean))].sort((a, b) => b - a)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleFileClick = (filename) => {
    navigate(`/admin/beckett/${encodeURIComponent(filename)}`)
  }

  // Stats
  const totalFiles = files.length
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  const yearsRepresented = uniqueYears.length

  return (
    <div className="admin-beckett-page">
      <div className="admin-beckett-header">
        <div className="header-title-section">
          <Link to="/admin" className="back-link">
            <Icon name="arrow-left" size={16} />
            Admin
          </Link>
          <h1>Beckett Checklist Browser</h1>
          <p className="header-subtitle">
            Review downloaded Beckett checklists and compare with database
          </p>
        </div>

        {/* Stats */}
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-value">{totalFiles}</span>
            <span className="stat-label">Files</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatFileSize(totalSize)}</span>
            <span className="stat-label">Total Size</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{yearsRepresented}</span>
            <span className="stat-label">Years</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-beckett-filters">
        <div className="search-container">
          <Icon name="search" size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="year-filter"
        >
          <option value="">All Years</option>
          {uniqueYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <button className="refresh-btn" onClick={loadFiles} disabled={loading}>
          <Icon name="refresh-cw" size={16} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* File List */}
      <div className="admin-beckett-content">
        {loading ? (
          <div className="loading-state">
            <Icon name="loader" size={32} className="spinner" />
            <p>Loading Beckett files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <Icon name="file-text" size={48} />
            <h3>No Files Found</h3>
            <p>
              {searchQuery || yearFilter
                ? 'Try adjusting your filters'
                : 'Run the Beckett downloader script to fetch checklists'}
            </p>
          </div>
        ) : (
          <div className="file-table-wrapper">
            <table className="file-table">
              <thead>
                <tr>
                  <th
                    className={`sortable ${sortField === 'year' ? 'sorted' : ''}`}
                    onClick={() => handleSort('year')}
                  >
                    Year
                    {sortField === 'year' && (
                      <Icon name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                    )}
                  </th>
                  <th
                    className={`sortable ${sortField === 'setName' ? 'sorted' : ''}`}
                    onClick={() => handleSort('setName')}
                  >
                    Set Name
                    {sortField === 'setName' && (
                      <Icon name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                    )}
                  </th>
                  <th
                    className={`sortable ${sortField === 'size' ? 'sorted' : ''}`}
                    onClick={() => handleSort('size')}
                  >
                    Size
                    {sortField === 'size' && (
                      <Icon name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                    )}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, index) => (
                  <tr
                    key={file.filename}
                    className="file-row"
                    onClick={() => handleFileClick(file.filename)}
                  >
                    <td className="year-cell">
                      {file.year ? (
                        <span className="year-badge">{file.year}</span>
                      ) : (
                        <span className="year-unknown">—</span>
                      )}
                    </td>
                    <td className="name-cell">
                      <div className="file-info">
                        <span className="set-name">{file.setName || file.filename}</span>
                        <span className="filename">{file.filename}</span>
                      </div>
                    </td>
                    <td className="size-cell">{file.sizeFormatted}</td>
                    <td className="actions-cell">
                      <button
                        className="review-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFileClick(file.filename)
                        }}
                      >
                        <Icon name="eye" size={14} />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="admin-beckett-footer">
        <span>
          Showing {filteredFiles.length} of {totalFiles} files
          {(searchQuery || yearFilter) && ' (filtered)'}
        </span>
      </div>
    </div>
  )
}

// Helper to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default AdminBeckettBrowser
