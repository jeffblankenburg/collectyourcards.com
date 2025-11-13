import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import PlayerDetailHeader from '../components/PlayerDetailHeader'
import CardTable from '../components/tables/CardTable'
import TeamFilterCircles from '../components/TeamFilterCircles'
import PlayerStats from '../components/PlayerStats'
import Icon from '../components/Icon'
import EditPlayerModal from '../components/modals/EditPlayerModal'
import AddCardModal from '../components/modals/AddCardModal'
import { createLogger } from '../utils/logger'
import './PlayerDetailScoped.css'

const log = createLogger('PlayerDetail')

function PlayerDetail() {
  const params = useParams()
  log.info('PlayerDetail mounted', params)
  const { playerSlug, teamSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { success, error: showToastError } = useToast()
  const [player, setPlayer] = useState(null)
  const [cards, setCards] = useState([])
  const [teams, setTeams] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeStatFilter, setActiveStatFilter] = useState(null)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [cardToAdd, setCardToAdd] = useState(null)
  // Infinite scroll state
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  useEffect(() => {
    fetchPlayerData()
  }, [playerSlug])

  // Set page title
  useEffect(() => {
    if (player) {
      document.title = `${player.first_name} ${player.last_name}${player.nick_name ? ` "${player.nick_name}"` : ''} - Collect Your Cards`
    } else {
      document.title = 'Player Details - Collect Your Cards'
    }
  }, [player])

  // Track player visit when player data is loaded
  useEffect(() => {
    if (player) {
      trackPlayerVisit(player)
    }
  }, [player])


  // Apply team filter from URL or navigation state
  useEffect(() => {
    if (teams.length > 0) {
      // First check for teamSlug in URL
      if (teamSlug) {
        // Find team by matching slug
        const matchingTeam = teams.find(team => {
          const teamSlugGenerated = team.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          return teamSlugGenerated === teamSlug
        })
        
        if (matchingTeam) {
          setSelectedTeamIds([matchingTeam.team_id])
        }
        // If teamSlug doesn't match any of the player's teams, ignore it (show all teams)
      } else if (location.state?.selectedTeamId) {
        // Fallback to navigation state
        const teamExists = teams.some(t => t.team_id === location.state.selectedTeamId)
        if (teamExists) {
          setSelectedTeamIds([location.state.selectedTeamId])
        }
      }
    }
  }, [teams, teamSlug, location.state])

  const fetchPlayerData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/players/by-slug/${playerSlug}`)
      
      const { player: playerData, cards: cardsData, teams: teamsData, stats: statsData } = response.data

      setPlayer(playerData)
      setTeams(teamsData)
      setStats(statsData)
      setError(null)
      
      // Fetch cards separately for CardTable
      if (playerData) {
        await fetchCards(playerData)
      }
    } catch (err) {
      console.error('Error fetching player data:', err)
      setError(err.response?.data?.error || 'Failed to load player data')
    } finally {
      setLoading(false)
    }
  }

  const fetchCards = async (playerData, page = 1, search = '', append = false) => {
    try {
      // Use different loading state for initial vs appending
      if (append) {
        setLoadingMore(true)
      } else {
        setCardsLoading(true)
      }

      // Build query params
      const params = {
        player_name: `${playerData.first_name} ${playerData.last_name}`,
        limit: 100,
        page
      }

      // Add search if provided
      if (search.trim()) {
        params.search = search.trim()
      }

      const response = await axios.get('/api/cards', { params })

      const newCards = response.data.cards || []

      // Append to existing cards or replace
      if (append) {
        // Filter out duplicates - create a Set of existing card IDs
        setCards(prevCards => {
          const existingIds = new Set(prevCards.map(c => c.card_id))
          const uniqueNewCards = newCards.filter(c => !existingIds.has(c.card_id))
          return [...prevCards, ...uniqueNewCards]
        })
      } else {
        setCards(newCards)
      }

      setHasMore(response.data.hasMore || false)
      setTotalCards(response.data.total || 0)
      setCurrentPage(page)
    } catch (err) {
      console.error('Error fetching cards:', err)
      if (!append) {
        setCards([])
      }
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setCardsLoading(false)
      }
    }
  }

  // Load more cards (infinite scroll)
  const loadMoreCards = async () => {
    if (!player || !hasMore || cardsLoading) return
    await fetchCards(player, currentPage + 1, searchQuery, true)
  }

  // Handle search from CardTable
  const handleSearch = async (query) => {
    if (!player) return
    setSearchQuery(query)
    await fetchCards(player, 1, query, false)
  }

  const trackPlayerVisit = async (player) => {
    try {
      // Track visit on backend
      await axios.post('/api/players/track-visit', {
        player_id: player.player_id
      })

      // For authenticated users, also update localStorage for immediate UI feedback
      if (isAuthenticated) {
        const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
        
        // Remove if already exists
        const filtered = recent.filter(p => p.player_id !== player.player_id)
        
        // Add to front with slug for navigation
        const playerWithSlug = {
          ...player,
          slug: `${player.first_name}-${player.last_name}`
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
        }
        const updated = [playerWithSlug, ...filtered].slice(0, 20) // Keep max 20
        
        localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Error tracking visit:', err)
      
      // Fallback to localStorage tracking for authenticated users if API fails
      if (isAuthenticated) {
        try {
          const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
          const filtered = recent.filter(p => p.player_id !== player.player_id)
          const playerWithSlug = {
            ...player,
            slug: `${player.first_name}-${player.last_name}`
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
          }
          const updated = [playerWithSlug, ...filtered].slice(0, 20)
          localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
        } catch (localErr) {
          console.error('Error with localStorage fallback:', localErr)
        }
      }
    }
  }

  const handleTeamFilter = (teamIds) => {
    setSelectedTeamIds(teamIds)
  }

  const handleStatFilter = (statType) => {
    if (activeStatFilter === statType) {
      // If clicking the same filter, turn it off
      setActiveStatFilter(null)
    } else {
      // Set new active filter
      setActiveStatFilter(statType)
    }
  }

  const handleSeriesClick = (series) => {
    if (series) {
      // Use stored slug from database instead of generating dynamically
      const slug = series.slug || series.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      // Use canonical URL with year/setSlug if available (from series_rel)
      if (series.set_year && series.set_slug) {
        navigate(`/sets/${series.set_year}/${series.set_slug}/${slug}`)
      } else {
        // Fallback to simple series route (will redirect to canonical)
        navigate(`/series/${slug}`)
      }
    }
  }

  // NOTE: Team and stat filtering removed - search box now handles ALL filtering via server-side search
  // Users can type "chrome rc" to get Chrome rookies, etc.

  const handleCardClick = (card) => {
    // Navigate to card detail page
    if (card.series_rel && card.card_number) {
      // Use stored slug from database instead of generating dynamically
      const seriesSlug = card.series_rel.slug || card.series_rel.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      const playerSlug = card.card_player_teams?.[0]?.player ?
        `${card.card_player_teams[0].player.first_name}-${card.card_player_teams[0].player.last_name}`
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim() : 'unknown'

      navigate(`/card/${seriesSlug}/${card.card_number}/${playerSlug}`)
    }
  }

  const handleAddCard = (card) => {
    if (!isAuthenticated) {
      showToastError('Please log in to add cards to your collection')
      return
    }

    // Open modal with card data
    setCardToAdd(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = async (newUserCard) => {
    // Refresh cards from server to show updated ownership
    if (player) {
      await fetchCards(player)
    }

    // Close modal
    setShowAddCardModal(false)
    setCardToAdd(null)
  }

  const handleBulkAddCards = async () => {
    if (!isAuthenticated) {
      showToastError('Please log in to add cards to your collection')
      return
    }

    if (selectedCards.size === 0) return

    try {
      // Add multiple cards to collection
      const cardIds = Array.from(selectedCards)
      const response = await axios.post('/api/user/cards/bulk', {
        card_ids: cardIds
      })
      
      success(`Added ${selectedCards.size} cards to your collection`)
      
      // Update all selected cards' user_card_count
      setCards(prevCards => 
        prevCards.map(c => 
          selectedCards.has(c.card_id)
            ? { ...c, user_card_count: (c.user_card_count || 0) + 1 }
            : c
        )
      )
      
      // Clear selection after successful bulk add
      setSelectedCards(new Set())
      setBulkSelectionMode(false)
    } catch (err) {
      console.error('Error adding cards:', err)
      showToastError(err.response?.data?.error || 'Failed to add cards to collection')
    }
  }

  const handleBulkSelectionToggle = () => {
    setBulkSelectionMode(!bulkSelectionMode)
    setSelectedCards(new Set()) // Clear selection when toggling modes
  }




  if (loading) {
    return (
      <div className="player-detail-page">
        <div className="loading-container">
          <div className="card-icon-spinner"></div>
          <p>Loading player details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="player-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <h2>Player Not Found</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="player-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <h2>Player Not Found</h2>
          <p>The requested player could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="player-detail-page">
      <div className="player-detail-container">
        
        {/* Player Header Component */}
        <PlayerDetailHeader
          player={player}
          teams={teams}
          stats={stats}
          selectedTeamIds={selectedTeamIds}
          onTeamFilter={handleTeamFilter}
          activeStatFilter={activeStatFilter}
          onStatFilter={handleStatFilter}
        />

        {/* Cards Table with infinite scroll and server-side search */}
        <CardTable
          cards={cards}
          totalCards={totalCards}
          loading={cardsLoading}
          loadingMore={loadingMore}
          onCardClick={handleCardClick}
          onSeriesClick={handleSeriesClick}
          showSearch={true}
          autoFocusSearch={true}
          onSearchChange={handleSearch}
          onLoadMore={loadMoreCards}
          hasMore={hasMore}
          downloadFilename={`${player?.first_name || 'player'}-${player?.last_name || 'cards'}-cards`}
          showBulkActions={true}
          bulkSelectionMode={bulkSelectionMode}
          selectedCards={selectedCards}
          onBulkSelectionToggle={handleBulkSelectionToggle}
          onCardSelection={setSelectedCards}
          onBulkAction={handleBulkAddCards}
          onAddCard={handleAddCard}
        />

      </div>

      {/* Admin Edit Button */}
      {isAdmin && player && (
        <button 
          className="admin-edit-button"
          onClick={() => setShowEditModal(true)}
          title="Edit player (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}
      
      {/* Edit Modal */}
      {showEditModal && player && (
        <EditPlayerModal
          player={player}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            fetchPlayerData() // Reload player data after save
          }}
        />
      )}
      
      {/* Add Card Modal */}
      {showAddCardModal && cardToAdd && (
        <AddCardModal
          isOpen={showAddCardModal}
          onClose={() => {
            setShowAddCardModal(false)
            setCardToAdd(null)
          }}
          card={cardToAdd}
          onCardAdded={handleCardAdded}
        />
      )}
    </div>
  )
}

export default PlayerDetail