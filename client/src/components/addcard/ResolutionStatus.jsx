import './ResolutionStatus.css'

/**
 * ResolutionStatus - Shows live resolution status for all form fields
 *
 * Displays status indicators for each entity:
 * - Resolved (green checkmark)
 * - Will be created (yellow warning)
 * - Pending/Error (gray/red)
 */
export default function ResolutionStatus({ resolution, isLoading, formData }) {
  const renderStatusIcon = (status) => {
    switch (status) {
      case 'exact':
      case 'exists':
      case 'from_player':
        return (
          <span className="status-icon resolved">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        )
      case 'partial':
        return (
          <span className="status-icon partial">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        )
      case 'new':
        return (
          <span className="status-icon new">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </span>
        )
      case 'pending':
      case 'missing':
      case 'not_provided':
        return (
          <span className="status-icon pending">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </span>
        )
      default:
        return (
          <span className="status-icon unknown">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </span>
        )
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'exact':
      case 'exists':
        return <span className="status-badge exact">Exact Match</span>
      case 'partial':
        return <span className="status-badge partial">Partial Match</span>
      case 'from_player':
        return <span className="status-badge from-player">From Player</span>
      case 'new':
        return <span className="status-badge new">Will Create</span>
      case 'pending':
        return <span className="status-badge pending">Waiting</span>
      case 'missing':
        return <span className="status-badge missing">Not Found</span>
      case 'not_provided':
        return <span className="status-badge not-provided">Optional</span>
      default:
        return null
    }
  }

  const renderConfidence = (confidence) => {
    if (!confidence) return null
    const percent = Math.round(confidence * 100)
    return <span className="confidence">{percent}%</span>
  }

  const renderResolutionItem = (label, data, hasValue = true) => {
    if (!hasValue && !data) {
      return null
    }

    if (!data) {
      return (
        <div className="resolution-item waiting">
          {renderStatusIcon('pending')}
          <div className="resolution-content">
            <span className="resolution-label">{label}</span>
            <span className="resolution-value">Waiting for input...</span>
          </div>
        </div>
      )
    }

    return (
      <div className={`resolution-item ${data.resolved ? 'resolved' : 'unresolved'} ${data.status || ''}`}>
        {renderStatusIcon(data.status)}
        <div className="resolution-content">
          <div className="resolution-header">
            <span className="resolution-label">{label}</span>
            {data.confidence && renderConfidence(data.confidence)}
          </div>
          <span className={`resolution-value ${data.resolved ? '' : 'new-value'}`}>
            {data.resolved ? data.name : (data.message || 'Not found')}
          </span>
          {renderStatusBadge(data.status)}
        </div>
      </div>
    )
  }

  // Determine overall status
  const getOverallStatus = () => {
    if (isLoading) return 'checking'
    if (!resolution) return 'waiting'
    if (resolution.fully_resolved) return 'ready'

    const hasNew = [resolution.set, resolution.series, resolution.player, resolution.card]
      .some(item => item?.status === 'new')
    if (hasNew) return 'pending_review'

    return 'incomplete'
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="resolution-status">
      <div className="resolution-header-section">
        <h3 className="resolution-title">Resolution Status</h3>
        {isLoading && (
          <div className="resolution-loading">
            <span className="loading-spinner"></span>
            <span>Checking...</span>
          </div>
        )}
      </div>

      <div className="resolution-items">
        {renderResolutionItem('Set', resolution?.set, !!formData?.set_name)}
        {renderResolutionItem('Series', resolution?.series, !!formData?.series_name || !!resolution?.set?.resolved)}
        {renderResolutionItem('Player', resolution?.player, !!formData?.player_name)}
        {renderResolutionItem('Team', resolution?.team, !!formData?.team_name || !!resolution?.player?.team_id)}
        {formData?.color_name && renderResolutionItem('Color', resolution?.color, !!formData?.color_name)}
        {renderResolutionItem('Card', resolution?.card, !!formData?.card_number && !!resolution?.series?.resolved)}
      </div>

      <div className={`resolution-summary ${overallStatus}`}>
        {overallStatus === 'checking' && (
          <>
            <div className="summary-icon checking">
              <span className="loading-spinner"></span>
            </div>
            <div className="summary-content">
              <span className="summary-title">Checking database...</span>
              <span className="summary-description">Verifying entities exist</span>
            </div>
          </>
        )}

        {overallStatus === 'waiting' && (
          <>
            <div className="summary-icon waiting">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="summary-content">
              <span className="summary-title">Waiting for input</span>
              <span className="summary-description">Fill out the form fields to see resolution status</span>
            </div>
          </>
        )}

        {overallStatus === 'ready' && (
          <>
            <div className="summary-icon ready">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div className="summary-content">
              <span className="summary-title">Ready to add!</span>
              <span className="summary-description">
                All entities found. Card will be added to your collection immediately.
              </span>
            </div>
          </>
        )}

        {overallStatus === 'pending_review' && (
          <>
            <div className="summary-icon pending">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="summary-content">
              <span className="summary-title">Pending review</span>
              <span className="summary-description">
                Card will be added to your collection. New entities require admin review before becoming official.
              </span>
            </div>
          </>
        )}

        {overallStatus === 'incomplete' && (
          <>
            <div className="summary-icon incomplete">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div className="summary-content">
              <span className="summary-title">Incomplete</span>
              <span className="summary-description">
                Please fill out all required fields to submit.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
