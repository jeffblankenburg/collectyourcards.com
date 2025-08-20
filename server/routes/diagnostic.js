const express = require('express')
const router = express.Router()

// Simple diagnostic endpoint that doesn't require database or external dependencies
router.get('/test', (req, res) => {
  res.json({
    message: 'Diagnostic route loaded successfully',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform
  })
})

// Test endpoint to check what dependencies are available
router.get('/dependencies', (req, res) => {
  const dependencies = {}
  
  try {
    require('express')
    dependencies.express = 'available'
  } catch (e) {
    dependencies.express = 'missing: ' + e.message
  }
  
  try {
    require('@prisma/client')
    dependencies.prisma = 'available'
  } catch (e) {
    dependencies.prisma = 'missing: ' + e.message
  }
  
  try {
    require('bcryptjs')
    dependencies.bcryptjs = 'available'
  } catch (e) {
    dependencies.bcryptjs = 'missing: ' + e.message
  }
  
  try {
    require('jsonwebtoken')
    dependencies.jsonwebtoken = 'available'
  } catch (e) {
    dependencies.jsonwebtoken = 'missing: ' + e.message
  }
  
  try {
    require('../services/emailService')
    dependencies.emailService = 'available'
  } catch (e) {
    dependencies.emailService = 'missing: ' + e.message
  }
  
  try {
    require('../middleware/auth')
    dependencies.authMiddleware = 'available'
  } catch (e) {
    dependencies.authMiddleware = 'missing: ' + e.message
  }
  
  res.json({
    message: 'Dependency check complete',
    dependencies,
    timestamp: new Date().toISOString()
  })
})

module.exports = router