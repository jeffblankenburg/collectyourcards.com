import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './Auth.css'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const { login, isAuthenticated } = useAuth()
  const { success, error, info } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Show message from registration or other sources
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
  }

  const validateForm = () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    
    try {
      const result = await login(formData.email, formData.password)

      if (result.success) {
        const userName = result.user.name || result.user.first_name || 'there'
        success(`Welcome back, ${userName}!`)
        // Navigate to intended destination or dashboard
        const from = location.state?.from?.pathname || '/dashboard'
        navigate(from, { replace: true })
      } else {
        error(result.error)
      }
    } catch (err) {
      error('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    if (formData.email) {
      navigate('/forgot-password', { state: { email: formData.email } })
    } else {
      navigate('/forgot-password')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1><Icon name="app-logo" size={24} /> Collect Your Cards</h1>
          <h2>Welcome Back</h2>
          <p>Sign in to manage your card collection</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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
                placeholder="Enter your password"
                autoComplete="current-password"
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
          </div>

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

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create Account
            </Link>
          </p>
        </div>

        <div className="auth-demo">
          <h3>Demo Account</h3>
          <p>Try the platform with our demo account:</p>
          <div className="demo-credentials">
            <p><strong>Email:</strong> cardcollector@jeffblankenburg.com</p>
            <p><strong>Password:</strong> testpassword</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login