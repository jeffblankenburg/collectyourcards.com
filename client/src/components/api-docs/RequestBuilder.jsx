import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import './RequestBuilder.css'

function RequestBuilder({ endpoint, onParamsChange, initialValues }) {
  const [pathParams, setPathParams] = useState({})
  const [queryParams, setQueryParams] = useState({})
  const [bodyParams, setBodyParams] = useState({})
  const [customHeaders, setCustomHeaders] = useState([])

  // Initialize from endpoint definition
  useEffect(() => {
    if (endpoint) {
      // Set default path params
      const newPathParams = {}
      if (endpoint.request?.params) {
        Object.entries(endpoint.request.params).forEach(([key, param]) => {
          newPathParams[key] = initialValues?.pathParams?.[key] || param.example || ''
        })
      }
      setPathParams(newPathParams)

      // Set default query params
      const newQueryParams = {}
      if (endpoint.request?.query) {
        Object.entries(endpoint.request.query).forEach(([key, param]) => {
          newQueryParams[key] = initialValues?.queryParams?.[key] || param.example || ''
        })
      }
      setQueryParams(newQueryParams)

      // Set default body params
      const newBodyParams = {}
      if (endpoint.request?.body) {
        Object.entries(endpoint.request.body).forEach(([key, param]) => {
          newBodyParams[key] = initialValues?.bodyParams?.[key] || param.example || ''
        })
      }
      setBodyParams(newBodyParams)
    }
  }, [endpoint?.id])

  // Notify parent of changes
  useEffect(() => {
    onParamsChange?.({
      pathParams,
      queryParams,
      bodyParams,
      customHeaders: customHeaders.reduce((acc, h) => {
        if (h.key && h.value) acc[h.key] = h.value
        return acc
      }, {})
    })
  }, [pathParams, queryParams, bodyParams, customHeaders])

  const handlePathParamChange = (key, value) => {
    setPathParams(prev => ({ ...prev, [key]: value }))
  }

  const handleQueryParamChange = (key, value) => {
    setQueryParams(prev => ({ ...prev, [key]: value }))
  }

  const handleBodyParamChange = (key, value) => {
    setBodyParams(prev => ({ ...prev, [key]: value }))
  }

  const addCustomHeader = () => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }])
  }

  const updateCustomHeader = (index, field, value) => {
    setCustomHeaders(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeCustomHeader = (index) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index))
  }

  const hasPathParams = endpoint?.request?.params && Object.keys(endpoint.request.params).length > 0
  const hasQueryParams = endpoint?.request?.query && Object.keys(endpoint.request.query).length > 0
  const hasBodyParams = endpoint?.request?.body && Object.keys(endpoint.request.body).length > 0

  if (!endpoint) return null

  return (
    <div className="api-docs-request-builder">
      {/* Path Parameters */}
      {hasPathParams && (
        <div className="api-docs-builder-section">
          <h4>Path Parameters</h4>
          <div className="api-docs-params-grid">
            {Object.entries(endpoint.request.params).map(([key, param]) => (
              <div key={key} className="api-docs-param-row">
                <div className="api-docs-param-info">
                  <label>
                    {key}
                    {param.required && <span className="api-docs-required">*</span>}
                  </label>
                  <span className="api-docs-param-type">{param.type}</span>
                </div>
                <input
                  type="text"
                  value={pathParams[key] || ''}
                  onChange={(e) => handlePathParamChange(key, e.target.value)}
                  placeholder={param.example || `Enter ${key}`}
                  className="api-docs-param-input"
                />
                {param.description && (
                  <p className="api-docs-param-description">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Parameters */}
      {hasQueryParams && (
        <div className="api-docs-builder-section">
          <h4>Query Parameters</h4>
          <div className="api-docs-params-grid">
            {Object.entries(endpoint.request.query).map(([key, param]) => (
              <div key={key} className="api-docs-param-row">
                <div className="api-docs-param-info">
                  <label>
                    {key}
                    {param.required && <span className="api-docs-required">*</span>}
                  </label>
                  <span className="api-docs-param-type">{param.type}</span>
                </div>
                <input
                  type="text"
                  value={queryParams[key] || ''}
                  onChange={(e) => handleQueryParamChange(key, e.target.value)}
                  placeholder={param.example || `Enter ${key}`}
                  className="api-docs-param-input"
                />
                {param.description && (
                  <p className="api-docs-param-description">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {hasBodyParams && (
        <div className="api-docs-builder-section">
          <h4>Request Body</h4>
          <div className="api-docs-params-grid">
            {Object.entries(endpoint.request.body).map(([key, param]) => (
              <div key={key} className="api-docs-param-row">
                <div className="api-docs-param-info">
                  <label>
                    {key}
                    {param.required && <span className="api-docs-required">*</span>}
                  </label>
                  <span className="api-docs-param-type">{param.type}</span>
                </div>
                {param.type === 'boolean' ? (
                  <select
                    value={bodyParams[key] || ''}
                    onChange={(e) => handleBodyParamChange(key, e.target.value)}
                    className="api-docs-param-input"
                  >
                    <option value="">-- Select --</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={bodyParams[key] || ''}
                    onChange={(e) => handleBodyParamChange(key, e.target.value)}
                    placeholder={param.example || `Enter ${key}`}
                    className="api-docs-param-input"
                  />
                )}
                {param.description && (
                  <p className="api-docs-param-description">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Headers */}
      <div className="api-docs-builder-section">
        <div className="api-docs-section-header">
          <h4>Custom Headers</h4>
          <button
            type="button"
            onClick={addCustomHeader}
            className="api-docs-add-btn"
          >
            <Plus size={14} />
            Add Header
          </button>
        </div>
        {customHeaders.length > 0 && (
          <div className="api-docs-custom-headers">
            {customHeaders.map((header, index) => (
              <div key={index} className="api-docs-header-row">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                  placeholder="Header name"
                  className="api-docs-param-input"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                  placeholder="Header value"
                  className="api-docs-param-input"
                />
                <button
                  type="button"
                  onClick={() => removeCustomHeader(index)}
                  className="api-docs-remove-btn"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {customHeaders.length === 0 && (
          <p className="api-docs-no-headers">No custom headers added</p>
        )}
      </div>
    </div>
  )
}

export default RequestBuilder
