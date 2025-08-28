import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import { PlayerCard, TeamCard, SetCard, SeriesCard, YearCard, CardCard } from '../components/cards'
import './SearchResults.css'

function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  
  const searchQuery = searchParams.get('q') || ''
  
  const [results, setResults] = useState({
    players: [],
    teams: [],
    sets: [],
    series: [],
    years: [],
    cards: []
  })
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState('relevance')
  const [totalResults, setTotalResults] = useState(0)
  const [searchTime, setSearchTime] = useState(0)

  // Perform search when query changes
  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery)
    } else {
      // Clear results if no query
      setResults({
        players: [],
        teams: [],
        sets: [],
        series: [],
        years: [],
        cards: []
      })
      setTotalResults(0)
    }
  }, [searchQuery])

  const performSearch = async (query) => {
    setLoading(true)
    const startTime = Date.now()
    
    try {
      // Show mock data for "jeffblankenburg" query, real data for everything else
      if (query.toLowerCase() === 'jeffblankenburg') {
        // Mock data for testing UI components
        const fakeResults = {
        players: [
          {
            type: 'player',
            player_id: '1',
            first_name: 'Shane',
            last_name: 'Bieber',
            nick_name: 'The Bieb',
            card_count: 847,
            rc_count: 23,
            is_hof: false,
            teams: [
              {
                team_id: 9,
                name: 'Cleveland Guardians',
                abbreviation: 'CLE',
                primary_color: '#00385D',
                secondary_color: '#E50022',
                card_count: 847
              }
            ]
          },
          {
            type: 'player',
            player_id: '2',
            first_name: 'Christian',
            last_name: 'Encarnacion-Strand',
            nick_name: 'CES',
            card_count: 234,
            rc_count: 45,
            is_hof: false,
            teams: [
              {
                team_id: 21,
                name: 'Cincinnati Reds',
                abbreviation: 'CIN',
                primary_color: '#C6011F',
                secondary_color: '#000000',
                card_count: 234
              }
            ]
          },
          {
            type: 'player',
            player_id: '3',
            first_name: 'Aaron',
            last_name: 'Judge',
            nick_name: 'The Judge',
            card_count: 1456,
            rc_count: 67,
            is_hof: false,
            teams: [
              {
                team_id: 10,
                name: 'New York Yankees',
                abbreviation: 'NYY',
                primary_color: '#0C2340',
                secondary_color: '#C4CED3',
                card_count: 1456
              }
            ]
          },
          {
            type: 'player',
            player_id: '4',
            first_name: 'Mookie',
            last_name: 'Betts',
            nick_name: null,
            card_count: 892,
            rc_count: 12,
            is_hof: true,
            teams: [
              {
                team_id: 22,
                name: 'Los Angeles Dodgers',
                abbreviation: 'LAD',
                primary_color: '#005A9C',
                secondary_color: '#FFFFFF',
                card_count: 892
              }
            ]
          }
        ],
        teams: [
          {
            type: 'team',
            team_id: '9',
            name: 'Cleveland Guardians',
            abbreviation: 'CLE',
            primary_color: '#00385D',
            secondary_color: '#E50022',
            organization_abbreviation: 'MLB',
            card_count: 12456,
            player_count: 89
          },
          {
            type: 'team',
            team_id: '22',
            name: 'Los Angeles Dodgers',
            abbreviation: 'LAD',
            primary_color: '#005A9C',
            secondary_color: '#FFFFFF',
            organization_abbreviation: 'MLB',
            card_count: 15678,
            player_count: 134
          },
          {
            type: 'team',
            team_id: '10',
            name: 'New York Yankees',
            abbreviation: 'NYY',
            primary_color: '#0C2340',
            secondary_color: '#C4CED3',
            organization_abbreviation: 'MLB',
            card_count: 23890,
            player_count: 267
          }
        ],
        sets: [
          {
            type: 'set',
            set_id: '1',
            name: '2024 Panini National Sports Collectors Convention VIP Rookies',
            year: 2024,
            manufacturer: 'Panini',
            card_count: 6890,
            series_count: 12,
            slug: '2024-panini-national-sports-collectors-convention-vip-rookies',
            thumbnail_image: 'https://cardcheckliststorage.blob.core.windows.net/series/front/1.jpg'
          },
          {
            type: 'set',
            set_id: '2',
            name: '1987 Topps',
            year: 1987,
            manufacturer: 'Topps',
            card_count: 3420,
            series_count: 8,
            slug: '1987-topps',
            thumbnail_image: 'https://cardcheckliststorage.blob.core.windows.net/series/front/1.jpg'
          }
        ],
        years: [
          {
            type: 'year',
            year: 2022,
            card_count: 15780,
            set_count: 25,
            player_count: 1240,
            rookie_count: 280
          },
          {
            type: 'year',
            year: 2023,
            card_count: 18950,
            set_count: 28,
            player_count: 1380,
            rookie_count: 310
          },
          {
            type: 'year',
            year: 2024,
            card_count: 12340,
            set_count: 18,
            player_count: 980,
            rookie_count: 245
          }
        ],
        series: [
          {
            type: 'series',
            series_id: '1',
            name: '2023 Topps Chrome Platinum Anniversary',
            set_name: '2023 Topps Chrome',
            color_name: 'Platinum',
            color_hex: '#C0C0C0',
            card_count: 450,
            rc_count: 15,
            is_base: false,
            parallel_of: true,
            parallel_parent_name: '2023 Topps Chrome Base',
            print_run_display: '199',
            parallel_count: 0,
            slug: '2023-topps-chrome-platinum'
          },
          {
            type: 'series',
            series_id: '2',
            name: '2022 Topps Base',
            set_name: '2022 Topps',
            card_count: 330,
            rc_count: 28,
            is_base: true,
            parallel_of: false,
            parallel_count: 5,
            slug: '2022-topps-base'
          },
          {
            type: 'series',
            series_id: '3',
            name: '2023 Topps Chrome Gold Refractor',
            set_name: '2023 Topps Chrome',
            color_name: 'Gold',
            color_hex: '#FFD700',
            card_count: 330,
            rc_count: 12,
            is_base: false,
            parallel_of: true,
            parallel_parent_name: '2023 Topps Chrome Base',
            print_run_display: '50',
            parallel_count: 0,
            slug: '2023-topps-chrome-gold-refractor'
          }
        ],
        cards: [
          {
            type: 'card',
            card_id: '1',
            card_number: 'T87-1',
            player_name: 'Barry Bonds',
            team_name: 'Pittsburgh Pirates',
            team_abbreviation: 'PIT',
            team_primary_color: '#27251F',
            team_secondary_color: '#FDB827',
            series_name: '1987 Topps Base',
            set_name: '1987 Topps',
            is_rookie: true,
            is_autograph: false,
            is_relic: false,
            is_insert: false,
            is_parallel: false,
            print_run: null,
            user_count: 3,
            estimated_value: '25.00',
            series_slug: '1987-topps-base'
          },
          {
            type: 'card',
            card_id: '2',
            card_number: 'AU-JB',
            player_name: 'Christian Encarnacion-Strand',
            team_name: 'Minnesota Twins',
            team_abbreviation: 'MIN',
            team_primary_color: '#002B5C',
            team_secondary_color: '#D31145',
            series_name: '2024 Topps Update 24 All-Star Game Autographs',
            set_name: '2024 Topps Update',
            is_rookie: false,
            is_autograph: true,
            is_relic: false,
            is_insert: true,
            is_parallel: false,
            print_run: null,
            user_count: 1,
            estimated_value: '150.00',
            series_slug: '2024-topps-update-24-all-star-game-autographs'
          },
          {
            type: 'card',
            card_id: '3',
            card_number: 'MB-17',
            player_name: 'Mike Trout',
            team_name: 'Los Angeles Angels',
            team_abbreviation: 'LAA',
            team_primary_color: '#003263',
            team_secondary_color: '#BA0021',
            series_name: '2023 Topps Chrome Gold Refractor',
            set_name: '2023 Topps Chrome',
            is_rookie: false,
            is_autograph: false,
            is_relic: true,
            is_insert: false,
            is_parallel: true,
            print_run: 50,
            serial_number: 17,
            user_count: 0,
            estimated_value: '89.99',
            series_slug: '2023-topps-chrome-gold-refractor'
          },
          {
            type: 'card',
            card_id: '4',
            card_number: 'CS-1',
            title: 'Championship Celebration',
            series_name: '2022 Topps Inserts',
            set_name: '2022 Topps',
            is_rookie: false,
            is_autograph: false,
            is_relic: false,
            is_insert: true,
            is_parallel: false,
            print_run: 199,
            user_count: 2,
            estimated_value: '5.50',
            series_slug: '2022-topps-inserts'
          }
        ]
      }
      
        setResults(fakeResults)
        
        // Calculate total results
        const total = 
          fakeResults.cards.length +
          fakeResults.players.length +
          fakeResults.teams.length +
          fakeResults.sets.length +
          fakeResults.series.length +
          fakeResults.years.length
        
        setTotalResults(total)
        setSearchTime(Date.now() - startTime)
        
      } else {
        // Real API call for all other queries
        const response = await axios.get(`/api/search/universal?q=${encodeURIComponent(query)}&limit=50`)
        const { results = [] } = response.data
        
        // Organize results by type
        const organizedResults = {
          players: [],
          teams: [],
          sets: [],
          series: [],
          years: [],
          cards: []
        }
        
        results.forEach(result => {
          // Map API result types to our result categories
          switch(result.type) {
            case 'player':
              organizedResults.players.push({
                ...result.data,
                type: 'player'
              })
              break
            case 'team':
              organizedResults.teams.push({
                ...result.data,
                type: 'team'
              })
              break
            case 'series':
              organizedResults.series.push({
                ...result.data,
                type: 'series'
              })
              break
            case 'card':
              organizedResults.cards.push({
                ...result.data,
                type: 'card',
                // Map API fields to component fields
                card_id: result.data.card_id,
                card_number: result.data.card_number,
                player_name: result.data.player_names || 'Unknown Player',
                team_name: result.data.team_name,
                team_abbreviation: result.data.team_abbreviation,
                team_primary_color: result.data.team_primary_color,
                team_secondary_color: result.data.team_secondary_color,
                series_name: result.data.series_name,
                set_name: result.data.set_name,
                is_rookie: result.data.is_rookie,
                is_autograph: result.data.is_autograph,
                is_relic: result.data.is_relic,
                is_insert: false, // Not available in database
                is_parallel: result.data.is_parallel,
                color_name: result.data.color_name,
                color_hex: result.data.color_hex,
                print_run: result.data.print_run,
                serial_number: null, // Not available in database
                estimated_value: '0.00', // TODO: Add to API when available
                user_count: 0, // TODO: Add to API when available
                series_slug: result.data.series_slug || `series-${result.data.series_id || result.id}`
              })
              break
            default:
              console.log('Unknown result type:', result.type)
          }
        })
        
        setResults(organizedResults)
        setTotalResults(results.length)
        setSearchTime(Date.now() - startTime)
      }
      
    } catch (error) {
      console.error('Search failed:', error)
      setResults({
        players: [],
        teams: [],
        sets: [],
        series: [],
        years: [],
        cards: []
      })
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  // Get filtered results based on active tab
  const getFilteredResults = () => {
    if (activeTab === 'all') {
      // Combine all results for "All" tab
      const allResults = []
      
      results.players.forEach(player => allResults.push({ ...player, type: 'player' }))
      results.teams.forEach(team => allResults.push({ ...team, type: 'team' }))
      results.cards.forEach(card => allResults.push({ ...card, type: 'card' }))
      results.sets.forEach(set => allResults.push({ ...set, type: 'set' }))
      results.series.forEach(series => allResults.push({ ...series, type: 'series' }))
      results.years.forEach(year => allResults.push({ ...year, type: 'year' }))
      
      // Sort by relevance or name
      if (sortBy === 'name') {
        allResults.sort((a, b) => {
          const aName = a.title || a.name || ''
          const bName = b.title || b.name || ''
          return aName.localeCompare(bName)
        })
      }
      
      return allResults
    } else {
      // Return specific category
      return results[activeTab] || []
    }
  }

  const filteredResults = getFilteredResults()

  // Get count for specific tab
  const getTabCount = (tab) => {
    if (tab === 'all') return totalResults
    return results[tab]?.length || 0
  }

  // Handle result click
  const handleResultClick = (result) => {
    switch (result.type) {
      case 'player':
        navigate(`/players/${result.slug || result.player_id}`)
        break
      case 'team':
        navigate(`/teams/${result.slug || result.team_id}`)
        break
      case 'set':
        navigate(`/sets/${result.year}/${result.slug}`)
        break
      case 'series':
        navigate(`/series/${result.slug || result.series_id}`)
        break
      case 'year':
        navigate(`/years/${result.year}`)
        break
      case 'card':
        // For cards, navigate to the series detail page
        navigate(`/series/${result.series_id}`)
        break
    }
  }

  // Handle team click for player cards
  const handleTeamClick = (teamId) => {
    navigate(`/teams/${teamId}`)
  }

  // Render result based on type
  const renderResultCard = (result, index) => {
    // Generate more specific keys based on result type
    let key
    switch (result.type) {
      case 'player':
        key = `player-${result.id || result.player_id || index}`
        break
      case 'team':
        key = `team-${result.id || result.team_id || index}`
        break
      case 'set':
        key = `set-${result.id || result.set_id || index}`
        break
      case 'series':
        key = `series-${result.id || result.series_id || index}`
        break
      case 'year':
        key = `year-${result.id || result.year || index}`
        break
      case 'card':
        key = `card-${result.id || result.card_id || result.data?.card_id || index}`
        break
      default:
        key = `unknown-${result.type}-${index}`
    }
    
    switch (result.type) {
      case 'player':
        return <PlayerCard key={key} player={result} showBadge={false} onTeamClick={handleTeamClick} />
      case 'team':
        return <TeamCard key={key} team={result} showBadge={false} />
      case 'set':
        return <SetCard key={key} set={result} showBadge={false} />
      case 'series':
        return <SeriesCard key={key} series={result} showBadge={false} />
      case 'year':
        return <YearCard key={key} year={result} showBadge={false} />
      case 'card':
        return <CardCard key={key} card={result} showBadge={false} />
      default:
        console.log('Unknown result type:', result.type)
        return null
    }
  }

  // Handle empty query
  if (!searchQuery) {
    return (
      <div className="search-results-page">
        <div className="search-results-container">
          <div className="empty-state">
            <Icon name="search" size={48} />
            <h2>Enter a search term</h2>
            <p>Search for players, teams, cards, or sets</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="search-results-page">
      <div className="search-results-container">
        {/* Search Header */}
        <div className="search-header">
          <div className="search-summary">
            <h1>
              {loading ? (
                'Searching...'
              ) : (
                <>
                  {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchQuery}"
                </>
              )}
            </h1>
            {!loading && searchTime > 0 && (
              <span className="search-time">Found in {searchTime}ms</span>
            )}
          </div>
          
          {!loading && totalResults > 0 && (
            <div className="search-controls">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="relevance">Most Relevant</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          )}
        </div>

        {/* Category Tabs */}
        {!loading && totalResults > 0 && (
          <div className="search-tabs">
            <button
              className={`search-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
              <span className="tab-count">{getTabCount('all')}</span>
            </button>
            
            {results.players.length > 0 && (
              <button
                className={`search-tab ${activeTab === 'players' ? 'active' : ''}`}
                onClick={() => setActiveTab('players')}
              >
                <Icon name="user" size={16} />
                Players
                <span className="tab-count">{getTabCount('players')}</span>
              </button>
            )}
            
            {results.teams.length > 0 && (
              <button
                className={`search-tab ${activeTab === 'teams' ? 'active' : ''}`}
                onClick={() => setActiveTab('teams')}
              >
                <Icon name="shield" size={16} />
                Teams
                <span className="tab-count">{getTabCount('teams')}</span>
              </button>
            )}
            
            {results.cards.length > 0 && (
              <button
                className={`search-tab ${activeTab === 'cards' ? 'active' : ''}`}
                onClick={() => setActiveTab('cards')}
              >
                <Icon name="card" size={16} />
                Cards
                <span className="tab-count">{getTabCount('cards')}</span>
              </button>
            )}
            
            {results.sets.length > 0 && (
              <button
                className={`search-tab ${activeTab === 'sets' ? 'active' : ''}`}
                onClick={() => setActiveTab('sets')}
              >
                <Icon name="layers" size={16} />
                Sets
                <span className="tab-count">{getTabCount('sets')}</span>
              </button>
            )}
            
            {results.series.length > 0 && (
              <button
                className={`search-tab ${activeTab === 'series' ? 'active' : ''}`}
                onClick={() => setActiveTab('series')}
              >
                <Icon name="collection" size={16} />
                Series
                <span className="tab-count">{getTabCount('series')}</span>
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="search-results">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">
                <Icon name="activity" size={32} className="spinning" />
              </div>
              <p>Searching the database...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="no-results">
              <Icon name="search" size={48} />
              <h2>No results found for "{searchQuery}"</h2>
              <p>Try adjusting your search terms or browse our categories:</p>
              <div className="browse-links">
                <Link to="/players" className="browse-link">
                  <Icon name="user" size={20} />
                  Browse Players
                </Link>
                <Link to="/teams" className="browse-link">
                  <Icon name="shield" size={20} />
                  Browse Teams
                </Link>
                <Link to="/sets" className="browse-link">
                  <Icon name="layers" size={20} />
                  Browse Sets
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid-responsive grid-cards-md">
              {filteredResults.map((result, index) => renderResultCard(result, index))}
            </div>
          )}
        </div>
        
        {/* Show more results hint */}
        {!loading && filteredResults.length >= 50 && (
          <div className="results-footer">
            <p className="results-hint">
              Showing first 50 results. Try refining your search for more specific results.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResults