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
  const [publicLists, setPublicLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [followStatus, setFollowStatus] = useState({
    is_following: false,
    are_friends: false,
    can_follow: false
  })
  const [followLoading, setFollowLoading] = useState(false)
  const [followError, setFollowError] = useState(null)
  const [isHoveringFollow, setIsHoveringFollow] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [username])

  useEffect(() => {
    if (profile && isAuthenticated && !profile.is_own_profile) {
      fetchFollowStatus()
    }
  }, [profile, isAuthenticated])

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
      setRecentActivity(response.data.recentActivity || [])
      setFavoriteCards(response.data.favoriteCards || [])
      setAchievements(response.data.achievements || null)
      setPublicLists(response.data.public_lists || [])
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

  const fetchFollowStatus = async () => {
    if (!profile || !profile.user_id) return

    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await axios.get(`/api/follow/status/${profile.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      setFollowStatus(response.data)
    } catch (err) {
      console.error('Error fetching follow status:', err)
    }
  }

  const handleFollowToggle = async () => {
    if (!isAuthenticated || !profile || followLoading) return

    try {
      setFollowLoading(true)
      setFollowError(null)
      const token = localStorage.getItem('token')
      if (!token) return

      if (followStatus.is_following) {
        // Unfollow
        await axios.delete(`/api/follow/${profile.user_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setFollowStatus({
          is_following: false,
          are_friends: false,
          can_follow: true
        })
      } else {
        // Follow
        const response = await axios.post(`/api/follow/${profile.user_id}`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setFollowStatus({
          is_following: true,
          are_friends: response.data.are_friends,
          can_follow: true
        })
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
      if (err.response?.status === 401) {
        setFollowError('Please log in to follow users')
      } else {
        setFollowError('Failed to update follow status. Please try again.')
      }

      // Auto-dismiss error after 5 seconds
      setTimeout(() => setFollowError(null), 5000)
    } finally {
      setFollowLoading(false)
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
        
        {/* Compact Header with Integrated Stats */}
        <header className="profile-header">
          <div className="header-top">
            <div className="header-title">
              <div className="title-and-info">
                <div className="profile-avatar">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={`${profile.username}'s avatar`} />
                  ) : (
                    <Icon name="user" size={40} />
                  )}
                </div>
                <div className="profile-title-details">
                  <h1 className="profile-name">
                    {profile.display_name || profile.username}
                  </h1>
                  <p className="profile-username">@{profile.username}</p>
                </div>
              </div>
              
              {/* Profile meta info below title */}
              <div className="profile-meta">
                {profile.bio && (
                  <p className="profile-bio">{profile.bio}</p>
                )}
                <div className="profile-meta-items">
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
                  {profile.is_own_profile && (
                    <Link to="/settings/profile" className="edit-profile-btn">
                      <Icon name="edit" size={14} />
                      Edit Profile
                    </Link>
                  )}
                  {!profile.is_own_profile && isAuthenticated && followStatus.can_follow && (
                    <button
                      onClick={handleFollowToggle}
                      onMouseEnter={() => setIsHoveringFollow(true)}
                      onMouseLeave={() => setIsHoveringFollow(false)}
                      disabled={followLoading}
                      className={`follow-btn ${
                        followStatus.are_friends
                          ? (isHoveringFollow ? 'unfollow' : 'friends')
                          : followStatus.is_following
                            ? (isHoveringFollow ? 'unfollow' : 'following')
                            : 'follow'
                      }`}
                      title={followStatus.are_friends ? 'You are friends' : followStatus.is_following ? 'Click to unfollow' : 'Click to follow'}
                    >
                      {followLoading ? (
                        <Icon name="activity" size={14} className="spinner" />
                      ) : (followStatus.are_friends || followStatus.is_following) && isHoveringFollow ? (
                        <>
                          <Icon name="user-x" size={14} />
                          Unfollow
                        </>
                      ) : followStatus.are_friends ? (
                        <>
                          <Icon name="users" size={14} />
                          Friends
                        </>
                      ) : followStatus.is_following ? (
                        <>
                          <Icon name="user-check" size={14} />
                          Following
                        </>
                      ) : (
                        <>
                          <Icon name="user-plus" size={14} />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
                {followError && (
                  <div className="follow-error-message">
                    <Icon name="alert-circle" size={14} />
                    {followError}
                  </div>
                )}
              </div>
            </div>
            
            {/* Stats Grid on the right */}
            {stats && (
              <div className="header-stats">
                <div className="stat-item">
                  <Icon name="layers" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.total_cards.toLocaleString()}</span>
                    <span className="stat-label">Cards</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="diamond" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.unique_cards.toLocaleString()}</span>
                    <span className="stat-label">Unique</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="value" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">${Number(stats.estimated_value).toLocaleString()}</span>
                    <span className="stat-label">Value</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="star" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.rookie_cards.toLocaleString()}</span>
                    <span className="stat-label">Rookies</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="edit" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.autograph_cards.toLocaleString()}</span>
                    <span className="stat-label">Autos</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="jersey" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.relic_cards.toLocaleString()}</span>
                    <span className="stat-label">Relics</span>
                  </div>
                </div>
                <div className="stat-item">
                  <Icon name="collections" size={18} />
                  <div className="stat-content">
                    <span className="stat-value">{stats.unique_sets.toLocaleString()}</span>
                    <span className="stat-label">Sets</span>
                  </div>
                </div>
                {achievements && (
                  <div className="stat-item">
                    <Icon name="trophy" size={18} />
                    <div className="stat-content">
                      <span className="stat-value">{achievements.total_achievements}</span>
                      <span className="stat-label">Achievements</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Two Column Layout: Achievements and Favorite Cards */}
        <div className="content-columns">
          {/* Achievements */}
          {achievements && achievements.total_achievements > 0 && (
          <div className="achievements-section">
            <div className="achievements-header">
              <h3>
                <Icon name="trophy" size={20} />
                Achievements ({achievements.total_achievements})
              </h3>
              <span className="achievement-points-badge">{achievements.total_points.toLocaleString()} pts</span>
            </div>
            <div className="achievement-stats">
              
              {achievements.tier_breakdown && (
                <div className="tier-breakdown">
                  {achievements.tier_breakdown.mythic > 0 && (
                    <span className="tier-badge mythic" title="Mythic">
                      {achievements.tier_breakdown.mythic} MYTHIC
                    </span>
                  )}
                  {achievements.tier_breakdown.legendary > 0 && (
                    <span className="tier-badge legendary" title="Legendary">
                      {achievements.tier_breakdown.legendary} LEGENDARY
                    </span>
                  )}
                  {achievements.tier_breakdown.epic > 0 && (
                    <span className="tier-badge epic" title="Epic">
                      {achievements.tier_breakdown.epic} EPIC
                    </span>
                  )}
                  {achievements.tier_breakdown.rare > 0 && (
                    <span className="tier-badge rare" title="Rare">
                      {achievements.tier_breakdown.rare} RARE
                    </span>
                  )}
                  {achievements.tier_breakdown.uncommon > 0 && (
                    <span className="tier-badge uncommon" title="Uncommon">
                      {achievements.tier_breakdown.uncommon} UNCOMMON
                    </span>
                  )}
                  {achievements.tier_breakdown.common > 0 && (
                    <span className="tier-badge common" title="Common">
                      {achievements.tier_breakdown.common} COMMON
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
              
              <Link to="/achievements" className="view-all-achievements">
                View All Achievements
                <Icon name="arrow-right" size={16} />
              </Link>
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
        </div>

        {/* Public Lists - Full Width Below */}
        {publicLists.length > 0 && (
          <div className="public-lists">
            <h3>
              <Icon name="list" size={20} />
              Public Lists ({publicLists.length})
            </h3>
            <div className="lists-grid">
              {publicLists.map((list) => (
                <Link
                  key={list.user_list_id}
                  to={`/${profile.username}/${list.slug}`}
                  className="list-card"
                >
                  <div className="list-card-header">
                    <h4>{list.name}</h4>
                    <Icon name="arrow-right" size={16} />
                  </div>
                  <div className="list-card-meta">
                    <div className="list-card-stats">
                      <span className="list-stat">
                        <Icon name="layers" size={14} />
                        {list.card_count} {list.card_count === 1 ? 'card' : 'cards'} in list
                      </span>
                      <span className="list-stat">
                        <Icon name="check-circle" size={14} />
                        {list.cards_owned} owned ({list.completion_percentage}%)
                      </span>
                    </div>
                    <span className="list-card-date">
                      Created {formatJoinDate(list.created)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity - Full Width Below */}
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