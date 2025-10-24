/**
 * Axios Interceptor for automatic API logging
 *
 * This interceptor automatically logs all HTTP requests and responses,
 * providing visibility into API calls, timing, and errors.
 */

import axios from 'axios'
import { createLogger } from './logger'

const log = createLogger('API')

// Track request timing
const requestTimings = new Map()

/**
 * Setup axios interceptors for logging
 */
export function setupAxiosInterceptors() {
  // Request interceptor
  axios.interceptors.request.use(
    (config) => {
      const requestId = `${config.method?.toUpperCase()}-${config.url}-${Date.now()}`
      config.metadata = { requestId, startTime: performance.now() }
      requestTimings.set(requestId, performance.now())

      log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data ? '(request body present)' : undefined
      })

      return config
    },
    (error) => {
      log.error('Request setup failed', error)
      return Promise.reject(error)
    }
  )

  // Response interceptor
  axios.interceptors.response.use(
    (response) => {
      const { requestId, startTime } = response.config.metadata || {}
      const duration = startTime ? performance.now() - startTime : 0

      if (requestTimings.has(requestId)) {
        requestTimings.delete(requestId)
      }

      const statusEmoji = response.status >= 200 && response.status < 300 ? '✅' :
                         response.status >= 300 && response.status < 400 ? '↪️' : '❌'

      log.info(`${statusEmoji} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration.toFixed(0)}ms`,
        dataSize: response.data ? JSON.stringify(response.data).length : 0,
        success: response.data?.success
      })

      return response
    },
    (error) => {
      const { requestId, startTime } = error.config?.metadata || {}
      const duration = startTime ? performance.now() - startTime : 0

      if (requestTimings.has(requestId)) {
        requestTimings.delete(requestId)
      }

      const status = error.response?.status
      const url = error.config?.url || 'unknown'
      const method = error.config?.method?.toUpperCase() || 'UNKNOWN'

      log.error(`❌ ${method} ${url} - ${status || 'Network Error'}`, {
        status: status,
        statusText: error.response?.statusText,
        duration: `${duration.toFixed(0)}ms`,
        message: error.message,
        errorData: error.response?.data,
        requestUrl: url,
        requestMethod: method,
        requestParams: error.config?.params
      })

      return Promise.reject(error)
    }
  )

  log.success('Axios interceptors initialized - all API calls will be logged')
}

export default setupAxiosInterceptors
