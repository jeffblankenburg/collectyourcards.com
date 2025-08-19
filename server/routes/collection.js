const express = require('express')
const router = express.Router()

// Placeholder collection routes
router.get('/', (req, res) => {
  res.json({ message: 'Collection route placeholder' })
})

module.exports = router