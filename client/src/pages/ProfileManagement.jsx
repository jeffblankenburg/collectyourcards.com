import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import FavoriteCardsModal from '../components/modals/FavoriteCardsModal'
import './ProfileManagementScoped.css'

function ProfileManagement() {
  const { isAuthenticated, user } = useAuth()
  const { showToast } = useToast()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingUsername, setSavingUsername] = useState(false)
  const [formData, setFormData] = useState({
    bio: '',
    website: '',
    location: '',
    is_public_profile: true
  })
  const [usernameData, setUsernameData] = useState({
    current_username: '',
    new_username: ''
  })
  const [usernameStatus, setUsernameStatus] = useState('') // 'checking', 'available', 'taken', 'invalid'
  const [usernameMessage, setUsernameMessage] = useState('')
  const [favoriteCards, setFavoriteCards] = useState([])
  const [showFavoriteCardsModal, setShowFavoriteCardsModal] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile()
      fetchFavoriteCards()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || '',
        website: profile.website || '',
        location: profile.location || '',
        is_public_profile: profile.is_public_profile !== false
      })
      setUsernameData({
        current_username: profile.username || '',
        new_username: profile.username || ''
      })
    }
  }, [profile])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      const response = await axios.get('/api/profile', config)
      setProfile(response.data.profile)
    } catch (err) {
      console.error('Error fetching profile:', err)
      showToast('Failed to load profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchFavoriteCards = async () => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      const response = await axios.get('/api/profile/favorite-cards', config)
      setFavoriteCards(response.data.favorite_cards || [])
    } catch (err) {
      console.error('Error fetching favorite cards:', err)
      // Don't show error toast here, as this is secondary data
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleUsernameChange = (e) => {
    const { value } = e.target
    setUsernameData(prev => ({
      ...prev,
      new_username: value
    }))

    // Check availability if username has changed and meets minimum requirements
    if (value !== usernameData.current_username && value.length >= 3) {
      checkUsernameAvailability(value)
    } else if (value === usernameData.current_username) {
      setUsernameStatus('')
      setUsernameMessage('')
    } else if (value.length < 3 && value.length > 0) {
      setUsernameStatus('invalid')
      setUsernameMessage('Username must be at least 3 characters')
    } else {
      setUsernameStatus('')
      setUsernameMessage('')
    }
  }

  // Debounced username availability check (same as registration)
  const checkUsernameAvailability = useCallback(
    debounce(async (username) => {
      if (!username || username.length < 3) {
        setUsernameStatus('')
        setUsernameMessage('')
        return
      }

      // Validate username format
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
        setUsernameStatus('invalid')
        setUsernameMessage('Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or dashes')
        return
      }

      // Skip checking if it's the same as current username
      if (username.toLowerCase() === usernameData.current_username.toLowerCase()) {
        setUsernameStatus('')
        setUsernameMessage('')
        return
      }

      setUsernameStatus('checking')
      setUsernameMessage('Checking availability...')

      try {
        const config = {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
        
        const response = await axios.get(`/api/profile/check-username/${username}`, config)
        if (response.data.available) {
          setUsernameStatus('available')
          setUsernameMessage('Username is available!')
        } else {
          setUsernameStatus('taken')
          setUsernameMessage('Username is already taken')
        }
      } catch (error) {
        if (error.response?.status === 400) {
          setUsernameStatus('invalid')
          setUsernameMessage(error.response.data.error || 'Invalid username')
        } else {
          setUsernameStatus('')
          setUsernameMessage('')
        }
      }
    }, 500),
    [usernameData.current_username]
  )

  // Simple debounce function
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.put('/api/profile/update', formData, config)
      
      showToast('Profile updated successfully!', 'success')
      fetchProfile() // Refresh profile data
      
    } catch (err) {
      console.error('Error updating profile:', err)
      const errorMessage = err.response?.data?.error || 'Failed to update profile'
      showToast(errorMessage, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUsernameUpdate = async () => {
    if (usernameData.new_username === usernameData.current_username) {
      showToast('Username is already up to date', 'info')
      return
    }

    if (usernameStatus !== 'available') {
      showToast('Please choose a valid, available username', 'error')
      return
    }

    try {
      setSavingUsername(true)
      
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.put('/api/profile/update-username', 
        { username: usernameData.new_username }, 
        config
      )
      
      showToast('Username updated successfully!', 'success')
      
      // Update local state
      setUsernameData(prev => ({
        ...prev,
        current_username: usernameData.new_username
      }))
      
      // Clear status
      setUsernameStatus('')
      setUsernameMessage('')
      
      // Refresh profile data
      fetchProfile()
      
    } catch (err) {
      console.error('Error updating username:', err)
      const errorMessage = err.response?.data?.error || 'Failed to update username'
      showToast(errorMessage, 'error')
    } finally {
      setSavingUsername(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-management-page">
        <div className="auth-required">
          <Icon name="user" size={48} />
          <h2>Sign In Required</h2>
          <p>Please sign in to manage your profile.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="profile-management-page">
        <div className="loading-container">
          <Icon name="activity" size={32} className="spinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-management-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>
            <Icon name="user" size={24} />
            Profile Settings
          </h1>
          <p>Manage your public profile and account preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="username"
                  value={usernameData.new_username}
                  onChange={handleUsernameChange}
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9._-]{3,30}"
                  className="form-input"
                  placeholder="Choose your unique username"
                />
                {usernameStatus && (
                  <div className={`username-status ${usernameStatus}`}>
                    {usernameStatus === 'checking' && <Icon name="activity" size={16} className="spinner" />}
                    {usernameStatus === 'available' && <Icon name="check" size={16} />}
                    {usernameStatus === 'taken' && <Icon name="x" size={16} />}
                    {usernameStatus === 'invalid' && <Icon name="alert-circle" size={16} />}
                    <span className="status-text">{usernameMessage}</span>
                  </div>
                )}
                {usernameData.new_username !== usernameData.current_username && usernameStatus === 'available' && (
                  <div className="username-actions">
                    <button
                      type="button"
                      onClick={handleUsernameUpdate}
                      disabled={savingUsername}
                      className="update-username-btn"
                    >
                      {savingUsername ? (
                        <>
                          <Icon name="activity" size={14} className="spinner" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={14} />
                          Update Username
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <small className="form-help">Username must be unique and 3-30 characters</small>
            </div>


            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                maxLength={500}
                rows={4}
                className="form-textarea"
                placeholder="Tell other collectors about yourself..."
              />
              <small className="form-help">{formData.bio.length}/500 characters</small>
            </div>
          </div>

          <div className="form-section">
            <h3>Contact & Location</h3>
            
            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                maxLength={255}
                className="form-input"
                placeholder="https://your-website.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                maxLength={100}
                className="form-input"
                placeholder="City, State/Country"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Privacy Settings</h3>
            
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_public_profile"
                  checked={formData.is_public_profile}
                  onChange={handleInputChange}
                  className="form-checkbox"
                />
                <span className="checkbox-text">
                  <strong>Public Profile</strong>
                  <br />
                  Allow other users to view your profile and collection stats
                </span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>
              <Icon name="star" size={20} />
              Favorite Cards
            </h3>
            <p className="section-description">
              Showcase up to 5 of your favorite cards on your public profile. These will be displayed prominently when other collectors visit your profile.
            </p>
            
            <div className="favorite-cards-preview">
              {favoriteCards.length > 0 ? (
                <div className="favorite-cards-grid">
                  {[1, 2, 3, 4, 5].map(position => {
                    const card = favoriteCards.find(c => c.sort_order === position)
                    return (
                      <div key={position} className={`favorite-slot ${card ? 'filled' : 'empty'}`}>
                        <div className="slot-number">{position}</div>
                        {card ? (
                          <div className="favorite-card-preview">
                            {card.primary_photo && (
                              <img src={card.primary_photo} alt="Card" className="card-image" />
                            )}
                            <div className="card-info">
                              <div className="card-name">
                                {card.set_year && `${card.set_year} `}
                                {card.set_name}
                                {card.card_number && ` #${card.card_number}`}
                              </div>
                              {(card.is_rookie || card.is_autograph || card.is_relic) && (
                                <div className="card-attributes">
                                  {card.is_rookie && <span className="attribute rookie">RC</span>}
                                  {card.is_autograph && <span className="attribute auto">AUTO</span>}
                                  {card.is_relic && <span className="attribute relic">RELIC</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="empty-slot">
                            <Icon name="plus" size={16} />
                            <span>Empty</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="no-favorites">
                  <Icon name="star" size={32} />
                  <p>No favorite cards selected</p>
                  <span>Choose up to 5 cards from your collection to showcase</span>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setShowFavoriteCardsModal(true)}
                className="manage-favorites-btn"
              >
                <Icon name="star" size={16} />
                {favoriteCards.length > 0 ? 'Manage Favorite Cards' : 'Add Favorite Cards'}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={saving}
              className="save-btn"
            >
              {saving ? (
                <>
                  <Icon name="activity" size={16} className="spinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  Save Changes
                </>
              )}
            </button>
            
            {profile?.username && (
              <a
                href={`/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="view-profile-btn"
              >
                <Icon name="external-link" size={16} />
                View Public Profile
              </a>
            )}
          </div>
        </form>
        
        <FavoriteCardsModal
          isOpen={showFavoriteCardsModal}
          onClose={() => setShowFavoriteCardsModal(false)}
          onUpdate={fetchFavoriteCards}
        />
      </div>
    </div>
  )
}

export default ProfileManagement