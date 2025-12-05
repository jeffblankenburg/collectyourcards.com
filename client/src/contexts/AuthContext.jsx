import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { trackLogin, trackLogout, trackSignup } from '../utils/analytics'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if user is logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      // Verify token is still valid
      checkAuthStatus()
    } else {
      setLoading(false)
    }
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('/api/auth/profile')
      const userData = response.data.user
      setUser(userData)
      setIsAuthenticated(true)

      // Store user in localStorage for logging and persistence
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      console.error('Auth check failed:', error)
      logout() // Clear invalid token
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      })

      const { token, user: userData } = response.data

      // Store token and user
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Update state
      setUser(userData)
      setIsAuthenticated(true)

      // Track login in Google Analytics
      trackLogin('email')

      return { success: true, user: userData }
    } catch (error) {
      console.error('Login failed:', error)
      const message = error.response?.data?.message || 'Login failed'
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData)

      // Track signup in Google Analytics
      trackSignup('email')

      return {
        success: true,
        message: response.data.message || 'Registration successful! Please check your email to verify your account.'
      }
    } catch (error) {
      console.error('Registration failed:', error)
      const message = error.response?.data?.message || 'Registration failed'
      return { success: false, error: message }
    }
  }

  const logout = () => {
    // Track logout in Google Analytics (before clearing state)
    trackLogout()

    // Remove token and user
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']

    // Clear state
    setUser(null)
    setIsAuthenticated(false)

    // Optional: Call backend logout endpoint
    axios.post('/api/auth/logout').catch(() => {
      // Ignore errors on logout
    })
  }

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/api/auth/forgot-password', { email })
      return { 
        success: true, 
        message: response.data.message || 'Password reset email sent!'
      }
    } catch (error) {
      console.error('Forgot password failed:', error)
      const message = error.response?.data?.message || 'Failed to send reset email'
      return { success: false, error: message }
    }
  }

  const resetPassword = async (token, newPassword) => {
    try {
      const response = await axios.post('/api/auth/reset-password', {
        token,
        password: newPassword
      })
      return { 
        success: true, 
        message: response.data.message || 'Password reset successful!'
      }
    } catch (error) {
      console.error('Password reset failed:', error)
      const message = error.response?.data?.message || 'Password reset failed'
      return { success: false, error: message }
    }
  }

  const verifyEmail = async (token) => {
    try {
      const response = await axios.post('/api/auth/verify-email', { token })
      return { 
        success: true, 
        message: response.data.message || 'Email verified successfully!'
      }
    } catch (error) {
      console.error('Email verification failed:', error)
      const message = error.response?.data?.message || 'Email verification failed'
      return { success: false, error: message }
    }
  }

  const resendVerification = async (email) => {
    try {
      const response = await axios.post('/api/auth/resend-verification', { email })
      return { 
        success: true, 
        message: response.data.message || 'Verification email sent!'
      }
    } catch (error) {
      console.error('Resend verification failed:', error)
      const message = error.response?.data?.message || 'Failed to resend verification email'
      return { success: false, error: message }
    }
  }

  const updateUserAvatar = (avatarUrl) => {
    if (user) {
      setUser(prevUser => ({
        ...prevUser,
        avatar_url: avatarUrl
      }))
    }
  }

  const setAuth = (authData) => {
    if (authData && authData.token && authData.user) {
      // Store token and user
      localStorage.setItem('token', authData.token)
      localStorage.setItem('user', JSON.stringify(authData.user))

      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`

      // Update state
      setUser(authData.user)
      setIsAuthenticated(true)
      setLoading(false)
    }
  }

  // Computed property for admin check
  const isAdmin = user?.role === 'admin'

  const value = {
    user,
    isAuthenticated,
    isAdmin,
    loading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    checkAuthStatus,
    updateUserAvatar,
    setAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext