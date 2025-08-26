import React, { useState } from 'react'
import Icon from './Icon'

function PerformanceMonitor({ performanceStats, onReset }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!performanceStats || performanceStats.totalApiCalls === 0) {
    return null
  }
  
  const avgQueryTime = performanceStats.totalQueryTime / performanceStats.totalApiCalls
  const cacheHitRate = performanceStats.totalApiCalls > 0 
    ? (performanceStats.cacheHits / performanceStats.totalApiCalls * 100).toFixed(1)
    : 0
  
  return (
    <div className="performance-monitor">
      <div 
        className="performance-summary"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <Icon 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={16} 
        />
        <span className="performance-text">
          ⚡ {Math.round(avgQueryTime)}ms avg • 
          {performanceStats.cacheHits}/{performanceStats.totalApiCalls} cached • 
          {performanceStats.dbQueriesExecuted} DB queries
        </span>
      </div>
      
      {isExpanded && (
        <div className="performance-details">
          <div className="performance-grid">
            <div className="performance-metric">
              <span className="metric-label">Total API Calls</span>
              <span className="metric-value">{performanceStats.totalApiCalls}</span>
            </div>
            <div className="performance-metric">
              <span className="metric-label">Cache Hit Rate</span>
              <span className="metric-value">{cacheHitRate}%</span>
            </div>
            <div className="performance-metric">
              <span className="metric-label">DB Queries</span>
              <span className="metric-value">{performanceStats.dbQueriesExecuted}</span>
            </div>
            <div className="performance-metric">
              <span className="metric-label">Avg Response</span>
              <span className="metric-value">{Math.round(avgQueryTime)}ms</span>
            </div>
            <div className="performance-metric">
              <span className="metric-label">Total Time</span>
              <span className="metric-value">{Math.round(performanceStats.totalQueryTime)}ms</span>
            </div>
            <div className="performance-metric">
              <span className="metric-label">Cache Hits</span>
              <span className="metric-value">{performanceStats.cacheHits}</span>
            </div>
          </div>
          
          <div className="performance-actions">
            <button 
              className="performance-reset-btn"
              onClick={onReset}
              title="Reset performance counters"
            >
              <Icon name="refresh-cw" size={14} />
              Reset Stats
            </button>
          </div>
          
          <div className="performance-info">
            <Icon name="info" size={14} />
            <span>
              Speed optimizations: Single queries + smart caching. 
              Cache duration: 5min (static), 1min (page data).
            </span>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .performance-monitor {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: #00ff88;
          border: 1px solid #00ff88;
          border-radius: 8px;
          padding: 8px 12px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 11px;
          z-index: 1000;
          max-width: 300px;
          box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
        }
        
        .performance-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }
        
        .performance-summary:hover {
          background: rgba(0, 255, 136, 0.1);
          border-radius: 4px;
          margin: -4px;
          padding: 8px;
        }
        
        .performance-text {
          font-weight: 500;
        }
        
        .performance-details {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #00ff88;
        }
        
        .performance-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .performance-metric {
          display: flex;
          justify-content: space-between;
          padding: 4px 8px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 4px;
        }
        
        .metric-label {
          opacity: 0.8;
        }
        
        .metric-value {
          font-weight: bold;
        }
        
        .performance-actions {
          display: flex;
          justify-content: center;
          margin-bottom: 8px;
        }
        
        .performance-reset-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: 1px solid #00ff88;
          color: #00ff88;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          font-family: inherit;
        }
        
        .performance-reset-btn:hover {
          background: rgba(0, 255, 136, 0.2);
        }
        
        .performance-info {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-size: 10px;
          opacity: 0.8;
          line-height: 1.3;
        }
      `}</style>
    </div>
  )
}

export default PerformanceMonitor