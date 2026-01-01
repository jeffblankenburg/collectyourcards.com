import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import Icon from '../Icon'
import { useToast } from '../../contexts/ToastContext'
import './SuggestSeriesModalScoped.css'

function SuggestSeriesModal({ isOpen, onClose, onSuccess, preselectedSet = null }) {
  const { success, error: showError } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [searchingSet, setSearchingSet] = useState(false)
  const [setSearchQuery, setSetSearchQuery] = useState('')
  const [setSearchResults, setSetSearchResults] = useState([])
  const [selectedSet, setSelectedSet] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [parsedCards, setParsedCards] = useState([])
  const [parseError, setParseError] = useState(null)
  const fileInputRef = useRef(null)

  // Parent series for parallels
  const [seriesSearchQuery, setSeriesSearchQuery] = useState('')
  const [seriesSearchResults, setSeriesSearchResults] = useState([])
  const [searchingSeries, setSearchingSeries] = useState(false)
  const [selectedParentSeries, setSelectedParentSeries] = useState(null)

  const [formData, setFormData] = useState({
    proposed_name: '',
    proposed_description: '',
    proposed_base_card_count: '',
    proposed_is_parallel: false,
    proposed_print_run: '',
    submission_notes: ''
  })

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        proposed_name: '',
        proposed_description: '',
        proposed_base_card_count: '',
        proposed_is_parallel: false,
        proposed_print_run: '',
        submission_notes: ''
      })
      setSetSearchQuery('')
      setSetSearchResults([])
      setSeriesSearchQuery('')
      setSeriesSearchResults([])
      setSelectedParentSeries(null)
      setUploadedFile(null)
      setParsedCards([])
      setParseError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // If preselected set provided, use it; otherwise clear selection
      if (preselectedSet) {
        setSelectedSet({
          set_id: preselectedSet.set_id,
          name: preselectedSet.name,
          year: preselectedSet.year
        })
      } else {
        setSelectedSet(null)
      }
    }
  }, [isOpen, preselectedSet])

  const searchSets = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSetSearchResults([])
      return
    }

    setSearchingSet(true)
    try {
      const response = await axios.get(`/api/sets-list/search?q=${encodeURIComponent(query)}&limit=10`)
      setSetSearchResults(response.data.sets || [])
    } catch (err) {
      console.error('Error searching sets:', err)
      setSetSearchResults([])
    } finally {
      setSearchingSet(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (setSearchQuery) {
        searchSets(setSearchQuery)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [setSearchQuery, searchSets])

  // Search series within selected set (for parallel parent)
  const searchSeries = useCallback(async (query) => {
    if (!selectedSet || !query || query.length < 2) {
      setSeriesSearchResults([])
      return
    }

    setSearchingSeries(true)
    try {
      const response = await axios.get(`/api/series-by-set/${selectedSet.set_id}`)
      const allSeries = response.data.series || []
      // Filter by query
      const filtered = allSeries.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
      setSeriesSearchResults(filtered)
    } catch (err) {
      console.error('Error searching series:', err)
      setSeriesSearchResults([])
    } finally {
      setSearchingSeries(false)
    }
  }, [selectedSet])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (seriesSearchQuery && formData.proposed_is_parallel) {
        searchSeries(seriesSearchQuery)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [seriesSearchQuery, searchSeries, formData.proposed_is_parallel])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear parent series if turning off parallel
    if (field === 'proposed_is_parallel' && !value) {
      setSelectedParentSeries(null)
      setSeriesSearchQuery('')
      setSeriesSearchResults([])
    }
  }

  const handleSelectSet = (set) => {
    setSelectedSet(set)
    setSetSearchQuery('')
    setSetSearchResults([])
    // Clear parent series when set changes
    setSelectedParentSeries(null)
    setSeriesSearchQuery('')
    setSeriesSearchResults([])
  }

  const handleSelectParentSeries = (series) => {
    setSelectedParentSeries(series)
    setSeriesSearchQuery('')
    setSeriesSearchResults([])
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setParseError(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (rawData.length < 2) {
        setParseError('Spreadsheet appears to be empty or has no data rows')
        setParsedCards([])
        return
      }

      // Skip header row, parse data rows
      const cards = rawData.slice(1).map((row, index) => {
        if (!row || row.length === 0 || !row[0]) return null

        const cardNumber = row[0] ? String(row[0]).trim() : ''
        const playerNames = row[1] ? String(row[1]).trim() : ''
        const teamNames = row[2] ? String(row[2]).trim() : ''
        const rcIndicator = row[3] ? String(row[3]).trim().toLowerCase() : ''
        const autoIndicator = row[4] ? String(row[4]).trim().toLowerCase() : ''
        const relicIndicator = row[5] ? String(row[5]).trim().toLowerCase() : ''
        const spIndicator = row[6] ? String(row[6]).trim().toLowerCase() : ''
        const color = row[7] ? String(row[7]).trim() : ''
        const printRun = row[8] ? parseInt(String(row[8]).trim()) || null : null
        const notes = row[9] ? String(row[9]).trim() : ''

        // Check for truthy indicators
        const isTruthy = (val) => val && (val === 'rc' || val === 'auto' || val === 'relic' || val === 'sp' ||
                                          val === 'yes' || val === 'true' || val === '1' || val === 'x')

        return {
          card_number: cardNumber,
          player_names: playerNames,
          team_names: teamNames,
          is_rookie: isTruthy(rcIndicator),
          is_autograph: isTruthy(autoIndicator),
          is_relic: isTruthy(relicIndicator),
          is_short_print: isTruthy(spIndicator),
          color: color || null,
          print_run: printRun,
          notes: notes || null
        }
      }).filter(card => card && card.card_number)

      if (cards.length === 0) {
        setParseError('No valid card data found in spreadsheet')
        setParsedCards([])
        return
      }

      setParsedCards(cards)

      // Auto-set the card count if not already set
      if (!formData.proposed_base_card_count) {
        handleChange('proposed_base_card_count', cards.length.toString())
      }
    } catch (err) {
      console.error('Error parsing spreadsheet:', err)
      setParseError('Failed to parse spreadsheet. Please check the format.')
      setParsedCards([])
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setParsedCards([])
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/crowdsource/template/series-checklist', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'series-checklist-template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading template:', err)
      showError('Failed to download template')
    }
  }

  const isValid = () => {
    if (!formData.proposed_name.trim() || !selectedSet) return false
    // If parallel, must have parent series selected
    if (formData.proposed_is_parallel && !selectedParentSeries) return false
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid()) {
      if (formData.proposed_is_parallel && !selectedParentSeries) {
        showError('Please select a parent series for this parallel.')
      } else {
        showError('Please select a set and enter a series name.')
      }
      return
    }

    setSubmitting(true)

    try {
      const submissionData = {
        set_id: selectedSet.set_id,
        name: formData.proposed_name.trim(),
        description: formData.proposed_description.trim() || null,
        base_card_count: formData.proposed_base_card_count ? parseInt(formData.proposed_base_card_count) : null,
        is_parallel: formData.proposed_is_parallel,
        parallel_of_series_id: formData.proposed_is_parallel && selectedParentSeries ? selectedParentSeries.series_id : null,
        print_run: formData.proposed_print_run ? parseInt(formData.proposed_print_run) : null,
        submission_notes: formData.submission_notes.trim() || null,
        cards: parsedCards.length > 0 ? parsedCards : null
      }

      await axios.post('/api/crowdsource/series', submissionData)

      const message = parsedCards.length > 0
        ? `Series submission with ${parsedCards.length} cards created! It will be reviewed by our team.`
        : 'Series submission created! It will be reviewed by our team.'
      success(message)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error submitting series:', err)
      if (err.response?.status === 429) {
        showError('Rate limit exceeded. Please try again later.')
      } else {
        showError(err.response?.data?.message || 'Failed to submit series. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="suggest-series-modal-overlay" onClick={onClose}>
      <div className="suggest-series-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-series-modal-header">
          <h2>
            <Icon name="layers" size={20} />
            Submit New Series
          </h2>
          <button className="suggest-series-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="suggest-series-modal-intro">
          <Icon name="info" size={16} />
          <p>Suggest a new series or parallel set. Select the parent set and provide series details.</p>
        </div>

        <form onSubmit={handleSubmit} className="suggest-series-form">
          {/* Set Selection */}
          <div className="suggest-series-form-row">
            <label>
              Parent Set <span className="suggest-series-required">*</span>
            </label>
            {selectedSet ? (
              <div className="suggest-series-selected-set">
                <span>{selectedSet.name}</span>
                {!preselectedSet && (
                  <button
                    type="button"
                    onClick={() => setSelectedSet(null)}
                    className="suggest-series-remove-set"
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="suggest-series-set-search">
                <input
                  type="text"
                  value={setSearchQuery}
                  onChange={e => setSetSearchQuery(e.target.value)}
                  placeholder="Search for a set (e.g. 2024 Topps Chrome)..."
                />
                {searchingSet && (
                  <div className="suggest-series-search-loading">
                    <Icon name="loader" size={14} className="suggest-series-spinner-icon" />
                  </div>
                )}
                {setSearchResults.length > 0 && (
                  <div className="suggest-series-search-results">
                    {setSearchResults.map(set => (
                      <button
                        key={set.set_id}
                        type="button"
                        className="suggest-series-search-result"
                        onClick={() => handleSelectSet(set)}
                      >
                        <span className="suggest-series-result-name">{set.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="suggest-series-form-row">
            <label>
              Series Name <span className="suggest-series-required">*</span>
            </label>
            <input
              type="text"
              value={formData.proposed_name}
              onChange={e => handleChange('proposed_name', e.target.value)}
              placeholder="e.g. Base Set, Rookie Autographs, Gold Refractor"
              required
            />
          </div>

          {/* Parallel Toggle */}
          <div className="suggest-series-checkbox-row">
            <label className="suggest-series-checkbox">
              <input
                type="checkbox"
                checked={formData.proposed_is_parallel}
                onChange={e => handleChange('proposed_is_parallel', e.target.checked)}
                disabled={!selectedSet}
              />
              <span className="suggest-series-checkbox-label">This is a parallel series</span>
            </label>
            {!selectedSet && formData.proposed_is_parallel === false && (
              <span className="suggest-series-checkbox-hint">Select a set first</span>
            )}
          </div>

          {formData.proposed_is_parallel && (
            <div className="suggest-series-form-row">
              <label>
                Parent Series <span className="suggest-series-required">*</span>
              </label>
              {selectedParentSeries ? (
                <div className="suggest-series-selected-set">
                  <span>{selectedParentSeries.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedParentSeries(null)}
                    className="suggest-series-remove-set"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <div className="suggest-series-set-search">
                  <input
                    type="text"
                    value={seriesSearchQuery}
                    onChange={e => setSeriesSearchQuery(e.target.value)}
                    placeholder="Search for the parent series..."
                  />
                  {searchingSeries && (
                    <div className="suggest-series-search-loading">
                      <Icon name="loader" size={14} className="suggest-series-spinner-icon" />
                    </div>
                  )}
                  {seriesSearchResults.length > 0 && (
                    <div className="suggest-series-search-results">
                      {seriesSearchResults.map(series => (
                        <button
                          key={series.series_id}
                          type="button"
                          className="suggest-series-search-result"
                          onClick={() => handleSelectParentSeries(series)}
                        >
                          <span className="suggest-series-result-name">{series.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="suggest-series-form-grid">
            <div className="suggest-series-form-row">
              <label>Base Card Count</label>
              <input
                type="number"
                value={formData.proposed_base_card_count}
                onChange={e => handleChange('proposed_base_card_count', e.target.value)}
                placeholder="e.g. 220"
                min="1"
              />
            </div>

            <div className="suggest-series-form-row">
              <label>Print Run</label>
              <input
                type="number"
                value={formData.proposed_print_run}
                onChange={e => handleChange('proposed_print_run', e.target.value)}
                placeholder="e.g. 99, 199, 500"
                min="1"
              />
            </div>
          </div>

          {/* Checklist Upload Section */}
          <div className="suggest-series-upload-section">
            <div className="suggest-series-upload-header">
              <label>
                <Icon name="file-spreadsheet" size={16} />
                Upload Checklist (Optional)
              </label>
              <button
                type="button"
                className="suggest-series-template-btn"
                onClick={handleDownloadTemplate}
              >
                <Icon name="download" size={14} />
                Download Template
              </button>
            </div>
            <p className="suggest-series-upload-hint">
              Upload an Excel file with your card data. Use our template for the correct format.
            </p>

            {!uploadedFile ? (
              <div className="suggest-series-upload-dropzone">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="suggest-series-file-input"
                  id="checklist-upload"
                />
                <label htmlFor="checklist-upload" className="suggest-series-upload-label">
                  <Icon name="upload" size={24} />
                  <span>Click to upload or drag and drop</span>
                  <span className="suggest-series-upload-formats">.xlsx or .xls files</span>
                </label>
              </div>
            ) : (
              <div className="suggest-series-file-info">
                <div className="suggest-series-file-details">
                  <Icon name="file-spreadsheet" size={20} />
                  <div>
                    <span className="suggest-series-file-name">{uploadedFile.name}</span>
                    {parsedCards.length > 0 && (
                      <span className="suggest-series-card-count">
                        {parsedCards.length} cards parsed
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="suggest-series-remove-file"
                  onClick={handleRemoveFile}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            )}

            {parseError && (
              <div className="suggest-series-parse-error">
                <Icon name="alert-circle" size={14} />
                {parseError}
              </div>
            )}

            {parsedCards.length > 0 && (
              <div className="suggest-series-preview">
                <div className="suggest-series-preview-header">
                  Preview (first 5 cards)
                </div>
                <div className="suggest-series-preview-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Player(s)</th>
                        <th>Team(s)</th>
                        <th>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedCards.slice(0, 5).map((card, idx) => (
                        <tr key={idx}>
                          <td>{card.card_number}</td>
                          <td>{card.player_names || '-'}</td>
                          <td>{card.team_names || '-'}</td>
                          <td className="suggest-series-flags">
                            {card.is_rookie && <span className="flag-rc">RC</span>}
                            {card.is_autograph && <span className="flag-auto">Auto</span>}
                            {card.is_relic && <span className="flag-relic">Relic</span>}
                            {card.is_short_print && <span className="flag-sp">SP</span>}
                            {card.color && <span className="flag-color">{card.color}</span>}
                            {card.print_run && <span className="flag-print-run">/{card.print_run}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedCards.length > 5 && (
                    <div className="suggest-series-preview-more">
                      ...and {parsedCards.length - 5} more cards
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="suggest-series-form-row">
            <label>Description</label>
            <textarea
              value={formData.proposed_description}
              onChange={e => handleChange('proposed_description', e.target.value)}
              placeholder="Optional description of the series"
              rows={2}
            />
          </div>

          <div className="suggest-series-form-row">
            <label>Additional Notes</label>
            <textarea
              value={formData.submission_notes}
              onChange={e => handleChange('submission_notes', e.target.value)}
              placeholder="Any additional information for reviewers"
              rows={2}
            />
          </div>

          <div className="suggest-series-form-actions">
            <button type="button" onClick={onClose} className="suggest-series-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              className="suggest-series-submit-btn"
              disabled={!isValid() || submitting}
            >
              {submitting ? (
                <>
                  <span className="suggest-series-spinner"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <Icon name="upload" size={16} />
                  Submit Series
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuggestSeriesModal
