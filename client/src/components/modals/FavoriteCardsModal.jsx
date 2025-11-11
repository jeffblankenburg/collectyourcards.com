import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './FavoriteCardsModal.css'

function FavoriteCardsModal({ isOpen, onClose, onUpdate }) {
  const { showToast } = useToast()
  const [favoriteCards, setFavoriteCards] = useState([])
  const [collectionCards, setCollectionCards] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const positions = [1, 2, 3, 4, 5]

  useEffect(() => {
    if (isOpen) {
      fetchFavoriteCards()
      fetchCollectionCards(true)
    }
  }, [isOpen])

  const fetchFavoriteCards = async () => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }

      const response = await axios.get('/api/profile/favorite-cards', config)
      setFavoriteCards(response.data.favorite_cards || [])
    } catch (error) {
      console.error('Error fetching favorite cards:', error)
      showToast('Failed to load favorite cards', 'error')
    }
  }

  const fetchCollectionCards = async (reset = false) => {
    try {
      setLoading(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }

      const searchParams = new URLSearchParams({
        limit: 50,
        offset: reset ? 0 : offset
      })

      if (searchTerm) {
        searchParams.append('search', searchTerm)
      }

      const response = await axios.get(`/api/profile/collection-cards?${searchParams}`, config)
      
      if (reset) {
        setCollectionCards(response.data.cards || [])
        setOffset(50)
      } else {
        setCollectionCards(prev => [...prev, ...(response.data.cards || [])])
        setOffset(prev => prev + 50)
      }
      
      setHasMore(response.data.has_more)
    } catch (error) {
      console.error('Error fetching collection cards:', error)
      showToast('Failed to load collection cards', 'error')
    } finally {
      setLoading(false)
    }
  }

  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term)
      setOffset(0)
      fetchCollectionCards(true)
    }, 500),
    []
  )

  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  const addToFavorites = async (userCardId, position) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }

      await axios.post('/api/profile/favorite-cards', {
        user_card_id: userCardId,
        sort_order: position
      }, config)

      showToast('Card added to favorites!', 'success')
      await fetchFavoriteCards()
      await fetchCollectionCards(true)
      onUpdate()
    } catch (error) {
      console.error('Error adding favorite card:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add favorite card'
      showToast(errorMessage, 'error')
    }
  }

  const removeFromFavorites = async (favoriteId) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }

      await axios.delete(`/api/profile/favorite-cards/${favoriteId}`, config)

      showToast('Card removed from favorites', 'success')
      await fetchFavoriteCards()
      await fetchCollectionCards(true)
      onUpdate()
    } catch (error) {
      console.error('Error removing favorite card:', error)
      showToast('Failed to remove favorite card', 'error')
    }
  }

  const getPositionCard = (position) => {
    return favoriteCards.find(card => card.sort_order === position)
  }

  const formatCardName = (card) => {
    const parts = []
    if (card.set_year) parts.push(card.set_year)
    if (card.set_name) parts.push(card.set_name)
    if (card.series_name && card.series_name !== card.set_name) parts.push(card.series_name)
    if (card.player_name) parts.push(card.player_name)
    if (card.card_number) parts.push(`#${card.card_number}`)
    
    return parts.join(' - ')
  }

  if (!isOpen) return null

  return (
    <div className="favorite-cards-modal-overlay" onClick={onClose}>
      <div className="favorite-cards-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Icon name="star" size={20} />
            <h2>Manage Favorite Cards</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <Icon name="x" size={24} />
          </button>
        </div>

        <div className="modal-content">
          {/* Favorite Positions */}
          <div className="favorites-section">
            <h3>Your Favorite Cards (5 slots)</h3>
            <div className="favorite-positions">
              {positions.map(position => {
                const card = getPositionCard(position)
                return (
                  <div key={position} className={`favorite-position ${card ? 'filled' : 'empty'}`}>
                    <div className="position-number">{position}</div>
                    {card ? (
                      <div className="favorite-card">
                        {card.primary_photo && (
                          <img src={card.primary_photo} alt="Card" className="card-image" />
                        )}
                        <div className="card-info">
                          <div className="card-name">{formatCardName(card)}</div>
                          {card.grade && (
                            <div className="card-grade">Grade: {card.grade}</div>
                          )}
                          {(card.is_rookie || card.is_autograph || card.is_relic || card.is_short_print) && (
                            <div className="card-attributes">
                              {card.is_rookie && <span className="attribute rookie">RC</span>}
                              {card.is_autograph && <span className="attribute auto">AUTO</span>}
                              {card.is_relic && <span className="attribute relic">RELIC</span>}
                              {card.is_short_print && <span className="attribute sp">SP</span>}
                            </div>
                          )}
                        </div>
                        <button
                          className="remove-button"
                          onClick={() => removeFromFavorites(card.favorite_id)}
                          title="Remove from favorites"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="empty-position">
                        <Icon name="plus" size={24} />
                        <span>Empty Slot</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Collection Search */}
          <div className="collection-section">
            <h3>Select from Your Collection</h3>
            <div className="search-wrapper">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search your cards..."
                onChange={(e) => debouncedSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="collection-grid">
              {collectionCards.map(card => (
                <div key={card.user_card_id} className={`collection-card ${card.is_favorite ? 'favorited' : ''}`}>
                  {card.primary_photo && (
                    <img src={card.primary_photo} alt="Card" className="card-image" />
                  )}
                  <div className="card-info">
                    <div className="card-name">{formatCardName(card)}</div>
                    {(card.is_rookie || card.is_autograph || card.is_relic || card.is_short_print) && (
                      <div className="card-attributes">
                        {card.is_rookie && <span className="attribute rookie">RC</span>}
                        {card.is_autograph && <span className="attribute auto">AUTO</span>}
                        {card.is_relic && <span className="attribute relic">RELIC</span>}
                        {card.is_short_print && <span className="attribute sp">SP</span>}
                      </div>
                    )}
                  </div>
                  {!card.is_favorite && favoriteCards.length < 5 && (
                    <div className="position-buttons">
                      {positions.filter(pos => !getPositionCard(pos)).map(position => (
                        <button
                          key={position}
                          className="position-button"
                          onClick={() => addToFavorites(card.user_card_id, position)}
                          title={`Add to position ${position}`}
                        >
                          {position}
                        </button>
                      ))}
                    </div>
                  )}
                  {card.is_favorite && (
                    <div className="already-favorited">
                      <Icon name="star" size={14} />
                      <span>Favorited</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="load-more">
                <button
                  onClick={() => fetchCollectionCards()}
                  disabled={loading}
                  className="load-more-button"
                >
                  {loading ? (
                    <>
                      <div className="card-icon-spinner small"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Cards'
                  )}
                </button>
              </div>
            )}

            {collectionCards.length === 0 && !loading && (
              <div className="no-results">
                <Icon name="inbox" size={48} />
                <p>No cards found in your collection</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FavoriteCardsModal