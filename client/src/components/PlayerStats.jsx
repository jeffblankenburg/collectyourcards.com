import React from 'react'
import Icon from './Icon'
import './PlayerStats.css'

const PlayerStats = ({ stats }) => {
  if (!stats) {
    return (
      <div className="player-stats-empty">
        <p>No statistics available</p>
      </div>
    )
  }

  const statItems = [
    {
      key: 'total_cards',
      label: 'Total Cards',
      value: stats.total_cards || 0,
      icon: 'card',
      color: '#e5e7eb'
    },
    {
      key: 'rookie_cards',
      label: 'Rookie Cards',
      value: stats.rookie_cards || 0,
      icon: 'star',
      color: '#fbbf24'
    },
    {
      key: 'autograph_cards',
      label: 'Autograph Cards',
      value: stats.autograph_cards || 0,
      icon: 'diamond',
      color: '#10b981'
    },
    {
      key: 'relic_cards',
      label: 'Relic Cards',
      value: stats.relic_cards || 0,
      icon: 'trophy',
      color: '#8b5cf6'
    },
    {
      key: 'numbered_cards',
      label: 'Numbered Cards',
      value: stats.numbered_cards || 0,
      icon: 'target',
      color: '#f59e0b'
    },
    {
      key: 'unique_series',
      label: 'Different Series',
      value: stats.unique_series || 0,
      icon: 'collections',
      color: '#06b6d4'
    }
  ]

  return (
    <div className="player-stats">
      <div className="stats-grid">
        {statItems.map(stat => (
          <div key={stat.key} className="stat-item">
            <div className="stat-icon" style={{ color: stat.color }}>
              <Icon name={stat.icon} size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </div>
              <div className="stat-label">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Additional stats row for percentages if we have total cards */}
      {stats.total_cards > 0 && (
        <div className="stats-percentages">
          <div className="percentage-row">
            <span className="percentage-item">
              <Icon name="star" size={14} />
              {((stats.rookie_cards / stats.total_cards) * 100).toFixed(1)}% Rookies
            </span>
            <span className="percentage-item">
              <Icon name="diamond" size={14} />
              {((stats.autograph_cards / stats.total_cards) * 100).toFixed(1)}% Autos
            </span>
            <span className="percentage-item">
              <Icon name="trophy" size={14} />
              {((stats.relic_cards / stats.total_cards) * 100).toFixed(1)}% Relics
            </span>
            {stats.numbered_cards > 0 && (
              <span className="percentage-item">
                <Icon name="target" size={14} />
                {((stats.numbered_cards / stats.total_cards) * 100).toFixed(1)}% Numbered
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayerStats