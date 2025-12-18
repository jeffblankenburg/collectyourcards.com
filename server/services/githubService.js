/**
 * GitHub Service for creating issues from feedback submissions
 * Uses GitHub REST API with Personal Access Token
 */

class GitHubService {
  constructor() {
    this.owner = 'jeffblankenburg'
    this.repo = 'collectyourcards.com'
    this.token = process.env.GITHUB_TOKEN
    this.isConfigured = !!this.token

    if (this.isConfigured) {
      console.log('✅ GitHub API configured and ready')
    } else {
      console.log('⚠️  GITHUB_TOKEN not set - GitHub issue creation disabled')
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

  async apiRequest(endpoint, method = 'GET', body = null) {
    const url = `https://api.github.com${endpoint}`

    const options = {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'CollectYourCards-FeedbackBot'
      }
    }

    if (body) {
      options.headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error ${response.status}: ${errorText}`)
    }

    return response.json()
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

      // Create the issue using GitHub REST API
      const issueData = await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/issues`,
        'POST',
        { title, body, labels }
      )

      console.log(`✅ Created GitHub issue #${issueData.number}: ${issueData.html_url}`)

      return {
        number: issueData.number,
        url: issueData.html_url
      }

    } catch (error) {
      console.error('Failed to create GitHub issue:', error.message)

      // Try to create without labels if label creation fails
      if (error.message.includes('label') || error.message.includes('422')) {
        try {
          const title = `[${submissionType.toUpperCase()}] ${subject} (${referenceNumber})`
          const body = this.formatIssueBody(data)

          const issueData = await this.apiRequest(
            `/repos/${this.owner}/${this.repo}/issues`,
            'POST',
            { title, body }
          )

          console.log(`✅ Created GitHub issue #${issueData.number} (without labels): ${issueData.html_url}`)

          return {
            number: issueData.number,
            url: issueData.html_url
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
      await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
        'POST',
        { body: comment }
      )

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
      const stateReason = reason === 'not_planned' ? 'not_planned' : 'completed'

      await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`,
        'PATCH',
        { state: 'closed', state_reason: stateReason }
      )

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
