import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './SeriesLanding.css'

function SeriesLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [sets, setSets] = useState([])
  const [filteredSets, setFilteredSets] = useState([])
  const [setSearchTerm, setSetSearchTerm] = useState('')
  const [series, setSeries] = useState([])
  const [filteredSeries, setFilteredSeries] = useState([])
  const [seriesSearchTerm, setSeriesSearchTerm] = useState('')
  const [selectedSet, setSelectedSet] = useState(null)
  const [recentSeries, setRecentSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSetsData()
    if (isAuthenticated) {
      loadRecentVisits()
    }
  }, [isAuthenticated])

  const loadSetsData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/sets-list')
      const setsData = response.data.sets || []
      // Sort by name descending
      const sortedSets = setsData.sort((a, b) => b.name.localeCompare(a.name))
      setSets(sortedSets)
      setFilteredSets(sortedSets)
      setError(null)
    } catch (err) {
      console.error('Error loading sets:', err)
      setError('Failed to load sets data')
    } finally {
      setLoading(false)
    }
  }

  const loadSeriesForSet = async (setId) => {
    try {
      setSeriesLoading(true)
      const response = await axios.get(`/api/series-by-set/${setId}`)
      const seriesData = response.data.series || []
      setSeries(seriesData)
      setFilteredSeries(seriesData)
      setSeriesSearchTerm('') // Clear search when switching sets
    } catch (err) {
      console.error('Error loading series for set:', err)
      setSeries([])
      setFilteredSeries([])
    } finally {
      setSeriesLoading(false)
    }
  }

  // Filter sets based on search term
  useEffect(() => {
    if (!setSearchTerm.trim()) {
      setFilteredSets(sets)
    } else {
      const filtered = sets.filter(set => 
        set.name.toLowerCase().includes(setSearchTerm.toLowerCase()) ||
        set.manufacturer_name?.toLowerCase().includes(setSearchTerm.toLowerCase())
      )
      setFilteredSets(filtered)
    }
  }, [sets, setSearchTerm])

  // Filter series based on search term
  useEffect(() => {
    if (!seriesSearchTerm.trim()) {
      setFilteredSeries(series)
    } else {
      const filtered = series.filter(seriesItem => 
        seriesItem.name.toLowerCase().includes(seriesSearchTerm.toLowerCase()) ||
        seriesItem.parent_series_name?.toLowerCase().includes(seriesSearchTerm.toLowerCase()) ||
        seriesItem.primary_color_name?.toLowerCase().includes(seriesSearchTerm.toLowerCase())
      )
      setFilteredSeries(filtered)
    }
  }, [series, seriesSearchTerm])

  const handleSetSearch = (e) => {
    setSetSearchTerm(e.target.value)
  }

  const handleSeriesSearch = (e) => {
    setSeriesSearchTerm(e.target.value)
  }

  const loadRecentVisits = () => {
    try {
      const recent = localStorage.getItem('recentSeriesVisits')
      if (recent) {
        setRecentSeries(JSON.parse(recent).slice(0, 6)) // Show max 6 recent
      }
    } catch (err) {
      console.error('Error loading recent visits:', err)
    }
  }

  const handleSetClick = (set) => {
    setSelectedSet(set)
    loadSeriesForSet(set.set_id)
  }

  const handleSeriesClick = (seriesItem) => {
    const slug = seriesItem.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Track visit for logged-in users
    if (isAuthenticated) {
      trackSeriesVisit({
        ...seriesItem,
        slug
      })
    }

    navigate(`/series/${slug}`)
  }

  const trackSeriesVisit = (seriesItem) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentSeriesVisits') || '[]')
      
      // Remove if already exists
      const filtered = recent.filter(s => s.series_id !== seriesItem.series_id)
      
      // Add to front
      const updated = [seriesItem, ...filtered].slice(0, 20) // Keep max 20
      
      localStorage.setItem('recentSeriesVisits', JSON.stringify(updated))
      setRecentSeries(updated.slice(0, 6))
    } catch (err) {
      console.error('Error tracking visit:', err)
    }
  }

  // Calculate text color based on background brightness
  const getTextColor = (hexColor) => {
    if (!hexColor) return '#ffffff'
    
    // Remove # if present
    const hex = hexColor.replace('#', '')
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Return black text for bright colors, white text for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  const SetCard = ({ set }) => (
    <div 
      className={`set-card ${selectedSet?.set_id === set.set_id ? 'selected' : ''}`}
      onClick={() => handleSetClick(set)}
    >
      <div className="set-card-content">
        <div className="set-info">
          <h3 className="set-name">{set.name}</h3>
          <p className="set-manufacturer">{set.manufacturer_name}</p>
        </div>
        <div className="set-stats">
          <div className="stat-item">
            <span className="stat-number">{set.total_card_count.toLocaleString()}</span>
            <span className="stat-label">Cards</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{set.series_count}</span>
            <span className="stat-label">Series</span>
          </div>
        </div>
      </div>
    </div>
  )

  const SeriesCard = ({ series: seriesItem, isRecent = false }) => {
    return (
      <div 
        className={`series-card ${isRecent ? 'recent' : ''}`}
        onClick={() => handleSeriesClick(seriesItem)}
      >
      <div className="series-card-content">

        {/* Always show a color strip - either with color or transparent */}
        <div 
          className="color-strip"
          style={{
            backgroundColor: (seriesItem.is_parallel && seriesItem.color_uniform && seriesItem.primary_color_hex) 
              ? seriesItem.primary_color_hex 
              : 'transparent',
            color: (seriesItem.is_parallel && seriesItem.color_uniform && seriesItem.primary_color_hex)
              ? getTextColor(seriesItem.primary_color_hex)
              : 'transparent'
          }}
        >
          {(seriesItem.is_parallel && seriesItem.color_uniform && seriesItem.primary_color_name) && (
            <span className="color-text">{seriesItem.primary_color_name}</span>
          )}
        </div>

        <div className="series-main-info">
          <div className="series-title-line">
            <h3 className="series-name">
              {seriesItem.name}
            </h3>
            {seriesItem.print_run_display && (
              <span className="print-run">{seriesItem.print_run_display}</span>
            )}
          </div>
          
          <div className="series-metadata">
            {seriesItem.is_parallel && (
              <span className="parallel-badge">
                {seriesItem.parent_series_name}
              </span>
            )}
          </div>
        </div>

        <div className="series-stats">
          <div className="stat-item">
            <span className="stat-number">{seriesItem.card_count.toLocaleString()}</span>
            <span className="stat-label">Cards</span>
          </div>
        </div>
      </div>
    </div>
    )
  }

  if (loading) {
    return (
      <div className="series-landing">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading sets...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="series-landing">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={loadSetsData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="series-landing">
      {isAuthenticated && recentSeries.length > 0 && (
        <section className="recent-section">
          <h2>Recently Viewed Series</h2>
          <div className="recent-series-grid">
            {recentSeries.map(seriesItem => (
              <SeriesCard 
                key={`recent-${seriesItem.series_id}`} 
                series={seriesItem} 
                isRecent={true} 
              />
            ))}
          </div>
        </section>
      )}

      <div className="two-column-layout">
        <section className="sets-column">
          <h2>Sets</h2>
          <div className="sets-search">
            <input
              type="text"
              placeholder="Search sets..."
              value={setSearchTerm}
              onChange={handleSetSearch}
              className="search-input"
            />
          </div>
          <div className="sets-grid">
            {filteredSets.map(set => (
              <SetCard key={set.set_id} set={set} />
            ))}
          </div>
        </section>

        <section className="series-column">
          <h2>
            {selectedSet ? `Series in ${selectedSet.name}` : 'Select a set to view series'}
          </h2>
          {selectedSet && (
            <>
              <div className="series-search">
                <input
                  type="text"
                  placeholder="Search series..."
                  value={seriesSearchTerm}
                  onChange={handleSeriesSearch}
                  className="search-input"
                />
              </div>
              <div className="series-grid">
                {seriesLoading ? (
                  <div className="loading-container">
                    <Icon name="activity" size={24} className="spinner" />
                    <p>Loading series...</p>
                  </div>
                ) : (
                  filteredSeries.map(seriesItem => (
                    <SeriesCard key={seriesItem.series_id} series={seriesItem} />
                  ))
                )}
              </div>
            </>
          )}
          {!selectedSet && (
            <div className="empty-state">
              <Icon name="grid" size={48} />
              <p>Click a set on the left to see its series</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default SeriesLanding