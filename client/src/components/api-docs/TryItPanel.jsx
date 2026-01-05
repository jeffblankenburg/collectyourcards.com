import React, { useState } from 'react'
import { Play, Key, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import RequestBuilder from './RequestBuilder'
import ResponseViewer from './ResponseViewer'
import CodeSnippet from './CodeSnippet'
import './TryItPanel.css'

function TryItPanel({ endpoint }) {
  const { user, token } = useAuth()
  const [params, setParams] = useState({
    pathParams: {},
    queryParams: {},
    bodyParams: {},
    customHeaders: {}
  })
  const [includeAuth, setIncludeAuth] = useState(true)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showRequestBuilder, setShowRequestBuilder] = useState(true)

  const handleParamsChange = (newParams) => {
    setParams(newParams)
  }

  const buildUrl = () => {
    let path = endpoint.path

    // Replace path parameters
    if (params.pathParams) {
      Object.entries(params.pathParams).forEach(([key, value]) => {
        path = path.replace(`:${key}`, value || `:${key}`)
      })
    }

    return path
  }

  const buildCurlCommand = () => {
    const url = buildUrl()
    const fullUrl = `https://collectyourcards.com${url}`

    let curl = `curl -X ${endpoint.method.toUpperCase()} "${fullUrl}"`

    // Add query params
    const queryEntries = Object.entries(params.queryParams || {}).filter(([_, v]) => v)
    if (queryEntries.length > 0) {
      const queryString = queryEntries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      curl = curl.replace(fullUrl, `${fullUrl}?${queryString}`)
    }

    // Add headers
    curl += ` \\\n  -H "Content-Type: application/json"`

    if (includeAuth && endpoint.auth?.required) {
      curl += ` \\\n  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
    }

    // Add custom headers
    Object.entries(params.customHeaders || {}).forEach(([key, value]) => {
      if (key && value) {
        curl += ` \\\n  -H "${key}: ${value}"`
      }
    })

    // Add body
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase())) {
      const bodyEntries = Object.entries(params.bodyParams || {}).filter(([_, v]) => v !== undefined && v !== '')
      if (bodyEntries.length > 0) {
        const bodyObj = {}
        bodyEntries.forEach(([k, v]) => {
          // Try to parse as JSON for nested objects
          try {
            bodyObj[k] = JSON.parse(v)
          } catch {
            bodyObj[k] = v
          }
        })
        curl += ` \\\n  -d '${JSON.stringify(bodyObj)}'`
      }
    }

    return curl
  }

  const executeRequest = async () => {
    setLoading(true)
    setResponse(null)

    try {
      // Build request body for execute endpoint
      const requestBody = {
        method: endpoint.method,
        path: endpoint.path,
        pathParams: params.pathParams,
        queryParams: params.queryParams,
        headers: {
          ...params.customHeaders
        }
      }

      // Add auth header if needed and enabled
      if (includeAuth && token && endpoint.auth?.required) {
        requestBody.headers['Authorization'] = `Bearer ${token}`
      }

      // Add body params
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase())) {
        const bodyObj = {}
        Object.entries(params.bodyParams || {}).forEach(([k, v]) => {
          if (v !== undefined && v !== '') {
            // Try to parse as JSON for nested objects
            try {
              bodyObj[k] = JSON.parse(v)
            } catch {
              // Handle boolean strings
              if (v === 'true') bodyObj[k] = true
              else if (v === 'false') bodyObj[k] = false
              else bodyObj[k] = v
            }
          }
        })
        if (Object.keys(bodyObj).length > 0) {
          requestBody.body = bodyObj
        }
      }

      const res = await fetch('/api/docs/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await res.json()

      if (data.success && data.response) {
        setResponse(data.response)
      } else {
        setResponse({
          status: res.status,
          statusText: res.statusText,
          data: data
        })
      }
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        data: { error: error.message }
      })
    } finally {
      setLoading(false)
    }
  }

  if (!endpoint) return null

  return (
    <div className="api-docs-try-it-panel">
      <div className="api-docs-try-it-header">
        <h3>Try It Out</h3>
        {endpoint.auth?.required && (
          <label className="api-docs-auth-toggle">
            <input
              type="checkbox"
              checked={includeAuth}
              onChange={(e) => setIncludeAuth(e.target.checked)}
            />
            <Key size={14} />
            <span>Use Authentication</span>
            {!user && includeAuth && (
              <span className="api-docs-auth-warning">(Login for auto-token)</span>
            )}
          </label>
        )}
      </div>

      <button
        className="api-docs-section-toggle"
        onClick={() => setShowRequestBuilder(!showRequestBuilder)}
      >
        <span>Request Parameters</span>
        {showRequestBuilder ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {showRequestBuilder && (
        <RequestBuilder
          endpoint={endpoint}
          onParamsChange={handleParamsChange}
        />
      )}

      <div className="api-docs-request-preview">
        <h4>Request Preview</h4>
        <CodeSnippet code={buildCurlCommand()} language="bash" />
      </div>

      <div className="api-docs-execute-section">
        <button
          className="api-docs-execute-btn"
          onClick={executeRequest}
          disabled={loading}
        >
          <Play size={16} />
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      <div className="api-docs-response-section">
        <h3>Response</h3>
        <ResponseViewer response={response} loading={loading} />
      </div>
    </div>
  )
}

export default TryItPanel
