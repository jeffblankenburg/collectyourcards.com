// Reserved usernames that cannot be chosen by users
// These match existing routes and system functionality

const RESERVED_USERNAMES = new Set([
  // Main routes
  'admin',
  'api',
  'auth',
  'collection',
  'players',
  'teams',
  'sets',
  'series',
  'search',
  'status',
  'health',
  'login',
  'register',
  'logout',
  
  // Admin routes
  'dashboard',
  'users',
  'cards',
  'analytics',
  
  // System/brand
  'collectyourcards',
  'support',
  'help',
  'about',
  'contact',
  'terms',
  'privacy',
  'legal',
  'policy',
  'cookies',
  
  // Common social media reserved words
  'www',
  'mail',
  'email',
  'blog',
  'news',
  'store',
  'shop',
  'buy',
  'sell',
  'trade',
  'forum',
  'community',
  'group',
  'groups',
  'channel',
  'channels',
  
  // Technical
  'root',
  'system',
  'config',
  'server',
  'client',
  'public',
  'static',
  'assets',
  'files',
  'images',
  'uploads',
  'download',
  'downloads',
  
  // HTTP methods and codes
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  '404',
  '500',
  'error',
  'errors',
  
  // Security
  'security',
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'official',
  'verified',
  'premium',
  
  // Potentially offensive/problematic
  'null',
  'undefined',
  'true',
  'false',
  'test',
  'demo',
  'example',
  'sample',
  'default',
  'guest',
  'anonymous',
  'user',
  'username',
  'profile',
  'account',
  'settings',
  
  // Future features we might add
  'messages',
  'notifications',
  'feed',
  'timeline',
  'explore',
  'discover',
  'trending',
  'popular',
  'featured',
  'live',
  'stream',
  'broadcast',
  'event',
  'events',
  'tournament',
  'tournaments',
  'league',
  'leagues',
  'stats',
  'statistics',
  'leaderboard',
  'rankings',
  'marketplace',
  'auction',
  'auctions',
  'wishlist',
  'favorites',
  'bookmarks',
  'saved'
])

// Function to check if a username is reserved
function isReserved(username) {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}

// Function to suggest alternative usernames
function suggestAlternatives(username) {
  const base = username.toLowerCase()
  const suggestions = []
  
  // Add numbers
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${base}${i}`)
  }
  
  // Add underscores
  suggestions.push(`${base}_`)
  suggestions.push(`_${base}`)
  suggestions.push(`${base}_collector`)
  suggestions.push(`${base}_cards`)
  
  return suggestions.filter(suggestion => !isReserved(suggestion))
}

module.exports = {
  RESERVED_USERNAMES,
  isReserved,
  suggestAlternatives
}