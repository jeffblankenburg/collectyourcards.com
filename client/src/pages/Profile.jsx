import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Profile.css'

function Profile() {
  const { user, logout, checkAuthStatus } = useAuth()
  const { success, error } = useToast()

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: ''
  })
  const [loading, setLoading] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState(false)

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.name ? user.name.split(' ')[0] || '' : user.first_name || '',
        lastName: user.name ? user.name.split(' ').slice(1).join(' ') || '' : user.last_name || '',
        email: user.email || '',
        role: user.role || ''
      })
    }
  }, [user])

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // In a real app, you'd have an update profile endpoint
      success('Profile updated successfully!')
      await checkAuthStatus() // Refresh user data
    } catch (err) {
      error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      error('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      error('New password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      // In a real app, you'd have a change password endpoint
      success('Password changed successfully!')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err) {
      error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    success('Logged out successfully')
  }

  const getRoleBadge = (role) => {
    const roleConfig = {
      'superadmin': { label: 'Super Admin', color: '#dc3545', icon: '👑' },
      'admin': { label: 'Admin', color: '#fd7e14', icon: '🔧' },
      'data_admin': { label: 'Data Admin', color: '#0d6efd', icon: '📊' },
      'user': { label: 'User', color: '#198754', icon: '👤' }
    }
    
    const config = roleConfig[role] || roleConfig['user']
    
    return (
      <span 
        className="role-badge" 
        style={{ backgroundColor: config.color }}
      >
        {config.icon} {config.label}
      </span>
    )
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <h2>Please log in to view your profile</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <span className="avatar-initials">
              {(user.name || user.first_name || 'U')
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </span>
          </div>
          <div className="profile-info">
            <h1>{user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'}</h1>
            <p className="profile-email">{user.email}</p>
            {getRoleBadge(user.role)}
          </div>
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            🚪 Logout
          </button>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h2>👤 Profile Information</h2>
            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleProfileChange}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleProfileChange}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  disabled={true} // Email typically can't be changed easily
                />
                <small>Contact support to change your email address</small>
              </div>

              <button
                type="submit"
                className="profile-button"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </div>

          <div className="profile-section">
            <h2>🔒 Change Password</h2>
            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    id="currentPassword"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords(!showPasswords)}
                    disabled={loading}
                  >
                    {showPasswords ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="profile-button secondary"
                disabled={loading}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>

          <div className="profile-section">
            <h2>📊 Account Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Member Since</h3>
                <p>{new Date(user.created_at || Date.now()).toLocaleDateString()}</p>
              </div>
              <div className="stat-card">
                <h3>Email Status</h3>
                <p className={user.email_verified ? 'verified' : 'unverified'}>
                  {user.email_verified ? '✅ Verified' : '❌ Unverified'}
                </p>
              </div>
              <div className="stat-card">
                <h3>Collections</h3>
                <p>0 collections</p>
              </div>
              <div className="stat-card">
                <h3>Total Cards</h3>
                <p>0 cards</p>
              </div>
            </div>
          </div>

          <div className="profile-section danger-zone">
            <h2>⚠️ Danger Zone</h2>
            <div className="danger-actions">
              <button className="danger-button" disabled>
                🗑️ Delete Account
              </button>
              <p>Account deletion is coming soon. Contact support for assistance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile