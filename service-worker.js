// Guarda os arquivos do jogo para funcionar offline.
// Ao mudar qualquer arquivo do jogo, aumente a VERSAO para os aparelhos baixarem a nova.
const VERSAO = 'davizeira-v8';

const SPRITES = [
  'icone_2', 'icone_3', 'icone_4', 'icone_5', 'icone_6', 'icone_7',
  'pedal_0', 'pedal_1', 'pedal_2', 'pedal_3', 'pedal_4', 'pedal_5',
  'abaixado_0', 'abaixado_1', 'abaixado_2', 'abaixado_3', 'abaixado_4', 'abaixado_5',
  'sobe_0', 'sobe_1', 'sobe_2', 'sobe_3',
  'roda_0', 'roda_1', 'roda_2',
  'pulo_0', 'pulo_1', 'pulo_2', 'pulo_3', 'pulo_4',
].map((nome) => `./assets/sprites/${nome}.png`);

const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/davi-impinando.jpg',
  './assets/davi-impinando-mascara.png',
  ...SPRITES,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

// Apaga caches de versões antigas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Fonte do Google: guarda na primeira vez para usar offline depois
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(VERSAO + '-fontes').then(async (cache) => {
        const salvo = await cache.match(e.request);
        if (salvo) return salvo;
        const resposta = await fetch(e.request);
        cache.put(e.request, resposta.clone());
        return resposta;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Arquivos do jogo: tenta a rede (versão mais nova) e cai para o cache offline
  e.respondWith(
    fetch(e.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(VERSAO).then((cache) => cache.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
