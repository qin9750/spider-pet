/* 离线缓存：装好第一次联网打开之后，断网也能开。

   ★★ 2026-09-28 改版（用户需求2）：**联网优先（network-first）**。
   原来的写法是 cache-first —— 只要缓存里有就直接给缓存，
   结果是「改了代码、刷新页面还是旧版」，用户以为没更新。
   现在：
     · 有网 → 一律去网络拿最新的，拿到就顺手更新缓存（顺带把旧版本覆盖掉）
     · 断网 → 才回退到缓存（保住「没网也能开」这个能力）
     · 导航请求（打开网页本身）断网时回退缓存的 index.html
   配合 index.html 里的「注册时强制 update + 新 SW 接管后自动刷新一次」，
   打开就必然是当前版本。

   这份清单由 gen-sw.py 按目录内容自动生成，改了资源就同步改 VERSION。 */
var VERSION = 'pet-2026-09-28f'
var CACHE = 'xiaozhizhu-' + VERSION
var ASSETS = [
    './',
    'manifest.webmanifest',
    'icons/apple-touch-icon.png',
    'icons/favicon.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'lib/live2dcubismcore.min.js',
    'lib/pixi-live2d-display.min.js',
    'lib/pixi.min.js',
    'models/xiaozhizhu/pet.json',
    'models/xiaozhizhu/xiaozhizhu.1024/texture_00.png',
    'models/xiaozhizhu/xiaozhizhu.cdi3.json',
    'models/xiaozhizhu/xiaozhizhu.moc3',
    'models/xiaozhizhu/xiaozhizhu.model3.json',
    'index.html'
]

self.addEventListener('install', function (e) {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(function (c) {
    /* 单个资源失败不让整次安装挂掉（比如某个图标临时 404） */
    return Promise.all(ASSETS.map(function (u) {
      return c.add(u).catch(function () { })
    }))
  }))
})

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k) }))
  }).then(function () { return self.clients.claim() }))
})

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url
  try { url = new URL(req.url) } catch (err) { return }
  if (url.origin !== self.location.origin) return      // 跨域的直接放行，不掺和

  /* ---- 联网优先：先网络，成功了就更新缓存；失败才用缓存 ---- */
  e.respondWith(
    fetch(req).then(function (res) {
      /* 只缓存正常响应（别把 404 / 500 存起来，那样断网时会一直给错的） */
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone()
        caches.open(CACHE).then(function (c) { c.put(req, copy) }).catch(function () { })
      }
      return res
    }).catch(function () {
      /* 断网：回退缓存 */
      return caches.match(req).then(function (hit) {
        if (hit) return hit
        /* 导航请求（打开网页）还没缓存过 → 给缓存的首页兜底 */
        if (req.mode === 'navigate') return caches.match('index.html')
        return caches.match('./index.html')
      })
    })
  )
})
