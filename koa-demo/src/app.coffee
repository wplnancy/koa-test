co = require 'co'
OSS = require 'ali-oss'
request = require 'request-promise'
parseDomain = require 'parse-domain'
{
  log,
  logListToHashMap,
  getOSSPath,
  pagerResponse
} = require './utils'

global.workQueue = []

global.cache = {}
global.maxCacheSize = 1024 * 1024 * 1024 * 2
global.maxAge = 2000

setTimeout =>
  global.cache = {}
, global.maxAge

validForm = (ctx) ->
  url = ctx.request.body['url']
  author = ctx.request.body['author']
  author_uuid = ctx.request.body['author_uuid']
  name = ctx.request.body['name']
  return Boolean url and author and author_uuid and name

retryDownload = (ctx) ->
  for i in log.getErrorList()
    i.time = new Date()
    i.retry = true
    addFileToOSS i

  log.removeErrorList()
  ctx.status = 200

download = (ctx) ->
  unless validForm(ctx)
    ctx.throw 400, 'valid faild'

  params = JSON.parse JSON.stringify ctx.request.body
  params.path = 'songs/' + getOSSPath(params.url)
  params.time = new Date()
  params.origin = ctx.request.header.origin

  log.addToWaitingList params
  addFileToOSS params

  ctx.status = 200

addFileToOSS = (params) ->
  global.workQueue.push params

downloadMethod = (params) ->
  client = new OSS
    region: 'oss-cn-beijing-internal'
    accessKeyId: process.env.ACCESS_KEY_ID
    accessKeySecret: process.env.ACCESS_KEY_SECRET
    bucket: 'vfine-songs'
  co ->
    result = yield client.putStream(params.path, request(params.url))
    if result.res.status isnt 200
      params.download = 'fail'
      return log.addToErrorList params

    params.download = 'success'
    addToServer(params)
    dloop()
  .catch (err) ->
    params.download = 'fail'
    log.addToErrorList params
    dloop()

dloop = ->
  params = global.workQueue.shift()
  unless params
    return setTimeout dloop, 1000

  downloadMethod params

dloop()

addToServer = (params) ->
  originDomain = 'vfinemusic.com'
  if params.origin
    { tld, domain } = parseDomain params.origin
    originDomain = "#{domain}.#{tld}"

  options =
    method: 'POST'
    uri: process.env.API_ADDRESS + '/admin/works/'
    headers:
      'Authorization': process.env.AUTHORIZATION_TOKEN
    body:
      producer: params.author_uuid
      type: 'PERSONAL'
      name: params.name
      path: params.path
      can_sell: true
      origin: originDomain
      pricing_mode: 'UNITIVE'
      categories: params.categories
    json: true

  request options
    .then (response) ->
      if response and response.uuid
        log.addToSuccessList params
      else
        log.addToErrorList params
    .catch (err) ->
      log.addToErrorList params


getDownloadList = (ctx) ->
  status = ctx.query.status or ''
  waitingList = log.getWaitingList()
  successMap = logListToHashMap log.getSuccessList()
  errorMap = logListToHashMap log.getErrorList()

  for i in waitingList
    i.status = 'waiting'
    i.status = 'success' if successMap[i.path]
    i.status = 'error' if errorMap[i.path]

  downloadList = []
  switch status
    when ''
      downloadList = waitingList

    when 'waiting', 'success', 'error'
      downloadList = waitingList.filter (i) -> i.status is status

  ctx.body = pagerResponse ctx, downloadList

module.exports = {
  download
  retryDownload
  getDownloadList
}
