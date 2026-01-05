/**
 * API Registry - Central source of truth for all API endpoint documentation
 *
 * This file defines the metadata for all documented API endpoints, including:
 * - Path and HTTP method
 * - Category and tags for organization
 * - Authentication requirements
 * - Rate limiting info
 * - Request parameters and body schema
 * - Response schemas and examples
 */

const apiRegistry = {
  // =============================================================================
  // API v1 - VERSIONED RESTFUL API
  // =============================================================================

  // -----------------------------------------------------------------------------
  // v1 Health Check
  // -----------------------------------------------------------------------------
  'v1-health': {
    id: 'v1-health',
    path: '/api/v1/health',
    method: 'GET',
    category: 'Health',
    summary: 'Check API v1 health status',
    description: 'Returns the health status and version information for API v1.',
    auth: {
      required: false,
      type: null
    },
    responses: {
      200: {
        description: 'API health status',
        example: {
          success: true,
          data: {
            version: '1.0.0',
            status: 'operational',
            timestamp: '2024-01-15T10:30:00.000Z'
          }
        }
      }
    },
    tags: ['v1', 'health', 'status']
  },

  // -----------------------------------------------------------------------------
  // v1 Players Endpoints
  // -----------------------------------------------------------------------------
  'v1-players-list': {
    id: 'v1-players-list',
    path: '/api/v1/players',
    method: 'GET',
    category: 'Players',
    summary: 'List players with filtering and pagination',
    description: 'Returns a paginated list of players with optional filtering by name, Hall of Fame status, and alphabetical letter.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip for pagination',
          example: 0
        },
        letter: {
          type: 'string',
          required: false,
          description: 'Filter by first letter of last name',
          example: 'T'
        },
        is_hof: {
          type: 'boolean',
          required: false,
          description: 'Filter for Hall of Fame players only',
          example: true
        },
        sort: {
          type: 'string',
          required: false,
          description: 'Sort field with optional - prefix for descending',
          example: '-card_count'
        }
      }
    },
    responses: {
      200: {
        description: 'Paginated list of players',
        example: {
          success: true,
          data: [
            {
              player_id: 1,
              first_name: 'Mike',
              last_name: 'Trout',
              nick_name: null,
              slug: 'mike-trout',
              is_hof: false,
              card_count: 1500,
              display_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 10000,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'players', 'list', 'pagination']
  },

  'v1-players-search': {
    id: 'v1-players-search',
    path: '/api/v1/players/search',
    method: 'GET',
    category: 'Players',
    summary: 'Search players by name',
    description: 'Search for players by first name, last name, or nickname with relevance scoring.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Mike Trout'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results (default: 20, max: 100)',
          example: 20
        }
      }
    },
    responses: {
      200: {
        description: 'Search results',
        example: {
          success: true,
          data: [
            {
              player_id: 1,
              first_name: 'Mike',
              last_name: 'Trout',
              slug: 'mike-trout',
              is_hof: false,
              card_count: 1500,
              display_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ]
        }
      },
      400: {
        description: 'Validation error',
        example: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query (q) must be at least 2 characters'
          }
        }
      }
    },
    tags: ['v1', 'players', 'search']
  },

  'v1-players-get': {
    id: 'v1-players-get',
    path: '/api/v1/players/:id',
    method: 'GET',
    category: 'Players',
    summary: 'Get player details by ID',
    description: 'Returns detailed information about a specific player including team associations and card count.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Player ID',
          example: 1
        }
      }
    },
    responses: {
      200: {
        description: 'Player details',
        example: {
          success: true,
          data: {
            player_id: 1,
            first_name: 'Mike',
            last_name: 'Trout',
            nick_name: null,
            slug: 'mike-trout',
            is_hof: false,
            card_count: 1500,
            display_image: 'https://storage.example.com/cards/12345-front.jpg',
            teams: [
              {
                team_id: 1,
                name: 'Los Angeles Angels',
                abbreviation: 'LAA',
                card_count: 1200
              }
            ]
          }
        }
      },
      404: {
        description: 'Player not found',
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Player with ID 9999 not found'
          }
        }
      }
    },
    tags: ['v1', 'players', 'detail']
  },

  'v1-players-cards': {
    id: 'v1-players-cards',
    path: '/api/v1/players/:id/cards',
    method: 'GET',
    category: 'Players',
    summary: 'Get all cards for a player',
    description: 'Returns paginated list of cards featuring a specific player with optional filtering.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Player ID',
          example: 1
        }
      },
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        year: {
          type: 'integer',
          required: false,
          description: 'Filter by card year',
          example: 2024
        },
        is_rookie: {
          type: 'boolean',
          required: false,
          description: 'Filter for rookie cards',
          example: true
        },
        is_autograph: {
          type: 'boolean',
          required: false,
          description: 'Filter for autograph cards',
          example: true
        },
        is_relic: {
          type: 'boolean',
          required: false,
          description: 'Filter for relic cards',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Player cards',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              print_run: null,
              series: {
                series_id: 100,
                name: 'Base'
              },
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              },
              team: {
                team_id: 1,
                name: 'Los Angeles Angels',
                abbreviation: 'LAA'
              },
              front_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 1500,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'players', 'cards']
  },

  'v1-players-teams': {
    id: 'v1-players-teams',
    path: '/api/v1/players/:id/teams',
    method: 'GET',
    category: 'Players',
    summary: 'Get all teams for a player',
    description: 'Returns all teams a player has been associated with in card data.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Player ID',
          example: 1
        }
      }
    },
    responses: {
      200: {
        description: 'Player teams',
        example: {
          success: true,
          data: [
            {
              team_id: 1,
              name: 'Los Angeles Angels',
              abbreviation: 'LAA',
              primary_color: '#BA0021',
              secondary_color: '#003263',
              card_count: 1200
            }
          ]
        }
      }
    },
    tags: ['v1', 'players', 'teams']
  },

  // -----------------------------------------------------------------------------
  // v1 Teams Endpoints
  // -----------------------------------------------------------------------------
  'v1-teams-list': {
    id: 'v1-teams-list',
    path: '/api/v1/teams',
    method: 'GET',
    category: 'Teams',
    summary: 'List all teams with optional filtering',
    description: 'Returns all teams with optional filtering by organization.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        organization: {
          type: 'integer',
          required: false,
          description: 'Filter by organization ID',
          example: 1
        }
      }
    },
    responses: {
      200: {
        description: 'List of teams',
        example: {
          success: true,
          data: [
            {
              team_id: 1,
              name: 'Los Angeles Angels',
              abbreviation: 'LAA',
              city: 'Anaheim',
              mascot: 'Angels',
              primary_color: '#BA0021',
              secondary_color: '#003263',
              organization: 'MLB',
              card_count: 50000,
              player_count: 250
            }
          ]
        }
      }
    },
    tags: ['v1', 'teams', 'list']
  },

  'v1-teams-search': {
    id: 'v1-teams-search',
    path: '/api/v1/teams/search',
    method: 'GET',
    category: 'Teams',
    summary: 'Search teams by name',
    description: 'Search for teams by name, abbreviation, or city.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Angels'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results (default: 20, max: 100)',
          example: 20
        }
      }
    },
    responses: {
      200: {
        description: 'Search results',
        example: {
          success: true,
          data: [
            {
              team_id: 1,
              name: 'Los Angeles Angels',
              abbreviation: 'LAA',
              city: 'Anaheim',
              mascot: 'Angels',
              primary_color: '#BA0021',
              secondary_color: '#003263',
              organization: 'MLB',
              card_count: 50000
            }
          ]
        }
      }
    },
    tags: ['v1', 'teams', 'search']
  },

  'v1-teams-get': {
    id: 'v1-teams-get',
    path: '/api/v1/teams/:id',
    method: 'GET',
    category: 'Teams',
    summary: 'Get team details by ID',
    description: 'Returns detailed information about a specific team.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Team ID',
          example: 1
        }
      }
    },
    responses: {
      200: {
        description: 'Team details',
        example: {
          success: true,
          data: {
            team_id: 1,
            name: 'Los Angeles Angels',
            abbreviation: 'LAA',
            city: 'Anaheim',
            mascot: 'Angels',
            primary_color: '#BA0021',
            secondary_color: '#003263',
            organization: 'MLB',
            card_count: 50000,
            player_count: 250
          }
        }
      },
      404: {
        description: 'Team not found',
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Team with ID 9999 not found'
          }
        }
      }
    },
    tags: ['v1', 'teams', 'detail']
  },

  'v1-teams-players': {
    id: 'v1-teams-players',
    path: '/api/v1/teams/:id/players',
    method: 'GET',
    category: 'Teams',
    summary: 'Get all players for a team',
    description: 'Returns paginated list of players associated with a specific team.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Team ID',
          example: 1
        }
      },
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        }
      }
    },
    responses: {
      200: {
        description: 'Team players',
        example: {
          success: true,
          data: [
            {
              player_id: 1,
              first_name: 'Mike',
              last_name: 'Trout',
              nick_name: null,
              slug: 'mike-trout',
              is_hof: false,
              card_count: 1200,
              display_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 250,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'teams', 'players']
  },

  'v1-teams-cards': {
    id: 'v1-teams-cards',
    path: '/api/v1/teams/:id/cards',
    method: 'GET',
    category: 'Teams',
    summary: 'Get all cards for a team',
    description: 'Returns paginated list of cards featuring players from a specific team.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Team ID',
          example: 1
        }
      },
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        year: {
          type: 'integer',
          required: false,
          description: 'Filter by year',
          example: 2024
        },
        is_rookie: {
          type: 'boolean',
          required: false,
          description: 'Filter for rookie cards',
          example: true
        },
        is_autograph: {
          type: 'boolean',
          required: false,
          description: 'Filter for autograph cards',
          example: true
        },
        is_relic: {
          type: 'boolean',
          required: false,
          description: 'Filter for relic cards',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Team cards',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              print_run: null,
              series: {
                series_id: 100,
                name: 'Base'
              },
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              },
              player: {
                player_id: 1,
                first_name: 'Mike',
                last_name: 'Trout'
              },
              front_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 50000,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'teams', 'cards']
  },

  // -----------------------------------------------------------------------------
  // v1 Sets Endpoints
  // -----------------------------------------------------------------------------
  'v1-sets-list': {
    id: 'v1-sets-list',
    path: '/api/v1/sets',
    method: 'GET',
    category: 'Sets',
    summary: 'List sets with filtering and pagination',
    description: 'Returns a paginated list of card sets with optional filtering by year, organization, and manufacturer.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        year: {
          type: 'integer',
          required: false,
          description: 'Filter by release year',
          example: 2024
        },
        organization: {
          type: 'integer',
          required: false,
          description: 'Filter by organization ID',
          example: 1
        },
        manufacturer: {
          type: 'string',
          required: false,
          description: 'Filter by manufacturer name',
          example: 'Topps'
        }
      }
    },
    responses: {
      200: {
        description: 'Paginated list of sets',
        example: {
          success: true,
          data: [
            {
              set_id: 50,
              name: '2024 Topps',
              year: 2024,
              slug: '2024-topps',
              card_count: 500,
              series_count: 15,
              manufacturer: 'Topps',
              organization: 'MLB'
            }
          ],
          meta: {
            total: 1000,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'sets', 'list', 'pagination']
  },

  'v1-sets-search': {
    id: 'v1-sets-search',
    path: '/api/v1/sets/search',
    method: 'GET',
    category: 'Sets',
    summary: 'Search sets by name',
    description: 'Search for card sets by name or year.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Topps Chrome'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results (default: 20, max: 100)',
          example: 20
        }
      }
    },
    responses: {
      200: {
        description: 'Search results',
        example: {
          success: true,
          data: [
            {
              set_id: 55,
              name: '2024 Topps Chrome',
              year: 2024,
              slug: '2024-topps-chrome',
              card_count: 300,
              manufacturer: 'Topps',
              organization: 'MLB'
            }
          ]
        }
      }
    },
    tags: ['v1', 'sets', 'search']
  },

  'v1-sets-get': {
    id: 'v1-sets-get',
    path: '/api/v1/sets/:id',
    method: 'GET',
    category: 'Sets',
    summary: 'Get set details by ID',
    description: 'Returns detailed information about a specific card set.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Set ID',
          example: 50
        }
      }
    },
    responses: {
      200: {
        description: 'Set details',
        example: {
          success: true,
          data: {
            set_id: 50,
            name: '2024 Topps',
            year: 2024,
            slug: '2024-topps',
            card_count: 500,
            series_count: 15,
            is_complete: true,
            manufacturer: 'Topps',
            organization: 'MLB'
          }
        }
      },
      404: {
        description: 'Set not found',
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Set with ID 9999 not found'
          }
        }
      }
    },
    tags: ['v1', 'sets', 'detail']
  },

  'v1-sets-series': {
    id: 'v1-sets-series',
    path: '/api/v1/sets/:id/series',
    method: 'GET',
    category: 'Sets',
    summary: 'Get all series in a set',
    description: 'Returns all series/parallels belonging to a specific set.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Set ID',
          example: 50
        }
      }
    },
    responses: {
      200: {
        description: 'Set series',
        example: {
          success: true,
          data: [
            {
              series_id: 100,
              name: 'Base',
              color: null,
              print_run: null,
              is_parallel: false,
              parallel_of_series: null,
              card_count: 350,
              slug: 'base'
            },
            {
              series_id: 101,
              name: 'Gold Parallel',
              color: 'Gold',
              print_run: '/50',
              is_parallel: true,
              parallel_of_series: 100,
              card_count: 350,
              slug: 'gold-parallel'
            }
          ]
        }
      }
    },
    tags: ['v1', 'sets', 'series']
  },

  'v1-sets-cards': {
    id: 'v1-sets-cards',
    path: '/api/v1/sets/:id/cards',
    method: 'GET',
    category: 'Sets',
    summary: 'Get all cards in a set',
    description: 'Returns paginated list of all cards in a specific set with optional filtering.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Set ID',
          example: 50
        }
      },
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        series_id: {
          type: 'integer',
          required: false,
          description: 'Filter by series ID',
          example: 100
        },
        is_rookie: {
          type: 'boolean',
          required: false,
          description: 'Filter for rookie cards',
          example: true
        },
        is_autograph: {
          type: 'boolean',
          required: false,
          description: 'Filter for autograph cards',
          example: true
        },
        is_relic: {
          type: 'boolean',
          required: false,
          description: 'Filter for relic cards',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Set cards',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              print_run: null,
              series: {
                series_id: 100,
                name: 'Base',
                color: null
              },
              players: 'Mike Trout',
              front_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 500,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'sets', 'cards']
  },

  // -----------------------------------------------------------------------------
  // v1 Series Endpoints
  // -----------------------------------------------------------------------------
  'v1-series-list': {
    id: 'v1-series-list',
    path: '/api/v1/series',
    method: 'GET',
    category: 'Series',
    summary: 'List series with filtering and pagination',
    description: 'Returns a paginated list of series with optional filtering by set and parallel status.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        set_id: {
          type: 'integer',
          required: false,
          description: 'Filter by set ID',
          example: 50
        },
        is_parallel: {
          type: 'boolean',
          required: false,
          description: 'Filter parallel series only',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Paginated list of series',
        example: {
          success: true,
          data: [
            {
              series_id: 100,
              name: 'Base',
              color: null,
              print_run: null,
              is_parallel: false,
              card_count: 350,
              slug: 'base',
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              }
            }
          ],
          meta: {
            total: 5000,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'series', 'list', 'pagination']
  },

  'v1-series-search': {
    id: 'v1-series-search',
    path: '/api/v1/series/search',
    method: 'GET',
    category: 'Series',
    summary: 'Search series by name',
    description: 'Search for series by name or set name.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Gold Parallel'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results (default: 20, max: 100)',
          example: 20
        }
      }
    },
    responses: {
      200: {
        description: 'Search results',
        example: {
          success: true,
          data: [
            {
              series_id: 101,
              name: 'Gold Parallel',
              color: 'Gold',
              print_run: '/50',
              is_parallel: true,
              card_count: 350,
              slug: 'gold-parallel',
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              }
            }
          ]
        }
      }
    },
    tags: ['v1', 'series', 'search']
  },

  'v1-series-get': {
    id: 'v1-series-get',
    path: '/api/v1/series/:id',
    method: 'GET',
    category: 'Series',
    summary: 'Get series details by ID',
    description: 'Returns detailed information about a specific series including parallel variations.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Series ID',
          example: 100
        }
      }
    },
    responses: {
      200: {
        description: 'Series details',
        example: {
          success: true,
          data: {
            series_id: 100,
            name: 'Base',
            color: null,
            print_run: null,
            is_parallel: false,
            parallel_of_series: null,
            card_count: 350,
            slug: 'base',
            set: {
              set_id: 50,
              name: '2024 Topps',
              year: 2024,
              slug: '2024-topps'
            },
            parallels: [
              {
                series_id: 101,
                name: 'Gold Parallel',
                color: 'Gold',
                print_run: '/50',
                card_count: 350,
                slug: 'gold-parallel'
              }
            ]
          }
        }
      },
      404: {
        description: 'Series not found',
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Series with ID 9999 not found'
          }
        }
      }
    },
    tags: ['v1', 'series', 'detail']
  },

  'v1-series-cards': {
    id: 'v1-series-cards',
    path: '/api/v1/series/:id/cards',
    method: 'GET',
    category: 'Series',
    summary: 'Get all cards in a series',
    description: 'Returns paginated list of all cards in a specific series.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Series ID',
          example: 100
        }
      },
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        is_rookie: {
          type: 'boolean',
          required: false,
          description: 'Filter for rookie cards',
          example: true
        },
        is_autograph: {
          type: 'boolean',
          required: false,
          description: 'Filter for autograph cards',
          example: true
        },
        is_relic: {
          type: 'boolean',
          required: false,
          description: 'Filter for relic cards',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Series cards',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              is_short_print: false,
              print_run: null,
              notes: null,
              players: [
                {
                  player_id: 1,
                  first_name: 'Mike',
                  last_name: 'Trout',
                  team: {
                    team_id: 1,
                    name: 'Los Angeles Angels',
                    abbreviation: 'LAA'
                  }
                }
              ],
              images: {
                front: 'https://storage.example.com/cards/12345-front.jpg',
                back: 'https://storage.example.com/cards/12345-back.jpg'
              }
            }
          ],
          meta: {
            total: 350,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'series', 'cards']
  },

  // -----------------------------------------------------------------------------
  // v1 Cards Endpoints
  // -----------------------------------------------------------------------------
  'v1-cards-list': {
    id: 'v1-cards-list',
    path: '/api/v1/cards',
    method: 'GET',
    category: 'Cards',
    summary: 'List cards with filtering and pagination',
    description: 'Returns a paginated list of cards with extensive filtering options. Supports bulk lookup via comma-separated IDs.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        limit: {
          type: 'integer',
          required: false,
          description: 'Number of results (default: 50, max: 500)',
          example: 50
        },
        offset: {
          type: 'integer',
          required: false,
          description: 'Results to skip',
          example: 0
        },
        ids: {
          type: 'string',
          required: false,
          description: 'Comma-separated card IDs for bulk lookup (max 100)',
          example: '1,2,3,4,5'
        },
        series_id: {
          type: 'integer',
          required: false,
          description: 'Filter by series ID',
          example: 100
        },
        set_id: {
          type: 'integer',
          required: false,
          description: 'Filter by set ID',
          example: 50
        },
        player_id: {
          type: 'integer',
          required: false,
          description: 'Filter by player ID',
          example: 1
        },
        team_id: {
          type: 'integer',
          required: false,
          description: 'Filter by team ID',
          example: 1
        },
        year: {
          type: 'integer',
          required: false,
          description: 'Filter by year',
          example: 2024
        },
        is_rookie: {
          type: 'boolean',
          required: false,
          description: 'Filter for rookie cards',
          example: true
        },
        is_autograph: {
          type: 'boolean',
          required: false,
          description: 'Filter for autograph cards',
          example: true
        },
        is_relic: {
          type: 'boolean',
          required: false,
          description: 'Filter for relic cards',
          example: true
        }
      }
    },
    responses: {
      200: {
        description: 'Paginated list of cards',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              print_run: null,
              series: {
                series_id: 100,
                name: 'Base',
                color: null
              },
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              },
              front_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ],
          meta: {
            total: 793740,
            limit: 50,
            offset: 0,
            hasMore: true
          }
        }
      }
    },
    tags: ['v1', 'cards', 'list', 'pagination', 'bulk']
  },

  'v1-cards-search': {
    id: 'v1-cards-search',
    path: '/api/v1/cards/search',
    method: 'GET',
    category: 'Cards',
    summary: 'Search cards by player name, set, or series',
    description: 'Search for cards by player name, set name, or series name.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Mike Trout'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results (default: 20, max: 100)',
          example: 20
        }
      }
    },
    responses: {
      200: {
        description: 'Search results',
        example: {
          success: true,
          data: [
            {
              card_id: 12345,
              card_number: '1',
              is_rookie: true,
              is_autograph: false,
              is_relic: false,
              print_run: null,
              series: {
                series_id: 100,
                name: 'Base',
                color: null
              },
              set: {
                set_id: 50,
                name: '2024 Topps',
                year: 2024
              },
              players: [
                {
                  player_id: 1,
                  first_name: 'Mike',
                  last_name: 'Trout',
                  team: {
                    team_id: 1,
                    name: 'Los Angeles Angels',
                    abbreviation: 'LAA'
                  }
                }
              ],
              front_image: 'https://storage.example.com/cards/12345-front.jpg'
            }
          ]
        }
      }
    },
    tags: ['v1', 'cards', 'search']
  },

  'v1-cards-get': {
    id: 'v1-cards-get',
    path: '/api/v1/cards/:id',
    method: 'GET',
    category: 'Cards',
    summary: 'Get card details by ID',
    description: 'Returns detailed information about a specific card including player/team associations and images.',
    auth: {
      required: false,
      type: null
    },
    request: {
      params: {
        id: {
          type: 'integer',
          required: true,
          description: 'Card ID',
          example: 12345
        }
      }
    },
    responses: {
      200: {
        description: 'Card details',
        example: {
          success: true,
          data: {
            card_id: 12345,
            card_number: '1',
            is_rookie: true,
            is_autograph: false,
            is_relic: false,
            is_short_print: false,
            print_run: null,
            notes: null,
            series: {
              series_id: 100,
              name: 'Base',
              color: null,
              slug: 'base'
            },
            set: {
              set_id: 50,
              name: '2024 Topps',
              year: 2024,
              slug: '2024-topps'
            },
            players: [
              {
                player_id: 1,
                first_name: 'Mike',
                last_name: 'Trout',
                slug: 'mike-trout',
                team: {
                  team_id: 1,
                  name: 'Los Angeles Angels',
                  abbreviation: 'LAA',
                  primary_color: '#BA0021',
                  secondary_color: '#003263'
                }
              }
            ],
            images: {
              front: 'https://storage.example.com/cards/12345-front.jpg',
              back: 'https://storage.example.com/cards/12345-back.jpg'
            }
          }
        }
      },
      404: {
        description: 'Card not found',
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Card with ID 99999 not found'
          }
        }
      }
    },
    tags: ['v1', 'cards', 'detail']
  },

  // -----------------------------------------------------------------------------
  // v1 Search Endpoints
  // -----------------------------------------------------------------------------
  'v1-search': {
    id: 'v1-search',
    path: '/api/v1/search',
    method: 'GET',
    category: 'Search',
    summary: 'Universal search across all entities',
    description: 'Search across players, teams, sets, and series with a single query. Returns categorized results.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 2 characters)',
          example: 'Mike Trout'
        },
        types: {
          type: 'string',
          required: false,
          description: 'Comma-separated entity types to search (players,teams,sets,series)',
          example: 'players,teams'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum results per type (default: 10, max: 50)',
          example: 10
        }
      }
    },
    responses: {
      200: {
        description: 'Categorized search results',
        example: {
          success: true,
          data: {
            players: [
              {
                player_id: 1,
                first_name: 'Mike',
                last_name: 'Trout',
                slug: 'mike-trout',
                is_hof: false,
                card_count: 1500,
                display_image: 'https://storage.example.com/cards/12345-front.jpg'
              }
            ],
            teams: [
              {
                team_id: 1,
                name: 'Los Angeles Angels',
                abbreviation: 'LAA',
                card_count: 50000
              }
            ],
            sets: [],
            series: []
          }
        }
      }
    },
    tags: ['v1', 'search', 'universal']
  },

  'v1-autocomplete': {
    id: 'v1-autocomplete',
    path: '/api/v1/search/autocomplete',
    method: 'GET',
    category: 'Search',
    summary: 'Quick autocomplete suggestions',
    description: 'Returns minimal data for fast autocomplete in search boxes. Optimized for low latency.',
    auth: {
      required: false,
      type: null
    },
    request: {
      query: {
        q: {
          type: 'string',
          required: true,
          description: 'Search query (minimum 1 character)',
          example: 'Tro'
        },
        type: {
          type: 'string',
          required: false,
          description: 'Entity type to search (players, teams, sets, series)',
          example: 'players'
        },
        limit: {
          type: 'integer',
          required: false,
          description: 'Maximum suggestions (default: 8, max: 20)',
          example: 8
        }
      }
    },
    responses: {
      200: {
        description: 'Autocomplete suggestions',
        example: {
          success: true,
          data: [
            {
              id: 1,
              label: 'Mike Trout',
              slug: 'mike-trout',
              type: 'player'
            },
            {
              id: 2,
              label: 'Steve Trout',
              slug: 'steve-trout',
              type: 'player'
            }
          ]
        }
      }
    },
    tags: ['v1', 'search', 'autocomplete']
  }
}

// Get all endpoints
function getAllEndpoints() {
  return Object.values(apiRegistry)
}

// Get endpoints by category
function getEndpointsByCategory(category) {
  return Object.values(apiRegistry).filter(e => e.category === category)
}

// Get all categories
function getCategories() {
  const categories = [...new Set(Object.values(apiRegistry).map(e => e.category))]
  return categories.sort()
}

// Get endpoint by ID
function getEndpointById(id) {
  return apiRegistry[id] || null
}

// Search endpoints
function searchEndpoints(query) {
  const q = query.toLowerCase()
  return Object.values(apiRegistry).filter(e =>
    e.summary.toLowerCase().includes(q) ||
    e.path.toLowerCase().includes(q) ||
    e.tags.some(t => t.toLowerCase().includes(q)) ||
    e.category.toLowerCase().includes(q)
  )
}

module.exports = {
  apiRegistry,
  getAllEndpoints,
  getEndpointsByCategory,
  getCategories,
  getEndpointById,
  searchEndpoints
}
