/**
 * Progress Tracking Service
 *
 * Manages job progress tracking for long-running import operations.
 * In production, this should be replaced with Redis or a database-backed solution.
 *
 * @module services/import/progress-tracker
 */

class ProgressTracker {
  constructor() {
    // In-memory store (consider Redis for production)
    this.jobs = new Map()
  }

  /**
   * Create a new tracking job
   *
   * @param {string} prefix - Job prefix (e.g., 'match', 'import')
   * @returns {string} - Unique job ID
   */
  createJob(prefix = 'job') {
    const jobId = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.jobs.set(jobId, {
      total: 0,
      processed: 0,
      status: 'initializing',
      currentCard: null,
      createdAt: new Date()
    })

    return jobId
  }

  /**
   * Update job progress
   *
   * @param {string} jobId - Job identifier
   * @param {Object} update - Progress update
   * @param {number} [update.total] - Total items to process
   * @param {number} [update.processed] - Items processed so far
   * @param {string} [update.status] - Current status
   * @param {string} [update.currentCard] - Current item being processed
   */
  updateProgress(jobId, { total, processed, status, currentCard }) {
    const current = this.jobs.get(jobId) || {}

    this.jobs.set(jobId, {
      ...current,
      ...(total !== undefined && { total }),
      ...(processed !== undefined && { processed }),
      ...(status !== undefined && { status }),
      ...(currentCard !== undefined && { currentCard }),
      updatedAt: new Date()
    })
  }

  /**
   * Get job progress
   *
   * @param {string} jobId - Job identifier
   * @returns {Object} - Job progress data
   */
  getProgress(jobId) {
    return this.jobs.get(jobId) || {
      total: 0,
      processed: 0,
      status: 'not_found'
    }
  }

  /**
   * Mark job as completed
   *
   * @param {string} jobId - Job identifier
   * @param {Object} result - Final result data
   */
  complete(jobId, result = {}) {
    const current = this.jobs.get(jobId) || {}

    this.jobs.set(jobId, {
      ...current,
      status: 'completed',
      result,
      completedAt: new Date()
    })
  }

  /**
   * Mark job as failed
   *
   * @param {string} jobId - Job identifier
   * @param {Error|string} error - Error that caused failure
   */
  fail(jobId, error) {
    const current = this.jobs.get(jobId) || {}

    this.jobs.set(jobId, {
      ...current,
      status: 'failed',
      error: error instanceof Error ? error.message : error,
      failedAt: new Date()
    })
  }

  /**
   * Delete job from tracking
   *
   * @param {string} jobId - Job identifier
   */
  deleteJob(jobId) {
    this.jobs.delete(jobId)
  }

  /**
   * Clean up old completed jobs (older than 1 hour)
   */
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    for (const [jobId, job] of this.jobs.entries()) {
      const completedAt = job.completedAt || job.failedAt

      if (completedAt && completedAt < oneHourAgo) {
        this.jobs.delete(jobId)
      }
    }
  }

  /**
   * Get percentage complete for a job
   *
   * @param {string} jobId - Job identifier
   * @returns {number} - Percentage (0-100)
   */
  getPercentComplete(jobId) {
    const job = this.jobs.get(jobId)

    if (!job || job.total === 0) return 0

    return Math.round((job.processed / job.total) * 100)
  }
}

// Export singleton instance
module.exports = new ProgressTracker()
