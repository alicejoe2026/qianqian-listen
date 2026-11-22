/* 浅浅静听 · 离线缓存
   只缓存应用外壳与内置素材；用户导入的音乐保存在 IndexedDB 中，不经过这里。 */
'use strict';

const CACHE = 'qianqian-mobile-v4';
const CORE = [
  './',
  './index.html',
  './style.css',
  './mobile.css',
  './fm.css',
  './app.js',
  './mobile.js',
  './online-lyrics.js',
  './online-covers.js',
  './fm-engine.js',
  './fm-worker.js',
  './fm.js',
  './playback-shortcuts.js',
  './site.webmanifest',
  './assets/logo-dog.svg',
  './assets/app-icon.svg',
  './assets/icon.svg',
  './assets/forest.svg',
  './assets/evening.svg',
  './assets/rain.svg',
  './assets/icon-192.png',
  './assets/icon-180.png',
  './assets/icon-512.png',
  './assets/forest.wav',
  './assets/evening.wav',
  './assets/rain.wav'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async url => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* 单个资源失败不影响安装 */ }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // 在线歌词/封面交给网络

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) {
      fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res)).catch(() => {});
      }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
