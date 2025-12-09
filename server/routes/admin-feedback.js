const express = require('express')
const { body, validationResult } = require('express-validator')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const emailService = require('../services/emailService')
const githubService = require('../services/githubService')

const router = express.Router()

// All routes require auth + admin role
router.use(authMiddleware)
router.use(requireAdmin)

// Get all feedback submissions with filtering
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = 50,
      offset = 0
    } = req.query

    // Build where clause
    const where = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (type && type !== 'all') {
      where.submission_type = type
    }
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { description: { contains: search } },
        { email: { contains: search } },
        { reference_number: { contains: search } }
      ]
    }

    // Get total count
    const total = await prisma.feedback_submission.count({ where })

    // Get submissions
    const submissions = await prisma.feedback_submission.findMany({
      where,
      orderBy: { [sort_by]: sort_order },
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        user: {
          select: {
            user_id: true,
            username: true,
            email: true,
            avatar_url: true
          }
        },
        resolver: {
          select: {
            user_id: true,
            username: true,
            first_name: true,
            last_name: true
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    })

    // Serialize BigInt values
    const serialized = submissions.map(s => ({
      ...s,
      feedback_id: Number(s.feedback_id),
      user_id: s.user_id ? Number(s.user_id) : null,
      resolved_by: s.resolved_by ? Number(s.resolved_by) : null,
      response_count: s._count.responses,
      user: s.user ? {
        ...s.user,
        user_id: Number(s.user.user_id)
      } : null,
      resolver: s.resolver ? {
        ...s.resolver,
        user_id: Number(s.resolver.user_id)
      } : null
    }))

    res.json({
      success: true,
      data: serialized,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

  } catch (error) {
    console.error('Error fetching feedback submissions:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch feedback submissions'
    })
  }
})

// Get feedback stats
router.get('/stats', async (req, res) => {
  try {
    // Get counts by status
    const statusCounts = await prisma.feedback_submission.groupBy({
      by: ['status'],
      _count: { status: true }
    })

    // Get counts by type
    const typeCounts = await prisma.feedback_submission.groupBy({
      by: ['submission_type'],
      _count: { submission_type: true }
    })

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentCount = await prisma.feedback_submission.count({
      where: {
        created_at: { gte: thirtyDaysAgo }
      }
    })

    // Get average resolution time (for resolved items in last 30 days)
    const resolvedItems = await prisma.feedback_submission.findMany({
      where: {
        status: 'resolved',
        resolved_at: { gte: thirtyDaysAgo }
      },
      select: {
        created_at: true,
        resolved_at: true
      }
    })

    let avgResolutionHours = null
    if (resolvedItems.length > 0) {
      const totalHours = resolvedItems.reduce((sum, item) => {
        const hours = (item.resolved_at - item.created_at) / (1000 * 60 * 60)
        return sum + hours
      }, 0)
      avgResolutionHours = Math.round(totalHours / resolvedItems.length)
    }

    // Format status counts
    const byStatus = {}
    statusCounts.forEach(s => {
      byStatus[s.status] = s._count.status
    })

    // Format type counts
    const byType = {}
    typeCounts.forEach(t => {
      byType[t.submission_type] = t._count.submission_type
    })

    res.json({
      success: true,
      data: {
        by_status: byStatus,
        by_type: byType,
        recent_30_days: recentCount,
        avg_resolution_hours: avgResolutionHours,
        total: Object.values(byStatus).reduce((a, b) => a + b, 0)
      }
    })

  } catch (error) {
    console.error('Error fetching feedback stats:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch feedback statistics'
    })
  }
})

// Get single feedback submission
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const submission = await prisma.feedback_submission.findUnique({
      where: { feedback_id: BigInt(id) },
      include: {
        user: {
          select: {
            user_id: true,
            username: true,
            email: true,
            avatar_url: true,
            first_name: true,
            last_name: true
          }
        },
        resolver: {
          select: {
            user_id: true,
            username: true,
            first_name: true,
            last_name: true
          }
        },
        responses: {
          include: {
            responder: {
              select: {
                user_id: true,
                username: true,
                first_name: true,
                last_name: true,
                avatar_url: true
              }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    })

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback submission not found'
      })
    }

    // Serialize BigInt values
    const serialized = {
      ...submission,
      feedback_id: Number(submission.feedback_id),
      user_id: submission.user_id ? Number(submission.user_id) : null,
      resolved_by: submission.resolved_by ? Number(submission.resolved_by) : null,
      user: submission.user ? {
        ...submission.user,
        user_id: Number(submission.user.user_id)
      } : null,
      resolver: submission.resolver ? {
        ...submission.resolver,
        user_id: Number(submission.resolver.user_id)
      } : null,
      responses: submission.responses.map(r => ({
        ...r,
        response_id: Number(r.response_id),
        feedback_id: Number(r.feedback_id),
        responder_id: Number(r.responder_id),
        responder: r.responder ? {
          ...r.responder,
          user_id: Number(r.responder.user_id)
        } : null
      }))
    }

    res.json({
      success: true,
      data: serialized
    })

  } catch (error) {
    console.error('Error fetching feedback submission:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch feedback submission'
    })
  }
})

// Update feedback status
router.put('/:id/status',
  body('status').isIn(['new', 'in_review', 'in_progress', 'resolved', 'closed', 'wont_fix']),
  body('admin_notes').optional().isString(),
  body('notify_user').optional().isBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const { id } = req.params
      const { status, admin_notes, notify_user = true } = req.body

      // Get current submission
      const submission = await prisma.feedback_submission.findUnique({
        where: { feedback_id: BigInt(id) }
      })

      if (!submission) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feedback submission not found'
        })
      }

      // Prepare update data
      const updateData = {
        status,
        updated_at: new Date()
      }

      if (admin_notes !== undefined) {
        updateData.admin_notes = admin_notes
      }

      // Set resolved fields if status is resolved/closed/wont_fix
      if (['resolved', 'closed', 'wont_fix'].includes(status) && !submission.resolved_at) {
        updateData.resolved_at = new Date()
        updateData.resolved_by = BigInt(req.user.userId)
      }

      // Update the submission
      const updated = await prisma.feedback_submission.update({
        where: { feedback_id: BigInt(id) },
        data: updateData
      })

      // Send notification email to user if requested
      if (notify_user && submission.email) {
        try {
          await emailService.sendFeedbackStatusUpdate(
            submission.email,
            submission.reference_number,
            submission.subject,
            status,
            admin_notes,
            submission.github_issue_url
          )
        } catch (emailError) {
          console.error('Failed to send status update email:', emailError.message)
        }
      }

      // Close GitHub issue if status is resolved/closed/wont_fix
      if (['resolved', 'closed', 'wont_fix'].includes(status) && submission.github_issue_number) {
        try {
          const reason = status === 'wont_fix' ? 'not_planned' : 'completed'
          await githubService.closeIssue(submission.github_issue_number, reason)
        } catch (githubError) {
          console.error('Failed to close GitHub issue:', githubError.message)
        }
      }

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: {
          ...updated,
          feedback_id: Number(updated.feedback_id),
          user_id: updated.user_id ? Number(updated.user_id) : null,
          resolved_by: updated.resolved_by ? Number(updated.resolved_by) : null
        }
      })

    } catch (error) {
      console.error('Error updating feedback status:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to update feedback status'
      })
    }
  }
)

// Add response to feedback
router.post('/:id/respond',
  body('message').isLength({ min: 1 }).trim().withMessage('Message is required'),
  body('is_internal').optional().isBoolean(),
  body('send_email').optional().isBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: errors.array()[0].msg
        })
      }

      const { id } = req.params
      const { message, is_internal = false, send_email = true } = req.body

      // Get the submission
      const submission = await prisma.feedback_submission.findUnique({
        where: { feedback_id: BigInt(id) }
      })

      if (!submission) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Feedback submission not found'
        })
      }

      // Create the response
      const response = await prisma.feedback_response.create({
        data: {
          feedback_id: BigInt(id),
          responder_id: BigInt(req.user.userId),
          message,
          is_internal
        },
        include: {
          responder: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true
            }
          }
        }
      })

      // Update submission timestamp
      await prisma.feedback_submission.update({
        where: { feedback_id: BigInt(id) },
        data: { updated_at: new Date() }
      })

      // Send email if not internal and email requested
      if (!is_internal && send_email && submission.email) {
        try {
          const responderName = response.responder.first_name
            ? `${response.responder.first_name} ${response.responder.last_name || ''}`.trim()
            : response.responder.username || 'CYC Team'

          await emailService.sendFeedbackResponse(
            submission.email,
            submission.reference_number,
            submission.subject,
            message,
            responderName,
            submission.github_issue_url
          )
        } catch (emailError) {
          console.error('Failed to send response email:', emailError.message)
        }
      }

      // Add comment to GitHub issue if not internal
      if (!is_internal && submission.github_issue_number) {
        try {
          const responderName = response.responder.first_name
            ? `${response.responder.first_name} ${response.responder.last_name || ''}`.trim()
            : response.responder.username || 'CYC Team'

          await githubService.addCommentToIssue(
            submission.github_issue_number,
            `**Response from ${responderName}:**\n\n${message}`
          )
        } catch (githubError) {
          console.error('Failed to add GitHub comment:', githubError.message)
        }
      }

      res.status(201).json({
        success: true,
        message: 'Response added successfully',
        data: {
          ...response,
          response_id: Number(response.response_id),
          feedback_id: Number(response.feedback_id),
          responder_id: Number(response.responder_id),
          responder: response.responder ? {
            ...response.responder,
            user_id: Number(response.responder.user_id)
          } : null
        }
      })

    } catch (error) {
      console.error('Error adding feedback response:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to add response'
      })
    }
  }
)

// Manually create GitHub issue for submission
router.post('/:id/github', async (req, res) => {
  try {
    const { id } = req.params

    const submission = await prisma.feedback_submission.findUnique({
      where: { feedback_id: BigInt(id) }
    })

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback submission not found'
      })
    }

    if (submission.github_issue_number) {
      return res.status(400).json({
        error: 'Already exists',
        message: 'GitHub issue already exists for this submission'
      })
    }

    // Create GitHub issue
    const githubIssue = await githubService.createFeedbackIssue({
      referenceNumber: submission.reference_number,
      submissionType: submission.submission_type,
      subject: submission.subject,
      description: submission.description,
      email: submission.email,
      pageUrl: submission.page_url,
      priority: submission.priority,
      stepsToReproduce: submission.steps_to_reproduce,
      userAgent: submission.user_agent,
      screenResolution: submission.screen_resolution
    })

    if (!githubIssue) {
      return res.status(500).json({
        error: 'GitHub error',
        message: 'Failed to create GitHub issue'
      })
    }

    // Update submission with GitHub info
    await prisma.feedback_submission.update({
      where: { feedback_id: BigInt(id) },
      data: {
        github_issue_number: githubIssue.number,
        github_issue_url: githubIssue.url,
        updated_at: new Date()
      }
    })

    res.json({
      success: true,
      message: 'GitHub issue created successfully',
      data: {
        issue_number: githubIssue.number,
        issue_url: githubIssue.url
      }
    })

  } catch (error) {
    console.error('Error creating GitHub issue:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create GitHub issue'
    })
  }
})

// Resend confirmation email
router.post('/:id/resend-confirmation', async (req, res) => {
  try {
    const { id } = req.params

    const submission = await prisma.feedback_submission.findUnique({
      where: { feedback_id: BigInt(id) }
    })

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback submission not found'
      })
    }

    await emailService.sendFeedbackConfirmation(
      submission.email,
      submission.reference_number,
      submission.submission_type,
      submission.subject,
      submission.github_issue_url
    )

    res.json({
      success: true,
      message: 'Confirmation email resent successfully'
    })

  } catch (error) {
    console.error('Error resending confirmation email:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to resend confirmation email'
    })
  }
})

// Delete feedback submission (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const submission = await prisma.feedback_submission.findUnique({
      where: { feedback_id: BigInt(id) }
    })

    if (!submission) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Feedback submission not found'
      })
    }

    // Delete the submission (responses will cascade delete)
    await prisma.feedback_submission.delete({
      where: { feedback_id: BigInt(id) }
    })

    res.json({
      success: true,
      message: 'Feedback submission deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting feedback submission:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete feedback submission'
    })
  }
})

module.exports = router
