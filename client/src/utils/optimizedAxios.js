import axios from 'axios'

// Optimized axios instance with request queuing and performance tracking
class OptimizedApiClient {
  constructor() {
    this.requestQueue = []
    this.activeRequests = 0
    this.maxConcurrentRequests = 3 // Limit concurrent requests to prevent connection storms
    this.performanceStats = {
      totalRequests: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      errors: 0,
      queuedRequests: 0
    }
    
    // Create axios instance with optimizations
    this.client = axios.create({
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    // Add request interceptor for queueing
    this.client.interceptors.request.use(
      (config) => {
        // Add performance tracking
        config.metadata = { startTime: performance.now() }
        return config
      },
      (error) => Promise.reject(error)
    )
    
    // Add response interceptor for performance tracking
    this.client.interceptors.response.use(
      (response) => {
        const endTime = performance.now()
        const responseTime = endTime - response.config.metadata.startTime
        
        // Update performance stats
        this.performanceStats.totalRequests++
        this.performanceStats.totalResponseTime += responseTime
        
        // Check if response indicates cache hit
        if (response.data?.performance?.cacheHit) {
          this.performanceStats.cacheHits++
        }
        
        console.log(`✅ API ${response.config.method?.toUpperCase()} ${response.config.url} - ${Math.round(responseTime)}ms ${response.data?.performance?.cacheHit ? '(cached)' : ''}`)
        
        return response
      },
      (error) => {
        const endTime = performance.now()
        const responseTime = endTime - error.config?.metadata?.startTime
        
        this.performanceStats.errors++
        console.error(`❌ API ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${Math.round(responseTime || 0)}ms - ${error.message}`)
        
        return Promise.reject(error)
      }
    )
  }
  
  // Queue management for preventing connection storms
  async processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return
    }
    
    this.activeRequests++
    const { resolve, reject, config } = this.requestQueue.shift()
    
    try {
      const response = await this.client(config)
      resolve(response)
    } catch (error) {
      reject(error)
    } finally {
      this.activeRequests--
      // Process next request in queue
      setTimeout(() => this.processQueue(), 0)
    }
  }
  
  // Optimized request method with queuing
  async request(config) {
    // If we're under the concurrent limit, make request immediately
    if (this.activeRequests < this.maxConcurrentRequests) {
      return this.processImmediateRequest(config)
    }
    
    // Otherwise, queue the request
    this.performanceStats.queuedRequests++
    console.log(`🔄 Queuing request: ${config.method?.toUpperCase()} ${config.url} (${this.requestQueue.length + 1} in queue)`)
    
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, config })
      this.processQueue()
    })
  }
  
  async processImmediateRequest(config) {
    this.activeRequests++
    try {
      const response = await this.client(config)
      return response
    } finally {
      this.activeRequests--
      // Process queued requests
      setTimeout(() => this.processQueue(), 0)
    }
  }
  
  // Convenience methods
  async get(url, config = {}) {
    return this.request({ ...config, method: 'GET', url })
  }
  
  async post(url, data, config = {}) {
    return this.request({ ...config, method: 'POST', url, data })
  }
  
  async put(url, data, config = {}) {
    return this.request({ ...config, method: 'PUT', url, data })
  }
  
  async delete(url, config = {}) {
    return this.request({ ...config, method: 'DELETE', url })
  }
  
  // Performance monitoring
  getPerformanceStats() {
    const avgResponseTime = this.performanceStats.totalRequests > 0 
      ? this.performanceStats.totalResponseTime / this.performanceStats.totalRequests 
      : 0
      
    const cacheHitRate = this.performanceStats.totalRequests > 0
      ? (this.performanceStats.cacheHits / this.performanceStats.totalRequests * 100)
      : 0
    
    return {
      ...this.performanceStats,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 10) / 10,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length
    }
  }
  
  resetPerformanceStats() {
    this.performanceStats = {
      totalRequests: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      errors: 0,
      queuedRequests: 0
    }
  }
  
  // Batch request optimization
  async batchGet(urls, config = {}) {
    console.log(`🚀 Executing batch request for ${urls.length} URLs`)
    const startTime = performance.now()
    
    const promises = urls.map(url => this.get(url, config))
    const results = await Promise.allSettled(promises)
    
    const endTime = performance.now()
    const successful = results.filter(r => r.status === 'fulfilled').length
    
    console.log(`✅ Batch complete: ${successful}/${urls.length} successful in ${Math.round(endTime - startTime)}ms`)
    
    return results
  }
}

// Export singleton instance
export const optimizedApi = new OptimizedApiClient()

// Export as default for easy importing
export default optimizedApi

// Helper function to replace existing axios usage
export const createOptimizedAxios = () => optimizedApi