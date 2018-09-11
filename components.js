var Extore_Utils = {
	downloadParam: 'sfh--download',

	setStyle: function (node, style) {
		if (!node || !style)
			return;

		for (var i in style)
			node.style[i] = style[i];
	},


	getStyle: function (node, property) {
		return node && window.getComputedStyle && window.getComputedStyle(node, null).getPropertyValue(property);
	},

	addStyleRules: function (selector, rules, className) {
		var style = className ? document.querySelector('#extore-styles.' + className) : document.getElementById('extore-styles');
		if (!style) {
			style = document.createElement('style');
			style.id = 'extore-styles';
			if (className) {
				style.classList.add(className);
			}
			// maybe need for safari
			//style.appendChild(document.createTextNode(""));
			var s = document.querySelector('head style');
			if (s)
			// allow to override our styles
				s.parentNode.insertBefore(style, s);
			else
				document.querySelector('head').appendChild(style);
		}

		if (typeof(rules) == 'object') {
			var r = [];
			for (var i in rules)
				r.push(i + ':' + rules[i]);

			rules = r.join(';');
		}

		style.textContent += selector + '{' + rules + '}';
	},

	getPosition: function (node, parent) {
		var box = node.getBoundingClientRect();

		if (parent) {
			var parent_pos = parent.getBoundingClientRect();
			return {
				top: Math.round(box.top - parent_pos.top),
				left: Math.round(box.left - parent_pos.left),
				width: box.width,
				height: box.height
			}
		}
		return {
			top: Math.round(box.top + window.pageYOffset),
			left: Math.round(box.left + window.pageXOffset),
			width: box.width,
			height: box.height
		}
	},

	getSize: function (node) {
		return {width: node.offsetWidth, height: node.offsetHeight};
	},

	getMatchFirst: function (str, re) {
		var m = str.match(re);
		if (m && m.length > 1)
			return m[1];

		return '';
	},

	getElementByIds: function (ids) {
		for (var i = 0; i < ids.length; i++) {
			var node = document.getElementById(ids[i]);
			if (node)
				return node;
		}

		return null;
	},

	getParentByClass: function (node, name) {
		if (!node || name == '') {
			return false;
		}

		var parent;
		if (typeof name === 'object' && name.length > 0) {
			for (parent = node; parent; parent = parent.parentNode) {
				if (parent.nodeType !== 1) {
					return null;
				}
				for (var i = 0; i < name.length; i++) {
					if (parent.classList.contains(name[i])) {
						return parent;
					}
				}
			}
		} else {
			for (parent = node; parent; parent = parent.parentNode) {
				if (parent.nodeType !== 1) {
					return null;
				}
				if (parent.classList.contains(name)) {
					return parent;
				}
			}
		}

		return null;
	},

	getParentByTagName: function (node, tagName) {
		if (!node || !tagName) {
			return false;
		}

		for (var parent = node; parent; parent = parent.parentNode) {
			if (parent.nodeType !== 1) {
				return null;
			}

			if (parent.tagName === tagName) {
				return parent;
			}
		}

		return null;
	},

	getParentById: function (node, id) {
		for (var parent = node; parent; parent = parent.parentNode) {
			if (parent.nodeType !== 1) {
				return null;
			}

			if (parent.id === id) {
				return parent;
			}
		}

		return null;
	},

	hasChildrenTagName: function (node, tagName) {
		for (var i = 0, item; item = node.childNodes[i]; i++) {
			if (item.nodeType !== 1) {
				continue;
			}
			if (item.tagName === tagName) {
				return true;
			}
		}
		return false;
	},

	isParent: function (node, testParent) {
		if (!testParent || [1, 9, 11].indexOf(testParent.nodeType) === -1) {
			return false;
		}

		return testParent.contains(node);
	},


	emptyNode: function (node) {
		while (node.firstChild)
			node.removeChild(node.firstChild);
	},

	download: function (filename, url, requestOptions, callback) {
		if (!url)
			return false;

		filename = filename || this.getFileName(url);
		if (!filename)
			return false;

		if (!mono.global.preference.downloads) {
			return false;
		}

		var params = requestOptions || {};
		params.url = url;
		params.filename = filename;

		var request = {
			action: 'downloadFile',
			options: params
		};

		callback = callback || undefined;

		mono.sendMessage(request, callback);
		return true;
	},

	downloadLink: function (a, callback) {
		if (!a.href)
			return false;

		var filename = a.getAttribute('download');

		var quality = a.dataset.quality;

		return this.download(filename, a.href, {quality: quality}, callback);
	},

	safariDlLink: function (e) {
		"use strict";
		if (e.button || e.ctrlKey || e.altKey || e.shitfKey) {
			return;
		}

		var me = null;

		var legacy = function (e) {
			var me = document.createEvent('MouseEvents');
			me.initMouseEvent('click', true, e.cancelable, window, 0,
				e.screenX, e.screenY, e.clientX, e.clientY,
				false, true, false, e.metaKey, e.button, e.relatedTarget);
			return me;
		};

		try {
			if (typeof MouseEvent !== 'function') {
				throw 'legacy';
			}
			me = new MouseEvent('click', {
				bubbles: true,
				cancelable: e.cancelable,
				screenX: e.screenX,
				screenY: e.screenY,
				clientX: e.clientX,
				clientY: e.clientY,
				ctrlKey: false,
				altKey: true,
				shiftKey: false,
				metaKey: e.metaKey,
				button: e.button,
				relatedTarget: e.relatedTarget
			});
		} catch (err) {
			me = legacy(e);
		}

		e.preventDefault();
		e.stopPropagation();

		this.dispatchEvent(me);
	},

	downloadOnClick: function (event, callback, options) {
		options = options || {};
		var _this = Extore_Utils;

		var node = options.el || event.target;
		if (node.tagName !== 'A') {
			node = mono.getParent(node, 'A');
		}

		if (!node) {
			return;
		}

		if (mono.isSafari) {
			return _this.safariDlLink.call(node, event);
		}

		if (!mono.global.preference.downloads) {
			return;
		}

		if (mono.isGM && /^blob:|^data:/.test(node.href)) {
			return;
		}

		if (event.button === 2) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		_this.downloadLink(node, callback);
	},

	getQueryString: function (query, key_prefix, key_suffix) {
		if (!query || typeof(query) != 'object')
			return '';

		if (key_prefix === undefined)
			key_prefix = '';

		if (key_suffix === undefined)
			key_suffix = '';

		var str = '';
		for (var key in query) {
			if (str.length)
				str += '&';

			if (query[key] instanceof Object) {
				if (!key_prefix)
					key_prefix = '';

				if (!key_suffix)
					key_suffix = '';

				str += Extore_Utils.getQueryString(query[key], key_prefix + key + "[", "]" + key_suffix);
			}
			else
				str += key_prefix + escape(key) + key_suffix + '=' + escape(query[key]);
		}
		return str;
	},

	decodeUnicodeEscapeSequence: function (text) {
		return text.replace(/\\u([0-9a-f]{4})/g, function (s, m) {
			m = parseInt(m, 16);
			if (!isNaN(m)) {
				return String.fromCharCode(m);
			}
		});
	},


	getFileExtension: function (str, def) {
		var ext = this.getMatchFirst(str, /\.([a-z0-9]{3,4})(\?|$)/i);
		if (ext)
			return ext.toLowerCase();

		return (def ? def : '');
	},


	getFileName: function (url) {
		var filename = this.getMatchFirst(url, /\/([^\?#\/]+\.[a-z\d]{2,6})(?:\?|#|$)/i);
		if (!filename)
			return filename;

		return mono.fileName.modify(filename);
	},


	getTopLevelDomain: function (domain) {
		if (!domain)
			return '';

		if (!domain.match(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}/))
			return domain;

		var a = domain.split('.');
		var l = a.length;

		if (l == 2)
			return domain;

		return (a[l - 2] + '.' + a[l - 1]);
	},


	dateToObj: function (ts, leadingZero) {
		var d = (ts === null || ts === undefined) ? new Date() : new Date(ts);

		if (leadingZero === undefined)
			leadingZero = true;

		var res = {
			year: d.getFullYear(),
			month: (d.getMonth() + 1),
			day: d.getDate(),
			hour: d.getHours(),
			min: d.getMinutes(),
			sec: d.getSeconds()
		};

		if (leadingZero) {
			for (var i in res) {
				if (res[i].toString().length == 1)
					res[i] = '0' + res[i];
			}
		}

		return res;
	},


	utf8Encode: function (str) {
		str = str.replace(/\r\n/g, "\n");
		var res = "";

		for (var n = 0; n < str.length; n++) {
			var c = str.charCodeAt(n);

			if (c < 128)
				res += String.fromCharCode(c);
			else if ((c > 127) && (c < 2048)) {
				res += String.fromCharCode((c >> 6) | 192);
				res += String.fromCharCode((c & 63) | 128);
			}
			else {
				res += String.fromCharCode((c >> 12) | 224);
				res += String.fromCharCode(((c >> 6) & 63) | 128);
				res += String.fromCharCode((c & 63) | 128);
			}

		}

		return res;
	},

	sizeHuman: function (size, round) {
		if (round == undefined || round == null)
			round = 2;

		var s = size, count = 0, sign = '', unite_spec = [
			mono.global.language.vkFileSizeByte,
			mono.global.language.vkFileSizeKByte,
			mono.global.language.vkFileSizeMByte,
			mono.global.language.vkFileSizeGByte,
			mono.global.language.vkFileSizeTByte
		];

		if (s < 0) {
			sign = '-';
			s = Math.abs(s);
		}

		while (s >= 1000) {
			count++;
			s /= 1024;
		}

		if (round >= 0) {
			var m = round * 10;
			s = Math.round(s * m) / m;
		}

		if (count < unite_spec.length)
			return sign + s + ' ' + unite_spec[count];

		return size;
	},

	secondsToDuration: function (seconds) {
		if (!seconds || isNaN(seconds))
			return '';

		function zfill(time) {
			if (time < 10)
				return '0' + time;

			return time.toString();
		}

		var hours = Math.floor(seconds / 3600);
		seconds %= 3600;

		var minutes = Math.floor(seconds / 60);
		seconds %= 60;

		if (hours > 0)
			return hours + ":" + zfill(minutes) + ":" + zfill(seconds);

		return minutes + ":" + zfill(seconds);
	},

	svg: {
		icon: {
			download: 'M 4,0 4,8 0,8 8,16 16,8 12,8 12,0 4,0 z',
			info: 'M 8,1.55 C 11.6,1.55 14.4,4.44 14.4,8 14.4,11.6 11.6,14.4 8,14.4 4.44,14.4 1.55,11.6 1.55,8 1.55,4.44 4.44,1.55 8,1.55 M 8,0 C 3.58,0 0,3.58 0,8 0,12.4 3.58,16 8,16 12.4,16 16,12.4 16,8 16,3.58 12.4,0 8,0 L 8,0 z M 9.16,12.3 H 6.92 V 7.01 H 9.16 V 12.3 z M 8.04,5.91 C 7.36,5.91 6.81,5.36 6.81,4.68 6.81,4 7.36,3.45 8.04,3.45 8.72,3.45 9.27,4 9.27,4.68 9.27,5.36 8.72,5.91 8.04,5.91 z',
			noSound: 'M 11.4,5.05 13,6.65 14.6,5.05 16,6.35 14.4,7.95 16,9.55 14.6,11 13,9.35 11.4,11 10,9.55 11.6,7.95 10,6.35 z M 8,1.75 8,14.3 4,10.5 l -4,0 0,-4.75 4,0 z'
		},

		cache: {},

		getSrc: function (icon, color) {
			if (!this.icon[icon])
				return '';

			if (!this.cache[icon])
				this.cache[icon] = {};

			if (!this.cache[icon][color]) {
				this.cache[icon][color] = btoa(
					'<?xml version="1.0" encoding="UTF-8"?>' +
					'<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="16" height="16" viewBox="0 0 16 16" id="svg2" xml:space="preserve">' +
					'<path d="' + this.icon[icon] + '" fill="' + color + '" /></svg>'
				);
			}

			if (this.cache[icon][color])
				return 'data:image/svg+xml;base64,' + this.cache[icon][color];

			return '';
		},

		getSvg: function (icon, color, width, height) {
			var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			var svgNS = svg.namespaceURI;
			svg.setAttribute('width', width || '16');
			svg.setAttribute('height', height || '16');
			svg.setAttribute('viewBox', '0 0 16 16');

			var path = document.createElementNS(svgNS, 'path');
			svg.appendChild(path);
			path.setAttribute('d', this.icon[icon]);

			if (color) {
				path.setAttribute('fill', color);
			}

			return svg;
		}
	},

	appendDownloadInfo: function (parent, color, boxStyle, btnStyle) {
		if (!color)
			color = '#a0a0a0';

		var info = document.createElement('span');
		info.appendChild(document.createTextNode(mono.global.language.downloadTitle));
		this.setStyle(info, {
			display: 'inline-block',
			position: 'relative',
			border: '1px solid ' + color,
			borderRadius: '5px',
			fontSize: '13px',
			lineHeight: '17px',
			padding: '2px 19px 2px 5px',
			marginTop: '5px',
			opacity: 0.9
		});

		if (boxStyle)
			this.setStyle(info, boxStyle);

		var close = document.createElement('span');
		close.textContent = String.fromCharCode(215);
		this.setStyle(close, {
			color: color,
			width: '14px',
			height: '14px',
			fontSize: '14px',
			fontWeight: 'bold',
			lineHeight: '14px',
			position: 'absolute',
			top: 0,
			right: 0,
			overflow: 'hidden',
			cursor: 'pointer'
		});

		if (btnStyle)
			this.setStyle(close, btnStyle);

		close.addEventListener('click', function () {
			info.parentNode.removeChild(info);
			mono.sendMessage({action: 'updateOption', key: 'moduleShowDownloadInfo', value: 0});
		}, false);

		info.appendChild(close);
		parent.appendChild(info);
	},

	appendFileSizeIcon: function (link, iconStyle, textStyle, error, noBrackets, container, blocked) {
		var language = mono.global.language;
		iconStyle = iconStyle || {};
		textStyle = textStyle || {};

		var iconColor = '#333333';
		if (error || blocked) {
			iconColor = '#ff0000';
		} else if (iconStyle.color) {
			iconColor = iconStyle.color;
		}

		var defIconStyle = {
			width: '14px',
			height: '14px',
			marginLeft: '3px',
			verticalAlign: 'middle',
			position: 'relative',
			top: '-1px',
			cursor: 'pointer'
		};
		mono.extend(defIconStyle, iconStyle);

		var defTextStyle = {
			fontSize: '75%',
			fontWeight: 'normal',
			marginLeft: '3px',
			whiteSpace: 'nowrap'
		};
		mono.extend(defTextStyle, textStyle);

		var title = error ? language.getFileSizeFailTitle : language.getFileSizeTitle;
		if(blocked){
			title = 'Blocked by Vimeo';
		}


		var fsBtn = mono.create('img', {
			src: Extore_Utils.svg.getSrc('info', iconColor),
			title: title,
			style: defIconStyle
		});

		var _this = this;

		if (container) {
			container.appendChild(fsBtn);
		} else if (link.nextSibling) {
			link.parentNode.insertBefore(fsBtn, link.nextSibling);
		} else {
			link.parentNode.appendChild(fsBtn);
		}

		fsBtn.addEventListener("click", function (event) {
			event.preventDefault();
			event.stopPropagation();

			if(blocked){
				return;
			}

			var node = mono.create('span', {
				text: '...',
				style: defTextStyle
			});

			fsBtn.parentNode.replaceChild(node, fsBtn);

			return mono.sendMessage({
				action: 'getFileSize',
				url: link.href
			}, function (response) {
				if (response.fileSize > 0) {
					var fileType = response.fileType || '';
					var size = _this.sizeHuman(response.fileSize, 2);
					var bitrate = '';
					var text = '';

					if (bitrate) {
						text = size + ' ~ ' + bitrate;
					} else {
						text = size;
					}

					if (!noBrackets) {
						text = '(' + text + ')';
					}

					node.textContent = text;
					node.title = fileType;
				} else {
					var errBtn = _this.appendFileSizeIcon(link, iconStyle, textStyle, true, noBrackets, document.createDocumentFragment());
					node.parentNode.replaceChild(errBtn, node);
				}
			});
		}, false);

		return fsBtn;
	},

	appendNoSoundIcon: function (link, iconStyle) {
		iconStyle = iconStyle || {};

		var noSoundIconColor = '#ff0000';
		if (iconStyle.color) {
			noSoundIconColor = iconStyle.color;
		}

		var defIconStyle = {
			width: '14px',
			height: '14px',
			marginLeft: '3px',
			verticalAlign: 'middle',
			position: 'relative',
			top: '-1px',
			cursor: 'pointer'
		};
		mono.extend(defIconStyle, iconStyle);

		var icon = mono.create('img', {
			src: Extore_Utils.svg.getSrc('noSound', noSoundIconColor),
			title: mono.global.language.withoutAudio,
			style: defIconStyle
		});

		if (link.nextSibling) {
			link.parentNode.insertBefore(icon, link.nextSibling);
		} else if (link.parentNode) {
			link.parentNode.appendChild(icon);
		} else {
			link.appendChild(icon);
		}
	},

	video: {
		dataAttr: 'data-extore-video-visible',
	}, // video

	popupCloseBtn: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAWUlEQVQ4y2NgGHHAH4j1sYjrQ+WIAvFA/B+I36MZpg8V+w9VQ9Al/5EwzDBkQ2AYr8uwaXiPQ0yfkKuwGUayIYQMI8kQqhlEFa9RLbCpFv1US5BUzSLDBAAARN9OlWGGF8kAAAAASUVORK5CYII=',

	showTooltip: function (node, text, row, style) {
		if (!node)
			return;

		var tooltip = document.querySelector('.extore-tooltip');
		if (!tooltip) {
			tooltip = document.createElement('div');
			tooltip.className = 'extore-tooltip';
			Extore_Utils.setStyle(tooltip, {
				'position': 'absolute',
				'opacity': 0,
				'zIndex': -1
			});
			if (style) {
				Extore_Utils.setStyle(tooltip, style);
			}
		}

		tooltip.textContent = text;

		if (tooltip.lastNode && tooltip.lastNode === node) {
			fixPosition();
			return;
		}

		if (tooltip.lastNode) {
			mono.off(tooltip.lastNode, 'mouseleave', hide);
			mono.off(tooltip.lastNode, 'mousemove', fixPosition);
			tooltip.lastRow && mono.off(tooltip.lastRow, 'mouseleave', hide);
		}

		tooltip.lastNode = node;
		row && (tooltip.lastRow = row);

		mono.on(node, 'mouseleave', hide);
		mono.on(node, 'mousemove', fixPosition, false);
		row && mono.on(row, 'mouseleave', hide);

		document.body.appendChild(tooltip);
		fixPosition();

		function fixPosition(e) {
			if (e !== undefined) {
				e.stopPropagation();
			}
			var p = Extore_Utils.getPosition(node),
				s = Extore_Utils.getSize(tooltip);

			if (p.top == 0 && p.left == 0)
				return;

			p.top = p.top - s.height - 10;
			p.left = p.left - s.width / 2 + Extore_Utils.getSize(node).width / 2;

			p.left = Math.min(p.left, document.body.clientWidth + document.body.scrollLeft - s.width);
			if (p.top < document.body.scrollTop)
				p.top = p.top + s.height + Extore_Utils.getSize(node).height + 20;

			p.top += 'px';
			p.left += 'px';

			// show
			p.zIndex = 9999;
			p.opacity = 1;

			Extore_Utils.setStyle(tooltip, p);
		}

		function hide() {
			if (tooltip.parentNode)
				document.body.removeChild(tooltip);

			tooltip.lastNode = null;
			tooltip.lastRow = null;
			Extore_Utils.setStyle(tooltip, {
				zIndex: -1,
				opacity: 0
			});
			mono.off(node, 'mouseleave', hide);
			mono.off(node, 'mousemove', fixPosition);
			row && mono.off(row, 'mouseleave', hide);
		}
	},

	embedDownloader: {
		dataAttr: 'data-extore-get-links',
		dataIdAttr: 'data-extore-container-id',
		containerClass: 'extore-links-container',
		linkClass: 'extore-link',
		panel: null,
		lastLink: null,
		style: null,

		hostings: {
			'vimeo': {
				re: [
					/^https?:\/\/(?:[\w\-]+\.)?vimeo\.com\/(?:\w+\#)?(\d+)/i,
					/^https?:\/\/player\.vimeo\.com\/video\/(\d+)/i,
					/^https?:\/\/(?:[\w\-]+\.)?vimeo\.com\/channels\/(?:[^\/]+)\/(\d+)$/i,
					/^https?:\/\/vimeo\.com\/(?:.+)clip_id=(\d+)/i
				],
				action: 'getVimeoLinks',
				prepareLinks: function (links) {
					return links.map(function (link) {
						var ext = link.ext;
						if (!ext) {
							ext = 'MP4';
							if (link.url.search(/\.flv($|\?)/i) != -1)
								ext = 'FLV';
						}

						link.name = link.name ? link.name : ext;
						link.type = link.type ? link.type : ext;
						link.ext = ext;

						return link;
					});
				}
			},
		},

		init: function (style) {
			this.style = style;

			if (this.panel) {
				Extore_Utils.popupMenu.removePanel();
			}

			this.panel = null;
			this.lastLink = null;

			// hide menu on click outside them
			// process dinamically added links
			if (document.body) {
				document.body.removeEventListener('click', this.onBodyClick, true);
				document.body.addEventListener('click', this.onBodyClick, true);
			}
		},

		checkUrl: function (url) {
			for (var hosting in this.hostings) {
				var params = this.hostings[hosting];

				for (var i = 0, len = params.re.length; i < len; i++) {
					var match = url.match(params.re[i]);
					if (match) {
						return {
							hosting: hosting,
							action: params.action,
							extVideoId: match[1]
						};
					}
				}
			}

			return null;
		},

		reMapHosting: function (action) {
			var map = {
				'getVimeoLinks': 'vimeo',
			};

			return map[action];
		},

		onClick: function (event, a) {
			var _this = Extore_Utils.embedDownloader;

			if (!a) {
				a = event.target;
				while (a.parentNode) {
					if (a.nodeName === 'A')
						break;
					a = a.parentNode;
				}

				if (!a)
					return;
			}

			var href = a.getAttribute('data-extore-get-links');
			if (!href)
				return;

			if (event.button !== 0 || event.ctrlKey || event.shiftKey)
				return;

			if (_this.lastLink === a && _this.panel && _this.panel.style.display != 'none') {
				_this.lastLink = null;
				_this.panel.style.display = 'none';

				event.preventDefault();
				event.stopPropagation();
				return;
			}

			_this.lastLink = a;
			var data = _this.checkUrl(href);
			if (!data)
				return;

			event.preventDefault();
			event.stopPropagation();

			var request = {
				action: data.action,
				extVideoId: data.extVideoId
			};

			_this.showLinks(mono.global.language.download + ' ...', null, a);

			mono.sendMessage(request, function (response) {
				var hosting = data.hosting;

				if (response.action != request.action) {
					hosting = _this.reMapHosting(response.action);
				}

				if (response.links)
					_this.showLinks(response.links, response.title, a, hosting, true);
				else
					_this.showLinks(mono.global.language.noLinksFound, null, a, undefined, true);
			});

			return false;
		},

		onBodyClick: function (event) {
			var _this = Extore_Utils.embedDownloader;

			var node = event.target;

			if (!_this.panel || _this.panel.style.display == 'none') {
				if (node.tagName !== 'A' && mono.matches(node, 'A ' + node.tagName)) {
					while (node.parentNode) {
						if (node.tagName === 'A') {
							break;
						}
						node = node.parentNode;
					}
				}

				if (node.nodeName !== 'A') {
					return;
				}

				return;
			}

			if (_this.panel === node || _this.panel.contains(node)) {
				return;
			}

			_this.lastLink = null;
			_this.panel.style.display = 'none';

			event.preventDefault();
			event.stopPropagation();
		},

		hidePanel: function () {
			if (this.panel) {
				this.panel.style.display = 'none';
			}
		},

		createMenu: function (links, title, a, hname, update) {
			var menuLinks = mono.global.language.noLinksFound;
			if (typeof links === 'string') {
				menuLinks = links;
			} else if (Extore_Utils.popupMenu.prepareLinks[hname] !== undefined && links) {
				menuLinks = Extore_Utils.popupMenu.prepareLinks[hname](links, title);
			}
			var options = {
				links: menuLinks,
				button: a,
				popupId: undefined,
				showFileSize: true,
				containerClass: this.containerClass,
				linkClass: this.linkClass,
				style: {
					popup: (this.style) ? this.style.container : undefined,
					item: (this.style) ? this.style.link : undefined
				},
				isUpdate: update
			};
			if (update && this.panel) {
				Extore_Utils.popupMenu.update(this.panel, options)
			} else {
				this.panel = Extore_Utils.popupMenu.create(options);
			}
		},

		showLinks: function (links, title, a, hname, update) {
			var panel, id = a.getAttribute(this.dataIdAttr);
			if (id)
				panel = document.getElementById(id);

			if (!panel) {
				this.createMenu(links, title, a, hname, update);

				return;
			}
			else if (this.panel) {
				this.panel.style.display = 'none';
			}

			if (typeof(links) == 'string') {
				panel.textContent = links;
			}
			else if (!links || links.length == 0) {
				panel.textContent = mono.global.language.noLinksFound;
			}
			else {
				// append links
				if (hname && this.hostings[hname] && this.hostings[hname].prepareLinks)
					links = this.hostings[hname].prepareLinks(links);

				panel.textContent = '';

				for (var i = 0; i < links.length; i++) {
					if (links[i].url && links[i].name) {
						var a = document.createElement('a');
						a.href = links[i].url;
						a.title = mono.global.language.downloadTitle;
						a.appendChild(document.createTextNode(links[i].name));
						var span = document.createElement('span');
						span.className = this.linkClass;

						span.appendChild(a);
						panel.appendChild(span);

						Extore_Utils.appendFileSizeIcon(a);
						if (links[i].noSound)
							Extore_Utils.appendNoSoundIcon(a);

						if (title && !links[i].noTitle && links[i].type) {
							a.setAttribute('download', mono.fileName.modify(
								title + '.' + links[i].type.toLowerCase()));

							a.addEventListener('click', Extore_Utils.downloadOnClick, false);
						}
					}
				}
			}
		}
	},


	popupMenu: {
		popupId: 'sf_popupMenu',
		popup: undefined,
		popupStyle: undefined,
		dataArrtVisible: 'data-isVisible',
		extStyleCache: undefined,

		badgeQualityList: ['8K', '4K', '2160', '1440', '1080', '720'],
		createBadge: function (qulity, options) {
			var _this = this;
			options = options || {};
			var style = {
				display: 'inline-block',
				lineHeight: '18px',
				width: '19px',
				height: '17px',
				color: '#fff',
				fontSize: '12px',
				borderRadius: '2px',
				verticalAlign: 'middle',
				textAlign: 'center',
				paddingRight: '2px',
				fontWeight: 'bold',
				marginLeft: '3px'
			};
			for (var key in options.containerStyle) {
				style[key] = options.containerStyle[key];
			}

			var container = mono.create('div', {
				style: style
			});

			if (qulity === '1080' || qulity === '2160' || qulity === '1440' || qulity === '720') {
				container.textContent = 'HD';
				container.style.backgroundColor = '#505050';
				container.style.paddingRight = '1px';
			} else if (qulity === '8K' || qulity === '4K') {
				container.textContent = 'HD';
				container.style.paddingRight = '1px';
				container.style.backgroundColor = 'rgb(247, 180, 6)';
			} else if (qulity === 'mp3' || qulity === 'MP3') {
				container.textContent = 'MP3';
				container.style.width = '26px';
				container.style.paddingRight = '1px';
				container.style.backgroundColor = '#505050';
			}
			return container;
		},

		getTitleNode: function (link) {
			"use strict";
			var _this = Extore_Utils.popupMenu;

			var titleContainer = mono.create('span', {
				style: {
					cssFloat: 'left'
				}
			});

			if (link.extra === 'converter') {
				var badge = document.createDocumentFragment();
				if (['MP3', '8K', '4K', '1440', '1080', '720'].indexOf(link.format) !== -1) {
					badge.appendChild(_this.createBadge(link.format, {
						containerStyle: {
							marginLeft: 0
						}
					}));
				} else {
					badge.appendChild(document.createTextNode(link.format));
				}
				mono.create(titleContainer, {
					append: [badge, ' ', link.quality]
				});
				badge = null;
			} else if (link.itemText) {
				titleContainer.textContent = link.itemText;
			} else {
				var titleQuality = link.quality ? ' ' + link.quality : '';
				var titleFormat = link.format ? link.format : '???';
				var title3D = link['3d'] ? '3D ' : '';
				var titleFps = '';
				if (link.sFps) {
					titleFps += ' ' + (link.fps || 60);
				}
				titleContainer.textContent = title3D + titleFormat + titleQuality + titleFps;
			}

			if (_this.badgeQualityList.indexOf(String(link.quality)) !== -1) {
				titleContainer.appendChild(_this.createBadge(String(link.quality)));
			}

			return titleContainer;
		},

		createPopupItem: function (listItem, options) {
			var _this = Extore_Utils.popupMenu;

			var href, blocked = false;
			if (typeof listItem === 'string') {
				href = listItem;
			} else {
				href = listItem.href;
			}

			if (href === '-') {
				var line = mono.create('div', {
					style: {
						display: 'block',
						margin: '1px 0',
						borderTop: '1px solid rgb(214, 214, 214)'
					}
				});
				return {el: line};
			} else if(href === 'blocked'){
				blocked = true;
			}

			var itemContainer = document.createElement((href === '-text-') ? 'div' : 'a');
			if (listItem.quality) {
				itemContainer.dataset.quality = listItem.quality;
			}

			if (options.linkClass) {
				itemContainer.classList.add(options.linkClass);
			}
			var itemContainerStyle = {
				display: 'block',
				padding: '0 5px',
				textDecoration: 'none',
				whiteSpace: 'nowrap',
				overflow: 'hidden'
			};

			if(blocked){
				itemContainerStyle.opacity = '0.5';
				itemContainer.classList.add('disabled');
			}

			Extore_Utils.setStyle(itemContainer, itemContainerStyle);

			if (href === '-text-') {
				itemContainer.style.lineHeight = '22px';
				return {el: itemContainer};
			}

			itemContainer.href = href;

			if (href === '#') {
				return {el: itemContainer};
			}

			if(blocked){
				itemContainer.href = '#';
			}

			if (mono.isGM || mono.isOpera || mono.isSafari) {
				if (!listItem.extra) {
					itemContainer.title = mono.global.language.downloadTitle;
				}
			}

			if (listItem.forceDownload) {
				var filename = '';
				if (listItem.title) {
					var ext = listItem.ext;
					if (!ext) {
						ext = listItem.format.toLowerCase();
					}
					filename = listItem.title + '.' + ext;
				}
				(!blocked) && itemContainer.setAttribute('download', mono.fileName.modify(filename));
				itemContainer.addEventListener('click', function (event) {
					event.preventDefault();
					event.stopPropagation();
					if(blocked){
						return;
					}
					Extore_Utils.downloadOnClick(event, null, {
						el: this
					});
				}, false);
			}

			itemContainer.appendChild(_this.getTitleNode(listItem));

			var infoConteiner = mono.create('span', {
				style: {
					cssFloat: 'right',
					lineHeight: '22px',
					height: '22px',
					marginLeft: '10px',
				}
			});
			var sizeIconStyle = {
				top: '5px',
				verticalAlign: 'top'
			};
			for (var key in options.sizeIconStyle) {
				sizeIconStyle[key] = options.sizeIconStyle[key];
			}
			var sizeIconTextStyle = {
				marginLeft: 0
			};

			if(blocked){
				infoConteiner.innerText = 'Blocked by Vimeo';
			}

			var sizeIconNode = null;
			if (!listItem.noSize) {
				infoConteiner.addEventListener('click', function onClick(e) {
					if (infoConteiner.firstChild.tagName === 'IMG') {
						e.preventDefault();
						e.stopPropagation();
						mono.trigger(infoConteiner.firstChild, 'click', {cancelable: true});
					}
					this.removeEventListener('click', onClick);
				});
				sizeIconNode = Extore_Utils.appendFileSizeIcon(itemContainer, sizeIconStyle, sizeIconTextStyle, undefined, true, infoConteiner, blocked);
			}

			itemContainer.appendChild(infoConteiner);
			return {el: itemContainer, sizeIcon: sizeIconNode, prop: listItem};
		},

		sortMenuItems: function (list, options) {
			if (options === undefined) {
				options = {};
			}
			var formatPriority = ['Audio Opus', 'Audio Vorbis', 'Audio AAC', '3GP', 'WebM', 'FLV', 'MP4'];
			var strQuality = {
				Mobile: 280,
				LD: 280,
				SD: 360,
				HD: 720,
			};
			if (options.strQualityExtend) {
				mono.extend(strQuality, options.strQualityExtend);
			}

			var sizePriority = {};
			var bitratePriority = [];
			var defList = [];
			var audioList = [];
			var subtitleList = [];
			var mute60List = [];
			var muteList = [];
			var _3dList = [];
			var unkList = [];

			list.forEach(function (item) {
				var prop = item.prop;
				if(!prop){
					return;
				}
				var sortOptions = prop.sort || {};

				var size = sortOptions.size || strQuality[prop.quality] || -1;
				if (size === -1) {
					if (String(prop.quality).substr(-1) === 'K') {
						size = parseInt(prop.quality) * 1000;
					} else {
						size = parseInt(prop.quality);
					}
				}
				if (options.maxSize && size > options.maxSize) {
					return 1;
				}
				if (options.minSize && size < options.minSize) {
					return 1;
				}
				sizePriority[prop.quality] = size;
				defList.push(item);
			});
			var sizeCompare = function (a, b) {

				return sizePriority[a.quality] > sizePriority[b.quality] ? -1 : sizePriority[a.quality] === sizePriority[b.quality] ? 0 : 1;
			};
			var bitrateCompare = function (a, b) {
				return bitratePriority[a.quality] > bitratePriority[b.quality] ? -1 : (bitratePriority[a.quality] === bitratePriority[b.quality]) ? 0 : 1;
			};
			var formatCompare = function (a, b) {
				if (a.noVideo && b.noVideo) {
					return bitrateCompare(a, b);
				}
				if (a.noVideo) {
					return 1;
				}
				if (b.noVideo) {
					return -1;
				}
				return formatPriority.indexOf(a.format) > formatPriority.indexOf(b.format) ? -1 : formatPriority.indexOf(a.format) === formatPriority.indexOf(b.format) ? 0 : 1;
			};

			var compare = function (aa, bb) {
				var a = aa.prop;
				var b = bb.prop;
				if (options.noProp) {
					a = aa;
					b = bb;
				}

				var size = sizeCompare(a, b);
				if (size !== 0) {
					return size;
				}
				return formatCompare(a, b);
			};
			defList.sort(compare);
			_3dList.sort(compare);
			audioList.sort(compare);
			mute60List.sort(compare);
			muteList.sort(compare);

			var resList = null;
			if (options.typeList) {
				resList = [];
				if (options.typeList.indexOf('video') !== -1) {
					resList = resList.concat(defList);
				}
				if (options.typeList.indexOf('3d') !== -1) {
					resList = resList.concat(_3dList);
				}
				if (options.typeList.indexOf('audio') !== -1) {
					resList = resList.concat(audioList);
				}
				if (options.typeList.indexOf('mute') !== -1) {
					resList = resList.concat(muteList);
				}
				if (options.typeList.indexOf('mute60') !== -1) {
					resList = resList.concat(mute60List);
				}
				if (options.typeList.indexOf('subtitles') !== -1) {
					resList = resList.concat(subtitleList);
				}
				if (options.typeList.indexOf('other') !== -1) {
					resList = resList.concat(unkList);
				}
			} else {
				resList = defList.concat(_3dList, audioList, subtitleList, mute60List, muteList, unkList);
			}
			if (options.groupCompare) {
				resList.sort(compare);
			}

			return resList;
		},

		removePanel: function () {
			if (this.popup.parentNode !== null) {
				this.popup.parentNode.removeChild(this.popup);
			}
			if (this.popupStyle !== undefined && this.popupStyle.parentNode !== null) {
				this.popupStyle.parentNode.removeChild(this.popupStyle);
			}
			this.popup = undefined;
			this.popupStyle = undefined;
		},

		getContent: function (options) {
			"use strict";
			var _this = this;
			var links = options.links;

			var content = document.createDocumentFragment();

			var sizeIconList = [];

			if (typeof(links) === 'string') {
				var loadingItem = _this.createPopupItem('-text-', options).el;
				loadingItem.textContent = links;
				content.appendChild(loadingItem);
			} else if (links.length === 0) {
				var emptyItem = _this.createPopupItem('-text-', options).el;
				emptyItem.textContent = mono.global.language.noLinksFound;
				content.appendChild(emptyItem);
			} else {
				var items = [];
				links.forEach(function (link) {
					items.push(_this.createPopupItem(link, options));
				});

				items = _this.sortMenuItems(items, options.sortDetails);

				items.forEach(function (item) {
					content.appendChild(item.el);
					sizeIconList.push(item.sizeIcon);
				});

				options.visibleCount = items.length;
			}

			return {sizeIconList: sizeIconList, content: content};
		},

		create: function (options) {
			var button = options.button;
			var _this = Extore_Utils.popupMenu;

			options.linkClass = options.linkClass || 'ext-menu-item';

			options.offsetRight = options.offsetRight || 0;
			options.offsetTop = options.offsetTop || 0;

			options.parent = options.parent || document.body;

			if (options.isUpdate && (_this.popup === undefined || _this.popup.style.display === 'none')) {
				return;
			}

			if (_this.popup) {
				_this.removePanel();
			}

			var popupContainer = _this.popup = document.createElement('div');
			var containerSelector = '#' + _this.popupId;
			if (options.popupId) {
				containerSelector = '#' + options.popupId;
				popupContainer.id = options.popupId;
			} else if (options.containerClass) {
				containerSelector = '.' + options.containerClass;
				popupContainer.classList.add(options.containerClass);
			} else {
				popupContainer.id = _this.popupId;
			}

			var popupContainerStyle = {
				display: 'block',
				position: 'absolute',
				minHeight: '24px',
				cursor: 'default',
				textAlign: 'left',
				whiteSpace: 'nowrap',
				fontFamily: 'arial, sans-serif'
			};
			if (options.extStyle) {
				delete popupContainerStyle.display;
			}

			var pos = Extore_Utils.getPosition(button, options.parent),
				size = Extore_Utils.getSize(button);

			popupContainerStyle.top = (pos.top + options.offsetTop + size.height) + 'px';
			popupContainerStyle.left = (pos.left + options.offsetRight) + 'px';
			Extore_Utils.setStyle(popupContainer, popupContainerStyle);

			var popupCustomContainerStyle = {
				'background-color': '#fff',
				'z-index': '9999',
				'box-shadow': '0 2px 10px 0 rgba(0,0,0,0.2)',
				border: '1px solid #ccc',
				'border-radius': '3px',
				'font-size': '12px',
				'font-weight': 'bold',
				'min-width': '190px'
			};

			if (options.style && options.style.popup) {
				for (var key in options.style.popup) {
					var value = options.style.popup[key];
					popupCustomContainerStyle[key] = value;
				}
			}

			Extore_Utils.addStyleRules(containerSelector, popupCustomContainerStyle);

			var itemCustomStyle = {
				'line-height': '24px',
				color: '#3D3D3D'
			};

			if (options.style && options.style.item) {
				for (var key in options.style.item) {
					var value = options.style.item[key];
					itemCustomStyle[key] = value;
				}
			}

			Extore_Utils.addStyleRules(containerSelector + ' .' + options.linkClass, itemCustomStyle);

			var stopPropagationFunc = function (e) {
				e.stopPropagation()
			};
			mono.create(popupContainer, {
				on: [
					['click', stopPropagationFunc],
					['mouseover', stopPropagationFunc],
					['mouseup', stopPropagationFunc],
					['mousedown', stopPropagationFunc],
					['mouseout', stopPropagationFunc]
				]
			});

			while (popupContainer.firstChild !== null) {
				popupContainer.removeChild(popupContainer.firstChild);
			}

			var menuContent = _this.getContent.call(_this, options);
			var sizeIconList = menuContent.sizeIconList;
			menuContent = menuContent.content;
			popupContainer.appendChild(menuContent);


			var hoverBgColor = '#2F8AFF';
			var hoverTextColor = '#fff';
			var hoverDisabledTextColor = '#3D3D3D';
			if (options.style && options.style.hover) {
				hoverBgColor = options.style.hover.backgroundColor || hoverBgColor;
				hoverTextColor = options.style.hover.color || hoverTextColor;
			}
			var styleEl = _this.popupStyle = document.createElement('style');
			styleEl.textContent = mono.style2Text({
				selector: containerSelector,
				append: {
					'a:hover': {
						backgroundColor: hoverBgColor,
						color: hoverTextColor
					},
					'a.disabled:hover': {
						backgroundColor: 'inherit',
						color: hoverDisabledTextColor,
						cursor: 'not-allowed'
					},
					'> a:first-child': {
						borderTopLeftRadius: '3px',
						borderTopRightRadius: '3px'
					},
					'> a:last-child': {
						borderBottomLeftRadius: '3px',
						borderBottomRightRadius: '3px'
					}
				}
			});

			options.parent.appendChild(styleEl);
			options.parent.appendChild(popupContainer);
			if (options.extStyle) {
				if (Extore_Utils.popupMenu.extStyleCache !== undefined && Extore_Utils.popupMenu.extStyleCache.parentNode !== null) {
					Extore_Utils.popupMenu.extStyleCache.parentNode.removeChild(Extore_Utils.popupMenu.extStyleCache);
				}

				var extElClassName = 'ext-ElStyle_' + containerSelector.substr(1);
				var extBodyClassName = 'ext-BodyStyle_' + containerSelector.substr(1);
				var extBodyStyle = document.querySelector('style.' + extBodyClassName);
				if (extBodyStyle === null) {
					document.body.appendChild(mono.create('style', {
						class: extBodyClassName,
						text: mono.style2Text({
							selector: containerSelector,
							style: {
								display: 'none'
							}
						})
					}));
				}
				Extore_Utils.popupMenu.extStyleCache = options.extStyle.appendChild(mono.create('style', {
					class: extElClassName,
					text: mono.style2Text({
						selector: 'body ' + containerSelector,
						style: {
							display: 'block'
						}
					})
				}));
			}
			setTimeout(function () {
				sizeIconList.forEach(function (icon) {
					mono.trigger(icon, 'click', {bubbles: false, cancelable: true});
				}, 100);
			});

			return popupContainer;
		},

		update: function (popupContainer, options) {

			var _this = Extore_Utils.popupMenu;


			while (popupContainer.firstChild !== null) {
				popupContainer.removeChild(popupContainer.firstChild);
			}

			var menuContent = _this.getContent.call(_this, options);


			var sizeIconList = menuContent.sizeIconList;
			menuContent = menuContent.content;

			popupContainer.appendChild(menuContent);


			setTimeout(function () {
				sizeIconList.forEach(function (icon) {
					mono.trigger(icon, 'click', {bubbles: false, cancelable: true});
				});
			}, 100);

		},

		preprocessItem: {
			srt2url: function (item, popupLink) {
				"use strict";
				var srt = item.srt;
				var blobUrl = null;

				if (typeof URL !== 'undefined' && typeof Blob !== "undefined" && !mono.isSafari) {
					var blob = new Blob([srt], {encoding: "UTF-8", type: 'text/plain'});
					blobUrl = URL.createObjectURL(blob);
				} else {
					var srtUTF8 = Extore_Utils.utf8Encode(srt);
					blobUrl = 'data:text/plain;charset=utf-8;base64,' + encodeURIComponent(btoa(srtUTF8))
				}

				popupLink.ext = 'srt';
				popupLink.format = 'SRT';
				popupLink.href = blobUrl;
				popupLink.noSize = true;
				if (mono.isOpera || mono.isFF) {
					popupLink.forceDownload = false;
				}
			}
		},

		prepareLinks: {
			vimeo: function (links, title) {
				var menuLinks = [];
				var popupLink;
				links.forEach(function (link) {
					var ext = link.ext;
					if (!ext) {
						ext = 'mp4';
						if (link.url.search(/\.flv($|\?)/i) != -1) {
							ext = 'flv';
						}
					}
					var quality = link.height || '';
					var format = link.type;
					popupLink = {
						href: link.url,
						title: title,
						ext: ext,
						format: format,
						quality: quality,
						forceDownload: true
					};
					menuLinks.push(popupLink);
				});
				return menuLinks;
			},
		},

		/**
		 * @param {Node|Element} target
		 * @param {String|Array} links
		 * @param {String} id
		 * @param {Object} [_details]
		 * @returns {{isShow: boolean, el: Node|Element, hide: Function, update: Function}}
		 */
		quickInsert: function (target, links, id, _details) {
			_details = _details || {};
			var result = {};

			var hideMenu = function (e) {
				if (e && (e.target === target || target.contains(e.target))) {
					return;
				}

				if (!result.isShow) {
					return;
				}

				menu.style.display = 'none';
				mono.off(document, 'mousedown', hideMenu);
				result.isShow = false;
				_details.onHide && _details.onHide(menu);
			};

			var options = {
				links: links,
				button: target,
				popupId: id,
				showFileSize: true
				/*
				 parent: args.parent,
				 extStyle: args.extStyle,
				 offsetRight: args.offsetRight,
				 offsetTop: args.offsetTop,
				 onItemClick: args.onItemClick
				 */
			};

			mono.extend(options, _details);

			var menu = Extore_Utils.popupMenu.create(options);

			_details.onShow && _details.onShow(menu);

			mono.off(document, 'mousedown', hideMenu);
			mono.on(document, 'mousedown', hideMenu);

			return mono.extend(result, {
				button: target,
				isShow: true,
				el: menu,
				hide: hideMenu,
				update: function (links) {
					options.links = links;
					Extore_Utils.popupMenu.update(menu, options)
				}
			});
		}
	},

	frameMenu: {
		getBtn: function (details) {
			"use strict";
			var containerStyle = {
				verticalAlign: 'middle',
				position: 'absolute',
				zIndex: 999,
				fontFamily: 'arial, sans-serif'
			};

			for (var key in details.containerStyle) {
				containerStyle[key] = details.containerStyle[key];
			}

			var quickBtnStyle = details.quickBtnStyleObj || {
					display: 'inline-block',
					fontSize: 'inherit',
					height: '22px',
					border: '1px solid rgba(255, 255, 255, 0.4)',
					borderRadius: '3px',
					borderTopRightRadius: 0,
					borderBottomRightRadius: 0,
					paddingRight: 0,
					paddingLeft: '28px',
					cursor: 'pointer',
					verticalAlign: 'middle',
					position: 'relative',
					lineHeight: '22px',
					textDecoration: 'none',
					zIndex: 1,
					color: '#fff'
				};

			if (details.singleBtn && !details.quickBtnStyleObj) {
				delete quickBtnStyle.borderTopRightRadius;
				delete quickBtnStyle.borderBottomRightRadius;
			}

			var selectBtnStyle = {
				position: 'relative',
				display: 'inline-block',
				fontSize: 'inherit',
				height: '24px',
				padding: 0,
				paddingRight: '21px',
				border: '1px solid rgba(255, 255, 255, 0.4)',
				borderLeft: 0,
				borderRadius: '3px',
				borderTopLeftRadius: '0',
				borderBottomLeftRadius: '0',
				cursor: 'pointer',
				color: '#fff',
				zIndex: 0,
				verticalAlign: 'middle',
				marginLeft: 0
			};

			for (var key in details.selectBtnStyle) {
				selectBtnStyle[key] = details.selectBtnStyle[key];
			}

			var quickBtnIcon = details.quickBtnIcon || mono.create('i', {
					style: {
						position: 'absolute',
						display: 'inline-block',
						left: '6px',
						top: '3px',
						backgroundImage: 'url(' + Extore_Utils.svg.getSrc('download', '#ffffff') + ')',
						backgroundSize: '12px',
						backgroundRepeat: 'no-repeat',
						backgroundPosition: 'center',
						width: '16px',
						height: '16px'
					}
				});

			var selectBtnIcon = details.selectBtnIcon || mono.create('i', {
					style: {
						position: 'absolute',
						display: 'inline-block',
						top: '9px',
						right: '6px',
						border: '5px solid #FFF',
						borderBottomColor: 'transparent',
						borderLeftColor: 'transparent',
						borderRightColor: 'transparent'
					}
				});

			var quickBtn;

			var btnContainer = mono.create('div', {
				id: details.btnId,
				style: containerStyle,
				on: details.on,
				append: [
					quickBtn = mono.create('a', {
						class: 'ext-quick-btn',
						style: quickBtnStyle,
						href: '#',
						append: [
							quickBtnIcon
						]
					}),
					mono.create('style', {
						text: mono.style2Text({
							selector: '#' + details.btnId,
							style: details.nodeCssStyle || {
								opacity: 0.8,
								display: 'none'
							},
							append: [{
								'button::-moz-focus-inner': {
									padding: 0,
									margin: 0
								},
								'.ext-quick-btn': details.quickBtnCssStyle || {
									backgroundColor: 'rgba(28,28,28,0.1)'
								},
								'.ext-select-btn': {
									backgroundColor: 'rgba(28,28,28,0.1)'
								}
							}, {
								selector: [':hover', '.ext-over'],
								join: '',
								style: {
									opacity: 1
								},
								append: {
									'.ext-quick-btn': details.quickBtnOverCssStyle || {
										backgroundColor: 'rgba(0, 163, 80, 0.5)'
									},
									'.ext-select-btn': {
										backgroundColor: 'rgba(60, 60, 60, 0.5)'
									}
								}
							}, {
								join: '',
								'.ext-over': {
									append: {
										'.ext-select-btn': {
											backgroundColor: 'rgba(28,28,28,0.8)'
										}
									}
								},
								'.ext-show': {
									display: 'block'
								}
							}]
						})
					})
				]
			});

			var selectBtn = null;
			var setQuality = null;
			if (!details.singleBtn) {
				setQuality = function (text) {
					var node = typeof text === 'object' ? text : document.createTextNode(text);
					var first = selectBtn.firstChild;
					if (first === selectBtnIcon) {
						selectBtn.insertBefore(node, first);
					} else {
						selectBtn.replaceChild(node, first);
					}
				};
				selectBtn = mono.create('button', {
					class: 'ext-select-btn',
					style: selectBtnStyle,
					on: details.onSelectBtn,
					append: [
						selectBtnIcon
					]
				});
				btnContainer.appendChild(selectBtn);
			}

			return {
				node: btnContainer,
				setQuality: setQuality,
				setLoadingState: function () {
					setQuality(mono.create('img', {
						src: Extore_Utils.svg.getSrc('info', '#ffffff'),
						style: {
							width: '14px',
							height: '14px',
							marginLeft: '6px',
							verticalAlign: 'middle',
							top: '-1px',
							position: 'relative'
						}
					}));
				},
				selectBtn: selectBtn,
				quickBtn: quickBtn
			};
		},
		//
		// getHiddenList: function (hiddenList, options) {
		// 	"use strict";
		// 	var popupMenu = Extore_Utils.popupMenu;
		// 	var moreBtn = popupMenu.createPopupItem('-text-', options).el;
		// 	mono.create(moreBtn, {
		// 		text: mono.global.language.more + ' ' + String.fromCharCode(187),
		// 		style: {
		// 			cursor: 'pointer'
		// 		},
		// 		on: ['click', function () {
		// 			var content = this.parentNode;
		// 			var itemList = content.querySelectorAll('*[' + popupMenu.dataArrtVisible + ']');
		// 			for (var i = 0, item; item = itemList[i]; i++) {
		// 				item.style.display = 'block';
		// 				item.setAttribute(popupMenu.dataArrtVisible, 1);
		// 			}
		// 			this.parentNode.removeChild(this);
		// 		}]
		// 	});
		//
		// 	var content = document.createDocumentFragment();
		// 	content.appendChild(moreBtn);
		//
		// 	mono.create(content, {
		// 		append: hiddenList
		// 	});
		//
		// 	if (options.visibleCount === 0) {
		// 		mono.trigger(moreBtn, 'click', {cancelable: true});
		// 	}
		//
		// 	return content;
		// },
		//

		getMenuContainer: function (options) {
			"use strict";
			var popupMenu = Extore_Utils.popupMenu;
			var button = options.button;
			var popupId = options.popupId;

			var container = mono.create('div', {
				style: {
					position: 'absolute',
					minHeight: '24px',
					cursor: 'default',
					textAlign: 'left',
					whiteSpace: 'nowrap',
					overflow: 'auto'
				}
			});

			if (popupId[0] === '#') {
				container.id = popupId.substr(1);
			} else {
				container.classList.add(popupId);
			}

			var menuContent = popupMenu.getContent(options);
			container.appendChild(menuContent.content);

			setTimeout(function () {
				menuContent.sizeIconList.forEach(function (icon) {
					mono.trigger(icon, 'click', {bubbles: false, cancelable: true});
				});
			});
			var pos = Extore_Utils.getPosition(button, options.parent);
			var size = Extore_Utils.getSize(button);

			var stopPropagationFunc = function (e) {
				e.stopPropagation()
			};

			var topOffset = pos.top + size.height;
			var menuStyle = {
				top: topOffset + 'px',
				maxHeight: (document.body.offsetHeight - topOffset - 40) + 'px'
			};

			if (options.leftMenuPos) {
				menuStyle.left = pos.left + 'px';
			} else {
				menuStyle.right = (document.body.offsetWidth - pos.left - size.width) + 'px';
			}

			mono.create(container, {
				style: menuStyle,
				on: [
					['click', stopPropagationFunc],
					['mouseover', stopPropagationFunc],
					['mouseup', stopPropagationFunc],
					['mousedown', stopPropagationFunc],
					['mouseout', stopPropagationFunc],
					['wheel', function (e) {
						if (e.wheelDeltaY > 0 && this.scrollTop === 0) {
							e.preventDefault();
						} else if (e.wheelDeltaY < 0 && this.scrollHeight - (this.offsetHeight + this.scrollTop) <= 0) {
							e.preventDefault();
						}
					}]
				],
				append: [
					mono.create('style', {
						text: mono.style2Text({
							selector: (popupId[0] === '#' ? '' : '.') + popupId,
							style: {
								display: 'none',
								fontFamily: 'arial, sans-serif',

								backgroundColor: 'rgba(28,28,28,0.8)',
								zIndex: 9999,
								borderRadius: '4px',
								fontSize: '12px',
								fontWeight: 'bold',
								minWidth: '190px',
								color: '#fff'
							},
							append: [{
								join: '',
								'.ext-show': {
									display: 'block'
								},
								'::-webkit-scrollbar-track': {
									backgroundColor: '#424242'
								},
								'::-webkit-scrollbar': {
									width: '10px',
									backgroundColor: '#424242'
								},
								'::-webkit-scrollbar-thumb': {
									backgroundColor: '#8e8e8e'
								}
							}, {
								'.ext-menu-item': {
									lineHeight: '24px',
									color: '#fff'
								},
								'.ext-menu-item:hover': {
									backgroundColor: '#1c1c1c'
								},
								'.ext-menu-item.disabled:hover': {
									backgroundColor: 'rgba(28,28,28,0.8);',
									color: '#fff',
									cursor: 'not-allowed',
								}
							}]
						})
					})
				]
			});

			return container;
		},
		getMenu: function (target, links, id, _options) {
			"use strict";
			var options = {
				links: links,
				button: target,
				popupId: id || '#ext-frame-menu',
				showFileSize: true,
				sizeIconStyle: {
					color: '#fff'
				},
				linkClass: 'ext-menu-item',
				// getHiddenListFunc: this.getHiddenList.bind(this)
			};

			for (var key in _options) {
				options[key] = _options[key];
			}

			var menu = this.getMenuContainer(options);

			(options.container || document.body).appendChild(menu);

			var hideMenu = function () {
				if (menu.parentNode) {
					menu.parentNode.removeChild(menu);
				}
				out.isShow = false;
				options.onHide && options.onHide();
			};

			options.onShow && options.onShow(menu);

			mono.off(document, 'mousedown', hideMenu);
			mono.on(document, 'mousedown', hideMenu);

			var out = {
				isShow: true,
				el: menu,
				hide: hideMenu,
				update: function (links) {
					var popupMenu = Extore_Utils.popupMenu;
					var style = menu.lastChild;
					menu.textContent = '';

					options.links = links;
					var menuContent = popupMenu.getContent(options);

					setTimeout(function () {
						menuContent.sizeIconList.forEach(function (icon) {
							mono.trigger(icon, 'click', {bubbles: false, cancelable: true});
						});
					});

					menu.appendChild(menuContent.content);
					menu.appendChild(style);
				}
			};

			return out;
		}
	},

	/**
	 * @param {Object} details
	 * @param {Array} [details.args]
	 * @param {number} [details.timeout]
	 * @param {function} details.func
	 * @param {function} details.cb
	 */
	bridge: function (details) {
		"use strict";
		details.args = details.args || [];
		if (details.timeout === undefined) {
			details.timeout = 300;
		}
		var scriptId = 'ext-bridge-' + parseInt(Math.random() * 1000) + '-' + Date.now();

		var listener = function (e) {
			window.removeEventListener('ext-bridge-' + scriptId, listener);
			var data;
			if (!e.detail) {
				data = undefined;
			} else {
				data = JSON.parse(e.detail);
			}
			details.cb(data);
		};

		window.addEventListener('ext-bridge-' + scriptId, listener);

		var wrapFunc = '(' + (function (func, args, scriptId, timeout) {
				/* fix */
				var node = document.getElementById(scriptId);
				if (node) {
					node.parentNode.removeChild(node);
				}

				var fired = false;
				var done = function (data) {
					if (fired) {
						return;
					}
					fired = true;

					var event = new CustomEvent('ext-bridge-' + scriptId, {detail: JSON.stringify(data)});
					window.dispatchEvent(event);
				};

				timeout && setTimeout(function () {
					done();
				}, timeout);

				args.push(done);

				func.apply(null, args);
			}).toString() + ')(' + [
				details.func.toString(),
				JSON.stringify(details.args),
				JSON.stringify(scriptId),
				parseInt(details.timeout)
			].join(',') + ');';

		if (mono.isSafari) {
			var safariFix = function () {
				if (typeof CustomEvent === 'undefined') {
					CustomEvent = function (event, params) {
						params = params || {bubbles: false, cancelable: false};
						var evt = document.createEvent('CustomEvent');
						evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
						return evt;
					};
					CustomEvent.prototype = window.Event.prototype;
				}
			};
			wrapFunc = wrapFunc.replace('/* fix */', '(' + safariFix.toString() + ')();');
		} else if (mono.isOpera) {
			wrapFunc = wrapFunc.replace('/* fix */', 'var CustomEvent = window.CustomEvent;');
		}

		var script = mono.create('script', {
			id: scriptId,
			text: wrapFunc
		});
		document.body.appendChild(script);
	}
};

Extore_Utils.mutationWatcher = {
	getMutationObserver: function () {
		"use strict";
		var MutationObserverCtor = null;
		if (typeof MutationObserver !== 'undefined') {
			MutationObserverCtor = MutationObserver;
		} else if (typeof WebKitMutationObserver !== 'undefined') {
			MutationObserverCtor = WebKitMutationObserver;
		} else if (typeof MozMutationObserver !== 'undefined') {
			MutationObserverCtor = MozMutationObserver;
		} else if (typeof JsMutationObserver !== 'undefined') {
			MutationObserverCtor = JsMutationObserver;
		}
		return MutationObserverCtor;
	},
	isAvailable: function () {
		"use strict";
		return !!this.getMutationObserver();
	},
	disconnect: function (details) {
		"use strict";
		details.observer.disconnect();
	},
	connect: function (details) {
		"use strict";
		details.observer.observe(details.target, details.config);
	},
	joinMutations: function (mutations) {
		"use strict";
		var jMutations = [];
		var targetList = [];

		var jObj = {}, obj, hasNodes;
		var mutation, i, node, tIndex;
		while (mutation = mutations.shift()) {
			tIndex = targetList.indexOf(mutation.target);

			if (tIndex === -1) {
				tIndex = targetList.push(mutation.target) - 1;
				jObj[tIndex] = {
					target: mutation.target,
					added: [],
					removed: []
				};
			}

			obj = jObj[tIndex];
			hasNodes = undefined;

			for (i = 0; node = mutation.addedNodes[i]; i++) {
				if (node.nodeType !== 1) {
					continue;
				}

				obj.added.push(node);
				hasNodes = true;
			}

			for (i = 0; node = mutation.removedNodes[i]; i++) {
				if (node.nodeType !== 1) {
					continue;
				}

				obj.removed.push(node);
				hasNodes = true;
			}

			if (hasNodes !== undefined && obj.inList === undefined) {
				obj.inList = true;
				jMutations.push(obj);
			}
		}

		return jMutations;
	},
	isMatched: null,
	prepareMatched: function () {
		"use strict";
		if (this.isMatched) {
			return;
		}

		var el = document.createElement('div');

		if (typeof el.matches === 'function') {
			this.isMatched = function (node, selector) {
				return node.matches(selector);
			};
		} else if (typeof el.matchesSelector === 'function') {
			this.isMatched = function (node, selector) {
				return node.matchesSelector(selector);
			};
		} else if (typeof el.webkitMatchesSelector === 'function') {
			this.isMatched = function (node, selector) {
				return node.webkitMatchesSelector(selector);
			};
		} else if (typeof el.mozMatchesSelector === 'function') {
			this.isMatched = function (node, selector) {
				return node.mozMatchesSelector(selector);
			};
		} else if (typeof el.oMatchesSelector === 'function') {
			this.isMatched = function (node, selector) {
				return node.oMatchesSelector(selector);
			};
		} else if (typeof el.msMatchesSelector === 'function') {
			this.isMatched = function (node, selector) {
				return node.msMatchesSelector(selector);
			};
		}

		el = null;
	},
	match: function (details, summaryList, mutation) {
		"use strict";
		var _this = this;
		var node, i, query, n;
		var queries = details.queries;
		var hasChanges = false;
		['added', 'removed'].forEach(function (type) {
			var nodeList = mutation[type];
			for (n = 0; node = nodeList[n]; n++) {
				for (i = 0; query = queries[i]; i++) {
					if (query.is !== undefined && query.is !== type) {
						continue;
					}
					var nodeArr = summaryList[i][type];
					if (_this.isMatched(node, query.css) === true) {
						nodeArr.push(node);
					} else {
						nodeArr.push.apply(nodeArr, node.querySelectorAll(query.css));
					}

					if (hasChanges === false) {
						hasChanges = nodeArr[0] !== undefined;
					}
				}
			}
		});

		return hasChanges;
	},
	filterTarget: function (queries, node) {
		"use strict";
		var i, query;
		for (i = 0; query = queries[i]; i++) {
			if (this.isMatched(node, query.css) === true) {
				return true;
			}
		}
		return false;
	},
	run: function (_details) {
		"use strict";
		var _this = this;
		var details = {
			config: {
				childList: true,
				subtree: true
			},
			target: document.body,
			filterTarget: []
		};
		mono.extend(details, _details);

		details._disconnect = this.disconnect.bind(this, details);
		details._connect = this.connect.bind(this, details);
		details._match = this.match.bind(this, details);

		var _summaryList = [];
		for (var i = 0; i < details.queries.length; i++) {
			_summaryList.push({
				added: [],
				removed: []
			});
		}
		_summaryList = JSON.stringify(_summaryList);

		this.prepareMatched();

		var mObserver = this.getMutationObserver();
		details.observer = new mObserver(function (mutations) {
			var jMutations = _this.joinMutations(mutations);
			if (jMutations.length === 0) {
				return;
			}

			var hasChanges = false;
			var mutation;
			var summaryList = JSON.parse(_summaryList);
			while (mutation = jMutations.shift()) {
				if (_this.filterTarget(details.filterTarget, mutation.target) === false) {
					if (details._match(summaryList, mutation) === true) {
						hasChanges = true;
					}
				}
			}

			hasChanges === true && details.callback(summaryList);
		});

		details.start = function () {
			details._disconnect();
			details._connect();

			var hasChanges = false;
			var summaryList = JSON.parse(_summaryList);

			var mutation = {
				added: [details.target],
				removed: []
			};
			if (details._match(summaryList, mutation)) {
				hasChanges = true;
			}

			hasChanges === true && details.callback(summaryList);
		};

		details.stop = function () {
			details._disconnect();
		};

		details.start();

		return details;
	}
};

Extore_Utils.mutationAttrWatcher = {
	isAvailable: function () {
		"use strict";
		return !!Extore_Utils.mutationWatcher.getMutationObserver();
	},
	disconnect: function (details) {
		"use strict";
		details.observer.disconnect();
	},
	connect: function (details) {
		"use strict";
		details.observer.observe(details.target, details.config);
	},
	run: function (_details) {
		"use strict";
		var _this = this;

		var details = {
			config: {
				attributes: true,
				childList: false,
				attributeOldValue: true
			},
			target: document.body
		};

		mono.extend(details, _details);

		if (!Array.isArray(details.attr)) {
			details.attr = [details.attr];
		}

		details.config.attributeFilter = details.attr;

		details._disconnect = this.disconnect.bind(this, details);
		details._connect = this.connect.bind(this, details);

		var _summaryList = [];
		for (var i = 0; i < details.attr.length; i++) {
			_summaryList.push({});
		}
		_summaryList = JSON.stringify(_summaryList);

		var mObserver = Extore_Utils.mutationWatcher.getMutationObserver();
		details.observer = new mObserver(function (mutations) {
			var hasChanges = false;
			var mutation;
			var summaryList = JSON.parse(_summaryList);
			while (mutation = mutations.shift()) {
				var index = details.attr.indexOf(mutation.attributeName);
				if (index === -1) {
					continue;
				}

				var value = mutation.target.getAttribute(mutation.attributeName);
				if (value === mutation.oldValue) {
					continue;
				}

				summaryList[index] = {
					value: value,
					oldValue: mutation.oldValue
				};

				hasChanges = true;
			}

			hasChanges === true && details.callback(summaryList);
		});

		details.start = function () {
			details._disconnect();
			details._connect();

			var hasChanges = false;
			var summaryList = JSON.parse(_summaryList);

			for (var i = 0, attributeName; attributeName = details.attr[i]; i++) {
				var value = details.target.getAttribute(attributeName);
				if (value === null) {
					continue;
				}
				summaryList[i] = {
					value: value,
					oldValue: null
				};

				hasChanges = true;
			}

			hasChanges === true && details.callback(summaryList);
		};

		details.stop = function () {
			details._disconnect();
		};

		details.start();

		return details;
	}
};