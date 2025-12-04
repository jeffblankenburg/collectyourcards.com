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