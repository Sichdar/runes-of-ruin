/* Runes of Ruin - service worker
 * Makes the game load offline.
 * To ship an update to phones: bump CACHE_VERSION below (e.g. 'v2'), then re-upload the files.
 */
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'runes-of-ruin-' + CACHE_VERSION;
const FONT_CACHE = 'runes-of-ruin-fonts'; // survives version bumps on purpose

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'js/core.js',
  'js/levels.js',
  'js/boss.js',
  'js/board.js',
  'js/art.js',
  'js/audio.js',
  'js/view.js',
  'js/ui.js',
  'js/cloister.js',
  'js/daily.js',
  'js/main.js',
  'assets/art-overrides.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// Install: add files one by one so a missing file never blocks the install.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await cache.put(url, res);
      } catch (err) {
        console.warn('[sw] precache failed for', url, String(err));
      }
    }));
    await self.skipWaiting();
  })());
});

// Activate: remove old game caches.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('runes-of-ruin-') && k !== CACHE_NAME && k !== FONT_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Stale-while-revalidate: answer from cache at once, refresh the cache in the background.
async function staleWhileRevalidate(request, cacheName, ignoreSearch) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: !!ignoreSearch });
  const network = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { network.catch(() => {}); return cached; }
  const res = await network;
  if (res) return res;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache at runtime so text still looks right offline.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE, false));
    return;
  }

  if (url.origin !== self.location.origin) return; // everything else cross-origin: leave alone

  // Page loads: if offline and the exact URL isn't cached, fall back to the cached index.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const res = await staleWhileRevalidate(req, CACHE_NAME, true);
      if (res.status === 503) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('index.html')) || (await cache.match('./')) || res;
      }
      return res;
    })());
    return;
  }

  event.respondWith(staleWhileRevalidate(req, CACHE_NAME, false));
});
