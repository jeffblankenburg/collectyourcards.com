import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './SpreadsheetIngestion.css'

function SpreadsheetIngestion() {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  // File upload and parsing state
  const [selectedFile, setSelectedFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [sheets, setSheets] = useState([])
  const [selectedSheet, setSelectedSheet] = useState(0)
  
  // Discovery and preview state
  const [discoveredEntities, setDiscoveredEntities] = useState({
    sets: [],
    series: [],
    players: [],
    teams: [],
    organizations: [],
    manufacturers: []
  })
  const [previewMode, setPreviewMode] = useState('overview') // overview, entities, mapping
  
  // Mapping configuration
  const [columnMapping, setColumnMapping] = useState({})
  const [detectedFormat, setDetectedFormat] = useState(null)

  // Update page title
  useEffect(() => {
    document.title = 'Spreadsheet Ingestion - Collect Your Cards'
  }, [])

  // Known format patterns
  const FORMAT_PATTERNS = {
    TOPPS_STANDARD: {
      name: 'Topps Standard Format',
      identifiers: ['card number', 'player', 'team', 'subset'],
      sheets: ['Base', 'Parallels', 'Inserts', 'Autographs'],
      columns: {
        cardNumber: ['card number', 'card #', '#', 'number'],
        player: ['player', 'name', 'player name'],
        team: ['team', 'tm', 'team name'],
        subset: ['subset', 'series', 'set'],
        parallel: ['parallel', 'variation', 'variant'],
        printRun: ['print run', 'pr', 'numbered to', '#ed to']
      }
    },
    BOWMAN_FORMAT: {
      name: 'Bowman Format',
      identifiers: ['card', 'name', 'position', 'team'],
      sheets: ['Prospects', 'Chrome', 'Autographs'],
      columns: {
        cardNumber: ['card', 'card #', '#'],
        player: ['name', 'player', 'player name'],
        team: ['team', 'organization'],
        position: ['position', 'pos'],
        prospect: ['prospect', 'rookie', 'rc']
      }
    },
    CUSTOM_FORMAT: {
      name: 'Custom Format',
      identifiers: [],
      sheets: [],
      columns: {}
    }
  }

  // Check admin privileges
  if (!user || !['admin', 'superadmin', 'data_admin'].includes(user.role)) {
    return (
      <div className="ingestion-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Data administration privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      parseSpreadsheet(file)
    }
  }

  const parseSpreadsheet = async (file) => {
    try {
      setParsing(true)
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('spreadsheet', file)
      
      // Send to backend for parsing
      const response = await axios.post('/api/admin-data/parse-spreadsheet', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setParsedData(response.data)
      setSheets(response.data.sheets || [])
      
      // Detect format automatically
      const format = detectFormat(response.data)
      setDetectedFormat(format)
      
      // Discover new entities
      discoverEntities(response.data)
      
      showToast('Spreadsheet parsed successfully', 'success')
      
    } catch (error) {
      console.error('Error parsing spreadsheet:', error)
      showToast('Failed to parse spreadsheet', 'error')
    } finally {
      setParsing(false)
    }
  }

  const detectFormat = (data) => {
    if (!data.sheets || data.sheets.length === 0) return null
    
    const firstSheet = data.sheets[0]
    const headers = firstSheet.headers || []
    const lowerHeaders = headers.map(h => h.toLowerCase())
    
    // Check each format pattern
    for (const [key, pattern] of Object.entries(FORMAT_PATTERNS)) {
      if (key === 'CUSTOM_FORMAT') continue
      
      const matchCount = pattern.identifiers.filter(id => 
        lowerHeaders.some(h => h.includes(id.toLowerCase()))
      ).length
      
      if (matchCount >= 2) {
        return { type: key, pattern, confidence: matchCount / pattern.identifiers.length }
      }
    }
    
    return { type: 'CUSTOM_FORMAT', pattern: FORMAT_PATTERNS.CUSTOM_FORMAT, confidence: 0 }
  }

  const discoverEntities = (data) => {
    const discovered = {
      sets: new Set(),
      series: new Set(),
      players: new Set(),
      teams: new Set(),
      organizations: new Set(),
      manufacturers: new Set()
    }
    
    data.sheets?.forEach(sheet => {
      sheet.data?.forEach(row => {
        // Extract potential entity names based on column mapping
        Object.keys(row).forEach(column => {
          const value = row[column]
          if (typeof value === 'string' && value.trim()) {
            categorizeEntity(column.toLowerCase(), value.trim(), discovered)
          }
        })
      })
    })
    
    // Convert Sets to Arrays for state
    setDiscoveredEntities({
      sets: Array.from(discovered.sets),
      series: Array.from(discovered.series),
      players: Array.from(discovered.players),
      teams: Array.from(discovered.teams),
      organizations: Array.from(discovered.organizations),
      manufacturers: Array.from(discovered.manufacturers)
    })
  }

  const categorizeEntity = (column, value, discovered) => {
    // Simple categorization based on column names and patterns
    if (column.includes('player') || column.includes('name')) {
      if (value.includes(' ')) discovered.players.add(value)
    } else if (column.includes('team') || column.includes('tm')) {
      discovered.teams.add(value)
    } else if (column.includes('set') || column.includes('series')) {
      if (value.length > 3) discovered.series.add(value)
    } else if (column.includes('organization') || column.includes('league')) {
      discovered.organizations.add(value)
    } else if (column.includes('manufacturer') || column.includes('brand')) {
      discovered.manufacturers.add(value)
    }
  }

  const renderFileUpload = () => (
    <div className="upload-section">
      <div className="upload-area">
        <input
          type="file"
          id="spreadsheet-upload"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <label htmlFor="spreadsheet-upload" className="upload-label">
          <div className="upload-content">
            <Icon name="upload" size={48} />
            <h3>Upload Spreadsheet</h3>
            <p>Select an Excel (.xlsx, .xls) or CSV file to analyze</p>
            <div className="supported-formats">
              <span>Supported: Topps, Bowman, Panini, Custom formats</span>
            </div>
          </div>
        </label>
      </div>
      
      {parsing && (
        <div className="parsing-status">
          <div className="card-icon-spinner"></div>
          <span>Parsing spreadsheet...</span>
        </div>
      )}
    </div>
  )

  const renderFormatDetection = () => {
    if (!detectedFormat) return null
    
    return (
      <div className="format-detection">
        <h3>
          <Icon name="search" size={20} />
          Detected Format
        </h3>
        <div className="format-info">
          <div className="format-name">{detectedFormat.pattern.name}</div>
          <div className="confidence-meter">
            <span>Confidence: {Math.round(detectedFormat.confidence * 100)}%</span>
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ width: `${detectedFormat.confidence * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderEntityDiscovery = () => (
    <div className="entity-discovery">
      <h3>
        <Icon name="database" size={20} />
        Discovered Entities
      </h3>
      <div className="entity-categories">
        {Object.entries(discoveredEntities).map(([category, entities]) => (
          <div key={category} className="entity-category">
            <h4>{category.charAt(0).toUpperCase() + category.slice(1)} ({entities.length})</h4>
            <div className="entity-list">
              {entities.slice(0, 10).map((entity, index) => (
                <div key={index} className="entity-item">
                  <span className="entity-name">{entity}</span>
                  <span className="entity-status new">New</span>
                </div>
              ))}
              {entities.length > 10 && (
                <div className="entity-more">+{entities.length - 10} more</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderDataPreview = () => {
    if (!parsedData || !sheets.length) return null
    
    const currentSheet = sheets[selectedSheet]
    const previewData = currentSheet?.data?.slice(0, 10) || []
    
    return (
      <div className="data-preview">
        <div className="preview-header">
          <h3>
            <Icon name="table" size={20} />
            Data Preview
          </h3>
          {sheets.length > 1 && (
            <div className="sheet-selector">
              <label>Sheet:</label>
              <select 
                value={selectedSheet} 
                onChange={(e) => setSelectedSheet(Number(e.target.value))}
              >
                {sheets.map((sheet, index) => (
                  <option key={index} value={index}>
                    {sheet.name} ({sheet.data?.length || 0} rows)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="preview-table-container">
          <table className="preview-table">
            <thead>
              <tr>
                {currentSheet?.headers?.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {currentSheet?.headers?.map((header, colIndex) => (
                    <td key={colIndex}>
                      {typeof row[header] === 'object' 
                        ? JSON.stringify(row[header])
                        : String(row[header] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderPreviewModes = () => {
    if (!parsedData) return null
    
    return (
      <div className="preview-modes">
        <div className="mode-tabs">
          <button 
            className={`mode-tab ${previewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setPreviewMode('overview')}
          >
            <Icon name="eye" size={16} />
            Overview
          </button>
          <button 
            className={`mode-tab ${previewMode === 'entities' ? 'active' : ''}`}
            onClick={() => setPreviewMode('entities')}
          >
            <Icon name="database" size={16} />
            New Entities ({Object.values(discoveredEntities).reduce((sum, arr) => sum + arr.length, 0)})
          </button>
          <button 
            className={`mode-tab ${previewMode === 'mapping' ? 'active' : ''}`}
            onClick={() => setPreviewMode('mapping')}
          >
            <Icon name="map" size={16} />
            Column Mapping
          </button>
        </div>
        
        <div className="mode-content">
          {previewMode === 'overview' && (
            <div className="overview-content">
              {renderFormatDetection()}
              {renderDataPreview()}
            </div>
          )}
          {previewMode === 'entities' && renderEntityDiscovery()}
          {previewMode === 'mapping' && (
            <div className="mapping-content">
              <p>Column mapping interface would go here</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ingestion-page">
      <div className="ingestion-header">
        <h1>Spreadsheet Data Ingestion</h1>
        <p>Analyze and preview spreadsheet data before importing to database</p>
      </div>

      <div className="ingestion-content">
        {!selectedFile ? (
          renderFileUpload()
        ) : (
          <div className="analysis-results">
            <div className="file-info">
              <Icon name="file" size={20} />
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button 
                className="change-file-btn"
                onClick={() => {
                  setSelectedFile(null)
                  setParsedData(null)
                  setDiscoveredEntities({ sets: [], series: [], players: [], teams: [], organizations: [], manufacturers: [] })
                }}
              >
                <Icon name="refresh" size={16} />
                Change File
              </button>
            </div>
            
            {renderPreviewModes()}
            
            {parsedData && (
              <div className="action-section">
                <div className="ingestion-actions">
                  <button className="action-btn preview" disabled>
                    <Icon name="eye" size={16} />
                    Preview Only Mode
                  </button>
                  <button className="action-btn approve" disabled>
                    <Icon name="check" size={16} />
                    Ready for Import (Coming Soon)
                  </button>
                </div>
                <p className="action-note">
                  This tool is in preview mode. No data will be imported to the database.
                  Use this to analyze spreadsheet formats and discover new entities.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SpreadsheetIngestion