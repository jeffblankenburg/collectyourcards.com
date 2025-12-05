const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { prisma } = require('../config/prisma-singleton')

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization')
    console.log('Auth check for:', req.method, req.path, 'Header present:', !!authHeader)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid auth header:', authHeader)
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
        is_verified: true,
        seller_role: true,
        seller_expires: true
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
      is_verified: user.is_verified,
      seller_role: user.seller_role,
      seller_expires: user.seller_expires
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

// Seller access middleware
// Allows access if: admin role OR (has seller_role AND not expired)
const requireSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    })
  }

  // Admins always have seller access
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next()
  }

  // Check if user has a seller role
  if (!req.user.seller_role) {
    return res.status(403).json({
      error: 'Seller access required',
      message: 'You do not have access to seller tools'
    })
  }

  // Check expiration if set
  if (req.user.seller_expires && new Date(req.user.seller_expires) < new Date()) {
    return res.status(403).json({
      error: 'Seller access expired',
      message: 'Your seller access has expired'
    })
  }

  next()
}

// Seller role tier middleware - requires specific seller role levels
const requireSellerRole = (...allowedSellerRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      })
    }

    // Admins always have full access
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      return next()
    }

    // Check if user has required seller role
    if (!req.user.seller_role || !allowedSellerRoles.includes(req.user.seller_role)) {
      return res.status(403).json({
        error: 'Insufficient seller permissions',
        message: `This action requires one of the following seller roles: ${allowedSellerRoles.join(', ')}`
      })
    }

    // Check expiration
    if (req.user.seller_expires && new Date(req.user.seller_expires) < new Date()) {
      return res.status(403).json({
        error: 'Seller access expired',
        message: 'Your seller access has expired'
      })
    }

    next()
  }
}

// Optional authentication middleware - sets req.user if token exists, but doesn't require it
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization')
    console.log('Optional auth - Authorization header:', authHeader ? 'Present' : 'Missing')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Optional auth - No valid auth header, proceeding without user')
      req.user = null
      return next()
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('JWT decoded:', { userId: decoded.userId, email: decoded.email })
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError.message)
      req.user = null
      return next()
    }

    // Get user from database
    const userId = parseInt(decoded.userId) // Convert string to number
    console.log('Looking up user with ID:', userId, typeof userId)
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        is_verified: true
      }
    })

    if (!user || !user.is_active) {
      console.log('User not found or inactive:', { found: !!user, active: user?.is_active })
      req.user = null
      return next()
    }

    console.log('User found and active:', user.email)
    // Add user info to request
    req.user = {
      id: Number(user.user_id), // Convert BigInt to Number for consistency
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      emailVerified: user.is_verified
    }

    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    req.user = null
    next()
  }
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireDataAdmin,
  requireSuperAdmin,
  requireSeller,
  requireSellerRole
}