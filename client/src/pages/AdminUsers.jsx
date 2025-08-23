import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminUsers.css'

function AdminUsers() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    is_active: true,
    is_verified: true
  })
  const [saving, setSaving] = useState(false)
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

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
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
          <h1>User Administration</h1>
        </div>
        
        <div className="admin-stats">
          <div className="stat">
            <span className="stat-number">{users.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat">
            <span className="stat-number">{users.filter(u => u.is_active).length}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat">
            <span className="stat-number">{users.filter(u => u.is_verified).length}</span>
            <span className="stat-label">Verified</span>
          </div>
        </div>
      </div>

      <div className="admin-controls">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button className="refresh-btn" onClick={loadUsers} disabled={loading}>
          <Icon name={loading ? "activity" : "refresh"} size={16} className={loading ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      <div className="users-container">
        {loading ? (
          <div className="loading-state">
            <Icon name="activity" size={24} className="spinning" />
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
                <div className="col-login">{formatDate(u.last_login)}</div>
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
          <div className="edit-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                {/* Read-only fields */}
                <div className="readonly-section">
                  <div className="form-row">
                    <label className="form-label">User ID:</label>
                    <span className="readonly-value">{editingUser.user_id}</span>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="editable-section">
                  <div className="form-row">
                    <label className="form-label">Name:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="Enter user name"
                    />
                  </div>

                  <div className="form-row">
                    <label className="form-label">Email:</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editForm.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <label className="form-label">Role:</label>
                    <select
                      className="form-select"
                      value={editForm.role}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="data_admin">Data Admin</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label className="form-label">Status:</label>
                    <div className="status-controls">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => handleFormChange('is_active', e.target.checked)}
                        />
                        <span className="checkbox-text">Account Active</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={editForm.is_verified}
                          onChange={(e) => handleFormChange('is_verified', e.target.checked)}
                        />
                        <span className="checkbox-text">Email Verified</span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
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
                    <Icon name="activity" size={16} className="spinning" />
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
                    <Icon name="activity" size={16} className="spinning" />
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