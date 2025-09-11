import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminUsersScoped.css'

function AdminUsers() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    is_active: true,
    is_verified: true
  })
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    role: 'user'
  })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetUser, setResetUser] = useState(null)
  const [sendingReset, setSendingReset] = useState(false)

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-users-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    )
  }

  // Load users data
  useEffect(() => {
    document.title = 'Admin Users - Collect Your Cards'
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/users')
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
      addToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filter users based on search term
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateWithTime = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'superadmin': return 'role-badge role-superadmin'
      case 'admin': return 'role-badge role-admin'
      case 'data_admin': return 'role-badge role-data-admin'
      default: return 'role-badge role-user'
    }
  }

  const getStatusBadge = (isActive, isVerified) => {
    if (!isActive) return <span className="status-badge status-inactive">Inactive</span>
    if (!isVerified) return <span className="status-badge status-unverified">Unverified</span>
    return <span className="status-badge status-active">Active</span>
  }

  const handleEditUser = (userData) => {
    setEditingUser(userData)
    setEditForm({
      name: userData.name || '',
      email: userData.email || '',
      role: userData.role || 'user',
      is_active: userData.is_active ?? true,
      is_verified: userData.is_verified ?? false
    })
    setShowEditModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingUser(null)
    setEditForm({
      name: '',
      email: '',
      role: '',
      is_active: true,
      is_verified: true
    })
    setSaving(false)
  }

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setAddForm({
      name: '',
      email: '',
      role: 'user'
    })
    setCreating(false)
  }

  const handleAddFormChange = (field, value) => {
    setAddForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCreateUser = async () => {
    try {
      setCreating(true)

      // Validate required fields
      if (!addForm.email.trim()) {
        addToast('Email is required', 'error')
        return
      }

      const response = await axios.post('/api/admin/users', {
        name: addForm.name.trim() || null,
        email: addForm.email.trim(),
        role: addForm.role || 'user'
      })

      // Add new user to the list
      const newUser = {
        ...response.data.user,
        login_attempts: 0
      }
      setUsers(prevUsers => [newUser, ...prevUsers])

      addToast('User created successfully. Welcome email sent.', 'success')
      handleCloseAddModal()

    } catch (error) {
      console.error('Error creating user:', error)
      const errorMessage = error.response?.data?.message || error.message
      addToast(`Failed to create user: ${errorMessage}`, 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    try {
      setSaving(true)
      
      const updateData = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        is_active: editForm.is_active,
        is_verified: editForm.is_verified
      }

      const response = await axios.put(`/api/admin/users/${editingUser.user_id}`, updateData)
      
      // Update the users list with the new data
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.user_id === editingUser.user_id 
            ? { ...u, ...updateData }
            : u
        )
      )

      addToast('User updated successfully', 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error updating user:', error)
      addToast(`Failed to update user: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordResetRequest = (userData) => {
    setResetUser(userData)
    setShowResetConfirm(true)
  }

  const handleCancelReset = () => {
    setShowResetConfirm(false)
    setResetUser(null)
    setSendingReset(false)
  }

  const handleConfirmPasswordReset = async () => {
    if (!resetUser) return

    try {
      setSendingReset(true)
      
      await axios.post(`/api/admin/users/${resetUser.user_id}/reset-password`)
      
      addToast(`Password reset email sent to ${resetUser.email}`, 'success')
      handleCancelReset()
      
    } catch (error) {
      console.error('Error sending password reset:', error)
      const errorMessage = error.response?.data?.message || error.message
      const isServiceUnavailable = error.response?.status === 503
      
      if (isServiceUnavailable) {
        addToast('Email service is not configured. Password reset emails cannot be sent at this time.', 'error')
      } else {
        addToast(`Failed to send password reset: ${errorMessage}`, 'error')
      }
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <div className="admin-users-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="users" size={32} />
          <h1>Users</h1>
        </div>

        <div className="admin-controls">
          <button
            className="new-item-button"
            onClick={() => setShowAddModal(true)}
            title="Add new user"
          >
            <Icon name="plus" size={20} />
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="users-container">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Icon name="users" size={48} />
            <p>No users found{searchTerm ? ' matching your search' : ''}</p>
          </div>
        ) : (
          <div className="users-table">
            <div className="table-header">
              <div className="col-id">ID</div>
              <div className="col-name">Name</div>
              <div className="col-email">Email</div>
              <div className="col-role">Role</div>
              <div className="col-status">Status</div>
              <div className="col-created">Joined</div>
              <div className="col-login">Last Login</div>
              <div className="col-actions">Actions</div>
            </div>
            
            {filteredUsers.map(u => (
              <div 
                key={u.user_id} 
                className="user-row"
                onDoubleClick={() => handleEditUser(u)}
                title="Double-click to edit user"
              >
                <div className="col-id">{u.user_id}</div>
                <div className="col-name">
                  <div className="user-name">{u.name || 'Unnamed User'}</div>
                </div>
                <div className="col-email">{u.email}</div>
                <div className="col-role">
                  <span className={getRoleBadgeClass(u.role)}>{u.role}</span>
                </div>
                <div className="col-status">
                  {getStatusBadge(u.is_active, u.is_verified)}
                  {u.login_attempts > 0 && (
                    <span className="failed-attempts" title="Failed login attempts">
                      ⚠️ {u.login_attempts}
                    </span>
                  )}
                </div>
                <div className="col-created">{formatDate(u.created)}</div>
                <div className="col-login">{formatDateWithTime(u.last_login)}</div>
                <div className="col-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditUser(u)
                    }}
                    title="Edit user"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button 
                    className="reset-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePasswordResetRequest(u)
                    }}
                    title="Send password reset email"
                  >
                    <Icon name="mail" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User #{editingUser.user_id}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="edit-form">
                <div className="player-details-form">
                  <div className="form-field-row">
                    <label className="field-label">Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editForm.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="Enter user name"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      className="field-input"
                      value={editForm.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Role</label>
                    <select
                      className="field-input"
                      value={editForm.role}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="data_admin">Data Admin</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Account Active</label>
                    <button
                      type="button"
                      className={`hof-toggle ${editForm.is_active ? 'hof-active' : ''}`}
                      onClick={() => handleFormChange('is_active', !editForm.is_active)}
                    >
                      <Icon name="power" size={16} />
                      <span>Account Active</span>
                      {editForm.is_active && <Icon name="check" size={16} className="hof-check" />}
                    </button>
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Email Verified</label>
                    <button
                      type="button"
                      className={`hof-toggle ${editForm.is_verified ? 'hof-active' : ''}`}
                      onClick={() => handleFormChange('is_verified', !editForm.is_verified)}
                    >
                      <Icon name="check-circle" size={16} />
                      <span>Email Verified</span>
                      {editForm.is_verified && <Icon name="check" size={16} className="hof-check" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSaveUser}
                disabled={saving || !editForm.email.trim()}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="close-btn" onClick={handleCloseAddModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="edit-form">
                <div className="player-details-form">
                  <div className="form-field-row">
                    <label className="field-label">Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={addForm.name}
                      onChange={(e) => handleAddFormChange('name', e.target.value)}
                      placeholder="Enter user name (optional)"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      className="field-input"
                      value={addForm.email}
                      onChange={(e) => handleAddFormChange('email', e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Role</label>
                    <select 
                      className="field-input"
                      value={addForm.role}
                      onChange={(e) => handleAddFormChange('role', e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="data_admin">Data Admin</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>

                  <div style={{ 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                    borderRadius: '6px', 
                    padding: '1rem', 
                    marginTop: '1rem',
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    <strong>📧 Automatic Setup:</strong> A welcome email with password setup instructions will be automatically sent to the user.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseAddModal} disabled={creating}>
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleCreateUser}
                disabled={creating || !addForm.email.trim()}
              >
                {creating ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {showResetConfirm && resetUser && (
        <div className="modal-overlay" onClick={handleCancelReset}>
          <div className="reset-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Password Reset</h3>
              <button className="close-btn" onClick={handleCancelReset}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="reset-confirmation">
                <div className="warning-icon">
                  <Icon name="mail" size={48} />
                </div>
                
                <div className="confirmation-text">
                  <h4>Send Password Reset Email?</h4>
                  <p>
                    This will send a password reset email to:
                    <br />
                    <strong>{resetUser.email}</strong>
                  </p>
                  <p>
                    The user ({resetUser.name || 'Unnamed User'}) will receive an email with 
                    instructions to create a new password.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCancelReset} disabled={sendingReset}>
                Cancel
              </button>
              <button 
                className="reset-confirm-btn" 
                onClick={handleConfirmPasswordReset}
                disabled={sendingReset}
              >
                {sendingReset ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Icon name="mail" size={16} />
                    Send Reset Email
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

export default AdminUsers