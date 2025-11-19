/**
 * Google Analytics Helper Functions
 * Centralized analytics tracking for consistent event naming and parameters
 */

/**
 * Check if gtag is available
 */
const isGtagAvailable = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function'
}

/**
 * Track a custom event
 * @param {string} eventName - The name of the event
 * @param {object} eventParams - Additional parameters for the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (!isGtagAvailable()) {
    console.warn('gtag not available, event not tracked:', eventName)
    return
  }

  try {
    window.gtag('event', eventName, eventParams)
    console.log('Analytics event tracked:', eventName, eventParams)
  } catch (error) {
    console.error('Error tracking analytics event:', error)
  }
}

// =============================================================================
// SEARCH TRACKING
// =============================================================================

/**
 * Track search queries
 * @param {string} searchTerm - The search query
 * @param {number} resultsCount - Number of results returned
 */
export const trackSearch = (searchTerm, resultsCount = 0) => {
  trackEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount
  })
}

/**
 * Track search result click
 * @param {string} searchTerm - The original search query
 * @param {string} resultType - Type of result clicked (player, card, series, team)
 * @param {string} resultId - ID of the clicked result
 * @param {number} position - Position in search results (1-indexed)
 */
export const trackSearchResultClick = (searchTerm, resultType, resultId, position) => {
  trackEvent('select_content', {
    content_type: resultType,
    item_id: resultId,
    search_term: searchTerm,
    position: position
  })
}

// =============================================================================
// USER AUTHENTICATION TRACKING
// =============================================================================

/**
 * Track user login
 * @param {string} method - Login method (email, google, etc.)
 */
export const trackLogin = (method = 'email') => {
  trackEvent('login', {
    method: method
  })
}

/**
 * Track user logout
 */
export const trackLogout = () => {
  trackEvent('logout', {})
}

/**
 * Track user registration
 * @param {string} method - Registration method (email, google, etc.)
 */
export const trackSignup = (method = 'email') => {
  trackEvent('sign_up', {
    method: method
  })
}

// =============================================================================
// COLLECTION TRACKING
// =============================================================================

/**
 * Track adding a card to collection
 * @param {string} cardId - Card ID
 * @param {string} setName - Set name
 * @param {string} playerName - Player name
 */
export const trackAddToCollection = (cardId, setName, playerName) => {
  trackEvent('add_to_collection', {
    card_id: cardId,
    set_name: setName,
    player_name: playerName
  })
}

/**
 * Track removing a card from collection
 * @param {string} cardId - Card ID
 */
export const trackRemoveFromCollection = (cardId) => {
  trackEvent('remove_from_collection', {
    card_id: cardId
  })
}

/**
 * Track viewing collection
 * @param {number} collectionSize - Total cards in collection
 */
export const trackViewCollection = (collectionSize) => {
  trackEvent('view_collection', {
    collection_size: collectionSize
  })
}

// =============================================================================
// NAVIGATION TRACKING
// =============================================================================

/**
 * Track important navigation clicks
 * @param {string} linkText - Text of the link clicked
 * @param {string} destination - URL or page destination
 * @param {string} location - Where on the page (header, footer, sidebar, etc.)
 */
export const trackNavigation = (linkText, destination, location = 'unknown') => {
  trackEvent('navigation_click', {
    link_text: linkText,
    destination: destination,
    location: location
  })
}

/**
 * Track button clicks
 * @param {string} buttonName - Name/label of the button
 * @param {string} page - Page where button was clicked
 */
export const trackButtonClick = (buttonName, page) => {
  trackEvent('button_click', {
    button_name: buttonName,
    page: page
  })
}

// =============================================================================
// CONTENT ENGAGEMENT TRACKING
// =============================================================================

/**
 * Track viewing a player page
 * @param {string} playerId - Player ID
 * @param {string} playerName - Player name
 */
export const trackPlayerView = (playerId, playerName) => {
  trackEvent('view_player', {
    player_id: playerId,
    player_name: playerName
  })
}

/**
 * Track viewing a card detail page
 * @param {string} cardId - Card ID
 * @param {string} setName - Set name
 * @param {string} playerName - Player name
 */
export const trackCardView = (cardId, setName, playerName) => {
  trackEvent('view_card', {
    card_id: cardId,
    set_name: setName,
    player_name: playerName
  })
}

/**
 * Track viewing a series/set page
 * @param {string} seriesId - Series ID
 * @param {string} seriesName - Series name
 */
export const trackSeriesView = (seriesId, seriesName) => {
  trackEvent('view_series', {
    series_id: seriesId,
    series_name: seriesName
  })
}

/**
 * Track viewing a team page
 * @param {string} teamId - Team ID
 * @param {string} teamName - Team name
 */
export const trackTeamView = (teamId, teamName) => {
  trackEvent('view_team', {
    team_id: teamId,
    team_name: teamName
  })
}

// =============================================================================
// ERROR TRACKING
// =============================================================================

/**
 * Track errors
 * @param {string} errorType - Type of error (api_error, validation_error, 404, etc.)
 * @param {string} errorMessage - Error message
 * @param {string} page - Page where error occurred
 */
export const trackError = (errorType, errorMessage, page) => {
  trackEvent('error', {
    error_type: errorType,
    error_message: errorMessage,
    page: page
  })
}

/**
 * Track 404 errors
 * @param {string} attemptedUrl - The URL that was not found
 */
export const track404 = (attemptedUrl) => {
  trackEvent('page_not_found', {
    attempted_url: attemptedUrl
  })
}

// =============================================================================
// FORM TRACKING
// =============================================================================

/**
 * Track form submission
 * @param {string} formName - Name of the form
 * @param {boolean} success - Whether submission was successful
 */
export const trackFormSubmission = (formName, success = true) => {
  trackEvent('form_submission', {
    form_name: formName,
    success: success
  })
}

// =============================================================================
// SHARE TRACKING
// =============================================================================

/**
 * Track content sharing
 * @param {string} method - Share method (twitter, facebook, copy_link, etc.)
 * @param {string} contentType - Type of content shared
 * @param {string} contentId - ID of shared content
 */
export const trackShare = (method, contentType, contentId) => {
  trackEvent('share', {
    method: method,
    content_type: contentType,
    content_id: contentId
  })
}

// =============================================================================
// HELPER: Track page view manually (if needed)
// =============================================================================

/**
 * Track page view manually
 * @param {string} pagePath - The page path
 * @param {string} pageTitle - The page title
 */
export const trackPageView = (pagePath, pageTitle) => {
  if (!isGtagAvailable()) return

  window.gtag('config', 'G-YWJEY4SRP3', {
    page_path: pagePath,
    page_title: pageTitle
  })
}

export default {
  trackEvent,
  trackSearch,
  trackSearchResultClick,
  trackLogin,
  trackLogout,
  trackSignup,
  trackAddToCollection,
  trackRemoveFromCollection,
  trackViewCollection,
  trackNavigation,
  trackButtonClick,
  trackPlayerView,
  trackCardView,
  trackSeriesView,
  trackTeamView,
  trackError,
  track404,
  trackFormSubmission,
  trackShare,
  trackPageView
}
