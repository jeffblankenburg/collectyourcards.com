/**
 * Content Moderation Middleware
 * Implements profanity filtering and content screening for user-generated content
 */

// Common profanity words and phrases to filter
const PROFANITY_PATTERNS = [
  // Basic profanity (partial list for family-friendly environment)
  /\b(damn|damns|hell|hells|crap|craps|suck|sucks|sucked|sucking|stupid|idiots?|morons?|jerks?)\b/gi,
  // Stronger profanity - explicit patterns to catch variations
  /\b(fuck|fucks|fucking|fucked|fucker|fuckers|shit|shits|shitting|shitty|bitch|bitches|bitching|ass|asses|piss|pissed|pissing)\b/gi,
  // Additional strong profanity
  /\b(bastard|bastards|cocksucker|cocksuckers|motherfucker|motherfuckers|asshole|assholes|dickhead|dickheads|bullshit)\b/gi,
  // Hate speech patterns
  /\b(retard|retarded|retards|gay|fag|faggot|faggots|homo|homos|nigger|niggers|nigga|niggas)\b/gi,
  // Spam patterns
  /\b(buy now|click here|visit my|check out my)\b/gi,
  // Multiple repeated characters (spam detection)
  /(.)\1{4,}/g,
  // Excessive caps (more than 70% caps)
  /^[A-Z\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]{7,}$/
]

// Replacement words for common profanity
const REPLACEMENT_MAP = {
  // Basic profanity
  'damn': 'd***',
  'damns': 'd****',
  'hell': 'h***',
  'hells': 'h****',
  'crap': 'c***',
  'craps': 'c****',
  'suck': 's***',
  'sucks': 's****',
  'sucked': 's*****',
  'sucking': 's******',
  'stupid': 's*****',
  'idiot': 'i****',
  'idiots': 'i*****',
  'moron': 'm****',
  'morons': 'm*****',
  'jerk': 'j***',
  'jerks': 'j****',
  // Stronger profanity
  'fuck': 'f***',
  'fucks': 'f****',
  'fucking': 'f******',
  'fucked': 'f*****',
  'fucker': 'f*****',
  'fuckers': 'f******',
  'shit': 's***',
  'shits': 's****',
  'shitting': 's*******',
  'shitty': 's****',
  'bitch': 'b****',
  'bitches': 'b******',
  'bitching': 'b*******',
  'ass': 'a**',
  'asses': 'a****',
  'piss': 'p***',
  'pissed': 'p*****',
  'pissing': 'p******',
  'bastard': 'b******',
  'bastards': 'b*******',
  'asshole': 'a******',
  'assholes': 'a*******',
  'bullshit': 'b*******'
}

/**
 * Check if content contains profanity or inappropriate content
 * @param {string} text - Text to analyze
 * @returns {object} Analysis result
 */
const analyzeContent = (text) => {
  if (!text || typeof text !== 'string') {
    return { isClean: true, issues: [], filteredText: text }
  }

  const issues = []
  let filteredText = text.trim()

  // Check for profanity patterns with specific pattern identification
  for (let i = 0; i < PROFANITY_PATTERNS.length; i++) {
    const pattern = PROFANITY_PATTERNS[i]
    // Reset regex lastIndex to prevent stateful bug with global flags
    pattern.lastIndex = 0
    if (pattern.test(filteredText)) {
      // Pattern 0: Basic profanity (damn|hell|crap|suck|stupid|idiot|moron|jerk)
      if (i === 0) {
        issues.push('mild_profanity')
      }
      // Pattern 1: Strong profanity (fuck|fucking|fucked|etc.)
      else if (i === 1) {
        issues.push('strong_profanity')
      }
      // Pattern 2: Additional strong profanity (bastard|cocksucker|etc.)
      else if (i === 2) {
        issues.push('strong_profanity')
      }
      // Pattern 3: Hate speech
      else if (i === 3) {
        issues.push('hate_speech')
      }
      // Pattern 4: Spam patterns
      else if (i === 4) {
        issues.push('spam')
      }
      // Pattern 5: Repeated characters
      else if (i === 5) {
        issues.push('repeated_characters')
      }
      // Pattern 6: Excessive caps
      else if (i === 6) {
        issues.push('excessive_caps')
      }
    }
  }

  // Auto-filter mild profanity
  for (const [word, replacement] of Object.entries(REPLACEMENT_MAP)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    filteredText = filteredText.replace(regex, replacement)
  }

  // Check text length (prevent spam)
  if (filteredText.length > 2000) {
    issues.push('too_long')
  }

  // Check for excessive repetition
  const words = filteredText.toLowerCase().split(/\s+/)
  const wordCount = {}
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1
    if (wordCount[word] > 5 && word.length > 3) {
      issues.push('word_repetition')
      break
    }
  }

  const isClean = issues.length === 0
  
  return {
    isClean,
    issues,
    filteredText,
    originalText: text,
    severity: issues.includes('hate_speech') ? 'high' : 
              issues.includes('strong_profanity') ? 'medium' : 
              issues.includes('mild_profanity') ? 'low' : 'low'
  }
}

/**
 * Content moderation middleware for API endpoints
 * Automatically filters or flags inappropriate content
 */
const contentModerationMiddleware = (options = {}) => {
  const {
    autoFilter = true,           // Automatically filter mild profanity
    blockOnHighSeverity = true,  // Block comments with hate speech
    blockOnMediumSeverity = false, // Block comments with profanity (false = filter instead)
    logViolations = true,        // Log content violations
    fieldsToCheck = ['content', 'comment', 'text', 'message', 'body'] // Fields to analyze
  } = options

  return async (req, res, next) => {
    try {
      const analysis = {}
      let hasViolations = false
      let shouldBlock = false

      // Check specified fields in request body
      for (const field of fieldsToCheck) {
        if (req.body[field]) {
          const result = analyzeContent(req.body[field])
          analysis[field] = result

          if (!result.isClean) {
            hasViolations = true

            // Apply filtering logic
            if (autoFilter && (result.severity === 'low' || result.severity === 'medium')) {
              req.body[field] = result.filteredText
            }

            // Check if we should block the request
            if ((blockOnHighSeverity && result.severity === 'high') ||
                (blockOnMediumSeverity && result.severity === 'medium')) {
              shouldBlock = true
            }
          }
        }
      }

      // Log violations if enabled
      if (hasViolations && logViolations) {
        console.log('Content moderation violation:', {
          userId: req.user?.user_id || 'anonymous',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          analysis,
          timestamp: new Date().toISOString()
        })
      }

      // Block request if severe violations detected
      if (shouldBlock) {
        return res.status(400).json({
          error: 'Content violates community guidelines',
          message: 'Your comment contains inappropriate content. Please revise and try again.',
          violations: Object.keys(analysis).reduce((acc, field) => {
            if (!analysis[field].isClean) {
              acc[field] = analysis[field].issues
            }
            return acc
          }, {})
        })
      }

      // Add analysis to request for downstream use
      req.contentAnalysis = analysis
      next()

    } catch (error) {
      console.error('Content moderation error:', error)
      // Don't block request on moderation system failure
      next()
    }
  }
}

/**
 * Middleware specifically for comment moderation
 * More strict settings for user comments
 */
const commentModerationMiddleware = contentModerationMiddleware({
  autoFilter: true,
  blockOnHighSeverity: true,
  blockOnMediumSeverity: true, // Block strong profanity (medium severity)
  logViolations: true,
  fieldsToCheck: ['comment_text', 'content', 'comment'] // Check comment_text first, then fallbacks
})

/**
 * Check if user is currently muted
 * @param {number} userId - User ID to check
 * @returns {Promise<boolean>} True if user is muted
 */
const isUserMuted = async (userId) => {
  try {
    const prisma = require('../config/prisma')

    const user = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      select: { is_muted: true, muted_at: true }
    })

    return user?.is_muted === true
  } catch (error) {
    console.error('Error checking user mute status:', error)
    return false
  }
}

/**
 * Middleware to block muted users from posting
 */
const mutedUserMiddleware = async (req, res, next) => {
  try {
    if (req.user && req.user.user_id) {
      const muted = await isUserMuted(req.user.user_id)
      if (muted) {
        return res.status(403).json({
          error: 'Account temporarily restricted',
          message: 'Your account has been temporarily restricted from posting comments. Please contact support if you believe this is an error.'
        })
      }
    }
    next()
  } catch (error) {
    console.error('Muted user check error:', error)
    next() // Don't block on system error
  }
}

module.exports = {
  contentModerationMiddleware,
  commentModerationMiddleware,
  mutedUserMiddleware,
  analyzeContent,
  isUserMuted
}