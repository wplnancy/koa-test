fs = require 'fs'
path = require 'path'

logPath = path.resolve __dirname, '../log'
hasLogFolder = fs.existsSync logPath
unless hasLogFolder
  fs.mkdirSync logPath

log =
  readListFile: (fileName) ->
    return unless fileName
    if global.cache[fileName]
      return global.cache[fileName]

    listPath = path.join logPath, fileName
    return [] unless fs.existsSync listPath

    data = fs.readFileSync listPath, 'utf-8'
    result = data.trim().split('\n')
    list = JSON.parse "[#{result.join(',')}]"

    stats = fs.statSync listPath
    if stats.size <= global.maxCacheSize
      global.cache[fileName] = list

    return list

  getWaitingList: ->
    @readListFile 'waiting.list'

  getSuccessList: ->
    @readListFile 'success.list'

  getErrorList: ->
    @readListFile 'error.list'

  removeErrorList: ->
    oldFilename = path.join logPath, 'error.list'
    newFilename = path.join logPath, "error_backup#{new Date().getTime()}.list"
    try
      fs.renameSync oldFilename, newFilename
    catch e
      # pass, No error list.

  addToListFile: (params, filename) ->
    return unless filename
    global.cache[filename] = null
    line = JSON.stringify params
    fs.appendFileSync path.join(logPath, filename), line + '\n'

  addToWaitingList: (params) ->
    @addToListFile params, 'waiting.list'

  addToSuccessList: (params) ->
    @addToListFile params, 'success.list'

  addToErrorList: (params) ->
    @addToListFile params, 'error.list'

logListToHashMap = (list) ->
  hashMap = {}
  for i in list
    hashMap[i.path] = i
  return hashMap

getRandomNumber = (max=100) ->
  Math.floor do Math.random * max

getRandomString = (max=30) ->
  number = '0123456789'
  letter = 'abcdefghijklmnopqrstuvwxyz'
  s = number + letter + do letter.toUpperCase
  (s[getRandomNumber s.length] for i in [1 .. max]).join ''

getOSSPath = (url) ->
  ext = path.extname url
  t = new Date().getTime()
  s = getRandomString(30)
  "#{t}#{s}#{ext}"

pagerResponse = (ctx, list) ->
  defaultPageSize = 12
  defaultPage = 1

  pageSize = parseInt ctx.query.page_size or defaultPageSize
  page = parseInt ctx.query.page or defaultPage

  count = list.length

  if pageSize < 0 or pageSize > count
    pageSize = defaultPageSize

  maxPage = Math.ceil (count / pageSize) or 1

  validPage = page > 0 and page <= maxPage
  unless validPage
    ctx.status = 404
    return detail: 'invalid page.'

  start = (page - 1) * pageSize
  if (page * pageSize) >= count
    end = count
  else
    end = start + pageSize
  results = list.slice start, end

  ctx.status = 200
  return {
    count
    results
  }

module.exports = {
  log,
  logListToHashMap,
  getOSSPath,
  pagerResponse
}
