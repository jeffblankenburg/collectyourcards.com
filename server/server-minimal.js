// Minimal server for production testing - no database dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 3001;
const environment = process.env.NODE_ENV || 'development';

console.log(`🚀 Starting minimal server in ${environment} mode on port ${port}`);

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: environment,
    message: 'Minimal server running successfully'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: environment,
    api: 'operational',
    message: 'API endpoints working'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is reachable',
    timestamp: new Date().toISOString(),
    environment: environment,
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Environment check endpoint
app.get('/api/env-check', (req, res) => {
  res.json({
    NODE_ENV: environment,
    PORT: port,
    DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing',
    JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'missing',
    FRONTEND_URL: process.env.FRONTEND_URL || 'not set',
    timestamp: new Date().toISOString()
  });
});

// Mock API endpoints for testing
app.get('/api/search/universal', (req, res) => {
  res.json({
    message: 'Search API working (mock response)',
    query: req.query.q || 'none',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

app.get('/api/auth/health', (req, res) => {
  res.json({
    message: 'Auth API working (mock response)',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Serve static files in production
if (environment === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Catch-all handler for client-side routing
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
      return res.status(404).json({
        error: 'Not Found',
        message: `API route ${req.originalUrl} not found`
      });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: environment === 'production' ? 'Something went wrong' : err.message
  });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Minimal server running on port ${port}`);
  console.log(`📊 Environment: ${environment}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'not configured'}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
});

module.exports = app;