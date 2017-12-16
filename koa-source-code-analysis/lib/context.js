
'use strict';
/**
 *  context 是上下文的意思， koa 的操作都是基于 context 来实现的
 *  例如：
 *    this.body = 'hello koa2!'
 *
 *
 */

/**
 * Module dependencies.
 */

// Create HTTP errors for Express, Koa, Connect, etc. with ease.
const createError = require('http-errors');

// Assert with status codes. Like ctx.throw() in Koa, but with a guard.
const httpAssert = require('http-assert');

// delegates的功能就是把一个对象上的方法，属性委托到另一个对象上
const delegate = require('delegates');
const statuses = require('statuses');

/**
 * Context prototype.
 */

const proto = module.exports = {

  /**
   * util.inspect() implementation, which
   * just returns the JSON output.
   *
   * @return {Object}
   * @api public
   */

  inspect() {
    if (this === proto) return this;
    return this.toJSON();
  },

  /**
   * Return JSON representation.
   *
   * Here we explicitly invoke .toJSON() on each
   * object, as iteration will otherwise fail due
   * to the getters and cause utilities such as
   * clone() to fail.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return {
      request: this.request.toJSON(),
      response: this.response.toJSON(),
      app: this.app.toJSON(),
      originalUrl: this.originalUrl,
      req: '<original node req>',
      res: '<original node res>',
      socket: '<original node socket>'
    };
  },

  /**
   * Similar to .throw(), adds assertion.
   *
   *    this.assert(this.user, 401, 'Please login!');
   *
   * See: https://github.com/jshttp/http-assert
   *
   * @param {Mixed} test
   * @param {Number} status
   * @param {String} message
   * @api public
   */

  assert: httpAssert,

  /**
   * Throw an error with `msg` and optional `status`
   * defaulting to 500. Note that these are user-level
   * errors, and the message may be exposed to the client.
   *
   *    this.throw(403)
   *    this.throw('name required', 400)
   *    this.throw(400, 'name required')
   *    this.throw('something exploded')
   *    this.throw(new Error('invalid'), 400);
   *    this.throw(400, new Error('invalid'));
   *
   * See: https://github.com/jshttp/http-errors
   *
   * @param {String|Number|Error} err, msg or status
   * @param {String|Number|Error} [err, msg or status]
   * @param {Object} [props]
   * @api public
   */

  throw(...args) {
    throw createError(...args);
  },

  /**
   * Default error handling.
   *
   * @param {Error} err
   * @api private
   */

  onerror(err) {
    // don't do anything if there is no error.
    // this allows you to pass `this.onerror`
    // to node-style callbacks.
    if (null == err) return;

    if (!(err instanceof Error)) err = new Error(`non-error thrown: ${err}`);

    let headerSent = false;
    if (this.headerSent || !this.writable) {
      headerSent = err.headerSent = true;
    }

    // delegate
    this.app.emit('error', err, this);

    // nothing we can do here other
    // than delegate to the app-level
    // handler and log.
    if (headerSent) {
      return;
    }

    const { res } = this;

    // first unset all headers
    if (typeof res.getHeaderNames === 'function') {
      res.getHeaderNames().forEach(name => res.removeHeader(name));
    } else {
      res._headers = {}; // Node < 7.7
    }

    // then set those specified
    this.set(err.headers);

    // force text/plain
    this.type = 'text';

    // ENOENT support
    if ('ENOENT' == err.code) err.status = 404;

    // default to 500
    if ('number' != typeof err.status || !statuses[err.status]) err.status = 500;

    // respond
    const code = statuses[err.status];
    const msg = err.expose ? err.message : code;
    this.status = err.status;
    this.length = Buffer.byteLength(msg);
    this.res.end(msg);
  }
};

/**
 * Response delegation.
 */

/**
 * method方法是委托方法，getter方法用来委托getter，access方法委托getter+setter
 * delegate(prop, 'response').method(..)... 表示的是将 response 对象上下面这些方法都放到 proto 这个对象上
 * 下面罗列的方法都是 request 和 response 类上的静态类方法
 *
 * 下面是源码片段
      function Delegator(proto, target) {
        if (!(this instanceof Delegator)) return new Delegator(proto, target);
        this.proto = proto;
        this.target = target;
        this.methods = [];
        this.getters = [];
        this.setters = [];
        this.fluents = [];
      }

      Delegator.prototype.method = function(name){
        var proto = this.proto;
        var target = this.target;
        this.methods.push(name);

        proto[name] = function(){
          return this[target][name].apply(this[target], arguments);
        };
        return this;
      };

从上面的代码中可以看到，它其实是在proto上新建一个与Request和Response上的方法名一样的函数，然后执行这个函数的时候，这个函数在去Request和Response上去找对应的方法并执行。

关于更多关于 delegator 的 getters 和 setters 的介绍详见 https://github.com/berwin/Blog/issues/8
 */
delegate(proto, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('set')
  .method('append')
  .method('flushHeaders')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

/**
 * Request delegation.
 */

delegate(proto, 'request')
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  .method('accepts')
  .method('get')
  .method('is')
  .access('querystring')
  .access('idempotent')
  .access('socket')
  .access('search')
  .access('method')
  .access('query')
  .access('path')
  .access('url')
  .getter('origin')
  .getter('href')
  .getter('subdomains')
  .getter('protocol')
  .getter('host')
  .getter('hostname')
  .getter('URL')
  .getter('header')
  .getter('headers')
  .getter('secure')
  .getter('stale')
  .getter('fresh')
  .getter('ips')
  .getter('ip');
