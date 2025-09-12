const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { EmailClient } = require('@azure/communication-email')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

// Initialize Azure Communication Services Email Client
const emailConnectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING
const emailClient = emailConnectionString ? new EmailClient(emailConnectionString) : null

// Debug logging for development
if (!emailConnectionString) {
  console.warn('Azure Communication Services connection string not found. Email features will be disabled.')
} else {
  console.log('✅ Azure Communication Services email client initialized')
}

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// GET /api/admin/users - Get list of all users
router.get('/users', async (req, res) => {
  try {
    // Get users with their card collection counts using raw SQL for better performance
    const usersWithCounts = await prisma.$queryRawUnsafe(`
      SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.is_verified,
        u.created,
        u.last_login,
        u.login_attempts,
        ISNULL(COUNT(uc.user_card_id), 0) as card_count
      FROM [user] u
      LEFT JOIN user_card uc ON u.user_id = uc.[user]
      GROUP BY u.user_id, u.username, u.first_name, u.last_name, u.name, u.email, 
               u.role, u.is_active, u.is_verified, u.created, u.last_login, u.login_attempts
      ORDER BY u.created DESC
    `)

    // Convert BigInt to Number for JSON serialization
    const serializedUsers = usersWithCounts.map(user => ({
      ...user,
      user_id: Number(user.user_id),
      login_attempts: user.login_attempts ? Number(user.login_attempts) : 0,
      card_count: Number(user.card_count) || 0
    }))

    res.json({
      users: serializedUsers,
      total: serializedUsers.length
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch users'
    })
  }
})

// POST /api/admin/users - Create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, role } = req.body

    // Validate required fields
    if (!email || !email.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email is required'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid email format'
      })
    }

    // Check for email uniqueness
    const emailExists = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim()
      }
    })

    if (emailExists) {
      return res.status(409).json({
        error: 'Email conflict',
        message: 'Email address is already in use'
      })
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 12)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        name: name?.trim() || null,
        email: email.trim().toLowerCase(),
        role: role || 'user',
        password_hash: passwordHash,
        is_active: true,
        is_verified: false, // Will be verified when they set their password
        created: new Date(),
        created_at: new Date()
      },
      select: {
        user_id: true,
        username: true,
        first_name: true,
        last_name: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        is_verified: true,
        created: true
      }
    })

    // Log admin action
    await prisma.admin_action_log.create({
      data: {
        user_id: BigInt(req.user.userId),
        action_type: 'CREATE',
        entity_type: 'user',
        entity_id: Number(newUser.user_id).toString(),
        new_values: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        created: new Date()
      }
    })

    // Automatically send password reset email
    if (emailClient) {
      try {
        // Generate password reset token
        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        // Save reset token to database
        await prisma.user.update({
          where: { user_id: newUser.user_id },
          data: {
            reset_token: resetToken,
            reset_token_expires: resetTokenExpires
          }
        })

        // Create reset URL
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://collectyourcards.com' 
          : 'http://localhost:5173'
        const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`

        // Send welcome email with password setup
        const emailContent = {
          senderAddress: process.env.EMAIL_FROM || 'DoNotReply@collectyourcards.com',
          content: {
            subject: 'Welcome to Collect Your Cards - Set Your Password',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Welcome to Collect Your Cards</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                  .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>🃏 Collect Your Cards</h1>
                  <h2>Welcome to the Community!</h2>
                </div>
                
                <div class="content">
                  <p>Hello ${newUser.name || 'there'},</p>
                  
                  <p>An administrator has created an account for you on Collect Your Cards with the email address: <strong>${newUser.email}</strong></p>
                  
                  <p>To get started, you'll need to set up your password by clicking the button below:</p>
                  
                  <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Set Your Password</a>
                  </p>
                  
                  <div class="info">
                    <strong>📋 Your Account Details:</strong>
                    <ul>
                      <li><strong>Email:</strong> ${newUser.email}</li>
                      <li><strong>Role:</strong> ${newUser.role}</li>
                      <li><strong>Status:</strong> Active (pending password setup)</li>
                    </ul>
                  </div>
                  
                  <p><strong>Important:</strong> This setup link will expire in 24 hours. If you need a new link, contact an administrator.</p>
                  
                  <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                  <p style="word-break: break-all; font-family: monospace; background: #e9ecef; padding: 10px; border-radius: 4px;">
                    ${resetUrl}
                  </p>
                </div>
                
                <div class="footer">
                  <p>This email was sent automatically. Please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Collect Your Cards. All rights reserved.</p>
                </div>
              </body>
              </html>
            `
          },
          recipients: {
            to: [{ address: newUser.email }]
          }
        }

        const poller = await emailClient.beginSend(emailContent)
        await poller.pollUntilDone()
        console.log('Welcome email sent to new user:', newUser.email)

      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        // Don't fail user creation if email fails
      }
    }

    // Serialize BigInt for JSON response
    const serializedUser = {
      ...newUser,
      user_id: Number(newUser.user_id)
    }

    res.status(201).json({
      message: 'User created successfully. Welcome email sent.',
      user: serializedUser
    })

  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create user',
      details: error.message
    })
  }
})

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // Validate user ID
    const userId = parseInt(id)
    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      })
    }

    // Validate required fields
    if (!updateData.email || !updateData.email.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email is required'
      })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) }
    })

    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      })
    }

    // Check for email uniqueness (if email is being changed)
    if (updateData.email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: updateData.email.toLowerCase(),
          user_id: { not: BigInt(userId) }
        }
      })

      if (emailExists) {
        return res.status(409).json({
          error: 'Email conflict',
          message: 'Email address is already in use by another user'
        })
      }
    }

    // Prepare update data
    const cleanUpdateData = {
      name: updateData.name?.trim() || null,
      email: updateData.email.trim().toLowerCase(),
      role: updateData.role || 'user',
      is_active: updateData.is_active ?? true,
      is_verified: updateData.is_verified ?? false,
      updated_at: new Date()
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: cleanUpdateData,
      select: {
        user_id: true,
        username: true,
        first_name: true,
        last_name: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        is_verified: true,
        created: true,
        last_login: true,
        login_attempts: true,
        updated_at: true
      }
    })

    // Log admin action
    await prisma.admin_action_log.create({
      data: {
        user_id: BigInt(req.user.userId),
        action_type: 'UPDATE',
        entity_type: 'user',
        entity_id: userId.toString(),
        new_values: JSON.stringify(cleanUpdateData),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        created: new Date()
      }
    })

    // Serialize BigInt for JSON response
    const serializedUser = {
      ...updatedUser,
      user_id: Number(updatedUser.user_id),
      login_attempts: updatedUser.login_attempts ? Number(updatedUser.login_attempts) : 0
    }

    res.json({
      message: 'User updated successfully',
      user: serializedUser
    })

  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update user',
      details: error.message
    })
  }
})

// POST /api/admin/users/:id/reset-password - Send password reset email
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params

    // Validate user ID
    const userId = parseInt(id)
    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      })
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      select: {
        user_id: true,
        username: true,
        first_name: true,
        last_name: true,
        name: true,
        email: true,
        is_active: true
      }
    })

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      })
    }

    if (!targetUser.is_active) {
      return res.status(400).json({
        error: 'User inactive',
        message: 'Cannot send password reset to inactive user'
      })
    }

    // Check if email service is available
    if (!emailClient) {
      console.warn('Password reset requested but email service not configured')
      return res.status(503).json({
        error: 'Email service unavailable',
        message: 'Email service is not configured. Please contact your system administrator to set up Azure Communication Services.',
        details: 'The AZURE_COMMUNICATION_CONNECTION_STRING environment variable is not set.'
      })
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpires = new Date(Date.now() + 3600000) // 1 hour from now

    // Save reset token to database
    await prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires
      }
    })

    // Create reset URL
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://collectyourcards.com' 
      : 'http://localhost:5173'
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`

    // Prepare email content
    const emailContent = {
      senderAddress: process.env.EMAIL_FROM || 'DoNotReply@collectyourcards.com',
      content: {
        subject: 'Password Reset - Collect Your Cards',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Password Reset</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .warning { background: #fef3cd; border: 1px solid #faebcc; padding: 15px; border-radius: 4px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🃏 Collect Your Cards</h1>
              <h2>Password Reset Request</h2>
            </div>
            
            <div class="content">
              <p>Hello ${targetUser.name || 'User'},</p>
              
              <p>An administrator has requested a password reset for your account (${targetUser.email}).</p>
              
              <p>Click the button below to create a new password:</p>
              
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Your Password</a>
              </p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this reset, you can safely ignore this email</li>
                  <li>Your current password will remain unchanged until you use this link</li>
                </ul>
              </div>
              
              <p>If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="word-break: break-all; font-family: monospace; background: #e9ecef; padding: 10px; border-radius: 4px;">
                ${resetUrl}
              </p>
            </div>
            
            <div class="footer">
              <p>This email was sent automatically. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Collect Your Cards. All rights reserved.</p>
            </div>
          </body>
          </html>
        `
      },
      recipients: {
        to: [{ address: targetUser.email }]
      }
    }

    // Send email
    console.log('Attempting to send email to:', targetUser.email)
    const poller = await emailClient.beginSend(emailContent)
    const result = await poller.pollUntilDone()
    console.log('Email send result:', result)

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'PASSWORD_RESET_SENT',
          entity_type: 'user',
          entity_id: userId.toString(),
          new_values: JSON.stringify({ target_email: targetUser.email }),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
      // Don't fail the request if logging fails
    }

    res.json({
      message: 'Password reset email sent successfully',
      email: targetUser.email
    })

  } catch (error) {
    console.error('Error sending password reset email:', error)
    res.status(500).json({
      error: 'Email service error',
      message: 'Failed to send password reset email',
      details: error.message
    })
  }
})

module.exports = router