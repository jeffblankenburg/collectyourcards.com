/**
 * ShippingMap - US choropleth map showing shipping destinations
 * Uses react-simple-maps for rendering
 * Includes full-screen modal with city markers
 */

import React, { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { scaleQuantize, scaleSqrt } from 'd3-scale'
import { aggregateByState, getTopCities, getStateName, getCitiesWithCoordinates } from '../../utils/zipCodeMapping'
import Icon from '../Icon'
import './ShippingMap.css'

// TopoJSON for US states - using a CDN hosted version
const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// State FIPS codes to state abbreviations mapping
const fipsToState = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR'
}

function ShippingMap({ sales = [] }) {
  const [tooltipContent, setTooltipContent] = useState('')
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [showFullscreen, setShowFullscreen] = useState(false)

  // Aggregate sales by state
  const stateCounts = useMemo(() => aggregateByState(sales), [sales])

  // Get top cities for mini view
  const topCities = useMemo(() => getTopCities(sales, 5), [sales])

  // Get all cities with coordinates for fullscreen view
  const citiesWithCoords = useMemo(() => getCitiesWithCoordinates(sales), [sales])

  // Calculate max for color scale
  const maxCount = useMemo(() => {
    const counts = Object.values(stateCounts)
    return counts.length > 0 ? Math.max(...counts) : 0
  }, [stateCounts])

  // Calculate max city count for marker sizing
  const maxCityCount = useMemo(() => {
    return citiesWithCoords.length > 0 ? Math.max(...citiesWithCoords.map(c => c.count)) : 0
  }, [citiesWithCoords])

  // Color scale - light to dark blue
  const colorScale = useMemo(() => {
    return scaleQuantize()
      .domain([0, Math.max(maxCount, 1)])
      .range([
        '#e3f2fd',
        '#bbdefb',
        '#90caf9',
        '#64b5f6',
        '#42a5f5',
        '#2196f3',
        '#1e88e5',
        '#1976d2'
      ])
  }, [maxCount])

  // Marker size scale for city bubbles
  const markerScale = useMemo(() => {
    return scaleSqrt()
      .domain([1, Math.max(maxCityCount, 1)])
      .range([4, 20])
  }, [maxCityCount])

  const handleMouseEnter = (geo, event) => {
    const fips = geo.id
    const stateCode = fipsToState[fips]
    const count = stateCode ? (stateCounts[stateCode] || 0) : 0
    const stateName = stateCode ? getStateName(stateCode) : 'Unknown'

    setTooltipContent(`${stateName}: ${count} order${count !== 1 ? 's' : ''}`)
    setTooltipPosition({ x: event.clientX, y: event.clientY })
  }

  const handleCityMouseEnter = (city, event) => {
    setTooltipContent(`${city.city}, ${city.state}: ${city.count} order${city.count !== 1 ? 's' : ''}`)
    setTooltipPosition({ x: event.clientX, y: event.clientY })
  }

  const handleMouseLeave = () => {
    setTooltipContent('')
  }

  const handleMouseMove = (event) => {
    if (tooltipContent) {
      setTooltipPosition({ x: event.clientX, y: event.clientY })
    }
  }

  // Check if we have any shipping data
  const hasData = Object.keys(stateCounts).length > 0

  if (!hasData) {
    return (
      <div className="shipping-map-container">
        <div className="shipping-map-empty">
          <p>No shipping data yet</p>
          <span>Include zip codes to see your orders on a map!</span>
        </div>
      </div>
    )
  }

  // Render the base map (used in both mini and fullscreen)
  const renderMap = (isFullscreen = false) => (
    <ComposableMap
      projection="geoAlbersUsa"
      projectionConfig={{ scale: isFullscreen ? 1000 : 800 }}
      className="shipping-map-svg"
    >
      <Geographies geography={geoUrl}>
        {({ geographies }) =>
          geographies.map(geo => {
            const fips = geo.id
            const stateCode = fipsToState[fips]
            const count = stateCode ? (stateCounts[stateCode] || 0) : 0

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isFullscreen ? '#1e293b' : (count > 0 ? colorScale(count) : '#2a2a3e')}
                stroke={isFullscreen ? '#334155' : '#1a1a2e'}
                strokeWidth={isFullscreen ? 0.75 : 0.5}
                onMouseEnter={!isFullscreen ? (event) => handleMouseEnter(geo, event) : undefined}
                onMouseLeave={!isFullscreen ? handleMouseLeave : undefined}
                style={{
                  default: { outline: 'none' },
                  hover: isFullscreen ? { outline: 'none' } : {
                    fill: count > 0 ? '#4fc3f7' : '#3a3a4e',
                    outline: 'none',
                    cursor: 'pointer'
                  },
                  pressed: { outline: 'none' }
                }}
              />
            )
          })
        }
      </Geographies>

      {/* City markers for fullscreen view */}
      {isFullscreen && citiesWithCoords.map((city, index) => (
        <Marker
          key={`${city.city}-${city.state}`}
          coordinates={city.coordinates}
          onMouseEnter={(event) => handleCityMouseEnter(city, event)}
          onMouseLeave={handleMouseLeave}
        >
          <circle
            r={markerScale(city.count)}
            fill="rgba(33, 150, 243, 0.8)"
            stroke="#fff"
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
          />
          {/* Show label for top cities */}
          {index < 10 && (
            <text
              textAnchor="middle"
              y={markerScale(city.count) + 12}
              style={{
                fontFamily: 'system-ui',
                fontSize: '10px',
                fill: '#fff',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {city.city}
            </text>
          )}
        </Marker>
      ))}
    </ComposableMap>
  )

  return (
    <div className="shipping-map-container">
      {/* Mini map - clickable to open fullscreen */}
      <div
        className="shipping-map-wrapper shipping-map-clickable"
        onMouseMove={handleMouseMove}
        onClick={() => setShowFullscreen(true)}
        title="Click to view full-screen map with city details"
      >
        {renderMap(false)}

        {/* Click hint overlay */}
        <div className="shipping-map-click-hint">
          <Icon name="maximize-2" size={16} />
          <span>Click to expand</span>
        </div>

        {/* Tooltip */}
        {tooltipContent && !showFullscreen && (
          <div
            className="shipping-map-tooltip"
            style={{
              left: tooltipPosition.x + 10,
              top: tooltipPosition.y - 30
            }}
          >
            {tooltipContent}
          </div>
        )}
      </div>

      {/* Top Cities List */}
      {topCities.length > 0 && (
        <div className="shipping-map-cities">
          <h4>Top Destinations</h4>
          <ul>
            {topCities.map((item, index) => (
              <li key={`${item.city}-${item.state}`}>
                <span className="shipping-map-city-rank">{index + 1}</span>
                <span className="shipping-map-city-name">{item.city}, {item.state}</span>
                <span className="shipping-map-city-count">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="shipping-map-legend">
        <span className="shipping-map-legend-label">Fewer</span>
        <div className="shipping-map-legend-gradient"></div>
        <span className="shipping-map-legend-label">More</span>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div className="shipping-map-modal-overlay" onClick={() => setShowFullscreen(false)}>
          <div className="shipping-map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shipping-map-modal-header">
              <h2>
                <Icon name="map" size={20} />
                Shipping Destinations by City
              </h2>
              <button
                className="shipping-map-modal-close"
                onClick={() => setShowFullscreen(false)}
              >
                <Icon name="x" size={24} />
              </button>
            </div>

            <div
              className="shipping-map-modal-content"
              onMouseMove={handleMouseMove}
            >
              {renderMap(true)}

              {/* Tooltip for fullscreen */}
              {tooltipContent && (
                <div
                  className="shipping-map-tooltip"
                  style={{
                    left: tooltipPosition.x + 10,
                    top: tooltipPosition.y - 30
                  }}
                >
                  {tooltipContent}
                </div>
              )}
            </div>

            {/* Fullscreen city list */}
            <div className="shipping-map-modal-sidebar">
              <h3>All Destinations ({citiesWithCoords.length} cities)</h3>
              <div className="shipping-map-modal-cities">
                {citiesWithCoords.map((city, index) => (
                  <div key={`${city.city}-${city.state}`} className="shipping-map-modal-city">
                    <span className="shipping-map-modal-city-rank">{index + 1}</span>
                    <span className="shipping-map-modal-city-name">{city.city}, {city.state}</span>
                    <span className="shipping-map-modal-city-count">{city.count}</span>
                  </div>
                ))}
              </div>

              {/* Stats summary */}
              <div className="shipping-map-modal-stats">
                <div className="shipping-map-modal-stat">
                  <span className="shipping-map-modal-stat-value">{Object.keys(stateCounts).length}</span>
                  <span className="shipping-map-modal-stat-label">States</span>
                </div>
                <div className="shipping-map-modal-stat">
                  <span className="shipping-map-modal-stat-value">{citiesWithCoords.length}</span>
                  <span className="shipping-map-modal-stat-label">Cities</span>
                </div>
                <div className="shipping-map-modal-stat">
                  <span className="shipping-map-modal-stat-value">
                    {sales.filter(s => s.buyer_zip_code).length}
                  </span>
                  <span className="shipping-map-modal-stat-label">Orders</span>
                </div>
              </div>

              {/* Bubble size legend */}
              <div className="shipping-map-modal-legend">
                <span className="shipping-map-modal-legend-title">Bubble Size = Order Volume</span>
                <div className="shipping-map-modal-legend-bubbles">
                  <div className="shipping-map-modal-legend-item">
                    <div className="shipping-map-modal-bubble shipping-map-modal-bubble-sm"></div>
                    <span>1</span>
                  </div>
                  <div className="shipping-map-modal-legend-item">
                    <div className="shipping-map-modal-bubble shipping-map-modal-bubble-md"></div>
                    <span>{Math.round(maxCityCount / 2) || 5}</span>
                  </div>
                  <div className="shipping-map-modal-legend-item">
                    <div className="shipping-map-modal-bubble shipping-map-modal-bubble-lg"></div>
                    <span>{maxCityCount || 10}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShippingMap
