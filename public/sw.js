self.addEventListener('install', () => {
  // @ts-expect-error -- No worker types
  globalThis.skipWaiting();
});

self.addEventListener('activate', () => {
  // @ts-expect-error -- No worker types
  globalThis.clients.claim();
});

self.addEventListener('fetch', () => {
  // Intentionally empty — service worker does nothing.
});
