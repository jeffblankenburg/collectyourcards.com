import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import UniversalCardTable from '../components/UniversalCardTable'
import Icon from '../components/Icon'
import './SeriesDetail.css'


function SeriesDetail() {
  const { seriesSlug, year, setSlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [series, setSeries] = useState(null)
  const [stats, setStats] = useState({})
  const [parallels, setParallels] = useState([])
  const [showParallels, setShowParallels] = useState(false)
  const [collectionCompletion, setCollectionCompletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const parallelsRef = useRef(null)

  useEffect(() => {
    fetchSeriesData()
  }, [seriesSlug, year, setSlug])

  // Close parallels dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parallelsRef.current && !parallelsRef.current.contains(event.target)) {
        setShowParallels(false)
      }
    }

    if (showParallels) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showParallels])

  const fetchSeriesData = async () => {
    try {
      setLoading(true)
      
      let seriesList = []
      
      if (year && setSlug) {
        // If we have year and setSlug, get series for that specific set
        // First get the set ID
        const setsResponse = await axios.get('/api/sets-list')
        const allSets = setsResponse.data.sets || []
        const foundSet = allSets.find(set => {
          const setYear = set.year || parseInt(set.name.split(' ')[0])
          const slug = set.name
            .toLowerCase()
            .replace(/'/g, '') // Remove apostrophes completely
            .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
          return setYear === parseInt(year) && slug === setSlug
        })
        
        if (foundSet) {
          // Get series for this set
          const seriesResponse = await axios.get(`/api/series-by-set/${foundSet.set_id}`)
          seriesList = seriesResponse.data.series || []
        }
      } else {
        // Fallback to getting all series (for /series/:seriesSlug route)
        const response = await axios.get('/api/series-list')
        seriesList = response.data.series || []
      }
      
      // Find series by slug (recreate slug logic matching the one used in SeriesCard)
      const foundSeries = seriesList.find(s => {
        if (!s.name) return false
        const slug = s.name
          .toLowerCase()
          .replace(/'/g, '') // Remove apostrophes completely
          .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        return slug === seriesSlug
      })

      if (foundSeries) {
        setSeries(foundSeries)
        
        // Get actual stats for the series
        await fetchSeriesStats(foundSeries)
        
        // Get related parallels
        await fetchRelatedParallels(foundSeries, seriesList)
        
        // Collection completion will be calculated by UniversalCardTable
        
        setError(null)
      } else {
        setError('Series not found')
      }
    } catch (err) {
      console.error('Error fetching series data:', err)
      setError('Failed to load series data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesStats = async (series) => {
    try {
      // Get ALL cards for the series by setting a high limit
      const response = await axios.get(`/api/cards?series_id=${series.series_id}&limit=10000`)
      const cards = response.data.cards || []
      
      // Calculate stats from the actual card data
      const seriesStats = {
        total_cards: cards.length,
        rookie_cards: cards.filter(card => card.is_rookie).length,
        autograph_cards: cards.filter(card => card.is_autograph).length,
        relic_cards: cards.filter(card => card.is_relic).length,
        numbered_cards: cards.filter(card => card.print_run && card.print_run > 0).length,
        unique_players: new Set(
          cards.flatMap(card => 
            card.card_player_teams?.map(cpt => cpt.player?.player_id) || []
          )
        ).size
      }
      
      setStats(seriesStats)
    } catch (err) {
      console.error('Error fetching series stats:', err)
      // Fallback to basic stats if API call fails
      const fallbackStats = {
        total_cards: series.card_count || 0,
        rookie_cards: 0,
        autograph_cards: 0,
        relic_cards: 0,
        numbered_cards: 0,
        unique_players: 0
      }
      setStats(fallbackStats)
    }
  }

  const fetchRelatedParallels = async (currentSeries, allSeries) => {
    try {
      // console.log('Current series:', currentSeries.name, {...})
      
      const relatedParallels = []
      
      if (currentSeries.is_parallel && currentSeries.parallel_of_series) {
        // If this is a parallel, find the parent and other parallels of the same parent
        const parentId = currentSeries.parallel_of_series
        // console.log('Looking for parent with ID:', parentId)
        
        // Find the parent series
        const parent = allSeries.find(s => s.series_id === parentId)
        if (parent) {
          // console.log('Found parent:', parent.name)
          relatedParallels.push({
            ...parent,
            relationship: 'parent'
          })
        }
        
        // Find other parallels of the same parent
        const siblings = allSeries.filter(s => 
          s.parallel_of_series === parentId && 
          s.series_id !== currentSeries.series_id
        )
        // console.log('Found siblings:', siblings.length, siblings.map(s => s.name))
        siblings.forEach(sibling => {
          relatedParallels.push({
            ...sibling,
            relationship: 'sibling'
          })
        })
      } else {
        // If this is a parent series, find all its parallels
        // console.log('Looking for children of series ID:', currentSeries.series_id)
        const children = allSeries.filter(s => 
          s.parallel_of_series === currentSeries.series_id
        )
        // console.log('Found children:', children.length, children.map(s => s.name))
        children.forEach(child => {
          relatedParallels.push({
            ...child,
            relationship: 'parallel'
          })
        })
      }
      
      // console.log('Final related parallels:', relatedParallels.length, relatedParallels.map(p => ({ name: p.name, relationship: p.relationship })))
      setParallels(relatedParallels)
    } catch (err) {
      console.error('Error fetching related parallels:', err)
      setParallels([])
    }
  }


  // Memoize the API endpoint for cards
  const apiEndpoint = useMemo(() => {
    if (!series) return null
    return `/api/cards?series_id=${series.series_id}`
  }, [series?.series_id])

  const handleCardClick = (card) => {
    // Generate the player names for URL
    const playerNames = card.card_player_teams?.map(cpt => 
      `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
    ).filter(name => name).join(', ') || 'unknown'
    
    // Use simple URL format for navigation with series
    const playerSlug = playerNames
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    navigate(`/card/${seriesSlug}/${card.card_number}/${playerSlug}`)
  }

  if (loading) {
    return (
      <div className="series-detail-page">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading series details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="series-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={fetchSeriesData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="series-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>Series not found</p>
        </div>
      </div>
    )
  }

  // Calculate text color based on background brightness (for parallel colors)
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

  return (
    <div className="series-detail-page">
      <div className="series-detail-container">
        
        {/* Series Header - Redesigned */}
        <header className="series-header-combined">
          {/* Color Strip for Parallels */}
          {(series.color_hex_value || series.color_name) && (
            <div 
              className="color-strip"
              style={{
                backgroundColor: series.color_hex_value || '#ec4899',
                color: getTextColor(series.color_hex_value || '#ec4899')
              }}
            >
              <span className="color-text">
                {series.color_name || 'Parallel'}{series.print_run_display && (
                  <>
                    &nbsp;&nbsp;{series.print_run_display}
                  </>
                )}
              </span>
            </div>
          )}

          <div className="series-header-content">
            {/* Two Column Layout */}
            <div className="series-header-top">
              <div className="series-title-section">
                <div className="series-title-line">
                  <h1 className="series-name">{series.name}</h1>
                </div>
                
                {/* Card Images in same column as title */}
                {(series.front_image_path || series.back_image_path) && (
                  <div className="card-images-section">
                    <div className="card-images-container">
                      {series.front_image_path && (
                        <div className="card-image-wrapper">
                          <img 
                            src={series.front_image_path}
                            alt={`${series.name} front`}
                            className="card-image front-image"
                          />
                          <span className="image-label">Front</span>
                        </div>
                      )}
                      {series.back_image_path && (
                        <div className="card-image-wrapper">
                          <img 
                            src={series.back_image_path}
                            alt={`${series.name} back`}
                            className="card-image back-image"
                          />
                          <span className="image-label">Back</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats and Parallels */}
              <div className="series-stats-section">
                <div className="series-stats-grid">
                  {/* Collection Completion for Authenticated Users */}
                  {isAuthenticated && collectionCompletion && (
                    <div className="stat-compact completion-stat">
                      <span 
                        className="stat-value"
                        style={{
                          color: collectionCompletion.percentage === 100 ? '#10b981' : 
                                collectionCompletion.percentage >= 90 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {collectionCompletion.percentage}%
                      </span>
                      <span className="stat-label">Complete</span>
                    </div>
                  )}
                  
                  <div className="stat-compact">
                    <span className="stat-value">{stats.total_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label">Cards</span>
                  </div>
                  <div className="stat-compact">
                    <span className="stat-value">{stats.rookie_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label">Rookies</span>
                  </div>
                </div>

                {/* Parallels Dropdown */}
                {parallels.length > 0 && (
                  <div className="parallels-compact">
                    <div className="parallels-dropdown" ref={parallelsRef}>
                      <button 
                        className="parallels-toggle"
                        onClick={() => setShowParallels(!showParallels)}
                      >
                        <span className="parallels-count">{parallels.length} related parallel{parallels.length === 1 ? '' : 's'}</span>
                        <Icon name={showParallels ? "arrow-up" : "arrow-down"} size={14} />
                      </button>
                      
                      {showParallels && (
                        <div className="parallels-dropdown-menu">
                          {parallels.map(parallel => (
                            <div 
                              key={parallel.series_id}
                              className={`parallel-item-compact ${parallel.relationship}`}
                              onClick={() => {
                                const slug = parallel.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9\s-]/g, '')
                                  .replace(/\s+/g, '-')
                                  .replace(/-+/g, '-')
                                  .trim()
                                navigate(`/series/${slug}`)
                              }}
                            >
                              <div className="parallel-content-compact">
                                <span className="parallel-name-compact">{parallel.name}</span>
                                {parallel.print_run_display && (
                                  <span className="parallel-print-run-tag">{parallel.print_run_display}</span>
                                )}
                              </div>
                              {parallel.color_hex_value && (
                                <div 
                                  className="parallel-color-stripe"
                                  style={{ backgroundColor: parallel.color_hex_value }}
                                  title={parallel.color_name}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Cards Table */}
        {apiEndpoint && (
          <UniversalCardTable
            apiEndpoint={apiEndpoint}
            showPlayer={true}
            showTeam={true}
            showSeries={false} // Don't show series column since we're already filtering by series
            defaultSort="sort_order"
            downloadFilename={`${series.name.replace(/[^a-z0-9]/gi, '_')}_${series.year}_cards`}
            showSearch={true}
            onCardClick={handleCardClick}
            onCollectionDataLoaded={isAuthenticated ? (data) => {
              const { totalCards, ownedCount } = data
              const percentage = totalCards > 0 ? Math.round((ownedCount / totalCards) * 100) : 0
              setCollectionCompletion({
                percentage,
                owned: ownedCount,
                total: totalCards
              })
            } : null}
          />
        )}

      </div>
    </div>
  )
}

export default SeriesDetail