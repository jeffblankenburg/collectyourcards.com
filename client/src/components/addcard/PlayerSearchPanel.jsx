import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import './PlayerSearchPanel.css'

/**
 * PlayerSearchPanel - Large player search for Add Card flow
 *
 * Shows a prominent search input and displays matching players
 * as clickable cards with photos, names, and card counts.
 */
export default function PlayerSearchPanel({ onSelect, selectedPlayer, onClearSelection }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  // Debounced search
  const searchPlayers = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const response = await axios.get('/api/v1/search', {
        params: {
          q: searchQuery.trim(),
          types: 'players',
          limit: 20
        }
      })

      if (response.data.success && response.data.data.players) {
        setResults(response.data.data.players)
      } else {
        setResults([])
      }
    } catch (error) {
      console.error('Player search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchPlayers(value)
    }, 300)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Handle player selection
  const handlePlayerClick = (player) => {
    onSelect(player)
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  // Focus input when mounted and no player selected
  useEffect(() => {
    if (!selectedPlayer && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedPlayer])

  // If player is selected, show selected state
  if (selectedPlayer) {
    return (
      <div className="player-search-panel player-search-panel-selected">
        <div className="player-search-selected-header">
          <span className="player-search-step-label">Step 1: Who's on the card?</span>
          <div className="player-search-selected-info">
            <div className="player-search-selected-avatar">
              {selectedPlayer.display_image ? (
                <img
                  src={selectedPlayer.display_image}
                  alt={`${selectedPlayer.first_name} ${selectedPlayer.last_name}`}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              ) : (
                <span className="player-search-avatar-placeholder">
                  {selectedPlayer.first_name?.[0] || ''}{selectedPlayer.last_name?.[0] || ''}
                </span>
              )}
            </div>
            <div className="player-search-selected-details">
              <span className="player-search-selected-name">
                {selectedPlayer.first_name} {selectedPlayer.last_name}
              </span>
              <span className="player-search-selected-cards">
                {selectedPlayer.card_count?.toLocaleString() || 0} cards in database
              </span>
            </div>
            <button
              className="player-search-change-btn"
              onClick={onClearSelection}
              type="button"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="player-search-panel">
      <label className="player-search-step-label">
        Step 1: Who's on the card?
      </label>

      <div className="player-search-input-wrapper">
        <svg
          className="player-search-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="player-search-input"
          placeholder="Search player name..."
          value={query}
          onChange={handleInputChange}
          autoComplete="off"
        />
        {isLoading && (
          <div className="player-search-loading">
            <div className="player-search-spinner"></div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && !isLoading && (
        <div className="player-search-results">
          {results.length === 0 ? (
            <div className="player-search-no-results">
              <p>No players found matching "{query}"</p>
              <p className="player-search-hint">
                Try searching by first name, last name, or nickname
              </p>
            </div>
          ) : (
            <div className="player-search-grid">
              {results.map(player => (
                <button
                  key={player.player_id}
                  type="button"
                  className="player-search-result-card"
                  onClick={() => handlePlayerClick(player)}
                >
                  <div className="player-result-avatar">
                    {player.display_image ? (
                      <img
                        src={player.display_image}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <span
                      className="player-result-avatar-fallback"
                      style={{ display: player.display_image ? 'none' : 'flex' }}
                    >
                      {player.first_name?.[0] || ''}{player.last_name?.[0] || ''}
                    </span>
                  </div>
                  <div className="player-result-info">
                    <span className="player-result-name">
                      {player.first_name} {player.last_name}
                      {player.is_hof && <span className="player-hof-badge">HOF</span>}
                    </span>
                    <span className="player-result-cards">
                      {player.card_count?.toLocaleString() || 0} cards
                    </span>
                  </div>
                  <svg
                    className="player-result-arrow"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial state hint */}
      {!hasSearched && !isLoading && (
        <p className="player-search-initial-hint">
          Start typing a player name to find their cards
        </p>
      )}
    </div>
  )
}
