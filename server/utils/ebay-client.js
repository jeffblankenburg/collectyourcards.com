const axios = require('axios')
const crypto = require('crypto')

class EBayClient {
  constructor(environment = 'sandbox') {
    // Only 'production' and 'sandbox' are valid eBay environments
    // Default any other environment (like 'development') to sandbox
    this.environment = environment === 'production' ? 'production' : 'sandbox'
    this.isProduction = environment === 'production'
    
    // eBay API endpoints
    this.baseUrls = {
      sandbox: {
        api: 'https://api.sandbox.ebay.com',
        auth: 'https://auth.sandbox.ebay.com',
        trading: 'https://api.sandbox.ebay.com/ws/api.dll'
      },
      production: {
        api: 'https://api.ebay.com',
        auth: 'https://auth.ebay.com', 
        trading: 'https://api.ebay.com/ws/api.dll'
      }
    }
    
    // Credentials based on environment
    this.credentials = {
      appId: this.isProduction ? process.env.EBAY_PRODUCTION_APP_ID : process.env.EBAY_SANDBOX_APP_ID,
      devId: this.isProduction ? process.env.EBAY_PRODUCTION_DEV_ID : process.env.EBAY_SANDBOX_DEV_ID,
      certId: this.isProduction ? process.env.EBAY_PRODUCTION_CERT_ID : process.env.EBAY_SANDBOX_CERT_ID,
      redirectUri: this.isProduction ? process.env.EBAY_PRODUCTION_REDIRECT_URI : process.env.EBAY_SANDBOX_REDIRECT_URI,
      ruName: this.isProduction ? process.env.EBAY_PRODUCTION_RUNAME : process.env.EBAY_SANDBOX_RUNAME
    }
    
    // Rate limiting
    this.rateLimits = {
      calls: 0,
      resetTime: Date.now() + (60 * 1000), // Reset every minute
      maxCalls: this.isProduction ? 5000 : 1000 // Per day limits
    }
    
    // Validate credentials
    this.validateCredentials()
  }
  
  validateCredentials() {
    const required = ['appId', 'devId', 'certId', 'redirectUri', 'ruName']
    const missing = required.filter(key => !this.credentials[key])
    
    if (missing.length > 0) {
      throw new Error(`Missing eBay credentials: ${missing.join(', ')}. Check your .env file.`)
    }
    
    console.log(`eBay Client initialized for ${this.environment} environment (requested: ${environment})`)
  }
  
  // Generate OAuth 2.0 authorization URL
  getAuthorizationUrl(state = null) {
    // Use scopes from environment variable or fallback to defaults
    const envScopes = process.env.EBAY_SCOPE
    const scopes = envScopes || [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/buy.order.readonly'
    ].join(' ')
    
    const params = new URLSearchParams({
      client_id: this.credentials.appId,
      response_type: 'code',
      redirect_uri: this.credentials.redirectUri,
      scope: scopes,
      state: state || crypto.randomBytes(16).toString('hex')
    })
    
    return {
      url: `${this.baseUrls[this.environment].auth}/oauth2/authorize?${params}`,
      state: params.get('state')
    }
  }
  
  // Exchange authorization code for access token
  async exchangeCodeForToken(authorizationCode) {
    try {
      const credentials = Buffer.from(`${this.credentials.appId}:${this.credentials.certId}`).toString('base64')
      
      const response = await axios.post(
        `${this.baseUrls[this.environment].api}/identity/v1/oauth2/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: this.credentials.redirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      
      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      }
    } catch (error) {
      const errorData = error.response?.data
      const isTemporaryError = errorData?.error_id === 'temporarily_unavailable' || 
                               errorData?.error === 'temporarily_unavailable' ||
                               error.response?.status >= 500
      
      console.error('eBay token exchange error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorData,
        message: error.message,
        isTemporaryError: isTemporaryError,
        requestData: {
          url: `${this.baseUrls[this.environment].api}/identity/v1/oauth2/token`,
          grant_type: 'authorization_code',
          code: authorizationCode.substring(0, 20) + '...',
          redirect_uri: this.credentials.ruName
        }
      })
      
      if (isTemporaryError) {
        throw new Error(`eBay servers are temporarily unavailable. Please try connecting your eBay account again in a few minutes.`)
      }
      
      throw new Error(`Failed to exchange authorization code for access token: ${errorData?.error_description || error.message}`)
    }
  }
  
  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken) {
    try {
      const credentials = Buffer.from(`${this.credentials.appId}:${this.credentials.certId}`).toString('base64')
      
      const response = await axios.post(
        `${this.baseUrls[this.environment].api}/identity/v1/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      
      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      }
    } catch (error) {
      console.error('eBay token refresh error:', error.response?.data || error.message)
      throw new Error('Failed to refresh access token')
    }
  }
  
  // Get user's purchase history
  async getUserOrders(accessToken, options = {}) {
    try {
      await this.checkRateLimit()
      
      const params = new URLSearchParams({
        filter: options.filter || 'orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}',
        limit: options.limit || 50,
        offset: options.offset || 0,
        orderBy: options.orderBy || 'creationdate:DESC'
      })
      
      if (options.creation_date_range_from) {
        params.append('creation_date_range_from', options.creation_date_range_from)
      }
      
      if (options.creation_date_range_to) {
        params.append('creation_date_range_to', options.creation_date_range_to)
      }
      
      const response = await axios.get(
        `${this.baseUrls[this.environment].api}/buy/order/v2/purchase_order?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      this.incrementRateLimit()
      return response.data
    } catch (error) {
      console.error('eBay get orders error:', error.response?.data || error.message)
      throw new Error('Failed to retrieve user orders from eBay')
    }
  }
  
  // Get user profile information
  async getUserProfile(accessToken) {
    try {
      await this.checkRateLimit()
      
      // Try the Commerce Identity API for user profile
      let response
      try {
        console.log('Attempting to get eBay user profile via Commerce Identity API...')
        response = await axios.get(
          `${this.baseUrls[this.environment].api}/commerce/identity/v1/user`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        console.log('eBay Identity API response:', response.data)
        
        this.incrementRateLimit()
        return {
          userId: response.data?.userId || response.data?.username || 'unknown',
          username: response.data?.username || response.data?.userId || null,
          email: response.data?.email || null
        }
        
      } catch (identityError) {
        console.log('Identity API failed, trying account privileges endpoint...')
        
        // Fallback to account privileges endpoint
        response = await axios.get(
          `${this.baseUrls[this.environment].api}/sell/account/v1/privilege`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
            }
          }
        )
        
        console.log('eBay Account API response:', response.data)
        
        this.incrementRateLimit()
        
        // Extract what we can from privileges response
        const userId = response.data?.sellingLimit?.sellingLimitType || 
                      response.data?.privileges?.[0]?.privilegeType ||
                      'sandbox_user_' + Date.now().toString().slice(-6)
        
        return {
          userId: userId,
          username: `Sandbox User ${userId.slice(-6)}`, // More descriptive than just "eBay User"
          email: null
        }
      }
      
    } catch (error) {
      console.error('eBay get user profile error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
      
      // Final fallback with unique identifier
      const fallbackId = 'sbx_' + Date.now().toString().slice(-6)
      return {
        userId: fallbackId,
        username: `Sandbox User ${fallbackId.slice(-3)}`, // More descriptive fallback
        email: null
      }
    }
  }
  
  // Get item details by item ID
  async getItemDetails(itemId, accessToken = null) {
    try {
      await this.checkRateLimit()
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      
      const response = await axios.get(
        `${this.baseUrls[this.environment].api}/buy/browse/v1/item/${itemId}`,
        { headers }
      )
      
      this.incrementRateLimit()
      return response.data
    } catch (error) {
      console.error('eBay get item details error:', error.response?.data || error.message)
      throw new Error('Failed to retrieve item details from eBay')
    }
  }
  
  // Rate limiting functions
  async checkRateLimit() {
    const now = Date.now()
    
    // Reset counter if time window has passed
    if (now > this.rateLimits.resetTime) {
      this.rateLimits.calls = 0
      this.rateLimits.resetTime = now + (60 * 1000)
    }
    
    // Check if we're approaching rate limits
    if (this.rateLimits.calls >= (this.rateLimits.maxCalls * 0.9)) {
      const waitTime = this.rateLimits.resetTime - now
      console.warn(`eBay rate limit approaching. Waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  incrementRateLimit() {
    this.rateLimits.calls++
  }
  
  // Utility function to validate webhook signature
  validateWebhookSignature(payload, signature, timestamp) {
    const expectedSignature = crypto
      .createHmac('sha256', this.credentials.certId)
      .update(timestamp + payload)
      .digest('base64')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    )
  }
  
  // Parse eBay item title for sports card information
  parseItemTitle(title) {
    const parsed = {
      original: title,
      year: null,
      player: null,
      brand: null,
      series: null,
      condition: null,
      sport: null,
      features: []
    }
    
    // Extract year (4 digits)
    const yearMatch = title.match(/\b(19|20)\d{2}\b/)
    if (yearMatch) {
      parsed.year = parseInt(yearMatch[0])
    }
    
    // Common sports card brands
    const brands = ['Topps', 'Panini', 'Upper Deck', 'Bowman', 'Donruss', 'Fleer', 'Score', 'Leaf']
    const brandRegex = new RegExp(`\\b(${brands.join('|')})\\b`, 'i')
    const brandMatch = title.match(brandRegex)
    if (brandMatch) {
      parsed.brand = brandMatch[1]
    }
    
    // Grading services and conditions
    const conditions = ['PSA', 'BGS', 'SGC', 'CGC', 'Mint', 'NM', 'EX', 'VG', 'Good']
    const conditionRegex = new RegExp(`\\b(${conditions.join('|')})\\s*(\\d+)?\\b`, 'i')
    const conditionMatch = title.match(conditionRegex)
    if (conditionMatch) {
      parsed.condition = conditionMatch[0]
    }
    
    // Special features
    const features = ['Rookie', 'RC', 'Auto', 'Autograph', 'Relic', 'Jersey', 'Patch', 'SP', 'SSP', 'Refractor']
    features.forEach(feature => {
      const featureRegex = new RegExp(`\\b${feature}\\b`, 'i')
      if (featureRegex.test(title)) {
        parsed.features.push(feature)
      }
    })
    
    // Sports detection
    const sports = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Golf', 'Tennis']
    const sportRegex = new RegExp(`\\b(${sports.join('|')})\\b`, 'i')
    const sportMatch = title.match(sportRegex)
    if (sportMatch) {
      parsed.sport = sportMatch[1]
    }
    
    // Extract potential player name (this is complex and would need ML)
    // For now, just remove known patterns and see what's left
    let remainingText = title
      .replace(yearMatch?.[0] || '', '')
      .replace(brandMatch?.[0] || '', '')
      .replace(conditionMatch?.[0] || '', '')
      .replace(/\b(Card|Cards?|Trading)\b/gi, '')
      .replace(/[#\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Simple heuristic: if there are 2-3 words left, it might be a player name
    const words = remainingText.split(' ').filter(w => w.length > 1)
    if (words.length >= 2 && words.length <= 3) {
      parsed.player = words.join(' ')
    }
    
    return parsed
  }
}

module.exports = EBayClient