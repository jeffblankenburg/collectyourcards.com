import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import ImportTable from '../components/tables/ImportTable'
import './AdminImportScoped.css'

const SearchableSeriesDropdown = ({ series, onSelect, placeholder, selectedSeries, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Debounced API search
  useEffect(() => {
    if (searchTerm.trim() && onSearch) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(searchTerm.trim())
      }, 300)
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm, onSearch])

  const filteredSeries = (series || []).filter(seriesItem =>
    (seriesItem.name && seriesItem.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (seriesItem.set_name && seriesItem.set_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (seriesItem.year && seriesItem.year.toString().includes(searchTerm))
  )
  
  const handleKeyDown = (e) => {
    if (!isOpen && e.key === 'Enter') {
      setIsOpen(true)
      return
    }
    
    if (!isOpen) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < (filteredSeries || []).length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredSeries[selectedIndex]) {
          onSelect(filteredSeries[selectedIndex])
          setIsOpen(false)
          setSearchTerm('')
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }
  
  const handleSelect = (seriesItem) => {
    onSelect(seriesItem)
    setIsOpen(false)
    setSearchTerm('')
    setSelectedIndex(-1)
  }

  const handleClear = () => {
    onSelect(null)
    setSearchTerm('')
    setIsOpen(false)
    setSelectedIndex(-1)
  }
  
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <div className="searchable-dropdown" ref={dropdownRef}>
      <div className="dropdown-input-wrapper">
        <input
          ref={searchInputRef}
          type="text"
          className="dropdown-search-input"
          value={selectedSeries && !isOpen ? `${selectedSeries.name} (${selectedSeries.set_name})` : searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            setIsOpen(true)
            if (selectedSeries && !searchTerm) {
              setSearchTerm('')
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedSeries ? `${selectedSeries.name} (${selectedSeries.set_name})` : placeholder}
        />
        {selectedSeries && !isOpen && (
          <Icon 
            name="x" 
            size={16} 
            className="dropdown-clear-icon"
            onClick={handleClear}
            title="Clear selection"
          />
        )}
        <Icon 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={20} 
          className="dropdown-icon"
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      
      {isOpen && (
        <div className="dropdown-menu">
          {filteredSeries.length === 0 ? (
            <div className="dropdown-no-results">
              No series found matching "{searchTerm}"
            </div>
          ) : (
            <div className="dropdown-results">
              {filteredSeries.map((seriesItem, index) => (
                <div
                  key={seriesItem.series_id}
                  className={`dropdown-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(seriesItem)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="dropdown-item-primary">{seriesItem.name || 'Unknown Series'}</div>
                  <div className="dropdown-item-secondary">
                    {seriesItem.set_name || 'Unknown Set'} {seriesItem.year ? `(${seriesItem.year})` : ''} • {seriesItem.card_count || 0} cards
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AdminImport = () => {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1)
  
  // Step 1: Series selection
  const [series, setSeries] = useState([])
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [loadingSeries, setLoadingSeries] = useState(true)
  const [organizationId, setOrganizationId] = useState(null)
  
  // Step 2: File upload or paste
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pastedData, setPastedData] = useState('')
  const [inputMethod, setInputMethod] = useState('paste') // 'file' or 'paste' - default to paste
  
  // Step 3: Review parsed data
  const [parsedCards, setParsedCards] = useState([])
  const [matchedCards, setMatchedCards] = useState([])
  const [processing, setProcessing] = useState(false)
  const [reviewSearchQuery, setReviewSearchQuery] = useState('')
  
  // Progress tracking
  const [matchingProgress, setMatchingProgress] = useState({
    total: 0,
    processed: 0,
    status: null,
    currentCard: null
  })
  
  // Step 4: Final import
  const [importing, setImporting] = useState(false)
  const [generatedSql, setGeneratedSql] = useState('')
  const [generatingSql, setGeneratingSql] = useState(false)

  // Check admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-import-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Admin privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  // Load series for selection
  useEffect(() => {
    loadSeries()
  }, [])

  // Auto-select series from URL parameter and advance to Step 2
  useEffect(() => {
    const seriesIdParam = searchParams.get('series')
    if (seriesIdParam && !selectedSeries) {
      const seriesId = parseInt(seriesIdParam)

      // First check if series is already in the list
      const foundSeries = series.find(s => s.series_id === seriesId)
      if (foundSeries) {
        setSelectedSeries(foundSeries)
        setCurrentStep(2)
        console.log('Auto-selected series from URL and advanced to Step 2:', foundSeries.name)
      } else if (series.length > 0) {
        // Series not in list, load it specifically by ID
        loadSeries('', seriesId)
      }
    }
  }, [searchParams, series, selectedSeries])

  // Auto-generate SQL when we reach step 4
  useEffect(() => {
    if (currentStep === 4 && !generatedSql && !generatingSql && matchedCards.length > 0) {
      handleSqlPreview()
    }
  }, [currentStep, generatedSql, generatingSql, matchedCards.length])

  const loadSeries = async (searchQuery = '', seriesId = null) => {
    try {
      let url = '/api/admin/series'
      const params = new URLSearchParams()

      if (seriesId) {
        params.append('series_id', seriesId)
      } else if (searchQuery) {
        params.append('search', searchQuery)
      }

      if (params.toString()) {
        url += '?' + params.toString()
      }

      const response = await axios.get(url)
      setSeries(response.data.series || [])
    } catch (error) {
      console.error('Error loading series:', error)
      addToast('Failed to load series', 'error')
    } finally {
      setLoadingSeries(false)
    }
  }

  const handleSeriesSelect = (seriesItem) => {
    setSelectedSeries(seriesItem)
    // Extract organization ID from series - we'll get it from the backend during matching
    setCurrentStep(2)
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        addToast('Please select an XLSX file', 'error')
        return
      }
      setSelectedFile(file)
    }
  }

  const handlePastedDataProcess = async () => {
    if (!pastedData.trim() || !selectedSeries) return

    try {
      setUploading(true)

      console.log('📋 Processing pasted data...')
      console.log('Series:', selectedSeries.name, 'ID:', selectedSeries.series_id)

      const response = await axios.post('/api/admin/import/parse-pasted', {
        data: pastedData,
        seriesId: selectedSeries.series_id
      })

      console.log('📥 API Response:', response.data)
      console.log('Cards found:', response.data.cards?.length || 0)

      setParsedCards(response.data.cards)
      setCurrentStep(3)

      // Start matching process
      if (response.data.cards && response.data.cards.length > 0) {
        console.log('🔍 Starting card matching...')
        await matchCards(response.data.cards)
      } else {
        console.log('⚠️ No cards to match')
      }

    } catch (error) {
      console.error('❌ Error processing pasted data:', error)
      console.error('Error response:', error.response?.data)
      addToast(error.response?.data?.message || 'Failed to process pasted data', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedSeries) return

    try {
      setUploading(true)

      console.log('📤 Starting file upload...')
      console.log('File:', selectedFile.name, selectedFile.size, 'bytes')
      console.log('Series:', selectedSeries.name, 'ID:', selectedSeries.series_id)

      const formData = new FormData()
      formData.append('xlsx', selectedFile)
      formData.append('seriesId', selectedSeries.series_id)

      console.log('📡 Sending API request...')
      const response = await axios.post('/api/admin/import/parse-xlsx', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      console.log('📥 API Response:', response.data)
      console.log('Cards found:', response.data.cards?.length || 0)

      setParsedCards(response.data.cards)
      setCurrentStep(3)

      // Start matching process
      if (response.data.cards && response.data.cards.length > 0) {
        console.log('🔍 Starting card matching...')
        await matchCards(response.data.cards)
      } else {
        console.log('⚠️ No cards to match')
      }

    } catch (error) {
      console.error('❌ Error uploading file:', error)
      console.error('Error response:', error.response?.data)
      addToast(error.response?.data?.message || 'Failed to upload file', 'error')
    } finally {
      setUploading(false)
    }
  }

  const matchCards = async (cards) => {
    try {
      setProcessing(true)
      
      console.log('🚀 Starting card matching process...')
      const response = await axios.post('/api/admin/import/match-cards', {
        cards,
        seriesId: selectedSeries.series_id
      })
      
      // If we get a jobId, start polling for progress
      if (response.data.jobId) {
        console.log(`📊 Starting progress tracking for job: ${response.data.jobId}`)
        await pollMatchingProgress(response.data.jobId)
      }
      
      // Store organization ID for team creation
      if (response.data.organizationId) {
        setOrganizationId(response.data.organizationId)
        console.log(`🏢 Organization ID: ${response.data.organizationId} (${response.data.organizationName})`)
      }
      
      setMatchedCards(response.data.matchedCards)
      
    } catch (error) {
      console.error('Error matching cards:', error)
      addToast('Failed to match cards with database', 'error')
    } finally {
      setProcessing(false)
    }
  }
  
  const pollMatchingProgress = async (jobId) => {
    let attempts = 0
    const maxAttempts = 120 // 2 minutes max (120 * 1000ms = 2 minutes)
    
    const checkProgress = async () => {
      try {
        const response = await axios.get(`/api/admin/import/match-progress/${jobId}`)
        const progress = response.data
        
        console.log(`📊 Progress: ${progress.processed}/${progress.total} - ${progress.status}`)
        
        // Update UI state
        setMatchingProgress({
          total: progress.total,
          processed: progress.processed,
          status: progress.status,
          currentCard: progress.currentCard
        })
        
        if (progress.currentCard) {
          console.log(`   Current: ${progress.currentCard}`)
        }
        
        if (progress.status === 'completed' || progress.status === 'error') {
          console.log('✅ Matching completed')
          return
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 1000) // Check every second
        }
      } catch (error) {
        console.error('Error checking progress:', error)
      }
    }
    
    checkProgress()
  }

  const handleCardUpdate = (updatedCards) => {
    setMatchedCards(updatedCards)
  }

  const handleSqlPreview = async () => {
    try {
      setGeneratingSql(true)
      
      const response = await axios.post('/api/admin/import/preview-sql', {
        matchedCards,
        seriesId: selectedSeries.series_id
      })
      
      setGeneratedSql(response.data.sql)
      
    } catch (error) {
      console.error('Error generating SQL preview:', error)
      addToast(error.response?.data?.message || 'Failed to generate SQL preview', 'error')
    } finally {
      setGeneratingSql(false)
    }
  }

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedSql)
      if (addToast) {
        addToast('SQL copied to clipboard!', 'success')
      }
    } catch (error) {
      console.error('Failed to copy SQL:', error)
      if (addToast) {
        addToast('Failed to copy SQL to clipboard', 'error')
      }
    }
  }

  const handleFinalImport = async () => {
    try {
      setImporting(true)
      
      const response = await axios.post('/api/admin/import/create-cards', {
        matchedCards,
        seriesId: selectedSeries.series_id
      })
      
      addToast(`Successfully imported ${response.data.created} cards!`, 'success')
      
      // Navigate to admin cards page to show the imported cards
      setTimeout(() => {
        navigate(`/admin/cards?series=${selectedSeries.series_id}`)
      }, 1500) // Small delay to let the success toast be visible
      
      // Reset to start
      setCurrentStep(1)
      setSelectedSeries(null)
      setSelectedFile(null)
      setParsedCards([])
      setMatchedCards([])
      
    } catch (error) {
      console.error('Error importing cards:', error)
      addToast(error.response?.data?.message || 'Failed to import cards', 'error')
    } finally {
      setImporting(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="step-indicator">
      <div className={`step ${currentStep >= 1 ? 'completed' : ''}`}>
        <div className="step-number">1</div>
        <div className="step-label">Select Series</div>
      </div>
      <div className={`step ${currentStep >= 2 ? 'completed' : ''}`}>
        <div className="step-number">2</div>
        <div className="step-label">Upload File</div>
      </div>
      <div className={`step ${currentStep >= 3 ? 'completed' : ''}`}>
        <div className="step-number">3</div>
        <div className="step-label">Review & Match</div>
      </div>
      <div className={`step ${currentStep >= 4 ? 'completed' : ''}`}>
        <div className="step-number">4</div>
        <div className="step-label">Import</div>
      </div>
    </div>
  )

  const renderSeriesSelection = () => (
    <div className="step-content">
      <h2>Step 1: Select Series</h2>
      <p>Choose the series that this card checklist belongs to:</p>
      
      {loadingSeries ? (
        <div className="loading-state">
          <Icon name="loader" size={24} className="spinner" />
          <span>Loading series...</span>
        </div>
      ) : (
        <SearchableSeriesDropdown
          series={series}
          onSelect={handleSeriesSelect}
          placeholder="Search for a series..."
          selectedSeries={selectedSeries}
          onSearch={(query) => loadSeries(query)}
        />
      )}
    </div>
  )

  const renderFileUpload = () => (
    <div className="step-content">
      <h2>Step 2: Import Card Data</h2>
      <p>Selected Series: <strong>{selectedSeries?.name}</strong> ({selectedSeries?.set_name} {selectedSeries?.year})</p>

      {/* Input Method Toggle */}
      <div className="input-method-toggle">
        <button
          className={`method-btn ${inputMethod === 'file' ? 'active' : ''}`}
          onClick={() => setInputMethod('file')}
        >
          <Icon name="upload" size={16} />
          Upload File
        </button>
        <button
          className={`method-btn ${inputMethod === 'paste' ? 'active' : ''}`}
          onClick={() => setInputMethod('paste')}
        >
          <Icon name="clipboard" size={16} />
          Paste Data
        </button>
      </div>

      <div className="upload-section">
        <div className="file-requirements">
          <h3>Data Requirements:</h3>
          <ul>
            {inputMethod === 'file' ? (
              <>
                <li>XLSX format only</li>
                <li>5 columns: Card Number, Player Name(s), Team Name(s), RC Indicator, Notes</li>
                <li>First row should contain headers</li>
              </>
            ) : (
              <>
                <li>Tab-separated data (from Excel, Google Sheets, etc.)</li>
                <li>5 columns: Card Number, Player Name(s), Team Name(s), RC Indicator, Notes</li>
                <li>First row should contain headers (will be ignored)</li>
              </>
            )}
          </ul>
        </div>

        {inputMethod === 'file' ? (
          <div className="file-input-section">
            <input
              type="file"
              id="xlsx-upload"
              accept=".xlsx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <label htmlFor="xlsx-upload" className="file-upload-label">
              <Icon name="upload" size={24} />
              {selectedFile ? selectedFile.name : 'Choose XLSX File'}
            </label>

            {selectedFile && (
              <div className="file-actions">
                <button
                  className="upload-btn"
                  onClick={handleFileUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Icon name="loader" size={16} className="spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      Process File
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="paste-input-section">
            <textarea
              className="paste-textarea"
              placeholder="Paste your card checklist data here (tab-separated)&#10;&#10;Example:&#10;BR-1    Shohei Ohtani    Los Angeles Dodgers&#10;BR-2    Ronald Acuña Jr.    Atlanta Braves&#10;BR-3    Juan Soto    New York Mets"
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              rows={15}
            />

            {pastedData.trim() && (
              <div className="file-actions">
                <button
                  className="upload-btn"
                  onClick={handlePastedDataProcess}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Icon name="loader" size={16} className="spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      Process Data ({pastedData.trim().split('\n').length} rows)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="back-btn" onClick={() => setCurrentStep(1)}>
          <Icon name="arrow-left" size={16} />
          Back to Series Selection
        </button>
      </div>
    </div>
  )

  const renderReviewCards = () => (
    <div className="step-content">
      <h2>Step 3: Review Parsed Cards</h2>
      <p>Review the imported cards and verify player/team matches:</p>
      
      {processing ? (
        <div className="processing-state">
          <Icon name="loader" size={24} className="spinner" />
          <div className="progress-info">
            <h3>Matching cards with database...</h3>
            {matchingProgress.total > 0 && (
              <>
                <div className="progress-bar-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${(matchingProgress.processed / matchingProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <div className="progress-text">
                    {matchingProgress.processed} / {matchingProgress.total} cards processed
                    {matchingProgress.total > 0 && (
                      <span className="progress-percentage">
                        ({Math.round((matchingProgress.processed / matchingProgress.total) * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
                {matchingProgress.currentCard && (
                  <div className="current-card-info">
                    Currently processing: {matchingProgress.currentCard}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <ImportTable
          cards={matchedCards || []}
          loading={false}
          onCardUpdate={handleCardUpdate}
          showSearch={true}
          searchQuery={reviewSearchQuery}
          onSearchChange={setReviewSearchQuery}
          maxHeight="500px"
          organizationId={organizationId}
        />
      )}
      
      <div className="step-actions">
        <button className="back-btn" onClick={() => setCurrentStep(2)}>
          <Icon name="arrow-left" size={16} />
          Back to Upload
        </button>
        {!processing && (matchedCards || []).length > 0 && (
          <button className="continue-btn" onClick={() => setCurrentStep(4)}>
            Continue to Import
            <Icon name="arrow-right" size={16} />
          </button>
        )}
      </div>
    </div>
  )

  const renderFinalImport = () => (
    <div className="step-content full-screen-sql">
      <h2>Step 4: SQL Preview - Ready to Import</h2>
      <div className="sql-preview-info">
        <p><strong>⚠️ COPY AND PASTE THIS SQL:</strong> This is the exact SQL to import your cards. Copy and paste this into your SQL query tool to execute manually.</p>
        <div className="sql-stats">
          <span>Series: {selectedSeries?.name}</span>
          <span>{(matchedCards || []).length} cards</span>
          <span>Generated: {new Date().toLocaleString()}</span>
        </div>
      </div>
      
      {generatingSql ? (
        <div className="sql-loading">
          <Icon name="loader" size={32} className="spinner" />
          <p>Generating SQL statements...</p>
        </div>
      ) : (
        <div className="sql-display-container">
          <div className="sql-display-header">
            <h3>
              <Icon name="code" size={20} />
              Import SQL
            </h3>
            <button className="copy-sql-btn" onClick={copySqlToClipboard}>
              <Icon name="copy" size={16} />
              Copy SQL to Clipboard
            </button>
          </div>
          <div className="sql-display-content">
            <textarea 
              className="sql-display-text"
              value={generatedSql}
              readOnly
              spellCheck={false}
            />
          </div>
        </div>
      )}
      
      <div className="step-actions">
        <button className="back-btn" onClick={() => setCurrentStep(3)}>
          <Icon name="arrow-left" size={16} />
          Back to Review
        </button>
        
        <button 
          className="import-btn"
          onClick={handleFinalImport}
          disabled={importing}
        >
          {importing ? (
            <>
              <Icon name="loader" size={16} className="spinner" />
              Importing...
            </>
          ) : (
            <>
              <Icon name="database" size={16} />
              Import to Database
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div className="admin-import-page">
      <div className="import-header">
        <h1>Import Card Checklist</h1>
        <p>Import cards from XLSX spreadsheets with automatic player/team matching</p>
      </div>

      {renderStepIndicator()}

      <div className="import-content">
        {currentStep === 1 && renderSeriesSelection()}
        {currentStep === 2 && renderFileUpload()}
        {currentStep === 3 && renderReviewCards()}
        {currentStep === 4 && renderFinalImport()}
      </div>
    </div>
  )
}

export default AdminImport