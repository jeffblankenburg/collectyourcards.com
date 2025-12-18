const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')
const emailService = require('../services/emailService')
const githubService = require('../services/githubService')
const rateLimit = require('express-rate-limit')

const router = express.Router()

// Rate limiting for feedback submissions
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 submissions per hour
  message: { error: 'Too many feedback submissions', message: 'Please wait before submitting more feedback' },
  standardHeaders: true,
  legacyHeaders: false
})

// Generate unique reference number
async function generateReferenceNumber() {
  const prefix = 'FB'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  let referenceNumber = `${prefix}-${timestamp}${random}`

  // Ensure uniqueness (very unlikely to collide but just in case)
  let attempts = 0
  while (attempts < 5) {
    const existing = await prisma.feedback_submission.findUnique({
      where: { reference_number: referenceNumber }
    })
    if (!existing) break
    referenceNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    attempts++
  }

  return referenceNumber
}

// Optional auth - will attach user if logged in, but not required
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    return next()
  }

  // Try to authenticate, but don't fail if it doesn't work
  try {
    await authMiddleware(req, res, () => {
      next()
    })
  } catch (error) {
    // If auth fails, just continue without user
    next()
  }
}

// Submit feedback (public endpoint with optional auth)
router.post('/',
  feedbackLimiter,
  optionalAuth,
  body('submission_type').isIn(['bug', 'feature', 'general']).withMessage('Invalid submission type'),
  body('subject').isLength({ min: 3, max: 255 }).trim().withMessage('Subject must be 3-255 characters'),
  body('description').isLength({ min: 10 }).trim().withMessage('Description must be at least 10 characters'),
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Valid email is required'),
  body('page_url').isLength({ min: 1, max: 500 }).withMessage('Page URL is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('steps_to_reproduce').optional().isLength({ max: 5000 }),
  body('console_logs').optional().isLength({ max: 100000 }),
  body('screen_resolution').optional().isLength({ max: 50 }),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const {
        submission_type,
        subject,
        description,
        email,
        page_url,
        user_agent,
        screen_resolution,
        console_logs,
        priority,
        steps_to_reproduce
      } = req.body

      // Generate reference number
      const referenceNumber = await generateReferenceNumber()

      // Get user ID if authenticated
      const userId = req.user?.userId ? BigInt(req.user.userId) : null

      // Create the feedback submission
      const submission = await prisma.feedback_submission.create({
        data: {
          reference_number: referenceNumber,
          submission_type,
          subject,
          description,
          email,
          user_id: userId,
          page_url,
          user_agent: user_agent || req.headers['user-agent']?.substring(0, 500),
          screen_resolution,
          console_logs,
          priority: priority || 'medium',
          steps_to_reproduce,
          status: 'new'
        }
      })

      // Create GitHub issue (async, don't block response)
      let githubIssue = null
      try {
        githubIssue = await githubService.createFeedbackIssue({
          referenceNumber,
          submissionType: submission_type,
          subject,
          description,
          email,
          pageUrl: page_url,
          priority: priority || 'medium',
          stepsToReproduce: steps_to_reproduce,
          userAgent: user_agent || req.headers['user-agent'],
          screenResolution: screen_resolution
        })

        // Update submission with GitHub issue info
        if (githubIssue) {
          await prisma.feedback_submission.update({
            where: { feedback_id: submission.feedback_id },
            data: {
              github_issue_number: githubIssue.number,
              github_issue_url: githubIssue.url
            }
          })
        }
      } catch (githubError) {
        console.error('Failed to create GitHub issue:', githubError.message)
        // Continue without GitHub issue - we'll send email anyway
      }

      // Send confirmation email to user
      try {
        await emailService.sendFeedbackConfirmation(
          email,
          referenceNumber,
          submission_type,
          subject,
          githubIssue?.url
        )
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError.message)
        // Don't fail the request if email fails
      }

      // Send notification email to admin
      try {
        await emailService.sendFeedbackAdminNotification({
          referenceNumber,
          submissionType: submission_type,
          subject,
          description,
          email,
          pageUrl: page_url,
          priority: priority || 'medium',
          githubIssueUrl: githubIssue?.url
        })
      } catch (adminEmailError) {
        console.error('Failed to send admin notification:', adminEmailError.message)
      }

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          reference_number: referenceNumber,
          github_issue_url: githubIssue?.url || null
        }
      })

    } catch (error) {
      console.error('Error submitting feedback:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to submit feedback. Please try again.'
      })
    }
  }
)

// Get submission status by reference number (public)
router.get('/status/:referenceNumber', async (req, res) => {
  try {
    const { referenceNumber } = req.params

    const submission = await prisma.feedback_submission.findUnique({
      where: { reference_number: referenceNumber },
      select: {
        reference_number: true,
        submission_type: true,
        subject: true,
        status: true,
        github_issue_url: true,
        created_at: true,
        resolved_at: true
      }
    })

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback submission not found'
      })
    }

    res.json({
      success: true,
      data: submission
    })

  } catch (error) {
    console.error('Error fetching feedback status:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch feedback status'
    })
  }
})

module.exports = router
