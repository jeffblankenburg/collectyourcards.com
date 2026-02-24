import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminBeckettFileDetailScoped.css'

/**
 * AdminBeckettFileDetail - Review a single Beckett checklist file
 *
 * Shows all sheets in the file with data preview.
 * When a sheet is selected, shows full data with database comparison.
 */
const AdminBeckettFileDetail = () => {
  const { filename } = useParams()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [fileInfo, setFileInfo] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [sheetData, setSheetData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(false)

  // Check admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-beckett-detail-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Admin privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  // Load file info on mount
  useEffect(() => {
    if (filename) {
      loadFileInfo()
    }
  }, [filename])

  const loadFileInfo = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/beckett/file/${encodeURIComponent(filename)}`)
      setFileInfo(response.data)

      // Auto-select first sheet (usually Base)
      if (response.data.sheets?.length > 0) {
        const baseSheet = response.data.sheets.find(s => s.isBase) || response.data.sheets[0]
        loadSheetData(baseSheet.index)
      }
    } catch (error) {
      console.error('Error loading file:', error)
      addToast('Failed to load Beckett file', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadSheetData = async (sheetIndex) => {
    try {
      setLoadingSheet(true)
      setSelectedSheet(sheetIndex)
      const response = await axios.get(
        `/api/admin/beckett/file/${encodeURIComponent(filename)}/sheet/${sheetIndex}`
      )
      setSheetData(response.data)
    } catch (error) {
      console.error('Error loading sheet:', error)
      addToast('Failed to load sheet data', 'error')
    } finally {
      setLoadingSheet(false)
    }
  }

  // Filter rows based on search and unmatched filter
  const getFilteredRows = () => {
    if (!sheetData?.rows) return []

    return sheetData.rows.filter(row => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          String(row.cardNumber || '').toLowerCase().includes(query) ||
          String(row.playerName || '').toLowerCase().includes(query) ||
          String(row.teamName || '').toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Unmatched filter
      if (showOnlyUnmatched) {
        const playerMatches = sheetData.playerMatches?.[row.playerName]
        const teamMatches = sheetData.teamMatches?.[row.teamName]
        const hasPlayerMatch = playerMatches?.exactMatches?.length > 0
        const hasTeamMatch = teamMatches?.exactMatches?.length > 0
        if (hasPlayerMatch && hasTeamMatch) return false
      }

      return true
    })
  }

  // Calculate stats
  const getStats = () => {
    if (!sheetData) return { total: 0, playersMatched: 0, teamsMatched: 0 }

    const uniquePlayers = new Set()
    const uniqueTeams = new Set()
    let playersMatched = 0
    let teamsMatched = 0

    sheetData.rows?.forEach(row => {
      if (row.playerName) {
        uniquePlayers.add(row.playerName)
        const matches = sheetData.playerMatches?.[row.playerName]
        if (matches?.exactMatches?.length > 0) playersMatched++
      }
      if (row.teamName) {
        uniqueTeams.add(row.teamName)
        const matches = sheetData.teamMatches?.[row.teamName]
        if (matches?.exactMatches?.length > 0) teamsMatched++
      }
    })

    return {
      total: sheetData.rows?.length || 0,
      uniquePlayers: uniquePlayers.size,
      uniqueTeams: uniqueTeams.size,
      playersMatched: Object.values(sheetData.playerMatches || {}).filter(m => m.exactMatches?.length > 0).length,
      teamsMatched: Object.values(sheetData.teamMatches || {}).filter(m => m.exactMatches?.length > 0).length
    }
  }

  const stats = getStats()
  const filteredRows = getFilteredRows()

  if (loading) {
    return (
      <div className="admin-beckett-detail-page">
        <div className="loading-state">
          <Icon name="loader" size={32} className="spinner" />
          <p>Loading Beckett file...</p>
        </div>
      </div>
    )
  }

  if (!fileInfo) {
    return (
      <div className="admin-beckett-detail-page">
        <div className="error-state">
          <Icon name="alert-circle" size={48} />
          <h2>File Not Found</h2>
          <Link to="/admin/beckett" className="back-btn">
            Back to Browser
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-beckett-detail-page">
      {/* Header */}
      <div className="detail-header">
        <Link to="/admin/beckett" className="back-link">
          <Icon name="arrow-left" size={16} />
          Back to Browser
        </Link>

        <div className="file-title">
          <h1>{fileInfo.setName || fileInfo.filename}</h1>
          <div className="file-meta">
            <span className="meta-item">
              <Icon name="calendar" size={14} />
              {fileInfo.year || 'Unknown Year'}
            </span>
            <span className="meta-item">
              <Icon name="layers" size={14} />
              {fileInfo.sheetCount} sheets
            </span>
            <span className="meta-item">
              <Icon name="file" size={14} />
              {fileInfo.sizeFormatted}
            </span>
            <span className="meta-item">
              <Icon name="hash" size={14} />
              {fileInfo.totalRows} total rows
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="detail-content">
        {/* Left: Sheet list */}
        <div className="sheets-panel">
          <h2>Sheets</h2>
          <div className="sheet-list">
            {fileInfo.sheets?.map((sheet) => (
              <button
                key={sheet.index}
                className={`sheet-item ${selectedSheet === sheet.index ? 'active' : ''} ${sheet.isBase ? 'is-base' : ''}`}
                onClick={() => loadSheetData(sheet.index)}
              >
                <div className="sheet-name">
                  {sheet.name}
                  {sheet.isBase && <span className="base-badge">Base</span>}
                </div>
                <div className="sheet-count">{sheet.rowCount} rows</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Data review */}
        <div className="data-panel">
          {loadingSheet ? (
            <div className="loading-state">
              <Icon name="loader" size={24} className="spinner" />
              <p>Loading sheet data...</p>
            </div>
          ) : sheetData ? (
            <>
              {/* Stats Bar */}
              <div className="data-stats-bar">
                <div className="stat-group">
                  <span className="stat-label">Rows:</span>
                  <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-group">
                  <span className="stat-label">Unique Players:</span>
                  <span className="stat-value">{stats.uniquePlayers}</span>
                  <span className={`stat-match ${stats.playersMatched === stats.uniquePlayers ? 'all' : 'partial'}`}>
                    ({stats.playersMatched} matched)
                  </span>
                </div>
                <div className="stat-group">
                  <span className="stat-label">Unique Teams:</span>
                  <span className="stat-value">{stats.uniqueTeams}</span>
                  <span className={`stat-match ${stats.teamsMatched === stats.uniqueTeams ? 'all' : 'partial'}`}>
                    ({stats.teamsMatched} matched)
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="data-filters">
                <div className="search-container">
                  <Icon name="search" size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search cards, players, teams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={showOnlyUnmatched}
                    onChange={(e) => setShowOnlyUnmatched(e.target.checked)}
                  />
                  Show only unmatched
                </label>
              </div>

              {/* Data Table */}
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-card-num">#</th>
                      <th className="col-beckett-player">Beckett Player</th>
                      <th className="col-db-player">Database Match</th>
                      <th className="col-beckett-team">Beckett Team</th>
                      <th className="col-db-team">Database Match</th>
                      <th className="col-notes">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const playerMatches = sheetData.playerMatches?.[row.playerName]
                      const teamMatches = sheetData.teamMatches?.[row.teamName]
                      const hasPlayerMatch = playerMatches?.exactMatches?.length > 0
                      const hasTeamMatch = teamMatches?.exactMatches?.length > 0

                      return (
                        <tr key={row.rowIndex} className="data-row">
                          <td className="col-card-num">{row.cardNumber}</td>
                          <td className="col-beckett-player">
                            <span className={`beckett-value ${hasPlayerMatch ? 'matched' : 'unmatched'}`}>
                              {row.playerName || '—'}
                            </span>
                          </td>
                          <td className="col-db-player">
                            {hasPlayerMatch ? (
                              <div className="match-list">
                                {playerMatches.exactMatches.slice(0, 3).map((match, idx) => (
                                  <div key={idx} className="match-item exact">
                                    <Icon name="check" size={12} />
                                    <span className="match-name">{match.fullName}</span>
                                    {match.teams?.length > 0 && (
                                      <span className="match-teams">
                                        ({match.teams.map(t => t.abbreviation || t.teamName).join(', ')})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : row.playerName ? (
                              <span className="no-match">No match found</span>
                            ) : (
                              <span className="empty">—</span>
                            )}
                          </td>
                          <td className="col-beckett-team">
                            <span className={`beckett-value ${hasTeamMatch ? 'matched' : 'unmatched'}`}>
                              {row.teamName || '—'}
                            </span>
                          </td>
                          <td className="col-db-team">
                            {hasTeamMatch ? (
                              <div className="match-list">
                                {teamMatches.exactMatches.slice(0, 3).map((match, idx) => (
                                  <div key={idx} className="match-item exact">
                                    <Icon name="check" size={12} />
                                    <span className="match-name">{match.name}</span>
                                    {match.abbreviation && (
                                      <span className="match-abbr">({match.abbreviation})</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : row.teamName ? (
                              <span className="no-match">No match found</span>
                            ) : (
                              <span className="empty">—</span>
                            )}
                          </td>
                          <td className="col-notes">
                            {row.notes || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="data-footer">
                Showing {filteredRows.length} of {sheetData.rows?.length} rows
                {(searchQuery || showOnlyUnmatched) && ' (filtered)'}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Icon name="file-text" size={48} />
              <p>Select a sheet to view data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminBeckettFileDetail
