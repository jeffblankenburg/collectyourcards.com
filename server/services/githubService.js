/**
 * GitHub Service for creating issues from feedback submissions
 * Uses GitHub CLI (gh) for authentication and API access
 */

const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

class GitHubService {
  constructor() {
    this.owner = 'jeffblankenburg'
    this.repo = 'collectyourcards.com'
    this.isConfigured = false
    this.checkConfiguration()
  }

  async checkConfiguration() {
    try {
      // Check if gh CLI is available and authenticated
      await execAsync('gh auth status')
      this.isConfigured = true
      console.log('✅ GitHub CLI authenticated and ready')
    } catch (error) {
      console.log('⚠️  GitHub CLI not configured - GitHub issue creation disabled')
      this.isConfigured = false
    }
  }

  getTypeLabel(submissionType) {
    switch (submissionType) {
      case 'bug':
        return 'bug'
      case 'feature':
        return 'enhancement'
      case 'general':
        return 'feedback'
      default:
        return 'feedback'
    }
  }

  getPriorityLabel(priority) {
    switch (priority) {
      case 'critical':
        return 'priority: critical'
      case 'high':
        return 'priority: high'
      case 'medium':
        return 'priority: medium'
      case 'low':
        return 'priority: low'
      default:
        return null
    }
  }

  formatIssueBody(data) {
    const {
      referenceNumber,
      submissionType,
      description,
      email,
      pageUrl,
      priority,
      stepsToReproduce,
      userAgent,
      screenResolution
    } = data

    let body = `## User Feedback Submission

**Reference:** \`${referenceNumber}\`
**Type:** ${submissionType.charAt(0).toUpperCase() + submissionType.slice(1)}
**Priority:** ${priority || 'Medium'}
**Submitted by:** ${email}

---

## Description

${description}
`

    if (stepsToReproduce) {
      body += `
## Steps to Reproduce

${stepsToReproduce}
`
    }

    body += `
## Context

| Field | Value |
|-------|-------|
| Page URL | ${pageUrl} |
| Screen Resolution | ${screenResolution || 'Not provided'} |
| User Agent | ${userAgent ? userAgent.substring(0, 100) + '...' : 'Not provided'} |

---

*This issue was automatically created from user feedback submission \`${referenceNumber}\`*
`

    return body
  }

  async createFeedbackIssue(data) {
    if (!this.isConfigured) {
      console.log('GitHub not configured, skipping issue creation')
      return null
    }

    const { referenceNumber, submissionType, subject } = data

    try {
      const title = `[${submissionType.toUpperCase()}] ${subject} (${referenceNumber})`
      const body = this.formatIssueBody(data)
      const typeLabel = this.getTypeLabel(submissionType)
      const priorityLabel = this.getPriorityLabel(data.priority)

      // Build labels array
      const labels = ['user-feedback', typeLabel]
      if (priorityLabel) {
        labels.push(priorityLabel)
      }

      // Escape the body for shell
      const escapedBody = body.replace(/'/g, "'\\''")
      const escapedTitle = title.replace(/'/g, "'\\''")

      // Create the issue using gh CLI
      const labelArg = labels.map(l => `--label "${l}"`).join(' ')
      const command = `gh issue create --repo ${this.owner}/${this.repo} --title '${escapedTitle}' --body '${escapedBody}' ${labelArg}`

      const { stdout } = await execAsync(command)

      // Parse the issue URL from stdout
      const issueUrl = stdout.trim()
      const issueNumber = parseInt(issueUrl.split('/').pop())

      console.log(`✅ Created GitHub issue #${issueNumber}: ${issueUrl}`)

      return {
        number: issueNumber,
        url: issueUrl
      }

    } catch (error) {
      console.error('Failed to create GitHub issue:', error.message)

      // Try to create without labels if label creation fails
      if (error.message.includes('label')) {
        try {
          const title = `[${submissionType.toUpperCase()}] ${subject} (${referenceNumber})`
          const body = this.formatIssueBody(data)
          const escapedBody = body.replace(/'/g, "'\\''")
          const escapedTitle = title.replace(/'/g, "'\\''")

          const command = `gh issue create --repo ${this.owner}/${this.repo} --title '${escapedTitle}' --body '${escapedBody}'`
          const { stdout } = await execAsync(command)

          const issueUrl = stdout.trim()
          const issueNumber = parseInt(issueUrl.split('/').pop())

          console.log(`✅ Created GitHub issue #${issueNumber} (without labels): ${issueUrl}`)

          return {
            number: issueNumber,
            url: issueUrl
          }
        } catch (retryError) {
          console.error('Failed to create GitHub issue (retry):', retryError.message)
          throw retryError
        }
      }

      throw error
    }
  }

  async addCommentToIssue(issueNumber, comment) {
    if (!this.isConfigured) {
      console.log('GitHub not configured, skipping comment')
      return null
    }

    try {
      const escapedComment = comment.replace(/'/g, "'\\''")
      const command = `gh issue comment ${issueNumber} --repo ${this.owner}/${this.repo} --body '${escapedComment}'`

      await execAsync(command)
      console.log(`✅ Added comment to GitHub issue #${issueNumber}`)

      return true
    } catch (error) {
      console.error(`Failed to add comment to issue #${issueNumber}:`, error.message)
      throw error
    }
  }

  async closeIssue(issueNumber, reason = 'completed') {
    if (!this.isConfigured) {
      console.log('GitHub not configured, skipping issue close')
      return null
    }

    try {
      const reasonArg = reason === 'not_planned' ? '--reason "not planned"' : ''
      const command = `gh issue close ${issueNumber} --repo ${this.owner}/${this.repo} ${reasonArg}`

      await execAsync(command)
      console.log(`✅ Closed GitHub issue #${issueNumber}`)

      return true
    } catch (error) {
      console.error(`Failed to close issue #${issueNumber}:`, error.message)
      throw error
    }
  }

  isAvailable() {
    return this.isConfigured
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      owner: this.owner,
      repo: this.repo
    }
  }
}

module.exports = new GitHubService()
