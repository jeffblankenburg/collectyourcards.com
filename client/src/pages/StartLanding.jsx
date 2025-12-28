/**
 * StartLanding - Landing page for QR code marketing campaign
 * Supports card-specific QR codes: /start/:cardId (single or comma-separated)
 *
 * Flow:
 * - If logged in: Show AddCardModal for each card sequentially
 * - If not logged in: Show card details + signup/login options
 * - After signup/login: Auto-open AddCardModal
 */

import React, { useState, useEffect } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import AddCardModal from '../components/modals/AddCardModal'
import '../styles/components.css'
import '../components/cards/CardCard.css'
import './StartLandingScoped.css'

function StartLanding() {
  const { cardId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, user, login, register } = useAuth()
  const { success, error: showError } = useToast()

  // Card data - now supports multiple cards
  const [cards, setCards] = useState([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [loadingCards, setLoadingCards] = useState(true)
  const [cardError, setCardError] = useState(null)

  // Modal state
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [addedCardIds, setAddedCardIds] = useState(new Set())

  // Auth form state
  const [authMode, setAuthMode] = useState('signup') // 'signup' or 'login'
  const [authLoading, setAuthLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  })
  const [formErrors, setFormErrors] = useState({})

  // Campaign tracking
  const [sessionId, setSessionId] = useState(null)
  const campaignCode = searchParams.get('c') || searchParams.get('campaign') || `card-${cardId || 'general'}`

  // Get current card for display
  const currentCard = cards[currentCardIndex] || null

  // Parse card IDs from URL (supports comma-separated)
  const cardIds = cardId ? cardId.split(',').map(id => id.trim()).filter(id => id) : []
  const isMultipleCards = cardIds.length > 1

  // Track visit on component mount
  useEffect(() => {
    const trackVisit = async () => {
      const existingSessionId = sessionStorage.getItem('campaign_session_id')
      if (existingSessionId) {
        setSessionId(existingSessionId)
        return
      }

      try {
        const response = await axios.post('/api/campaign/visit', {
          campaign_code: campaignCode
        })

        if (response.data.success && response.data.session_id) {
          sessionStorage.setItem('campaign_session_id', response.data.session_id)
          sessionStorage.setItem('campaign_code', campaignCode)
          setSessionId(response.data.session_id)
        }
      } catch (err) {
        console.error('Failed to track campaign visit:', err)
      }
    }

    trackVisit()
  }, [campaignCode])

  // Fetch card details
  useEffect(() => {
    const fetchCards = async () => {
      if (!cardId || cardIds.length === 0) {
        setLoadingCards(false)
        return
      }

      try {
        setLoadingCards(true)

        let fetchedCards = []

        // Always use the multi-card endpoint - it handles both single and multiple cards,
        // and supports the price format (e.g., "529664-19.98")
        const response = await axios.get(`/api/campaign/cards/${cardId}`)
        if (response.data.success && response.data.cards) {
          fetchedCards = response.data.cards
        }

        if (fetchedCards.length > 0) {
          setCards(fetchedCards)
          document.title = fetchedCards.length === 1
            ? `${fetchedCards[0].player_names || 'Card'} - Collect Your Cards`
            : `${fetchedCards.length} Cards - Collect Your Cards`
        } else {
          setCardError('No cards found')
        }
      } catch (err) {
        console.error('Failed to fetch cards:', err)
        setCardError(err.response?.data?.message || 'Cards not found')
      } finally {
        setLoadingCards(false)
      }
    }

    fetchCards()
  }, [cardId])

  // If user is authenticated, show the AddCardModal immediately
  useEffect(() => {
    if (isAuthenticated && cards.length > 0 && !showAddCardModal) {
      setShowAddCardModal(true)
    }
  }, [isAuthenticated, cards])

  // Navigate to previous card in stack
  const goToPrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1)
    }
  }

  // Navigate to next card in stack
  const goToNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
    }
  }

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  // Validate form
  const validateForm = () => {
    const errors = {}

    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (authMode === 'signup') {
      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password'
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }

      if (!formData.first_name) {
        errors.first_name = 'First name is required'
      }

      if (!formData.last_name) {
        errors.last_name = 'Last name is required'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setAuthLoading(true)

    try {
      if (authMode === 'signup') {
        const result = await register({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name
        })

        if (result.success) {
          success('Account created! Please check your email to verify your account.')
          setAuthMode('login')
        } else {
          showError(result.error || 'Registration failed')
        }
      } else {
        const result = await login(formData.email, formData.password)

        if (result.success) {
          success('Welcome back!')
          // The useEffect will show the AddCardModal
        } else {
          showError(result.error || 'Login failed')
        }
      }
    } catch (err) {
      showError('An error occurred. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // Handle card added from modal
  const handleCardAdded = () => {
    // Track which card was added
    const addedCard = cards[currentCardIndex]
    if (addedCard) {
      setAddedCardIds(prev => new Set([...prev, addedCard.card_id]))
    }

    // Check if there are more cards to add
    const remainingCards = cards.filter((c, idx) => idx > currentCardIndex || !addedCardIds.has(c.card_id))

    if (currentCardIndex < cards.length - 1) {
      // Move to next card
      success(`Card added! (${currentCardIndex + 1} of ${cards.length})`)
      setCurrentCardIndex(currentCardIndex + 1)
      // Keep modal open for next card
    } else {
      // All cards added
      setShowAddCardModal(false)
      success(cards.length > 1
        ? `All ${cards.length} cards added to your collection!`
        : 'Card added to your collection!')
      setTimeout(() => {
        navigate('/collection')
      }, 1500)
    }
  }

  // Handle modal close
  const handleModalClose = () => {
    setShowAddCardModal(false)
    if (isAuthenticated) {
      if (addedCardIds.size > 0) {
        success(`${addedCardIds.size} card${addedCardIds.size > 1 ? 's' : ''} added to your collection!`)
      }
      navigate('/collection')
    }
  }

  // If no card ID, show generic landing
  if (!cardId) {
    return (
      <div className="start-landing-page">
        <section className="start-landing-hero">
          <div className="start-landing-hero-content">
            <h1>Welcome to Collect Your Cards</h1>
            <p className="start-landing-hero-subtitle">
              The free, powerful way to organize and track your sports card collection
            </p>
            <div className="start-landing-cta-section">
              <Link to="/auth/signup" className="start-landing-cta-button primary">
                <Icon name="user-plus" size={20} />
                Create Your Free Account
              </Link>
              <p className="start-landing-cta-note">No credit card required. Always free.</p>
            </div>
          </div>
        </section>

        <section className="start-landing-features">
          <h2>Everything You Need to Manage Your Collection</h2>
          <div className="start-landing-feature-grid">
            {[
              { icon: 'search', title: 'Find Any Card', description: 'Search over 800,000 cards by player, team, set, or card number' },
              { icon: 'layers', title: 'Track Your Collection', description: "Know exactly what you own and what you're missing" },
              { icon: 'map-pin', title: 'Locate Your Cards', description: 'Assign physical locations so you can find any card instantly' },
              { icon: 'list', title: 'Build Custom Lists', description: 'Create wishlists, trade lists, or track any set you want to complete' },
              { icon: 'share-2', title: 'Share With Others', description: 'Share your collection or lists with friends and fellow collectors' }
            ].map((feature, idx) => (
              <div key={idx} className="start-landing-feature-card">
                <div className="start-landing-feature-icon">
                  <Icon name={feature.icon} size={28} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  // Loading state
  if (loadingCards) {
    return (
      <div className="start-landing-page">
        <div className="start-landing-loading">
          <div className="start-landing-spinner"></div>
          <p>Loading your card{cardIds.length > 1 ? 's' : ''}...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (cardError || cards.length === 0) {
    return (
      <div className="start-landing-page">
        <div className="start-landing-error">
          <Icon name="alert-circle" size={48} />
          <h2>Card{cardIds.length > 1 ? 's' : ''} Not Found</h2>
          <p>{cardError || 'The requested cards could not be found.'}</p>
          <Link to="/" className="start-landing-cta-button primary">
            <Icon name="home" size={18} />
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  // Card-specific landing page
  return (
    <div className="start-landing-page start-landing-card-view">
      {/* Card Display Section */}
      <section className="start-landing-card-hero">
        <div className="start-landing-card-content">
          {/* Card Stack with Navigation */}
          <div className="start-landing-card-stack-container">
            {/* Card Stack */}
            <div className="start-landing-card-stack">
              {cards.map((card, idx) => {
                // Calculate position relative to current card
                const offset = idx - currentCardIndex
                const isVisible = Math.abs(offset) <= 2 // Only render nearby cards

                if (!isVisible) return null

                // Calculate visual properties based on offset
                const absOffset = Math.abs(offset)
                const translateX = offset * 25 // pixels to shift
                const scale = 1 - (absOffset * 0.05)
                const opacity = 1 - (absOffset * 0.3)
                const brightness = 1 - (absOffset * 0.15)

                return (
                  <div
                    key={card.card_id}
                    className={`start-landing-stacked-card ${offset === 0 ? 'active' : ''}`}
                    style={{
                      transform: offset === 0 ? undefined : `translateX(${translateX}px) scale(${scale})`,
                      opacity: offset === 0 ? undefined : opacity,
                      filter: offset === 0 ? undefined : `brightness(${brightness})`,
                      zIndex: cards.length - absOffset
                    }}
                    onClick={() => offset !== 0 && setCurrentCardIndex(idx)}
                  >
                    {card.front_image_url ? (
                      <img
                        src={card.front_image_url}
                        alt={`${card.player_names} ${card.card_number}`}
                        className="start-landing-card-image"
                      />
                    ) : (
                      <div className="start-landing-card-placeholder">
                        <Icon name="image" size={48} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Navigation Controls - only show for multiple cards */}
            {isMultipleCards && (
              <div className="start-landing-stack-controls">
                <button
                  className={`start-landing-stack-nav ${currentCardIndex === 0 ? 'disabled' : ''}`}
                  onClick={goToPrevCard}
                  disabled={currentCardIndex === 0}
                  aria-label="Previous card"
                >
                  <Icon name="chevron-left" size={20} />
                </button>

                <div className="start-landing-card-counter">
                  {currentCardIndex + 1} of {cards.length}
                </div>

                <button
                  className={`start-landing-stack-nav ${currentCardIndex === cards.length - 1 ? 'disabled' : ''}`}
                  onClick={goToNextCard}
                  disabled={currentCardIndex === cards.length - 1}
                  aria-label="Next card"
                >
                  <Icon name="chevron-right" size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Card Details - for current card */}
          {currentCard && (
            <div className="start-landing-card-details">
              {/* Player names with team circles */}
              <div className="start-landing-players-section">
                {currentCard.player_teams && currentCard.player_teams.length > 0 ? (
                  currentCard.player_teams.map((pt, idx) => (
                    <div key={idx} className="start-landing-player-row">
                      {pt.team && pt.team.team_id && (
                        <Link
                          to={`/teams/${pt.team.team_id}`}
                          className="team-circle-base team-circle-lg team-circle-clickable"
                          style={{
                            background: pt.team.primary_color || '#374151',
                            borderColor: pt.team.secondary_color || '#fff'
                          }}
                          title={pt.team.name}
                        >
                          {pt.team.abbreviation || ''}
                        </Link>
                      )}
                      <Link
                        to={`/players/${pt.player_id}`}
                        className="start-landing-player-link"
                      >
                        {pt.full_name}
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="start-landing-player-row">
                    <span className="start-landing-player-link">{currentCard.player_names}</span>
                  </div>
                )}
              </div>

              {/* Card metadata - 2x2 grid */}
              <div className="start-landing-card-meta">
                {/* Row 1: Card Number and Series */}
                <div className="start-landing-card-number-row">
                  <span className="start-landing-label">Card</span>
                  <Link to={`/cards/${currentCard.card_id}`} className="start-landing-value start-landing-link">
                    {currentCard.card_number}
                  </Link>
                </div>
                <div className="start-landing-card-series">
                  <span className="start-landing-label">Series</span>
                  <Link to={`/series/${currentCard.series_id}`} className="start-landing-value start-landing-link">
                    {currentCard.series_name}
                  </Link>
                </div>
                {/* Row 2: Set and Manufacturer */}
                <div className="start-landing-card-set">
                  <span className="start-landing-label">Set</span>
                  <Link to={`/sets/${currentCard.set_year}/${currentCard.set_id}`} className="start-landing-value start-landing-link">
                    {currentCard.set_name}
                  </Link>
                </div>
                {currentCard.manufacturer_name && (
                  <div className="start-landing-card-manufacturer">
                    <span className="start-landing-label">Manufacturer</span>
                    <span className="start-landing-value">{currentCard.manufacturer_name}</span>
                  </div>
                )}
              </div>

              {/* Card Attributes - using design system tags */}
              <div className="start-landing-card-tags">
                {currentCard.is_rookie && (
                  <span className="cardcard-tag cardcard-rc">RC</span>
                )}
                {currentCard.is_autograph && (
                  <span className="cardcard-tag cardcard-insert">AUTO</span>
                )}
                {currentCard.is_relic && (
                  <span className="cardcard-tag cardcard-relic">RELIC</span>
                )}
                {currentCard.is_parallel && currentCard.color_name && (
                  <span
                    className="cardcard-tag"
                    style={{
                      backgroundColor: currentCard.color_hex || '#6b7280',
                      color: '#fff',
                      borderColor: 'transparent'
                    }}
                  >
                    {currentCard.color_name}
                  </span>
                )}
                {currentCard.print_run && (
                  <span className="cardcard-tag" style={{ background: 'rgba(255,255,255,0.1)', color: '#e5e7eb' }}>
                    /{currentCard.print_run.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Purchase Price - shown if provided in URL */}
              {currentCard.purchase_price != null && (
                <div className="start-landing-purchase-price">
                  <Icon name="dollar-sign" size={16} />
                  <span className="start-landing-price-label">Your Price:</span>
                  <span className="start-landing-price-value">${currentCard.purchase_price.toFixed(2)}</span>
                </div>
              )}

              {/* Community Stats */}
              {currentCard.community_stats && (
                <div className="start-landing-community-stats">
                  <h4>Community Stats</h4>
                  <div className="start-landing-stats-grid">
                    <div className="start-landing-stat">
                      <span className="start-landing-stat-value">{currentCard.community_stats.collectors}</span>
                      <span className="start-landing-stat-label">Collectors</span>
                    </div>
                    <div className="start-landing-stat">
                      <span className="start-landing-stat-value">{currentCard.community_stats.total_copies}</span>
                      <span className="start-landing-stat-label">Total Copies</span>
                    </div>
                    <div className="start-landing-stat">
                      <span className="start-landing-stat-value">{currentCard.community_stats.collector_percentage}%</span>
                      <span className="start-landing-stat-label">of Users Own</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Auth Section - Only show if not logged in */}
      {!isAuthenticated && (
        <section className="start-landing-auth-section">
          <div className="start-landing-auth-container">
            <div className="start-landing-auth-header">
              <h2>Add {cards.length > 1 ? 'These Cards' : 'This Card'} to Your Collection</h2>
              <p>Create a free account to start tracking your cards</p>
            </div>

            {/* Auth Mode Toggle */}
            <div className="start-landing-auth-toggle">
              <button
                className={`start-landing-toggle-btn ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => setAuthMode('signup')}
              >
                Create Account
              </button>
              <button
                className={`start-landing-toggle-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Sign In
              </button>
            </div>

            {/* Auth Form */}
            <form className="start-landing-auth-form" onSubmit={handleSubmit}>
              {authMode === 'signup' && (
                <div className="start-landing-form-row">
                  <div className="start-landing-form-group">
                    <label htmlFor="first_name">First Name</label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className={formErrors.first_name ? 'error' : ''}
                    />
                    {formErrors.first_name && <span className="start-landing-error-text">{formErrors.first_name}</span>}
                  </div>
                  <div className="start-landing-form-group">
                    <label htmlFor="last_name">Last Name</label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className={formErrors.last_name ? 'error' : ''}
                    />
                    {formErrors.last_name && <span className="start-landing-error-text">{formErrors.last_name}</span>}
                  </div>
                </div>
              )}

              <div className="start-landing-form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className={formErrors.email ? 'error' : ''}
                />
                {formErrors.email && <span className="start-landing-error-text">{formErrors.email}</span>}
              </div>

              <div className="start-landing-form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  className={formErrors.password ? 'error' : ''}
                />
                {formErrors.password && <span className="start-landing-error-text">{formErrors.password}</span>}
              </div>

              {authMode === 'signup' && (
                <div className="start-landing-form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    className={formErrors.confirmPassword ? 'error' : ''}
                  />
                  {formErrors.confirmPassword && <span className="start-landing-error-text">{formErrors.confirmPassword}</span>}
                </div>
              )}

              <button
                type="submit"
                className="start-landing-submit-btn"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <div className="start-landing-btn-spinner"></div>
                    {authMode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  <>
                    <Icon name={authMode === 'signup' ? 'user-plus' : 'log-in'} size={18} />
                    {authMode === 'signup'
                      ? `Create Account & Add ${cards.length > 1 ? 'Cards' : 'Card'}`
                      : `Sign In & Add ${cards.length > 1 ? 'Cards' : 'Card'}`}
                  </>
                )}
              </button>
            </form>

            {authMode === 'login' && (
              <div className="start-landing-forgot">
                <Link to="/auth/forgot-password">Forgot your password?</Link>
              </div>
            )}
          </div>

          {/* Benefits Section */}
          <div className="start-landing-benefits">
            <h3>Why Track Your Collection?</h3>
            <ul>
              <li>
                <Icon name="check-circle" size={18} />
                <span>Know exactly what cards you own</span>
              </li>
              <li>
                <Icon name="check-circle" size={18} />
                <span>Track purchase prices and current values</span>
              </li>
              <li>
                <Icon name="check-circle" size={18} />
                <span>Never buy duplicates by accident</span>
              </li>
              <li>
                <Icon name="check-circle" size={18} />
                <span>Share your collection with other collectors</span>
              </li>
              <li>
                <Icon name="check-circle" size={18} />
                <span>Store physical location of every card</span>
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={showAddCardModal}
        onClose={handleModalClose}
        card={currentCard}
        onCardAdded={handleCardAdded}
      />
    </div>
  )
}

export default StartLanding
