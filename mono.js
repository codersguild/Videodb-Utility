var mono = (typeof mono !== 'undefined') ? mono : undefined;

(function(base, factory) {
  "use strict";
  if (mono && mono.isLoaded) {
    return;
  }

  var _mono = mono;
  var fn = function (addon) {
    return factory(_mono, addon);
  };

  if (typeof window !== "undefined") {
    mono = base(fn);
    return;
  }

}(
function base(factory) {
  if (['interactive', 'complete'].indexOf(document.readyState) !== -1) {
    return factory();
  }

  var base = {
    isLoaded: true,
    onReadyStack: [],
    onReady: function() {
      base.onReadyStack.push([this, arguments]);
    },
    loadModuleStack: [],
    loadModule: function() {
      base.loadModuleStack.push([this, arguments]);
    }
  };

  var onLoad = function() {
    document.removeEventListener('DOMContentLoaded', onLoad, false);
    window.removeEventListener('load', onLoad, false);

    mono = factory();

    var item;
    while (item = base.onReadyStack.shift()) {
      mono.onReady.apply(item[0], item[1]);
    }

    while (item = base.loadModuleStack.shift()) {
      mono.loadModule.apply(item[0], item[1]);
    }
  };

  document.addEventListener('DOMContentLoaded', onLoad, false);
  window.addEventListener('load', onLoad, false);

  return base;
},
function initMono(_mono, _addon) {

  var browserApi = function() {
    "use strict";
    var isInject = location.protocol !== 'chrome-extension:' || location.host !== chrome.runtime.id;
    var isBgPage = false;
    !isInject && (function () {
      isBgPage = location.pathname.indexOf('_generated_background_page.html') !== -1;
      if (!isBgPage && chrome.runtime.hasOwnProperty('getBackgroundPage')) {
        try {
          chrome.runtime.getBackgroundPage(function (bgWin) {
            isBgPage = bgWin === window;
          });
        } catch (e) {}
      }
    })();

    var emptyFn = function() {};

    /**
     * @param {Function} fn
     * @returns {Function}
     */
    var onceFn = function(fn) {
      return function(msg) {
        if (fn) {
          fn(msg);
          fn = null;
        }
      };
    };

    /**
     * @returns {Number}
     */
    var getTime = function () {
      return parseInt(Date.now() / 1000);
    };

    var msgTools = {
      id: 0,
      idPrefix: Math.floor(Math.random() * 1000),
      /**
       * @returns {String}
       */
      getId: function() {
        return this.idPrefix + '_' + (++this.id);
      },
      /**
       * @typedef {Object} Sender
       * @property {Object} [tab]
       * @property {number} tab.callbackId
       * @property {number} [frameId]
       */
      /**
       * @param {string} id
       * @param {Sender} sender
       * @returns {Function}
       */
      asyncSendResponse: function(id, sender) {
        return function(message) {
          message.responseId = id;

          if (sender.tab && sender.tab.id >= 0) {
            if (sender.frameId !== undefined) {
              chrome.tabs.sendMessage(sender.tab.id, message, {
                frameId: sender.frameId
              });
            } else {
              chrome.tabs.sendMessage(sender.tab.id, message);
            }
          } else {
            chrome.runtime.sendMessage(message);
          }
        };
      },
      listenerList: [],
      /**
       * @typedef {Object} MonoMsg
       * @property {boolean} mono
       * @property {string} [hook]
       * @property {string} idPrefix
       * @property {string} [callbackId]
       * @property {boolean} [async]
       * @property {boolean} isBgPage
       * @property {string} [responseId]
       * @property {boolean} hasCallback
       * @property {*} data
       */
      /**
       * @param {MonoMsg} message
       * @param {Sender} sender
       * @param {Function} _sendResponse
       */
      listener: function(message, sender, _sendResponse) {
        var _this = msgTools;
        var sendResponse = null;
        if (message && message.mono && !message.responseId && message.idPrefix !== _this.idPrefix && message.isBgPage !== isBgPage) {
          if (message.hook === 'pageReady') {
            return onPageReady(message.data, sender);
          }

          if (!message.hasCallback) {
            sendResponse = emptyFn;
          } else {
            sendResponse = _this.asyncSendResponse(message.callbackId, sender);
          }

          var responseFn = onceFn(function(msg) {
            var message = _this.wrap(msg);
            sendResponse(message);
            sendResponse = null;
          });

          _this.listenerList.forEach(function(fn) {
            if (message.hook === fn.hook) {
              fn(message.data, responseFn);
            }
          });
        }
      },
      async: {},
      /**
       *
       * @param {MonoMsg} message
       * @param {Sender} sender
       * @param {Function} sendResponse
       */
      asyncListener: function(message, sender, sendResponse) {
        var _this = msgTools;
        if (message && message.mono && message.responseId && message.idPrefix !== _this.idPrefix && message.isBgPage !== isBgPage) {
          var item = _this.async[message.responseId];
          var fn = item && item.fn;
          if (fn) {
            delete _this.async[message.responseId];
            if (!Object.keys(_this.async).length) {
              chrome.runtime.onMessage.removeListener(_this.asyncListener);
            }

            fn(message.data);
          }
        }

        _this.gc();
      },
      /**
       * @param {*} [msg]
       * @returns {MonoMsg}
       */
      wrap: function(msg) {
        return {
          mono: true,
          data: msg,
          idPrefix: this.idPrefix,
          isBgPage: isBgPage
        };
      },
      /**
       * @param {string} id
       * @param {Function} responseCallback
       */
      wait: function(id, responseCallback) {
        this.async[id] = {
          fn: responseCallback,
          time: getTime()
        };

        if (!chrome.runtime.onMessage.hasListener(this.asyncListener)) {
          chrome.runtime.onMessage.addListener(this.asyncListener);
        }

        this.gc();
      },
      gcTimeout: 0,
      gc: function () {
        var now = getTime();
        if (this.gcTimeout < now) {
          var expire = 180;
          var async = this.async;
          this.gcTimeout = now + expire;
          Object.keys(async).forEach(function (responseId) {
            if (async[responseId].time + expire < now) {
              delete async[responseId];
            }
          });

          if (!Object.keys(async).length) {
            chrome.runtime.onMessage.removeListener(this.asyncListener);
          }
        }
      }
    };

    var api = {
      isChrome: true,
      /**
       * @param {*} msg
       * @param {Function} [responseCallback]
       */
      sendMessageToActiveTab: function(msg, responseCallback) {
        var message = msgTools.wrap(msg);

        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, function(tabs) {
          var tabId = tabs[0] && tabs[0].id;
          if (tabId >= 0) {
            var hasCallback = !!responseCallback;
            message.hasCallback = hasCallback;
            if (hasCallback) {
              message.callbackId = msgTools.getId();
              msgTools.wait(message.callbackId, responseCallback);
            }

            chrome.tabs.sendMessage(tabId, message, emptyFn);
          }
        });
      },
      /**
       * @param {*} msg
       * @param {Function} [responseCallback]
       * @param {String} [hook]
       */
      sendMessage: function(msg, responseCallback, hook) {
        var message = msgTools.wrap(msg);
        hook && (message.hook = hook);

        var hasCallback = !!responseCallback;
        message.hasCallback = hasCallback;
        if (hasCallback) {
          message.callbackId = msgTools.getId();
          msgTools.wait(message.callbackId, responseCallback);
        }

        chrome.runtime.sendMessage(message, emptyFn);
      },
      onMessage: {
        /**
         * @param {Function} callback
         * @param {Object} [details]
         */
        addListener: function(callback, details) {
          details = details || {};
          details.hook && (callback.hook = details.hook);

          if (msgTools.listenerList.indexOf(callback) === -1) {
            msgTools.listenerList.push(callback);
          }

          if (!chrome.runtime.onMessage.hasListener(msgTools.listener)) {
            chrome.runtime.onMessage.addListener(msgTools.listener);
          }
        },
        /**
         * @param {Function} callback
         */
        removeListener: function(callback) {
          var pos = msgTools.listenerList.indexOf(callback);
          if (pos !== -1) {
            msgTools.listenerList.splice(pos, 1);
          }

          if (!msgTools.listenerList.length) {
            chrome.runtime.onMessage.removeListener(msgTools.listener);
          }
        }
      }
    };

    var initChromeStorage = function() {
      return {
        /**
         * @param {String|[String]|Object|null|undefined} [keys]
         * @param {Function} callback
         */
        get: function(keys, callback) {
          chrome.storage.local.get(keys, callback);
        },
        /**
         * @param {Object} items
         * @param {Function} [callback]
         */
        set: function(items, callback) {
          chrome.storage.local.set(items, callback);
        },
        /**
         * @param {String|[String]} [keys]
         * @param {Function} [callback]
         */
        remove: function(keys, callback) {
          chrome.storage.local.remove(keys, callback);
        },
        /**
         * @param {Function} [callback]
         */
        clear: function(callback) {
          chrome.storage.local.clear(callback);
        }
      };
    };
    var initLocalStorage = function(isInject) {
      var externalStorage = function() {
        return {
          /**
           * @param {String|[String]|Object|null|undefined} [keys]
           * @param {Function} callback
           */
          get: function(keys, callback) {
            if (keys === undefined) {
              keys = null;
            }
            return api.sendMessage({
              get: keys
            }, callback, 'storage');
          },
          /**
           * @param {Object} items
           * @param {Function} [callback]
           */
          set: function(items, callback) {
            return api.sendMessage({
              set: items
            }, callback, 'storage');
          },
          /**
           * @param {String|[String]} [keys]
           * @param {Function} [callback]
           */
          remove: function(keys, callback) {
            return api.sendMessage({
              remove: keys
            }, callback, 'storage');
          },
          /**
           * @param {Function} [callback]
           */
          clear: function(callback) {
            return api.sendMessage({
              clear: true
            }, callback, 'storage');
          }
        };
      };

      var wrapLocalStorage = function() {
        var readOldItem = (function () {
          var chunkItem = 'monoChunk';
          var chunkPrefix = 'mCh_';

          var getObj = function (key) {
            var index = 0;
            var keyPrefix = chunkPrefix + key;
            var chunk = localStorage.getItem(keyPrefix + index);
            var data = '';
            while (chunk) {
              data += chunk;
              index++;
              chunk = localStorage.getItem(keyPrefix + index);
            }
            var result = undefined;
            try {
              result = JSON.parse(data);
            } catch (e) {}
            return result;
          };

          return function (value, key) {
            var result = undefined;
            if (value === chunkItem) {
              result = getObj(key);
            } else
            if (typeof value === 'string') {
              var type = localStorage.getItem('_keyType_' + key);
              if (type === 'boolean') {
                result = value === 'true';
              } else
              if (type === 'string') {
                result = value;
              } else {
                result = parseFloat(value);
                if (isNaN(result)) {
                  result = undefined;
                }
              }
            }
            return result;
          };
        })();

        var jsonRe = /^{(?:"w":.+|)}$/;
        var readItem = function(value, key) {
          if (!jsonRe.test(value)) {
            return readOldItem(value, key);
          }

          var result = undefined;
          if (typeof value === 'string') {
            try {
              result = JSON.parse(value).w;
            } catch (e) {
              console.error('localStorage item read error!', e, value);
            }
          }
          return result;
        };

        var writeItem = function(value) {
          return JSON.stringify({
            w: value
          });
        };

        var storage = {
          /**
           * @param {String|[String]|Object|null|undefined} [keys]
           * @param {Function} callback
           */
          get: function(keys, callback) {
            var items = {};
            var defaultItems = {};

            var _keys = [];
            if (keys === undefined || keys === null) {
              _keys = Object.keys(localStorage);
            } else
            if (Array.isArray(keys)) {
              _keys = keys;
            } else
            if (typeof keys === 'object') {
              _keys = Object.keys(keys);
              defaultItems = keys;
            } else {
              _keys = [keys];
            }

            _keys.forEach(function(key) {
              var value = readItem(localStorage.getItem(key), key);
              if (value === undefined) {
                value = defaultItems[key];
              }
              if (value !== undefined) {
                items[key] = value;
              }
            });

            setTimeout(function() {
              callback(items);
            }, 0);
          },
          /**
           * @param {Object} items
           * @param {Function} [callback]
           */
          set: function(items, callback) {
            Object.keys(items).forEach(function(key) {
              if (items[key] !== undefined) {
                localStorage.setItem(key, writeItem(items[key]));
              }
            });

            callback && setTimeout(function() {
              callback();
            }, 0);
          },
          /**
           * @param {String|[String]} [keys]
           * @param {Function} [callback]
           */
          remove: function(keys, callback) {
            var _keys = [];
            if (Array.isArray(keys)) {
              _keys = keys;
            } else {
              _keys = [keys];
            }

            _keys.forEach(function(key) {
              localStorage.removeItem(key);
            });

            callback && setTimeout(function() {
              callback();
            }, 0);
          },
          /**
           * @param {Function} [callback]
           */
          clear: function(callback) {
            localStorage.clear();

            callback && setTimeout(function() {
              callback();
            }, 0);
          }
        };

        api.onMessage.addListener(function(msg, response) {
          if (msg) {
            if (msg.get !== undefined) {
              storage.get(msg.get, response);
            } else
            if (msg.set !== undefined) {
              storage.set(msg.set, response);
            } else
            if (msg.remove !== undefined) {
              storage.remove(msg.remove, response);
            } else
            if (msg.clear !== undefined) {
              storage.clear(response);
            }
          }
        }, {
          hook: 'storage'
        });

        return storage;
      };

      if (isInject) {
        return externalStorage();
      } else {
        return wrapLocalStorage();
      }
    };
    if (chrome.storage) {
      api.storage = initChromeStorage();
    } else {
      api.storage = initLocalStorage(isInject);
    }

    var onPageReady = function (msg, sender) {
      if (msg.url === sender.tab.url) {
        api._openTab(sender.tab);
      }
    };

    var _navigator = null;
    /**
     * @returns {{language: String, platform: String, userAgent: String}}
     */
    api.getNavigator = function () {
      if (_navigator) {
        return _navigator;
      }

      _navigator = {};
      ['language', 'platform', 'userAgent'].forEach(function(key) {
        _navigator[key] = navigator[key] || '';
      });

      return _navigator;
    };

    (function checkCompatibility() {
      var ua = api.getNavigator().userAgent;
      var m = /Chrome\/(\d+)/.exec(ua);
      if (m) {
        var version = parseInt(m[1]);
        api.isChromeVersion = version;
        if (version < 31) {
          api.noMouseEnter = true;
        }
      }
      m = /Mobile Safari\/(\d+)/.exec(ua);
      if (m) {
        api.isChromeMobile = true;
      }
    })();

    /**
     * @param {string} url
     * @param {boolean} [active]
     */
    api.openTab = function (url, active) {
      active = (active === undefined) ? true : !!active;
      return chrome.tabs.create({
        url: url,
        active: active
      });
    };

    /**
     * @param {Function} cb
     */
    api.getActiveTabUrl = function (cb) {
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var tab = tabs[0];
        return cb(tab && tab.url || '');
      });
    };

    /**
     * @param {Function} cb
     * @param {number} [delay]
     * @returns {number}
     */
    api.setTimeout = function (cb, delay) {
      return setTimeout(cb, delay);
    };

    /**
     * @param {number} timeout
     */
    api.clearTimeout = function(timeout) {
      return clearTimeout(timeout);
    };

    /**
     * @returns {string}
     */
    api.getVersion = function () {
      return chrome.runtime.getManifest().version;
    };

    /**
     * @param {String} locale
     * @param {Function} cb
     */
    api.getLanguage = function (locale, cb) {
      var convert = function(messages) {
        var language = {};
        for (var key in messages) {
          if (messages.hasOwnProperty(key)) {
            language[key] = messages[key].message;
          }
        }
        return language;
      };

      var url = '_locales/{locale}/messages.json';

      mono.request({
        url: url.replace('{locale}', locale),
        json: true
      }, function(err, resp, json) {
        if (err) {
          cb(err);
        } else {
          cb(null, convert(json));
        }
      });
    };

    api.getLoadedLocale = function () {
      return chrome.i18n.getMessage('lang');
    };

    (function (api) {
      var listeners = [];
      api._openTab = function (tab) {
        for (var i = 0, callback;callback = listeners[i]; i++) {
          callback(tab);
        }
      };
      /**
       * @param {Function} listener
       */
      api.tabsAddListener = function (listener) {
        if (listeners.indexOf(listener) === -1) {
          listeners.push(listener);
        }
      };
      /**
       * @param {Function} listener
       */
      api.tabsRemoveListener = function (listener) {
        var pos = listeners.indexOf(listener);
        if (pos !== -1) {
          listeners.splice(pos, 1);
        }
      };
      /**
       * @param {Object} tab
       * @param {Object} details
       * @param {[String]} details.files
       */
      api.executeScripts = function (tab, details) {
        for (var i = 0, file; file = details.files[i]; i++) {
          chrome.tabs.executeScript(tab.id, {file: file, runAt: 'document_end'});
        }
      };
      /**
       * @param {Function} callback
       */
      api.getActiveTab = function (callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
          var tab = tabs[0];
          callback(tab);
        });
      };
    })(api);

    return {
      api: api
    };
  };

  var mono = browserApi(_addon).api;
  mono.isLoaded = true;
  mono.onReady = function(cb) {
    return cb();
  };

  //> utils

  /**
   * @param {string} head
   * @returns {Object}
   */
  mono.parseXhrHeader = function(head) {
    head = head.split(/\r?\n/);
    var headers = {};
    head.forEach(function(line) {
      "use strict";
      var sep = line.indexOf(':');
      if (sep === -1) {
        return;
      }
      var key = line.substr(0, sep).trim().toLowerCase();
      var value = line.substr(sep + 1).trim();
      headers[key] = value;
    });
    return headers;
  };

  /**
   * @typedef {Object|string} requestDetails
   * @property {string} url
   * @property {string} [method] GET|POST
   * @property {string} [type] GET|POST
   * @property {string} [data]
   * @property {boolean} [cache]
   * @property {Object} [headers]
   * @property {string} [contentType]
   * @property {boolean} [json]
   * @property {boolean} [xml]
   * @property {number} [timeout]
   * @property {string} [mimeType]
   * @property {boolean} [withCredentials]
   * @property {boolean} [localXHR]
   */
  /**
   * @callback requestResponse
   * @param {string|null} err
   * @param {Object} res
   * @param {string|Object|Array} data
   */
  /**
   * @param {requestDetails} obj
   * @param {requestResponse} [origCb]
   * @returns {{abort: function}}
   */
  mono.request = function(obj, origCb) {
    "use strict";
    var result = {};
    var cb = function(e, body) {
      cb = null;
      if (request.timeoutTimer) {
        mono.clearTimeout(request.timeoutTimer);
      }

      var err = null;
      if (e) {
        err = String(e.message || e) || 'ERROR';
      }
      origCb && origCb(err, getResponse(body), body);
    };

    var getResponse = function(body) {
      var response = {};

      response.statusCode = xhr.status;
      response.statusText = xhr.statusText;

      var headers = null;
      var allHeaders = xhr.getAllResponseHeaders();
      if (typeof allHeaders === 'string') {
        headers = mono.parseXhrHeader(allHeaders);
      }
      response.headers = headers || {};

      response.body = body;

      return response;
    };

    if (typeof obj !== 'object') {
      obj = {url: obj};
    }

    var url = obj.url;

    var method = obj.method || obj.type || 'GET';
    method = method.toUpperCase();

    var data = obj.data;
    if (typeof data !== "string") {
      data = mono.param(data);
    }

    if (data && method === 'GET') {
      url += (/\?/.test(url) ? '&' : '?') + data;
      data = undefined;
    }

    if (obj.cache === false && ['GET','HEAD'].indexOf(method) !== -1) {
      url += (/\?/.test(url) ? '&' : '?') + '_=' + Date.now();
    }

    obj.headers = obj.headers || {};

    if (data) {
      obj.headers["Content-Type"] = obj.contentType || obj.headers["Content-Type"] || 'application/x-www-form-urlencoded; charset=UTF-8';
    }

    var request = {};
    request.url = url;
    request.method = method;

    data && (request.data = data);
    obj.json && (request.json = true);
    obj.xml && (request.xml = true);
    obj.timeout && (request.timeout = obj.timeout);
    obj.mimeType && (request.mimeType = obj.mimeType);
    obj.withCredentials && (request.withCredentials = true);
    Object.keys(obj.headers).length && (request.headers = obj.headers);

    if (request.timeout > 0) {
      request.timeoutTimer = mono.setTimeout(function() {
        cb && cb(new Error('ETIMEDOUT'));
        xhr.abort();
      }, request.timeout);
    }

    var xhrSuccessStatus = {
      0: 200,
      1223: 204
    };

    var xhr = mono.request.getTransport(obj.localXHR);
    xhr.open(request.method, request.url, true);

    if (mono.isModule && request.xml) {
      request.mimeType = 'text/xml';
    }
    if (request.mimeType) {
      xhr.overrideMimeType(request.mimeType);
    }
    if (request.withCredentials) {
      xhr.withCredentials = true;
    }
    for (var key in request.headers) {
      xhr.setRequestHeader(key, request.headers[key]);
    }

    var readyCallback = xhr.onload = function() {
      var status = xhrSuccessStatus[xhr.status] || xhr.status;
      try {
        if (status >= 200 && status < 300 || status === 304) {
          var body = xhr.responseText;
          if (request.json) {
            body = JSON.parse(body);
          } else
          if (request.xml) {
            if (mono.isModule) {
              body = xhr.responseXML;
            } else {
              body = (new DOMParser()).parseFromString(body, "text/xml");
            }
          } else
          if (typeof body !== 'string') {
            console.error('Response is not string!', body);
            throw new Error('Response is not string!');
          }
          return cb && cb(null, body);
        }
        throw new Error(xhr.status + ' ' + xhr.statusText);
      } catch (e) {
        return cb && cb(e);
      }
    };

    var errorCallback = xhr.onerror = function() {
      cb && cb(new Error(xhr.status + ' ' + xhr.statusText));
    };

    var stateChange = null;
    if (xhr.onabort !== undefined) {
      xhr.onabort = errorCallback;
    } else {
      stateChange = function () {
        if (xhr.readyState === 4) {
          cb && mono.setTimeout(function () {
            return errorCallback();
          });
        }
      };
    }

    if (mono.isSafari && mono.badXhrHeadRedirect && request.method === 'HEAD') {
      stateChange = (function(cb) {
        if (xhr.readyState > 1) {
          // Safari 5 on HEAD 302 redirect fix
          mono.setTimeout(function() {
            xhr.abort();
          });
          return readyCallback();
        }

        return cb && cb();
      }).bind(null, stateChange);
    }

    if (mono.isOpera && mono.badXhrRedirect) {
      stateChange = (function(cb) {
        if (xhr.readyState > 1 && (xhr.status === 302 || xhr.status === 0)) {
          // Opera 12 XHR redirect
          if (!obj._redirectCount) {
            obj._redirectCount = 0;
          }
          var location = xhr.getResponseHeader('Location');
          if (location && obj._redirectCount < 5) {
            obj._redirectCount++;
            var redirectObj = mono.extend({}, obj);
            redirectObj.url = location;

            cb = null;
            xhr.abort();
            var redirectRequest = mono.request(redirectObj, origCb);
            mono.extend(result, redirectRequest);
            return;
          }
        }

        return cb && cb();
      }).bind(null, stateChange);
    }

    if (stateChange) {
      xhr.onreadystatechange = stateChange;
    }

    try {
      xhr.send(request.data || null);
    } catch (e) {
      mono.setTimeout(function() {
        cb && cb(e);
      });
    }

    result.abort = function() {
      cb = null;
      xhr.abort();
    };

    return result;
  };

  mono.request.getTransport = function(localXHR) {
    if (mono.isModule) {
      return new (require('sdk/net/xhr').XMLHttpRequest)();
    }

    if (mono.isGM && !localXHR) {
      return new mono.request.gmTransport();
    }

    return new XMLHttpRequest();
  };

  mono.request.gmTransport = function() {
    "use strict";
    var _this = this;
    var gmXhr = null;

    var sync = function(type, gmResponse) {
      _this.readyState = gmResponse.readyState;
      _this.status = gmResponse.status;
      _this.statusText = gmResponse.statusText;
      if (typeof gmResponse.response === 'string') {
        _this.responseText = gmResponse.response;
      }
      if (gmResponse.responseText) {
        _this.responseText = gmResponse.responseText;
      }
      _this._responseHeaders = gmResponse.responseHeaders;

      _this.onreadystatechange && _this.onreadystatechange();

      _this[type] && _this[type]();
    };

    var gmDetails = {
      headers: {},
      responseType: 'text',
      onload: sync.bind(null, 'onload'),
      onerror: sync.bind(null, 'onerror'),
      onabort: sync.bind(null, 'onabort'),
      ontimeout: sync.bind(null, 'ontimeout')
    };

    this._responseHeaders = '';
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.response = '';
    this.responseType = '';
    this.responseURL = '';
    this.open = function(method, url) {
      gmDetails.method = method;
      gmDetails.url = url;
    };
    this.overrideMimeType = function(mimeType) {
      gmDetails.overrideMimeType = mimeType;
    };
    this.setRequestHeader = function(key, value) {
      gmDetails.headers[key] = value;
    };
    this.getResponseHeader = function(name) {
      if (!this._responseHeaders) {
        return null;
      }

      name = name.toLowerCase();
      if (!this.headers) {
        this.headers = mono.parseXhrHeader(this._responseHeaders);
      }
      if (!this.headers.hasOwnProperty(name)) {
        return null;
      }
      return this.headers[name];
    };
    this.getAllResponseHeaders = function() {
      return this._responseHeaders;
    };
    this.abort = function() {
      gmXhr && gmXhr.abort();
    };
    this.send = function(data) {
      gmDetails.data = data;
      gmXhr = GM_xmlhttpRequest(gmDetails);
    };
    this.onabort = null;
    this.onerror = null;
    this.onload = null;
    this.onreadystatechange = null;
    this.ontimeout = null;
  };

  mono.extend = function() {
    var obj = arguments[0];
    for (var i = 1, len = arguments.length; i < len; i++) {
      var item = arguments[i];
      for (var key in item) {
        if (item[key] !== undefined) {
          obj[key] = item[key];
        }
      }
    }
    return obj;
  };

  mono.extendPos = function() {
    var obj = arguments[0];
    for (var i = 1, len = arguments.length; i < len; i++) {
      var item = arguments[i];
      for (var key in item) {
        if (item[key] !== undefined) {
          delete obj[key];
          obj[key] = item[key];
        }
      }
    }
    return obj;
  };

  mono.param = function(obj) {
    if (typeof obj === 'string') {
      return obj;
    }
    var itemsList = [];
    for (var key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue;
      }
      if (obj[key] === undefined || obj[key] === null) {
        obj[key] = '';
      }
      itemsList.push(encodeURIComponent(key)+'='+encodeURIComponent(obj[key]));
    }
    return itemsList.join('&');
  };

  mono.capitalize = function(word) {
    "use strict";
    return word.charAt(0).toUpperCase() + word.substr(1);
  };

  /**
   * @param {string|Element|DocumentFragment} tagName
   * @param {Object} obj
   * @returns {Element|DocumentFragment}
   */
  mono.create = function(tagName, obj) {
    "use strict";
    var el;
    var func;
    if (typeof tagName !== 'object') {
      el = document.createElement(tagName);
    } else {
      el = tagName;
    }
    for (var attr in obj) {
      var value = obj[attr];
      if (func = mono.create.hook[attr]) {
        func(el, value);
        continue;
      }
      el[attr] = value;
    }
    return el;
  };
  mono.create.hook = {
    text: function(el, value) {
      "use strict";
      el.textContent = value;
    },
    data: function(el, value) {
      "use strict";
      for (var item in value) {
        el.dataset[item] = value[item];
      }
    },
    class: function(el, value) {
      "use strict";
      if (Array.isArray(value)) {
        for (var i = 0, len = value.length; i < len; i++) {
          el.classList.add(value[i]);
        }
      } else {
        el.setAttribute('class', value);
      }
    },
    style: function(el, value) {
      "use strict";
      if (typeof value === 'object') {
        for (var item in value) {
          var key = item;
          if (key === 'float') {
            key = 'cssFloat';
          }
          var _value = value[item];
          if (Array.isArray(_value)) {
            for (var i = 0, len = _value.length; i < len; i++) {
              el.style[key] = _value[i];
            }
          } else {
            el.style[key] = _value;
          }
        }
      } else {
        el.setAttribute('style', value);
      }
    },
    append: function(el, value) {
      "use strict";
      if (!Array.isArray(value)) {
        value = [value];
      }
      for (var i = 0, len = value.length; i < len; i++) {
        var node = value[i];
        if (!node && node !== 0) {
          continue;
        }
        if (typeof node !== 'object') {
          node = document.createTextNode(node);
        }
        el.appendChild(node);
      }
    },
    on: function(el, eventList) {
      "use strict";
      if (typeof eventList[0] !== 'object') {
        eventList = [eventList];
      }
      for (var i = 0, len = eventList.length; i < len; i++) {
        var args = eventList[i];
        if (!Array.isArray(args)) {
          continue;
        }
        mono.on.apply(mono, [el].concat(args));
      }
    },
    one: function (el, eventList) {
      "use strict";
      if (typeof eventList[0] !== 'object') {
        eventList = [eventList];
      }
      for (var i = 0, len = eventList.length; i < len; i++) {
        var args = eventList[i];
        if (!Array.isArray(args)) {
          continue;
        }
        mono.one.apply(mono, [el].concat(args));
      }
    },
    onCreate: function(el, value) {
      "use strict";
      value.call(el, el);
    }
  };

  mono.parseTemplate = function(list, details) {
    details = details || {};

    if (typeof list === "string") {
      if (list[0] !== '[') {
        return document.createTextNode(list);
      }
      try {
        list = list.replace(/"/g, '\\u0022').replace(/\\'/g, '\\u0027').replace(/'/g, '"').replace(/([{,])\s*([a-zA-Z0-9]+):/g, '$1"$2":');
        list = JSON.parse(list);
      } catch (e) {
        return document.createTextNode(list);
      }
    }
    if (!Array.isArray(list)) {
      return document.createTextNode(list);
    }
    var fragment = details.fragment || document.createDocumentFragment();
    for (var i = 0, len = list.length; i < len; i++) {
      var item = list[i];
      if (typeof item === 'object') {
        for (var tagName in item) {
          var el = item[tagName];
          var append = el.append;
          delete el.append;
          var dEl;
          fragment.appendChild(dEl = mono.create(tagName, el));
          if (append !== undefined) {
            mono.parseTemplate(append, {
              fragment: dEl
            });
          }
        }
      } else {
        fragment.appendChild(document.createTextNode(item));
      }
    }
    return fragment;
  };

  mono.trigger = function(el, type, data) {
    if (data === undefined) {
      data = {};
    }
    if (data.bubbles === undefined) {
      data.bubbles = false;
    }
    if (data.cancelable === undefined) {
      data.cancelable = false;
    }
    var event = null;
    if (typeof MouseEvent === 'function'
      && ['click'].indexOf(type) !== -1) {
      event = new MouseEvent(type, data);
    } else {
      event = new CustomEvent(type, data);
    }
    el.dispatchEvent(event);
  };

  mono.urlPatternToStrRe = function(value) {
    "use strict";
    if (value === '<all_urls>') {
      return '^https?:\\/\\/.+$';
    }

    var m = value.match(/(\*|http|https|file|ftp):\/\/([^\/]+)(?:\/(.*))?/);
    if (!m) {
      throw new Error("Invalid url-pattern");
    }

    var scheme = m[1];
    if (scheme === '*') {
      scheme = 'https?';
    }

    var host = m[2];
    if (host === '*') {
      host = '.+';
    } else {
      host = mono.escapeRegex(host);
      host = host.replace(/^\\\*\\\./, '(?:[^\/]+\\.)?');
      host = host.replace(/\\\.\\\*$/g, '\\.[a-z\\.]{2,}');
    }

    var pattern = ['^', scheme, ':\\/\\/', host];

    var path = m[3];
    if (!path) {
      pattern.push('$');
    } else
    if (path === '*') {
      path = '(?:|\/.*)';
      pattern.push(path);
      pattern.push('$');
    } else
    if (path) {
      path = '\/' + path;
      path = mono.escapeRegex(path);
      path = path.replace(/\\\*/g, '.*');
      pattern.push(path);
      pattern.push('$');
    }

    return pattern.join('');
  };

  mono.isIframe = function() {
    if (mono.isFF) {
      return window.parent !== window;
    }
    return window.top !== window.self;
  };

  mono.loadModule = (function () {
    var moduleNameList = [];
    var moduleList = [];
    var loadedModuleList = [];

    var moduleLoad = function(data) {
      var hasActiveModule = false;

      var item, availFn, isAvailable, moduleName, fn;
      while (item = moduleList.shift()) {
        moduleName = item[0];
        fn = item[1];
        availFn = item[2];

        isAvailable = !availFn;
        try {
          !isAvailable && (isAvailable = availFn(data));
        } catch (e) {
          mono.error('Module available error!', e);
        }

        if (isAvailable) {
          loadedModuleList.push(moduleName);
          hasActiveModule = true;
          try {
            mono.debug('run module', moduleName, data);
            fn(moduleName, data);
          } catch (e) {
            mono.error('Module error!', e);
          }
        } else {
          mono.debug('unavailable', moduleName, data);
        }
      }

      // if (hasActiveModule && !mono.isGM) {
      //   mono.setExtensionSession();
      //   mono.userJsCheck();
      // }
    };

    var requestData = function() {
      "use strict";
      var limit = 20;

      var onceResponse = mono.onceFn(function (data) {
        getData = null;

        mono.global.language = data.getLanguage;
        mono.global.preference = data.getPreference;

        return moduleLoad(data);
      });

      var getData = function () {
        setTimeout(function () {
          limit--;
          if (limit < 0 || mono.isGM) {
            getData = null;
          }
          getData && getData();
        }, 250);

        mono.sendMessage(['getPreference', 'getLanguage'], onceResponse);
      };
      getData();
    };

    var loader = function(moduleName, cb, isAsyncAvailable, syncIsAvailable) {
      if (moduleNameList.indexOf(moduleName) === -1) {
        moduleNameList.push(moduleName);

        var isAvailable = !syncIsAvailable;
        try {
          !isAvailable && (isAvailable = syncIsAvailable());
        } catch (e) {
          mono.error('Module available error!', e);
        }

        if (isAvailable) {
          moduleList.push(arguments);
          if (moduleList.length === 1) {
            requestData();
          }
        } else {
          mono.debug('sync unavailable', moduleName);
        }
      } else {
        mono.debug('Module exists', moduleName);
      }
    };

    loader.moduleLoadedList = loadedModuleList;
    loader.moduleList = moduleList;

    return loader;
  })();

  mono.contains = function() {
    var rnative = /^[^{]+\{\s*\[native \w/;
    if (rnative.test(document.compareDocumentPosition) || rnative.test(document.contains)) {
      mono.contains = function(a, b) {
        // from Sizzle
        var adown = a.nodeType === 9 ? a.documentElement : a,
          bup = b && b.parentNode;
        return a === bup || !!( bup && bup.nodeType === 1 && (
            adown.contains ?
              adown.contains( bup ) :
            a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
          ));
      };
    } else {
      mono.contains = function(a, b) {
        if (b) {
          while (b = b.parentNode) {
            if (b === a) {
              return true;
            }
          }
        }
        return false;
      };
    }
    return mono.contains.apply(this, arguments);
  };
  (function() {
    "use strict";
    var getTwoElParent = function(a, b, parentList) {
      parentList.unshift(b);
      while (b = b.parentNode) {
        if (mono.contains(b, a)) {
          return b;
        }
        parentList.unshift(b);
      }
      return null;
    };
    var wrapEvent = function (origType, fixType, origEvent, capture) {
      return !capture ? function (event) {
        var related = event.relatedTarget;
        var target = this;
        if (!related || (related !== target && !mono.contains(target, related))) {
          origEvent.call(this, {
            type: origType,
            target: target,
            preventDefault: event.preventDefault,
            stopPropagation: event.stopPropagation
          });
        }
      } : function (event) {
        var related = event.relatedTarget;
        var target = event.target;
        var parentList = [];
        if (!related || mono.contains(related, target) || (related = getTwoElParent(related, target, parentList))) {
          if (parentList.length === 0) {
            while (target !== related) {
              parentList.unshift(target);
              target = target.parentNode;
            }
          }
          while (target = parentList.shift()) {
            origEvent.call(this, {
              type: origType,
              target: target,
              preventDefault: event.preventDefault,
              stopPropagation: event.stopPropagation
            });
          }
        }
      };
    };

    var functionMap = {
      key: 'fixEvent-',
      eventId: 0,
      replaceList: {},
      bindCount: {}
    };

    /**
     * @param {Node} el
     * @param {String} type
     * @param {Function} onEvent
     * @param {Boolean} [capture]
     */
    mono.on = function(el, type, onEvent, capture) {
      if (mono.noMouseEnter && ['mouseenter', 'mouseleave'].indexOf(type) !== -1) {
        var cacheEventKey = functionMap.key;
        var origEvent = onEvent;
        var origType = type;
        var origCapture = capture;

        if (type === 'mouseenter') {
          type = 'mouseover';
        } else
        if (type === 'mouseleave') {
          type = 'mouseout';
        }
        cacheEventKey += type;
        if (capture) {
          cacheEventKey += '-1';
          capture = false;
        }

        var eventId = origEvent[cacheEventKey];
        if (eventId === undefined) {
          eventId = functionMap.eventId++;
          origEvent[cacheEventKey] = eventId;

          onEvent = wrapEvent(origType, type, origEvent, origCapture);

          functionMap.replaceList[eventId] = onEvent;

          if (functionMap.bindCount[eventId] === undefined) {
            functionMap.bindCount[eventId] = 0;
          }
        } else {
          onEvent = functionMap.replaceList[eventId];
        }

        functionMap.bindCount[eventId]++;
      }

      el.addEventListener(type, onEvent, capture);
    };

    /**
     * @param {Node} el
     * @param {String} type
     * @param {Function} onEvent
     * @param {Boolean} [capture]
     */
    mono.off = function(el, type, onEvent, capture) {
      if (mono.noMouseEnter && ['mouseenter', 'mouseleave'].indexOf(type) !== -1) {
        var cacheEventKey = functionMap.key;
        if (type === 'mouseenter') {
          type = 'mouseover';
        } else
        if (type === 'mouseleave') {
          type = 'mouseout';
        }
        cacheEventKey += type;
        if (capture) {
          cacheEventKey += '-1';
          capture = false;
        }

        var eventId = onEvent[cacheEventKey];
        if (eventId !== undefined) {
          var origEvent = onEvent;
          onEvent = functionMap.replaceList[eventId];
          functionMap.bindCount[eventId]--;

          if (functionMap.bindCount[eventId] === 0) {
            delete origEvent[cacheEventKey];
            delete functionMap.replaceList[eventId];
            delete functionMap.bindCount[eventId];
          }
        }
      }

      el.removeEventListener(type, onEvent, capture);
    };

    /**
     * @param {Node} el
     * @param {String} type
     * @param {Function} onEvent
     * @param {Boolean} [capture]
     */
    mono.one = function(el, type, onEvent, capture) {
      var fnName = ['oneFn', type, !!capture].join('_');
      var fn = onEvent[fnName];
      if (!fn) {
        onEvent[fnName] = fn = function (e) {
          mono.off(this, type, fn, capture);
          onEvent.apply(this, arguments);
        }
      }
      mono.on(el, type, fn, capture);
      fnName = null;
      el = null;
    };
  }());

  mono.global = {};

  mono.initGlobal = function(cb) {
    if (!mono.isGM && mono.global.language && mono.global.preference) {
      return cb({getLanguage: mono.global.language, getPreference: mono.global.preference});
    }
    mono.sendMessage(['getLanguage', 'getPreference'], function(response) {
      mono.global.language = response.getLanguage;
      mono.global.preference = response.getPreference;
      cb(response);
    });
  };

  mono.getParentByClass = function(el, classList) {
    if (!Array.isArray(classList)) {
      classList = [classList];
    }

    for(var parent = el; parent; parent = parent.parentNode) {
      if (parent.nodeType !== 1) {
        return null;
      }
      for (var i = 0, className; className = classList[i]; i++) {
        if (parent.classList.contains(className)) {
          return parent;
        }
      }
    }

    return null;
  };

  /**
   * @param {string} url
   * @param {Object} [details]
   * @param {boolean} [details.params] Input params only [false]
   * @param {string} [details.sep] Separator [&]
   * @param {boolean} [details.noDecode] Disable decode keys [false]
   * @returns {{}}
   */
  mono.parseUrl = function(url, details) {
    details = details || {};
    var query = null;
    if (!details.params && /\?/.test(url)) {
      query = url.match(/[^\?]+\?(.+)/)[1];
    } else {
      query = url;
    }
    var separator = details.sep || '&';
    var dblParamList = query.split(separator);
    var params = {};
    for (var i = 0, len = dblParamList.length; i < len; i++) {
      var item = dblParamList[i];
      var keyValue = item.split('=');
      var key = keyValue[0];
      var value = keyValue[1] || '';
      if (!details.noDecode) {
        try {
          key = decodeURIComponent(key);
        } catch (err) {
          key = unescape(key);
        }
        try {
          params[key] = decodeURIComponent(value);
        } catch (err) {
          params[key] = unescape(value);
        }
      } else {
        params[key] = value;
      }
    }
    return params;
  };

  mono.throttle = function(fn, threshhold, scope) {
    threshhold = threshhold || 250;
    var last;
    var deferTimer;
    return function () {
      var context = scope || this;

      var now = Date.now();
      var args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        mono.clearTimeout(deferTimer);
        deferTimer = mono.setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
  };

  mono.debounce = function(fn, delay) {
    var timer = null;
    return function () {
      var context = this, args = arguments;
      mono.clearTimeout(timer);
      timer = mono.setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

  mono.getDomain = function(url, strip) {
    var m = /:\/\/(?:[^\/?#]*@)?([^:\/?#]+)/.exec(url);
    m = m && m[1];
    if (m) {
      if (strip) {
        m = m.replace(/^www\./, '');
      }
    }
    return m;
  };

  // legacy

  mono.getQueryString = function(query, key_prefix, key_suffix) {
    if(!query || typeof(query) != 'object')
      return '';

    if(key_prefix === undefined)
      key_prefix = '';

    if(key_suffix === undefined)
      key_suffix = '';

    var str = '';
    for(var key in query)
    {
      if(str.length)
        str += '&';

      if(query[key] instanceof Object)
      {
        if(!key_prefix)
          key_prefix = '';

        if(!key_suffix)
          key_suffix = '';

        str += mono.getQueryString(query[key], key_prefix + key + "[", "]" + key_suffix);
      }
      else
        str += key_prefix + escape(key) + key_suffix + '=' + escape(query[key]);
    }

    return str;
  };

  /**
   * @param {string} text
   * @returns {string}
   */
  mono.decodeUnicodeEscapeSequence = function(text) {
    try {
      return JSON.parse(JSON.stringify(text)
        .replace(mono.decodeUnicodeEscapeSequence.re, '$1'));
    } catch (e) {
      return text;
    }
  };
  mono.decodeUnicodeEscapeSequence.re = /\\(\\u[0-9a-f]{4})/g;

  mono.fileName = {
    maxLength: 80,

    rtrim: /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

    illegalRe: /[\/\?<>\\:\*\|~"]/g,

    controlRe: /[\x00-\x1f\x80-\x9f]/g,

    reservedRe: /^\.+/,

    trim: function(text) {
      return text.replace(this.rtrim, '');
    },

    partsRe: /^(.+)\.([a-z0-9]{1,4})$/i,

    getParts: function (name) {
      return name.match(this.partsRe);
    },

    specialChars: ('nbsp,iexcl,cent,pound,curren,yen,brvbar,sect,uml,copy,ordf,laquo,not,shy,reg,macr,deg,plusmn,sup2' +
    ',sup3,acute,micro,para,middot,cedil,sup1,ordm,raquo,frac14,frac12,frac34,iquest,Agrave,Aacute,Acirc,Atilde,Auml' +
    ',Aring,AElig,Ccedil,Egrave,Eacute,Ecirc,Euml,Igrave,Iacute,Icirc,Iuml,ETH,Ntilde,Ograve,Oacute,Ocirc,Otilde,Ouml' +
    ',times,Oslash,Ugrave,Uacute,Ucirc,Uuml,Yacute,THORN,szlig,agrave,aacute,acirc,atilde,auml,aring,aelig,ccedil' +
    ',egrave,eacute,ecirc,euml,igrave,iacute,icirc,iuml,eth,ntilde,ograve,oacute,ocirc,otilde,ouml,divide,oslash' +
    ',ugrave,uacute,ucirc,uuml,yacute,thorn,yuml').split(','),
    specialCharsList: [['amp','quot','lt','gt'], [38,34,60,62]],

    specialCharsRe: /&([^;]{2,6});/g,

    /**
     * @param {string} text
     * @returns {string}
     */
    decodeSpecialChars: function(text) {
      var _this = this;
      return text.replace(this.specialCharsRe, function(text, word) {
        var code = null;
        if (word[0] === '#') {
          code = parseInt(word.substr(1));
          if (isNaN(code)) {
            return '';
          }
          return String.fromCharCode(code);
        }

        var pos = _this.specialCharsList[0].indexOf(word);
        if (pos !== -1) {
          code = _this.specialCharsList[1][pos];
          return String.fromCharCode(code);
        }

        pos = _this.specialChars.indexOf(word);
        if (pos !== -1) {
          code = pos + 160;
          return String.fromCharCode(code);
        }

        return '';
      });
    },

    rnRe: /\r?\n/g,

    re1: /[\*\?"]/g,

    re2: /</g,

    re3: />/g,

    spaceRe: /[\s\t\uFEFF\xA0]+/g,

    dblRe: /(\.|!|\?|_|,|\-|:|\+){2,}/g,

    re4: /[\.,:;\/\-_\+=']$/g,

    /**
     * @param {string} name
     * @returns {string}
     */
    modify: function (name) {
      if (!name) {
        return '';
      }

      name = mono.decodeUnicodeEscapeSequence(name);

      try {
        name = decodeURIComponent(name);
      } catch (err) {
        name = unescape(name);
      }

      name = this.decodeSpecialChars(name);

      name = name.replace(this.rnRe, ' ');

      name = this.trim(name);

      name = name.replace(this.re1, '')
        .replace(this.re2, '(')
        .replace(this.re3, ')')
        .replace(this.spaceRe, ' ')
        .replace(this.dblRe, '$1')
        .replace(this.illegalRe, '_')
        .replace(this.controlRe, '')
        .replace(this.reservedRe, '')
        .replace(this.re4, '');

      if (name.length <= this.maxLength) {
        return name;
      }

      var parts = this.getParts(name);
      if (parts && parts.length == 3) {
        parts[1] = parts[1].substr(0, this.maxLength);
        return parts[1] + '.' + parts[2];
      }

      return name;
    }
  };
  /**
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  mono.getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  };
  /**
   * @param {string} dataName
   * @returns {string}
   */
  mono.dataAttr2Selector = function(dataName) {
    return 'data-'+dataName.replace(/[A-Z]/g, function(lit) {
        return '-'+lit.toLowerCase();
      });
  };
  /**
   * @param {Object} obj
   * @returns {boolean}
   */
  mono.isEmptyObject = function(obj) {
    for (var item in obj) {
      return false;
    }
    return true;
  };

  /**
   * @param {function} cb
   */
  mono.asyncCall = function(cb) {
    "use strict";
    mono.setTimeout(function () {
      cb();
    }, 0);
  };

  /**
   * @param {Function} cb
   * @param {Object} [scope]
   * @returns {Function}
   */
  mono.asyncFn = function (cb, scope) {
    return function () {
      var context = scope || this;
      var args = arguments;
      mono.setTimeout(function () {
        cb.apply(context, args);
      }, 0);
    };
  };

  /**
   * @param {Function} cb
   * @param {Object} [scope]
   * @returns {Function}
   */
  mono.onceFn = function (cb, scope) {
    return function () {
      if (cb) {
        var context = scope || this;
        cb.apply(context, arguments);
        cb = null;
      }
    };
  };

  /**
   * @param {Function} fn
   * @param {Number} [timeout]
   * @param {Function} alwaysCb
   * @param {Object} [scope]
   * @param {Function} [onTimeout]
   */
  mono.safeFn = function (fn, timeout, alwaysCb, scope, onTimeout) {
    if (typeof timeout === 'function') {
      onTimeout = scope;
      scope = alwaysCb;
      alwaysCb = timeout;
      timeout = 3000;
    }
    if (typeof scope === 'function') {
      onTimeout = scope;
      scope = null;
    }
    var timeoutId = null;
    var onceCb = mono.onceFn(function () {
      mono.clearTimeout(timeoutId);
      alwaysCb.apply(this, arguments);
    });

    return function () {
      var context = scope || this;
      var args = [].slice.call(arguments);

      var pos = args.indexOf(alwaysCb);
      if (pos !== -1) {
        args.splice(pos, 1, onceCb);
      }

      mono.setTimeout(function () {
        timeoutId = mono.setTimeout(function () {
          onceCb();
          onTimeout && onTimeout();
        }, timeout);
        fn.apply(context, args);
      }, 0);
    };
  };

  /**
   * @param {string} html
   * @param {RegExp|RegExp[]} match
   * @returns {string[]}
   */
  mono.getPageScript = function(html, match) {
    "use strict";
    if (match && !Array.isArray(match)) {
      match = [match];
    }
    var scriptList = [];
    html.replace(/<script(?:|\s[^>]+[^\/])>/g, function(text, offset) {
      offset += text.length;
      var endPos = html.indexOf('<\/script>', offset);
      if (endPos !== -1) {
        var content = html.substr(offset, endPos - offset);
        if (match) {
          match.every(function(r) {
            return r.test(content);
          }) && scriptList.push(content);
        } else {
          scriptList.push(content);
        }
      }
    });
    return scriptList;
  };

  /**
   * @param {string} html
   * @param {RegExp|RegExp[]} match
   * @returns {Object[]}
   */
  mono.findJson = function(html, match) {
    "use strict";
    if (match && !Array.isArray(match)) {
      match = [match];
    }
    var rawJson = [];
    var obj = {
      '{': 0,
      '[': 0
    };
    var map = {'}': '{', ']': '['};
    var jsonSymbols = /[{}\]\[":0-9.,-]/;
    var whiteSpace = /[\r\n\s\t]/;
    var jsonText = '';
    for (var i = 0, symbol; symbol = html[i]; i++) {
      if (symbol === '"') {
        var end = i;
        while (end !== -1 && (end === i || html[end - 1] === '\\')) {
          end = html.indexOf('"', end + 1);
        }
        if (end === -1) {
          end = html.length - 1;
        }
        jsonText += html.substr(i, end - i + 1);
        i = end;
        continue;
      }

      if (!jsonSymbols.test(symbol)) {
        if (symbol === 't' && html.substr(i, 4) === 'true') {
          jsonText += 'true';
          i+=3;
        } else
        if (symbol === 'f' && html.substr(i, 5) === 'false') {
          jsonText += 'false';
          i+=4;
        } else
        if (symbol === 'n' && html.substr(i, 4) === 'null') {
          jsonText += 'null';
          i+=3;
        } else
        if (!whiteSpace.test(symbol)) {
          obj['{'] = 0;
          obj['['] = 0;
          jsonText = '';
        }
        continue;
      }

      jsonText += symbol;

      if (symbol === '{' || symbol === '[') {
        if (!obj['{'] && !obj['[']) {
          jsonText = symbol;
        }
        obj[symbol]++;
      } else
      if (symbol === '}' || symbol === ']') {
        obj[map[symbol]]--;
        if (!obj['{'] && !obj['[']) {
          rawJson.push(jsonText);
        }
      }
    }
    var jsonList = [];
    for (var i = 0, item; item = rawJson[i]; i++) {
      if (item === '{}' || item === '[]') {
        continue;
      }
      try {
        if (match) {
          match.every(function(r) {
            return r.test(item);
          }) && jsonList.push(JSON.parse(item));
        } else {
          jsonList.push(JSON.parse(item));
        }
      } catch(e) {
        // console.log('bad json', item);
      }
    }
    return jsonList;
  };

  mono.findJsonString = function(html, match) {
    "use strict";
    if (match && !Array.isArray(match)) {
      match = [match];
    }

    var rawString = [];
    var lastPos = -1;
    var pos = -1;
    do {
      pos = html.indexOf('"', pos + 1);
      if (pos !== -1) {
        if (html[pos - 1] === '\\') {
          continue;
        }
        if (lastPos !== -1) {
          rawString.push(html.substr(lastPos, pos + 1 - lastPos));
          lastPos = -1;
        } else {
          lastPos = pos;
        }
      } else {
        lastPos = pos;
      }
    } while (pos !== -1);

    var stringList = [];
    for (var i = 0, item; item = rawString[i]; i++) {
      if (item === '""') {
        continue;
      }
      try {
        if (match) {
          match.every(function(r) {
            return r.test(item);
          }) && stringList.push(JSON.parse(item));
        } else {
          stringList.push(JSON.parse(item));
        }
      } catch(e) {
        // console.log('bad json', item);
      }
    }
    return stringList;
  };

  /**
   * @param {Object|Array} cssStyleObj
   * @param {string|Array} [parentSelector]
   * @returns {string}
   */
  mono.style2Text = function(cssStyleObj, parentSelector) {
    "use strict";
    var list = [];

    if (!Array.isArray(cssStyleObj)) {
      cssStyleObj = [cssStyleObj];
    }

    if (parentSelector && !Array.isArray(parentSelector)) {
      parentSelector = [parentSelector];
    }

    var styleToText = function(selectorArr, styleObj) {
      "use strict";
      var content = [];

      for (var item in styleObj) {
        var value = styleObj[item];

        if (item === 'cssFloat') {
          item = 'float';
        }

        var key = item.replace(/([A-Z])/g, function (text, letter) {
          return '-' + letter.toLowerCase();
        });

        content.push(key + ':' + value);
      }

      if (!content.length) {
        return '';
      } else {
        return [selectorArr.join(','), '{', content.join(';'), '}'].join('');
      }
    };

    var inheritSelector = function (section, selector) {
      if (!Array.isArray(selector)) {
        selector = [selector];
      }

      if (parentSelector) {
        var _selector = [];
        var join = (section.join || section.join === '') ? section.join : ' ';
        parentSelector.forEach(function(parentSelector) {
          selector.forEach(function(selector) {
            _selector.push(parentSelector + join + selector);
          });
        });
        selector = _selector;
      }

      return selector;
    };

    cssStyleObj.forEach(function(section) {
      var inhSelector = null;
      var media = section.media;
      var selector = section.selector;
      var style = section.style;
      var append = section.append;

      if (media && append) {
        list.push([media, '{', mono.style2Text(append, parentSelector), '}'].join(''));
      } else
      if (!selector && !style) {
        for (var key in section) {
          if (['append', 'join'].indexOf(key) !== -1) {
            continue;
          }
          selector = key;
          style = section[key];

          append = style.append;
          if (append) {
            delete style.append;
          }

          inhSelector = inheritSelector(section, selector);
          list.push(styleToText(inhSelector, style));

          if (append) {
            list.push(mono.style2Text(append, inhSelector));
          }
        }
      } else {
        inhSelector = inheritSelector(section, selector);
        list.push(styleToText(inhSelector, style));

        if (append) {
          list.push(mono.style2Text(append, inhSelector));
        }
      }
    });

    return list.join('');
  };

  mono.styleReset = {
    animation: "none 0s ease 0s 1 normal none running",
    backfaceVisibility: "visible",
    background: "transparent none repeat 0 0 / auto auto padding-box border-box scroll",
    border: "medium none currentColor",
    borderCollapse: "separate",
    borderImage: "none",
    borderRadius: "0",
    borderSpacing: "0",
    bottom: "auto",
    boxShadow: "none",
    boxSizing: "content-box",
    captionSide: "top",
    clear: "none",
    clip: "auto",
    color: "inherit",
    columns: "auto",
    columnCount: "auto",
    columnFill: "balance",
    columnGap: "normal",
    columnRule: "medium none currentColor",
    columnSpan: "1",
    columnWidth: "auto",
    content: "normal",
    counterIncrement: "none",
    counterReset: "none",
    cursor: "auto",
    direction: "ltr",
    display: "inline",
    emptyCells: "show",
    float: "none",
    font: "normal normal normal normal medium/normal inherit",
    height: "auto",
    hyphens: "none",
    left: "auto",
    letterSpacing: "normal",
    listStyle: "disc outside none",
    margin: "0",
    maxHeight: "none",
    maxWidth: "none",
    minHeight: "0",
    minWidth: "0",
    opacity: "1",
    orphans: "0",
    outline: "medium none invert",
    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible",
    padding: "0",
    pageBreakAfter: "auto",
    pageBreakBefore: "auto",
    pageBreakInside: "auto",
    perspective: "none",
    perspectiveOrigin: "50% 50%",
    position: "static",
    right: "auto",
    tabSize: "8",
    tableLayout: "auto",
    textAlign: "inherit",
    textAlignLast: "auto",
    textDecoration: "none solid currentColor",
    textIndent: "0",
    textShadow: "none",
    textTransform: "none",
    top: "auto",
    transform: "none",
    transformOrigin: "50% 50% 0",
    transformStyle: "flat",
    transition: "none 0s ease 0s",
    unicodeBidi: "normal",
    verticalAlign: "baseline",
    visibility: "visible",
    whiteSpace: "normal",
    widows: "0",
    width: "auto",
    wordSpacing: "normal",
    zIndex: "auto",
    all: "initial"
  };

  /**
   * @param {string} host
   * @param {Array} hostList
   * @returns {boolean}
   */
  mono.matchHost = function(host, hostList) {
    "use strict";
    var dotPos;
    while ((dotPos = host.indexOf('.')) !== -1) {
      if (hostList.indexOf(host) !== -1) {
        return true;
      }
      host = host.substr(dotPos + 1);
    }

    return false;
  };

  /**
   * @param {string} key
   * @param {Function} callback
   */
  mono.storage.getExpire = function (key, callback) {
    "use strict";
    var prefix = mono.storage.getExpire.prefix;
    var now = parseInt(Date.now() / 1000);
    var expireKey = key + prefix;
    return mono.storage.get([key, expireKey], function(storage) {
      var isExpire = storage[expireKey] === undefined || storage[expireKey] < now;
      var _storage = {};
      _storage[key] = storage[key];
      return callback(_storage, isExpire);
    });
  };

  mono.storage.getExpire.prefix = '_expire_';

  /**
   * @param {Object} storage
   * @param {number} time
   * @param {function} [callback]
   */
  mono.storage.setExpire = function (storage, time, callback) {
    "use strict";
    var prefix = mono.storage.getExpire.prefix;
    var now = parseInt(Date.now() / 1000);
    var setObj = {};
    for (var key in storage) {
      setObj[key] = storage[key];
      setObj[key + prefix] = now + time;
    }
    return mono.storage.set(setObj, function() {
      return callback && callback();
    });
  };

  mono.onRemoveClassName = 'ext-notify-on-remove';
  /**
   * @param {Element} node
   * @param {Function} event
   */
  mono.onRemoveEvent = function(node, event) {
    "use strict";
    node.classList.add(mono.onRemoveClassName);
    node.addEventListener('ext-removed', event);
  };
  /**
   * @param {Element} node
   */
  mono.onRemoveListener = function(node) {
    "use strict";
    mono.trigger(node, 'ext-removed');
  };
  /**
   * @param {Element} node
   * @param {Function} event
   */
  mono.offRemoveEvent = function(node, event) {
    "use strict";
    node.removeEventListener('ext-removed', event);
  };

  /**
   * @param {Node|Element} node
   * @param {string} selector
   * @returns {boolean}
   */
  mono.matches = function(node, selector) {
    "use strict";
    var el = document.createElement('div');
    if (typeof el.matches === 'function') {
      mono.matches = function(node, selector){
        return node.matches(selector);
      };
    } else
    if (typeof el.matchesSelector === 'function') {
      mono.matches = function(node, selector){
        return node.matchesSelector(selector);
      };
    } else
    if (typeof el.webkitMatchesSelector === 'function') {
      mono.matches = function(node, selector){
        return node.webkitMatchesSelector(selector);
      };
    } else
    if (typeof el.mozMatchesSelector === 'function') {
      mono.matches = function(node, selector){
        return node.mozMatchesSelector(selector);
      };
    } else
    if (typeof el.oMatchesSelector === 'function') {
      mono.matches = function(node, selector){
        return node.oMatchesSelector(selector);
      };
    } else
    if (typeof el.msMatchesSelector === 'function') {
      mono.matches = function(node, selector){
        return node.msMatchesSelector(selector);
      };
    } else {
      mono.matches = function (node, selector) {
        return false;
      };
    }
    el = null;

    return mono.matches.call(this, node, selector);
  };

  /**
   * @param {Element} node
   * @param {string} selector
   * @returns {Node|null}
   */
  mono.getParent = function(node, selector) {
    if (!node || node.nodeType !== 1) {
      return null;
    }

    if (mono.matches(node, selector)) {
      return node;
    }

    if (!mono.matches(node, selector + ' ' + node.tagName)) {
      return null;
    }

    node = node.parentNode;
    for(var parent = node; parent; parent = parent.parentNode) {
      if (parent.nodeType !== 1) {
        return null;
      }

      if(mono.matches(parent, selector)) {
        return parent;
      }
    }

    return null;
  };

  /**
   * @param {string} value
   * @returns {string}
   */
  mono.escapeRegex = function(value) {
    "use strict";
    return value.replace( /[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&" );
  };

  /**
   * @param {function} callback
   * @constructor
   */
  mono.AsyncList = function (callback) {
    var wait = 0;
    var ready = 0;
    var fired = false;
    this.ready = function (err) {
      if (fired) {
        return;
      }

      if (err) {
        fired = true;
        return callback(err);
      }

      ready++;
      if (wait === ready) {
        fired = true;
        return callback();
      }
    };
    this.wait = function () {
      wait++;
    };
  };

  /**
   * @param {*} msg
   * @param {string} [hook]
   * @returns {Promise}
   */
  mono.sendMessagePromise = function (msg, hook) {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      try {
        mono.sendMessage(msg, resolve, hook);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @param {String|[String]|Object|null|undefined} keys
   * @returns {Promise}
   */
  mono.storage.getPromise = function (keys) {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      try {
        mono.storage.get(keys, resolve);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @param {Object} items
   * @returns {Promise}
   */
  mono.storage.setPromise = function (items) {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      try {
        mono.storage.set(items, resolve);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @param {String|[String]} keys
   * @returns {Promise}
   */
  mono.storage.removePromise = function (keys) {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      try {
        mono.storage.remove(keys, resolve);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @returns {Promise}
   */
  mono.storage.clearPromise = function () {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      try {
        mono.storage.clear(resolve);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @param {requestDetails} obj
   * @returns {Promise}
   */
  mono.requestPromise = function (obj) {
    "use strict";
    return new mono.Promise(function (resolve, reject) {
      var always = function (err, resp, data) {
        if (err) {
          reject(err);
        } else {
          resolve(resp);
        }
      };

      try {
        mono.request(obj, always);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * @returns {Number}
   */
  mono.getTime = function () {
    return parseInt(Date.now() / 1000);
  };

  mono.debug = function () {
    if (mono.debugMode) {
      var args = [].slice.call(arguments);
      args.unshift('sf');
      if (mono.isEdge) {
        console.log.apply(console, args);
      } else
      if (mono.isFF) {
        console.error.apply(console, args);
      } else {
        console.trace.apply(console, args);
      }
    }
  };

  mono.error = function () {
    var args = [].slice.call(arguments);
    args.unshift('sf');
    console.error.apply(console, arguments);
  };

  _mono && (function(tmpMono) {
    "use strict";
    _mono = null;
    var args, list = tmpMono.loadModuleStack;
    if (list) {
      while (args = list.shift()) {
        // async
        mono.asyncFn(mono.loadModule).apply(mono, args);
      }
    }
  })(_mono);
  //<utils

  if (typeof Promise === 'function' &&
    typeof Promise.resolve === 'function' &&
    typeof Promise.reject === 'function'
  ) {
    mono.Promise = Promise;
  } else
  if (mono.isModule) {
    mono.Promise = require('sdk/core/promise').Promise;
  }

  !mono.Promise && (function () {
  // Use polyfill for setImmediate for performance gains
  var asap = (typeof setImmediate === 'function' && setImmediate) ||
    function (fn) {
      mono.setTimeout(fn, 0);
    };

  /**
   @license
   Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
   This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
   The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
   The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
   Code distributed by Google as part of the polymer project is also
   subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
   */
  // @url https://github.com/PolymerLabs/promise-polyfill
  // @version 1.0.0
  function MakePromise (asap) {
    function Promise(fn) {
      if (typeof this !== 'object' || typeof fn !== 'function') throw new TypeError();
      this._state = null;
      this._value = null;
      this._deferreds = []

      doResolve(fn, resolve.bind(this), reject.bind(this));
    }

    function handle(deferred) {
      var me = this;
      if (this._state === null) {
        this._deferreds.push(deferred);
        return
      }
      asap(function() {
        var cb = me._state ? deferred.onFulfilled : deferred.onRejected
        if (typeof cb !== 'function') {
          (me._state ? deferred.resolve : deferred.reject)(me._value);
          return;
        }
        var ret;
        try {
          ret = cb(me._value);
        }
        catch (e) {
          deferred.reject(e);
          return;
        }
        deferred.resolve(ret);
      })
    }

    function resolve(newValue) {
      try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
        if (newValue === this) throw new TypeError();
        if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
          var then = newValue.then;
          if (typeof then === 'function') {
            doResolve(then.bind(newValue), resolve.bind(this), reject.bind(this));
            return;
          }
        }
        this._state = true;
        this._value = newValue;
        finale.call(this);
      } catch (e) { reject.call(this, e); }
    }

    function reject(newValue) {
      this._state = false;
      this._value = newValue;
      finale.call(this);
    }

    function finale() {
      for (var i = 0, len = this._deferreds.length; i < len; i++) {
        handle.call(this, this._deferreds[i]);
      }
      this._deferreds = null;
    }

    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     *
     * Makes no guarantees about asynchrony.
     */
    function doResolve(fn, onFulfilled, onRejected) {
      var done = false;
      try {
        fn(function (value) {
          if (done) return;
          done = true;
          onFulfilled(value);
        }, function (reason) {
          if (done) return;
          done = true;
          onRejected(reason);
        })
      } catch (ex) {
        if (done) return;
        done = true;
        onRejected(ex);
      }
    }

    Promise.prototype['catch'] = function (onRejected) {
      return this.then(null, onRejected);
    };

    Promise.prototype.then = function(onFulfilled, onRejected) {
      var me = this;
      return new Promise(function(resolve, reject) {
        handle.call(me, {
          onFulfilled: onFulfilled,
          onRejected: onRejected,
          resolve: resolve,
          reject: reject
        });
      })
    };

    Promise.resolve = function (value) {
      if (value && typeof value === 'object' && value.constructor === Promise) {
        return value;
      }

      return new Promise(function (resolve) {
        resolve(value);
      });
    };

    Promise.reject = function (value) {
      return new Promise(function (resolve, reject) {
        reject(value);
      });
    };


    return Promise;
  }

  mono.Promise = MakePromise(asap);
})(mono);

(function (Promise) {
  Promise.all = Promise.all || function () {
      var args = Array.prototype.slice.call(arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : arguments);

      return new Promise(function (resolve, reject) {
        if (args.length === 0) return resolve([]);
        var remaining = args.length;
        function res(i, val) {
          try {
            if (val && (typeof val === 'object' || typeof val === 'function')) {
              var then = val.then;
              if (typeof then === 'function') {
                then.call(val, function (val) { res(i, val) }, reject);
                return;
              }
            }
            args[i] = val;
            if (--remaining === 0) {
              resolve(args);
            }
          } catch (ex) {
            reject(ex);
          }
        }
        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };

  Promise.race = Promise.race || function (values) {
      return new Promise(function (resolve, reject) {
        for(var i = 0, len = values.length; i < len; i++) {
          values[i].then(resolve, reject);
        }
      });
    };
})(mono.Promise);
//@insert

  return mono;
}
));
