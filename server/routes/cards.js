const express = require('express')
const router = express.Router()

// Placeholder cards routes
router.get('/', (req, res) => {
  res.json({ message: 'Cards route placeholder' })
})

module.exports = router