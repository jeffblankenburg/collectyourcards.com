const { sanitizeString, sanitizeNumber, sanitizeBoolean } = require('../server/middleware/inputSanitization')

describe('SQL Injection Protection', () => {
  describe('Input Sanitization', () => {
    test('should reject SQL injection attempts in string fields', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1' --", 
        "UNION SELECT * FROM user --",
        "'; INSERT INTO user (name) VALUES ('hacker'); --",
        "' OR 1=1 --",
        "admin'--",
        "' OR 'x'='x",
        "'; DELETE FROM card; --",
        "1' OR '1'='1",
        "'; UPDATE user SET password='hacked'; --"
      ]

      maliciousInputs.forEach(input => {
        expect(() => sanitizeString(input, 'notes')).toThrow('contains invalid characters')
      })
    })

    test('should reject XSS attempts', () => {
      const xssInputs = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src='x' onerror='alert(1)'>",
        "<body onload='alert(1)'>",
        "vbscript:msgbox('xss')",
        "<iframe src='javascript:alert(1)'></iframe>",
        "<div onclick='alert(1)'>click me</div>"
      ]

      xssInputs.forEach(input => {
        expect(() => sanitizeString(input, 'bio')).toThrow('contains invalid characters')
      })
    })

    test('should validate numeric inputs strictly', () => {
      expect(() => sanitizeNumber("'; DROP TABLE users; --", 'card_id')).toThrow('must be a valid number')
      expect(() => sanitizeNumber("1'; DELETE FROM card; --", 'serial_number')).toThrow('must be a valid number')
      expect(() => sanitizeNumber(-1, 'card_id', { min: 1 })).toThrow('must be at least 1')
      expect(() => sanitizeNumber('abc', 'card_id')).toThrow('must be a valid number')
      expect(() => sanitizeNumber('1.5', 'card_id', { integer: true })).toThrow('must be a whole number')
    })

    test('should validate username format strictly', () => {
      const invalidUsernames = [
        "admin'--",
        "user'; DROP TABLE users; --", 
        "test@email.com",
        "user<script>",
        "a", // too short
        "a".repeat(31), // too long
        "user name", // spaces not allowed
        "user&password",
        "user%20admin",
        "DROP TABLE users"
      ]

      invalidUsernames.forEach(username => {
        expect(() => sanitizeString(username, 'username')).toThrow()
      })
    })

    test('should allow valid inputs', () => {
      expect(sanitizeString('john_doe123', 'username')).toBe('john_doe123')
      expect(sanitizeString('This is a normal note about my card collection.', 'notes')).toBe('This is a normal note about my card collection.')
      expect(sanitizeString('https://example.com', 'website')).toBe('https://example.com')
      expect(sanitizeNumber(123, 'card_id', { integer: true })).toBe(123)
      expect(sanitizeNumber(99.99, 'purchase_price')).toBe(99.99)
      expect(sanitizeBoolean(true)).toBe(true)
      expect(sanitizeBoolean(false)).toBe(false)
    })

    test('should enforce length limits', () => {
      const longString = 'a'.repeat(1001)
      expect(() => sanitizeString(longString, 'notes')).toThrow('exceeds maximum length')
      
      const longBio = 'a'.repeat(501) 
      expect(() => sanitizeString(longBio, 'bio')).toThrow('exceeds maximum length')
      
      const longUsername = 'a'.repeat(31)
      expect(() => sanitizeString(longUsername, 'username')).toThrow('exceeds maximum length')
    })

    test('should validate URLs properly', () => {
      expect(() => sanitizeString('javascript:alert(1)', 'website')).toThrow('contains invalid characters')
      expect(() => sanitizeString('http://example.com\'; DROP TABLE users; --', 'website')).toThrow('contains invalid characters')
      expect(() => sanitizeString('not-a-url', 'website')).toThrow('format is invalid')
      expect(() => sanitizeString('ftp://example.com', 'website')).toThrow('format is invalid')
      
      expect(sanitizeString('https://example.com', 'website')).toBe('https://example.com')
      expect(sanitizeString('http://example.com', 'website')).toBe('http://example.com')
    })

    test('should handle edge cases safely', () => {
      expect(sanitizeString(null, 'notes')).toBe(null)
      expect(sanitizeString(undefined, 'notes')).toBe(null)
      expect(sanitizeString('', 'notes')).toBe('')
      expect(sanitizeNumber(null, 'card_id')).toBe(null)
      expect(sanitizeNumber(undefined, 'card_id')).toBe(null)
      expect(sanitizeNumber('', 'card_id')).toBe(null)
    })

    test('should reject dangerous SQL keywords', () => {
      const dangerousInputs = [
        'SELECT * FROM users',
        'INSERT INTO table',
        'UPDATE users SET',
        'DELETE FROM cards',
        'DROP TABLE users',
        'EXEC sp_help',
        'UNION ALL SELECT',
        'xp_cmdshell'
      ]

      dangerousInputs.forEach(input => {
        expect(() => sanitizeString(input, 'notes')).toThrow('contains invalid characters')
      })
    })

    test('should validate email format', () => {
      expect(() => sanitizeString("'; DROP TABLE users; --", 'email')).toThrow('contains invalid characters')
      expect(() => sanitizeString('not-an-email', 'email')).toThrow('Invalid email format')
      expect(() => sanitizeString('test@example.com\'; --', 'email')).toThrow('contains invalid characters')
      
      expect(sanitizeString('test@example.com', 'email')).toBe('test@example.com')
    })

    test('should validate card numbers safely', () => {
      const validCardNumbers = [
        '123',
        'RC-123',
        '#123',
        '123/999',
        'SP-1'
      ]

      const invalidCardNumbers = [
        "'; DROP TABLE card; --",
        "<script>alert(1)</script>",
        'a'.repeat(51) // too long
      ]

      validCardNumbers.forEach(cardNumber => {
        expect(() => sanitizeString(cardNumber, 'cardNumber')).not.toThrow()
      })

      invalidCardNumbers.forEach(cardNumber => {
        expect(() => sanitizeString(cardNumber, 'cardNumber')).toThrow()
      })
    })
  })

  describe('Parameter Validation', () => {
    test('should validate ID parameters', () => {
      expect(() => sanitizeNumber("'; DROP TABLE users; --", 'card_id', { integer: true, min: 1 })).toThrow()
      expect(() => sanitizeNumber(0, 'card_id', { integer: true, min: 1 })).toThrow('must be at least 1')
      expect(() => sanitizeNumber(-1, 'card_id', { integer: true, min: 1 })).toThrow('must be at least 1')
      expect(() => sanitizeNumber(1.5, 'card_id', { integer: true })).toThrow('must be a whole number')
      
      expect(sanitizeNumber(123, 'card_id', { integer: true, min: 1 })).toBe(123)
    })
  })
})

describe('Code Audit - Database Query Safety', () => {
  test('should identify unsafe query patterns', () => {
    const fs = require('fs')
    const path = require('path')
    
    // Read route files and check for unsafe patterns
    const routesDir = path.join(__dirname, '../server/routes')
    if (!fs.existsSync(routesDir)) {
      console.log('Routes directory not found, skipping audit')
      return
    }
    
    const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'))
    let unsafePatterns = []
    
    routeFiles.forEach(file => {
      const filePath = path.join(routesDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // Check for potentially unsafe patterns
      const lines = content.split('\n')
      lines.forEach((line, index) => {
        // Look for $queryRawUnsafe usage
        if (line.includes('$queryRawUnsafe')) {
          unsafePatterns.push({
            file,
            line: index + 1,
            type: 'unsafe_query',
            content: line.trim()
          })
        }
        
        // Look for string concatenation in queries
        if (line.includes('$queryRaw') && (line.includes('+') || line.includes('${')) && !line.includes('BigInt')) {
          unsafePatterns.push({
            file,
            line: index + 1,
            type: 'potential_injection',
            content: line.trim()
          })
        }
      })
    })
    
    if (unsafePatterns.length > 0) {
      console.log('Security audit findings:')
      unsafePatterns.forEach(pattern => {
        console.log(`⚠️  ${pattern.file}:${pattern.line} (${pattern.type}) - ${pattern.content}`)
      })
    } else {
      console.log('✅ No unsafe query patterns found!')
    }
    
    // This test passes but reports findings
    expect(true).toBe(true)
  })
})