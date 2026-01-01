import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import Icon from '../Icon'
import { useToast } from '../../contexts/ToastContext'
import './SuggestCardsModalScoped.css'

function SuggestCardsModal({ isOpen, onClose, onSuccess, preselectedSeriesId = null }) {
  const { success, error: showError } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState('single') // 'single' or 'bulk'

  // Series search state
  const [searchingSeries, setSearchingSeries] = useState(false)
  const [seriesSearchQuery, setSeriesSearchQuery] = useState('')
  const [seriesSearchResults, setSeriesSearchResults] = useState([])
  const [selectedSeries, setSelectedSeries] = useState(null)

  // Single card form
  const [singleCard, setSingleCard] = useState({
    proposed_card_number: '',
    proposed_player_names: '',
    proposed_team_names: '',
    proposed_is_rookie: false,
    proposed_is_autograph: false,
    proposed_is_relic: false,
    proposed_is_short_print: false,
    proposed_print_run: '',
    proposed_notes: ''
  })

  // Bulk paste state
  const [bulkData, setBulkData] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [parseError, setParseError] = useState(null)

  const [submissionNotes, setSubmissionNotes] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('single')
      setSingleCard({
        proposed_card_number: '',
        proposed_player_names: '',
        proposed_team_names: '',
        proposed_is_rookie: false,
        proposed_is_autograph: false,
        proposed_is_relic: false,
        proposed_is_short_print: false,
        proposed_print_run: '',
        proposed_notes: ''
      })
      setBulkData('')
      setParsedCards([])
      setParseError(null)
      setSubmissionNotes('')
      setSeriesSearchQuery('')
      setSeriesSearchResults([])
      setSelectedSeries(null)

      if (preselectedSeriesId) {
        fetchSeries(preselectedSeriesId)
      }
    }
  }, [isOpen, preselectedSeriesId])

  const fetchSeries = async (seriesId) => {
    try {
      const response = await axios.get(`/api/series/${seriesId}`)
      if (response.data) {
        setSelectedSeries({
          series_id: response.data.series_id,
          name: response.data.name,
          set_name: response.data.set_name,
          set_year: response.data.set_year
        })
      }
    } catch (err) {
      console.error('Error fetching series:', err)
    }
  }

  const searchSeries = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSeriesSearchResults([])
      return
    }

    setSearchingSeries(true)
    try {
      const response = await axios.get(`/api/series-list/search?q=${encodeURIComponent(query)}&limit=10`)
      setSeriesSearchResults(response.data.series || [])
    } catch (err) {
      console.error('Error searching series:', err)
      setSeriesSearchResults([])
    } finally {
      setSearchingSeries(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (seriesSearchQuery) {
        searchSeries(seriesSearchQuery)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [seriesSearchQuery, searchSeries])

  const handleSelectSeries = (series) => {
    setSelectedSeries(series)
    setSeriesSearchQuery('')
    setSeriesSearchResults([])
  }

  const handleSingleCardChange = (field, value) => {
    setSingleCard(prev => ({ ...prev, [field]: value }))
  }

  // Parse bulk data (tab-separated or CSV)
  const parseBulkData = (data) => {
    if (!data.trim()) {
      setParsedCards([])
      setParseError(null)
      return
    }

    try {
      const lines = data.trim().split('\n')
      const cards = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Try tab-separated first, then comma
        let parts = line.split('\t')
        if (parts.length === 1) {
          parts = line.split(',').map(p => p.trim())
        }

        if (parts.length < 1) continue

        // Format: CardNumber, PlayerName(s), TeamName(s), [RC], [AUTO], [RELIC], [SP], [PrintRun], [Notes]
        // Minimum: CardNumber and PlayerName
        const card = {
          proposed_card_number: parts[0]?.trim() || '',
          proposed_player_names: parts[1]?.trim() || '',
          proposed_team_names: parts[2]?.trim() || '',
          proposed_is_rookie: false,
          proposed_is_autograph: false,
          proposed_is_relic: false,
          proposed_is_short_print: false,
          proposed_print_run: null,
          proposed_notes: ''
        }

        // Check for attributes in remaining parts
        for (let j = 3; j < parts.length; j++) {
          const part = parts[j]?.trim().toUpperCase()
          if (part === 'RC' || part === 'ROOKIE') {
            card.proposed_is_rookie = true
          } else if (part === 'AUTO' || part === 'AUTOGRAPH') {
            card.proposed_is_autograph = true
          } else if (part === 'RELIC' || part === 'MEM' || part === 'MEMORABILIA') {
            card.proposed_is_relic = true
          } else if (part === 'SP' || part === 'SSP' || part === 'SHORT PRINT') {
            card.proposed_is_short_print = true
          } else if (/^\d+$/.test(part)) {
            card.proposed_print_run = parseInt(part)
          } else if (part && !['TRUE', 'FALSE', 'YES', 'NO', ''].includes(part)) {
            // Treat as notes
            card.proposed_notes = parts[j]?.trim() || ''
          }
        }

        if (card.proposed_card_number) {
          cards.push(card)
        }
      }

      if (cards.length === 0) {
        setParseError('No valid cards found. Format: CardNumber, PlayerName, TeamName, [attributes...]')
        setParsedCards([])
      } else if (cards.length > 500) {
        setParseError('Maximum 500 cards per submission. Please split into multiple submissions.')
        setParsedCards([])
      } else {
        setParseError(null)
        setParsedCards(cards)
      }
    } catch (err) {
      setParseError('Error parsing data. Please check format.')
      setParsedCards([])
    }
  }

  useEffect(() => {
    if (mode === 'bulk') {
      parseBulkData(bulkData)
    }
  }, [bulkData, mode])

  const isValid = () => {
    if (!selectedSeries) return false

    if (mode === 'single') {
      return singleCard.proposed_card_number.trim()
    } else {
      return parsedCards.length > 0 && !parseError
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid()) {
      showError('Please select a series and enter card data.')
      return
    }

    setSubmitting(true)

    try {
      let cards
      if (mode === 'single') {
        cards = [{
          card_number: singleCard.proposed_card_number.trim(),
          player_names: singleCard.proposed_player_names.trim() || null,
          team_names: singleCard.proposed_team_names.trim() || null,
          is_rookie: singleCard.proposed_is_rookie,
          is_autograph: singleCard.proposed_is_autograph,
          is_relic: singleCard.proposed_is_relic,
          is_short_print: singleCard.proposed_is_short_print,
          print_run: singleCard.proposed_print_run ? parseInt(singleCard.proposed_print_run) : null,
          notes: singleCard.proposed_notes.trim() || null
        }]
      } else {
        // Transform parsed cards to use API field names
        cards = parsedCards.map(card => ({
          card_number: card.proposed_card_number,
          player_names: card.proposed_player_names,
          team_names: card.proposed_team_names,
          is_rookie: card.proposed_is_rookie,
          is_autograph: card.proposed_is_autograph,
          is_relic: card.proposed_is_relic,
          is_short_print: card.proposed_is_short_print,
          print_run: card.proposed_print_run,
          notes: card.proposed_notes
        }))
      }

      const submissionData = {
        series_id: selectedSeries.series_id,
        cards,
        submission_notes: submissionNotes.trim() || null
      }

      await axios.post('/api/crowdsource/cards', submissionData)

      const cardCount = cards.length
      success(`${cardCount} card${cardCount > 1 ? 's' : ''} submitted for review!`)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error submitting cards:', err)
      if (err.response?.status === 429) {
        showError('Rate limit exceeded. Please try again later.')
      } else {
        showError(err.response?.data?.message || 'Failed to submit cards. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="suggest-cards-modal-overlay" onClick={onClose}>
      <div className="suggest-cards-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-cards-modal-header">
          <h2>
            <Icon name="card" size={20} />
            Submit New Cards
          </h2>
          <button className="suggest-cards-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="suggest-cards-mode-toggle">
          <button
            type="button"
            className={`suggest-cards-mode-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => setMode('single')}
          >
            <Icon name="file" size={16} />
            Single Card
          </button>
          <button
            type="button"
            className={`suggest-cards-mode-btn ${mode === 'bulk' ? 'active' : ''}`}
            onClick={() => setMode('bulk')}
          >
            <Icon name="list" size={16} />
            Bulk Paste
          </button>
        </div>

        <form onSubmit={handleSubmit} className="suggest-cards-form">
          {/* Series Selection */}
          <div className="suggest-cards-form-row">
            <label>
              Series <span className="suggest-cards-required">*</span>
            </label>
            {selectedSeries ? (
              <div className="suggest-cards-selected-series">
                <div className="suggest-cards-selected-info">
                  <span className="suggest-cards-selected-name">{selectedSeries.name}</span>
                  <span className="suggest-cards-selected-set">{selectedSeries.set_year} {selectedSeries.set_name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSeries(null)}
                  className="suggest-cards-remove-series"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ) : (
              <div className="suggest-cards-series-search">
                <input
                  type="text"
                  value={seriesSearchQuery}
                  onChange={e => setSeriesSearchQuery(e.target.value)}
                  placeholder="Search for a series (e.g. 2024 Topps Chrome Base)..."
                />
                {searchingSeries && (
                  <div className="suggest-cards-search-loading">
                    <Icon name="loader" size={14} className="suggest-cards-spinner-icon" />
                  </div>
                )}
                {seriesSearchResults.length > 0 && (
                  <div className="suggest-cards-search-results">
                    {seriesSearchResults.map(series => (
                      <button
                        key={series.series_id}
                        type="button"
                        className="suggest-cards-search-result"
                        onClick={() => handleSelectSeries(series)}
                      >
                        <span className="suggest-cards-result-name">{series.name}</span>
                        <span className="suggest-cards-result-set">{series.set_year} {series.set_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {mode === 'single' ? (
            /* Single Card Form */
            <>
              <div className="suggest-cards-form-row">
                <label>
                  Card Number <span className="suggest-cards-required">*</span>
                </label>
                <input
                  type="text"
                  value={singleCard.proposed_card_number}
                  onChange={e => handleSingleCardChange('proposed_card_number', e.target.value)}
                  placeholder="e.g. 123, 123a, RC-5"
                  required
                />
              </div>

              <div className="suggest-cards-form-row">
                <label>Player Name(s)</label>
                <input
                  type="text"
                  value={singleCard.proposed_player_names}
                  onChange={e => handleSingleCardChange('proposed_player_names', e.target.value)}
                  placeholder="e.g. Mike Trout, or Trout / Ohtani for multi-player"
                />
              </div>

              <div className="suggest-cards-form-row">
                <label>Team Name(s)</label>
                <input
                  type="text"
                  value={singleCard.proposed_team_names}
                  onChange={e => handleSingleCardChange('proposed_team_names', e.target.value)}
                  placeholder="e.g. Los Angeles Angels"
                />
              </div>

              <div className="suggest-cards-checkbox-group">
                <label className="suggest-cards-checkbox">
                  <input
                    type="checkbox"
                    checked={singleCard.proposed_is_rookie}
                    onChange={e => handleSingleCardChange('proposed_is_rookie', e.target.checked)}
                  />
                  <span>Rookie (RC)</span>
                </label>
                <label className="suggest-cards-checkbox">
                  <input
                    type="checkbox"
                    checked={singleCard.proposed_is_autograph}
                    onChange={e => handleSingleCardChange('proposed_is_autograph', e.target.checked)}
                  />
                  <span>Autograph</span>
                </label>
                <label className="suggest-cards-checkbox">
                  <input
                    type="checkbox"
                    checked={singleCard.proposed_is_relic}
                    onChange={e => handleSingleCardChange('proposed_is_relic', e.target.checked)}
                  />
                  <span>Relic</span>
                </label>
                <label className="suggest-cards-checkbox">
                  <input
                    type="checkbox"
                    checked={singleCard.proposed_is_short_print}
                    onChange={e => handleSingleCardChange('proposed_is_short_print', e.target.checked)}
                  />
                  <span>Short Print</span>
                </label>
              </div>

              <div className="suggest-cards-form-row">
                <label>Print Run</label>
                <input
                  type="number"
                  value={singleCard.proposed_print_run}
                  onChange={e => handleSingleCardChange('proposed_print_run', e.target.value)}
                  placeholder="e.g. 99, 199, 500"
                  min="1"
                />
              </div>

              <div className="suggest-cards-form-row">
                <label>Notes</label>
                <textarea
                  value={singleCard.proposed_notes}
                  onChange={e => handleSingleCardChange('proposed_notes', e.target.value)}
                  placeholder="Any additional notes about this card"
                  rows={2}
                />
              </div>
            </>
          ) : (
            /* Bulk Paste Form */
            <>
              <div className="suggest-cards-bulk-info">
                <Icon name="info" size={16} />
                <div>
                  <strong>Paste your card data</strong>
                  <p>Format: CardNumber, PlayerName, TeamName, [RC], [AUTO], [RELIC], [SP], [PrintRun]</p>
                  <p>One card per line. Tab or comma separated.</p>
                </div>
              </div>

              <div className="suggest-cards-form-row">
                <label>Card Data (max 500 cards)</label>
                <textarea
                  value={bulkData}
                  onChange={e => setBulkData(e.target.value)}
                  placeholder={"1\tMike Trout\tAngels\tRC\n2\tShohei Ohtani\tAngels\tRC\tAUTO\n3\tMookie Betts\tDodgers"}
                  rows={8}
                  className="suggest-cards-bulk-textarea"
                />
              </div>

              {parseError && (
                <div className="suggest-cards-parse-error">
                  <Icon name="alert-circle" size={16} />
                  {parseError}
                </div>
              )}

              {parsedCards.length > 0 && (
                <div className="suggest-cards-preview">
                  <div className="suggest-cards-preview-header">
                    <Icon name="check-circle" size={16} />
                    <span>{parsedCards.length} card{parsedCards.length > 1 ? 's' : ''} parsed</span>
                  </div>
                  <div className="suggest-cards-preview-list">
                    {parsedCards.slice(0, 5).map((card, idx) => (
                      <div key={idx} className="suggest-cards-preview-item">
                        <span className="suggest-cards-preview-number">#{card.proposed_card_number}</span>
                        <span className="suggest-cards-preview-player">{card.proposed_player_names || 'No player'}</span>
                        <div className="suggest-cards-preview-attrs">
                          {card.proposed_is_rookie && <span className="suggest-cards-attr rc">RC</span>}
                          {card.proposed_is_autograph && <span className="suggest-cards-attr auto">AUTO</span>}
                          {card.proposed_is_relic && <span className="suggest-cards-attr relic">RELIC</span>}
                          {card.proposed_is_short_print && <span className="suggest-cards-attr sp">SP</span>}
                        </div>
                      </div>
                    ))}
                    {parsedCards.length > 5 && (
                      <div className="suggest-cards-preview-more">
                        +{parsedCards.length - 5} more cards
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="suggest-cards-form-row">
            <label>Submission Notes</label>
            <textarea
              value={submissionNotes}
              onChange={e => setSubmissionNotes(e.target.value)}
              placeholder="Any additional information for reviewers"
              rows={2}
            />
          </div>

          <div className="suggest-cards-form-actions">
            <button type="button" onClick={onClose} className="suggest-cards-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              className="suggest-cards-submit-btn"
              disabled={!isValid() || submitting}
            >
              {submitting ? (
                <>
                  <span className="suggest-cards-spinner"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <Icon name="upload" size={16} />
                  Submit {mode === 'bulk' && parsedCards.length > 0 ? `${parsedCards.length} Cards` : 'Card'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuggestCardsModal
