import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './PublicProfileScoped.css'

function PublicProfile() {
  const { username } = useParams()
  const { isAuthenticated, user } = useAuth()
  
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [favoriteCards, setFavoriteCards] = useState([])
  const [achievements, setAchievements] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [username])

  useEffect(() => {
    if (profile) {
      document.title = `${profile.display_name || profile.username} (@${profile.username}) - Collect Your Cards`
    }
  }, [profile])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const config = {}
      if (isAuthenticated) {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers = { 'Authorization': `Bearer ${token}` }
        }
      }

      const response = await axios.get(`/api/profile/user/${username}`, config)
      setProfile(response.data.profile)
      setStats(response.data.stats)
      setRecentActivity(response.data.recent_activity || [])
      setFavoriteCards(response.data.favorite_cards || [])
      setAchievements(response.data.achievements || null)
    } catch (err) {
      console.error('Error fetching profile:', err)
      if (err.response?.status === 404) {
        setError('User not found')
      } else if (err.response?.status === 403) {
        setError('This profile is private')
      } else {
        setError('Failed to load profile')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatJoinDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  const formatActivityDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="public-profile-page">
        <div className="loading-container">
          <Icon name="activity" size={32} className="spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-profile-page">
        <div className="error-container">
          <Icon name="user" size={48} />
          <h2>{error}</h2>
          {error === 'User not found' && (
            <p>The user @{username} doesn't exist or has been deactivated.</p>
          )}
          {error === 'This profile is private' && (
            <p>This user has chosen to keep their profile private.</p>
          )}
          <Link to="/" className="back-home-btn">
            <Icon name="home" size={16} />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="public-profile-page">
        <div className="error-container">
          <Icon name="user" size={48} />
          <h2>Profile not available</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="public-profile-page">
      <div className="profile-container">
        
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-info">
            <div className="profile-avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={`${profile.username}'s avatar`} />
              ) : (
                <Icon name="user" size={48} />
              )}
            </div>
            
            <div className="profile-details">
              <h1 className="profile-name">
                {profile.display_name || profile.username}
              </h1>
              <p className="profile-username">@{profile.username}</p>
              
              {profile.bio && (
                <p className="profile-bio">{profile.bio}</p>
              )}
              
              <div className="profile-meta">
                {profile.location && (
                  <span className="profile-location">
                    <Icon name="map" size={14} />
                    {profile.location}
                  </span>
                )}
                
                {profile.website && (
                  <a 
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="profile-website"
                  >
                    <Icon name="external-link" size={14} />
                    Website
                  </a>
                )}
                
                <span className="profile-joined">
                  <Icon name="clock" size={14} />
                  Joined {formatJoinDate(profile.joined_date)}
                </span>
              </div>

              {profile.is_own_profile && (
                <div className="profile-actions">
                  <Link to="/settings/profile" className="edit-profile-btn">
                    <Icon name="edit" size={16} />
                    Edit Profile
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collection Stats */}
        {stats && (
          <div className="collection-stats">
            <h3>
              <Icon name="collections" size={20} />
              Collection Stats
            </h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.total_cards.toLocaleString()}</span>
                <span className="stat-label">Total Cards</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.unique_cards.toLocaleString()}</span>
                <span className="stat-label">Unique Cards</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.unique_sets.toLocaleString()}</span>
                <span className="stat-label">Sets</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.rookie_cards.toLocaleString()}</span>
                <span className="stat-label">Rookies</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.autograph_cards.toLocaleString()}</span>
                <span className="stat-label">Autographs</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.relic_cards.toLocaleString()}</span>
                <span className="stat-label">Relics</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">${Number(stats.estimated_value).toLocaleString()}</span>
                <span className="stat-label">Est. Value</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">${Number(stats.avg_card_value).toFixed(2)}</span>
                <span className="stat-label">Avg Card Value</span>
              </div>
            </div>
          </div>
        )}

        {/* Achievements */}
        {achievements && achievements.total_achievements > 0 && (
          <div className="achievements-section">
            <h3>
              <Icon name="trophy" size={20} />
              Achievements
            </h3>
            <div className="achievement-stats">
              <div className="achievement-overview">
                <div className="achievement-total">
                  <span className="achievement-count">{achievements.total_achievements}</span>
                  <span className="achievement-label">Achievements</span>
                </div>
                <div className="achievement-points">
                  <span className="points-value">{achievements.total_points.toLocaleString()}</span>
                  <span className="points-label">Points</span>
                </div>
              </div>
              
              {achievements.tier_breakdown && (
                <div className="tier-breakdown">
                  {achievements.tier_breakdown.mythic > 0 && (
                    <span className="tier-badge mythic" title="Mythic">
                      {achievements.tier_breakdown.mythic}
                    </span>
                  )}
                  {achievements.tier_breakdown.legendary > 0 && (
                    <span className="tier-badge legendary" title="Legendary">
                      {achievements.tier_breakdown.legendary}
                    </span>
                  )}
                  {achievements.tier_breakdown.epic > 0 && (
                    <span className="tier-badge epic" title="Epic">
                      {achievements.tier_breakdown.epic}
                    </span>
                  )}
                  {achievements.tier_breakdown.rare > 0 && (
                    <span className="tier-badge rare" title="Rare">
                      {achievements.tier_breakdown.rare}
                    </span>
                  )}
                  {achievements.tier_breakdown.uncommon > 0 && (
                    <span className="tier-badge uncommon" title="Uncommon">
                      {achievements.tier_breakdown.uncommon}
                    </span>
                  )}
                  {achievements.tier_breakdown.common > 0 && (
                    <span className="tier-badge common" title="Common">
                      {achievements.tier_breakdown.common}
                    </span>
                  )}
                </div>
              )}
              
              {achievements.recent_achievements && achievements.recent_achievements.length > 0 && (
                <div className="recent-achievements">
                  <h4>Recent Achievements</h4>
                  {achievements.recent_achievements.map(achievement => (
                    <div key={achievement.achievement_id} className={`achievement-item tier-${achievement.tier.toLowerCase()}`}>
                      <div className="achievement-info">
                        <span className="achievement-name">{achievement.name}</span>
                        <span className="achievement-description">{achievement.description}</span>
                      </div>
                      <span className="achievement-points">+{achievement.points}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {profile.is_own_profile && (
                <Link to="/achievements" className="view-all-achievements">
                  View All Achievements
                  <Icon name="arrow-right" size={16} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Favorite Cards */}
        {favoriteCards.length > 0 && (
          <div className="favorite-cards">
            <h3>
              <Icon name="star" size={20} />
              Favorite Cards
            </h3>
            <div className="gallery-grid">
              {favoriteCards.map((card) => {
                const handleCardClick = () => {
                  if (card.card_number && card.series_slug && card.player_name) {
                    const playerSlug = card.player_name
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-')
                      .trim()
                    
                    window.location.href = `/card/${card.series_slug}/${card.card_number}/${playerSlug}`
                  }
                }

                const getColorBackground = (colorName, hexColor) => {
                  if (!colorName && !hexColor) return {}
                  
                  if (colorName?.toLowerCase() === 'rainbow') {
                    return {
                      background: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
                      backgroundSize: '200% 200%',
                      animation: 'rainbow 3s ease infinite'
                    }
                  }
                  
                  return {
                    backgroundColor: hexColor || '#64748b'
                  }
                }

                const getTextColor = (hexColor) => {
                  if (!hexColor) return '#ffffff'
                  
                  const hex = hexColor.replace('#', '')
                  const r = parseInt(hex.substr(0, 2), 16)
                  const g = parseInt(hex.substr(2, 2), 16)
                  const b = parseInt(hex.substr(4, 2), 16)
                  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                  
                  return luminance > 0.5 ? '#000000' : '#ffffff'
                }
                
                return (
                  <div key={`favorite-${card.user_card_id}`} className="gallery-card" onClick={handleCardClick}>
                    <div className="gallery-card-image">
                      {card.primary_photo ? (
                        <img 
                          src={card.primary_photo} 
                          alt={`Card ${card.card_number}`}
                          className="card-image"
                        />
                      ) : (
                        <div className="card-placeholder">
                          <Icon name="image" size={32} />
                          <span>No Photo</span>
                        </div>
                      )}
                    </div>
                    <div className="gallery-card-info">
                      <div className="card-number">#{card.card_number}</div>
                      <div className="card-player">{card.player_name}</div>
                      <div className="card-series">{card.series_name}</div>
                      
                      {/* Tags row for grading (without random_code as requested) */}
                      <div className="gallery-tags">
                        {card.grade && (
                          <div className="gallery-grade-tag">
                            Grade {card.grade}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Color stripe at bottom if team colors exist or print run */}
                    {(card.team_primary_color || card.print_run) && (
                      <div 
                        className="gallery-color-stripe"
                        style={getColorBackground(null, card.team_primary_color)}
                      >
                        <span className="gallery-color-text" style={{
                          color: getTextColor(card.team_primary_color || '#64748b')
                        }}>
                          {[
                            card.team_name,
                            card.print_run ? (card.serial_number ? `${card.serial_number}/${card.print_run}` : `/${card.print_run}`) : null
                          ].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="recent-activity">
            <h3>
              <Icon name="activity" size={20} />
              Recent Activity
            </h3>
            <div className="activity-list">
              {recentActivity.map((activity, index) => (
                <div key={activity.comment_id || index} className="activity-item">
                  <div className="activity-content">
                    <p className="activity-action">
                      Commented on {activity.comment_type} 
                      <strong> {activity.item_name}</strong>
                    </p>
                    <p className="activity-comment">"{activity.comment_text}"</p>
                  </div>
                  <span className="activity-date">
                    {formatActivityDate(activity.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for No Activity */}
        {recentActivity.length === 0 && stats && stats.total_cards === 0 && (
          <div className="empty-profile">
            <Icon name="user" size={48} />
            <h3>Getting Started</h3>
            <p>
              {profile.is_own_profile 
                ? "Start building your collection to see stats and activity here!"
                : `${profile.display_name || profile.username} hasn't started collecting yet.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PublicProfile