const rateLimit = require('express-rate-limit')

// Helper function to extract and clean IP address (Azure compatibility)
const extractCleanIp = (req) => {
  // Get the IP address from various sources
  let ip = req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.connection?.remoteAddress || 
           'unknown';
  
  // Azure App Service may append port number - strip it
  if (ip && ip.includes(':')) {
    // Handle IPv6 addresses (contains multiple colons) vs IPv4 with port
    const parts = ip.split(':');
    if (parts.length === 2) {
      // IPv4 with port (e.g., "23.245.114.100:55837")
      ip = parts[0];
    } else if (parts.length > 2) {
      // IPv6 address - check if last part is a port number
      const lastPart = parts[parts.length - 1];
      if (!isNaN(lastPart)) {
        // Remove the port from IPv6 address
        ip = parts.slice(0, -1).join(':');
      }
    }
  }
  
  return ip;
}

// Create a configurable rate limiter
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json(options.message || defaultOptions.message)
    },
    // Custom key generator for Azure Web Apps - strips port from IP address
    keyGenerator: (req) => {
      return extractCleanIp(req);
    },
    // Skip rate limiting if IP can't be determined or in development
    skip: (req) => {
      const ip = extractCleanIp(req);
      
      if (!ip || ip === 'unknown') return true;
      
      // Skip rate limiting for localhost/development
      if (process.env.NODE_ENV === 'development' && 
          (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
        return true;
      }
      
      // Skip in test environment
      if (process.env.NODE_ENV === 'test') {
        return true;
      }
      
      return false;
    }
  }

  return rateLimit({
    ...defaultOptions,
    ...options
  })
}

module.exports = createRateLimiter