
'use strict';

/**
 * Module dependencies.
 */
// 判断是否是一个 generator 方法的库
const isGeneratorFunction = require('is-generator-function');

// 调试
const debug = require('debug')('koa:application');

/**
  Attach a listener to listen for the response to finish. The listener will be invoked only once when the response finished. If the response finished to an error, the first argument will contain the error. If the response has already finished, the listener will be invoked.
  onFinished(req, function (err, req) {
    // 监听请求完成时的回调函数
    // data is read unless there is err
  })
*/
const onFinished = require('on-finished');

// app.use([middleware1, middleware2, middleware3, ...])确保数组里面的中间件按照顺序依次执行， -> 洋葱模型
// 源码非常的少，核心就是一个 compose 方法： 具体可参考: https://zhuanlan.zhihu.com/p/29455788
const compose = require('koa-compose');

//Check if `body` should be interpreted as json. 检查 body 是否是 json 形式
//核心代码参见：https://github.com/koajs/is-json/blob/master/index.js
// 需要注意的是还有一个库叫 is-json 但是这个验证的就是真正的一个判断一个字符串是否是真正的 json 字符串
// 关于 is-json 更多的介绍，详见： https://github.com/joaquimserafim/is-json
const isJSON = require('koa-is-json');

// 引入本地模块 response
const response = require('./response');
// 引入本地模块 context
const context = require('./context');
// 引入本地模块 request
const request = require('./request');

// 处理 http 响应的状态码
const statuses = require('statuses');

// 提供操作 cookie 的便捷方式
const Cookies = require('cookies');

const accepts = require('accepts');

// 调用 node 先关的模块
//
const Emitter = require('events');
const assert = require('assert');
const Stream = require('stream');
const http = require('http');

// 仅仅取出数据的一部分
const only = require('only');

// convert 就是将一个普通函数 push 到 中间件数组里面， 返回 promise
const convert = require('koa-convert');

// 错误消息提示
const deprecate = require('depd')('koa');

/**
 * Expose `Application` class.
 * Inherits from `Emitter.prototype`.
 */

// 导出一个 Application 的类， 并且集成了 事件触发器 Emitter
module.exports = class Application extends Emitter {
  /**
   * Initialize a new `Application`.
   *
   * @api public
   */

  constructor() {
    super();// 调用父类的方法

    this.proxy = false;// ?

    // 初始化中间件集合
    this.middleware = [];

    this.subdomainOffset = 2;// ?

    this.env = process.env.NODE_ENV || 'development';

    //  基于 context、request、 response 对象创建相对应的实例

    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
    // 存在的疑问： Request和Response的属性和方法委托到Context中也是在这一步进行的
  }

  /**
   * Shorthand for:
   *
   *    http.createServer(app.callback()).listen(...)
   *
   * @param {Mixed} ...
   * @return {Server}
   * @api public
   *
   * listen 的作用是 启动server， 监听端口
   */



  listen(...args) {
    debug('listen');
    // this.callback 其实是一个方法：
    /**
     * [server description]
     * @type {[type]}
     * http.createServer(function(req, res) => {
     *
     * }) = >
     * // 相应请求的方法
     * this.callback === function(req, res) => {}
     */

    const server = http.createServer(this.callback());
    return server.listen(...args);
  }

  /**
   * Return JSON representation.
   * We only bother showing settings.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ]);
  }

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect() {
    return this.toJSON();
  }

  /**
   * Use the given middleware `fn`.
   *
   * Old-style middleware will be converted.
   *
   * @param {Function} fn
   * @return {Application} self
   * @api public
   */

//  从这个跟 use 方法可以看出，我们调用 app.use 方法就是注册中间件的含义
//  核心代码： this.middleware.push(fn)
  use(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    // 如果是 generator 函数的话， 就使用 convert 进行转换
    if (isGeneratorFunction(fn)) {
      deprecate('Support for generators will be removed in v3. ' +
                'See the documentation for examples of how to convert old middleware ' +
                'https://github.com/koajs/koa/blob/master/docs/migration.md');
      fn = convert(fn);
    }
    // 注意这里没有判断是否是普通函数的原因是： 在 koa2 也支持普通函数作为中间件使用的
    debug('use %s', fn._name || fn.name || '-');
    this.middleware.push(fn);
    return this;
  }

  /**
   * Return a request handler callback
   * for node's native http server.
   *
   * @return {Function}
   * @api public
   */

  callback() {
    const fn = compose(this.middleware);

    if (!this.listeners('error').length) this.on('error', this.onerror);

    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);
      return this.handleRequest(ctx, fn);
    };

    return handleRequest;
  }

  /**
   * Handle request in callback.
   *
   * @api private
   */

  handleRequest(ctx, fnMiddleware) {
    const res = ctx.res;
    res.statusCode = 404;
    const onerror = err => ctx.onerror(err);
    const handleResponse = () => respond(ctx);
    onFinished(res, onerror);
    // 因为 fnMiddleware 返回的是一个 Promise 对象， 在执行 fnMiddleware 的时候实质是执行依次执行每一个中间件，如果中间件有异常， 则会被 catch 函数捕获
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);
  }

  /**
   * Initialize a new context.
   *
   * @api private
   */
  //  每一次接受请求的时候都会创建一个新的 context 对象

  createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);

    // 给 context request response 对象添加属性
    context.app = request.app = response.app = this;
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;

    request.response = response;
    response.request = request;
    context.originalUrl = request.originalUrl = req.url;
    context.cookies = new Cookies(req, res, {
      keys: this.keys,
      secure: request.secure
    });
    request.ip = request.ips[0] || req.socket.remoteAddress || '';
    context.accept = request.accept = accepts(req);
    context.state = {};

    // 返回最后完整版的 context, 其实也就是我们在 koa 中经常使用的 this 对象
    return context;
  }

  /**
   * Default error handler.
   *
   * @param {Error} err
   * @api private
   */

  // 错误捕获
  onerror(err) {
    assert(err instanceof Error, `non-error thrown: ${err}`);

    if (404 == err.status || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();
    console.error();
    console.error(msg.replace(/^/gm, '  '));
    console.error();
  }
};

/**
 * Response helper.
 */

function respond(ctx) {
  // allow bypassing koa
  if (false === ctx.respond) return;

  const res = ctx.res;
  if (!ctx.writable) return;

  let body = ctx.body;
  const code = ctx.status;

  // ignore body
  if (statuses.empty[code]) {
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if ('HEAD' == ctx.method) {
    if (!res.headersSent && isJSON(body)) {
      ctx.length = Buffer.byteLength(JSON.stringify(body));
    }
    return res.end();
  }

  // status body
  if (null == body) {
    body = ctx.message || String(code);
    if (!res.headersSent) {
      ctx.type = 'text';
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // responses
  if (Buffer.isBuffer(body)) return res.end(body);
  if ('string' == typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  // body: json
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}
