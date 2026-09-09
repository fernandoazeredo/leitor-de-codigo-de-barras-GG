const CACHE='leitor-gg-v5';
const ANTIGOS=['leitor-gg-v1','leitor-gg-v2','leitor-gg-v3','leitor-gg-v4'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/manifest.webmanifest','/icon.svg'])))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all(ANTIGOS.map(c=>caches.delete(c))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));});
