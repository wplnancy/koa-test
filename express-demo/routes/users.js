let express = require('express')

let router = express.Router()

router.get('/:name', (req, res) => {
  console.log(req.params.name)
  res.render('users', {
    name: req.params.name
  })
})

module.exports = router
