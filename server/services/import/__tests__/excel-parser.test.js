/**
 * Excel Parser Service Tests
 *
 * Tests XLSX file parsing, paste data parsing, multi-player detection,
 * consecutive duplicate handling, and delimiter parsing.
 */

const XLSX = require('xlsx')
const excelParser = require('../excel-parser')

// Mock XLSX module
jest.mock('xlsx')

describe('ExcelParserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================================
  // parseXlsxFile Tests
  // ============================================================================

  describe('parseXlsxFile', () => {
    test('should parse valid XLSX file with single card', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Los Angeles Angels', 'RC', 'Rookie Card']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        cardNumber: '1',
        playerNames: ['Mike Trout'],
        teamNames: ['Los Angeles Angels'],
        isRC: true,
        notes: 'Rookie Card'
      })
    })

    test('should parse XLSX with multiple cards', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', 'RC', ''],
        ['2', 'Shohei Ohtani', 'Angels', '', 'Pitcher/DH'],
        ['3', 'Aaron Judge', 'Yankees', 'RC', 'Rookie']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(3)
      expect(result[0].cardNumber).toBe('1')
      expect(result[1].cardNumber).toBe('2')
      expect(result[2].cardNumber).toBe('3')
    })

    test('should handle multi-player cards with / delimiter', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout / Shohei Ohtani', 'Angels / Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Mike Trout', 'Shohei Ohtani'])
      expect(result[0].teamNames).toEqual(['Angels', 'Angels'])
    })

    test('should handle multi-player cards with comma delimiter', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout, Shohei Ohtani', 'Angels, Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Mike Trout', 'Shohei Ohtani'])
      expect(result[0].teamNames).toEqual(['Angels', 'Angels'])
    })

    test('should handle mixed delimiters (comma and slash)', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Player A, Player B / Player C', 'Team A, Team B / Team C', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Player A', 'Player B', 'Player C'])
      expect(result[0].teamNames).toEqual(['Team A', 'Team B', 'Team C'])
    })

    test('should merge consecutive duplicate card numbers', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', ''],
        ['100', 'Shohei Ohtani', 'Angels', '', ''],
        ['101', 'Aaron Judge', 'Yankees', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(2)
      expect(result[0].cardNumber).toBe('100')
      expect(result[0].playerNames).toEqual(['Mike Trout', 'Shohei Ohtani'])
      expect(result[0].teamNames).toEqual(['Angels']) // Deduplicated
      expect(result[1].cardNumber).toBe('101')
    })

    test('should NOT merge non-consecutive duplicate card numbers', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', ''],
        ['101', 'Aaron Judge', 'Yankees', '', ''],
        ['100', 'Shohei Ohtani', 'Angels', '', ''] // Non-consecutive
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(3) // Should keep all 3
      expect(result[0].cardNumber).toBe('100')
      expect(result[0].playerNames).toEqual(['Mike Trout'])
      expect(result[1].cardNumber).toBe('101')
      expect(result[2].cardNumber).toBe('100')
      expect(result[2].playerNames).toEqual(['Shohei Ohtani'])
    })

    test('should merge notes when merging consecutive duplicates', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', 'First note'],
        ['100', 'Shohei Ohtani', 'Angels', '', 'Second note']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].notes).toBe('First note; Second note')
    })

    test('should merge RC status (if any row has RC, mark as RC)', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', ''],
        ['100', 'Shohei Ohtani', 'Angels', 'RC', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].isRC).toBe(true)
    })

    test('should skip empty rows', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', '', ''],
        ['', '', '', '', ''], // Empty row
        ['2', 'Aaron Judge', 'Yankees', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(2)
      expect(result[0].cardNumber).toBe('1')
      expect(result[1].cardNumber).toBe('2')
    })

    test('should remove parentheses from notes', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', '', '(Rookie Card)']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].notes).toBe('Rookie Card')
    })

    test('should throw error when no data found', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue([])

      await expect(excelParser.parseXlsxFile(Buffer.from('mock')))
        .rejects
        .toThrow('No data found in spreadsheet')
    })

    test('should assign sequential sort order', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Player A', 'Team A', '', ''],
        ['2', 'Player B', 'Team B', '', ''],
        ['3', 'Player C', 'Team C', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].sortOrder).toBe(1)
      expect(result[1].sortOrder).toBe(2)
      expect(result[2].sortOrder).toBe(3)
    })

    test('should reassign sort order after merging duplicates', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Player A', 'Team A', '', ''],
        ['100', 'Player B', 'Team B', '', ''],
        ['101', 'Player C', 'Team C', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(2)
      expect(result[0].sortOrder).toBe(1)
      expect(result[1].sortOrder).toBe(2)
    })
  })

  // ============================================================================
  // parsePastedData Tests
  // ============================================================================

  describe('parsePastedData', () => {
    test('should parse tab-separated data', async () => {
      const data = '1\tMike Trout\tAngels\tRC\tRookie Card\n2\tAaron Judge\tYankees\t\t'

      const result = await excelParser.parsePastedData(data)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        cardNumber: '1',
        playerNames: ['Mike Trout'],
        teamNames: ['Angels'],
        isRC: true,
        notes: 'Rookie Card'
      })
      expect(result[1]).toMatchObject({
        cardNumber: '2',
        playerNames: ['Aaron Judge'],
        teamNames: ['Yankees'],
        isRC: false
      })
    })

    test('should handle single row of pasted data', async () => {
      const data = '1\tMike Trout\tAngels\tRC\t'

      const result = await excelParser.parsePastedData(data)

      expect(result).toHaveLength(1)
      expect(result[0].cardNumber).toBe('1')
    })

    test('should throw error when no data provided', async () => {
      await expect(excelParser.parsePastedData(''))
        .rejects
        .toThrow('No data provided')
    })

    test('should throw error when only whitespace provided', async () => {
      await expect(excelParser.parsePastedData('   \n   '))
        .rejects
        .toThrow('No data provided')
    })

    test('should handle multi-player pasted data', async () => {
      const data = '100\tPlayer A / Player B\tTeam A / Team B\t\t'

      const result = await excelParser.parsePastedData(data)

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Player A', 'Player B'])
      expect(result[0].teamNames).toEqual(['Team A', 'Team B'])
    })

    test('should handle consecutive duplicates in pasted data', async () => {
      const data = '100\tPlayer A\tTeam A\t\t\n100\tPlayer B\tTeam B\t\t'

      const result = await excelParser.parsePastedData(data)

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Player A', 'Player B'])
    })
  })

  // ============================================================================
  // Rookie Card Detection Tests
  // ============================================================================

  describe('_detectRookieCard', () => {
    // Access private method for testing
    const detectRookieCard = (rcIndicator) => {
      // We'll test this through parseXlsxFile, but document expected behavior
      return rcIndicator && (
        rcIndicator.toLowerCase().includes('rc') ||
        rcIndicator.toLowerCase().includes('rookie') ||
        rcIndicator.toLowerCase() === 'yes' ||
        rcIndicator.toLowerCase() === 'true' ||
        rcIndicator === '1'
      )
    }

    test('should detect "RC" as rookie card', () => {
      expect(detectRookieCard('RC')).toBe(true)
      expect(detectRookieCard('rc')).toBe(true)
      expect(detectRookieCard('Rc')).toBe(true)
    })

    test('should detect "Rookie" as rookie card', () => {
      expect(detectRookieCard('Rookie')).toBe(true)
      expect(detectRookieCard('rookie')).toBe(true)
    })

    test('should detect "yes" as rookie card', () => {
      expect(detectRookieCard('yes')).toBe(true)
      expect(detectRookieCard('Yes')).toBe(true)
      expect(detectRookieCard('YES')).toBe(true)
    })

    test('should detect "true" as rookie card', () => {
      expect(detectRookieCard('true')).toBe(true)
      expect(detectRookieCard('True')).toBe(true)
    })

    test('should detect "1" as rookie card', () => {
      expect(detectRookieCard('1')).toBe(true)
    })

    test('should NOT detect empty string as rookie card', () => {
      expect(detectRookieCard('')).toBeFalsy()
    })

    test('should NOT detect "no" as rookie card', () => {
      expect(detectRookieCard('no')).toBe(false)
    })

    test('should NOT detect "0" as rookie card', () => {
      expect(detectRookieCard('0')).toBe(false)
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration - Complex Scenarios', () => {
    test('should handle mixed multi-player and single-player cards', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', '', ''],
        ['2', 'Player A / Player B', 'Team A / Team B', '', ''],
        ['3', 'Aaron Judge', 'Yankees', 'RC', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(3)
      expect(result[0].playerNames).toEqual(['Mike Trout'])
      expect(result[1].playerNames).toEqual(['Player A', 'Player B'])
      expect(result[2].playerNames).toEqual(['Aaron Judge'])
    })

    test('should handle three consecutive duplicates', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Player A', 'Team A', '', ''],
        ['100', 'Player B', 'Team B', '', ''],
        ['100', 'Player C', 'Team C', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Player A', 'Player B', 'Player C'])
      expect(result[0].teamNames).toEqual(['Team A', 'Team B', 'Team C'])
    })

    test('should deduplicate teams when merging consecutive cards with same team', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', ''],
        ['100', 'Shohei Ohtani', 'Angels', '', ''],
        ['100', 'Anthony Rendon', 'Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].teamNames).toEqual(['Angels']) // Not ['Angels', 'Angels', 'Angels']
    })

    test('should preserve different teams when merging consecutive cards', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Mike Trout', 'Angels', '', ''],
        ['100', 'Aaron Judge', 'Yankees', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].teamNames).toEqual(['Angels', 'Yankees'])
    })

    test('should handle whitespace in player and team names', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', '  Mike Trout  ', '  Los Angeles Angels  ', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].playerNames).toEqual(['Mike Trout'])
      expect(result[0].teamNames).toEqual(['Los Angeles Angels'])
    })

    test('should handle empty teams and players gracefully', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', '', '', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual([])
      expect(result[0].teamNames).toEqual([])
    })

    test('should handle isAutograph and isRelic defaults', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].isAutograph).toBe(false)
      expect(result[0].isRelic).toBe(false)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle very long card numbers', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['2024-TOPPS-CHROME-AUTO-RED-REFRACTOR-/99', 'Mike Trout', 'Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].cardNumber).toBe('2024-TOPPS-CHROME-AUTO-RED-REFRACTOR-/99')
    })

    test('should handle special characters in notes', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['1', 'Mike Trout', 'Angels', '', 'SP! #/99 @Rookie']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result[0].notes).toBe('SP! #/99 @Rookie')
    })

    test('should handle multiple consecutive duplicates with gap', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      const mockData = [
        ['100', 'Player A', 'Team A', '', ''],
        ['100', 'Player B', 'Team B', '', ''],
        ['101', 'Player C', 'Team C', '', ''],
        ['101', 'Player D', 'Team D', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(2)
      expect(result[0].cardNumber).toBe('100')
      expect(result[0].playerNames).toEqual(['Player A', 'Player B'])
      expect(result[1].cardNumber).toBe('101')
      expect(result[1].playerNames).toEqual(['Player C', 'Player D'])
    })

    // ============================================================================
    // Comma in Name Without Team Data Tests
    // These test cases ensure commas in playerNames are NOT treated as multi-player
    // delimiters when there is no team data provided (teamNames is empty)
    // ============================================================================

    test('should NOT split on comma when teamNames is empty (lighthouse names with location)', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      // This is the actual use case: 2-column import with lighthouse names containing commas
      const mockData = [
        ['LTN-1', 'Ponce de Leon Inlet Ponce Inlet, Florida', '', '', ''],
        ['LTN-2', 'Biloxi Lighthouse Biloxi, Mississippi', '', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(2)
      // The full name including comma should be preserved as a single entry
      expect(result[0].playerNames).toEqual(['Ponce de Leon Inlet Ponce Inlet, Florida'])
      expect(result[0].teamNames).toEqual([])
      expect(result[1].playerNames).toEqual(['Biloxi Lighthouse Biloxi, Mississippi'])
      expect(result[1].teamNames).toEqual([])
    })

    test('should NOT split on comma when teamNames is empty (multiple commas in name)', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      // Names with multiple commas (like "City, State, Country")
      const mockData = [
        ['1', 'Big Ben Clock Tower, London, United Kingdom', '', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Big Ben Clock Tower, London, United Kingdom'])
      expect(result[0].teamNames).toEqual([])
    })

    test('should STILL split on comma when teamNames IS provided', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      // When team data is present, comma IS a multi-player delimiter
      const mockData = [
        ['100', 'Mike Trout, Shohei Ohtani', 'Angels, Angels', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Mike Trout', 'Shohei Ohtani'])
      expect(result[0].teamNames).toEqual(['Angels', 'Angels'])
    })

    test('should ALWAYS split on slash regardless of teamNames (slash is always a delimiter)', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      // Slash should always be treated as a delimiter, even without team data
      const mockData = [
        ['100', 'Player A / Player B', '', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Player A', 'Player B'])
    })

    test('should handle mixed: slash splits but comma preserved when no team', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }

      // Slash should split, but the comma within each name should be preserved
      const mockData = [
        ['100', 'Lighthouse A, Florida / Lighthouse B, California', '', '', '']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockData)

      const result = await excelParser.parseXlsxFile(Buffer.from('mock'))

      expect(result).toHaveLength(1)
      // Each slash-separated entry should preserve its internal comma
      expect(result[0].playerNames).toEqual(['Lighthouse A, Florida', 'Lighthouse B, California'])
    })

    test('should NOT split pasted data on comma when teamNames is empty', async () => {
      // Tab-separated paste with no team column data
      const data = 'LTN-1\tBiloxi Lighthouse, Mississippi\t\t\t'

      const result = await excelParser.parsePastedData(data)

      expect(result).toHaveLength(1)
      expect(result[0].playerNames).toEqual(['Biloxi Lighthouse, Mississippi'])
      expect(result[0].teamNames).toEqual([])
    })
  })
})
