import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AuthScoped.css'

function Auth() {
  const { mode } = useParams() // 'login' or 'signup'
  const location = useLocation()
  
  // Determine auth mode from URL
  const getAuthMode = () => {
    if (mode) return mode
    if (location.pathname === '/register') return 'signup'
    if (location.pathname === '/login') return 'login'
    return 'login' // default
  }
  
  const [authMode, setAuthMode] = useState(getAuthMode())
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('') // 'checking', 'available', 'taken', 'invalid'
  const [usernameMessage, setUsernameMessage] = useState('')

  const { login, register, isAuthenticated } = useAuth()
  const { success, error } = useToast()
  const navigate = useNavigate()

  // Update auth mode when URL changes
  useEffect(() => {
    const newMode = getAuthMode()
    if (newMode !== authMode) {
      setAuthMode(newMode)
      // Clear form when switching modes (but preserve email)
      setFormData(prev => ({
        firstName: '',
        lastName: '',
        email: prev.email, // Keep current email
        username: '',
        password: '',
        confirmPassword: ''
      }))
    }
  }, [mode, location.pathname]) // Remove authMode from dependency array

  // Set page title
  useEffect(() => {
    document.title = authMode === 'signup' ? 'Sign Up - Collect Your Cards' : 'Login - Collect Your Cards'
  }, [authMode])

  // Handle messages from navigation
  useEffect(() => {
    if (location.state?.message) {
      success(location.state.message)
    }
    if (location.state?.email) {
      setFormData(prev => ({ ...prev, email: location.state.email }))
    }
  }, [location.state])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/collection'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location.state])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Check password strength on password change
    if (name === 'password' && authMode === 'signup') {
      checkPasswordStrength(value)
    }

    // Check username availability on username change
    if (name === 'username' && authMode === 'signup') {
      checkUsernameAvailability(value)
    }
  }

  const checkPasswordStrength = (password) => {
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[@$!%*?&]/.test(password)
    const isLongEnough = password.length >= 8
    
    const criteriaCount = [hasUpper, hasLower, hasNumber, hasSpecial, isLongEnough].filter(Boolean).length
    
    if (criteriaCount < 3) {
      setPasswordStrength('weak')
    } else if (criteriaCount < 5) {
      setPasswordStrength('medium')
    } else {
      setPasswordStrength('strong')
    }
  }

  // Debounced username availability check
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

      setUsernameStatus('checking')
      setUsernameMessage('Checking availability...')

      try {
        const response = await axios.get(`/api/auth/check-username/${username}`)
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
    []
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

  const validateLoginForm = () => {
    if (!formData.email.trim()) {
      error('Email is required')
      return false
    }
    if (!formData.password.trim()) {
      error('Password is required')
      return false
    }
    return true
  }

  const validateSignupForm = () => {
    if (!formData.firstName.trim()) {
      error('First name is required')
      return false
    }
    if (!formData.lastName.trim()) {
      error('Last name is required')
      return false
    }
    if (!formData.username.trim()) {
      error('Username is required')
      return false
    }
    if (usernameStatus !== 'available') {
      error('Please choose a valid, available username')
      return false
    }
    if (!formData.email.trim()) {
      error('Email is required')
      return false
    }
    if (!formData.password.trim()) {
      error('Password is required')
      return false
    }
    if (formData.password.length < 8) {
      error('Password must be at least 8 characters long')
      return false
    }
    
    // Check password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    if (!passwordRegex.test(formData.password)) {
      error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      error('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const isValid = authMode === 'login' ? validateLoginForm() : validateSignupForm()
    if (!isValid) return

    setLoading(true)
    
    try {
      if (authMode === 'login') {
        const result = await login(formData.email, formData.password)
        if (result.success) {
          const userName = result.user.name || result.user.first_name || 'there'
          success(`Welcome back, ${userName}!`)
          const from = location.state?.from?.pathname || '/collection'
          navigate(from, { replace: true })
        } else {
          error(result.error)
        }
      } else {
        const result = await register({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword
        })
        if (result.success) {
          // Navigate to check email page with the user's email
          navigate('/check-email', { 
            state: { 
              email: formData.email
            }
          })
        } else {
          error(result.error)
        }
      }
    } catch (err) {
      error(`${authMode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleModeSwitch = (newMode) => {
    navigate(`/auth/${newMode}`, { replace: true })
  }

  const handleForgotPassword = () => {
    if (formData.email) {
      navigate('/forgot-password', { state: { email: formData.email } })
    } else {
      navigate('/forgot-password')
    }
  }

  const isLogin = authMode === 'login'
  const isSignup = authMode === 'signup'

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-mode-toggle">
            <button
              type="button"
              className={`mode-button ${isLogin ? 'active' : ''}`}
              onClick={() => handleModeSwitch('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`mode-button ${isSignup ? 'active' : ''}`}
              onClick={() => handleModeSwitch('signup')}
            >
              Sign Up
            </button>
          </div>
          <p className="auth-subtitle">Sign in or sign up to manage your card collection</p>
        </div>

        <form onSubmit={handleSubmit} className={`auth-form ${isSignup ? 'signup-form' : 'login-form'}`}>
          {isSignup && (
            <>
              <div className="form-group horizontal">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Enter your first name"
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group horizontal">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Enter your last name"
                  autoComplete="family-name"
                />
              </div>
              
              <div className="form-group horizontal">
                <label htmlFor="username">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder="Choose a unique username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9.\-_]{3,30}"
                  />
                  {usernameStatus && (
                    <div className={`username-status ${usernameStatus}`}>
                      {usernameStatus === 'checking' && <div className="card-icon-spinner small"></div>}
                      {usernameStatus === 'available' && <Icon name="check" size={16} />}
                      {usernameStatus === 'taken' && <Icon name="x" size={16} />}
                      {usernameStatus === 'invalid' && <Icon name="alert-circle" size={16} />}
                      <span className="status-text">{usernameMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="form-group horizontal">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>

          <div className="form-group horizontal">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder={isLogin ? 'Enter your password' : 'Create a password (min 8 characters)'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <Icon name="eye" size={16} /> : <Icon name="eye-off" size={16} />}
                </button>
              </div>
              {isSignup && formData.password && (
                <div className={`password-strength ${passwordStrength}`}>
                  <div className="strength-bar">
                    <div className="strength-fill"></div>
                  </div>
                  <span className="strength-text">
                    {passwordStrength === 'weak' && 'Weak - Add uppercase, number, special character'}
                    {passwordStrength === 'medium' && 'Medium - Almost there'}
                    {passwordStrength === 'strong' && 'Strong password ✓'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isSignup && (
            <div className="form-group horizontal">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? <Icon name="eye" size={16} /> : <Icon name="eye-off" size={16} />}
                </button>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="forgot-password-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              isLogin ? 'Signing In...' : 'Creating Account...'
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* {isLogin && (
          <div className="auth-demo">
            <h3>Demo Account</h3>
            <p>Try the platform with our demo account:</p>
            <div className="demo-credentials">
              <p><strong>Email:</strong> cardcollector@jeffblankenburg.com</p>
              <p><strong>Password:</strong> testpassword</p>
            </div>
          </div>
        )} */}
      </div>
    </div>
  )
}

export default Auth