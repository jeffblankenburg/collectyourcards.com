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