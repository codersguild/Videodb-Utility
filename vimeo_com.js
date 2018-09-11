(typeof mono === 'undefined') && (mono = {
	loadModule: function () {
		this.loadModuleStack.push(arguments);
	}, loadModuleStack: []
});

mono.loadModule('vimeo', function (moduleName, initData) {
	"use strict";

	var language = initData.getLanguage;
	var preference = initData.getPreference;
	var moduleState = preference.moduleVimeo ? 1 : 0;
	var iframe = mono.isIframe();

	mono.onMessage.addListener(function (message, cb) {
		if (message.action === 'getModuleInfo') {
			if (message.url !== location.href) return;
			return cb({state: moduleState, moduleName: moduleName});
		}
		if (message.action === 'changeState') {
			if (moduleName !== message.moduleName) {
				return;
			}
			return vimeo.changeState(message.state);
		}
	});


	mono.asyncCall(function () {
		vimeo.run();
	});


	var vimeo = {
		panelId: 'extore__vimeo_links',
		btnBox: null,
		clipId: null,
		timer: null,
		btnPrefix: 'sd_ld_bnt_',
		popupIsShow: false,
		dlBtnClassName: 'ext-dl-btn',
		currentMenu: null,
		linkCache: {},

		run: function () {
			moduleState = 1;
			if (iframe) {
				vimeo.clipId = vimeo.getFrameClipId();
				if (vimeo.clipId) {
					return vimeo.appendIframeButtons();
				} else {
					iframe = false;
				}
			}

			this.videoFeed.injectStyle();

			if (Extore_Utils.mutationWatcher.isAvailable()) {
				this.mutationMode.enable();
			}
		},

		changeState: function (state) {
			if (iframe) {
				return;
			}

			moduleState = state;

			vimeo.videoFeed.disable();

			vimeo.rmAllBtn();

			vimeo.mutationMode.stop();

			if (state) {
				vimeo.run();
			}
		},

		hideMenu: function () {
			if (vimeo.currentMenu) {
				vimeo.currentMenu.hide();
				vimeo.currentMenu = null;
			}
		},

		getFrameClipId: function () {
			var frameClipId = document.location.href.match(/player\.vimeo\.com\/video\/([\w\-]+)/i);
			frameClipId = frameClipId && frameClipId[1];
			if (frameClipId) {
				return frameClipId;
			}
		},

		getBrowserVideoData: function (container, id) {
			var btnParent = container.querySelector('.uploaded_on');
			if (!btnParent) {
				btnParent = container.querySelector('#info .meta .stats');
			}
			if (!btnParent) {
				return null;
			}
			if (id) {
				id = id.match(/([0-9]+)$/);
				id = id && id[1];
			}
			if (!id) {
				var firstLink = container.querySelector('a.js-title') || container.querySelector('a');
				if (!firstLink) {
					return;
				}
				var url = firstLink.getAttribute('href');
				if (!url) {
					return;
				}
				id = url.match(/\/([0-9]+)$/);
				id = id && id[1];
			}
			if (!id) {
				return;
			}
			return {id: id, parent: btnParent, style: 1};
		},

		getVideoId: function (container) {
			container = container || document;
			var id = null;
			var player;

			player = container.querySelector('.player[data-clip-id]');
			if (player) {
				return player.dataset.clipId;
			}

			player = container.querySelector('.player[data-fallback-url]');
			if (player) {
				var fallbackUrl = player.dataset.fallbackUrl || '';
				fallbackUrl = fallbackUrl.match(/video\/([0-9]+)\//);
				if (fallbackUrl) {
					return fallbackUrl[1];
				}
			}

			player = container.querySelector('div.player_wrapper > div.faux_player[data-clip_id]');
			if (player) {
				id = player.dataset.clip_id;
				if (id) {
					return id;
				}
			}
		},

		onBtnClick: function (videoData, e) {
			e.stopPropagation();
			e.preventDefault();
			var id = videoData.id;

			if (!id) {
				var container = null;
				if (videoData.playerContainer) {
					container = mono.getParent(videoData.parent, videoData.playerContainer);
				}
				id = vimeo.getVideoId(container);
			}

			if (vimeo.currentMenu && vimeo.currentMenu.isShow) {
				vimeo.hideMenu();
				return;
			}

			var fromCache = vimeo.linkCache[id];
			var links = language.download + ' ...';
			if (fromCache) {
				links = Extore_Utils.popupMenu.prepareLinks.vimeo(fromCache.links, fromCache.title);
			}

			var details = {};
			if (videoData.style === 4) {
				details.offsetTop = 20;
			}

			var menu = vimeo.currentMenu = Extore_Utils.popupMenu.quickInsert(this, links, 'ext-popupMenu', details);

			if (fromCache) {
				return;
			}

			mono.sendMessage({action: 'getVimeoLinks', extVideoId: id, url: location.href}, function (response) {
				if (response.links) {

					vimeo.getLinksFromLoadDownloadConfig(id, response.links, function (links) {
						if(links && links.length){
							response.links = links;
						}
						vimeo.linkCache[id] = response;
						var menuLinks = Extore_Utils.popupMenu.prepareLinks.vimeo(response.links, response.title);

						menu.update(menuLinks);
					});

				} else {
					menu.update(language.noLinksFound);
				}
			});
		},

		rmAllBtn: function () {
			['sfSkip'].forEach(function (attr) {
				var dataAttr = mono.dataAttr2Selector(attr);
				var dataAttrList = document.querySelectorAll('[' + dataAttr + ']');
				for (var i = 0, item; item = dataAttrList[i]; i++) {
					item.removeAttribute(dataAttr);
				}
			});

			var btnList = document.querySelectorAll('.' + vimeo.dlBtnClassName);
			for (var i = 0, item; item = btnList[i]; i++) {
				if (item.dataset.sfType === '1' || item.dataset.sfType === '3') {
					item = item.parentNode;
				}
				item.parentNode.removeChild(item);
			}
			vimeo.videoFeed.rmBtn();

			vimeo.hideMenu();
		},

		appendBtn: function (videoData) {
			var box = videoData.parent;

			var exBtn = box.querySelector('.' + vimeo.dlBtnClassName);
			if (exBtn) {
				if (!exBtn.dataset.sfId) {
					return;
				}
				exBtn.parentNode.removeChild(exBtn);
				exBtn = null;
			}

			var btn;
			if (videoData.style === 1) {
				btn = mono.create('a', {
					text: language.download,
					class: [vimeo.dlBtnClassName, 'ext-style-1'],
					style: {
						display: 'inline'
					},
					data: {
						sfId: videoData.id,
						sfType: videoData.style
					},
					href: '#' + videoData.id
				});
			} else if (videoData.style === 2) {
				btn = mono.create('button', {
					text: language.download,
					class: [vimeo.dlBtnClassName, 'btn', 'iconify_down_b'],
					data: {
						sfId: videoData.id,
						sfType: videoData.style
					}
				});
			} else if (videoData.style === 3 || videoData.style === 5) {
				btn = mono.create('button', {
					class: [vimeo.dlBtnClassName, 'iris_btn', 'iris_btn-switch'],
					data: {
						sfId: videoData.id,
						sfType: videoData.style
					},
					append: [
						mono.create('span', {
							class: 'iris_btn-content',
							style: {
								marginLeft: 0
							},
							text: language.download
						})
					]
				});
			} else if (videoData.style === 4) {
				btn = mono.create('i', {
					class: [vimeo.dlBtnClassName, 'ext-style-4'],
					data: {
						sfId: videoData.id,
						sfType: videoData.style
					},
					style: {
						display: 'inline-block',
						border: '1px solid #F8F8F8',
						width: '20px',
						height: '20px',
						lineHeight: 0,
						cursor: 'pointer',
						marginLeft: '10px',
						verticalAlign: 'middle'
					},
					append: mono.create('style', {
						text: mono.style2Text([{
							selector: '.' + vimeo.dlBtnClassName + '.ext-style-4',
							style: {
								background: 'url(' + Extore_Utils.svg.getSrc('download', '#777777') + ') center no-repeat #F8F8F8',
								backgroundSize: '12px'
							}
						}, {
							selector: '.' + vimeo.dlBtnClassName + '.ext-style-4:hover',
							style: {
								background: 'url(' + Extore_Utils.svg.getSrc('download', '#00B75A') + ') center no-repeat #F8F8F8',
								backgroundSize: '12px'
							}
						}, {
							selector: '.' + vimeo.dlBtnClassName + '.ext-style-4:active',
							style: {
								outline: 0,
								boxShadow: 'inset 0 3px 5px rgba(0, 0, 0, 0.125)'
							}
						}])
					})
				});

				if (mono.isOpera) {
					btn.style.background = '#F8F8F8';
					btn.appendChild(mono.create('img', {
						src: Extore_Utils.svg.getSrc('download', '#777777'),
						style: {
							width: '12px',
							height: '12px',
							margin: '4px',
							backgroundColor: '#F8F8F8'
						}
					}));
				}
			} else if (videoData.style = 6) {
				btn = mono.create('button', {
					class: [vimeo.dlBtnClassName, 'ext_btn_new'],
					data: {
						sfId: videoData.id,
						sfType: videoData.style
					},
					style: {
						display: 'inline',
						color: '#fff',
						borderColor: '#00adef',
						verticalAlign: 'middle',
						backgroundColor: '#00adef',
						marginLeft: '5px',
						minWidth: '4.25rem',
						boxSizing: 'border-box',
						// -webkit-font-smoothing: antialiased,
						// -webkit-appearance: none,
						minHeight: '1.875rem',
						padding: '0 .625rem',
						lineHeight: '2.14286',
						fontSize: '.875rem',
						width: 'auto',
						borderWidth: '.0625rem',
						borderStyle: 'solid',
						borderRadius: '.1875rem',
						transition: 'all .1s ease-in-out',
						letterSpacing: '.1px',
						alignItems: 'center',
						// -webkit-box-pack: center,
						justifyContent: 'center',
						// -webkit-box-align: center,
					},
					append: [
						mono.create('span', {
							class: 'iris_btn-content',
							style: {
								marginLeft: 0,
								display: 'inline-flex',
								// -webkit-box-pack: center,
								alignItems: 'center',
								lineHeight: '2.3',
								fontSize: '.875rem',
								boxSizing: 'border-box',
								// -webkit-box-align: center,
								justifyContent: 'center',
							},
							text: language.download
						})
					]
				});
			}

			btn.addEventListener('click', vimeo.onBtnClick.bind(btn, videoData));

			if (videoData.style === 1) {
				btn = mono.create('span', {
					append: [
						btn,
						' | '
					]
				});
			}

			if (videoData.style === 3) {
				btn = mono.create('div', {
					class: 'clip_info-user_actions',
					append: [
						btn
					]
				});
			}

			if (videoData.style === 1 || videoData.style === 2) {
				var firstChild = box.firstChild;
				if (firstChild) {
					box.insertBefore(btn, firstChild);
				} else {
					box.appendChild(btn);
				}
			} else {
				box.appendChild(btn);
			}
		},

		playerStateChangeObserver: null,
		observeVideoUi: function (btnObj, node) {
			var playerMenu = node;
			if (playerMenu) {
				var hideBtnTimer = null;
				var controlsRe = /(\s|^)with-controls(\s|$)/;
				if (this.playerStateChangeObserver) {
					this.playerStateChangeObserver.stop();
				}
				this.playerStateChangeObserver = Extore_Utils.mutationAttrWatcher.run({
					attr: 'class',
					target: playerMenu,
					callback: function (summaryList) {
						var summary = summaryList[0];
						var showBefore = !controlsRe.test(summary.oldValue);
						var showAfret = !controlsRe.test(summary.value);
						if (!showBefore && showAfret) {
							clearTimeout(hideBtnTimer);
							hideBtnTimer = setTimeout(function () {
								if (!btnObj.lockHide) {
									btnObj.container.classList.add('ext-hide-ui');
								}
							}, 100);
						} else if (showBefore && !showAfret) {
							clearTimeout(hideBtnTimer);
							btnObj.container.classList.remove('ext-hide-ui');
						}
					}
				});
			}
		},

		appendIframeButtons: function () {
			var _this = this;
			var btnObj = Extore_Utils.frameMenu.getBtn({
				quickBtnStyleObj: {
					display: 'inline-block',
					border: 0,
					borderRadius: '.3em',
					cursor: 'pointer',
					position: 'relative',
					padding: '6px 8px'
				},
				quickBtnCssStyle: {
					backgroundColor: 'rgba(23,35,34,.75)'
				},
				quickBtnOverCssStyle: {
					backgroundColor: 'rgb(0, 173, 239)'
				},
				nodeCssStyle: {
					display: 'none'
				},
				singleBtn: true,
				btnId: _this.panelId,
				containerStyle: {
					left: '10px',
					top: '10px'
				},
				quickBtnIcon: mono.create(Extore_Utils.svg.getSvg('download', '#ffffff'), {
					style: {
						display: 'inline-block',
						width: '16px',
						height: '16px',
						verticalAlign: 'middle'
					}
				}),
				on: [
					['click', function (e) {
						e.preventDefault();
						e.stopPropagation();

						if (_this.currentMenu && _this.currentMenu.isShow) {
							_this.hideMenu();
							return;
						}

						var id = _this.clipId;
						var fromCache = _this.linkCache[id];
						var links = language.download + ' ...';
						if (fromCache) {
							links = Extore_Utils.popupMenu.prepareLinks.vimeo(fromCache.links, fromCache.title);
						}

						var menu = _this.currentMenu = Extore_Utils.frameMenu.getMenu(this, links, 'ext-frame-menu', {
							leftMenuPos: true,
							container: btnObj.container,
							onShow: function () {
								btnObj.node.classList.add('ext-over');
							},
							onHide: function () {
								_this.currentMenu = null;
								btnObj.node.classList.remove('ext-over');
							}
						});

						if (!fromCache) {
							_this.getLinksFromPage(function (links, title) {
								var menuLinks = language.noLinksFound;
								if (links) {
									_this.linkCache[id] = {links: links, title: title};
									menuLinks = Extore_Utils.popupMenu.prepareLinks.vimeo(links, title);
								}
								menu.update(menuLinks);
							});
						}
					}],
					['mousedown', function (e) {
						e.stopPropagation();
						if (e.button === 2) {
							if (observer) {
								observer.stop();
								observer = null;
							}

							_this.hideMenu();

							if (btnObj.container.parentNode) {
								btnObj.container.parentNode.removeChild(btnObj.container);
							}
						}
					}]
				]
			});

			btnObj.quickBtn.title = language.download;

			btnObj.container = mono.create('div', {
				class: 'ext-btn-ctr',
				append: btnObj.node
			});

			mono.on(btnObj.container, 'mouseenter', function () {
				btnObj.lockHide = true;
			});

			mono.on(btnObj.container, 'mouseleave', function () {
				btnObj.lockHide = false;
			});

			btnObj.node.appendChild(mono.create('style', {
				text: mono.style2Text([{
					selector: [
						'body:hover .ext-btn-ctr:not(.ext-hide-ui) #' + _this.panelId,
						'body:hover .ext-btn-ctr:not(.ext-hide-ui) .ext-frame-menu'
					],
					style: {
						display: 'block'
					}
				}])
			}));

			document.body.appendChild(btnObj.container);


			var observer = Extore_Utils.mutationWatcher.run({
				callback: function (summaryList) {
					var summary = summaryList[0];
					var node = summary.added[0];
					if (node) {
						_this.observeVideoUi(btnObj, node);
						setTimeout(function () {
							observer.stop();
							observer = null;
						}, 0);
					}
				},
				queries: [
					{css: '#player .captions[aria-live="assertive"]', is: 'added'}
				]
			});
		},

		appendAsIframeButtons: function (container) {
			var _this = this;
			var btnObj = Extore_Utils.frameMenu.getBtn({
				quickBtnStyleObj: {
					display: 'inline-block',
					border: 0,
					borderRadius: '.3em',
					cursor: 'pointer',
					position: 'relative',
					padding: '6px 8px'
				},
				quickBtnCssStyle: {
					backgroundColor: 'rgba(23,35,34,.75)'
				},
				quickBtnOverCssStyle: {
					backgroundColor: 'rgb(0, 173, 239)'
				},
				nodeCssStyle: {
					display: 'none'
				},
				singleBtn: true,
				btnId: _this.panelId,
				containerStyle: {
					left: '10px',
					top: '10px'
				},
				quickBtnIcon: mono.create(Extore_Utils.svg.getSvg('download', '#ffffff'), {
					style: {
						display: 'inline-block',
						width: '16px',
						height: '16px',
						verticalAlign: 'middle'
					}
				}),
				on: [
					['click', function (e) {
						e.preventDefault();
						e.stopPropagation();

						if (_this.currentMenu && _this.currentMenu.isShow) {
							_this.hideMenu();
							return;
						}

						var id = _this.clipId;
						var fromCache = _this.linkCache[id];
						var links = language.download + ' ...';
						if (fromCache) {
							links = Extore_Utils.popupMenu.prepareLinks.vimeo(fromCache.links, fromCache.title);
						}

						var menu = _this.currentMenu = Extore_Utils.frameMenu.getMenu(this, links, 'ext-frame-menu', {
							leftMenuPos: true,
							container: btnObj.container,
							onShow: function () {
								btnObj.node.classList.add('ext-over');
							},
							onHide: function () {
								_this.currentMenu = null;
								btnObj.node.classList.remove('ext-over');
							}
						});

						if (!fromCache) {
							_this.getLinksFromPage(function (links, title) {
								var menuLinks = language.noLinksFound;
								if (links) {
									_this.linkCache[id] = {links: links, title: title};
									menuLinks = Extore_Utils.popupMenu.prepareLinks.vimeo(links, title);
								}
								menu.update(menuLinks);
							});
						}
					}],
					['mousedown', function (e) {
						e.stopPropagation();
						if (e.button === 2) {
							if (observer) {
								observer.stop();
								observer = null;
							}

							_this.hideMenu();

							if (btnObj.container.parentNode) {
								btnObj.container.parentNode.removeChild(btnObj.container);
							}
						}
					}]
				]
			});


			btnObj.quickBtn.title = language.download;

			btnObj.container = mono.create('div', {
				class: 'ext-btn-ctr',
				append: btnObj.node
			});

			mono.on(btnObj.container, 'mouseenter', function () {
				btnObj.lockHide = true;
			});

			mono.on(btnObj.container, 'mouseleave', function () {
				btnObj.lockHide = false;
			});

			btnObj.node.appendChild(mono.create('style', {
				text: mono.style2Text([{
					selector: [
						'.player_container:hover .ext-btn-ctr:not(.ext-hide-ui) #' + _this.panelId,
						'.player_container:hover .ext-btn-ctr:not(.ext-hide-ui) .ext-frame-menu'
					],
					style: {
						display: 'block'
					}
				}])
			}));
			container.insertBefore(btnObj.container, container.firstElementChild);

			// container.appendChild(btnObj.container);


			var observer = Extore_Utils.mutationWatcher.run({
				callback: function (summaryList) {
					var summary = summaryList[0];
					var node = summary.added[0];
					if (node) {
						_this.observeVideoUi(btnObj, node);
						setTimeout(function () {
							observer.stop();
							observer = null;
						}, 0);
					}
				},
				queries: [
					{css: '.player_container .captions[aria-live="assertive"]', is: 'added'}
				]
			});
		},

		getLinksFromPage: function (cb) {
			var reList = [
				/"video":{/,
				/"request":{/,
				/"files":/
			];
			var scriptList = mono.getPageScript(document.body.innerHTML, reList);

			var config = null;
			scriptList.some(function (script) {
				var jsonList = mono.findJson(script, reList);
				return jsonList.some(function (json) {
					if (json.video && json.request && json.request.files) {
						config = json;
						return true;
					}
				});
			});
			var request = null;
			var links = null;
			var title = null;

			var onResponse = function (response) {
				if (response) {
					links = response.links || null;
					title = response.title || null;
				}

				return cb(links, title);
			};

			if (config) {
				request = {
					action: 'getVimeoLinksFromConfig',
					config: config
				};

				return mono.sendMessage(request, onResponse);
			} else {
				request = {
					action: 'getVimeoLinks',
					extVideoId: vimeo.clipId
				};

				return mono.sendMessage(request, onResponse);
			}
		},

		getLinksFromLoadDownloadConfig: function (id, links, cb) {
			if(!id || !links ||  !links.length){
				cb();
				return;
			}
			$.ajax({
				url: 'https://vimeo.com/' + id + '?action=load_download_config',
				method: 'GET',
			})
				.done(function (res) {
					if(
						!res.allow_downloads
						|| !res.files
						|| !res.files.length
						// || res.files.length <= links.length
					){
						//todo: track
						cb();
						return;
					}
					links = [];
					res.files.forEach(function (file) {
						links.push({
							ext: file.extension.toLowerCase(),
							format: file.extension,
							height: ''+file.height,
							name: file.extension + ' ' + file.height,
							type: file.extension,
							url: file.download_url,
							size: file.size
						})
					});
					cb(links);
				})
				.fail(function () {
					cb();
				});
		},

		videoFeed: {
			btnClassName: 'ext-feed-dl-btn',
			style: null,
			onClick: function (e) {
				e.preventDefault();
				e.stopPropagation();

				var id = this.dataset.sfId;

				if (vimeo.currentMenu && vimeo.currentMenu.isShow) {
					vimeo.hideMenu();
					return;
				}

				var fromCache = vimeo.linkCache[id];
				var links = language.download + ' ...';
				if (fromCache) {
					links = Extore_Utils.popupMenu.prepareLinks.vimeo(fromCache.links, fromCache.title);
				}

				var menu = vimeo.currentMenu = Extore_Utils.popupMenu.quickInsert(this, links, 'ext-popupMenu');

				if (fromCache) {
					return;
				}


				var url = null;
				if (/"url"/.test(id)) {
					url = JSON.parse(id).url;
					id = null;
				}

				mono.sendMessage({action: 'getVimeoLinks', extVideoId: id, url: url}, function (response) {
					var menuLinks = null;
					if (response.links) {
						vimeo.getLinksFromLoadDownloadConfig(id, response.links, function (links) {
							if(links && links.length){
								response.links = links;
							}
							vimeo.linkCache[id] = response;
							menuLinks = Extore_Utils.popupMenu.prepareLinks.vimeo(response.links, response.title);
							menu.update(menuLinks);
						});
					} else {
						menuLinks = language.noLinksFound;
						menu.update(menuLinks);
					}

				});
			},
			getBtn: function (details) {
				var btn = mono.create('i', {
					class: details.classList,
					data: {
						sfId: details.id,
						sfCouchMode: details.isCouchMode ? 1 : 0
					},
					on: ['click', this.onClick]
				});

				if (mono.isOpera) {
					btn.style.background = '#F8F8F8';
					btn.appendChild(mono.create('img', {
						src: Extore_Utils.svg.getSrc('download', '#777777'),
						style: {
							width: '12px',
							height: '12px',
							margin: '4px',
							backgroundColor: '#F8F8F8'
						}
					}));
				}
				return btn;
			},

			onImgOver2: function (e) {
				var link = this.parentNode;

				var parent;
				var id;

				if (link.tagName !== 'A') {
					return;
				}

				var href = link.getAttribute('href');
				if (!href) {
					return;
				}

				id = href.match(/^\/(\d+)$/);
				id = id && id[1];

				if (!id) {
					return;
				}

				parent = link.parentNode;
				if (!parent || !parent.classList.contains('contextclip-img')) {
					return;
				}

				if (parent.dataset.sfBtn > 0) {
					return;
				}
				parent.dataset.sfBtn = '1';

				var _this = vimeo.videoFeed;

				var classList = [_this.btnClassName, 'ext-type1-btn'];

				link.appendChild(vimeo.videoFeed.getBtn({
					id: id,
					classList: classList
				}));

				link = null;
				parent = null;
			},
			onImgOver: function (e) {
				var link = this.parentNode;
				var parent;
				var id;

				if (mono.matches(this, 'div.iris_video-vital') || mono.matches(this, 'li.clip_thumbnail')) {
					link = this.querySelector('.iris_thumbnail');
					parent = this;
					var linkNode = this.querySelector('a.iris_link-box');
					if (linkNode) {
						var url = linkNode.href;
						id = url.match(/\/([0-9]+)/);
						id = id && id[1];

						if (!id && url) {
							id = JSON.stringify({'url': url});
						}
					}
				}

				if (this.id == 'player') {
					id = window.location.href.match(/video\/(\d+)/);
					id = id && id[1];
					if (id) {
						vimeo.clipId = id;
						return vimeo.appendIframeButtons();
					}
				}

				if (this.classList.contains('player_container')) {
					parent = this;
					id = parent.id.match(/clip_(\d+)/);
					id = id && id[1];
					if (id) {
						link = parent.querySelector('.vp-player-inner');
					}
				}

				if (!id) {
					if (this.classList.contains('contextclip-img-thumb')) {
						parent = this.parentNode;
						link = this.parentNode;
						linkNode = this;
						url = linkNode.href;
						if (url) {
							id = url.match(/\/(\d+)/);
							id = id && id[1];
						}
					}
				}


				if (!id) {
					var imgCont = this.querySelector('._1cey_');
					if (imgCont && imgCont.href) {
						parent = this;
						link = this.querySelector('._2TMaD');
						id = imgCont.href.match(/\/(\d+)/);
						id = id && id[1];
					}

				}


				if (!id && link.tagName == 'LI') {
					id = link.dataset.resultId;
					if (id && id.substr(0, 5) === 'clip_') {
						id = id.substr(5);
						parent = link;
						link = this.querySelector('.thumbnail_wrapper');
					} else {
						return;
					}
				}

				if (!id) {
					if (link.tagName !== 'A') {
						return;
					}
					id = link.dataset.clipId;

					parent = link.parentNode;
					if (!parent) {
						return;
					}
				}
				var isCouchMode = false;
				if (!id) {
					id = parent.id;
					isCouchMode = id.substr(0, 7) === 'item_id' && parent.classList.contains('clip');
					if (!isCouchMode && id.substr(0, 4) !== 'clip') {
						id = undefined;
					}
					if (!id && parent.tagName === 'ARTICLE' && parent.classList.contains('clip_item')) {
						id = link.getAttribute('href');
					}
					if (!id) {
						return;
					}

					id = id.match(/([0-9]+)$/);
					if (id) {
						id = id[1];
					}
				}
				var hasBtn = parent.dataset.sfBtn;
				if (hasBtn) {
					return;
				}
				parent.dataset.sfBtn = '1';

				var _this = vimeo.videoFeed;

				var classList = [_this.btnClassName];

				if (this.classList.contains('thumbnail_lg_wide')) {
					classList.push('ext-type1-btn');
				}

				if (this.classList.contains('player_container')) {
					classList.push('ext-type5-btn');
				}

				if (this.classList.contains('contextclip-img-thumb')) {
					classList.push('ext-type4-btn');
				}

				if (this.classList.contains('clip_thumbnail') || this.classList.contains('iris_video-vital')) {
					classList.push('ext-type3-btn');
				}

				var ol = parent.parentNode;
				if (ol && ol.id === 'clips') {
					classList.push('ext-type1-btn');
					// classList.push('ext-type2-btn');
				}
				ol = null;

				if (isCouchMode) {
					classList.push('ext-type1-btn');
				}

				if (parent.classList.contains('promo_clip') && classList.length === 1) {
					classList.push('ext-type1-btn');
				}
				link.appendChild(vimeo.videoFeed.getBtn({
					id: id,
					classList: classList,
					isCouchMode: isCouchMode
				}));

				link = null;
				parent = null;
			},
			injectStyle: function () {
				if (this.style) {
					!this.style.parentNode && document.head.appendChild(this.style);
					return;
				}

				this.style = mono.create('style', {
					text: mono.style2Text([{
						selector: [
							'a > .ext-feed-dl-btn',
							'a .ext-feed-dl-btn.ext-type3-btn'
						],
						style: {
							display: 'none',
							border: '1px solid #F8F8F8',
							width: '20px',
							height: '20px',
							padding: 0,
							position: 'absolute',
							background: 'url(' + Extore_Utils.svg.getSrc('download', '#777777') + ') center no-repeat #F8F8F8',
							backgroundSize: '12px',
							top: 'auto',
							left: 'auto',
							lineHeight: 0
						}
					}, {
						selector: [
							'a > .ext-feed-dl-btn.ext-type1-btn',
							'a > div > .ext-feed-dl-btn.ext-type3-btn'
						],
						style: {
							top: 0
						}
					}, {
						selector: [
							'a > .ext-feed-dl-btn.ext-type2-btn'
						],
						style: {
							opacity: 0.5
						}
					}, {
						selector: [
							'a > div > .ext-feed-dl-btn.ext-type3-btn'
						],
						style: {
							zIndex: 10
						}
					}, {
						selector: [
							'div > .ext-feed-dl-btn.ext-type4-btn'
						],
						style: {
							display: 'none',
							border: '1px solid #F8F8F8',
							width: '20px',
							height: '20px',
							padding: 0,
							position: 'absolute',
							background: 'url(' + Extore_Utils.svg.getSrc('download', '#777777') + ') center no-repeat #F8F8F8',
							backgroundSize: '12px',
							top: 0,
							left: 0,
							lineHeight: 0,
							zIndex: 900
						}
					}, {
						selector: [
							'div > .ext-feed-dl-btn.ext-type5-btn'
						],
						style: {
							display: 'none',
							border: '1px solid #F8F8F8',
							width: '25px',
							height: '25px',
							padding: 0,
							position: 'absolute',
							background: 'url(' + Extore_Utils.svg.getSrc('download', '#777777') + ') center no-repeat #F8F8F8',
							backgroundSize: '12px',
							top: '2%',
							left: '2%',
							lineHeight: 0,
							zIndex: 900
						}
					},
						{
						selector: [
							'a > .ext-feed-dl-btn:hover',
							'a > div > .ext-feed-dl-btn.ext-type3-btn:hover',
							'div > .ext-feed-dl-btn.ext-type4-btn:hover',
							'div > .ext-feed-dl-btn.ext-type5-btn:hover',
						],
						style: {
							background: 'url(' + Extore_Utils.svg.getSrc('download', '#00B75A') + ') center no-repeat #F8F8F8',
							backgroundSize: '12px'
						}
					}, {
						selector: [
							'a > .ext-feed-dl-btn.ext-type2-btn:hover'
						],
						style: {
							opacity: 0.8
						}
					}, {
						selector: [
							'a > .ext-feed-dl-btn:active',
							'a > div > .ext-feed-dl-btn.ext-type3-btn:active'
						],
						style: {
							outline: 0,
							boxShadow: 'inset 0 3px 5px rgba(0, 0, 0, 0.125)'
						}
					}, {
						selector: [
							'a:hover > .ext-feed-dl-btn',
							'a:hover > div > .ext-feed-dl-btn.ext-type3-btn',
							'div:hover > .ext-feed-dl-btn.ext-type4-btn',
							'div:hover > .ext-feed-dl-btn.ext-type5-btn',
						],
						style: {
							display: 'block'
						}
					}, {
						selector: [
							'.ext_btn_new:hover',
						],
						style: {
							borderColor: '#08c !important',
							backgroundColor: '#08c !important',
							cursor: 'pointer',
						}
					}])
				});

				document.head.appendChild(this.style);
			},
			disable: function () {
				if (this.style) {
					this.style.parentNode && this.style.parentNode.removeChild(this.style);
				}
			},
			rmBtn: function () {
				var btnList = document.querySelectorAll('.ext-feed-dl-btn');
				for (var i = 0, item; item = btnList[i]; i++) {
					item.parentNode.removeChild(item);
				}

				var dataAttr = mono.dataAttr2Selector('sfBtn');
				var dataAttrList = document.querySelectorAll('[' + dataAttr + ']');
				for (i = 0, item; item = dataAttrList[i]; i++) {
					item.removeAttribute(dataAttr);
				}
			}
		},
		mutationMode: {
			observer: null,
			stop: function () {
				if (this.observer) {
					this.observer.stop();
				}
			},
			wrapOnImgOver: function () {
				vimeo.videoFeed.onImgOver.apply(this, arguments);
			},
			wrapOnImgOver2: function () {
				vimeo.videoFeed.onImgOver2.apply(this, arguments);
			},
			enable: function () {
				if (this.observer) {
					return this.observer.start();
				}

				this.observer = Extore_Utils.mutationWatcher.run({
					callback: function (summaryList) {
						var summary, n, i, node, styleIndex, videoId;

						summary = summaryList[0];
						for (n = 0; node = summary.added[n]; n++) {
							vimeo.hideMenu();

							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							styleIndex = 2;
							vimeo.appendBtn({id: '', parent: node, style: styleIndex, playerContainer: '#clip'});
						}

						summary = summaryList[1];
						for (n = 0; node = summary.added[n]; n++) {
							vimeo.hideMenu();

							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							var stats = node.querySelector('.stats') || node.querySelector('.time');
							if (!stats) {
								continue;
							}

							styleIndex = 1;
							vimeo.appendBtn({
								id: '',
								parent: stats,
								style: styleIndex,
								playerContainer: '#channel_clip_container'
							});
						}

						summary = summaryList[2];
						for (n = 0; node = summary.added[n]; n++) {

							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							if (node.id.substr(0, 5) !== 'clip_') {
								continue;
							}

							var videoData = vimeo.getBrowserVideoData(node, node.id);
							if (!videoData) {
								continue;
							}
							vimeo.appendBtn(videoData);
						}

						summary = summaryList[3];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';
							mono.one(node, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}

						summary = summaryList[4];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							var parent = mono.getParentByClass(node, 'clip_thumbnail');
							mono.one(parent, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}

						summary = summaryList[5];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							var parent = mono.getParentByClass(node, 'iris_video-vital');
							mono.one(parent, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}

						summary = summaryList[6];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							vimeo.hideMenu();

							var wrapper = mono.getParent(node, '.clip_info-wrapper');
							if (!wrapper) {
								continue;
							}

							var clipInfoActions = wrapper.querySelector('.clip_info-actions');
							if (!clipInfoActions) {
								continue;
							}
							styleIndex = 3;
							vimeo.appendBtn({
								id: '',
								parent: clipInfoActions,
								style: styleIndex,
								playerContainer: '.clip_main'
							});
						}

						summary = summaryList[7];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							vimeo.hideMenu();
							var wrapper = mono.getParent(node, '.clip_main-content');
							if (!wrapper) {
								continue;
							}
							var clipInfoActions = wrapper.querySelector('.clip_info-bcf .clip_info-actions');
							if (!clipInfoActions) {
								clipInfoActions = wrapper.querySelector('.clip_info-wrapper .clip_info-actions');
							}
							if (!clipInfoActions) {
								continue;
							}
							styleIndex = 5;
							vimeo.appendBtn({
								id: '',
								parent: clipInfoActions,
								style: styleIndex,
								playerContainer: '.clip_main'
							});
						}

						summary = summaryList[8];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';
							mono.one(node, 'mouseenter', vimeo.mutationMode.wrapOnImgOver2);
						}

						summary = summaryList[9];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							styleIndex = 4;
							vimeo.appendBtn({id: '', parent: node, style: styleIndex, playerContainer: '.clip'});
						}

						summary = summaryList[10];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							vimeo.hideMenu();
							styleIndex = 6;
							vimeo.appendBtn({id: '', parent: node, style: styleIndex, playerContainer: '.player'});
						}

						summary = summaryList[11];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							mono.one(node, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}

						summary = summaryList[12];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							node.dataset.sfSkip = '1';

							mono.one(node, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}

						summary = summaryList[13];
						for (n = 0; node = summary.added[n]; n++) {
							if (node.dataset.sfSkip > 0) {
								continue;
							}
							if(document.querySelector('.clip_info-subline--watch'))
							{
								return; //skip hover video btn where exists under video button in controls
							}
							node.dataset.sfSkip = '1';
							parent = mono.getParent(node, '.player_container');
							if(!parent)
							{
								parent = mono.getParent(node, '.player');
							}
							mono.one(parent, 'mouseenter', vimeo.mutationMode.wrapOnImgOver);
						}
					},

					queries: [
						{css: '#clip #info #tools', is: 'added'},
						{css: '#channel_clip_container #info .meta', is: 'added'},
						{css: '#browse_content ol.browse_videos_videos > li', is: 'added'},
						{css: 'img.thumbnail', is: 'added'},
						{css: '.clip_thumbnail .iris_thumbnail img', is: 'added'},
						{css: '.iris_video-vital .iris_thumbnail img', is: 'added'},
						{css: '.clip_main .clip_info a.js-user_link.iris_link-header', is: 'added'},
						{css: '.clip_main .clip_main-content div.iris_desc-content.description-content p', is: 'added'},
						{css: '.contextclip-img img', is: 'added'},
						{css: '.client_wrapper .clip header h1', is: 'added'},
						{css: '.clip_info-subline--watch', is: 'added'},
						{css: '._2iM3U._1Q6Ja._3myXE', is: 'added'},
						{css: '.contextclip-items-wrapper article .contextclip-img-thumb', is: 'added'},
						{css: '.vp-video-wrapper .vp-video video', is: 'added'},
					]
				});
			}
		}
	};

}, null, function syncIsActive() {
	"use strict";

	if (mono.isSafari || mono.isGM) {
		var list = [
			'*://*.vimeo.com/*'
		];

		var reStr = list.map(function (pattern) {
			return mono.urlPatternToStrRe(pattern);
		}).join('|');
		var re = new RegExp(reStr);

		if (!re.test(location.protocol + '//' + location.hostname)) {
			return false;
		}
	}

	return true;
});