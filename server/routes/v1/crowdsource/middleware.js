const rateLimit = require('express-rate-limit')
const { authMiddleware } = require('../../../middleware/auth')

// Rate limiting for submissions
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 submissions per hour
  message: { error: 'Too many submissions', message: 'Please wait before submitting more edits' },
  standardHeaders: true,
  legacyHeaders: false
})

// Admin check middleware
const adminCheck = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin', 'data_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' })
  }
  next()
}

module.exports = {
  authMiddleware,
  submissionLimiter,
  adminCheck
}
