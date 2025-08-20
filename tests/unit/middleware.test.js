const jwt = require('jsonwebtoken')

// Mock PrismaClient before requiring auth middleware
const mockPrisma = {
  userSession: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  $disconnect: jest.fn()
}

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  }
})

const { authMiddleware, requireRole, requireAdmin } = require('../../server/middleware/auth')
const createRateLimiter = require('../../server/middleware/rateLimiter')

// Mock response object
const mockResponse = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

// Mock request object
const mockRequest = (overrides = {}) => ({
  header: jest.fn(),
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('test-user-agent'),
  ...overrides
})

describe('Authentication Middleware', () => {
  let req, res, next

  beforeAll(() => {
    // Set JWT secret for tests
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
  })

  beforeEach(() => {
    req = mockRequest()
    res = mockResponse()
    next = jest.fn()
    jest.clearAllMocks()
    
    // Reset prisma mocks
    mockPrisma.userSession.findFirst.mockReset()
    mockPrisma.userSession.update.mockReset()
  })

  afterAll(async () => {
    await mockPrisma.$disconnect()
  })

  describe('authMiddleware', () => {
    it('should reject request without Authorization header', async () => {
      req.header.mockReturnValue(null)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'No valid token provided'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject request with malformed Authorization header', async () => {
      req.header.mockReturnValue('InvalidHeader')

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'No valid token provided'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject request with invalid JWT token', async () => {
      req.header.mockReturnValue('Bearer invalid-jwt-token')

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Invalid or expired token'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle valid JWT but no session found', async () => {
      // Create a valid JWT token
      const payload = { userId: '999', email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, process.env.JWT_SECRET)
      req.header.mockReturnValue(`Bearer ${token}`)

      // Mock Prisma to return no session
      mockPrisma.userSession.findFirst.mockResolvedValue(null)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Session not found or expired'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject inactive user', async () => {
      const payload = { userId: '1', email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, process.env.JWT_SECRET)
      req.header.mockReturnValue(`Bearer ${token}`)

      // Mock session with inactive user
      const mockSession = {
        session_id: BigInt(1),
        user: {
          user_id: BigInt(1),
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          is_active: false,
          is_verified: true
        }
      }

      mockPrisma.userSession.findFirst.mockResolvedValue(mockSession)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Account deactivated',
        message: 'Your account has been deactivated'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject unverified user', async () => {
      const payload = { userId: '1', email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, process.env.JWT_SECRET)
      req.header.mockReturnValue(`Bearer ${token}`)

      // Mock session with unverified user
      const mockSession = {
        session_id: BigInt(1),
        user: {
          user_id: BigInt(1),
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          is_active: true,
          is_verified: false
        }
      }

      mockPrisma.userSession.findFirst.mockResolvedValue(mockSession)

      await authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Email not verified',
        message: 'Please verify your email address'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should accept valid authentication and call next', async () => {
      const payload = { userId: '1', email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, process.env.JWT_SECRET)
      req.header.mockReturnValue(`Bearer ${token}`)

      // Mock valid session
      const mockSession = {
        session_id: BigInt(1),
        user: {
          user_id: BigInt(1),
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          is_active: true,
          is_verified: true
        }
      }

      mockPrisma.userSession.findFirst.mockResolvedValue(mockSession)
      mockPrisma.userSession.update.mockResolvedValue({})

      await authMiddleware(req, res, next)

      expect(req.user).toEqual({
        userId: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        is_verified: true
      })
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('requireRole middleware', () => {
    beforeEach(() => {
      // Mock authenticated user
      req.user = {
        userId: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        is_verified: true
      }
    })

    it('should allow user with correct role', () => {
      const middleware = requireRole('user', 'admin')
      
      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should reject user without required role', () => {
      const middleware = requireRole('admin', 'superadmin')
      
      middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        message: 'This action requires one of the following roles: admin, superadmin'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated request', () => {
      req.user = null
      const middleware = requireRole('user')
      
      middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('requireAdmin middleware', () => {
    it('should allow admin user', () => {
      req.user = {
        userId: '1',
        email: 'admin@example.com',
        role: 'admin'
      }

      requireAdmin(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('should allow superadmin user', () => {
      req.user = {
        userId: '1',
        email: 'superadmin@example.com',
        role: 'superadmin'
      }

      requireAdmin(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('should reject regular user', () => {
      req.user = {
        userId: '1',
        email: 'user@example.com',
        role: 'user'
      }

      requireAdmin(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })
  })
})

describe('Rate Limiter Middleware', () => {
  it('should create rate limiter with default options', () => {
    const limiter = createRateLimiter()
    
    expect(limiter).toBeDefined()
    expect(typeof limiter).toBe('function')
  })

  it('should create rate limiter with custom options', () => {
    const customOptions = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 50,
      message: 'Custom rate limit message'
    }
    
    const limiter = createRateLimiter(customOptions)
    
    expect(limiter).toBeDefined()
    expect(typeof limiter).toBe('function')
  })
})