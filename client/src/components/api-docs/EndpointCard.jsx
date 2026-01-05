import React from 'react'
import { ChevronRight } from 'lucide-react'
import MethodBadge from './MethodBadge'
import AuthBadge from './AuthBadge'
import './EndpointCard.css'

function EndpointCard({ endpoint, isSelected, onClick }) {
  return (
    <div
      className={`api-docs-endpoint-card ${isSelected ? 'api-docs-endpoint-selected' : ''}`}
      onClick={onClick}
    >
      <div className="api-docs-endpoint-card-header">
        <MethodBadge method={endpoint.method} />
        <code className="api-docs-endpoint-path">{endpoint.path}</code>
      </div>
      <div className="api-docs-endpoint-card-body">
        <p className="api-docs-endpoint-summary">{endpoint.summary}</p>
        <div className="api-docs-endpoint-card-footer">
          <AuthBadge auth={endpoint.auth} />
          {endpoint.tags && endpoint.tags.length > 0 && (
            <div className="api-docs-endpoint-tags">
              {endpoint.tags.slice(0, 2).map(tag => (
                <span key={tag} className="api-docs-endpoint-tag">{tag}</span>
              ))}
            </div>
          )}
          <ChevronRight size={16} className="api-docs-endpoint-arrow" />
        </div>
      </div>
    </div>
  )
}

export default EndpointCard
