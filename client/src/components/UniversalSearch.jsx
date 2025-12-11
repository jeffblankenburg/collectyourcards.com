import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { trackSearch, trackSearchResultClick } from '../utils/analytics'
import Icon from './Icon'
import axios from 'axios'
// import './UniversalSearch.css' // Styles moved to Header.css for independent stylesheets

function UniversalSearch({ className = '' }) {
  const { isAuthenticated, user } = useAuth()
  const { error } = useToast()
  const navigate = useNavigate()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searchHistory, setSearchHistory] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [relaxationMessage, setRelaxationMessage] = useState(null)
  const [searchTime, setSearchTime] = useState(null)
  
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)
  
  // Load search history from localStorage (only for authenticated users)
  useEffect(() => {
    if (isAuthenticated && user) {
      const userHistoryKey = `searchHistory_${user.id}`
      const history = localStorage.getItem(userHistoryKey)
      if (history) {
        setSearchHistory(JSON.parse(history))
      }
    } else {
      // Clear search history for unauthenticated users
      setSearchHistory([])
    }
  }, [isAuthenticated, user])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false)
        setSelectedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Debounced search function
  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      setShowDropdown(false)
      setSuggestions([])
      setRelaxationMessage(null)
      return
    }

    // Search is always available - no authentication required

    setIsSearching(true)

    try {
      const response = await axios.get('/api/search/universal-v3', {
        params: {
          q: searchQuery,
          limit: 50
        }
      })

      setResults(response.data.results || [])
      setSuggestions(response.data.suggestions || [])
      setRelaxationMessage(response.data.relaxed ? response.data.message : null)
      setSearchTime(response.data.searchTime)
      setShowDropdown(true)
      setSelectedIndex(-1)

      // Track search in Google Analytics
      trackSearch(searchQuery, response.data.results?.length || 0)
    } catch (err) {
      console.error('Search error:', err)
      error('Search failed. Please try again.')
      setResults([])
      setSuggestions([])
      setRelaxationMessage(null)
      setShowDropdown(false)
    } finally {
      setIsSearching(false)
    }
  }
  
  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Set new debounce
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        handleSearch(query)
      }
      return
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
        
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
        
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex])
        } else if (query.trim()) {
          handleSearch(query)
        }
        break
        
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        searchRef.current?.blur()
        break
    }
  }
  
  // Handle search submission
  const handleSearch = (searchQuery = query) => {
    if (!searchQuery.trim()) return
    
    // Add to search history (only for authenticated users)
    if (isAuthenticated && user) {
      const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10)
      setSearchHistory(newHistory)
      const userHistoryKey = `searchHistory_${user.id}`
      localStorage.setItem(userHistoryKey, JSON.stringify(newHistory))
    }
    
    // Navigate to search results page (to be created)
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    setShowDropdown(false)
    setQuery('')
  }
  
  // Handle result click
  const handleResultClick = (result, position = 0) => {
    setShowDropdown(false)
    const searchTerm = query
    setQuery('')

    // Track search result click in Google Analytics
    trackSearchResultClick(
      searchTerm,
      result.type,
      result.id?.toString() || 'unknown',
      position + 1 // Convert to 1-indexed
    )

    // Add to search history (only for authenticated users)
    if (isAuthenticated && user) {
      const resultTitle = getResultTitle(result)
      const newHistory = [resultTitle, ...searchHistory.filter(h => h !== resultTitle)].slice(0, 10)
      setSearchHistory(newHistory)
      const userHistoryKey = `searchHistory_${user.id}`
      localStorage.setItem(userHistoryKey, JSON.stringify(newHistory))
    }

    // Navigate based on result type
    switch (result.type) {
      case 'card':
        // Use slug if available, otherwise use player name to create slug
        const cardPlayerName = result.player_names || ''
        if (cardPlayerName) {
          const playerSlug = cardPlayerName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          // For now, navigate to search - card detail route may need card ID
          navigate(`/search?q=${encodeURIComponent(cardPlayerName + ' ' + result.card_number)}`)
        } else {
          navigate(`/search?q=${encodeURIComponent(result.card_number || '')}`)
        }
        break
      case 'player':
        // Use slug if available, otherwise create from first/last name
        if (result.slug) {
          navigate(`/players/${result.slug}`)
        } else if (result.first_name && result.last_name) {
          const playerSlug = `${result.first_name}-${result.last_name}`
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          navigate(`/players/${playerSlug}`)
        } else {
          console.error('Player data missing for navigation:', result)
        }
        break
      case 'team':
        navigate(`/teams/${result.id}`)
        break
      case 'set':
        // Navigate to set page using year and slug
        if (result.slug && result.year) {
          navigate(`/sets/${result.year}/${result.slug}`)
        } else {
          console.error('Set data missing for navigation:', result)
        }
        break
      case 'series':
        // Create series slug from series name
        const seriesName = result.series_name || result.name || ''
        if (seriesName) {
          const seriesSlug = seriesName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          // For now, navigate to search
          navigate(`/search?q=${encodeURIComponent(seriesName)}`)
        } else {
          console.error('Series name missing for navigation:', result)
        }
        break
      case 'collection':
        navigate(`/collection?highlight=${result.id}`)
        break
      default:
        navigate(`/search?q=${encodeURIComponent(getResultTitle(result))}`)
    }
  }
  
  // Handle focus to show recent searches or dropdown
  const handleFocus = () => {
    if (query.trim() && results.length > 0) {
      setShowDropdown(true)
    } else if (!query.trim() && searchHistory.length > 0) {
      setShowDropdown(true)
    }
  }
  
  // Get icon for result type
  const getResultIcon = (type, result) => {
    switch (type) {
      case 'card': return <Icon name="card" size={24} />
      case 'player': return <Icon name="player" size={24} />
      case 'team': {
        // Get sport-specific ball icon based on organization
        const org = result?.data?.organization_name?.toLowerCase() || ''
        if (org.includes('baseball')) return <Icon name="baseball" size={24} />
        if (org.includes('football')) return <Icon name="football" size={24} />
        if (org.includes('basketball')) return <Icon name="basketball" size={24} />
        return <Icon name="team" size={24} />
      }
      case 'set': return <Icon name="layers" size={24} />
      case 'series': return <Icon name="series" size={24} />
      case 'collection': return <Icon name="collections" size={24} />
      default: return <Icon name="search" size={24} />
    }
  }

  // Get entity count for display
  const getEntityCount = (result) => {
    switch (result.type) {
      case 'player':
        return result.data?.card_count || 'N/A'
      case 'team':
        return result.data?.card_count || 'N/A'
      case 'set':
        return result.series_count || 'N/A'
      case 'series':
        return result.data?.card_count || 'N/A'
      case 'card':
        return '1'
      default:
        return 'N/A'
    }
  }

  // Get display title for a result based on type
  const getResultTitle = (result) => {
    switch (result.type) {
      case 'player':
        return result.name || `${result.first_name || ''} ${result.last_name || ''}`.trim()
      case 'card':
        return result.name || result.player_names || result.card_number || 'Unknown Card'
      case 'team':
        return result.name || 'Unknown Team'
      case 'set':
        return result.name || 'Unknown Set'
      case 'series':
        return result.series_name || result.name || 'Unknown Series'
      case 'history':
        return result.title
      default:
        return result.title || result.name || 'Unknown'
    }
  }

  // Get grouped results for display
  const getGroupedResults = () => {
    if (query.trim() && results.length > 0) {
      return results
    } else if (!query.trim() && searchHistory.length > 0) {
      return searchHistory.slice(0, 5).map(term => ({
        type: 'history',
        title: term,
        subtitle: 'Recent search',
        description: '',
        id: term
      }))
    }
    return []
  }

  const displayResults = getGroupedResults()
  
  return (
    <div className={`universal-search ${className}`} ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search cards, players, teams..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="search-input"
          autoComplete="off"
        />
        {isSearching && (
          <div className="search-loading">
            <div className="spinner"></div>
          </div>
        )}
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('')
              setResults([])
              setShowDropdown(false)
            }}
          >
            ✕
          </button>
        )}
      </div>
      
      {showDropdown && displayResults.length > 0 && (
        <div className="search-dropdown" ref={dropdownRef}>
          {!query.trim() && searchHistory.length > 0 && (
            <div className="search-section-header">Recent Searches</div>
          )}

          {/* Display filter relaxation message */}
          {relaxationMessage && (
            <div className="search-relaxation-message">
              <Icon name="alert" size={16} />
              <span>{relaxationMessage}</span>
            </div>
          )}

          {/* Display suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="search-suggestion"
                  onClick={() => {
                    setQuery(suggestion.suggestion)
                    performSearch(suggestion.suggestion)
                  }}
                >
                  <Icon name="lightbulb" size={16} />
                  <span>{suggestion.reason}</span>
                </div>
              ))}
            </div>
          )}

          {displayResults.length > 10 && query.trim() && (
            <div className="scroll-indicator">
              <Icon name="search" size={14} />
              Scroll for more results ({displayResults.length} total)
            </div>
          )}
          
          {displayResults.map((result, index) => (
            <div
              key={`${result.type}-${result.id}-${index}`}
              className={`search-result ${selectedIndex === index ? 'selected' : ''} ${result.type === 'history' ? 'history-item' : ''}`}
              style={result.type === 'card' && result.color_hex ? { position: 'relative' } : undefined}
              onClick={() => {
                if (result.type === 'history') {
                  setQuery(result.title)
                  performSearch(result.title)
                } else {
                  handleResultClick(result, index)
                }
              }}
            >
              <div className="result-icon">
                {result.type === 'history' ? <Icon name="clock" size={16} /> : getResultIcon(result.type, result)}
              </div>
              <div className="result-content">
                <div className="result-title">
                  {highlightQuery(getResultTitle(result), query)}
                  {result.type === 'player' && result.teams && result.teams.length > 0 && (
                    <div className="result-teams-inline">
                      {result.teams.map(team => (
                        <div
                          key={team.team_id}
                          className="mini-team-circle"
                          style={{
                            '--primary-color': team.primary_color || '#666',
                            '--secondary-color': team.secondary_color || '#999'
                          }}
                          title={team.name}
                        >
                          {team.abbreviation || '?'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {result.type === 'set' && result.manufacturer_name && (
                  <div className="result-subtitle">
                    <span className="set-manufacturer">{result.manufacturer_name}</span>
                  </div>
                )}
                {result.type === 'series' && (result.set_name || result.color_name) && (
                  <div className="result-subtitle">
                    {result.set_name && <span className="series-set">{result.set_name}</span>}
                    {result.color_name && (
                      <>
                        <span className="separator"> • </span>
                        <span
                          className="series-color-badge"
                          style={{
                            backgroundColor: result.color_hex || '#999',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.85em',
                            fontWeight: '500'
                          }}
                        >
                          {result.color_name}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {result.type === 'team' && result.data?.organization_name && (
                  <div className="result-subtitle">
                    {result.data.organization_name}
                  </div>
                )}
              </div>
              {result.type === 'player' && (
                <div className="result-card-count">
                  <span className="card-count-number">{result.card_count || 0}</span>
                  <span className="card-count-label">cards</span>
                </div>
              )}
              {result.type === 'team' && (
                <div className="result-card-count">
                  <span className="card-count-number">{result.player_count || 0}</span>
                  <span className="card-count-label">players</span>
                </div>
              )}
              {result.type === 'set' && (
                <div className="result-card-count">
                  <span className="card-count-number">{result.series_count || 0}</span>
                  <span className="card-count-label">series</span>
                </div>
              )}
              {result.type === 'series' && (
                <div className="result-card-count">
                  <span className="card-count-number">{result.card_count || 0}</span>
                  <span className="card-count-label">cards</span>
                </div>
              )}
              {result.type === 'card' && result.color_hex && (
                <div
                  className="result-color-stripe"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    backgroundColor: result.color_hex
                  }}
                  title={result.color_name}
                />
              )}
              {result.type === 'history' && (
                <button
                  className="remove-history"
                  onClick={(e) => {
                    e.stopPropagation()
                    const newHistory = searchHistory.filter(h => h !== result.title)
                    setSearchHistory(newHistory)
                    if (isAuthenticated && user) {
                      const userHistoryKey = `searchHistory_${user.id}`
                      localStorage.setItem(userHistoryKey, JSON.stringify(newHistory))
                    }
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          
          {query.trim() && results.length === 0 && !isSearching && (
            <div className="no-results">
              <div className="no-results-icon">
                <Icon name="search" size={24} />
              </div>
              <div className="no-results-text">No results found</div>
              <div className="no-results-suggestion">Try different keywords or check your spelling</div>
            </div>
          )}
          
          {query.trim() && results.length > 0 && (
            <div className="search-footer">
              <div className="search-result-count">
                Showing {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
                {searchTime !== null && (
                  <span className="search-time"> · {searchTime}ms</span>
                )}
              </div>
              <button
                className="view-all-results"
                onClick={() => handleSearch()}
              >
                View full search page
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper function to highlight search query in results
function highlightQuery(text, query) {
  // Handle null/undefined text
  if (!text || typeof text !== 'string') return text || ''
  if (!query || !query.trim()) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="search-highlight">{part}</mark>
    ) : part
  )
}

export default UniversalSearch