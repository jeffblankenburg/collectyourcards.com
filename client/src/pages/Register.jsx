import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './Auth.css'

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState('')

  const { register } = useAuth()
  const { success, error } = useToast()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Check password strength on password change
    if (name === 'password') {
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

  const validateForm = () => {
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
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      error('Please enter a valid email address')
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
    
    if (!validateForm()) return

    setLoading(true)
    
    try {
      const result = await register({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password
      })

      if (result.success) {
        success(result.message)
        // Redirect to login page
        navigate('/login', { 
          state: { 
            message: 'Registration successful! Please check your email to verify your account.',
            email: formData.email 
          }
        })
      } else {
        error(result.error)
      }
    } catch (err) {
      error('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1><Icon name="app-logo" size={24} /> Collect Your Cards</h1>
          <h2>Create Your Account</h2>
          <p>Join thousands of collectors managing their card collections</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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
              />
            </div>
          </div>

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
            {formData.password && (
              <div className={`password-strength ${passwordStrength}`}>
                <div className="strength-bar"></div>
                <span>Password strength: {passwordStrength}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Confirm your password"
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign In
            </Link>
          </p>
        </div>

        <div className="auth-features">
          <h3>What you'll get:</h3>
          <ul>
            <li>✅ Secure account with email verification</li>
            <li>🗂️ Unlimited card collection management</li>
            <li>📊 Spreadsheet import capabilities</li>
            <li>🛒 eBay purchase tracking</li>
            <li>📈 Collection value insights</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Register