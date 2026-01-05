import React from 'react'
import { Clock, Check, AlertCircle } from 'lucide-react'
import CodeSnippet from './CodeSnippet'
import './ResponseViewer.css'

function ResponseViewer({ response, loading }) {
  if (loading) {
    return (
      <div className="api-docs-response-viewer">
        <div className="api-docs-response-loading">
          <div className="api-docs-loading-spinner" />
          <span>Executing request...</span>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="api-docs-response-viewer">
        <div className="api-docs-response-empty">
          <p>Click "Send Request" to see the response</p>
        </div>
      </div>
    )
  }

  const isSuccess = response.status >= 200 && response.status < 300
  const isError = response.status >= 400

  const formatJson = (data) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <div className="api-docs-response-viewer">
      <div className="api-docs-response-status-bar">
        <div className={`api-docs-response-status ${isSuccess ? 'success' : isError ? 'error' : 'warning'}`}>
          {isSuccess ? <Check size={14} /> : <AlertCircle size={14} />}
          <span className="api-docs-status-code">{response.status}</span>
          <span className="api-docs-status-text">{response.statusText}</span>
        </div>
        {response.timing && (
          <div className="api-docs-response-timing">
            <Clock size={14} />
            <span>{response.timing}ms</span>
          </div>
        )}
      </div>

      <div className="api-docs-response-body">
        <h4>Response Body</h4>
        <CodeSnippet
          code={formatJson(response.data)}
          language="json"
        />
      </div>

      {response.headers && (
        <details className="api-docs-response-headers">
          <summary>Response Headers</summary>
          <div className="api-docs-headers-list">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="api-docs-header-item">
                <span className="api-docs-header-key">{key}</span>
                <span className="api-docs-header-value">{value}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export default ResponseViewer
