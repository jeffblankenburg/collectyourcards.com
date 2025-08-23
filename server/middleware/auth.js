const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No valid token provided'
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid or expired token'
      })
    }

    // Check if session exists and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const session = await prisma.user_session.findFirst({
      where: {
        user_id: BigInt(decoded.userId),
        token_hash: tokenHash,
        expires_at: {
          gt: new Date()
        }
      }
    })

    if (!session) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Session not found or expired'
      })
    }

    // Get user details separately
    const user = await prisma.user.findUnique({
      where: { user_id: session.user_id },
      select: {
        user_id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true
      }
    })

    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not found'
      })
    }

    // Check if user is still active and verified
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated'
      })
    }

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email address'
      })
    }

    // Update session last accessed time
    await prisma.user_session.update({
      where: { session_id: session.session_id },
      data: { last_accessed: new Date() }
    })

    // Add user info to request object
    req.user = {
      userId: user.user_id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      is_verified: user.is_verified
    }

    next()

  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(500).json({
      error: 'Authentication error',
      message: 'An internal error occurred during authentication'
    })
  }
}

// Role-based authorization middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      })
    }

    next()
  }
}

// Admin-only middleware
const requireAdmin = requireRole('admin', 'superadmin')

// Data admin or higher middleware
const requireDataAdmin = requireRole('data_admin', 'admin', 'superadmin')

// Super admin only middleware
const requireSuperAdmin = requireRole('superadmin')

module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireDataAdmin,
  requireSuperAdmin
}