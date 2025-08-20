const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { body, validationResult } = require('express-validator')
const { PrismaClient } = require('@prisma/client')
const emailService = require('../services/emailService')
const { authMiddleware } = require('../middleware/auth')
const rateLimiter = require('../middleware/rateLimiter')
const dynatraceService = require('../services/dynatraceService')

const router = express.Router()

// Initialize Prisma with error handling for production
let prisma
let databaseAvailable = false

try {
  prisma = new PrismaClient()
  databaseAvailable = true
  console.log('✅ Database connection initialized for auth routes')
} catch (error) {
  console.error('❌ Database connection failed for auth routes:', error.message)
  databaseAvailable = false
}

// Enhanced rate limiting for auth endpoints
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 100 : 5, // More lenient for tests
  message: 'Too many authentication attempts, please try again later.'
})

const strictAuthLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 100 : 3, // More lenient for tests
  message: 'Too many sensitive authentication requests, please try again later.'
})

// Utility functions
const generateToken = () => crypto.randomBytes(32).toString('hex')

const createJWT = (user) => {
  return jwt.sign(
    { 
      userId: user.user_id.toString(),
      email: user.email,
      role: user.role,
      verified: user.is_verified
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
}

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12)
}

const logAuthEvent = async (email, eventType, success, errorMessage = null, userId = null, req = null) => {
  try {
    // Log to database
    await prisma.userAuthLog.create({
      data: {
        user_id: userId,
        email,
        event_type: eventType,
        ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
        user_agent: req?.get('User-Agent')?.substring(0, 500) || 'unknown',
        success,
        error_message: errorMessage
      }
    })

    // Track in Dynatrace
    dynatraceService.trackAuthEvent(eventType, userId, email, success, {
      ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
      userAgent: req?.get('User-Agent') || 'unknown',
      error: errorMessage
    })
  } catch (error) {
    console.error('Failed to log auth event:', error)
  }
}

const isAccountLocked = (user) => {
  return user.locked_until && new Date() < user.locked_until
}

const shouldLockAccount = (loginAttempts) => {
  return loginAttempts >= 5
}

// User Registration
router.post('/register', 
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password')
        }
        return true
      })
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        await logAuthEvent(req.body.email, 'registration_failed', false, 'Validation errors', null, req)
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { email, password, name } = req.body

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        await logAuthEvent(email, 'registration_failed', false, 'Email already registered', null, req)
        return res.status(409).json({
          error: 'Registration failed',
          message: 'An account with this email already exists'
        })
      }

      // Hash password and generate verification token
      const passwordHash = await hashPassword(password)
      const verificationToken = generateToken()

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          name,
          role: 'user',
          is_active: true,
          is_verified: false,
          verification_token: verificationToken
        }
      })

      // Send verification email
      try {
        await emailService.sendVerificationEmail(email, name, verificationToken)
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Don't fail registration if email fails, but log it
        await logAuthEvent(email, 'verification_email_failed', false, emailError.message, user.user_id, req)
      }

      await logAuthEvent(email, 'registration_success', true, null, user.user_id, req)

      res.status(201).json({
        message: 'Registration successful',
        details: 'Please check your email to verify your account before logging in.',
        user: {
          id: user.user_id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          is_verified: false
        }
      })

    } catch (error) {
      console.error('Registration error:', error)
      await logAuthEvent(req.body.email, 'registration_failed', false, error.message, null, req)
      res.status(500).json({
        error: 'Registration failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// User Login
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        await logAuthEvent(req.body.email, 'login_failed', false, 'Validation errors', null, req)
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { email, password } = req.body

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        await logAuthEvent(email, 'login_failed', false, 'User not found', null, req)
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        })
      }

      // Check if account is locked
      if (isAccountLocked(user)) {
        await logAuthEvent(email, 'login_failed', false, 'Account locked', user.user_id, req)
        return res.status(423).json({
          error: 'Account locked',
          message: 'Account is temporarily locked due to too many failed login attempts. Please try again later or reset your password.',
          locked_until: user.locked_until
        })
      }

      // Check if account is active
      if (!user.is_active) {
        await logAuthEvent(email, 'login_failed', false, 'Account deactivated', user.user_id, req)
        return res.status(403).json({
          error: 'Account deactivated',
          message: 'Your account has been deactivated. Please contact support.'
        })
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      
      if (!isValidPassword) {
        // Increment login attempts
        const newAttempts = user.login_attempts + 1
        const shouldLock = shouldLockAccount(newAttempts)
        
        await prisma.user.update({
          where: { user_id: user.user_id },
          data: {
            login_attempts: newAttempts,
            locked_until: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null // Lock for 30 minutes
          }
        })

        await logAuthEvent(email, 'login_failed', false, 'Invalid password', user.user_id, req)
        
        const message = shouldLock 
          ? 'Too many failed login attempts. Account has been temporarily locked.'
          : 'Invalid email or password'
        
        return res.status(401).json({
          error: 'Authentication failed',
          message
        })
      }

      // Check if email is verified
      if (!user.is_verified) {
        await logAuthEvent(email, 'login_failed', false, 'Email not verified', user.user_id, req)
        return res.status(403).json({
          error: 'Email not verified',
          message: 'Please verify your email address before logging in. Check your email for the verification link.',
          can_resend_verification: true
        })
      }

      // Successful login - reset login attempts and update last login
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          login_attempts: 0,
          locked_until: null,
          last_login: new Date()
        }
      })

      // Create JWT token
      const token = createJWT(user)

      // Create session record using raw SQL to handle schema mismatch
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
      const userAgent = req.get('User-Agent')?.substring(0, 500) || 'unknown'
      
      await prisma.$executeRaw`
        INSERT INTO user_session (user_id, session_token, token_hash, expires_at, ip_address, user_agent, last_accessed, created)
        VALUES (${user.user_id}, ${token}, ${tokenHash}, ${expiresAt}, ${ipAddress}, ${userAgent}, ${new Date()}, ${new Date()})
      `

      await logAuthEvent(email, 'login_success', true, null, user.user_id, req)

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.user_id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          is_verified: user.is_verified,
          last_login: user.last_login
        }
      })

    } catch (error) {
      console.error('Login error:', error)
      await logAuthEvent(req.body.email, 'login_failed', false, error.message, null, req)
      res.status(500).json({
        error: 'Login failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// Email Verification
router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { token } = req.body

      // Find user with verification token
      const user = await prisma.user.findFirst({
        where: {
          verification_token: token,
          is_verified: false
        }
      })

      if (!user) {
        await logAuthEvent('unknown', 'email_verification_failed', false, 'Invalid token', null, req)
        return res.status(400).json({
          error: 'Verification failed',
          message: 'Invalid or expired verification token'
        })
      }

      // Verify email
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          is_verified: true,
          verification_token: null
        }
      })

      await logAuthEvent(user.email, 'email_verified', true, null, user.user_id, req)

      res.json({
        message: 'Email verification successful',
        details: 'Your email has been verified. You can now log in to your account.'
      })

    } catch (error) {
      console.error('Email verification error:', error)
      res.status(500).json({
        error: 'Verification failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// Resend Verification Email
router.post('/resend-verification',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { email } = req.body

      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          message: 'If an account with this email exists and is not yet verified, a verification email has been sent.'
        })
      }

      if (user.is_verified) {
        return res.json({
          message: 'Account is already verified'
        })
      }

      // Generate new verification token
      const verificationToken = generateToken()
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { verification_token: verificationToken }
      })

      // Send verification email
      try {
        await emailService.sendVerificationEmail(email, user.name, verificationToken)
        await logAuthEvent(email, 'verification_email_sent', true, null, user.user_id, req)
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        await logAuthEvent(email, 'verification_email_failed', false, emailError.message, user.user_id, req)
      }

      res.json({
        message: 'If an account with this email exists and is not yet verified, a verification email has been sent.'
      })

    } catch (error) {
      console.error('Resend verification error:', error)
      res.status(500).json({
        error: 'Request failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// Request Password Reset
router.post('/forgot-password',
  strictAuthLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { email } = req.body

      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          message: 'If an account with this email exists, a password reset email has been sent.'
        })
      }

      // Generate reset token (expires in 1 hour)
      const resetToken = generateToken()
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          reset_token: resetToken,
          reset_token_expires: resetExpires
        }
      })

      // Send password reset email
      try {
        await emailService.sendPasswordResetEmail(email, user.name, resetToken)
        await logAuthEvent(email, 'password_reset_requested', true, null, user.user_id, req)
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError)
        await logAuthEvent(email, 'password_reset_email_failed', false, emailError.message, user.user_id, req)
      }

      res.json({
        message: 'If an account with this email exists, a password reset email has been sent.'
      })

    } catch (error) {
      console.error('Password reset request error:', error)
      res.status(500).json({
        error: 'Request failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// Reset Password
router.post('/reset-password',
  strictAuthLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password')
        }
        return true
      })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        })
      }

      const { token, password } = req.body

      // Find user with valid reset token
      const user = await prisma.user.findFirst({
        where: {
          reset_token: token,
          reset_token_expires: {
            gt: new Date()
          }
        }
      })

      if (!user) {
        await logAuthEvent('unknown', 'password_reset_failed', false, 'Invalid or expired token', null, req)
        return res.status(400).json({
          error: 'Reset failed',
          message: 'Invalid or expired reset token'
        })
      }

      // Hash new password
      const passwordHash = await hashPassword(password)

      // Update user password and clear reset token
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          password_hash: passwordHash,
          reset_token: null,
          reset_token_expires: null,
          login_attempts: 0,
          locked_until: null
        }
      })

      // Invalidate all existing sessions
      await prisma.userSession.deleteMany({
        where: { user_id: user.user_id }
      })

      await logAuthEvent(user.email, 'password_reset_success', true, null, user.user_id, req)

      res.json({
        message: 'Password reset successful',
        details: 'Your password has been updated. Please log in with your new password.'
      })

    } catch (error) {
      console.error('Password reset error:', error)
      res.status(500).json({
        error: 'Reset failed',
        message: 'An internal error occurred. Please try again later.'
      })
    }
  }
)

// Get Current User Profile (Protected Route)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: BigInt(req.user.userId) },
      select: {
        user_id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
        last_login: true,
        created: true
      }
    })

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      })
    }

    res.json({
      user: {
        id: user.user_id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        is_verified: user.is_verified,
        last_login: user.last_login,
        created: user.created
      }
    })

  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({
      error: 'Failed to fetch profile'
    })
  }
})

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      
      // Delete the session
      await prisma.userSession.deleteMany({
        where: {
          user_id: BigInt(req.user.userId),
          token_hash: tokenHash
        }
      })
    }

    await logAuthEvent(req.user.email, 'logout', true, null, BigInt(req.user.userId), req)

    res.json({
      message: 'Logout successful'
    })

  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      error: 'Logout failed'
    })
  }
})

// Logout All Sessions
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    // Delete all sessions for the user
    await prisma.userSession.deleteMany({
      where: { user_id: BigInt(req.user.userId) }
    })

    await logAuthEvent(req.user.email, 'logout_all', true, null, BigInt(req.user.userId), req)

    res.json({
      message: 'All sessions logged out successfully'
    })

  } catch (error) {
    console.error('Logout all error:', error)
    res.status(500).json({
      error: 'Logout all failed'
    })
  }
})

module.exports = router