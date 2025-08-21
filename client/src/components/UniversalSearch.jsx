import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from './Icon'
import axios from 'axios'
import './UniversalSearch.css'

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
      return
    }
    
    // Search is always available - no authentication required
    
    setIsSearching(true)
    
    try {
      const response = await axios.get('/api/search/universal', {
        params: {
          q: searchQuery,
          limit: 50
        }
      })
      
      setResults(response.data.results || [])
      setShowDropdown(true)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('Search error:', err)
      error('Search failed. Please try again.')
      setResults([])
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
  const handleResultClick = (result) => {
    setShowDropdown(false)
    setQuery('')
    
    // Add to search history (only for authenticated users)
    if (isAuthenticated && user) {
      const searchTerm = result.title
      const newHistory = [searchTerm, ...searchHistory.filter(h => h !== searchTerm)].slice(0, 10)
      setSearchHistory(newHistory)
      const userHistoryKey = `searchHistory_${user.id}`
      localStorage.setItem(userHistoryKey, JSON.stringify(newHistory))
    }
    
    // Navigate based on result type
    switch (result.type) {
      case 'card':
        navigate(`/cards/${result.id}`)
        break
      case 'player':
        // Create player slug from first and last name
        const firstName = result.data?.first_name || ''
        const lastName = result.data?.last_name || ''
        if (firstName && lastName) {
          const playerSlug = `${firstName}-${lastName}`
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
      case 'series':
        navigate(`/series/${result.id}`)
        break
      case 'collection':
        navigate(`/collection?highlight=${result.id}`)
        break
      default:
        navigate(`/search?q=${encodeURIComponent(result.title)}`)
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
  const getResultIcon = (type) => {
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
      case 'series':
        return result.data?.card_count || 'N/A'
      case 'card':
        return '1'
      default:
        return 'N/A'
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
              onClick={() => {
                if (result.type === 'history') {
                  setQuery(result.title)
                  performSearch(result.title)
                } else {
                  handleResultClick(result)
                }
              }}
            >
              <div className="result-icon">
                {result.type === 'history' ? <Icon name="clock" size={16} /> : getResultIcon(result.type, result)}
              </div>
              <div className="result-content">
                <div className="result-title">
                  {highlightQuery(result.title, query)}
                </div>
              </div>
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
  if (!query.trim()) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="search-highlight">{part}</mark>
    ) : part
  )
}

export default UniversalSearch