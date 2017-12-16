Router = require 'koa-router'
{
  download, retryDownload, getDownloadList
} = require './app'

router = new Router
router.post '/download/retry', retryDownload
router.post '/download', download
router.get '/download', getDownloadList

module.exports = router
