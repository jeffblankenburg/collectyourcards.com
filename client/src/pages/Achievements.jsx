import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AchievementsScoped.css'

function Achievements() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  
  const [achievements, setAchievements] = useState([])
  const [userProgress, setUserProgress] = useState([])
  const [userStats, setUserStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('') // all, completed, in-progress, locked
  const [selectedTier, setSelectedTier] = useState('')
  const [sortBy, setSortBy] = useState('progress') // progress, points, name

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }
    loadAchievements()
  }, [user, navigate])

  // Update page title
  useEffect(() => {
    document.title = 'Achievements - Collect Your Cards'
  }, [])

  const loadAchievements = async () => {
    try {
      setLoading(true)
      const [achievementsRes, progressRes, statsRes, categoriesRes] = await Promise.all([
        axios.get('/api/achievements'),
        axios.get('/api/user/achievements/progress'),
        axios.get('/api/user/achievements/stats'),
        axios.get('/api/achievements/categories')
      ])
      
      setAchievements(achievementsRes.data.achievements || [])
      setUserProgress(progressRes.data.progress || [])
      setUserStats(statsRes.data.stats || {})
      setCategories(categoriesRes.data.categories || [])
    } catch (error) {
      console.error('Error loading achievements:', error)
      addToast('Failed to load achievements', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getAchievementProgress = (achievementId) => {
    return userProgress.find(p => p.achievement_id === achievementId) || {
      progress: 0,
      progress_percentage: 0,
      is_completed: false,
      completed_at: null
    }
  }

  const getTierColor = (tier) => {
    const colors = {
      'Common': '#9ca3af',
      'Uncommon': '#10b981', 
      'Rare': '#3b82f6',
      'Epic': '#8b5cf6',
      'Legendary': '#f59e0b',
      'Mythic': '#ef4444'
    }
    return colors[tier] || '#9ca3af'
  }

  const getTierIcon = (tier) => {
    const icons = {
      'Common': 'circle',
      'Uncommon': 'square',
      'Rare': 'diamond',
      'Epic': 'star',
      'Legendary': 'crown',
      'Mythic': 'zap'
    }
    return icons[tier] || 'circle'
  }

  const getFilteredAndSortedAchievements = () => {
    let filtered = achievements.filter(achievement => {
      // Category filter
      if (selectedCategory && achievement.category_id !== parseInt(selectedCategory)) {
        return false
      }
      
      // Tier filter
      if (selectedTier && achievement.tier !== selectedTier) {
        return false
      }
      
      // Status filter
      if (selectedStatus) {
        const progress = getAchievementProgress(achievement.achievement_id)
        switch (selectedStatus) {
          case 'completed':
            return progress.is_completed
          case 'in-progress':
            return !progress.is_completed && progress.progress > 0
          case 'locked':
            return !progress.is_completed && progress.progress === 0
          default:
            break
        }
      }
      
      // Don't show secret achievements unless unlocked
      if (achievement.is_secret) {
        const progress = getAchievementProgress(achievement.achievement_id)
        return progress.is_completed
      }
      
      return true
    })

    // Sort achievements
    return filtered.sort((a, b) => {
      const progressA = getAchievementProgress(a.achievement_id)
      const progressB = getAchievementProgress(b.achievement_id)
      
      switch (sortBy) {
        case 'progress':
          // Completed first, then by progress percentage, then by points
          if (progressA.is_completed !== progressB.is_completed) {
            return progressB.is_completed - progressA.is_completed
          }
          if (progressA.progress_percentage !== progressB.progress_percentage) {
            return progressB.progress_percentage - progressA.progress_percentage
          }
          return b.points - a.points
          
        case 'points':
          return b.points - a.points
          
        case 'name':
          return a.name.localeCompare(b.name)
          
        default:
          return 0
      }
    })
  }

  const getCategoryProgress = (categoryId) => {
    const categoryAchievements = achievements.filter(a => a.category_id === categoryId)
    const completedCount = categoryAchievements.filter(a => {
      const progress = getAchievementProgress(a.achievement_id)
      return progress.is_completed
    }).length
    
    return {
      completed: completedCount,
      total: categoryAchievements.length,
      percentage: categoryAchievements.length > 0 ? Math.round((completedCount / categoryAchievements.length) * 100) : 0
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getProgressBarColor = (percentage, tier) => {
    if (percentage === 100) return getTierColor(tier)
    if (percentage >= 75) return '#10b981'
    if (percentage >= 50) return '#f59e0b'
    if (percentage >= 25) return '#3b82f6'
    return '#6b7280'
  }

  if (loading) {
    return (
      <div className="achievements-page">
        <div className="page-header">
          <h1>Achievements</h1>
        </div>
        <div className="loading-state">
          <div className="card-icon-spinner"></div>
          <p>Loading your achievements...</p>
        </div>
      </div>
    )
  }

  const filteredAchievements = getFilteredAndSortedAchievements()

  return (
    <div className="achievements-page">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <Icon name="award" size={32} className="page-icon" />
            <div>
              <h1>Achievements</h1>
              <p>Track your collecting milestones and unlock rewards</p>
            </div>
          </div>
          
          {userStats && (
            <div className="collector-score">
              <div className="score-main">
                <span className="score-value">{userStats.total_points?.toLocaleString() || 0}</span>
                <span className="score-label">Collector Score</span>
              </div>
              <div className="score-details">
                <span className="completed-count">{userStats.total_achievements || 0} Unlocked</span>
                <span className="completion-rate">{userStats.completion_percentage || 0}% Complete</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Stats Overview */}
      {userStats && (
        <div className="stats-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon common">
                <Icon name="circle" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.common_achievements || 0}</span>
                <span className="stat-label">Common</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon uncommon">
                <Icon name="square" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.uncommon_achievements || 0}</span>
                <span className="stat-label">Uncommon</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon rare">
                <Icon name="diamond" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.rare_achievements || 0}</span>
                <span className="stat-label">Rare</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon epic">
                <Icon name="star" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.epic_achievements || 0}</span>
                <span className="stat-label">Epic</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon legendary">
                <Icon name="crown" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.legendary_achievements || 0}</span>
                <span className="stat-label">Legendary</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon mythic">
                <Icon name="zap" size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{userStats.mythic_achievements || 0}</span>
                <span className="stat-label">Mythic</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Progress */}
      <div className="categories-section">
        <h2>Category Progress</h2>
        <div className="categories-grid">
          {categories.map(category => {
            const progress = getCategoryProgress(category.category_id)
            return (
              <div 
                key={category.category_id} 
                className={`category-card ${selectedCategory === category.category_id.toString() ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === category.category_id.toString() ? '' : category.category_id.toString())}
              >
                <div className="category-header">
                  <Icon name={category.icon || 'folder'} size={20} />
                  <span className="category-name">{category.name}</span>
                </div>
                <div className="category-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress.percentage}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {progress.completed} / {progress.total} ({progress.percentage}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Achievements</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="locked">Not Started</option>
          </select>
          
          <select 
            value={selectedTier} 
            onChange={(e) => setSelectedTier(e.target.value)}
            className="filter-select"
          >
            <option value="">All Tiers</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Epic">Epic</option>
            <option value="Legendary">Legendary</option>
            <option value="Mythic">Mythic</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="progress">Sort by Progress</option>
            <option value="points">Sort by Points</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
        
        <div className="results-count">
          Showing {filteredAchievements.length} of {achievements.length} achievements
        </div>
      </div>

      {/* Achievements List */}
      <div className="achievements-grid">
        {filteredAchievements.map(achievement => {
          const progress = getAchievementProgress(achievement.achievement_id)
          const category = categories.find(c => c.category_id === achievement.category_id)
          
          return (
            <div 
              key={achievement.achievement_id} 
              className={`achievement-card ${progress.is_completed ? 'completed' : ''} ${progress.progress > 0 ? 'in-progress' : 'locked'}`}
            >
              <div className="achievement-header">
                <div className="achievement-icon" style={{ color: getTierColor(achievement.tier) }}>
                  <Icon name={getTierIcon(achievement.tier)} size={24} />
                </div>
                <div className="achievement-tier">
                  <span 
                    className="tier-badge"
                    style={{ 
                      backgroundColor: getTierColor(achievement.tier) + '20',
                      color: getTierColor(achievement.tier),
                      border: `1px solid ${getTierColor(achievement.tier)}40`
                    }}
                  >
                    {achievement.tier}
                  </span>
                </div>
                <div className="achievement-points">
                  <span className="points-value">{achievement.points}</span>
                  <span className="points-label">pts</span>
                </div>
              </div>
              
              <div className="achievement-content">
                <h3 className="achievement-name">{achievement.name}</h3>
                <p className="achievement-description">{achievement.description}</p>
                
                <div className="achievement-meta">
                  <span className="achievement-category">{category?.name}</span>
                  {progress.completed_at && (
                    <span className="completion-date">
                      <Icon name="calendar" size={14} />
                      {formatDate(progress.completed_at)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="achievement-progress">
                {progress.is_completed ? (
                  <div className="completion-badge">
                    <Icon name="check-circle" size={16} />
                    <span>Completed!</span>
                  </div>
                ) : (
                  <>
                    <div className="progress-info">
                      <span className="progress-text">
                        {progress.progress} / {achievement.requirement_value}
                      </span>
                      <span className="progress-percentage">
                        {Math.round(progress.progress_percentage || 0)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${progress.progress_percentage || 0}%`,
                          backgroundColor: getProgressBarColor(progress.progress_percentage || 0, achievement.tier)
                        }}
                      ></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="empty-state">
          <Icon name="search" size={48} />
          <h3>No Achievements Found</h3>
          <p>Try adjusting your filters to see more achievements.</p>
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setSelectedCategory('')
              setSelectedStatus('')
              setSelectedTier('')
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}

export default Achievements