/*
 * Service worker гайду: офлайн-режим і швидкі повторні відкриття.
 * Це шаблон: під час білду src/pwa/integration.mjs дописує зверху VERSION і PRECACHE
 * (усі файли з dist) і кладе результат у dist/sw.js.
 *
 * - Сторінка: спершу мережа, щоб правила й ціни були свіжі. Немає мережі або вона
 *   довше 4 с — показуємо збережену копію, а свіжа тихо докачується в кеш.
 * - _astro/*: файли з хешем у назві не змінюються — одразу з кешу.
 * - Решта своїх файлів (іконки, QR, маніфест): з кешу, з оновленням у фоні.
 * - Чужі домени (GoatCounter, API курсів) не чіпаємо.
 */
/* global VERSION, PRECACHE */

const CACHE = `vn-${VERSION}`;
const SCOPE = self.registration.scope;
// Гайд — одна сторінка: зберігаємо її під одним ключем, хоч би з яким ?q= чи #якорем відкрили
const PAGE = SCOPE;
const NETWORK_TIMEOUT_MS = 4000;
// Сервер може відповідати з Vary: Origin, а шрифти й модулі браузер просить з Origin — для кешу це неважливо
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PRECACHE.map(async (path) => {
      const url = new URL(path, SCOPE).href;
      const hashed = path.startsWith('_astro/');
      // Файли з хешем у назві не змінюються: є в попередньому кеші — не качаємо вдруге
      const old = hashed ? await caches.match(url, MATCH) : undefined;
      // Решту перевіряємо на сервері в обхід HTTP-кешу, щоб не зберегти стару сторінку
      const res = old ?? (await fetch(url, { cache: hashed ? 'default' : 'no-cache' }));
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await cache.put(url, res);
    }),
  );
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vn-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') event.respondWith(page(request, event));
  else if (new URL(request.url).pathname.includes('/_astro/')) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request, event));
});

async function page(request, event) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then((res) => {
    if (res.ok) return cache.put(PAGE, res.clone()).then(() => res);
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {
    // офлайн — нижче віддамо копію з кешу
  }
  return (await cache.match(PAGE, MATCH)) ?? network;
}

async function cacheFirst(request) {
  const cached = await caches.match(request, MATCH);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, MATCH);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  if (!cached) return network;
  event.waitUntil(network.catch(() => {}));
  return cached;
}
