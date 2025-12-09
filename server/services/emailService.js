const { EmailClient } = require('@azure/communication-email')
const telemetryService = require('./telemetryService')

class EmailService {
  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'DoNotReply@collectyourcards.com'
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5174'
    this.client = null
    this.isConfigured = false
    
    // Initialize email client with error handling
    try {
      const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING
      if (connectionString && connectionString.trim() !== '') {
        this.client = new EmailClient(connectionString)
        this.isConfigured = true
        console.log('✅ Azure Communication Services email client initialized')
      } else {
        console.log('⚠️  Azure Communication Services not configured - email features disabled')
      }
    } catch (error) {
      console.error('❌ Failed to initialize Azure Communication Services:', error.message)
      console.log('📧 Email features will be disabled')
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    if (!this.isConfigured || !this.client) {
      console.log(`📧 Email would be sent to ${to}: ${subject} (Email service not configured)`)
      return { 
        success: false, 
        error: 'Email service not configured',
        mockSent: true 
      }
    }

    try {
      const emailMessage = {
        senderAddress: this.fromEmail,
        recipients: {
          to: [{ address: to }]
        },
        content: {
          subject: subject,
          html: htmlContent,
          plainText: textContent || this.stripHtml(htmlContent)
        }
      }

      const poller = await this.client.beginSend(emailMessage)
      const result = await poller.pollUntilDone()

      console.log('Email sent successfully:', result.id)

      // Track successful email event
      telemetryService.trackEmailEvent('sent', to, subject, true, {
        email_id: result.id
      })

      return result

    } catch (error) {
      console.error('Email sending failed:', error)

      // Track failed email event
      telemetryService.trackEmailEvent('failed', to, subject, false, {
        error: error.message
      })

      throw new Error(`Failed to send email: ${error.message}`)
    }
  }

  async sendVerificationEmail(email, name, verificationToken) {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${verificationToken}`
    
    const subject = 'Verify Your Email - Collect Your Cards'
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎴 Collect Your Cards</h1>
            <h2>Welcome to Your Collection Journey!</h2>
          </div>
          <div class="content">
            <h3>Hi ${name || 'there'}!</h3>
            <p>Thank you for creating an account with Collect Your Cards - the ultimate sports card collection management platform.</p>
            
            <p>To complete your registration and start building your digital card collection, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify My Email</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px; font-family: monospace;">${verificationUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons. If you didn't create this account, please ignore this email.
            </div>
            
            <p>Once verified, you'll be able to:</p>
            <ul>
              <li>🃏 Manage your sports card collection digitally</li>
              <li>📊 Import cards from spreadsheets</li>
              <li>🛒 Track eBay purchases automatically</li>
              <li>📈 Monitor card values and trends</li>
              <li>📍 Organize cards by location</li>
            </ul>
            
            <p>If you have any questions, feel free to contact our support team.</p>
            
            <p>Welcome to the community!</p>
            <p><strong>The Collect Your Cards Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}. If you didn't sign up for Collect Your Cards, you can safely ignore this email.</p>
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, subject, htmlContent)
  }

  async sendPasswordResetEmail(email, name, resetToken) {
    const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`
    
    const subject = 'Password Reset Request - Collect Your Cards'
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .info { background: #e8f4fd; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎴 Collect Your Cards</h1>
            <h2>Password Reset Request</h2>
          </div>
          <div class="content">
            <h3>Hi ${name || 'there'}!</h3>
            <p>We received a request to reset the password for your Collect Your Cards account (${email}).</p>
            
            <p>If you made this request, click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 3px; font-family: monospace;">${resetUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This password reset link will expire in 1 hour for your security. If you didn't request this password reset, please ignore this email - your account remains secure.
            </div>
            
            <div class="info">
              <strong>💡 Security Tips:</strong>
              <ul>
                <li>Choose a strong password with at least 8 characters</li>
                <li>Include uppercase letters, lowercase letters, numbers, and special characters</li>
                <li>Don't reuse passwords from other accounts</li>
                <li>Consider using a password manager</li>
              </ul>
            </div>
            
            <p>If you continue to have trouble accessing your account, please contact our support team.</p>
            
            <p><strong>The Collect Your Cards Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}. If you didn't request a password reset, you can safely ignore this email.</p>
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, subject, htmlContent)
  }

  async sendWelcomeEmail(email, name) {
    const subject = 'Welcome to Collect Your Cards!'
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎴 Welcome to Collect Your Cards!</h1>
            <p>Your digital card collection journey starts now</p>
          </div>
          <div class="content">
            <h3>Hi ${name}!</h3>
            <p>Congratulations! Your email has been verified and your account is now active. You're ready to start building your ultimate sports card collection digitally.</p>
            
            <div style="text-align: center;">
              <a href="${this.baseUrl}" class="button">Start Managing Your Collection</a>
            </div>
            
            <h4>Here's what you can do with Collect Your Cards:</h4>
            
            <div class="feature">
              <h4>🃏 Digital Collection Management</h4>
              <p>Track every card in your collection with detailed information including condition, value, and location.</p>
            </div>
            
            <div class="feature">
              <h4>📊 Spreadsheet Import</h4>
              <p>Bulk import your existing card data from Excel or CSV files with intelligent matching.</p>
            </div>
            
            <div class="feature">
              <h4>🛒 eBay Integration</h4>
              <p>Automatically track your eBay purchases and add sports cards to your collection.</p>
            </div>
            
            <div class="feature">
              <h4>📈 Value Tracking</h4>
              <p>Monitor the estimated value of your collection and individual cards over time.</p>
            </div>
            
            <div class="feature">
              <h4>📍 Location Management</h4>
              <p>Organize your physical cards by location (boxes, binders, etc.) and always know where to find them.</p>
            </div>
            
            <p>Ready to get started? Log in to your account and begin adding your first cards!</p>
            
            <p>If you need help getting started, check out our documentation or contact support.</p>
            
            <p>Happy collecting!</p>
            <p><strong>The Collect Your Cards Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, subject, htmlContent)
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }

  async sendFeedbackConfirmation(email, referenceNumber, submissionType, subject, githubIssueUrl) {
    const typeLabels = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      general: 'General Feedback'
    }

    const emailSubject = `We received your feedback! [Reference: ${referenceNumber}]`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Feedback Received</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .info-box { background: #e8f4fd; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .summary-box { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .summary-item { display: flex; margin: 8px 0; }
          .summary-label { font-weight: bold; width: 100px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You!</h1>
            <p>We received your feedback</p>
          </div>
          <div class="content">
            <h3>Hi there!</h3>
            <p>Thank you for taking the time to submit your ${typeLabels[submissionType] || 'feedback'}! Your input helps us improve Collect Your Cards for everyone.</p>

            <div class="summary-box">
              <h4 style="margin-top: 0;">Your Submission</h4>
              <div class="summary-item">
                <span class="summary-label">Type:</span>
                <span>${typeLabels[submissionType] || submissionType}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Subject:</span>
                <span>${subject}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Reference:</span>
                <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 3px;">${referenceNumber}</span>
              </div>
            </div>

            ${githubIssueUrl ? `
            <div class="info-box">
              <strong>Track Your Submission</strong>
              <p style="margin-bottom: 0;">We've created a public issue to track this. You can follow along, add comments, or see updates here:</p>
            </div>

            <div style="text-align: center;">
              <a href="${githubIssueUrl}" class="button">View on GitHub</a>
            </div>

            <p style="text-align: center; font-size: 14px; color: #666;">
              Or copy this link: <br>
              <span style="word-break: break-all;">${githubIssueUrl}</span>
            </p>
            ` : `
            <div class="info-box">
              <strong>What Happens Next?</strong>
              <p style="margin-bottom: 0;">Our team will review your submission and you'll receive an email when we update the status.</p>
            </div>
            `}

            <h4>What Happens Next?</h4>
            <ul>
              <li>We review all submissions within 48 hours</li>
              <li>You'll receive an email when we update the status</li>
              ${githubIssueUrl ? '<li>Feel free to add more details by commenting on the GitHub issue</li>' : ''}
            </ul>

            <p>Thanks for helping us improve Collect Your Cards!</p>
            <p><strong>— The CYC Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email} regarding feedback submission ${referenceNumber}.</p>
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, emailSubject, htmlContent)
  }

  async sendFeedbackAdminNotification(data) {
    const { referenceNumber, submissionType, subject, description, email, pageUrl, priority, githubIssueUrl } = data
    const adminEmail = process.env.ADMIN_EMAIL || 'cardcollector@jeffblankenburg.com'

    const typeLabels = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      general: 'General Feedback'
    }

    const priorityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    }

    const emailSubject = `[${submissionType.toUpperCase()}] New Feedback: ${subject} (${referenceNumber})`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Feedback Submission</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2d3748; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 5px 10px 0; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; color: white; font-weight: bold; font-size: 12px; }
          .type-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; background: #667eea; color: white; font-size: 12px; }
          .detail-box { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">New Feedback Submission</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.8;">${referenceNumber}</p>
          </div>
          <div class="content">
            <div style="margin-bottom: 20px;">
              <span class="type-badge">${typeLabels[submissionType]}</span>
              <span class="priority-badge" style="background: ${priorityColors[priority] || priorityColors.medium}">${(priority || 'medium').toUpperCase()}</span>
            </div>

            <h3 style="margin-top: 0;">${subject}</h3>

            <div class="detail-box">
              <div class="detail-label">Description</div>
              <p style="margin: 0; white-space: pre-wrap;">${description}</p>
            </div>

            <div class="detail-box">
              <div class="detail-label">Submitted By</div>
              <p style="margin: 0;"><a href="mailto:${email}">${email}</a></p>
            </div>

            <div class="detail-box">
              <div class="detail-label">Page URL</div>
              <p style="margin: 0;"><a href="${pageUrl}">${pageUrl}</a></p>
            </div>

            <div style="margin-top: 20px;">
              <a href="${this.baseUrl}/admin/feedback" class="button">View in Admin</a>
              ${githubIssueUrl ? `<a href="${githubIssueUrl}" class="button" style="background: #24292e;">View GitHub Issue</a>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(adminEmail, emailSubject, htmlContent)
  }

  async sendFeedbackStatusUpdate(email, referenceNumber, subject, newStatus, resolverNote, githubIssueUrl) {
    const statusMessages = {
      in_review: {
        title: "We're Looking Into It",
        message: "Your feedback is currently being reviewed by our team.",
        color: '#3498db'
      },
      in_progress: {
        title: "We're Working On It!",
        message: "Great news! We've started working on addressing your feedback.",
        color: '#9b59b6'
      },
      resolved: {
        title: 'Issue Resolved',
        message: "We've addressed your feedback. Thank you for helping us improve!",
        color: '#27ae60'
      },
      closed: {
        title: 'Feedback Closed',
        message: "This feedback submission has been closed.",
        color: '#7f8c8d'
      },
      wont_fix: {
        title: 'Status Update',
        message: "After careful consideration, we've decided not to implement this change at this time.",
        color: '#e74c3c'
      }
    }

    const status = statusMessages[newStatus] || statusMessages.closed
    const emailSubject = `Update on your feedback: ${subject} [${referenceNumber}]`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Feedback Status Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${status.color}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .note-box { background: white; border-left: 4px solid ${status.color}; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${status.title}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${referenceNumber}</p>
          </div>
          <div class="content">
            <h3>Regarding: ${subject}</h3>
            <p>${status.message}</p>

            ${resolverNote ? `
            <div class="note-box">
              <strong>Note from our team:</strong>
              <p style="margin: 10px 0 0 0;">${resolverNote}</p>
            </div>
            ` : ''}

            ${githubIssueUrl ? `
            <div style="text-align: center;">
              <a href="${githubIssueUrl}" class="button">View Full Details on GitHub</a>
            </div>
            ` : ''}

            <p>Thank you for your patience and for helping us improve Collect Your Cards!</p>
            <p><strong>— The CYC Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email} regarding feedback submission ${referenceNumber}.</p>
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, emailSubject, htmlContent)
  }

  async sendFeedbackResponse(email, referenceNumber, subject, responseMessage, responderName, githubIssueUrl) {
    const emailSubject = `Response to your feedback: ${subject} [${referenceNumber}]`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response to Your Feedback</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .response-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">We've Responded!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${referenceNumber}</p>
          </div>
          <div class="content">
            <h3>Regarding: ${subject}</h3>

            <div class="response-box">
              <p style="margin: 0; white-space: pre-wrap;">${responseMessage}</p>
              <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;"><em>— ${responderName || 'The CYC Team'}</em></p>
            </div>

            ${githubIssueUrl ? `
            <p>You can continue the conversation or see the full history on GitHub:</p>
            <div style="text-align: center;">
              <a href="${githubIssueUrl}" class="button">View on GitHub</a>
            </div>
            ` : ''}

            <p>Thank you for being part of the Collect Your Cards community!</p>
            <p><strong>— The CYC Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email} regarding feedback submission ${referenceNumber}.</p>
            <p>&copy; 2025 Collect Your Cards. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail(email, emailSubject, htmlContent)
  }

  // Check if email service is available
  isAvailable() {
    return this.isConfigured && this.client !== null
  }

  // Get email service status
  getStatus() {
    return {
      configured: this.isConfigured,
      available: this.isAvailable(),
      fromEmail: this.fromEmail,
      baseUrl: this.baseUrl
    }
  }
}

module.exports = new EmailService()