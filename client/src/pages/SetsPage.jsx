import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import { SetCard } from '../components/cards'
import SuggestSetModal from '../components/modals/SuggestSetModal'
import './SetsPageScoped.css'

function SetsPage() {
  const { year } = useParams()
  const { addToast } = useToast()
  const { user } = useAuth()
  
  const [sets, setSets] = useState([])
  const [filteredSets, setFilteredSets] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState('all')
  const [editingSet, setEditingSet] = useState(null)
  const [showSuggestSetModal, setShowSuggestSetModal] = useState(false)

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  // Helper function to determine sport from organization name or abbreviation
  const getSportFromOrganization = (orgName, orgAbbrev) => {
    if (!orgName && !orgAbbrev) return 'other'

    // Check both name and abbreviation (only for sports we have icons for)
    const name = (orgName || '').toLowerCase()
    const abbrev = (orgAbbrev || '').toLowerCase()

    if (name.includes('baseball') || abbrev === 'mlb') return 'baseball'
    if (name.includes('football') || abbrev === 'nfl') return 'football'
    if (name.includes('basketball') || abbrev === 'nba') return 'basketball'
    // Hockey and soccer not included - no icons yet
    return 'other'
  }

  // Get unique sports from sets
  const availableSports = React.useMemo(() => {
    const sports = new Set()
    sets.forEach(set => {
      const sport = getSportFromOrganization(set.organization_name, set.organization)
      if (sport !== 'other') {  // Only add recognized sports
        sports.add(sport)
      }
    })
    const sportsList = Array.from(sports).sort()
    console.log('Available sports:', sportsList, 'from', sets.length, 'sets')
    return sportsList
  }, [sets])

  // Helper function to generate URL slug (matching backend)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/'/g, '') // Remove apostrophes completely
      .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  useEffect(() => {
    if (year) {
      loadSetsForYear(year)
      document.title = `${year} Card Sets - Collect Your Cards`
    } else {
      document.title = 'Card Sets - Collect Your Cards'
    }

  }, [year])

  // Filter sets based on search term and sport
  useEffect(() => {
    let filtered = sets

    // Filter by sport
    if (selectedSport !== 'all') {
      filtered = filtered.filter(set => {
        const sport = getSportFromOrganization(set.organization_name, set.organization)
        return sport === selectedSport
      })
    }

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(set =>
        set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (set.organization && set.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (set.manufacturer && set.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredSets(filtered)
  }, [sets, searchTerm, selectedSport])

  const loadSetsForYear = async (yearParam) => {
    try {
      setLoading(true)
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []
      
      // Filter sets by year
      const yearSets = allSets.filter(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        return setYear === parseInt(yearParam)
      })
      
      // Add sport to each set (slug already comes from database)
      const setsWithSlugs = yearSets.map(set => {
        const sport = getSportFromOrganization(set.organization_name, set.organization)
        console.log('Set:', set.name, 'Org:', set.organization, 'OrgName:', set.organization_name, 'Sport:', sport, 'Slug:', set.slug)
        return {
          ...set,
          // Don't override slug - use the one from database
          sport
        }
      })

      // Sort sets: alphabetically by name, but "coming soon" (no cards) at the end
      setsWithSlugs.sort((a, b) => {
        const aHasCards = (a.total_card_count || a.card_count || 0) > 0
        const bHasCards = (b.total_card_count || b.card_count || 0) > 0

        // If one has cards and one doesn't, the one with cards comes first
        if (aHasCards && !bHasCards) return -1
        if (!aHasCards && bHasCards) return 1

        // Both have cards or both don't - sort alphabetically
        const nameA = (a.name || '').toLowerCase()
        const nameB = (b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })

      setSets(setsWithSlugs)
      setFilteredSets(setsWithSlugs)
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast(`Failed to load sets: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSet = (set) => {
    setEditingSet(set)
    setShowSuggestSetModal(true)
  }

  const handleCloseModal = () => {
    setShowSuggestSetModal(false)
    setEditingSet(null)
  }

  const handleSaveSuccess = () => {
    loadSetsForYear(year)
    handleCloseModal()
  }

  return (
    <div className="sets-page">
      <div className="content-area">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading...</span>
          </div>
        ) : (
          <div className="sets-list">
            <div className="sets-grid-unified">
              {/* Header as grid items */}
              <div className="grid-header-title-with-back">
                <Link
                  to="/sets"
                  className="back-button"
                  title="Go back"
                >
                  <Icon name="arrow-left" size={24} />
                </Link>
                <Icon name="layers" size={32} />
                <h1>{year} Sets</h1>
              </div>

              {/* Sport Filter Panel - between title and search */}
              {availableSports.length >= 1 && (
                <div className="grid-header-sport-filters">
                  <button
                    className={`sport-filter-btn ${selectedSport === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedSport('all')}
                    title="All Sports"
                  >
                    <Icon name="layers" size={18} />
                  </button>
                  {availableSports.map(sport => {
                    // Map sport to icon name
                    const iconName = sport === 'baseball' ? 'baseball' :
                                     sport === 'football' ? 'football' :
                                     sport === 'basketball' ? 'basketball' :
                                     'layers'

                    // Map sport to display name
                    const displayName = sport.charAt(0).toUpperCase() + sport.slice(1)

                    return (
                      <button
                        key={sport}
                        className={`sport-filter-btn ${selectedSport === sport ? 'active' : ''}`}
                        onClick={() => setSelectedSport(sport)}
                        title={displayName}
                      >
                        <Icon name={iconName} size={18} />
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="grid-header-search-sets">
                <div className="search-box">
                  <Icon name="search" size={20} />
                  <input
                    type="text"
                    placeholder="Search sets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              {/* Force new row after header */}
              <div className="grid-row-break"></div>
              {/* Set cards */}
              {filteredSets.map(set => (
                <SetCard
                  key={set.set_id}
                  set={{
                    ...set,
                    name: set.name,
                    year: set.year || parseInt(year),
                    card_count: set.total_card_count || set.card_count || 0,
                    series_count: set.series_count || 0,
                    manufacturer: set.manufacturer_name,
                    organization: set.organization,
                    thumbnail: set.thumbnail,
                    slug: set.slug,
                    sport: set.sport
                  }}
                  onEditClick={handleEditSet}
                />
              ))}
              {filteredSets.length === 0 && sets.length > 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <p>No sets found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {user && (
        <div className="sets-page-floating-action-container">
          <button
            className="sets-page-floating-action-button"
            onClick={() => setShowSuggestSetModal(true)}
            title="Suggest a new set"
          >
            <Icon name="plus" size={20} />
          </button>
        </div>
      )}

      {/* Suggest/Edit Set Modal */}
      {showSuggestSetModal && createPortal(
        <SuggestSetModal
          isOpen={showSuggestSetModal}
          onClose={handleCloseModal}
          onSuccess={handleSaveSuccess}
          preselectedYear={parseInt(year)}
          editSet={editingSet}
        />,
        document.body
      )}
    </div>
  )
}

export default SetsPage