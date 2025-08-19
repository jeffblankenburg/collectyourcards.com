const express = require('express')
const router = express.Router()

// Placeholder ebay routes
router.get('/', (req, res) => {
  res.json({ message: 'eBay route placeholder' })
})

module.exports = router