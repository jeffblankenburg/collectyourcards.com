import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import CardPreviewTile from './CardPreviewTile'
import './CardBrowserGrid.css'

/**
 * CardBrowserGrid - Visual card grid for Add Card flow
 *
 * Displays all cards for a player in a visual grid with filters.
 * Users can filter by card number, year, team, and text search.
 * Uses infinite scroll for pagination.
 */
export default function CardBrowserGrid({ player, onAddClick, onCantFind }) {
  const [cards, setCards] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)

  // Filter state
  const [filters, setFilters] = useState({
    cardNumber: '',
    year: '',
    search: ''
  })

  // Available years for dropdown
  const [availableYears, setAvailableYears] = useState([])

  const debounceRef = useRef(null)
  const loadMoreRef = useRef(null)

  // Fetch cards
  const fetchCards = useCallback(async (pageNum = 1, append = false) => {
    if (!player?.player_id) return

    if (pageNum === 1) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = {
        player_id: player.player_id,
        limit: 24,
        page: pageNum
      }

      // Add filters
      if (filters.cardNumber) {
        params.card_number = filters.cardNumber
      }
      if (filters.year) {
        params.year = filters.year
      }
      if (filters.search) {
        params.search = filters.search
      }

      const response = await axios.get('/api/cards', { params })

      if (response.data) {
        const newCards = response.data.cards || []

        if (append) {
          setCards(prev => [...prev, ...newCards])
        } else {
          setCards(newCards)
        }

        setTotal(response.data.total || 0)
        setHasMore(response.data.hasMore || false)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [player?.player_id, filters])

  // Initial fetch and filter changes
  useEffect(() => {
    if (player?.player_id) {
      fetchCards(1, false)
    }
  }, [player?.player_id, fetchCards])

  // Fetch available years when player changes
  useEffect(() => {
    if (!player?.player_id) return

    const fetchYears = async () => {
      try {
        // Fetch a sample of cards to get available years
        const response = await axios.get('/api/cards', {
          params: {
            player_id: player.player_id,
            limit: 500 // Get enough to capture year range
          }
        })

        if (response.data?.cards) {
          const years = [...new Set(response.data.cards
            .map(c => c.set_rel?.year)
            .filter(Boolean)
          )].sort((a, b) => b - a)

          setAvailableYears(years)
        }
      } catch (error) {
        console.error('Error fetching years:', error)
      }
    }

    fetchYears()
  }, [player?.player_id])

  // Debounced filter change handler
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setPage(1)
      // fetchCards will be called by the useEffect when filters change
    }, 300)
  }

  // Clear filters
  const clearFilters = () => {
    setFilters({
      cardNumber: '',
      year: '',
      search: ''
    })
  }

  const hasActiveFilters = filters.cardNumber || filters.year || filters.search

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          fetchCards(page + 1, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, isLoading, page, fetchCards])

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  if (!player) return null

  return (
    <div className="card-browser-grid">
      <div className="card-browser-header">
        <h3 className="card-browser-step-label">Step 2: Find your card</h3>
        <p className="card-browser-count">
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              Showing <strong>{cards.length.toLocaleString()}</strong>
              {total > cards.length && ` of ${total.toLocaleString()}`}
              {' cards for '}
              <strong>{player.first_name} {player.last_name}</strong>
            </>
          )}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card-browser-filters">
        <div className="card-browser-filter-group">
          <div className="card-browser-filter card-browser-filter-number">
            <label htmlFor="filter-card-number">Card #</label>
            <input
              id="filter-card-number"
              type="text"
              placeholder="e.g., 150"
              value={filters.cardNumber}
              onChange={(e) => handleFilterChange('cardNumber', e.target.value)}
            />
          </div>

          <div className="card-browser-filter card-browser-filter-year">
            <label htmlFor="filter-year">Year</label>
            <select
              id="filter-year"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="card-browser-filter card-browser-filter-search">
            <label htmlFor="filter-search">Set / Color</label>
            <input
              id="filter-search"
              type="text"
              placeholder='e.g., "Prizm", "Gold", "Topps"'
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="card-browser-clear-filters"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="card-browser-loading">
          <div className="card-browser-spinner"></div>
          <p>Loading cards...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="card-browser-empty">
          {hasActiveFilters ? (
            <>
              <p>No cards match your filters</p>
              <button
                type="button"
                className="card-browser-try-again-btn"
                onClick={clearFilters}
              >
                Clear filters and show all
              </button>
            </>
          ) : (
            <>
              <p>No cards found for this player</p>
              <p className="card-browser-empty-hint">
                This player may not have any cards in our database yet.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="card-browser-grid-container">
            {cards.map(card => (
              <CardPreviewTile
                key={card.card_id}
                card={card}
                onAddClick={onAddClick}
              />
            ))}
          </div>

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="card-browser-load-more">
            {isLoadingMore && (
              <div className="card-browser-loading-more">
                <div className="card-browser-spinner-small"></div>
                <span>Loading more cards...</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Can't Find Card */}
      <div className="card-browser-cant-find">
        <div className="card-browser-cant-find-divider">
          <span>Can't find your card?</span>
        </div>
        <button
          type="button"
          className="card-browser-submit-new-btn"
          onClick={onCantFind}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
          Submit New Card
        </button>
        <p className="card-browser-submit-hint">
          If your card isn't in our database, submit it and we'll add it.
        </p>
      </div>
    </div>
  )
}
