// Mock email service for testing
class MockEmailService {
  async sendEmail(to, subject, htmlContent, textContent = null) {
    console.log(`Mock email sent to: ${to}`)
    console.log(`Subject: ${subject}`)
    return { id: 'mock-email-id', status: 'sent' }
  }

  async sendVerificationEmail(email, name, verificationToken) {
    console.log(`Mock verification email sent to: ${email} with token: ${verificationToken}`)
    return { id: 'mock-verification-email-id', status: 'sent' }
  }

  async sendPasswordResetEmail(email, name, resetToken) {
    console.log(`Mock password reset email sent to: ${email} with token: ${resetToken}`)
    return { id: 'mock-reset-email-id', status: 'sent' }
  }

  async sendWelcomeEmail(email, name) {
    console.log(`Mock welcome email sent to: ${email}`)
    return { id: 'mock-welcome-email-id', status: 'sent' }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }
}

module.exports = new MockEmailService()