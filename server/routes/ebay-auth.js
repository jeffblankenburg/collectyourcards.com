const express = require('express')
const crypto = require('crypto')
const { getPrismaClient } = require('../utils/prisma-pool-manager')
const { authMiddleware } = require('../middleware/auth')
const EBayClient = require('../utils/ebay-client')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

// Initialize eBay client based on EBAY_ENVIRONMENT
const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'sandbox'
console.log(`🚀 Initializing eBay client in ${ebayEnvironment.toUpperCase()} mode`)
const ebayClient = new EBayClient(ebayEnvironment)

// Encrypt sensitive data
function encryptToken(token) {
  const algorithm = 'aes-256-gcm'
  const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

// Decrypt sensitive data
function decryptToken(encryptedToken) {
  try {
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32)
    const parts = encryptedToken.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Token decryption error:', error)
    throw new Error('Failed to decrypt token')
  }
}

// GET /api/ebay/auth/status - Check if user has connected eBay account
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    const ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      },
      select: {
        id: true,
        ebay_username: true,
        last_sync_at: true,
        created_at: true,
        scope_permissions: true
      }
    })
    
    if (!ebayAccount) {
      return res.json({
        connected: false,
        account: null
      })
    }
    
    res.json({
      connected: true,
      account: {
        id: ebayAccount.id.toString(),
        username: ebayAccount.ebay_username,
        lastSync: ebayAccount.last_sync_at,
        connectedAt: ebayAccount.created_at,
        permissions: ebayAccount.scope_permissions ? ebayAccount.scope_permissions.split(',') : []
      }
    })
  } catch (error) {
    console.error('eBay status check error:', error)
    res.status(500).json({
      error: 'Failed to check eBay connection status',
      message: error.message
    })
  }
})

// POST /api/ebay/auth/initiate - Start OAuth flow
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Check if user already has an active eBay account
    const existingAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (existingAccount) {
      return res.status(400).json({
        error: 'eBay account already connected',
        message: 'Please disconnect your current eBay account before connecting a new one'
      })
    }
    
    // Generate authorization URL with state parameter
    const state = crypto.randomBytes(32).toString('hex')
    const authUrl = ebayClient.getAuthorizationUrl(state)
    
    // Store state in session or temporary storage for validation
    // For now, we'll include userId in the state and validate it in callback
    const stateData = {
      userId: userId,
      timestamp: Date.now(),
      random: state
    }
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64')
    
    res.json({
      authUrl: authUrl.url.replace(state, encodedState),
      state: encodedState
    })
  } catch (error) {
    console.error('eBay auth initiation error:', error)
    res.status(500).json({
      error: 'Failed to initiate eBay authentication',
      message: error.message
    })
  }
})

// GET /api/ebay/auth/callback - Handle OAuth callback from eBay
router.get('/callback', async (req, res) => {
  try {
    console.log('eBay callback received:', req.query)
    
    const { code, state, error: ebayError, ebaytkn, tknexp, username } = req.query
    
    // Handle eBay Auth'n'Auth callback format (legacy)
    if (ebaytkn !== undefined) {
      console.log('Received eBay Auth\'n\'Auth callback (legacy format)')
      
      if (!ebaytkn) {
        console.error('eBay Auth\'n\'Auth error: No token received')
        const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
        return res.redirect(`${redirectUrl}/profile?ebay_error=access_denied`)
      }
      
      // For now, redirect to profile with an error indicating we need OAuth 2.0
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      return res.redirect(`${redirectUrl}/profile?ebay_error=legacy_auth_not_supported`)
    }
    
    // Handle OAuth 2.0 callback format
    if (ebayError) {
      console.error('eBay OAuth error:', ebayError)
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      return res.redirect(`${redirectUrl}/profile?ebay_error=access_denied`)
    }
    
    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state })
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      return res.redirect(`${redirectUrl}/profile?ebay_error=missing_parameters`)
    }
    
    // Validate and decode state parameter
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid state parameter'
      })
    }
    
    // Check state timestamp (expire after 10 minutes)
    const stateAge = Date.now() - stateData.timestamp
    if (stateAge > 10 * 60 * 1000) {
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      return res.redirect(`${redirectUrl}/profile?ebay_error=expired_state`)
    }
    
    const userId = stateData.userId
    
    // Exchange authorization code for access token
    const tokenData = await ebayClient.exchangeCodeForToken(code)
    
    // Get user profile from eBay
    const userProfile = await ebayClient.getUserProfile(tokenData.access_token)
    
    // Enhanced username extraction with multiple fallbacks
    let extractedUsername = null
    let extractedUserId = 'unknown'
    
    if (userProfile) {
      // Try multiple username sources in order of preference
      extractedUsername = userProfile.username || 
                         userProfile.ebayUsername || 
                         userProfile.userId ||
                         userProfile.email ||
                         null
      
      extractedUserId = userProfile.userId || 
                       userProfile.id || 
                       userProfile.ebayUserId || 
                       'unknown'
      
      console.log('eBay user profile data:', {
        username: userProfile.username,
        ebayUsername: userProfile.ebayUsername,
        userId: userProfile.userId,
        id: userProfile.id,
        email: userProfile.email,
        extractedUsername,
        extractedUserId
      })
    }
    
    // If still no username, generate a friendly fallback
    if (!extractedUsername) {
      extractedUsername = `eBay User ${extractedUserId.slice(-6)}` // Use last 6 chars of ID
      console.log('No username from eBay API, using fallback:', extractedUsername)
    }
    
    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))
    
    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokenData.access_token)
    const encryptedRefreshToken = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null
    
    // Store eBay account information
    const ebayAccount = await prisma.user_ebay_accounts.create({
      data: {
        user_id: BigInt(userId),
        ebay_user_id: extractedUserId,
        ebay_username: extractedUsername,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt,
        scope_permissions: 'https://api.ebay.com/oauth/api_scope,https://api.ebay.com/oauth/api_scope/buy.order.readonly',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    
    // Log successful connection
    console.log(`eBay account connected for user ${userId}: ${userProfile.username}`)
    
    // Redirect to profile page with success message
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    res.redirect(`${redirectUrl}/profile`)
  } catch (error) {
    console.error('eBay callback error:', error)
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    
    // Check if this is a temporary eBay server issue
    if (error.message && error.message.includes('temporarily unavailable')) {
      res.redirect(`${redirectUrl}/profile?ebay_error=temporarily_unavailable`)
    } else {
      res.redirect(`${redirectUrl}/profile?ebay_error=connection_failed`)
    }
  }
})

// POST /api/ebay/auth/refresh - Refresh access token
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    
    const ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (!ebayAccount) {
      return res.status(404).json({
        error: 'No eBay account found'
      })
    }
    
    if (!ebayAccount.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token available'
      })
    }
    
    // Decrypt refresh token
    const refreshToken = decryptToken(ebayAccount.refresh_token)
    
    // Refresh access token
    const tokenData = await ebayClient.refreshAccessToken(refreshToken)
    
    // Calculate new expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))
    
    // Encrypt new access token
    const encryptedAccessToken = encryptToken(tokenData.access_token)
    
    // Update stored token
    await prisma.user_ebay_accounts.update({
      where: { id: ebayAccount.id },
      data: {
        access_token: encryptedAccessToken,
        token_expires_at: expiresAt,
        updated_at: new Date()
      }
    })
    
    res.json({
      success: true,
      expiresAt: expiresAt
    })
  } catch (error) {
    console.error('eBay token refresh error:', error)
    res.status(500).json({
      error: 'Failed to refresh eBay access token',
      message: error.message
    })
  }
})

// DELETE /api/ebay/auth/disconnect - Disconnect eBay account
router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    console.log(`Processing eBay disconnect request for user ${userId}`)
    
    const ebayAccount = await prisma.user_ebay_accounts.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true
      }
    })
    
    if (!ebayAccount) {
      console.log(`No active eBay account found for user ${userId}`)
      return res.status(404).json({
        error: 'No eBay account found to disconnect'
      })
    }
    
    console.log(`Found eBay account for user ${userId}: ${ebayAccount.ebay_username}`)
    
    // Deactivate the account instead of deleting (for audit trail)
    await prisma.user_ebay_accounts.update({
      where: { id: ebayAccount.id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    })
    
    console.log(`✅ eBay account disconnected successfully for user ${userId}: ${ebayAccount.ebay_username}`)
    
    res.json({
      success: true,
      message: 'eBay account disconnected successfully'
    })
  } catch (error) {
    console.error('eBay disconnect error:', error)
    res.status(500).json({
      error: 'Failed to disconnect eBay account',
      message: error.message
    })
  }
})

// GET /api/ebay/auth/test-disconnect - Test if disconnect endpoint is reachable
router.get('/test-disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    console.log(`Testing disconnect endpoint for user ${userId}`)
    
    res.json({
      success: true,
      message: 'Disconnect endpoint is reachable',
      userId: userId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Test disconnect error:', error)
    res.status(500).json({
      error: 'Test disconnect failed',
      message: error.message
    })
  }
})

// GET /api/ebay/auth/debug - Debug eBay configuration
router.get('/debug', async (req, res) => {
  try {
    const authUrl = ebayClient.getAuthorizationUrl('debug-state')
    
    res.json({
      environment: ebayClient.environment,
      isProduction: ebayClient.isProduction,
      credentials: {
        appId: ebayClient.credentials.appId ? `${ebayClient.credentials.appId.substring(0, 10)}...` : 'MISSING',
        devId: ebayClient.credentials.devId ? `${ebayClient.credentials.devId.substring(0, 10)}...` : 'MISSING',
        certId: ebayClient.credentials.certId ? `${ebayClient.credentials.certId.substring(0, 10)}...` : 'MISSING',
        redirectUri: ebayClient.credentials.redirectUri || 'MISSING',
        ruName: ebayClient.credentials.ruName || 'MISSING'
      },
      authUrl: authUrl.url,
      baseUrls: ebayClient.baseUrls[ebayClient.environment]
    })
  } catch (error) {
    console.error('eBay debug error:', error)
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    })
  }
})

// Helper function to get valid access token (with auto-refresh)
async function getValidAccessToken(userId) {
  const ebayAccount = await prisma.user_ebay_accounts.findFirst({
    where: {
      user_id: BigInt(userId),
      is_active: true
    }
  })
  
  if (!ebayAccount) {
    throw new Error('No eBay account found')
  }
  
  // Check if token is expired or will expire in next 5 minutes
  const now = new Date()
  const expiryBuffer = new Date(now.getTime() + (5 * 60 * 1000)) // 5 minutes buffer
  
  if (ebayAccount.token_expires_at && ebayAccount.token_expires_at <= expiryBuffer) {
    if (!ebayAccount.refresh_token) {
      throw new Error('Access token expired and no refresh token available')
    }
    
    // Auto-refresh token
    const refreshToken = decryptToken(ebayAccount.refresh_token)
    const tokenData = await ebayClient.refreshAccessToken(refreshToken)
    
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))
    const encryptedAccessToken = encryptToken(tokenData.access_token)
    
    await prisma.user_ebay_accounts.update({
      where: { id: ebayAccount.id },
      data: {
        access_token: encryptedAccessToken,
        token_expires_at: expiresAt,
        updated_at: new Date()
      }
    })
    
    return tokenData.access_token
  }
  
  // Return existing valid token
  return decryptToken(ebayAccount.access_token)
}

module.exports = {
  router,
  getValidAccessToken,
  ebayClient
}