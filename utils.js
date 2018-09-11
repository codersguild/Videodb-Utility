var bg_utils = {
	getFileSize: function (message, cb) {

		"use strict";
		var url = message.url;
		var response = {
			fileSize: 0,
			fileType: '',
			status: 0
		};
		mono.request({
			url: url,
			type: 'HEAD'
		}, function (err, resp) {
			if (err) {
				return cb(response);
			}

			response.status = resp.statusCode;

			response.fileSize = parseInt(resp.headers['content-length']) || 0;

			var contentType = resp.headers['content-type'];
			if (contentType) {
				response.fileType = contentType;
			}

			cb(response);
		});
	},

	chromeDownload: {
		inProgress: {},
		addDownloadId: function (id, details) {
			if (!this.inProgress[id]) {
				this.inProgress[id] = details;
			}
		},
		removeDownloadId: function (id) {
			if (this.inProgress[id]) {
				delete this.inProgress[id];
			}
		},
		canFixNetworkFiled: function (details, downloadDelta) {
			var time = parseInt(Date.now() / 1000);

			var resumeDownload = false;

			if (!details.lastFix) {
				details.lastFix = 0;
			}

			if (details.lastFix + 5 < time) {
				details.lastFix = time;
				resumeDownload = true;
			}

			var isInterrupted = downloadDelta.state && downloadDelta.state.current === 'interrupted';
			var networkFailed = downloadDelta.error && downloadDelta.error.current === 'NETWORK_FAILED';
			var canResume = downloadDelta.canResume && downloadDelta.canResume.current;
			if (!isInterrupted || !networkFailed || !canResume) {
				resumeDownload = false;
			}

			return resumeDownload;
		},
		onChange: function (downloadDelta) {

			var _this = this;
			var details = _this.inProgress[downloadDelta.id];
			if (!details) {
				return;
			}

			var resumeDownload = false;
			if (details.fixNetworkFiled) {
				resumeDownload = _this.canFixNetworkFiled(details, downloadDelta);
			}
			if (resumeDownload) {
				chrome.downloads.resume(downloadDelta.id);
			} else if (downloadDelta.state && ['complete'].indexOf(downloadDelta.state.current) !== -1) {
				if(details.quality && parseInt(details.quality) >= 720){
				window.localStorage.successDownload = +(window.localStorage.successDownload || 0) + 1;

				if ((
					window.localStorage.successDownload == 3
					||
					parseInt(window.localStorage.successDownload) % 10 == 0
					)
					&&
					typeof window.localStorage.popupRate == 'undefined'
				) {
					var counter = 1;
					var interval = setInterval(function () {
						counter++;
						if (counter % 2) {
							var icon = {"16": chrome.extension.getURL('/img/icon_16.png')}
						} else {
							icon = {"16": chrome.extension.getURL('/img/icon_star_16.png')}
						}
						chrome.browserAction.setIcon({"path": icon});
						chrome.browserAction.setPopup({popup: "rate_popup.html"});
					}, 500);
					chrome.runtime.onMessage.addListener(ratePopupOpened);

					function ratePopupOpened(message) {

						if(!message){
							return;
						}
						if (message == 'ratePopupOpened') {
							clearInterval(interval);
							chrome.browserAction.setIcon({"path": {"16": chrome.extension.getURL('/img/icon_16.png')}});
							chrome.browserAction.setPopup({popup: ""});
							chrome.runtime.onMessage.removeListener(ratePopupOpened);
						}
					}
				}
				}

				_this.removeDownloadId(downloadDelta.id);
				if (Object.keys(_this.inProgress).length === 0) {
					_this.removeListener();
				}
			} else if (downloadDelta.state && ['interrupted'].indexOf(downloadDelta.state.current) !== -1) {
				_this.removeDownloadId(downloadDelta.id);
				if (Object.keys(_this.inProgress).length === 0) {
					_this.removeListener();
				}
			}
		},
		listener: null,
		isListen: false,
		addListener: function () {
			if (!this.listener) {
				this.listener = this.onChange.bind(this);
			}

			if (!this.isListen) {
				this.isListen = true;
				chrome.downloads.onChanged.addListener(this.listener);
			}
		},
		removeListener: function () {
			this.isListen = false;
			chrome.downloads.onChanged.removeListener(this.listener);
		},
		download: function (details) {
			var _this = this;
			var url = details.url;
			var filename = details.filename;

			details.fixNetworkFiled = /vk\.me\/.+\.mp4/i.test(url);

			chrome.downloads.download({
				url: url,
				filename: filename
			}, function (downloadId) {
				_this.addDownloadId(downloadId, details);
				_this.addListener();

				// if (details.fixNetworkFiled) {
				//   _this.addDownloadId(downloadId, details);
				//   _this.addListener();
				// }
			});
		}
	},

	downloadFile: function (message) {
		"use strict";
		var _this = bg_utils;
		var url = message.options.url;
		var filename = message.options.filename;
		if (mono.isFF) {
			return mono.sendMessage({action: 'download', url: url, filename: filename}, null, 'service');
		} else if (mono.isChrome) {
			var onHasPermission = function () {
				return _this.chromeDownload.download(message.options);
			};
			if (chrome.downloads && chrome.downloads.download) {
				return onHasPermission();
			} else {
				return chrome.permissions.request({
					permissions: ['downloads']
				}, function (granted) {
					if (granted) {
						return onHasPermission();
					}
				});
			}
		} else if (mono.isGM) {
			return GM_download(url, filename);
		}
	},

	chromeListDownload: function (list, folder) {
		var waitDownloadId = null;

		list = list.map(function (item) {
			return {url: item.url, filename: folder + item.filename};
		});

		var addListener = function () {
			chrome.downloads.onChanged.addListener(onChange);
		};

		var removeListener = function () {
			chrome.downloads.onChanged.removeListener(onChange);
		};

		var onChange = function (downloadDelta) {
			if (downloadDelta.id !== waitDownloadId || !downloadDelta.state) {
				return;
			}

			if (['interrupted', 'complete'].indexOf(downloadDelta.state.current) !== -1) {
				waitDownloadId = null;
				return onSuccess();
			}
		};

		addListener();

		var index = -1;
		var onSuccess = function () {
			index++;
			var item = list[index];
			if (!item) {
				removeListener();
				return;
			}

			return chrome.downloads.download({
				url: item.url,
				filename: item.filename
			}, function (downloadId) {
				waitDownloadId = downloadId;
			});
		};

		return onSuccess();
	},

	getData: function (message, cb) {
		"use strict";
		var url = message.url;
		if (!url) {
			return cb();
		}

		mono.request({
			url: url
		}, function (err, resp, data) {
			if (err) {
				return cb();
			}
			cb(data);
		});
	}
};

engine.utils = bg_utils;