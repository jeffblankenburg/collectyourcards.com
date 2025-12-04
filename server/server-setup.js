const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const telemetryService = require('./services/telemetryService');
require('dotenv').config();

// Create Express app
const app = express();

// Configuration
const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  environment: process.env.NODE_ENV || 'development'
};

// Trust proxy for Azure Web Apps (required for rate limiting)
// Azure App Service uses specific proxy configuration
if (config.environment === 'production') {
  // Azure App Service uses a single proxy hop
  // Setting to 1 instead of true prevents bypassing rate limits
  app.set('trust proxy', 1);
  console.log('✅ Express configured to trust proxy (1 hop) for Azure Web Apps');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": [
        "'self'",
        "'unsafe-inline'",  // Required for Google Tag Manager inline scripts
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com"
      ],
      "connect-src": [
        "'self'",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://www.googletagmanager.com"
      ],
      "img-src": [
        "'self'",
        "data:",
        "blob:",  // Allow local blob URLs for image previews
        "*.blob.core.windows.net",  // Allow Azure Blob Storage
        "https://cardcheckliststorage.blob.core.windows.net",  // Specific storage account
        "https://www.google-analytics.com",  // Google Analytics tracking pixels
        "https://www.googletagmanager.com"  // Google Tag Manager
      ]
    }
  }
}));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Rate limiting with Azure-compatible configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Custom key generator for Azure Web Apps - strips port from IP address
  keyGenerator: (req) => {
    // Get the IP address from various sources
    let ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.connection.remoteAddress || 
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
  },
  // Skip rate limiting if IP can't be determined or in development
  skip: (req) => {
    // Extract IP using same logic as keyGenerator
    let ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.connection.remoteAddress;
    
    if (!ip || ip === 'unknown') return true;
    
    // Strip port if present
    if (ip && ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length === 2) {
        ip = parts[0];
      }
    }
    
    // Skip rate limiting for localhost/development
    if (config.environment === 'development' && 
        (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
      return true;
    }
    
    return false;
  }
});
app.use('/api/', limiter);

// OpenTelemetry monitoring middleware (must be early in the stack)
app.use(telemetryService.expressMiddleware());

// Body parsing middleware with error handling
app.use(express.json({ 
  limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }
  next(err);
});

// Health check endpoints (both root and /api for compatibility)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.environment
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    api: 'operational'
  });
});

// Production diagnostic endpoint to help troubleshoot Azure deployment
app.get('/api/production-status', (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: process.platform,
      nodeVersion: process.version,
      port: process.env.PORT || 'not set',
      containerInfo: {
        hostname: require('os').hostname(),
        arch: process.arch,
        uptime: process.uptime()
      },
      envCheck: {
        DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing',
        JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'missing',
        FRONTEND_URL: process.env.FRONTEND_URL || 'not set',
        AZURE_COMMUNICATION_CONNECTION_STRING: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? 'configured' : 'missing'
      },
      azureWebApp: {
        siteName: process.env.WEBSITE_SITE_NAME || 'not detected',
        instanceId: process.env.WEBSITE_INSTANCE_ID || 'not detected',
        resourceGroup: process.env.WEBSITE_RESOURCE_GROUP || 'not detected',
        hostname: process.env.WEBSITE_HOSTNAME || 'not detected'
      },
      server: {
        listening: true,
        trustProxy: config.environment === 'production'
      }
    }
    
    res.json(diagnostics)
  } catch (error) {
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
});

// Create placeholder route handlers for testing
const createMockRoute = (routeName) => {
  return (req, res, next) => {
    res.json({ message: `${routeName} route mock` });
  };
};

// API routes - use mocks in test environment
if (config.environment === 'test') {
  app.use('/api/auth', createMockRoute('Auth'));
  app.use('/api/cards', createMockRoute('Cards'));
  app.use('/api/collection', createMockRoute('Collection'));
  app.use('/api/import', createMockRoute('Import'));
  app.use('/api/ebay', createMockRoute('eBay'));
  app.use('/api/search', createMockRoute('Search'));
  app.use('/api/players', createMockRoute('Players'));
} else {
  // In non-test environments, require actual route files
  const routes = [
    { path: '/api/auth', file: './routes/auth', name: 'Auth' },
    { path: '/api/admin', file: './routes/admin-users', name: 'Admin Users' },
    { path: '/api/admin', file: './routes/admin-teams', name: 'Admin Teams' },
    { path: '/api/admin/players', file: './routes/admin-players', name: 'Admin Players' },
    { path: '/api/admin', file: './routes/admin-sets', name: 'Admin Sets' },
    { path: '/api/admin', file: './routes/admin-series', name: 'Admin Series' },
    { path: '/api/admin', file: './routes/admin-aggregates', name: 'Admin Aggregates' },
    { path: '/api/admin/sets-optimized', file: './routes/admin-sets-optimized', name: 'Admin Sets Optimized' },
    { path: '/api/admin/cards', file: './routes/admin-cards', name: 'Admin Cards' },
    { path: '/api/admin/analytics', file: './routes/admin-analytics', name: 'Admin Analytics' },
    { path: '/api/admin/dashboard', file: './routes/admin-dashboard', name: 'Admin Dashboard' },
    { path: '/api/admin/colors', file: './routes/admin-colors', name: 'Admin Colors' },
    { path: '/api/admin/moderation', file: './routes/admin-moderation', name: 'Admin Moderation' },
    { path: '/api/admin/series-metadata', file: './routes/admin-series-metadata', name: 'Admin Series Metadata' },
    { path: '/api/database-stats', file: './routes/database-stats', name: 'Database Stats' },
    { path: '/api/cards', file: './routes/cards', name: 'Cards' },
    { path: '/api/collection', file: './routes/collection', name: 'Collection' },
    { path: '/api/import', file: './routes/import-workflow', name: 'Import' },
    { path: '/api/ebay', file: './routes/ebay', name: 'eBay' },
    { path: '/api/search', file: './routes/search', name: 'Search' },
    { path: '/api/search', file: './routes/search-v2', name: 'Search V2' },
    { path: '/api/players', file: './routes/players', name: 'Players' },
    { path: '/api/players-list', file: './routes/players-list-optimized', name: 'Players List (Optimized)' },
    { path: '/api/teams', file: './routes/teams', name: 'Teams' },
    { path: '/api/teams-list', file: './routes/teams-list', name: 'Teams List' },
    { path: '/api/series-list', file: './routes/series-list', name: 'Series List' },
    { path: '/api/sets-list', file: './routes/sets-list', name: 'Sets List' },
    { path: '/api/series-by-set', file: './routes/series-by-set', name: 'Series By Set' },
    { path: '/api/user/cards', file: './routes/user-cards', name: 'User Cards' },
    { path: '/api/user/cards', file: './routes/user-card-photos', name: 'User Card Photos' },
    { path: '/api/user/locations', file: './routes/user-locations', name: 'User Locations' },
    { path: '/api/user/lists', file: './routes/user-lists', name: 'User Lists' },
    { path: '/api/user/table-preferences', file: './routes/user-table-preferences', name: 'User Table Preferences' },
    { path: '/api/public-lists', file: './routes/public-lists', name: 'Public Lists' },
    { path: '/api/user/collection/stats', file: './routes/user-collection-stats', name: 'User Collection Stats' },
    { path: '/api/user/collection/cards', file: './routes/user-collection-cards', name: 'User Collection Cards' },
    { path: '/api/collection-views', file: './routes/collection-views', name: 'Collection Views' },
    { path: '/api/grading-agencies', file: './routes/grading-agencies', name: 'Grading Agencies' },
    { path: '/api/player-team-search', file: './routes/player-team-search', name: 'Player Team Search' },
    { path: '/api/spreadsheet-generation', file: './routes/spreadsheet-generation', name: 'Spreadsheet Generation' },
    { path: '/api/card-detail', file: './routes/card-detail', name: 'Card Detail' },
    { path: '/api/card', file: './routes/simple-card-detail', name: 'Simple Card Detail' },
    { path: '/api/comments', file: './routes/comments', name: 'Comments' },
    { path: '/api/notifications', file: './routes/notifications', name: 'Notifications' },
    { path: '/api/profile', file: './routes/user-profile', name: 'User Profiles' },
    { path: '/api/follow', file: './routes/user-follow', name: 'User Follow' },
    { path: '/api/achievements', file: './routes/achievements', name: 'Achievements' },
    { path: '/api/user/achievements', file: './routes/user-achievements', name: 'User Achievements' },
    { path: '/api/admin/achievements', file: './routes/admin-achievements', name: 'Admin Achievements' },
    { path: '/api/admin/import', file: './routes/import-workflow', name: 'Admin Import' },
    { path: '/api/admin', file: './routes/admin-query-tester', name: 'Admin Query Tester' },
    { path: '/api/blog', file: './routes/blog', name: 'Blog' }
  ];

  console.log('📍 Loading API routes in production mode...');
  
  routes.forEach(route => {
    try {
      const routeModule = require(route.file);
      app.use(route.path, routeModule);
      console.log(`✅ Loaded ${route.name} routes at ${route.path}`);
    } catch (error) {
      console.error(`❌ Failed to load ${route.name} routes:`, error.message);
      console.error(`   Stack trace:`, error.stack);
      
      // Use mock route as fallback
      app.use(route.path, createMockRoute(route.name));
      console.log(`🔄 Using mock ${route.name} endpoint at ${route.path} instead`);
    }
  });
  
  console.log('📍 All routes loaded. Testing route registration...');
  
  // Log all registered routes for debugging
  const registeredRoutes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      registeredRoutes.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.regexp) {
      registeredRoutes.push(`ROUTER ${middleware.regexp.source}`);
    }
  });
  console.log('📍 Registered routes:', registeredRoutes);
}

// Add simple test endpoint that always works (no dependencies)
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is reachable',
    timestamp: new Date().toISOString(),
    environment: config.environment
  });
});

// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    // Test Prisma connection using global instance
    const prisma = require('./config/prisma')

    const result = await prisma.$queryRaw`SELECT 1 as test`

    res.json({
      status: 'success',
      message: 'Database connected successfully',
      result: result,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    })
  }
});

// Add diagnostic endpoint to check Prisma client files
app.get('/api/debug/prisma', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const prismaPath = path.join(__dirname, '../node_modules/.prisma/client');
    const clientPath = path.join(__dirname, '../node_modules/@prisma/client');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      paths: {
        prismaClientPath: clientPath,
        prismaGeneratedPath: prismaPath
      },
      files: {}
    };
    
    // Check if directories exist
    try {
      diagnostics.files.prismaClientExists = fs.existsSync(clientPath);
      diagnostics.files.prismaGeneratedExists = fs.existsSync(prismaPath);
      
      if (fs.existsSync(clientPath)) {
        diagnostics.files.clientDirContents = fs.readdirSync(clientPath);
      }
      
      if (fs.existsSync(prismaPath)) {
        diagnostics.files.generatedDirContents = fs.readdirSync(prismaPath);
      }
      
      // Check specific files
      const defaultJsPath = path.join(clientPath, 'default.js');
      diagnostics.files.defaultJsExists = fs.existsSync(defaultJsPath);
      
    } catch (fsError) {
      diagnostics.error = fsError.message;
    }
    
    // Try to require Prisma client
    try {
      const { PrismaClient } = require('@prisma/client');
      diagnostics.prismaClient = { 
        canRequire: true,
        constructor: typeof PrismaClient
      };
    } catch (requireError) {
      diagnostics.prismaClient = { 
        canRequire: false,
        error: requireError.message
      };
    }
    
    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message
    });
  }
});

// Status monitoring routes (always available)
try {
  app.use('/api', require('./routes/status'));
} catch (error) {
  console.warn('Status routes not found:', error.message);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Don't expose internal errors in production
  if (config.environment === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong'
    });
  } else {
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

// Serve static files from client build in production (must be AFTER all API routes)
const path = require('path');
if (config.environment === 'production') {
  // Serve static files from client/dist
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Catch-all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
      return res.status(404).json({
        error: 'Not Found',
        message: `API route ${req.originalUrl} not found`
      });
    }
    
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  // 404 handler for non-production environments only
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`
    });
  });
}

// Initialize daily stats refresh in production
if (config.environment === 'production') {
  const { dailyStatsRefresh } = require('./utils/daily-stats-refresh')
  dailyStatsRefresh.start()
}

module.exports = {
  app,
  config
};