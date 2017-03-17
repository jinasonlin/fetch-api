'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetch = exports.createFetchAPI = exports.fetchAPI = exports.getURL = exports.setServices = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _es6Promise = require('es6-promise');

var _es6Promise2 = _interopRequireDefault(_es6Promise);

var _isomorphicFetch = require('isomorphic-fetch');

var _isomorphicFetch2 = _interopRequireDefault(_isomorphicFetch);

var _qs = require('qs');

var _qs2 = _interopRequireDefault(_qs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_es6Promise2.default.polyfill();

var debug = false;
if (typeof __DEBUG__ !== 'undefined') {
  debug = __DEBUG__;
}

/**
 * API格式
 * {
 *   serviceName: {
 *     host: 'your.server.host.com or /your/server/path'
 *   }
 * }
 */
var API = {};
var services = [];

function _setServices(api) {
  var keys = Object.keys(api);
  if (keys.length) {
    services = keys;
    API = api;
  }
}

function _checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }
  var error = new Error(response.statusText);
  error.response = response;
  throw error;
}

function _parseJSON(response) {
  return response.json();
}

// TODO 优化路径正则匹配
function _getURL(_ref) {
  var url = _ref.url,
      server = _ref.server,
      _ref$path = _ref.path,
      path = _ref$path === undefined ? '/' : _ref$path;

  var PATH = /^\/[0-9a-zA-Z]+/;
  var URL = /^(http:\/\/|https:\/\/|\/\/)/;

  // url为路径，_cors: false
  // url非地址，自动补全“//”。_cors: true
  if (url) {
    if (PATH.test(url)) {
      return {
        _url: url,
        _cors: false
      };
    }
    if (!URL.test(url)) {
      return {
        _url: '//' + url,
        _cors: true
      };
    }
    return {
      _url: url,
      _cors: true
    };
  }

  var _url = void 0;
  var _cors = false;
  var _host = ~services.indexOf(server) ? API[server].host : '';
  if (server && _host) {
    // _host为路径时，不补全
    // _host为地址时，_cors = true
    if (PATH.test(_host)) {
      _url = '' + _host + path;
    } else {
      // _host非地址，自动补全“//”
      if (!URL.test(_host)) {
        _url = '//' + _host + path;
      }
      _cors = true;
    }
  } else {
    _url = path;
  }

  return {
    _url: _url,
    _cors: _cors
  };
}

exports.setServices = _setServices;
var getURL = exports.getURL = function getURL() {
  var _getURL2 = _getURL.apply(undefined, arguments),
      _url = _getURL2._url;

  return _url;
};

/**
 * fetch json accept api
 * json规范接口调用，如非json规范，请使用isomorphic-fetch
 * 默认允许跨域请求和cookies跨域携带
 * TODO 增加querystring参数配置
 */
var fetchAPI = function fetchAPI(options) {
  var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      checkStatus = _ref2.checkStatus,
      parseJSON = _ref2.parseJSON,
      middlewares = _ref2.middlewares;

  var url = options.url,
      server = options.server,
      _options$path = options.path,
      path = _options$path === undefined ? '' : _options$path,
      _options$method = options.method,
      method = _options$method === undefined ? 'GET' : _options$method,
      mode = options.mode,
      _options$isFormData = options.isFormData,
      isFormData = _options$isFormData === undefined ? false : _options$isFormData,
      _options$withCredenti = options.withCredentials,
      withCredentials = _options$withCredenti === undefined ? true : _options$withCredenti,
      headers = options.headers,
      data = options.data,
      success = options.success,
      error = options.error;


  var opts = {
    method: method.toUpperCase()
  };
  if (mode) {
    opts.mode = mode;
  }

  // 配置请求地址
  var URL = _getURL({ url: url, server: server, path: path });
  var _url = URL._url;
  if (!URL._url) {
    throw new Error('Missing request address');
  }
  if (URL._cors && !mode) {
    opts.mode = 'cors';
  }

  // 配置请求cookies携带
  if (withCredentials) {
    opts.credentials = 'include';
  }

  // 配置请求头和请求体
  if (~['POST', 'PUT'].indexOf(method) && data) {
    opts.body = data;
  }
  if (!isFormData) {
    // 耦合内部的接口配置默认请求头
    if (!url && headers !== false) {
      opts.headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      };
    }
    if (headers) {
      opts.headers = Object.assign({}, opts.headers, headers);
    }
    if (method === 'GET' && data) {
      var querystring = _qs2.default.stringify(data, { arrayFormat: 'repeat' });
      _url = (URL._url + '&' + querystring).replace(/[&?]{1,2}/, '?');
    } else if (~['POST', 'PUT'].indexOf(method) && data) {
      opts.body = JSON.stringify(opts.body);
    }
  }

  debug && console.debug('fetchAPI', _url, opts);

  var _promise = (0, _isomorphicFetch2.default)(_url, opts).then(checkStatus || _checkStatus).then(parseJSON || _parseJSON);

  // 添加中间件
  if (middlewares instanceof Array && middlewares.length) {
    for (var i = 0; i < middlewares.length; i += 1) {
      if (typeof middlewares[i] === 'function') {
        _promise = _promise.then(middlewares[i]);
      }
    }
  }

  _promise = _promise.then(function (json) {
    debug && console.debug('fetchAPI _promise success');
    typeof success === 'function' && success(json);
    return json;
  }, function (reason) {
    debug && console.debug('fetchAPI _promise fail', reason);
    typeof error === 'function' && error(reason);
    return Promise.reject(reason);
  });

  return _promise;
};

['get', 'post', 'put'].forEach(function (method) {
  fetchAPI[method] = function (url, data, opts) {
    if (typeof url === 'string') {
      return fetchAPI(_extends({
        method: method.toUpperCase(),
        url: url,
        data: data
      }, opts));
    }
    if ((typeof url === 'undefined' ? 'undefined' : _typeof(url)) === 'object') {
      return fetchAPI(_extends({
        method: method.toUpperCase()
      }, url));
    }
    throw new Error('params error; need (url, data, opts) or (setting)');
  };
});

exports.fetchAPI = fetchAPI;
var createFetchAPI = exports.createFetchAPI = function createFetchAPI(_ref3) {
  var checkStatus = _ref3.checkStatus,
      parseJSON = _ref3.parseJSON,
      middlewares = _ref3.middlewares;
  return function (opts) {
    if (!(middlewares instanceof Array)) {
      middlewares = [middlewares];
    }
    return fetchAPI(opts, { checkStatus: checkStatus, parseJSON: parseJSON, middlewares: middlewares });
  };
};

// default fetch
exports.fetch = _isomorphicFetch2.default;