import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { ExternalLink, Code, Shield, Clock, Menu, X } from 'lucide-react'
import ApiDocsSidebar from '../components/api-docs/ApiDocsSidebar'
import MethodBadge from '../components/api-docs/MethodBadge'
import AuthBadge from '../components/api-docs/AuthBadge'
import TryItPanel from '../components/api-docs/TryItPanel'
import CodeSnippet from '../components/api-docs/CodeSnippet'
import './ApiDocsScoped.css'

function ApiDocs() {
  const { category, endpointId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [endpoints, setEndpoints] = useState({})
  const [categories, setCategories] = useState([])
  const [selectedEndpoint, setSelectedEndpoint] = useState(null)
  const [endpointDetails, setEndpointDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch all endpoints
  useEffect(() => {
    document.title = 'API Documentation - Collect Your Cards'
    fetchEndpoints()
    fetchCategories()
  }, [])

  // Fetch endpoint details when selection changes
  useEffect(() => {
    if (selectedEndpoint?.id) {
      fetchEndpointDetails(selectedEndpoint.id)
    }
  }, [selectedEndpoint?.id])

  // Handle URL params
  useEffect(() => {
    if (endpointId && endpoints) {
      // Find endpoint by ID across all categories
      for (const [cat, endpointList] of Object.entries(endpoints)) {
        const found = endpointList.find(ep => ep.id === endpointId)
        if (found) {
          setSelectedEndpoint(found)
          break
        }
      }
    }
  }, [endpointId, endpoints])

  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/docs/endpoints')
      const data = await response.json()
      if (data.success) {
        setEndpoints(data.endpoints)
        // Auto-select first endpoint if none selected
        if (!selectedEndpoint) {
          const firstCategory = Object.keys(data.endpoints)[0]
          if (firstCategory && data.endpoints[firstCategory].length > 0) {
            setSelectedEndpoint(data.endpoints[firstCategory][0])
          }
        }
      }
    } catch (error) {
      console.error('Error fetching endpoints:', error)
      addToast('Failed to load API documentation', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/docs/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchEndpointDetails = async (id) => {
    try {
      const response = await fetch(`/api/docs/endpoint/${id}`)
      const data = await response.json()
      if (data.success) {
        setEndpointDetails(data.endpoint)
      }
    } catch (error) {
      console.error('Error fetching endpoint details:', error)
    }
  }

  const handleEndpointSelect = (endpoint) => {
    setSelectedEndpoint(endpoint)
    setSidebarOpen(false)
    navigate(`/admin/api-docs/${endpoint.category}/${endpoint.id}`, { replace: true })
  }

  if (loading) {
    return (
      <div className="api-docs-page">
        <div className="api-docs-loading">
          <div className="api-docs-loading-spinner" />
          <p>Loading API Documentation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="api-docs-page">
      {/* Mobile menu toggle */}
      <button
        className="api-docs-mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Endpoints</span>
      </button>

      {/* Sidebar */}
      <div className={`api-docs-sidebar-container ${sidebarOpen ? 'open' : ''}`}>
        <ApiDocsSidebar
          endpoints={endpoints}
          categories={categories}
          selectedEndpoint={selectedEndpoint}
          onEndpointSelect={handleEndpointSelect}
        />
      </div>

      {/* Main Content */}
      <main className="api-docs-main">
        {endpointDetails ? (
          <>
            {/* Endpoint Header */}
            <header className="api-docs-endpoint-header">
              <div className="api-docs-endpoint-title-row">
                <MethodBadge method={endpointDetails.method} />
                <code className="api-docs-endpoint-full-path">{endpointDetails.path}</code>
              </div>
              <h1 className="api-docs-endpoint-title">{endpointDetails.summary}</h1>
              <div className="api-docs-endpoint-meta">
                <AuthBadge auth={endpointDetails.auth} />
                {endpointDetails.rateLimit && (
                  <span className="api-docs-rate-limit">
                    <Clock size={14} />
                    {typeof endpointDetails.rateLimit === 'string'
                      ? endpointDetails.rateLimit
                      : endpointDetails.rateLimit.description || `${endpointDetails.rateLimit.max} per ${Math.round(endpointDetails.rateLimit.windowMs / 60000)} min`}
                  </span>
                )}
                {endpointDetails.tags?.map(tag => (
                  <span key={tag} className="api-docs-tag">{tag}</span>
                ))}
              </div>
            </header>

            {/* Description */}
            {endpointDetails.description && (
              <section className="api-docs-section">
                <h2>Description</h2>
                <p className="api-docs-description">{endpointDetails.description}</p>
              </section>
            )}

            {/* Request Info */}
            <section className="api-docs-section">
              <h2>Request</h2>
              <div className="api-docs-request-info">
                {/* Path Parameters */}
                {endpointDetails.request?.params && Object.keys(endpointDetails.request.params).length > 0 && (
                  <div className="api-docs-params-section">
                    <h3>Path Parameters</h3>
                    <table className="api-docs-params-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(endpointDetails.request.params).map(([name, param]) => (
                          <tr key={name}>
                            <td><code>{name}</code></td>
                            <td><span className="api-docs-type-badge">{param.type}</span></td>
                            <td>{param.required ? <span className="api-docs-required-yes">Yes</span> : 'No'}</td>
                            <td>{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Query Parameters */}
                {endpointDetails.request?.query && Object.keys(endpointDetails.request.query).length > 0 && (
                  <div className="api-docs-params-section">
                    <h3>Query Parameters</h3>
                    <table className="api-docs-params-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(endpointDetails.request.query).map(([name, param]) => (
                          <tr key={name}>
                            <td><code>{name}</code></td>
                            <td><span className="api-docs-type-badge">{param.type}</span></td>
                            <td>{param.required ? <span className="api-docs-required-yes">Yes</span> : 'No'}</td>
                            <td>{param.description}{param.example && <code className="api-docs-example">e.g. {param.example}</code>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Request Body */}
                {endpointDetails.request?.body && Object.keys(endpointDetails.request.body).length > 0 && (
                  <div className="api-docs-params-section">
                    <h3>Request Body</h3>
                    <table className="api-docs-params-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(endpointDetails.request.body).map(([name, param]) => (
                          <tr key={name}>
                            <td><code>{name}</code></td>
                            <td><span className="api-docs-type-badge">{param.type}</span></td>
                            <td>{param.required ? <span className="api-docs-required-yes">Yes</span> : 'No'}</td>
                            <td>{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Response Examples */}
            {endpointDetails.responses && Object.keys(endpointDetails.responses).length > 0 && (
              <section className="api-docs-section">
                <h2>Responses</h2>
                <div className="api-docs-responses">
                  {Object.entries(endpointDetails.responses).map(([code, response]) => (
                    <div key={code} className="api-docs-response-example">
                      <div className="api-docs-response-header">
                        <span className={`api-docs-status-code ${code.startsWith('2') ? 'success' : 'error'}`}>
                          {code}
                        </span>
                        <span className="api-docs-response-desc">{response.description}</span>
                      </div>
                      {response.example && (
                        <CodeSnippet
                          code={JSON.stringify(response.example, null, 2)}
                          language="json"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Try It Panel */}
            <section className="api-docs-section api-docs-try-section">
              <TryItPanel endpoint={endpointDetails} />
            </section>
          </>
        ) : (
          <div className="api-docs-empty-state">
            <Code size={48} />
            <h2>Select an Endpoint</h2>
            <p>Choose an endpoint from the sidebar to view its documentation and try it out.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default ApiDocs
