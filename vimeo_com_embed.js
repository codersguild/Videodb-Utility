var vimeo_com_embed = {
  getVimeoLinks: function(request, callback) {

    "use strict";
    function callback_links(links, title, thumb) {
      var response = {
        action: request.action,
        extVideoId: request.extVideoId,
        links: links,
        title: title,
        thumb: thumb
      };

      callback(response);
    }

    vimeo_com_embed._getVimeoLinks(request.extVideoId, request.url, callback_links);
  },

  _getVimeoLinks: function(videoId, url, callback) {
    "use strict";
    vimeo_com_embed.getVimeoNoEmbedLinks(videoId, url, function(links, title, thumb){
      if(links) {
        return callback(links, title, thumb);
      }

      vimeo_com_embed.getVimeoEmbedLinks(videoId, callback);
    });
  },


  getVimeoEmbedLinks: function(videoId, callback) {
    "use strict";
    var abort = function() {
      return callback(null, '', '');
    };

    if (!videoId) {
      return abort();
    }

    mono.request({
      url: 'https://player.vimeo.com/video/' + videoId
    }, function(err, resp, data) {
      if (err || !data) {
        return abort();
      }

      var jsonList = mono.findJson(data, [/"files":/]);
      var config = null;
      jsonList.some(function(obj) {
        "use strict";
        if (!obj.video || !obj.request || !obj.request.files) {
          return;
        }

        config = obj;
        return true;
      });

      data = vimeo_com_embed.getLinksFromConfig(config);
      if (data) {
        return callback(data.links, data.title, data.thumb);
      }

      return abort();
    });
  },

  getVimeoConfig: function(url, cb) {
    "use strict";
    var abort = function() {
      return cb(null, '', '');
    };
    mono.request({
      url: url
    }, function(err, resp, data){
      if (err || !data) {
        return abort();
      }

      data = vimeo_com_embed.getVimeoDataFromConfig(data);
      if(data) {
        return cb(data.links, data.title, data.thumb);
      }

      return abort();
    });
  },

  getClipPageConfig: function(data, cb) {
    "use strict";
    var abort = function() {
      return cb(null, '', '');
    };

    var configUrl = null;
    var scriptList = mono.getPageScript(data, /['"]config_url['"]\s*:\s*/);
    scriptList.some(function(script) {
      var configList = mono.findJson(script, /['"]config_url['"]\s*:\s*/);
      return configList.some(function(config) {
        if (config.player) {
          configUrl = config.player.config_url;
          if (configUrl) {
            return true;
          }
        }
      });
    });
    if (configUrl) {
      return vimeo_com_embed.getVimeoConfig(configUrl, cb);
    }

    return abort();
  },

  getVimeoNoEmbedLinks: function(videoId, url, cb) {
    "use strict";
    var abort = function() {
      return cb(null, '', '');
    };

    if (videoId && url) {
      var isReview = /vimeo\.com\/[^\/]+\/review\/\d+/i.test(url);
      var isPrivate = /vimeo\.com\/\d+\/\w+/i.test(url);

      if (!isReview && !isPrivate) {
        url = null;
      }
    }

    mono.request({
      url: url || 'https://vimeo.com/' + videoId
    }, function(err, resp, data) {
      if (err || !data) {
        return abort();
      }

      var configUrl = data.match(/data-config-url=["']([^\s"'<>]+)/i);
      configUrl = configUrl && configUrl[1].replace(/&amp;/ig, '&');

      if(configUrl) {
        return vimeo_com_embed.getVimeoConfig(configUrl, cb);
      } else {
        return vimeo_com_embed.getClipPageConfig(data, cb);
      }
    });
  },

  getVimeoLinksFromConfig: function(msg, response) {
    "use strict";
    var data = vimeo_com_embed.getLinksFromConfig(msg.config);
    if(data) {
      return response(data);
    }

    return response(null);
  },

  getLinksFromConfig: function(config) {
    "use strict";
    if (!config || !config.video || !config.request || !config.request.files) {
      return null;
    }

    var video = config.video;
    var files = config.request.files;

    var data = {};

    data.title = video.title || '';

    var maxSize = null;
    for (var size in video.thumbs) {
      if (maxSize === null || maxSize < size) {
        maxSize = size;
        data.thumb = video.thumbs[size];
      }
    }

    data.links = [];

    var qualities = [];

    for (var type in files) {
      if (!Array.isArray(files[type])) {
        continue;
      }
      files[type].forEach(function(item) {
        if (!item || !item.url || !item.mime) {
          return;
        }

        var ext = item.mime.split('/')[1];
        if (!ext) {
          ext = item.url.match(/\.(\w{2,4})(?:\?|#|$)/i);
          ext = ext && ext[1] || 'mp4';
        }

        var extUp = ext.toUpperCase();

        var height = item.quality;
        if (/^\d+p$/.test(height)) {
          height = height.replace(/p$/, '');
        }

        var extQuality = extUp + ' ' + height;
        qualities.push(height);
        data.links.push({
          url: item.url,
          name: extQuality,
          height: height,
          type: extUp,
          format: extUp,
          ext: ext
        });
      });
    }

    if(files.dash && files.dash.streams){
      files.dash.streams.forEach(function (item) {
        var quality = item.quality.replace(/[^\d]/, '');
        if(qualities.indexOf(quality) == -1){
          qualities.push(quality);
          data.links.push({
            url: 'blocked',
            name: 'MP4 '+quality,
            height: quality,
            type: 'MP4',
            format: 'MP4',
            ext: 'mp4'
          })
        }
      })
    }

    if (!data.links.length) {
      data = null;
    }

    return data;
  },

  getVimeoDataFromConfig: function(config) {
    "use strict";
    config = config.replace(/(\{|,)\s*(\w+)\s*:/ig, '$1"$2":').
      replace(/(:\s+)\'/g, '$1"').replace(/\'([,\]\}])/g, '"$1');

    try {
      config = JSON.parse(config);
    } catch(err) {
      return null;
    }

    return this.getLinksFromConfig(config);
  }
};

if (typeof window === 'undefined') {
  exports.init = function(_mono, _engine) {
    mono = _mono;
    engine = _engine;
    return vimeo_com_embed;
  };
} else {
  engine.modules.vimeo = vimeo_com_embed;
}
