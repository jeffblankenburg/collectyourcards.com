const express = require('express')
const ExcelJS = require('exceljs')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware } = require('./middleware')

const router = express.Router()

// =============================================================================
// TEMPLATE DOWNLOAD
// =============================================================================

// Download series checklist template
router.get('/template/series-checklist',
  authMiddleware,
  async (req, res) => {
    try {
      // Get colors from database for dropdown
      const colors = await prisma.$queryRaw`SELECT name FROM color ORDER BY name`
      const colorNames = colors.map(c => c.name)

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Collect Your Cards'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Checklist')

      // Define columns with headers and widths
      worksheet.columns = [
        { header: 'Card Number', key: 'cardNumber', width: 12 },
        { header: 'Player(s)', key: 'players', width: 45 },
        { header: 'Team(s)', key: 'teams', width: 55 },
        { header: 'RC', key: 'rc', width: 6 },
        { header: 'Auto', key: 'auto', width: 6 },
        { header: 'Relic', key: 'relic', width: 6 },
        { header: 'SP', key: 'sp', width: 6 },
        { header: 'Color', key: 'color', width: 14 },
        { header: 'Print Run', key: 'printRun', width: 10 },
        { header: 'Notes', key: 'notes', width: 30 }
      ]

      // Style header row
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      }
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

      // Example data rows - use "/" for multiple players/teams
      const exampleData = [
        { cardNumber: '1', players: 'Mike Trout', teams: 'Los Angeles Angels', rc: '', auto: '', relic: '', sp: '', color: '', printRun: '', notes: '' },
        { cardNumber: '2', players: 'Shohei Ohtani', teams: 'Los Angeles Dodgers', rc: 'RC', auto: '', relic: '', sp: '', color: '', printRun: '', notes: 'MVP candidate' },
        { cardNumber: '3', players: 'Juan Soto / Aaron Judge / Giancarlo Stanton', teams: 'New York Mets / New York Yankees / New York Yankees', rc: '', auto: '', relic: '', sp: '', color: '', printRun: '', notes: 'Multi-player card' },
        { cardNumber: '4', players: 'Ronald Acuna Jr.', teams: 'Atlanta Braves', rc: '', auto: 'Auto', relic: '', sp: '', color: '', printRun: '', notes: 'On-card auto' },
        { cardNumber: '5', players: 'Mookie Betts', teams: 'Los Angeles Dodgers', rc: '', auto: '', relic: 'Relic', sp: '', color: '', printRun: '', notes: 'Jersey swatch' },
        { cardNumber: '6', players: 'Freddie Freeman', teams: 'Los Angeles Dodgers', rc: '', auto: '', relic: '', sp: 'SP', color: '', printRun: '', notes: 'Short print' },
        { cardNumber: '7', players: 'Corey Seager', teams: 'Texas Rangers', rc: '', auto: '', relic: '', sp: '', color: 'Gold', printRun: '50', notes: 'Numbered to 50' },
        { cardNumber: '8', players: 'Julio Rodriguez', teams: 'Seattle Mariners', rc: 'RC', auto: 'Auto', relic: 'Relic', sp: '', color: 'Red', printRun: '25', notes: 'Rookie patch auto' }
      ]

      exampleData.forEach(row => worksheet.addRow(row))

      // Add data validation (dropdown) for Color column (column H)
      // Apply to rows 2-500 to cover plenty of data entry
      for (let row = 2; row <= 500; row++) {
        worksheet.getCell(`H${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${colorNames.join(',')}"`],
          showDropDown: true
        }
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()

      // Send as download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="series-checklist-template.xlsx"')
      res.send(buffer)

    } catch (error) {
      console.error('Error generating template:', error)
      res.status(500).json({ error: 'Server error', message: 'Failed to generate template' })
    }
  }
)

module.exports = router
