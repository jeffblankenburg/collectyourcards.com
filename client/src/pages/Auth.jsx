import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './Auth.css'

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
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState('')

  const { login, register, isAuthenticated } = useAuth()
  const { success, error } = useToast()
  const navigate = useNavigate()

  // Update auth mode when URL changes
  useEffect(() => {
    const newMode = getAuthMode()
    if (newMode !== authMode) {
      setAuthMode(newMode)
      // Clear form when switching modes
      setFormData({
        firstName: '',
        lastName: '',
        email: formData.email, // Keep email
        password: '',
        confirmPassword: ''
      })
    }
  }, [mode, location.pathname])

  // Handle messages from navigation
  useEffect(() => {
    if (location.state?.message) {
      success(location.state.message)
    }
    if (location.state?.email) {
      setFormData(prev => ({ ...prev, email: location.state.email }))
    }
  }, [location.state, success])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard'
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
  }

  const checkPasswordStrength = (password) => {
    if (password.length < 6) {
      setPasswordStrength('weak')
    } else if (password.length < 10) {
      setPasswordStrength('medium')
    } else {
      setPasswordStrength('strong')
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
    if (!formData.email.trim()) {
      error('Email is required')
      return false
    }
    if (!formData.password.trim()) {
      error('Password is required')
      return false
    }
    if (formData.password.length < 6) {
      error('Password must be at least 6 characters long')
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
          const from = location.state?.from?.pathname || '/dashboard'
          navigate(from, { replace: true })
        } else {
          error(result.error)
        }
      } else {
        const result = await register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
        })
        if (result.success) {
          success('Account created successfully! Please check your email to verify your account.')
          navigate('/auth/login', { 
            state: { 
              email: formData.email,
              message: 'Account created! Check your email for verification instructions.'
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
          <h1><Icon name="app-logo" size={24} /> Collect Your Cards</h1>
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
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Sign in to manage your card collection' : 'Start tracking your card collection today'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup && (
            <>
              <div className="form-row">
                <div className="form-group">
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
                <div className="form-group">
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
              </div>
            </>
          )}

          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder={isLogin ? 'Enter your password' : 'Create a password (min 6 characters)'}
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
                  {passwordStrength === 'weak' && 'Weak password'}
                  {passwordStrength === 'medium' && 'Medium strength'}
                  {passwordStrength === 'strong' && 'Strong password'}
                </span>
              </div>
            )}
          </div>

          {isSignup && (
            <div className="form-group">
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

        {isLogin && (
          <div className="auth-demo">
            <h3>Demo Account</h3>
            <p>Try the platform with our demo account:</p>
            <div className="demo-credentials">
              <p><strong>Email:</strong> cardcollector@jeffblankenburg.com</p>
              <p><strong>Password:</strong> testpassword</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Auth