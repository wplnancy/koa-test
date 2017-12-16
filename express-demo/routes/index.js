let express = require('express')

let router = express.Router();

router.get('/', (req, res) => {
  res.send('hello, express')
})

module.exports = router
