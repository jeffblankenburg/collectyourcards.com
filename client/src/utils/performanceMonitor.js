/**
 * Performance Monitoring Utility
 * Tracks timing metrics for collection page optimizations
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {}
    this.enabled = process.env.NODE_ENV === 'development'
  }

  /**
   * Start timing an operation
   * @param {string} operation - Name of the operation to track
   * @returns {string} - Unique key for this timing instance
   */
  start(operation) {
    if (!this.enabled) return null

    const key = `${operation}_${Date.now()}_${Math.random()}`
    this.metrics[key] = {
      operation,
      startTime: performance.now(),
      startMemory: performance.memory ? performance.memory.usedJSHeapSize : null
    }

    return key
  }

  /**
   * End timing for an operation and log results
   * @param {string} key - The key returned from start()
   * @param {Object} metadata - Additional data to log
   */
  end(key, metadata = {}) {
    if (!this.enabled || !key || !this.metrics[key]) return

    const metric = this.metrics[key]
    const endTime = performance.now()
    const duration = endTime - metric.startTime
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : null
    const memoryDelta = endMemory && metric.startMemory
      ? endMemory - metric.startMemory
      : null

    const result = {
      operation: metric.operation,
      duration: `${duration.toFixed(2)}ms`,
      durationMs: duration,
      ...metadata
    }

    if (memoryDelta !== null) {
      result.memoryDelta = `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
      result.memoryDeltaBytes = memoryDelta
    }

    // Color code based on duration thresholds
    const color = duration < 100 ? '#22c55e' : duration < 500 ? '#f59e0b' : '#ef4444'

    console.log(
      `%c⚡ ${metric.operation}`,
      `color: ${color}; font-weight: bold;`,
      result
    )

    // Clean up
    delete this.metrics[key]

    return result
  }

  /**
   * Measure an async function
   * @param {string} operation - Name of the operation
   * @param {Function} fn - Async function to measure
   * @param {Object} metadata - Additional data to log
   */
  async measure(operation, fn, metadata = {}) {
    const key = this.start(operation)
    try {
      const result = await fn()
      this.end(key, { ...metadata, success: true })
      return result
    } catch (error) {
      this.end(key, { ...metadata, success: false, error: error.message })
      throw error
    }
  }

  /**
   * Log a simple timing mark
   * @param {string} label - Label for the mark
   * @param {Object} data - Additional data to log
   */
  mark(label, data = {}) {
    if (!this.enabled) return

    console.log(
      `%c📊 ${label}`,
      'color: #3b82f6; font-weight: bold;',
      data
    )
  }

  /**
   * Log collection-specific metrics
   * @param {Object} stats - Collection statistics
   */
  logCollectionStats(stats) {
    if (!this.enabled) return

    console.group('%c📈 Collection Stats', 'color: #8b5cf6; font-weight: bold; font-size: 14px;')

    if (stats.totalCards !== undefined) {
      console.log(`Total Cards: ${stats.totalCards.toLocaleString()}`)
    }
    if (stats.cardsInDOM !== undefined) {
      console.log(`Cards in DOM: ${stats.cardsInDOM.toLocaleString()}`)
    }
    if (stats.apiResponseTime !== undefined) {
      console.log(`API Response: ${stats.apiResponseTime}ms`)
    }
    if (stats.renderTime !== undefined) {
      console.log(`Render Time: ${stats.renderTime}ms`)
    }
    if (stats.totalTime !== undefined) {
      console.log(`Total Time: ${stats.totalTime}ms`)
    }
    if (stats.memoryUsage !== undefined) {
      console.log(`Memory Usage: ${stats.memoryUsage}MB`)
    }

    console.groupEnd()
  }

  /**
   * Compare before/after metrics
   * @param {string} label - Comparison label
   * @param {number} before - Before value
   * @param {number} after - After value
   * @param {string} unit - Unit of measurement
   */
  compare(label, before, after, unit = 'ms') {
    if (!this.enabled) return

    const improvement = ((before - after) / before * 100).toFixed(1)
    const color = after < before ? '#22c55e' : '#ef4444'

    console.log(
      `%c🔄 ${label}`,
      `color: ${color}; font-weight: bold;`,
      {
        before: `${before}${unit}`,
        after: `${after}${unit}`,
        improvement: `${improvement}%`,
        faster: `${(before / after).toFixed(1)}x`
      }
    )
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor()

// Export class for testing
export default PerformanceMonitor
