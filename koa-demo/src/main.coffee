Koa = require 'koa'
logger = require 'koa-logger'
bodyParser = require 'koa-bodyparser'
cors = require 'koa-cors'
router = require './router'

app = new Koa
app.use logger()
app.use bodyParser()
app.use cors({ credentials: true })
app.use router.routes()

app.listen 3000
