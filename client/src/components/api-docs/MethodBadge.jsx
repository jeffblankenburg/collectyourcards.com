import React from 'react'
import './MethodBadge.css'

const METHOD_COLORS = {
  GET: 'api-docs-method-get',
  POST: 'api-docs-method-post',
  PUT: 'api-docs-method-put',
  PATCH: 'api-docs-method-patch',
  DELETE: 'api-docs-method-delete'
}

function MethodBadge({ method }) {
  const methodUpper = method?.toUpperCase() || 'GET'
  const colorClass = METHOD_COLORS[methodUpper] || 'api-docs-method-get'

  return (
    <span className={`api-docs-method-badge ${colorClass}`}>
      {methodUpper}
    </span>
  )
}

export default MethodBadge
