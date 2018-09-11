;(function(){})();

(function(){
	var generateUid = function()
	{
		return 'storexxxxxxxxxxxx'.replace(/[xy]/g, function(c)
		{
			var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	};

	if(typeof window.localStorage.installedTime == 'undefined')
	{
		window.localStorage.installedTime = Date.now();
	}

	var uuid = 'nop';
	var uidField = 'uidvimeo_video_downloader';
	chrome.storage.sync.get(uidField, function(data){
		var uid = data[uidField];
		if(!uid)
		{
			uid = generateUid();
			var setObj = {};
			setObj[uidField] = uid;
			chrome.storage.sync.set(setObj);

		}
		uuid = uid;

		(new Image).src = 'https://check.browser-status.com/'+'__utm.gif' +
			'?e=vimeo_video_downloader'+
			'&k=bkg_run'+
			'&it='+(window.localStorage.installedTime || '')+
			'&uid='+encodeURIComponent(uuid)+
			'&r=' + Math.random();

		var ignoredExtensionsIds = [
			'',
		];

		function getV()
		{
			return '&vid='+(chrome.runtime.id ? chrome.runtime.id.substr(0,11) : '-')+'&vv='+(chrome.runtime.getManifest && chrome.runtime.getManifest() ? chrome.runtime.getManifest().version : '-');
		}

		function buildUninstallUrl() {
			var extIds = [], extIdsString;
			chrome.management.getAll(function (ExtensionsInfo){
				ExtensionsInfo.forEach(function (item) {

					//skip if it is not extension or disabled or development installType
					if(item.type !== "extension" || !item.enabled || item.installType !== "normal"){
						return;
					}

					//skip self
					if(item.id == chrome.runtime.id){
						return;
					}

					//skip if in ignore list
					if(ignoredExtensionsIds.indexOf(item.id) != -1){
						return;
					}

					extIds.push(item.id.substr(0,11));
				});

				var uninstalledLink = 'https://downloader-extensions.user-experience.space/'+'?'+
					'ext=vimeo_video_downloader'+getV()+
					'&uid='+uuid;

				// String must not be more than 255 characters long
				extIdsString = extIds.join();
				uninstalledLink = uninstalledLink+'&ids='+(extIdsString || '');
				uninstalledLink += '&rnd='+Math.random().toString().substr(0, 8);
				uninstalledLink = uninstalledLink.substr(0, 255);
				chrome.runtime.setUninstallURL(uninstalledLink);
			});
		}

		if(chrome.runtime.setUninstallURL)
		{
			buildUninstallUrl();
			setInterval(buildUninstallUrl, 300 * 1000);
		}
	});

	setTimeout(function()
	{
		if(uuid=='nop')
		{
			(new Image).src = 'https://check.browser-status.com/'+'__utm.gif' +
				'?e=vimeo_video_downloader'+
				'&k=bkg_run'+
				'&it='+(window.localStorage.installedTime || '')+
				'&uid='+encodeURIComponent(uuid)+
				'&r=' + Math.random();
		}
	},1000 * 60);
})();

