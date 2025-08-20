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
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Custom key generator for Azure Web Apps
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Skip rate limiting if IP can't be determined
  skip: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    return !ip || ip === 'unknown';
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.environment
  });
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
  app.use('/api/admin', createMockRoute('Admin'));
  app.use('/api/import', createMockRoute('Import'));
  app.use('/api/ebay', createMockRoute('eBay'));
  app.use('/api/search', createMockRoute('Search'));
} else {
  // In non-test environments, require actual route files
  const routes = [
    { path: '/api/auth', file: './routes/auth', name: 'Auth' },
    { path: '/api/cards', file: './routes/cards', name: 'Cards' },
    { path: '/api/collection', file: './routes/collection', name: 'Collection' },
    { path: '/api/admin', file: './routes/admin', name: 'Admin' },
    { path: '/api/import', file: './routes/import', name: 'Import' },
    { path: '/api/ebay', file: './routes/ebay', name: 'eBay' },
    { path: '/api/search', file: './routes/search', name: 'Search' }
  ];

  routes.forEach(route => {
    try {
      app.use(route.path, require(route.file));
      console.log(`✅ Loaded ${route.name} routes`);
    } catch (error) {
      console.error(`❌ Failed to load ${route.name} routes:`, error.message);
      app.use(route.path, createMockRoute(route.name));
      console.log(`🔄 Using mock ${route.name} endpoint instead`);
    }
  });
}

// Status monitoring routes (always available)
try {
  app.use('/api', require('./routes/status'));
} catch (error) {
  console.warn('Status routes not found');
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