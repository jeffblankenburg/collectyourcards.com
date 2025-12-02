import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminAchievementsScoped.css'

function AdminAchievements() {
  const [achievements, setAchievements] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [achievementToDelete, setAchievementToDelete] = useState(null)
  
  // Query testing states
  const [showQueryTestModal, setShowQueryTestModal] = useState(false)
  const [testingAchievement, setTestingAchievement] = useState(null)
  const [testUserId, setTestUserId] = useState('1')
  const [queryResults, setQueryResults] = useState(null)
  const [testingQuery, setTestingQuery] = useState(false)
  const [users, setUsers] = useState([])
  
  // Form state
  const [achievementForm, setAchievementForm] = useState({
    name: '',
    description: '',
    category_id: '',
    subcategory: '',
    points: '',
    tier: 'Common',
    requirement_type: 'count',
    requirement_value: '',
    requirement_query: '',
    completion_query: '',
    icon_url: '',
    is_active: true,
    is_secret: false,
    is_repeatable: false,
    cooldown_days: ''
  })

  const { addToast } = useToast()
  const searchTimeoutRef = useRef(null)

  const tiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
  const requirementTypes = [
    'count', 'unique', 'value', 'streak', 'percentage', 'boolean', 'custom'
  ]

  useEffect(() => {
    loadData()
  }, [])

  // Update page title
  useEffect(() => {
    document.title = 'Admin Achievements - Collect Your Cards'
  }, [])

  // Query testing functions
  const validateQuery = (query) => {
    const cleanQuery = query.trim().toUpperCase()
    
    // Must start with SELECT
    if (!cleanQuery.startsWith('SELECT')) {
      return { valid: false, error: 'Query must start with SELECT' }
    }

    // Block semicolons to prevent multiple statements
    const semicolonPattern = /;(?=(?:[^']*'[^']*')*[^']*$)/
    if (semicolonPattern.test(query)) {
      return { valid: false, error: 'Multiple statements not allowed (semicolons detected)' }
    }
    
    // Check for dangerous keywords
    const dangerousKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
      'EXEC', 'EXECUTE', 'SP_', 'XP_', 'BULK', 'BACKUP', 'RESTORE',
      'GRANT', 'REVOKE', 'DENY'
    ]
    
    for (const keyword of dangerousKeywords) {
      if (cleanQuery.includes(keyword)) {
        return { valid: false, error: `Dangerous keyword detected: ${keyword}` }
      }
    }
    
    // Check for SQL injection patterns
    const injectionPatterns = [
      /;\s*--/, // Comment injection
      /;\s*\/\*/, // Block comment injection
      /'\s*OR\s+'1'\s*=\s*'1/, // Classic OR injection
      /'\s*OR\s+1\s*=\s*1/, // Numeric OR injection
      /UNION\s+SELECT/i // Union injection
    ]
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: 'Potential SQL injection pattern detected' }
      }
    }
    
    return { valid: true }
  }

  const handleTestQuery = (achievement) => {
    setTestingAchievement(achievement)
    setQueryResults(null)
    setShowQueryTestModal(true)
  }

  const executeTestQuery = async () => {
    if (!testingAchievement || !testUserId) {
      addToast('Missing achievement or user ID', 'error')
      return
    }

    const validation = validateQuery(testingAchievement.requirement_query)
    if (!validation.valid) {
      addToast(validation.error, 'error')
      return
    }

    setTestingQuery(true)
    setQueryResults(null)

    try {
      const response = await axios.post('/api/admin/test-query', {
        query: testingAchievement.requirement_query,
        userId: testUserId
      })
      
      setQueryResults(response.data)
      addToast('Query executed successfully', 'success')
      
    } catch (error) {
      console.error('Query execution error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Query execution failed'
      addToast(errorMessage, 'error')
      
      setQueryResults({
        success: false,
        error: errorMessage,
        executionTime: 0
      })
    } finally {
      setTestingQuery(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [achievementsRes, categoriesRes, usersRes] = await Promise.all([
        axios.get('/api/admin/achievements'),
        axios.get('/api/admin/achievements/categories'),
        axios.get('/api/admin/users')
      ])
      
      setAchievements(achievementsRes.data.achievements || [])
      setCategories(categoriesRes.data.categories || [])
      setUsers((usersRes.data.users || []).slice(0, 20)) // Limit to first 20 users
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Failed to load achievements data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      filterAchievements(value, selectedCategory, selectedTier)
    }, 300)
  }

  const handleCategoryFilter = (categoryId) => {
    setSelectedCategory(categoryId)
    filterAchievements(searchTerm, categoryId, selectedTier)
  }

  const handleTierFilter = (tier) => {
    setSelectedTier(tier)
    filterAchievements(searchTerm, selectedCategory, tier)
  }

  const filterAchievements = async (search = '', categoryId = '', tier = '') => {
    try {
      setSearching(true)
      const params = {}
      
      if (search) params.search = search
      if (categoryId) params.category = categoryId
      if (tier) params.tier = tier
      
      const response = await axios.get('/api/admin/achievements', { params })
      setAchievements(response.data.achievements || [])
    } catch (error) {
      console.error('Error filtering achievements:', error)
      addToast('Failed to filter achievements', 'error')
    } finally {
      setSearching(false)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortedAchievements = () => {
    return [...achievements].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''
      
      // Handle numeric fields
      if (['points', 'requirement_value', 'cooldown_days', 'user_count'].includes(sortField)) {
        aVal = Number(aVal) || 0
        bVal = Number(bVal) || 0
      }
      
      // Handle string comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  const handleAddAchievement = () => {
    setAchievementForm({
      name: '',
      description: '',
      category_id: '',
      subcategory: '',
      points: '',
      tier: 'Common',
      requirement_type: 'count',
      requirement_value: '',
      requirement_query: '',
      completion_query: '',
      icon_url: '',
      is_active: true,
      is_secret: false,
      is_repeatable: false,
      cooldown_days: ''
    })
    setShowAddModal(true)
  }

  const handleEditAchievement = (achievement) => {
    setEditingAchievement(achievement)
    setAchievementForm({
      name: achievement.name || '',
      description: achievement.description || '',
      category_id: achievement.category_id || '',
      subcategory: achievement.subcategory || '',
      points: achievement.points || '',
      tier: achievement.tier || 'Common',
      requirement_type: achievement.requirement_type || 'count',
      requirement_value: achievement.requirement_value || '',
      requirement_query: achievement.requirement_query || '',
      completion_query: achievement.completion_query || '',
      icon_url: achievement.icon_url || '',
      is_active: achievement.is_active !== undefined ? achievement.is_active : true,
      is_secret: achievement.is_secret || false,
      is_repeatable: achievement.is_repeatable || false,
      cooldown_days: achievement.cooldown_days || ''
    })
    setShowEditModal(true)
  }

  const handleSaveAchievement = async () => {
    try {
      setSaving(true)
      
      // Validation
      if (!achievementForm.name.trim()) {
        addToast('Achievement name is required', 'error')
        return
      }
      if (!achievementForm.description.trim()) {
        addToast('Description is required', 'error')
        return
      }
      if (!achievementForm.category_id) {
        addToast('Category is required', 'error')
        return
      }
      if (!achievementForm.points || achievementForm.points < 1) {
        addToast('Points must be greater than 0', 'error')
        return
      }
      if (!achievementForm.requirement_value || achievementForm.requirement_value < 1) {
        addToast('Requirement value must be greater than 0', 'error')
        return
      }

      const saveData = {
        ...achievementForm,
        category_id: Number(achievementForm.category_id),
        points: Number(achievementForm.points),
        requirement_value: Number(achievementForm.requirement_value),
        cooldown_days: achievementForm.cooldown_days ? Number(achievementForm.cooldown_days) : 0
      }

      if (editingAchievement) {
        // Update existing achievement
        const response = await axios.put(`/api/admin/achievements/${editingAchievement.achievement_id}`, saveData)
        setAchievements(prev => prev.map(a => 
          a.achievement_id === editingAchievement.achievement_id 
            ? { ...a, ...response.data.achievement }
            : a
        ))
        addToast('Achievement updated successfully', 'success')
        setShowEditModal(false)
      } else {
        // Create new achievement
        const response = await axios.post('/api/admin/achievements', saveData)
        setAchievements(prev => [response.data.achievement, ...prev])
        addToast('Achievement created successfully', 'success')
        setShowAddModal(false)
      }
      
      setEditingAchievement(null)
    } catch (error) {
      console.error('Error saving achievement:', error)
      const errorMessage = error.response?.data?.message || error.message
      addToast(`Failed to save achievement: ${errorMessage}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (achievement) => {
    try {
      const newStatus = !achievement.is_active
      await axios.put(`/api/admin/achievements/${achievement.achievement_id}`, {
        ...achievement,
        is_active: newStatus
      })
      
      setAchievements(prev => prev.map(a => 
        a.achievement_id === achievement.achievement_id 
          ? { ...a, is_active: newStatus }
          : a
      ))
      
      addToast(`Achievement ${newStatus ? 'activated' : 'deactivated'}`, 'success')
    } catch (error) {
      console.error('Error toggling achievement status:', error)
      addToast('Failed to update achievement status', 'error')
    }
  }

  const handleDeleteAchievement = (achievement) => {
    setAchievementToDelete(achievement)
    setShowDeleteModal(true)
  }

  const confirmDeleteAchievement = async () => {
    if (!achievementToDelete) return
    
    try {
      await axios.delete(`/api/admin/achievements/${achievementToDelete.achievement_id}`)
      
      setAchievements(prev => prev.filter(a => a.achievement_id !== achievementToDelete.achievement_id))
      addToast('Achievement deleted successfully', 'success')
      setShowDeleteModal(false)
      setAchievementToDelete(null)
    } catch (error) {
      console.error('Error deleting achievement:', error)
      const errorMessage = error.response?.data?.message || error.message
      addToast(`Failed to delete achievement: ${errorMessage}`, 'error')
    }
  }

  const cancelDeleteAchievement = () => {
    setShowDeleteModal(false)
    setAchievementToDelete(null)
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

  const getTierPoints = (tier) => {
    const ranges = {
      'Common': '5-10',
      'Uncommon': '15-25',
      'Rare': '30-50', 
      'Epic': '75-100',
      'Legendary': '150-250',
      'Mythic': '500-1000'
    }
    return ranges[tier] || '5-10'
  }

  if (loading) {
    return (
      <div className="admin-achievements-page">
        <div className="admin-header">
          <div className="admin-title">
            <Icon name="award" size={32} />
            <h1>Achievement Management</h1>
          </div>
        </div>
        <div className="loading-state">
          <div className="card-icon-spinner"></div>
          <p>Loading achievements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-achievements-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="award" size={32} />
          <h1>Achievement Management</h1>
          <div className="achievement-stats">
            <span className="stat">{achievements.length} Total</span>
            <span className="stat">{achievements.filter(a => a.is_active).length} Active</span>
            <span className="stat">{achievements.filter(a => a.is_secret).length} Secret</span>
          </div>
        </div>
        
        <div className="admin-controls">
          <button
            className="add-achievement-btn"
            onClick={handleAddAchievement}
            title="Add new achievement"
          >
            <Icon name="plus" size={20} />
            Add Achievement
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Icon name="search" size={20} />
          <input
            type="text"
            placeholder="Search achievements by name or description..."
            value={searchTerm}
            onChange={handleSearchChange}
            autoFocus
          />
          {searching && <div className="search-spinner spinning"><Icon name="loader" size={16} /></div>}
        </div>
        
        <div className="filter-group">
          <select 
            value={selectedCategory} 
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
          
          <select 
            value={selectedTier} 
            onChange={(e) => handleTierFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Tiers</option>
            {tiers.map(tier => (
              <option key={tier} value={tier}>{tier}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Achievements Table */}
      <div className="achievements-container">
        {achievements.length === 0 ? (
          <div className="empty-state">
            <Icon name="award" size={48} />
            <h3>No Achievements Found</h3>
            <p>
              {searchTerm || selectedCategory || selectedTier
                ? 'No achievements match your current filters'
                : 'No achievements have been created yet'}
            </p>
          </div>
        ) : (
          <div className="achievements-table">
            <div className="table-header">
              <div className="col-header status">Status</div>
              <div className="col-header id">ID</div>
              <div 
                className={`col-header name sortable ${sortField === 'name' ? 'active' : ''}`}
                onClick={() => handleSort('name')}
              >
                Name
                {sortField === 'name' && (
                  <Icon 
                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                  />
                )}
              </div>
              <div className="col-header category">Category</div>
              <div 
                className={`col-header tier sortable ${sortField === 'tier' ? 'active' : ''}`}
                onClick={() => handleSort('tier')}
              >
                Tier
                {sortField === 'tier' && (
                  <Icon 
                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                  />
                )}
              </div>
              <div 
                className={`col-header points sortable ${sortField === 'points' ? 'active' : ''}`}
                onClick={() => handleSort('points')}
              >
                Points
                {sortField === 'points' && (
                  <Icon 
                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                  />
                )}
              </div>
              <div className="col-header requirement">Requirement</div>
              <div 
                className={`col-header users sortable ${sortField === 'user_count' ? 'active' : ''}`}
                onClick={() => handleSort('user_count')}
              >
                Users
                {sortField === 'user_count' && (
                  <Icon 
                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                  />
                )}
              </div>
              <div className="col-header flags">Flags</div>
              <div className="col-header actions">Actions</div>
            </div>
            
            {getSortedAchievements().map(achievement => (
              <div 
                key={achievement.achievement_id} 
                className={`achievement-row ${!achievement.is_active ? 'inactive' : ''}`}
                onDoubleClick={() => handleEditAchievement(achievement)}
                title="Double-click to edit"
              >
                <div className="col-status">
                  <button
                    className={`status-toggle ${achievement.is_active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleActive(achievement)}
                    title={achievement.is_active ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                  >
                    <Icon name={achievement.is_active ? 'check-circle' : 'x-circle'} size={16} />
                  </button>
                </div>
                <div className="col-id">{achievement.achievement_id}</div>
                <div className="col-name">
                  <div className="achievement-name">{achievement.name}</div>
                  <div className="achievement-description">{achievement.description}</div>
                </div>
                <div className="col-category">
                  {categories.find(c => c.category_id === achievement.category_id)?.name || 'Unknown'}
                </div>
                <div className="col-tier">
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
                <div className="col-points">
                  <span className="points-value">{achievement.points}</span>
                </div>
                <div className="col-requirement">
                  <div className="requirement-info">
                    <span className="requirement-type">{achievement.requirement_type}</span>
                    <span className="requirement-value">{achievement.requirement_value}</span>
                  </div>
                </div>
                <div className="col-users">
                  <span className="user-count">{achievement.user_count || 0}</span>
                  <span className="user-count-label">users</span>
                </div>
                <div className="col-flags">
                  {achievement.is_secret && <span className="flag secret" title="Secret Achievement">S</span>}
                  {achievement.is_repeatable && <span className="flag repeatable" title="Repeatable Achievement">R</span>}
                </div>
                <div className="col-actions">
                  <button 
                    className="test-btn"
                    title="Test query"
                    onClick={() => handleTestQuery(achievement)}
                  >
                    <Icon name="play" size={16} />
                  </button>
                  <button 
                    className="edit-btn"
                    title="Edit achievement"
                    onClick={() => handleEditAchievement(achievement)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button 
                    className="delete-btn"
                    title="Delete achievement"
                    onClick={() => handleDeleteAchievement(achievement)}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false)
          setShowEditModal(false)
        }}>
          <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAchievement ? `Edit Achievement #${editingAchievement.achievement_id}` : 'Add New Achievement'}</h3>
              <button 
                className="close-btn" 
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                }}
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="achievement-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={achievementForm.name}
                      onChange={(e) => setAchievementForm({...achievementForm, name: e.target.value})}
                      placeholder="Achievement name"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={achievementForm.category_id}
                      onChange={(e) => setAchievementForm({...achievementForm, category_id: e.target.value})}
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subcategory</label>
                    <input
                      type="text"
                      className="form-input"
                      value={achievementForm.subcategory}
                      onChange={(e) => setAchievementForm({...achievementForm, subcategory: e.target.value})}
                      placeholder="Optional subcategory"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tier *</label>
                    <select
                      className="form-select"
                      value={achievementForm.tier}
                      onChange={(e) => setAchievementForm({...achievementForm, tier: e.target.value})}
                    >
                      {tiers.map(tier => (
                        <option key={tier} value={tier}>{tier} ({getTierPoints(tier)} pts)</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Points *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={achievementForm.points}
                      onChange={(e) => setAchievementForm({...achievementForm, points: e.target.value})}
                      placeholder="Point value"
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Requirement Type *</label>
                    <select
                      className="form-select"
                      value={achievementForm.requirement_type}
                      onChange={(e) => setAchievementForm({...achievementForm, requirement_type: e.target.value})}
                    >
                      {requirementTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Requirement Value *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={achievementForm.requirement_value}
                      onChange={(e) => setAchievementForm({...achievementForm, requirement_value: e.target.value})}
                      placeholder="Target value"
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Icon URL</label>
                    <input
                      type="url"
                      className="form-input"
                      value={achievementForm.icon_url}
                      onChange={(e) => setAchievementForm({...achievementForm, icon_url: e.target.value})}
                      placeholder="Optional icon URL"
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-textarea"
                    value={achievementForm.description}
                    onChange={(e) => setAchievementForm({...achievementForm, description: e.target.value})}
                    placeholder="Describe what this achievement rewards"
                    rows={3}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Progress Query</label>
                  <textarea
                    className="form-textarea code"
                    value={achievementForm.requirement_query}
                    onChange={(e) => setAchievementForm({...achievementForm, requirement_query: e.target.value})}
                    placeholder="SQL query to calculate current progress (use @user_id parameter)"
                    rows={4}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Completion Query</label>
                  <textarea
                    className="form-textarea code"
                    value={achievementForm.completion_query}
                    onChange={(e) => setAchievementForm({...achievementForm, completion_query: e.target.value})}
                    placeholder="Optional: SQL query to determine completion (returns 1 for complete, 0 for incomplete)"
                    rows={4}
                  />
                </div>

                <div className="form-flags">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={achievementForm.is_active}
                      onChange={(e) => setAchievementForm({...achievementForm, is_active: e.target.checked})}
                    />
                    <span className="checkbox-text">Active</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={achievementForm.is_secret}
                      onChange={(e) => setAchievementForm({...achievementForm, is_secret: e.target.checked})}
                    />
                    <span className="checkbox-text">Secret (hidden until unlocked)</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={achievementForm.is_repeatable}
                      onChange={(e) => setAchievementForm({...achievementForm, is_repeatable: e.target.checked})}
                    />
                    <span className="checkbox-text">Repeatable</span>
                  </label>
                </div>

                {achievementForm.is_repeatable && (
                  <div className="form-group">
                    <label className="form-label">Cooldown (days)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={achievementForm.cooldown_days}
                      onChange={(e) => setAchievementForm({...achievementForm, cooldown_days: e.target.value})}
                      placeholder="Days before can be earned again"
                      min="0"
                    />
                  </div>
                )}
              </div>
            
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSaveAchievement}
                disabled={saving || !achievementForm.name.trim()}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Saving...
                  </>
                ) : (
                  editingAchievement ? 'Save Changes' : 'Create Achievement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && achievementToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteAchievement}>
          <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Achievement</h3>
              <button className="close-btn" onClick={cancelDeleteAchievement}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="delete-confirmation">
                <div className="delete-warning">
                  <Icon name="alert-triangle" size={48} />
                  <h4>Are you sure you want to delete this achievement?</h4>
                  <p>
                    <strong>{achievementToDelete.name}</strong>
                  </p>
                  <p>{achievementToDelete.description}</p>
                  <div className="delete-details">
                    <p><strong>User Count:</strong> {achievementToDelete.user_count || 0} users have earned this achievement</p>
                    <p><strong>Points:</strong> {achievementToDelete.points} points</p>
                  </div>
                  <div className="delete-warning-text">
                    <strong>This action cannot be undone.</strong> All user progress for this achievement will also be permanently deleted.
                  </div>
                </div>
              </div>
            
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={cancelDeleteAchievement}
              >
                Cancel
              </button>
              <button 
                className="btn-delete"
                onClick={confirmDeleteAchievement}
              >
                <Icon name="trash-2" size={16} />
                Delete Achievement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Query Test Modal */}
      {showQueryTestModal && testingAchievement && (
        <div className="modal-overlay" onClick={() => setShowQueryTestModal(false)}>
          <div className="achievement-modal query-test-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Test Query: {testingAchievement.name}</h3>
              <button className="close-btn" onClick={() => setShowQueryTestModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="query-test-content">
              <div className="test-config">
                <div className="form-group">
                  <label className="form-label">Test User:</label>
                  <select
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select a user...</option>
                    {users.map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name} ({user.email}) - ID: {user.user_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Query:</label>
                  <textarea
                    value={testingAchievement.requirement_query || ''}
                    readOnly
                    className="form-textarea code"
                    rows={6}
                  />
                  <div className="query-info">
                    <Icon name="info" size={16} />
                    <span>This query will be executed with user ID {testUserId} substituted for @user_id</span>
                  </div>
                </div>
              </div>

              {queryResults && (
                <div className="query-results">
                  <h4>
                    <Icon name={queryResults.success ? "check-circle" : "alert-circle"} size={20} />
                    Results
                  </h4>
                  
                  <div className="result-summary">
                    <span className={`status ${queryResults.success ? 'success' : 'error'}`}>
                      {queryResults.success ? 'SUCCESS' : 'ERROR'}
                    </span>
                    <span className="execution-time">
                      {queryResults.executionTime}ms
                    </span>
                    {queryResults.rowCount !== undefined && (
                      <span className="row-count">
                        {queryResults.rowCount} rows
                      </span>
                    )}
                  </div>

                  {queryResults.success ? (
                    <div className="result-data">
                      {queryResults.result && queryResults.result.length > 0 ? (
                        <div className="result-table">
                          <table>
                            <thead>
                              <tr>
                                {Object.keys(queryResults.result[0]).map(key => (
                                  <th key={key}>{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {queryResults.result.map((row, index) => (
                                <tr key={index}>
                                  {Object.values(row).map((value, i) => (
                                    <td key={i}>{value?.toString() || 'null'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="no-results">
                          <Icon name="database" size={24} />
                          <p>Query executed successfully but returned no results</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="error-details">
                      <Icon name="alert-triangle" size={20} />
                      <pre>{queryResults.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setShowQueryTestModal(false)}
              >
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={executeTestQuery}
                disabled={testingQuery || !testUserId}
              >
                {testingQuery ? (
                  <>
                    <Icon name="loader" size={16} className="spinning" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Icon name="play" size={16} />
                    Execute Query
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAchievements