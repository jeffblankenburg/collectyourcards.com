/**
 * API Documentation Routes
 *
 * Serves endpoint metadata and handles proxy requests for the interactive API explorer.
 */

const express = require('express')
const axios = require('axios')
const {
  getAllEndpoints,
  getEndpointsByCategory,
  getCategories,
  getEndpointById,
  searchEndpoints
} = require('../config/api-registry')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// =============================================================================
// PUBLIC ENDPOINTS - No auth required
// =============================================================================

/**
 * GET /api/docs/endpoints
 * Returns all documented endpoints
 */
router.get('/endpoints', (req, res) => {
  try {
    const endpoints = getAllEndpoints()

    // Group by category for easier consumption
    const groupedByCategory = endpoints.reduce((acc, endpoint) => {
      if (!acc[endpoint.category]) {
        acc[endpoint.category] = []
      }
      acc[endpoint.category].push({
        id: endpoint.id,
        path: endpoint.path,
        method: endpoint.method,
        summary: endpoint.summary,
        auth: endpoint.auth,
        tags: endpoint.tags
      })
      return acc
    }, {})

    res.json({
      success: true,
      total: endpoints.length,
      categories: Object.keys(groupedByCategory).sort(),
      endpoints: groupedByCategory
    })
  } catch (error) {
    console.error('Error fetching endpoints:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch endpoints'
    })
  }
})

/**
 * GET /api/docs/endpoints/:category
 * Returns endpoints for a specific category
 */
router.get('/endpoints/category/:category', (req, res) => {
  try {
    const { category } = req.params
    const endpoints = getEndpointsByCategory(category)

    if (endpoints.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `No endpoints found for category: ${category}`
      })
    }

    res.json({
      success: true,
      category,
      total: endpoints.length,
      endpoints: endpoints.map(e => ({
        id: e.id,
        path: e.path,
        method: e.method,
        summary: e.summary,
        auth: e.auth,
        tags: e.tags
      }))
    })
  } catch (error) {
    console.error('Error fetching category endpoints:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch endpoints'
    })
  }
})

/**
 * GET /api/docs/endpoint/:id
 * Returns full details for a specific endpoint
 */
router.get('/endpoint/:id', (req, res) => {
  try {
    const { id } = req.params
    const endpoint = getEndpointById(id)

    if (!endpoint) {
      return res.status(404).json({
        error: 'Not found',
        message: `Endpoint not found: ${id}`
      })
    }

    res.json({
      success: true,
      endpoint
    })
  } catch (error) {
    console.error('Error fetching endpoint:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch endpoint'
    })
  }
})

/**
 * GET /api/docs/categories
 * Returns all available endpoint categories
 */
router.get('/categories', (req, res) => {
  try {
    const categories = getCategories()
    const endpoints = getAllEndpoints()

    // Get count per category
    const categoryCounts = categories.map(category => ({
      name: category,
      count: endpoints.filter(e => e.category === category).length
    }))

    res.json({
      success: true,
      categories: categoryCounts
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch categories'
    })
  }
})

/**
 * GET /api/docs/search
 * Search endpoints by query
 */
router.get('/search', (req, res) => {
  try {
    const { q } = req.query

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Search query must be at least 2 characters'
      })
    }

    const results = searchEndpoints(q)

    res.json({
      success: true,
      query: q,
      total: results.length,
      results: results.map(e => ({
        id: e.id,
        path: e.path,
        method: e.method,
        category: e.category,
        summary: e.summary,
        tags: e.tags
      }))
    })
  } catch (error) {
    console.error('Error searching endpoints:', error)
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to search endpoints'
    })
  }
})

// =============================================================================
// EXECUTE ENDPOINT - Proxies API requests for the interactive explorer
// =============================================================================

/**
 * POST /api/docs/execute
 * Proxies API requests for the interactive explorer
 *
 * This allows the documentation page to make API calls on behalf of the user
 * with proper authentication handling.
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      method,
      path,
      headers = {},
      body,
      queryParams = {}
    } = req.body

    if (!method || !path) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Method and path are required'
      })
    }

    // Build the full URL
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
    let fullPath = path

    // Replace path parameters if provided
    if (req.body.pathParams) {
      Object.entries(req.body.pathParams).forEach(([key, value]) => {
        fullPath = fullPath.replace(`:${key}`, value)
      })
    }

    // Build query string
    const queryString = Object.entries(queryParams)
      .filter(([_, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const url = queryString ? `${baseUrl}${fullPath}?${queryString}` : `${baseUrl}${fullPath}`

    // Prepare request config
    const config = {
      method: method.toLowerCase(),
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000, // 30 second timeout
      validateStatus: () => true // Don't throw on any status code
    }

    // Add body for POST/PUT/PATCH requests
    if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
      config.data = body
    }

    // Track timing
    const startTime = Date.now()

    // Make the request
    const response = await axios(config)

    const endTime = Date.now()

    // Return the response with metadata
    res.json({
      success: true,
      request: {
        method: method.toUpperCase(),
        url: url.replace(baseUrl, ''), // Return relative URL for display
        headers: config.headers,
        body: config.data
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        timing: endTime - startTime
      }
    })

  } catch (error) {
    console.error('Error executing API request:', error)

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Timeout',
        message: 'Request timed out after 30 seconds'
      })
    }

    // Handle connection errors
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Could not connect to the API server'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Execution failed',
      message: error.message
    })
  }
})

// =============================================================================
// OPENAPI SPEC - For future OpenAPI generation
// =============================================================================

/**
 * GET /api/docs/openapi.json
 * Returns OpenAPI 3.0 specification (placeholder for Phase 3)
 */
router.get('/openapi.json', (req, res) => {
  const endpoints = getAllEndpoints()

  // Convert registry format to OpenAPI paths
  const paths = {}

  endpoints.forEach(endpoint => {
    const pathKey = endpoint.path.replace(/:(\w+)/g, '{$1}')

    if (!paths[pathKey]) {
      paths[pathKey] = {}
    }

    const operation = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: [endpoint.category],
      operationId: endpoint.id
    }

    // Add security if auth required
    if (endpoint.auth?.required) {
      operation.security = [{ bearerAuth: [] }]
    }

    // Add parameters
    const parameters = []

    // Path parameters
    if (endpoint.request?.params) {
      Object.entries(endpoint.request.params).forEach(([name, param]) => {
        parameters.push({
          name,
          in: 'path',
          required: param.required,
          description: param.description,
          schema: { type: param.type },
          example: param.example
        })
      })
    }

    // Query parameters
    if (endpoint.request?.query) {
      Object.entries(endpoint.request.query).forEach(([name, param]) => {
        parameters.push({
          name,
          in: 'query',
          required: param.required,
          description: param.description,
          schema: { type: param.type },
          example: param.example
        })
      })
    }

    if (parameters.length > 0) {
      operation.parameters = parameters
    }

    // Add request body
    if (endpoint.request?.body) {
      const properties = {}
      const required = []

      Object.entries(endpoint.request.body).forEach(([name, param]) => {
        properties[name] = {
          type: param.type,
          description: param.description,
          example: param.example
        }
        if (param.required) {
          required.push(name)
        }
      })

      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
              required: required.length > 0 ? required : undefined
            }
          }
        }
      }
    }

    // Add responses
    if (endpoint.responses) {
      operation.responses = {}
      Object.entries(endpoint.responses).forEach(([code, response]) => {
        operation.responses[code] = {
          description: response.description,
          content: {
            'application/json': {
              example: response.example
            }
          }
        }
      })
    }

    paths[pathKey][endpoint.method.toLowerCase()] = operation
  })

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'CollectYourCards API',
      version: '1.0.0',
      description: 'API for managing sports card collections. Build your collection, track your cards, and connect with other collectors.',
      contact: {
        name: 'API Support',
        url: 'https://collectyourcards.com/developers'
      }
    },
    servers: [
      {
        url: 'https://collectyourcards.com',
        description: 'Production'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development'
      }
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        }
      }
    },
    tags: getCategories().map(cat => ({
      name: cat,
      description: `${cat} related endpoints`
    }))
  }

  res.json(spec)
})

module.exports = router
