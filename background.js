function userRateListener(message) {
	if (message.action == 'user_popup_rate') {
		window.localStorage.popupRate = message.value;
		chrome.runtime.onMessage.removeListener(userRateListener);
	}
}

if (!window.localStorage.popupRate) {
	chrome.runtime.onMessage.addListener(userRateListener);
}


/**
 * webRequest Listener
 */
chrome.webRequest.onHeadersReceived.addListener(function (info) {
	if (info.url.indexOf('player.vimeo.com') < 0) {
		return;
	}

	var headers = info.responseHeaders;
	var header, i;

	for (i = 0; i < headers.length; i++) {
		header = headers[i];
		if (header.name.toLowerCase() == 'content-security-policy') {

			header.value = header.value.replace(/img-src[^;]+;/, '').replace(/default-src[^;]+;/, '');
		}
	}

	return {responseHeaders: headers};

}, {
	urls: ["*://.vimeo.com/*"],
	types: ["main_frame"]
}, ["blocking", "responseHeaders"]);

var engine = {};

engine.varCache = {
	// helper name
	helperName: '',
	// extension version
	currentVersion: '',
	langList: ['en'],
	meta: {},
	isFirstrun: false,
	isUpgrade: false,
	uuid: ''
};

engine.extra = {};

engine.defaultPreferences = {
	version: '0',
	button: 1,
	lmFileHosting: 1,
	lmMediaHosting: 1,
	moduleVimeo: 1,
	moduleShowDownloadInfo: 1,
	ytHideFLV: 0,
	ytHideMP4: 0,
	ytHideWebM: 1,
	ytHide3GP: 1,
	ytHide3D: 1,
	ytHideMP4NoAudio: 1,
	ytHideAudio_MP4: 1,
	gmNativeDownload: 0,
	expIndex: 0,
	showTutorial: 0,
	showMp3Btn: 0
};

engine.preferences = {
	sfHelperName: '',
	country: '',
	downloads: undefined,
};

engine.preferenceMap = {
	vimeo: 'moduleVimeo',
};

engine.modules = {};
engine.utils = {};

engine.loader = (function () {
	var DEBUG = false;
	var waitList = [];
	var readyList = [];
	var run = function () {
		waitList.slice(0).forEach(function (obj) {
			var isReady = obj.nameList.every(function (name) {
				return readyList.indexOf(name) !== -1;
			});
			if (isReady) {
				var pos = waitList.indexOf(obj);
				if (pos !== -1) {
					waitList.splice(pos, 1);
					try {
						DEBUG && console.debug('Loader run', obj.nameList);
						obj.fn();
					} catch (e) {
						mono.error('Run error!', e);
					}
				}
			}
		});
	};
	/**
	 * @param {String} name
	 */
	var ready = function (name) {
		DEBUG && console.trace('Loader ready', name);
		readyList.push(name);
		run();
	};
	/**
	 * @param {String|String[]} nameList
	 * @param {Function} fn
	 */
	var when = function (nameList, fn) {
		DEBUG && console.trace('Loader when', nameList);
		if (!Array.isArray(nameList)) {
			nameList = [nameList];
		}
		waitList.push({
			nameList: nameList,
			fn: fn
		});
		run();
	};

	return {
		waitList: waitList,
		readyList: readyList,
		ready: ready,
		when: when
	}
})();

engine.events = (function () {
	var DEBUG = false;
	var listeners = {};
	var slice = [].slice;
	/**
	 * @param {string} event
	 * @param {...*} params
	 */
	var emit = function (event, params) {
		var args = slice.call(arguments).slice(1);
		var arr = listeners[event] || [];
		arr.slice(0).forEach(function (callback) {
			try {
				DEBUG && console.debug('Events emit', event);
				callback.apply(null, args);
			} catch (e) {
				mono.error('Emit error!', e);
			}
		});
	};
	/**
	 * @param {string} event
	 * @param {Function} callback
	 */
	var on = function (event, callback) {
		var arr = listeners[event];
		if (!listeners[event]) {
			arr = listeners[event] = [];
		}
		var pos = arr.indexOf(callback);
		if (pos === -1) {
			DEBUG && console.trace('Events on', event);
			arr.push(callback);
		}
	};
	/**
	 * @param {string} event
	 * @param {Function} callback
	 */
	var off = function (event, callback) {
		var arr = listeners[event] || [];
		var pos = arr.indexOf(callback);
		if (pos !== -1) {
			DEBUG && console.trace('Events off', event);
			arr.splice(pos, 1);
		}
	};
	/**
	 * @param {string} event
	 * @param {Function} callback
	 */
	var once = function (event, callback) {
		DEBUG && console.trace('Events once', event);
		var _callback = function () {
			off(event, callback);
			callback.apply(null, arguments);
		};
		on(event, _callback);
	};

	return {
		listeners: listeners,
		emit: emit,
		on: on,
		off: off,
		once: once
	}
})();

engine.getUuid = function () {
	"use strict";
	var varCache = engine.varCache;
	if (varCache.uuid) {
		return varCache.uuid;
	}

	var uuid = engine.generateUuid();
	varCache.uuid = uuid;
	mono.storage.set({uuid: uuid});
	return uuid;
};

engine.generateUuid = function () {
	"use strict";
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

/**
 * @returns {string}
 */
engine.getNavLanguage = function () {
	var language = '';
	var navLanguage = mono.getNavigator().language;
	if (/^\w{2}-|^\w{2}$/.test(navLanguage)) {
		language = navLanguage;
	}
	return language;
};

engine.loadLanguage = function (cb) {
	"use strict";
	var language = engine.language;
	var varCache = engine.varCache;
	var langList = varCache.langList;
	var defaultLocale = langList[0];
	var locale = mono.getLoadedLocale();
	if (!locale) {
		var navLanguage = engine.getNavLanguage().substr(0, 2).toLowerCase();
		if (langList.indexOf(navLanguage) !== -1) {
			locale = navLanguage;
		} else {
			locale = defaultLocale;
		}
	}

	(function getLanguage(locale, cb) {
		mono.getLanguage(locale, function (err, _language) {
			if (err) {
				if (locale !== defaultLocale) {
					getLanguage(defaultLocale, cb);
				} else {
					cb();
				}
			} else {
				mono.extend(language, _language);
				cb();
			}
		});
	})(locale, cb);
};

engine.language = {};

engine.gmShowButton = function (enabled) {
	if (enabled) {
		_menu.setTitle(engine.language.extName, engine.varCache.currentVersion);
		mono.storage.get('gmIconTop', function (storage) {
			if (storage.gmIconTop === 0 || storage.gmIconTop) {
				_menu.style.menu.initial.top = storage.gmIconTop + 'px';
			}
			_menu.create(1);
		});
	} else {
		_menu.hide();
	}
};

engine.forceMetaRequest = false;

engine.getMeta = (function () {
	"use strict";
	var varCache = engine.varCache;
	var defaultMeta = {};

	var currentDate = function () {
		var _date = new Date();
		var date = _date.getDate();
		var month = _date.getMonth() + 1;
		var cDate = '';

		cDate += date < 10 ? '0' + date : date;
		cDate += month < 10 ? '0' + month : month;
		cDate += _date.getFullYear();

		return cDate;
	};


	var getMeta = function (callback) {
		var onceCb = mono.onceFn(callback);
		var isExpire = engine.liteStorage.isExpire('metaExpire');
		var isTimeout = engine.liteStorage.isTimeout('metaTimeout');
		if (mono.isEmptyObject(engine.expList) && !engine.forceMetaRequest) {
			mono.debug('Meta not require');
			onceCb();
		} else if (varCache.isFirstrun || varCache.isUpgrade) {
			mono.debug('Meta force request');
			// requestMeta(function () {
			//   onceCb();
			// });
		} else if (isTimeout) {
			mono.debug('Meta timeout');
			onceCb();
		} else if (isExpire) {
			mono.debug('Meta is expire');
			// requestMeta(function () {
			//   onceCb();
			// });
		} else {
			mono.debug('Meta is fresh');
			onceCb();
		}
	};

	return getMeta;
})();

engine.loader.when('prepare', function () {
	var promise = mono.Promise.resolve();

	if (engine.liteStorage.get('fromId', 0)) {
		return promise;
	}

	if (mono.isGM && mono.isIframe()) {
		return promise;
	}

	promise = promise.then(function () {
		var isTimeout = engine.liteStorage.isTimeout('fromIdTimeout');
		if (isTimeout) {
			return mono.debug('Request fromId timeout');
		} else {
			engine.liteStorage.setTimeout('fromIdTimeout', 21600);
			// return requestFromId();
		}
	}).catch(function (err) {
		mono.error('Request fromId error', err);
	});

	return promise;
});

engine.loader.when('init', function () {
	"use strict";
	if (!mono.isSafari) {
		return;
	}

	safari.extension.settings.addEventListener('change', function (event) {
		if (event.key !== 'show_options') {
			return;
		}
		mono.openTab(safari.extension.baseURI + 'options.html', true);
	});

	var checkInterval = null;

	var removePopover = function () {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}

		safari.extension.toolbarItems.forEach(function (btn) {
			if (btn.popover) {
				if (btn.popover.visible) {
					btn.popover.hide();
				}
				btn.popover = null;
			}
		});

		safari.extension.removePopover('popup');
	};

	safari.application.addEventListener('command', function (e) {
		if (e.command === 'openPopup') {
			var currentBtn = null;
			var activeWindow = safari.application.activeBrowserWindow;
			safari.extension.toolbarItems.some(function (btn) {
				if (btn.browserWindow === activeWindow) {
					currentBtn = btn;
					return true;
				}
			});
			if (!currentBtn) {
				return;
			}

			if (currentBtn.popover && currentBtn.popover.visible) {
				currentBtn.popover.hide();
				return;
			}

			removePopover();

			currentBtn.popover = safari.extension.createPopover('popup', safari.extension.baseURI + 'popup.html', 482, 404);
			currentBtn.showPopover();

			checkInterval = setInterval(function () {
				var isShowMenu = safari.extension.toolbarItems.some(function (btn) {
					if (btn.popover && btn.popover.visible) {
						return true;
					}
				});
				if (!isShowMenu) {
					removePopover();
				}
			}, 1000 * 30);
		}
	}, false);
});

engine.onOptionChange = {
	button: function (enabled) {
		if (mono.isOpera) {
			// engine.operaShowButton(enabled);
		} else if (mono.isGM) {
			engine.gmShowButton(enabled);
		}
	},
	gmNativeDownload: function (value) {
		if (!mono.isGM) {
			return;
		}
		engine.preferences.downloads = !!value;
		if (mono.global.preference) {
			// GM only!
			mono.global.preference.downloads = engine.preferences.downloads;
		}
	}
};


engine.actionList = {
	getMenuDetails: function (msg, response) {
		"use strict";
		var getLastVersion = function () {
			var currentVersion = engine.varCache.currentVersion;
			var lastVersion = engine.liteStorage.get('lastVersion', '');
			if (!currentVersion || !lastVersion) {
				return '';
			}

			if (currentVersion.indexOf(lastVersion) === 0) {
				return currentVersion;
			} else {
				return lastVersion;
			}
		};

		var details = {
			language: engine.language,
			preferences: engine.preferences,
			version: engine.varCache.currentVersion,
			lastVersion: getLastVersion(),
			helperName: engine.varCache.helperName
		};

		return response(details);
	},
	getLanguage: function (message, cb) {
		cb(engine.language);
	},
	getPreference: function (message, cb) {
		var preferences = engine.preferences;
		if (mono.isSafari || mono.isGM) {
			preferences = mono.extend({}, engine.preferences);
		}

		cb(preferences);
	},
	updateOption: function (message) {
		var key = message.key;
		var value = message.value;
		var oldValue = engine.preferences[key];
		engine.preferences[key] = value;

		var obj = {};
		obj[key] = value;
		mono.storage.set(obj);

		if (engine.onOptionChange[key]) {
			engine.onOptionChange[key](value, oldValue);
		}
	},

	viaMenu_changeState: function (msg) {
		if (!Array.isArray(msg.prefKey)) {
			msg.prefKey = [msg.prefKey];
		}

		for (var i = 0, key; key = msg.prefKey[i]; i++) {
			engine.actionList.updateOption({key: key, value: msg.state});
		}

		if (msg.state && msg.moduleName === 'lm' && msg.needInclude) {
			if (mono.isChrome || mono.isFF) {
				return engine.tabListener.injectLmInActiveTab();
			}
		}

		mono.sendMessageToActiveTab({action: 'changeState', moduleName: msg.moduleName, state: msg.state});
	},
	showOptions: function () {
		if (mono.isGM) {
			return _options.show();
		}
		var url = 'options.html';
		if (mono.isFF) {
			url = require('sdk/self').data.url(url);
		} else if (mono.isSafari) {
			url = safari.extension.baseURI + url;
		}
		mono.openTab(url, true);
	},
	getActiveTabModuleInfo: function (msg, cb) {
		mono.sendMessageToActiveTab({action: 'getModuleInfo', url: msg.url}, function (moduleInfo) {
			cb(moduleInfo);
		});
	},
	getActiveTabUrl: function (message, cb) {
		mono.getActiveTabUrl(cb);
	},
	getActiveTabInfo: function (msg, cb) {
		var preferences = engine.preferences;
		mono.getActiveTabUrl(function (url) {
			if (url.indexOf('http') !== 0) {
				return cb();
			}

			var hostList = {};

			var moduleName = 'lm';
			var prefKey = ['lmFileHosting', 'lmMediaHosting'];
			var state = preferences.lmFileHosting || preferences.lmMediaHosting;

			for (var key in hostList) {
				var regList = hostList[key];
				var re = regList.map(function (pattern) {
					return mono.urlPatternToStrRe(pattern);
				}).join('|');
				re = new RegExp(re);

				if (re.test(url)) {
					moduleName = key;
					prefKey = engine.preferenceMap[moduleName];
					state = preferences[prefKey];
					break;
				}
			}

			return cb({moduleName: moduleName, prefKey: prefKey, url: url, state: state});
		});
	},
};

engine.onMessage = function (message, cb) {
	if (!engine.onMessage.ready) {
		engine.onMessage.stack.push(arguments);
		return;
	}

	var func;
	var action = message.action || message;
	if ((func = engine.actionList[action]) !== undefined) {
		return func.call(engine.actionList, message, cb);
	}

	for (var moduleName in engine.modules) {
		var module = engine.modules[moduleName];
		if ((func = module[action]) !== undefined) {
			return func.call(module, message, cb);
		}
	}

	if ((func = engine.utils[action]) !== undefined) {
		return func.call(engine.utils, message, cb);
	}
};
engine.onMessage.stack = [];
engine.onMessage.ready = false;

engine.loadSettings = function (cb) {
	var varCache = engine.varCache;
	var preferences = engine.preferences;
	var defaultPreferences = engine.defaultPreferences;

	if (mono.isGM) {
		defaultPreferences.button = 0;
	}

	var preload = {

	};

	var defPreferencesKeys = Object.keys(defaultPreferences);
	var preloadKeys = Object.keys(preload);
	return mono.storage.get(defPreferencesKeys.concat(preloadKeys), function (storage) {
		defPreferencesKeys.forEach(function (key) {
			var defaultValue = defaultPreferences[key];
			var value = storage[key];
			if (value === undefined) {
				value = defaultValue;
			}
			preferences[key] = value;
		});

		preloadKeys.forEach(function (key) {
			preload[key](storage[key]);
		});

		if (varCache.isFirstrun) {
			var tutorialStorage = {};
			if (engine.hasMenuTutorial) {
				preferences.showTutorial = 1;
			} else {
				preferences.showTutorial = 0;
			}
			tutorialStorage.showTutorial = preferences.showTutorial;
			mono.storage.set(tutorialStorage);
		}

		if (mono.isChrome) {
			if (mono.isChromeVersion < 31) {
				preferences.downloads = false;
			} else if (
				(chrome.downloads && chrome.downloads.download) ||
				(chrome.permissions && chrome.permissions.request)
			) {
				preferences.downloads = true;
			}
		}

		if (mono.isGM) {
			preferences.downloads = false;
			var hasDownloadApi = typeof GM_download !== 'undefined';
			var browserApiDownloadMode = false;
			if (hasDownloadApi) {
				browserApiDownloadMode = typeof GM_info !== 'undefined' && GM_info.downloadMode === 'browser';
			}
			if (hasDownloadApi && (preferences.gmNativeDownload || browserApiDownloadMode)) {
				preferences.gmNativeDownload = 1;
				preferences.downloads = true;
			}
		}

		if (mono.isFF && varCache.ffButton) {
			preferences.downloads = true;
		}

		if (preferences.downloads) {
			preferences.moduleShowDownloadInfo = 0;
		}

		return cb();
	});
};

engine.exp = (function () {
	var varCache = engine.varCache;
	var preferences = engine.preferences;
	var meta = varCache.meta;
	var list = engine.expList = {};
	/**
	 * @param {string} type
	 * @returns {number}
	 */
	var getExpIndex = function (type) {
		var result = 0;
		var value = 0;

		if (type === 'firstrun') {
			value = mono.getRandomInt(0, 100);

			for (var index in list) {
				var percent = list[index].percent;
				if (value < percent) {
					result = parseInt(index);
					break;
				} else {
					value -= percent;
				}
			}

		} else if (type === 'upgrade') {

		}

		return result;
	};
	var selectExp = function () {
		var metaExp = meta.exp || {};
		Object.keys(list).forEach(function (index) {
			var expItem = metaExp[index];
			if (!expItem || !expItem.enable) {
				delete list[index];
			} else {
				var item = list[index];
				if (item.isAvailable && !item.isAvailable(preferences, varCache)) {
					delete list[index];
				} else {
					list[index].percent = expItem.percent || 0;
				}
			}
		});

		var expIndex = preferences.expIndex;
		if (expIndex > 0 && !list[expIndex]) {
			expIndex = 0;
		}

		if (varCache.isFirstrun) {
			expIndex = getExpIndex('firstrun');
		} else if (varCache.isUpgrade && expIndex === 0) {
			expIndex = getExpIndex('upgrade');
		}

		setExpIndex(expIndex);
	};
	/**
	 * @param {number} index
	 */
	var setExpIndex = function (index) {
		if (preferences.expIndex !== index) {
			mono.debug('Set exp index', index);
			engine.actionList.updateOption({key: 'expIndex', value: index});
		}
	};
	var disable = function () {
		setExpIndex(0);
	};
	var cancel = function () {
		mono.debug('Cancel exp', preferences.expIndex);
		preferences.expIndex = 0;
	};
	/**
	 * @param {number} expIndex
	 */
	var load = function (expIndex) {
		mono.debug('Load exp', expIndex);
		try {
			list[expIndex](preferences, varCache);
		} catch (e) {
			mono.error('Load exp error!', expIndex, e);
		}
	};
	var run = function () {
		var expIndex = preferences.expIndex;
		if (expIndex > 0) {
			if (!list[expIndex]) {
				setExpIndex(0);
			} else if (meta.exp && meta.exp[expIndex] && meta.exp[expIndex].cancel) {
				cancel();
			} else {
				load(expIndex);
			}
		}
	};
	var init = function () {
		if (typeof EXP_INDEX === 'number') {
			mono.debug('Force exp index', EXP_INDEX);
			preferences.expIndex = EXP_INDEX;
			run();
		} else if (!varCache.isFirstrun && !varCache.isUpgrade) {
			run();
		} else if (!meta.exp || mono.isEmptyObject(list)) {
			setExpIndex(0);
		} else {
			selectExp();
			run();
		}
	};
	return {
		init: init,
		disable: disable
	}
})();

engine.prepare = function (cb) {
	"use strict";
	var varCache = engine.varCache;

	engine.loader.when(['loadLanguage', 'loadSettings', 'getHelperVersion'], function () {
		varCache.isUpgrade = !varCache.isFirstrun && engine.preferences.version !== varCache.currentVersion;

		engine.getMeta(function () {
			engine.exp.init();

			cb();
		});
	});

	engine.loadLanguage(function () {
		engine.loader.ready('loadLanguage');
	});

	engine.loadSettings(function () {
		engine.loader.ready('loadSettings');
	});

	var onGetVersion = function (version) {
		varCache.currentVersion = version || 'unknown';
		engine.loader.ready('getHelperVersion');
	};

	mono.safeFn(function (cb) {
		cb(mono.getVersion());
	}, onGetVersion, engine)(onGetVersion);
};

engine.msgListener = function (message, response) {
	if (!Array.isArray(message)) {
		return engine.onMessage(message, response);
	}

	var countWait = message.length;
	var countReady = 0;
	var resultList = {};
	var ready = function (key, data) {
		countReady += 1;
		resultList[key] = data;
		if (countWait === countReady) {
			response(resultList);
		}
	};
	message.forEach(function (msg) {
		engine.onMessage(msg, function (data) {
			ready(msg.action || msg, data);
		});
	});
};

engine.initMessageListener = function () {
	if (!engine.initMessageListener.fired) {
		engine.initMessageListener.fired = true;
		mono.onMessage.addListener(engine.msgListener, {isBg: true});
	}
};

engine.init = function () {
	engine.initMessageListener();

	var varCache = engine.varCache;
	var preferences = engine.preferences;

	var load = function () {
		var _navigator = mono.getNavigator();

		preferences.enableConverter = /^Win/.test(_navigator.platform) ? 1 : 0;
		if (!mono.isFF) {
			preferences.enableConverter = 0;
		}


		engine.loader.ready('init');

		engine.prepare(function () {
			engine.onMessage.ready = true;
			while (engine.onMessage.stack.length > 0) {
				mono.asyncFn(engine.onMessage).apply(null, engine.onMessage.stack.shift());
			}

			engine.loader.ready('prepare');
		});
	};

	var keys = ['uuid', 'version', 'meta', 'country'];
	keys.push(engine.liteStorage.getStorageKey());

	return mono.storage.get(keys, function (storage) {
		engine.liteStorage.setStorage(storage);

		if (typeof storage.uuid === 'string' && storage.uuid.length === 36) {
			varCache.uuid = storage.uuid;
		}
		if (!storage.version) {
			varCache.isFirstrun = true;
		}
		if (storage.meta) {
			mono.extend(varCache.meta, storage.meta);
		}
		if (storage.country) {
			preferences.country = storage.country;
		}

		return load();
	});
};

engine.moduleInit = function (addon, button, monoLib, extra) {
	engine.varCache.monoLib = monoLib;
	mono = mono.init(addon);
	var modules = engine.modules;
	engine.utils = require('./utils.js').init(mono, engine);
	engine.varCache.ffButton = button;

	mono.extend(engine.extra, extra);

	// engine.ffSovetnik = require('./sovetnik.lib.init.js');
	// engine.ffSovetnik.init(mono, engine);

	engine.loader.when('prepare', function () {
		"use strict";
		mono.setTimeout(function () {
			monoLib.serviceList.backupStorage();
		}, 500);
	});

	monoLib.serviceList.restoreStorage(null, function () {
		engine.init();
	});
};


engine.liteStorage = (function () {
	var storageKey = 'liteStorage';
	var store = {};
	/**
	 * @param {*} value
	 */
	var cloneObj = function (value) {
		return JSON.parse(JSON.stringify({w: value})).w;
	};
	/**
	 * @param {Function} cb
	 */
	var save = function (cb) {
		var obj = {};
		obj[storageKey] = store;
		return mono.storage.set(obj, cb);
	};
	var debounceSave = function () {
		mono.error('liteStorage is not set!');
	};
	/**
	 * @param {String} key
	 * @param {*} value
	 */
	var setValue = function (key, value) {
		if (store[key] !== value) {
			store[key] = value;
			debounceSave();
		}
	};
	/**
	 * @param {string} key
	 * @param {*} defaultValue
	 * @returns {*}
	 */
	var getValue = function (key, defaultValue) {
		var value = store[key];
		if (value === undefined) {
			value = defaultValue;
		}
		return cloneObj(value);
	};
	/**
	 * @returns {string}
	 */
	var getStorageKey = function () {
		return storageKey;
	};
	/**
	 * @param {Object} storage
	 */
	var setStorage = function (storage) {
		store = storage[storageKey] || {};
		debounceSave = mono.debounce(save, 100);
	};
	/**
	 * @param {string} key
	 * @param {number} time
	 */
	var setExpire = function (key, time) {
		return setValue(key, mono.getTime() + time);
	};
	/**
	 * @param {string} key
	 * @returns {boolean}
	 */
	var isTimeout = function (key) {
		return getValue(key, 0) > mono.getTime();
	};
	/**
	 * @param {string} key
	 * @returns {boolean}
	 */
	var isExpire = function (key) {
		return getValue(key, 0) < mono.getTime();
	};
	return {
		getStorageKey: getStorageKey,
		setStorage: setStorage,
		set: setValue,
		get: getValue,
		isTimeout: isTimeout,
		setTimeout: setExpire,
		isExpire: isExpire,
		setExpire: setExpire
	};
})();

engine.chromeNoStore = true;

engine.errorCatch = {
	onError: function (e) {
		"use strict";
		var filename = e.filename;
		var message = e.message;

		if (!filename || !message) {
			return;
		}

		filename = String(filename).match(/\/([^\/]+)$/);
		filename = filename && filename[1];
		if (!filename) {
			return;
		}

		if (e.lineno) {
			filename += ':' + e.lineno;
		}
	},
	enable: function () {
		"use strict";
		if (typeof window === 'undefined' || !window.addEventListener) {
			return;
		}

		window.addEventListener('error', this.onError);
	},
	disable: function () {
		"use strict";
		if (typeof window === 'undefined' || !window.addEventListener) {
			return;
		}

		window.removeEventListener('error', this.onError);
	}
};

(function () {
	"use strict";
	engine.errorCatch.enable();
})();
//@insert

if (mono.isModule) {
	exports.init = engine.moduleInit;
} else
	mono.onReady(function () {
		if (mono.isGM) {
			engine.initMessageListener();
		} else {
			engine.init();
		}
	});

