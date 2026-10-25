// Safari 分享時先在頁面裡執行，把 og / meta 資訊交給 Share Extension
// （NSExtensionJavaScriptPreprocessingFile）
var GetMetadata = function () {};

GetMetadata.prototype = {
  run: function (args) {
    function meta(names) {
      for (var i = 0; i < names.length; i++) {
        var el = document.querySelector('meta[property="' + names[i] + '"], meta[name="' + names[i] + '"]');
        var content = el && el.getAttribute('content');
        if (content && content.trim()) return content.trim();
      }
      return '';
    }

    var image = meta(['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
    if (image) {
      try {
        image = new URL(image, document.baseURI).href;
      } catch (e) {
        image = '';
      }
    }

    args.completionFunction({
      url: document.URL,
      title: meta(['og:title', 'twitter:title']) || document.title || '',
      description: meta(['og:description', 'twitter:description', 'description']),
      image: image
    });
  },

  finalize: function (args) {}
};

var ExtensionPreprocessingJS = new GetMetadata();
