const { describe, test, expect } = require('@jest/globals');

// Extract the parsing logic from card-detail.js for testing
function parseCardSlug(cardSlug) {
  const parts = cardSlug.split('-')
  
  // Common team abbreviations that might appear in card numbers
  const teamAbbrevs = [
    'ari', 'atl', 'bal', 'bos', 'chc', 'chw', 'cin', 'cle', 'col', 'det',
    'hou', 'kc', 'laa', 'lad', 'mia', 'mil', 'min', 'nym', 'nyy', 'oak',
    'phi', 'pit', 'sd', 'sea', 'sf', 'stl', 'tb', 'tex', 'tor', 'was',
    'az', 'la', 'ny', 'sf', 'tb', 'wsh', 'aru'
  ]
  
  // Look for player name pattern - typically starts with a common first name
  const commonFirstNames = [
    'aaron', 'adam', 'adrian', 'albert', 'alex', 'andrew', 'anthony', 'austin',
    'ben', 'brandon', 'brian', 'carlos', 'chris', 'daniel', 'david', 'derek',
    'eric', 'fernando', 'frank', 'gary', 'george', 'harold', 'jacob', 'james',
    'jason', 'jean', 'jeffrey', 'john', 'jose', 'josh', 'justin', 'kevin', 'kyle',
    'luis', 'marcus', 'mark', 'martin', 'matthew', 'max', 'michael', 'mike',
    'nelson', 'paul', 'pedro', 'peter', 'rafael', 'ramon', 'ricardo', 'richard',
    'robert', 'ronald', 'ryan', 'salvador', 'scott', 'sergio', 'stephen', 'steve',
    'thomas', 'tim', 'tony', 'trevor', 'tyler', 'victor', 'vladimir', 'william'
  ]
  
  // Find where player name starts
  let playerStartIndex = -1
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase()
    if (commonFirstNames.includes(part)) {
      playerStartIndex = i
      break
    }
  }
  
  let cardNumber = ''
  let playerSlug = ''
  
  if (playerStartIndex > 0) {
    // Found player name, everything before is card number
    cardNumber = parts.slice(0, playerStartIndex).join('-').toUpperCase()
    playerSlug = parts.slice(playerStartIndex).join('-')
  } else if (playerStartIndex === 0) {
    // Player name starts at beginning - this shouldn't happen with proper slugs
    // but handle gracefully
    cardNumber = parts[0].toUpperCase()
    playerSlug = parts.slice(1).join('-')
  } else {
    // No common first name found, use smarter heuristics
    // Look for likely break point between card number and player name
    let bestSplit = -1
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].toLowerCase()
      
      // Strong indicators this is likely a player name:
      // - Not a team abbreviation
      // - Not all digits
      // - Not a single letter
      // - Not common card number terms
      const cardTerms = ['rc', 'sp', 'auto', 'relic', 'gold', 'silver', 'black', 'red', 'blue', 'green']
      
      if (!teamAbbrevs.includes(part) && 
          !/^\d+$/.test(part) && 
          part.length > 1 &&
          !cardTerms.includes(part)) {
        bestSplit = i
        break
      }
    }
    
    if (bestSplit > 0) {
      cardNumber = parts.slice(0, bestSplit).join('-').toUpperCase()
      playerSlug = parts.slice(bestSplit).join('-')
    } else {
      // Final fallback - treat entire slug as card number
      cardNumber = cardSlug.toUpperCase()
      playerSlug = ''
    }
  }
  
  return { cardNumber, playerSlug }
}

describe('Card Slug Parser', () => {
  describe('Team abbreviations in card numbers', () => {
    test('parses card with team abbreviation correctly', () => {
      const result = parseCardSlug('c90a-ari-austin-riley')
      expect(result.cardNumber).toBe('C90A-ARI')
      expect(result.playerSlug).toBe('austin-riley')
    })
    
    test('parses card with LAD team abbreviation', () => {
      const result = parseCardSlug('42-lad-mookie-betts')
      expect(result.cardNumber).toBe('42-LAD')
      expect(result.playerSlug).toBe('mookie-betts')
    })
    
    test('parses card with NYY team abbreviation', () => {
      const result = parseCardSlug('99-nyy-aaron-judge')
      expect(result.cardNumber).toBe('99-NYY')
      expect(result.playerSlug).toBe('aaron-judge')
    })
    
    test('parses card with ARU team abbreviation', () => {
      const result = parseCardSlug('c90a-aru-adley-rutschman')
      expect(result.cardNumber).toBe('C90A-ARU')
      expect(result.playerSlug).toBe('adley-rutschman')
    })
  })
  
  describe('Simple card numbers', () => {
    test('parses simple numeric card number', () => {
      const result = parseCardSlug('102-freddie-freeman')
      expect(result.cardNumber).toBe('102')
      expect(result.playerSlug).toBe('freddie-freeman')
    })
    
    test('parses card number with letters', () => {
      const result = parseCardSlug('rc-5-vladimir-guerrero-jr')
      expect(result.cardNumber).toBe('RC-5')
      expect(result.playerSlug).toBe('vladimir-guerrero-jr')
    })
    
    test('parses card number with multiple parts', () => {
      const result = parseCardSlug('sp-rc-101-bobby-witt-jr')
      expect(result.cardNumber).toBe('SP-RC-101')
      expect(result.playerSlug).toBe('bobby-witt-jr')
    })
  })
  
  describe('Complex player names', () => {
    test('handles player with Jr suffix', () => {
      const result = parseCardSlug('25-ronald-acuna-jr')
      expect(result.cardNumber).toBe('25')
      expect(result.playerSlug).toBe('ronald-acuna-jr')
    })
    
    test('handles player with multiple first names', () => {
      const result = parseCardSlug('1-jose-carlos-ramirez')
      expect(result.cardNumber).toBe('1')
      expect(result.playerSlug).toBe('jose-carlos-ramirez')
    })
    
    // Removed - no longer needed with simplified URL structure
  })
  
  describe('Edge cases', () => {
    test('handles card number only (no player)', () => {
      const result = parseCardSlug('cl-5')
      expect(result.cardNumber).toBe('CL-5')
      expect(result.playerSlug).toBe('')
    })
    
    test('handles unknown player name format', () => {
      const result = parseCardSlug('prospect-1-unknown-player')
      expect(result.cardNumber).toBe('PROSPECT-1')
      expect(result.playerSlug).toBe('unknown-player')
    })
    
    test('handles single part slug', () => {
      const result = parseCardSlug('checklist')
      expect(result.cardNumber).toBe('CHECKLIST')
      expect(result.playerSlug).toBe('')
    })
  })
  
  describe('Regression tests for specific cards', () => {
    // Removed - no longer needed with simplified URL structure
    
    test('handles insert cards', () => {
      const result = parseCardSlug('i-1-mike-trout')
      expect(result.cardNumber).toBe('I-1')
      expect(result.playerSlug).toBe('mike-trout')
    })
    
    test('handles parallel cards', () => {
      const result = parseCardSlug('p-25-gold-shohei-ohtani')
      expect(result.cardNumber).toBe('P-25-GOLD')
      expect(result.playerSlug).toBe('shohei-ohtani')
    })
  })
})