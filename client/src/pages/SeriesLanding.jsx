import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './SeriesLanding.css'

function SeriesLanding() {
  const { year, setSlug } = useParams()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [years, setYears] = useState([])
  const [filteredYears, setFilteredYears] = useState([])
  const [sets, setSets] = useState([])
  const [filteredSets, setFilteredSets] = useState([])
  const [series, setSeries] = useState([])
  const [filteredSeries, setFilteredSeries] = useState([])
  const [selectedSet, setSelectedSet] = useState(null)
  const [recentSeries, setRecentSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      loadRecentVisits()
    }

    // Load data based on URL parameters
    if (setSlug) {
      // We're viewing series for a specific set
      loadSetBySlug(year, setSlug)
      loadSeriesForSet(year, setSlug)
    } else if (year) {
      // We're viewing sets for a specific year
      loadSetsForYear(year)
    } else {
      // We're viewing the years list
      loadYears()
    }
  }, [year, setSlug, isAuthenticated])

  // Update page title based on current view
  useEffect(() => {
    if (setSlug && selectedSet) {
      document.title = `${selectedSet.name} - Collect Your Cards`
    } else if (year) {
      document.title = `${year} Sets - Collect Your Cards`
    } else {
      document.title = 'Browse Sets by Year - Collect Your Cards'
    }
  }, [year, setSlug, selectedSet])

  const loadYears = async () => {
    try {
      setLoading(true)
      // Use the existing sets-list endpoint and extract years from it
      const response = await axios.get('/api/sets-list')
      const setsData = response.data.sets || []
      
      // Group sets by year and count series
      const yearStats = {}
      setsData.forEach(set => {
        const setYear = parseInt(set.name.split(' ')[0]) // Extract year from set name
        if (setYear && setYear >= 1800 && setYear <= new Date().getFullYear() + 10) {
          if (!yearStats[setYear]) {
            yearStats[setYear] = { year: setYear, setCount: 0, seriesCount: 0 }
          }
          yearStats[setYear].setCount += 1
          yearStats[setYear].seriesCount += set.series_count || 0
        }
      })
      
      const yearsData = Object.values(yearStats).sort((a, b) => b.year - a.year)
      setYears(yearsData)
      setFilteredYears(yearsData)
      setError(null)
    } catch (err) {
      console.error('Error loading years:', err)
      setError('Failed to load years data')
    } finally {
      setLoading(false)
    }
  }

  const loadSetsForYear = async (selectedYear) => {
    try {
      setLoading(true)
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []
      
      // Filter sets by year (extract year from set name)
      const yearSets = allSets.filter(set => {
        const setYear = parseInt(set.name.split(' ')[0])
        return setYear === parseInt(selectedYear)
      })
      
      // Debug: check organization data
      if (yearSets.length > 0) {
        console.log('Sample set organization:', yearSets[0].organization)
        console.log('Sets with organization:', yearSets.filter(s => s.organization).length)
      }
      
      setSets(yearSets)
      setFilteredSets(yearSets)
      setError(null)
    } catch (err) {
      console.error('Error loading sets:', err)
      setError('Failed to load sets data')
    } finally {
      setLoading(false)
    }
  }

  const loadSetBySlug = async (selectedYear, selectedSetSlug) => {
    try {
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []
      
      // Find the set by year and slug (using stored slug from database)
      const foundSet = allSets.find(set => {
        const setYear = parseInt(set.name.split(' ')[0])
        return setYear === parseInt(selectedYear) && set.slug === selectedSetSlug
      })
      
      if (foundSet) {
        setSelectedSet(foundSet)
      }
    } catch (err) {
      console.error('Error loading set:', err)
    }
  }

  const loadSeriesForSet = async (selectedYear, selectedSetSlug) => {
    try {
      setLoading(true)
      
      // First get the set ID
      const setsResponse = await axios.get('/api/sets-list')
      const allSets = setsResponse.data.sets || []
      const foundSet = allSets.find(set => {
        const setYear = parseInt(set.name.split(' ')[0])
        return setYear === parseInt(selectedYear) && set.slug === selectedSetSlug
      })
      
      if (foundSet) {
        // Now get series for this set
        const response = await axios.get(`/api/series-by-set/${foundSet.set_id}`)
        const seriesData = response.data.series || []
        setSeries(seriesData)
        setFilteredSeries(seriesData)
      }
      
      setError(null)
    } catch (err) {
      console.error('Error loading series:', err)
      setError('Failed to load series data')
    } finally {
      setLoading(false)
    }
  }

  // Filter based on search term and current view
  useEffect(() => {
    if (!searchTerm.trim()) {
      if (!year && !setSlug) {
        setFilteredYears(years)
      } else if (year && !setSlug) {
        setFilteredSets(sets)
      } else {
        setFilteredSeries(series)
      }
    } else {
      const searchLower = searchTerm.toLowerCase()
      
      if (!year && !setSlug) {
        // Filter years by year number
        const filtered = years.filter(y => 
          y.year.toString().includes(searchTerm)
        )
        setFilteredYears(filtered)
      } else if (year && !setSlug) {
        // Filter sets
        const filtered = sets.filter(set => 
          set.name.toLowerCase().includes(searchLower) ||
          set.manufacturer_name?.toLowerCase().includes(searchLower)
        )
        setFilteredSets(filtered)
      } else {
        // Filter series
        const filtered = series.filter(seriesItem => 
          seriesItem.name.toLowerCase().includes(searchLower) ||
          seriesItem.parent_series_name?.toLowerCase().includes(searchLower) ||
          seriesItem.color_name?.toLowerCase().includes(searchLower)
        )
        setFilteredSeries(filtered)
      }
    }
  }, [years, sets, series, searchTerm, year, setSlug])

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

    // Use canonical URL with year/setSlug if available
    if (year && setSlug) {
      navigate(`/sets/${year}/${setSlug}/${slug}`)
    } else {
      // Fallback to simple series route (will redirect to canonical)
      navigate(`/series/${slug}`)
    }
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

  // Generate URL slug (matching backend)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  if (loading) {
    return (
      <div className="series-landing">
        <div className="loading-container">
          <div className="card-icon-spinner"></div>
          <p>Loading...</p>
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
          <button onClick={() => window.location.reload()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="series-landing">
      <div className="series-header">
        <div className="series-title">
          {(year || setSlug) && (
            <Link 
              to={setSlug ? `/sets/${year}` : '/sets'}
              className="back-button"
              title="Go back"
            >
              <Icon name="arrow-left" size={24} />
            </Link>
          )}
          <Icon name="series" size={32} />
          <h1>
            {setSlug && selectedSet ? selectedSet.name
             : year ? `${year} Sets`
             : 'Browse Sets by Year'}
          </h1>
        </div>
        
        <div className="series-controls">
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder={
                !year && !setSlug ? "Search years..." 
                : year && !setSlug ? "Search sets..." 
                : "Search series..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="series-content">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* Years Grid - Only show when no year/set selected */}
            {!year && !setSlug && (
              <div className="years-grid">
                {filteredYears.map(y => (
                  <Link 
                    key={y.year} 
                    to={`/sets/${y.year}`}
                    className="year-card"
                  >
                    <div className="year-number">{y.year}</div>
                    <div className="year-stats">
                      <div className="year-stat-box">
                        <div className="year-stat-number">{y.setCount}</div>
                        <div className="year-stat-label">SETS</div>
                      </div>
                      <div className="year-stat-box">
                        <div className="year-stat-number">{y.seriesCount}</div>
                        <div className="year-stat-label">SERIES</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Sets Grid - Show when year selected but no set */}
            {year && !setSlug && (
              <div className="sets-grid">
                {filteredSets.map(set => (
                  <div
                    key={set.set_id}
                    className="set-card"
                    onClick={() => navigate(`/sets/${year}/${set.slug}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="set-thumbnail">
                      {set.thumbnail ? (
                        <img src={set.thumbnail} alt={`${set.name} thumbnail`} />
                      ) : (
                        <Icon name="series" size={20} />
                      )}
                    </div>
                    <div className="set-main">
                      <div className="set-header">
                        <div className="set-title-row">
                          <div className="set-name">{set.name}</div>
                        </div>
                      </div>
                      <div className="set-content">
                        <div className="set-stats">
                          <div className="set-stat-box">
                            <div className="set-stat-number">{set.series_count || 0}</div>
                            <div className="set-stat-label">SERIES</div>
                          </div>
                          <div className="set-stat-box">
                            <div className="set-stat-number">{set.total_card_count?.toLocaleString() || 0}</div>
                            <div className="set-stat-label">CARDS</div>
                          </div>
                        </div>
                        <div className="set-tags">
                          {set.manufacturer_name && (
                            <div className="set-manufacturer">
                              <span className="manufacturer-tag">{set.manufacturer_name}</span>
                            </div>
                          )}
                          {set.organization && (
                            <div className="set-organization">
                              <span className="org-abbreviation">{set.organization}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Series Grid - Show when both year and set selected */}
            {year && setSlug && (
              <div className="series-grid">
                {filteredSeries.map(seriesItem => (
                  <div 
                    key={seriesItem.series_id}
                    className="series-card"
                    onClick={() => handleSeriesClick(seriesItem)}
                  >
                    <div className="series-card-content">
                      <div className="series-info">
                        <h3 className="series-name">{seriesItem.name}</h3>
                        {seriesItem.is_parallel && seriesItem.parent_series_name && (
                          <p className="parallel-badge">{seriesItem.parent_series_name}</p>
                        )}
                      </div>
                      <div className="series-stats">
                        <div className="stat-item">
                          <span className="stat-number">{seriesItem.card_count?.toLocaleString() || 0}</span>
                          <span className="stat-label">Cards</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SeriesLanding