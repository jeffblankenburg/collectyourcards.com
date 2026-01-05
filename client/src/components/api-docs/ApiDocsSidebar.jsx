import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Book, Zap, FileCode } from 'lucide-react'
import MethodBadge from './MethodBadge'
import './ApiDocsSidebar.css'

function ApiDocsSidebar({
  endpoints,
  categories,
  selectedEndpoint,
  onEndpointSelect,
  onSearch
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(
    categories?.map(c => c.name) || []
  )

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return endpoints

    const query = searchQuery.toLowerCase()
    const result = {}

    Object.entries(endpoints || {}).forEach(([category, endpointList]) => {
      const filtered = endpointList.filter(ep =>
        ep.path.toLowerCase().includes(query) ||
        ep.summary.toLowerCase().includes(query) ||
        ep.method.toLowerCase().includes(query) ||
        (ep.tags || []).some(tag => tag.toLowerCase().includes(query))
      )
      if (filtered.length > 0) {
        result[category] = filtered
      }
    })

    return result
  }, [endpoints, searchQuery])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)

    // Expand all categories when searching
    if (value.trim()) {
      setExpandedCategories(Object.keys(filteredEndpoints))
    }
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Authentication': <Zap size={14} />,
      'Cards': <FileCode size={14} />,
      'Search': <Search size={14} />,
    }
    return icons[category] || <Book size={14} />
  }

  return (
    <div className="api-docs-sidebar">
      <div className="api-docs-sidebar-header">
        <h2>API Reference</h2>
        <p>Explore our API endpoints</p>
      </div>

      <div className="api-docs-search-wrapper">
        <Search size={16} className="api-docs-search-icon" />
        <input
          type="text"
          placeholder="Search endpoints..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="api-docs-search-input"
        />
      </div>

      <nav className="api-docs-nav">
        {Object.entries(filteredEndpoints).map(([category, endpointList]) => {
          const isExpanded = expandedCategories.includes(category)

          return (
            <div key={category} className="api-docs-category">
              <button
                className="api-docs-category-header"
                onClick={() => toggleCategory(category)}
              >
                <div className="api-docs-category-title">
                  {getCategoryIcon(category)}
                  <span>{category}</span>
                  <span className="api-docs-category-count">{endpointList.length}</span>
                </div>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isExpanded && (
                <ul className="api-docs-endpoint-list">
                  {endpointList.map(ep => (
                    <li key={ep.id}>
                      <button
                        className={`api-docs-endpoint-btn ${selectedEndpoint?.id === ep.id ? 'active' : ''}`}
                        onClick={() => onEndpointSelect(ep)}
                      >
                        <MethodBadge method={ep.method} />
                        <span className="api-docs-endpoint-path-short">
                          {ep.path.split('/').pop() || ep.path}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {Object.keys(filteredEndpoints).length === 0 && (
          <div className="api-docs-no-results">
            <p>No endpoints found matching "{searchQuery}"</p>
          </div>
        )}
      </nav>
    </div>
  )
}

export default ApiDocsSidebar
