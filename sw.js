// Service worker: guarda o app no aparelho para abrir sem internet.
// Estratégia "usa o que está guardado e atualiza em segundo plano": a versão nova aparece na abertura seguinte.
// Mudou algum arquivo? Aumente VERSAO para limpar o que ficou guardado.
const VERSAO = "v1";
const CACHE = `simulado-geografia-p1-${VERSAO}`;
const ARQUIVOS = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/api.js", "js/motor.js", "js/mascote.js", "js/quiz.js", "js/util.js",
  "questoes/geografia-regiao-sul.json",
  "img/icone.svg", "img/icone-192.png", "img/icone-512.png", "img/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const rede = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      return guardado || (await rede) || new Response("Sem internet e este arquivo ainda não foi guardado.", { status: 503 });
    }),
  );
});
