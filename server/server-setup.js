const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dynatraceService = require('./services/dynatraceService');
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
if (config.environment === 'production') {
  app.set('trust proxy', true);
  console.log('✅ Express configured to trust proxy for Azure Web Apps');
}

// Security middleware
app.use(helmet());
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
  // Custom key generator for Azure Web Apps
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Skip rate limiting if IP can't be determined or in development
  skip: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!ip || ip === 'unknown') return true;
    
    // Skip rate limiting for localhost/development
    if (config.environment === 'development' && 
        (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
      return true;
    }
    
    return false;
  }
});
app.use('/api/', limiter);

// Dynatrace monitoring middleware (must be early in the stack)
app.use(dynatraceService.expressMiddleware());

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
    { path: '/api/admin/cards', file: './routes/admin-cards', name: 'Admin Cards' },
    { path: '/api/admin/analytics', file: './routes/admin-analytics', name: 'Admin Analytics' },
    { path: '/api/admin/colors', file: './routes/admin-colors', name: 'Admin Colors' },
    { path: '/api/cards', file: './routes/cards', name: 'Cards' },
    { path: '/api/collection', file: './routes/collection', name: 'Collection' },
    { path: '/api/import', file: './routes/import', name: 'Import' },
    { path: '/api/ebay', file: './routes/ebay', name: 'eBay' },
    { path: '/api/search', file: './routes/search', name: 'Search' },
    { path: '/api/players', file: './routes/players', name: 'Players' },
    { path: '/api/players-list', file: './routes/players-list', name: 'Players List' },
    { path: '/api/teams', file: './routes/teams', name: 'Teams' },
    { path: '/api/teams-list', file: './routes/teams-list', name: 'Teams List' },
    { path: '/api/series-list', file: './routes/series-list', name: 'Series List' },
    { path: '/api/sets-list', file: './routes/sets-list', name: 'Sets List' },
    { path: '/api/series-by-set', file: './routes/series-by-set', name: 'Series By Set' },
    { path: '/api/user/cards', file: './routes/user-cards', name: 'User Cards' },
    { path: '/api/user/locations', file: './routes/user-locations', name: 'User Locations' },
    { path: '/api/grading-agencies', file: './routes/grading-agencies', name: 'Grading Agencies' },
    { path: '/api/player-team-search', file: './routes/player-team-search', name: 'Player Team Search' },
    { path: '/api/spreadsheet-import', file: './routes/spreadsheet-import', name: 'Spreadsheet Import' }
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
    // Test Prisma connection
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    
    await prisma.$connect()
    const result = await prisma.$queryRaw`SELECT 1 as test`
    await prisma.$disconnect()
    
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

module.exports = {
  app,
  config
};