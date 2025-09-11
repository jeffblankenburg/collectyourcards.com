import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import { YearCard } from '../components/cards'
import './YearsPageScoped.css'

function YearsPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  
  const [years, setYears] = useState([])
  const [filteredYears, setFilteredYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadYears()
    document.title = 'Card Sets by Year - Collect Your Cards'
  }, [])

  // Filter years based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredYears(years)
    } else {
      const filtered = years.filter(y => 
        y.year.toString().includes(searchTerm)
      )
      setFilteredYears(filtered)
    }
  }, [years, searchTerm])

  const loadYears = async () => {
    try {
      setLoading(true)
      // Use the existing sets-list endpoint to extract years
      const response = await axios.get('/api/sets-list')
      const setsData = response.data.sets || []
      
      // Group sets by year and count series and cards
      const yearStats = {}
      setsData.forEach(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        if (setYear && setYear >= 1900 && setYear <= new Date().getFullYear() + 10) {
          if (!yearStats[setYear]) {
            yearStats[setYear] = { year: setYear, setCount: 0, seriesCount: 0, cardCount: 0 }
          }
          yearStats[setYear].setCount += 1
          yearStats[setYear].seriesCount += set.series_count || 0
          yearStats[setYear].cardCount += set.total_card_count || set.card_count || 0
        }
      })
      
      const yearsData = Object.values(yearStats).sort((a, b) => b.year - a.year)
      setYears(yearsData)
      setFilteredYears(yearsData)
    } catch (error) {
      console.error('Error loading years:', error)
      addToast(`Failed to load years: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="years-page">
      <div className="content-area">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading...</span>
          </div>
        ) : (
          <div className="years-grid-unified">
            {/* Header as grid items */}
            <div className="grid-header-title">
              <Icon name="layers" size={32} />
              <h1>Sets & Series</h1>
            </div>
            <div className="grid-header-search">
              <div className="search-box">
                <Icon name="search" size={20} />
                <input
                  type="text"
                  placeholder="Search years..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            {/* Force new row after header */}
            <div className="grid-row-break"></div>
            {/* Year cards */}
            {filteredYears.map(y => (
              <YearCard 
                key={y.year}
                year={{
                  year: y.year,
                  card_count: y.cardCount, // Total cards across all sets in this year
                  set_count: y.setCount
                }}
              />
            ))}
            {filteredYears.length === 0 && years.length > 0 && (
              <div className="empty-state">
                <Icon name="search" size={48} />
                <p>No years found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default YearsPage