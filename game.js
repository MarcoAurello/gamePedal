// =====================================================================
//  Davizeira no Pedal — Developed by Marco Nunes
//  Canvas 2D + JavaScript puro. Mundo lógico com 540px de altura.
// =====================================================================

const ALTURA = 540;          // altura lógica do mundo
const CHAO = 470;            // y da rua (onde as rodas encostam)
const ESCALA_SPRITE = 0.72;  // tamanho do Davi na tela

const FISICA = {
  gravidade: 2600,
  gravidadeSegurando: 1650,  // segurar o pulo deixa o salto mais alto
  impulso: 840,
  impulsoRampa: 1080,
  velInicial: 330,
  velMaxima: 720,
  aceleracao: 7,             // px/s a cada segundo
};

// Especial: liberado ao bater a meta de pontos; o botão fica um tempo e some
const ESPECIAL = {
  primeiraMeta: 1000,
  intervalo: 1500,           // próxima meta = anterior + intervalo + 500 × vezes já liberado
  duracaoBotao: 7,           // segundos até o botão sumir
  impulso: 1250,             // pulão da manobra
  giro: 0.9,                 // segundos para o mortal de 360°
  pontos: 300,
  pontosPorQuebra: 50,
};

// Equilíbrio ao impinar: segurar gasta, soltar recupera. Zerou, o Davi cai.
const EQUILIBRIO = {
  gastoSegurando: 42,        // pontos por segundo segurando na roda (~2,4 s até cair)
  recuperaSoltando: 110,     // pontos por segundo com o botão solto
  subida: 3,                 // velocidade para levantar a roda
  descida: 1.3,              // soltar baixa a roda devagar (dá tempo de apertar de novo)
  naRoda: 0.75,              // a partir daqui conta como "impinando" (pontos ×2)
};

// Ajustes finos de alguns quadros recortados (sx = corte à esquerda, ox = deslocamento)
const AJUSTE = {
  sobe_3: { sx: 44 },
  pulo_1: { ox: -22 },
};

// ---------------------------------------------------------------------
//  Carregamento das imagens
// ---------------------------------------------------------------------
const NOMES = [
  ...[0, 1, 2, 3, 4, 5].map((i) => 'pedal_' + i),
  ...[0, 1, 2, 3].map((i) => 'sobe_' + i),
  ...[0, 1, 2].map((i) => 'roda_' + i),
  ...[0, 1, 2, 3, 4].map((i) => 'pulo_' + i),
  'icone_3', 'icone_4', 'icone_5', 'icone_6', 'icone_7',
];

const IMG = {};
function carregarImagens() {
  return Promise.all(NOMES.map((nome) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok();
    img.onerror = () => { console.warn('Faltou a imagem', nome); ok(); };
    img.src = `assets/sprites/${nome}.png`;
    IMG[nome] = img;
  })));
}

// ---------------------------------------------------------------------
//  Tela e escala (mantém 540 de altura lógica; largura se adapta)
// ---------------------------------------------------------------------
const canvas = document.getElementById('tela');
const ctx = canvas.getContext('2d');
let LARGURA = 960;
let escala = 1, deslocY = 0, dpr = 1;

// Zoom da câmera: em telas baixas (celular deitado) mostra menos céu e tudo fica maior
let VISTA = ALTURA;          // altura do mundo que aparece na tela
let cameraTopo = 0;          // y do mundo no topo da tela (sobe quando o Davi pula alto)

function ajustarTela() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  const zoom = h <= 440 ? 1.5 : h <= 620 ? 1.25 : 1;
  VISTA = Math.round(ALTURA / zoom);
  LARGURA = Math.max(560, Math.min(1280, Math.round(VISTA * (w / h))));
  escala = Math.min(w / LARGURA, h / VISTA);
  deslocY = (h - VISTA * escala) / 2;   // celular em pé: faixa no meio
  cameraTopo = ALTURA - VISTA;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.imageSmoothingEnabled = false;
}

// A câmera fica embaixo (rua sempre visível) e sobe suave quando o Davi vai alto
function atualizarCamera(dt) {
  const base = ALTURA - VISTA;
  const j = jogo.jogador;
  const precisa = CHAO - j.y - 230;            // espaço para o Davi + barra em cima dele
  const alvo = Math.min(base, precisa);
  cameraTopo += (alvo - cameraTopo) * Math.min(1, dt * 7);
}
window.addEventListener('resize', ajustarTela);

// ---------------------------------------------------------------------
//  Números aleatórios com semente (cenário sempre igual)
// ---------------------------------------------------------------------
function semente(s) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------
//  Cenário da quebrada (desenhado uma vez em canvases e repetido)
// ---------------------------------------------------------------------
const CENARIO = {};

function criarCamada(largura, altura, desenhar) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  desenhar(g, largura, altura);
  return c;
}

// ----- Peças do cenário (estilo das ruas do bairro: casas térreas, cobogó, grades) -----
const COR = {
  telha: '#c65a2e',
  telhaClara: '#dc7140',
  telhaEscura: '#963d1d',
  branco: '#f2f2ee',
  sombra: 'rgba(0,0,0,0.16)',
};

function retangulo(g, cor, x, y, w, h) {
  g.fillStyle = cor;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Telhado de barro visto de frente (fileiras de telha que afinam para cima)
function telhado(g, x, y, w, h) {
  for (let yy = y, linha = 0; yy < y + h; yy += 6, linha++) {
    const recuo = Math.round((y + h - yy) * 0.45);
    retangulo(g, linha % 2 ? COR.telha : COR.telhaClara, x - 8 + recuo, yy, w + 16 - recuo * 2, 6);
    g.fillStyle = COR.telhaEscura;
    for (let xx = x - 8 + recuo + (linha % 2) * 4; xx < x + w + 8 - recuo - 3; xx += 8) g.fillRect(xx, yy + 5, 4, 1);
  }
  retangulo(g, COR.telhaEscura, x - 10, y + h - 2, w + 20, 4);   // beiral
}

// Cobogó de bolinhas (muro vazado)
function cobogoBolinhas(g, x, y, w, h, parede, furo) {
  retangulo(g, parede, x, y, w, h);
  g.fillStyle = furo;
  let linha = 0;
  for (let yy = y + 7; yy < y + h - 4; yy += 10, linha++) {
    for (let xx = x + 7 + (linha % 2) * 5; xx < x + w - 4; xx += 10) {
      g.beginPath();
      g.arc(xx, yy, 3.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  retangulo(g, COR.sombra, x, y, w, 3);
}

// Cobogó quadradinho
function cobogoQuadrado(g, x, y, w, h, cor, furo) {
  retangulo(g, cor, x, y, w, h);
  g.fillStyle = furo;
  for (let yy = y + 3; yy + 6 <= y + h - 2; yy += 9) {
    for (let xx = x + 3; xx + 6 <= x + w - 2; xx += 9) g.fillRect(xx, yy, 6, 6);
  }
}

// Grade de losango (janelas e portas)
function grade(g, x, y, w, h, fundo, cor) {
  retangulo(g, fundo, x, y, w, h);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = cor;
  g.lineWidth = 1.6;
  for (let k = -h; k < w + h; k += 9) {
    g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); g.stroke();
    g.beginPath(); g.moveTo(x + k + h, y); g.lineTo(x + k, y + h); g.stroke();
  }
  g.restore();
  g.strokeStyle = cor;
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
}

// Portão de barras verticais
function portaoBarras(g, x, y, w, h, cor, fundo) {
  retangulo(g, fundo, x, y, w, h);
  g.fillStyle = cor;
  for (let xx = x + 2; xx < x + w - 1; xx += 6) g.fillRect(xx, y, 2, h);
  g.fillRect(x, y, w, 3);
  g.fillRect(x, y + h * 0.5, w, 2);
  g.fillRect(x, y + h - 3, w, 3);
  g.fillRect(x, y, 3, h);
  g.fillRect(x + w - 3, y, 3, h);
}

// Portão de chapa com barras em cima (garagem)
function portaoChapa(g, x, y, w, h) {
  const topo = h * 0.3;
  portaoBarras(g, x, y, w, topo, '#e9ece9', '#55605c');
  retangulo(g, '#d8dbd9', x, y + topo, w, h - topo);
  g.fillStyle = '#bcc2c1';
  for (let xx = x + 3; xx < x + w - 2; xx += 6) g.fillRect(xx, y + topo, 2, h - topo);
  retangulo(g, '#9aa1a0', x + w / 2 - 1, y + topo, 2, h - topo);
  retangulo(g, '#7d8483', x + w / 2 + 6, y + topo + 30, 4, 8);   // fechadura
}

// Fachada de azulejo branco
function azulejos(g, x, y, w, h) {
  retangulo(g, '#eef1f2', x, y, w, h);
  g.fillStyle = '#c4ccd1';
  for (let xx = x; xx < x + w; xx += 14) g.fillRect(xx, y, 1, h);
  for (let yy = y; yy < y + h; yy += 14) g.fillRect(x, yy, w, 1);
}

function janelaVidro(g, x, y, w, h) {
  retangulo(g, COR.branco, x - 3, y - 3, w + 6, h + 6);
  retangulo(g, '#3a5566', x, y, w, h);
  retangulo(g, '#5f7f92', x, y, w, h * 0.35);
  g.fillStyle = COR.branco;
  for (let xx = x + w / 4; xx < x + w - 2; xx += w / 4) g.fillRect(Math.round(xx), y, 3, h);
}

function veneziana(g, x, y, w, h) {
  retangulo(g, '#e4e4dc', x, y, w, h);
  g.fillStyle = '#b5b5aa';
  for (let yy = y + 2; yy < y + h; yy += 4) g.fillRect(x, yy, w, 1);
  g.strokeStyle = COR.branco;
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
}

function caixaDagua(g, x, base) {
  retangulo(g, '#2f6fd0', x, base - 14, 24, 14);
  retangulo(g, '#2357a8', x - 1, base - 17, 26, 4);
  retangulo(g, '#5c93e6', x + 3, base - 12, 4, 9);
}

function gradil(g, x, y, w, h) {
  g.fillStyle = COR.branco;
  g.fillRect(x, y, w, 3);
  for (let xx = x + 2; xx < x + w; xx += 7) g.fillRect(xx, y, 2, h);
}

function coqueiro(g, x, base, alt, rnd) {
  const curva = rnd() < 0.5 ? -1 : 1;
  let topoX = x, topoY = base - alt;
  for (let i = 0; i < alt; i += 4) {
    const dx = Math.sin(i / alt * 1.4) * 14 * curva;
    retangulo(g, i % 8 ? '#8a6a45' : '#735738', x + dx, base - i - 4, 6, 5);
    topoX = x + dx; topoY = base - i - 4;
  }
  const folhas = [-2.9, -2.4, -1.9, -1.2, -0.7, -0.2, 0.4];
  for (const a of folhas) {
    for (let t = 0; t <= 1; t += 0.08) {
      const fx = topoX + 3 + Math.cos(a) * t * 40;
      const fy = topoY + Math.sin(a) * t * 22 + t * t * 26;
      retangulo(g, t < 0.5 ? '#3d8b3a' : '#2f6e2c', fx, fy, 5, 4);
    }
  }
  retangulo(g, '#6b4a2a', topoX, topoY + 2, 8, 6);   // cocos
}

function poste(g, x, base, alt) {
  retangulo(g, '#a7a8a2', x, base - alt, 8, alt);
  retangulo(g, '#8b8c86', x + 6, base - alt, 2, alt);
  retangulo(g, '#7a7b76', x - 16, base - alt + 10, 40, 5);
  retangulo(g, '#4a4a48', x - 14, base - alt + 6, 4, 4);
  retangulo(g, '#4a4a48', x + 18, base - alt + 6, 4, 4);
}

// ----- Casas (cada uma devolve a largura que ocupou) -----
function casaTerrea(g, x, base, rnd) {
  const w = 270 + Math.floor(rnd() * 40);
  const parede = ['#cfe8d2', '#e9efe6', '#efe4c4', '#f1d6c8'][Math.floor(rnd() * 4)];
  retangulo(g, parede, x + 18, base - 168, w - 36, 168);
  telhado(g, x + 18, base - 200, w - 36, 34);
  grade(g, x + w * 0.52, base - 150, 84, 58, '#2c3236', '#f4f4f0');
  // cobertura da garagem com "babadinho"
  retangulo(g, COR.branco, x, base - 152, 118, 16);
  g.fillStyle = COR.branco;
  for (let xx = x; xx < x + 118; xx += 12) {
    g.beginPath(); g.moveTo(xx, base - 136); g.lineTo(xx + 6, base - 128); g.lineTo(xx + 12, base - 136); g.fill();
  }
  retangulo(g, parede, x, base - 136, 8, 136);
  portaoBarras(g, x + 10, base - 120, 100, 114, '#f4f4f0', '#8f9a92');
  retangulo(g, '#c66a3d', x + 8, base - 6, 104, 6);   // degrau
  // muro de cobogó com gradil
  retangulo(g, parede, x + 112, base - 128, 10, 128);
  cobogoBolinhas(g, x + 122, base - 70, w - 122, 70, parede, '#b58a68');
  retangulo(g, parede, x + 122, base - 80, w - 122, 10);
  gradil(g, x + 122, base - 122, w - 122, 42);
  return w;
}

function casaAzulejo(g, x, base, rnd) {
  const w = 240 + Math.floor(rnd() * 30);
  azulejos(g, x + 34, base - 150, w - 68, 150);
  telhado(g, x + 34, base - 182, w - 68, 32);
  caixaDagua(g, x + 60, base - 184);
  caixaDagua(g, x + 92, base - 184);
  grade(g, x + w * 0.5, base - 140, 78, 44, '#3a4044', '#eef1f2');
  retangulo(g, '#3b2e24', x + 52, base - 140, 34, 60);
  // muro de azulejo
  azulejos(g, x + 62, base - 96, w - 62, 96);
  retangulo(g, '#c4ccd1', x + 62, base - 98, w - 62, 3);
  portaoBarras(g, x, base - 110, 60, 110, '#e8ebe6', '#7c8580');
  retangulo(g, '#3e3e3e', x + 76, base - 84, 26, 12);
  g.fillStyle = '#ffffff';
  g.font = '9px monospace';
  g.fillText(String(10 + Math.floor(rnd() * 90)), x + 79, base - 74);
  return w;
}

function sobradoRosa(g, x, base, rnd) {
  const w = 230;
  const rosa = ['#ec8fb0', '#f2a7c2', '#e77fa4'][Math.floor(rnd() * 3)];
  retangulo(g, rosa, x, base - 262, w, 262);
  retangulo(g, COR.sombra, x, base - 262, w, 4);
  janelaVidro(g, x + 18, base - 250, w - 36, 46);
  cobogoQuadrado(g, x + 18, base - 196, w - 36, 28, '#f6f1ef', '#6b4057');
  retangulo(g, COR.branco, x + 14, base - 168, w - 28, 4);
  grade(g, x + 40, base - 150, 54, 50, '#5a6a72', '#f4f4f0');
  grade(g, x + 118, base - 158, 56, 104, '#2a2a2a', '#c9c9c9');
  // mureta com losangos laranja
  retangulo(g, rosa, x, base - 56, w - 50, 56);
  retangulo(g, COR.branco, x, base - 60, w - 50, 5);
  g.fillStyle = '#e8743b';
  for (let i = 0; i < 3; i++) {
    const cx = x + 40 + i * 60, cy = base - 30;
    g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx + 8, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 8, cy); g.fill();
  }
  grade(g, x + w - 46, base - 66, 40, 30, '#9aa3a6', '#e0607e');
  retangulo(g, '#c9c9c9', x + w - 46, base - 36, 40, 36);
  return w;
}

function sobradoBranco(g, x, base, rnd) {
  const w = 260;
  retangulo(g, '#f0f0ec', x, base - 240, w, 240);
  retangulo(g, COR.sombra, x, base - 240, w, 4);
  veneziana(g, x + 60, base - 228, 150, 46);
  gradil(g, x + 60, base - 228, 150, 46);
  cobogoBolinhas(g, x + 60, base - 172, 150, 22, '#f0f0ec', '#b8bcb6');
  // antena parabólica
  g.fillStyle = '#d7d9d6';
  g.beginPath(); g.arc(x + 30, base - 200, 16, 0, Math.PI * 2); g.fill();
  retangulo(g, '#9a9d9a', x + 28, base - 186, 4, 18);
  // toldo
  retangulo(g, '#cfcfc4', x - 4, base - 136, w + 8, 14);
  g.fillStyle = '#b4b4a8';
  for (let xx = x; xx < x + w; xx += 10) g.fillRect(xx, base - 136, 2, 14);
  portaoChapa(g, x + 8, base - 120, w - 80, 120);
  portaoBarras(g, x + w - 64, base - 120, 56, 120, '#e9ece9', '#5b6662');
  return w;
}

function muroLaranja(g, x, base, rnd) {
  const w = 320;
  coqueiro(g, x + 70, base - 60, 170, rnd);
  coqueiro(g, x + 230, base - 60, 200, rnd);
  retangulo(g, '#b9b4a8', x + 120, base - 150, 120, 60);   // casa lá atrás
  telhado(g, x + 120, base - 172, 120, 22);
  retangulo(g, '#f3f3f0', x, base - 100, w, 100);
  retangulo(g, '#d5d5cf', x, base - 104, w, 5);
  for (let i = 0; i < 3; i++) cobogoQuadrado(g, x + 24 + i * 96, base - 82, 72, 30, '#e8743b', '#7a2e12');
  retangulo(g, COR.sombra, x, base - 12, w, 12);
  return w;
}

function montarCenario() {
  // Nuvens
  const rndN = semente(3);
  CENARIO.nuvens = criarCamada(1400, 120, (g, w) => {
    for (let i = 0; i < 6; i++) {
      const cx = 80 + i * 230 + rndN() * 80, cy = 30 + rndN() * 50;
      for (let k = 0; k < 6; k++) retangulo(g, '#ffffff', cx + k * 14 - 20, cy - (k % 3) * 8, 34, 16 + (k % 3) * 8);
      retangulo(g, '#e3f1fb', cx - 20, cy + 14, 104, 6);
    }
  });

  // Fundo: prédios claros, caixas d'água e coqueiros ao longe
  const rnd1 = semente(7);
  CENARIO.fundo = criarCamada(1600, 260, (g, w, h) => {
    let x = 0;
    while (x < w) {
      const pw = 60 + Math.floor(rnd1() * 90), ph = 70 + Math.floor(rnd1() * 150);
      const tom = ['#a9c3d8', '#b9d0e2', '#9fb8cc'][Math.floor(rnd1() * 3)];
      retangulo(g, tom, x, h - ph, pw, ph);
      g.fillStyle = 'rgba(60,90,120,0.25)';
      for (let yy = h - ph + 10; yy < h - 10; yy += 16) for (let xx = x + 8; xx < x + pw - 8; xx += 14) g.fillRect(xx, yy, 7, 6);
      if (rnd1() < 0.4) retangulo(g, '#6f9fd8', x + 10, h - ph - 10, 18, 10);
      x += pw + Math.floor(rnd1() * 30);
    }
    g.globalAlpha = 0.75;
    for (let p = 40; p < w; p += 180 + rnd1() * 160) coqueiro(g, p, h, 120 + rnd1() * 80, rnd1);
    g.globalAlpha = 1;
  });

  // Casas da rua, uma seguida da outra, com postes e fiação
  const rnd2 = semente(42);
  const tipos = [casaTerrea, casaAzulejo, sobradoRosa, sobradoBranco, muroLaranja];
  CENARIO.casas = criarCamada(2600, 330, (g, w, h) => {
    let x = 0, anterior = -1;
    while (x < w - 200) {
      let t = Math.floor(rnd2() * tipos.length);
      if (t === anterior) t = (t + 1) % tipos.length;
      anterior = t;
      x += tipos[t](g, x, h, rnd2) + 6 + Math.floor(rnd2() * 14);
    }
    // fecha a emenda com um muro simples
    retangulo(g, '#ecebe4', x, h - 96, w - x, 96);
    cobogoBolinhas(g, x, h - 60, w - x, 60, '#ecebe4', '#b7b2a8');

    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 1.5;
    for (let p = 140; p < w; p += 430) {
      poste(g, p, h, 300);
      for (const dy of [8, 14]) {
        g.beginPath();
        g.moveTo(p - 14, h - 300 + dy);
        g.quadraticCurveTo(p + 215, h - 300 + dy + 40, p + 444, h - 300 + dy);
        g.stroke();
      }
    }
  });

  // Rua de paralelepípedo
  const rnd3 = semente(11);
  CENARIO.rua = criarCamada(320, ALTURA - CHAO + 220, (g, w, h) => {
    retangulo(g, '#6f6b65', 0, 0, w, h);
    const tons = ['#9b968e', '#8a867f', '#a6a198', '#938f88'];
    for (let y = 0, linha = 0; y < h; y += 11, linha++) {
      for (let x = (linha % 2) * -9; x < w; x += 18) {
        retangulo(g, tons[Math.floor(rnd3() * tons.length)], x + 1, y + 1, 16, 9);
        retangulo(g, 'rgba(255,255,255,0.12)', x + 1, y + 1, 16, 2);
      }
    }
  });
}

function desenharCenario(t) {
  // céu de dia
  const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
  ceu.addColorStop(0, '#3f9be6');
  ceu.addColorStop(0.6, '#8ccaf3');
  ceu.addColorStop(1, '#d8effc');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, -200, LARGURA, CHAO + 200);

  repetir(CENARIO.nuvens, t * 0.04, 20);
  repetir(CENARIO.fundo, t * 0.18, CHAO - 22 - 260 - 30);
  repetir(CENARIO.casas, t * 0.55, CHAO - 22 - 330);

  // calçada de cerâmica
  retangulo(ctx, '#d6d2c9', 0, CHAO - 22, LARGURA, 22);
  ctx.fillStyle = '#b9b3a8';
  const off = t % 22;
  for (let x = -off; x < LARGURA; x += 22) ctx.fillRect(Math.round(x), CHAO - 22, 1, 17);
  ctx.fillRect(0, CHAO - 12, LARGURA, 1);
  // meio-fio
  retangulo(ctx, '#f1f1ec', 0, CHAO - 6, LARGURA, 6);
  retangulo(ctx, '#a9a8a2', 0, CHAO - 1, LARGURA, 2);

  // postinhos com topo amarelo
  const offB = t % 170;
  for (let x = -offB + 40; x < LARGURA + 10; x += 170) {
    retangulo(ctx, '#7f858a', x, CHAO - 34, 7, 30);
    retangulo(ctx, '#9aa0a5', x, CHAO - 34, 2, 30);
    retangulo(ctx, '#f2b417', x - 1, CHAO - 40, 9, 8);
  }

  // paralelepípedo
  repetir(CENARIO.rua, t, CHAO);
}

function repetir(img, deslocamento, y) {
  if (!img) return;
  const off = deslocamento % img.width;
  for (let x = -off; x < LARGURA; x += img.width) ctx.drawImage(img, Math.floor(x), y);
}

// ---------------------------------------------------------------------
//  Sons (sintetizados, sem arquivos)
// ---------------------------------------------------------------------
let audio = null;
let somLigado = true;

function som(tipo) {
  if (!somLigado) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const v = audio.createGain();
    o.connect(v);
    v.connect(audio.destination);
    const agora = audio.currentTime;
    const sons = {
      pulo:   { tipo: 'square',   de: 300, para: 620, dur: 0.15, vol: 0.08 },
      moeda:  { tipo: 'square',   de: 880, para: 1320, dur: 0.12, vol: 0.07 },
      vida:   { tipo: 'triangle', de: 520, para: 1040, dur: 0.3, vol: 0.12 },
      batida: { tipo: 'sawtooth', de: 220, para: 50, dur: 0.4, vol: 0.12 },
      rampa:  { tipo: 'square',   de: 200, para: 900, dur: 0.3, vol: 0.08 },
    };
    const s = sons[tipo];
    o.type = s.tipo;
    o.frequency.setValueAtTime(s.de, agora);
    o.frequency.exponentialRampToValueAtTime(s.para, agora + s.dur);
    v.gain.setValueAtTime(s.vol, agora);
    v.gain.exponentialRampToValueAtTime(0.001, agora + s.dur);
    o.start(agora);
    o.stop(agora + s.dur);
  } catch (e) { /* sem áudio */ }
}

// ---------------------------------------------------------------------
//  Estado do jogo
// ---------------------------------------------------------------------
let modo = 'menu';          // 'menu' | 'jogando' | 'pausado' | 'fim'
let jogo;
let recorde = 0;
try { recorde = Number(localStorage.getItem('davizeira-recorde')) || 0; } catch (e) {}

const entrada = { pular: false, impinar: false, acelerar: false, pulouAgora: false };

const TURBO = { extra: 0.6, resposta: 2.5 };   // acelerar: até +60% de velocidade

function novoJogo() {
  jogo = {
    tempo: 0,
    distancia: 0,
    velocidade: FISICA.velInicial,
    pontos: 0,
    moedas: 0,
    vidas: 3,
    proximo: 600,           // distância até o próximo obstáculo
    objetos: [],            // obstáculos, rampas, moedas, corações
    textos: [],             // "+10", "MANOBRA!" flutuando
    particulas: [],         // fogo do especial e pedaços de obstáculo
    especial: { disponivel: false, vida: 0, meta: ESPECIAL.primeiraMeta, vezes: 0 },
    jogador: {
      x: Math.round(Math.max(150, LARGURA * 0.24)),   // longe do botão IMPINAR
      y: 0,                 // altura acima do chão
      vy: 0,
      noChao: true,
      empinar: 0,           // 0 = normal, 1 = na roda
      tempoNaRoda: 0,
      equilibrio: 100,      // barra do impinar
      dicaEquilibrio: false,
      manobraMassa: false,  // fazendo o especial
      tempoManobra: 0,
      anim: 0,
      pouso: 0,             // tempo mostrando o quadro de aterrissagem
      manobra: false,       // pulo da rampa (pose "super-homem")
      caido: 0,             // tempo da animação de queda
      invencivel: 0,
    },
  };
}

// ---------------------------------------------------------------------
//  Objetos: obstáculos, rampas, moedas, corações
// ---------------------------------------------------------------------
function criarObjetos() {
  const x = LARGURA + 80;
  const r = Math.random();
  const dificuldade = Math.min(1, jogo.tempo / 90);

  if (r < 0.26) {
    obstaculo(x, 0.5);
    if (Math.random() < 0.6) arcoDeMoedas(x - 10, 4, 150);
  } else if (r < 0.38 + dificuldade * 0.06) {
    obstaculo(x, 0.72);
    if (Math.random() < 0.5) arcoDeMoedas(x, 5, 200);
  } else if (r < 0.48) {
    jogo.objetos.push({ tipo: 'rampa', x, w: 170, h: 42 });
    arcoDeMoedas(x + 260, 6, 300);
  } else if (r < 0.58) {
    linhaDeMoedas(x, 6, 30 + Math.random() * 60);
  } else if (r < 0.65) {
    // Dupla bem próxima: um pulo segurado passa pelos dois
    obstaculo(x, 0.5);
    obstaculo(x + IMG.icone_5.width * 0.5 + 70 + Math.random() * 30, 0.5);
    texto('SEGURA O PULO!', '#ff8a1f');
  } else if (r < 0.79) {
    // fileira de baratas: dá para pisar em várias seguidas (combo)
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) inimigo('barata', x + i * 90);
  } else if (r < 0.9) {
    inimigo('rato', x);
  } else {
    inimigo('pombo', x);
    if (Math.random() < 0.5) inimigo('pombo', x + 160);
  }

  if (jogo.vidas < 3 && Math.random() < 0.06) {
    jogo.objetos.push({ tipo: 'coracao', x: x + 120, y: 190, w: 30, h: 30 });
  }

  // espaço até o próximo grupo cresce com a velocidade
  const tempoLivre = 1.05 + Math.random() * 0.9 - dificuldade * 0.3;
  jogo.proximo = jogo.velocidade * tempoLivre + 260;
}

// ---------------------------------------------------------------------
//  Inimigos em pixel art (desenhados por código, animados em 2 quadros)
// ---------------------------------------------------------------------
const ARTE = {
  barata: {
    paleta: { k: '#2a1608', b: '#7a3b12', l: '#b0652c', w: '#ffffff', p: '#111111' },
    corpo: [
      '..k.........k...',
      '...k.......k....',
      '....kkkkkkkk....',
      '..kkllbbbbbbkk..',
      '.kwpbllbbbbbbbk.',
      'kkbbbbllbbbbbbbk',
      'kbbbbbbbbbbbbbbk',
      '.kkkkkkkkkkkkkk.',
    ],
    pernas: [
      ['..k...k...k...k.', '.k...k...k...k..'],
      ['...k...k...k...k', '..k...k...k...k.'],
    ],
  },
  rato: {
    paleta: { d: '#34343c', g: '#7b7b86', c: '#a3a3ad', e: '#f2a0b0', n: '#ff7f9a', w: '#ffffff', p: '#d81b3c', t: '#e88aa0' },
    corpo: [
      '..dd..............',
      '.deed.............',
      '.deedd............',
      '.ddddggggggggd....',
      'dwpggccccggggggd..',
      'nggggggggggggggd..',
      'dggggggggggggggdtt',
      '.dgggggggggggggd..',
      '..ddddddddddddd...',
    ],
    pernas: [
      ['..d.d......d.d....', '..................'],
      ['...d.d......d.d...', '..................'],
    ],
  },
  pombo: {
    paleta: { d: '#3e4656', h: '#8b97ab', v: '#5aa08c', w: '#cdd6e2', p: '#111111', o: '#f08a24' },
    quadros: [
      [
        '.....dddd.......',
        '....dwwwwd......',
        '...dwwwwd.......',
        '.dddwwdd........',
        'dvpddhhhhhdd....',
        'ovvhhhhhhhhhddd.',
        '.dhhhhhhhhhhhhd.',
        '..dddhhhhhhddd..',
        '.....dd.dd......',
        '.....o..o.......',
      ],
      [
        '................',
        '................',
        '................',
        '.dd.............',
        'dvpddhhhhhdd....',
        'ovvhhhhhhhhhddd.',
        '.dhhhwwwwhhhhhd.',
        '..dddwwwwwwddd..',
        '.....dwwwwd.....',
        '......dwwd......',
      ],
    ],
  },
};

const INIMIGO = {
  barata: { escala: 4, vel: 60, pontos: 100 },
  rato:   { escala: 4,   vel: 150, pontos: 150 },
  pombo:  { escala: 3.6, vel: 90, pontos: 200, voa: true },
};

const QUADROS_INIMIGO = {};

function pixelArt(linhas, paleta, escala) {
  const c = document.createElement('canvas');
  c.width = linhas[0].length * escala;
  c.height = linhas.length * escala;
  const g = c.getContext('2d');
  linhas.forEach((linha, y) => {
    [...linha].forEach((ch, x) => {
      if (!paleta[ch]) return;
      g.fillStyle = paleta[ch];
      g.fillRect(x * escala, y * escala, escala, escala);
    });
  });
  return c;
}

function montarInimigos() {
  for (const [nome, arte] of Object.entries(ARTE)) {
    const quadros = arte.quadros || arte.pernas.map((p) => [...arte.corpo, ...p]);
    QUADROS_INIMIGO[nome] = quadros.map((q) => pixelArt(q, arte.paleta, INIMIGO[nome].escala));
  }
}

function inimigo(especie, x) {
  const img = QUADROS_INIMIGO[especie][0];
  const dados = INIMIGO[especie];
  const base = dados.voa ? 95 + Math.random() * 40 : 0;
  jogo.objetos.push({ tipo: 'inimigo', especie, x, y: base, base, w: img.width, h: img.height, anim: Math.random(), morto: 0 });
}

// Os inimigos andam na direção do Davi (além da rua passando)
function atualizarInimigos(dt) {
  for (const o of jogo.objetos) {
    if (o.tipo !== 'inimigo') continue;
    if (o.morto > 0) {
      o.morto -= dt;
      if (o.morto <= 0) o.pego = true;
      continue;
    }
    o.anim += dt;
    o.x -= INIMIGO[o.especie].vel * dt;
    if (o.especie === 'rato') o.y = Math.abs(Math.sin(o.anim * 5)) * 26;          // vem pulando
    if (o.especie === 'pombo') o.y = o.base + Math.sin(o.anim * 3) * 18;          // voa ondulando
  }
}

// Pisou na cabeça: o inimigo achata e o Davi quica (pisões seguidos = combo)
function esmagar(o, quica) {
  const j = jogo.jogador;
  o.morto = 0.45;
  j.combo = (j.combo || 0) + 1;
  const valor = INIMIGO[o.especie].pontos * j.combo;
  pontuar(valor, j.combo > 1 ? `COMBO ×${j.combo}! +${valor}` : `PISOU! +${valor}`);
  som('moeda');
  if (quica) {
    j.vy = 760;
    j.noChao = false;
    j.manobra = false;
  }
  for (let i = 0; i < 6; i++) {
    jogo.particulas.push({
      tipo: 'caco', x: o.x + o.w / 2, y: o.y + o.h / 2,
      vx: -250 + Math.random() * 500, vy: 200 + Math.random() * 300,
      vida: 0.5, max: 0.5, cor: '#ffffff',
    });
  }
}

function desenharInimigo(o) {
  const quadros = QUADROS_INIMIGO[o.especie];
  const ritmo = o.especie === 'pombo' ? 7 : 10;
  const img = quadros[Math.floor(o.anim * ritmo) % quadros.length];
  const x = Math.round(o.x);
  if (o.morto > 0) {
    // achatado
    const h = Math.round(o.h * 0.35);
    ctx.globalAlpha = Math.min(1, o.morto * 3);
    ctx.drawImage(img, x - 4, Math.round(CHAO - o.y - h + 2), o.w + 8, h);
    ctx.globalAlpha = 1;
    return;
  }
  if (INIMIGO[o.especie].voa) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + o.w / 2, CHAO + 2, o.w * 0.35, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(img, x, Math.round(CHAO - o.y - o.h + 2));
}

function obstaculo(x, tamanho) {
  const img = IMG.icone_5;
  jogo.objetos.push({ tipo: 'obstaculo', x, w: img.width * tamanho, h: img.height * tamanho });
}

function arcoDeMoedas(x, n, alturaMax) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    jogo.objetos.push({ tipo: 'moeda', x: x + i * 38, y: 60 + Math.sin(t * Math.PI) * alturaMax, w: 26, h: 28 });
  }
}

function linhaDeMoedas(x, n, altura) {
  for (let i = 0; i < n; i++) jogo.objetos.push({ tipo: 'moeda', x: x + i * 38, y: altura, w: 26, h: 28 });
}

// ---------------------------------------------------------------------
//  Atualização
// ---------------------------------------------------------------------
function atualizar(dt) {
  const j = jogo.jogador;

  if (modo === 'menu') {
    jogo.distancia += 160 * dt;
    j.anim += dt;
    return;
  }
  if (modo !== 'jogando') return;

  jogo.tempo += dt;

  // Queda: espera a animação, depois volta (ou fim de jogo)
  if (j.caido > 0) {
    j.caido -= dt;
    jogo.distancia += jogo.velocidade * 0.25 * dt;
    moverObjetos(jogo.velocidade * 0.25 * dt);
    if (j.caido <= 0) {
      if (jogo.vidas <= 0) return fimDeJogo();
      j.invencivel = 1.6;
      j.y = 0; j.vy = 0; j.noChao = true; j.empinar = 0; j.equilibrio = 100;
    }
    return;
  }

  jogo.velocidade = Math.min(FISICA.velMaxima, jogo.velocidade + FISICA.aceleracao * dt);
  // Acelerar: segurando, a bike ganha velocidade aos poucos; soltando, volta ao normal
  const alvoTurbo = entrada.acelerar ? 1 : 0;
  jogo.turbo = (jogo.turbo || 0) + Math.sign(alvoTurbo - (jogo.turbo || 0)) * Math.min(Math.abs(alvoTurbo - (jogo.turbo || 0)), TURBO.resposta * dt);
  const velocidade = jogo.velocidade * (1 + TURBO.extra * jogo.turbo);
  const passo = velocidade * dt;
  jogo.distancia += passo;
  j.anim += dt * (velocidade / 330);
  j.invencivel = Math.max(0, j.invencivel - dt);
  j.pouso = Math.max(0, j.pouso - dt);

  // Pulo
  if (entrada.pulouAgora && j.noChao) {
    j.vy = FISICA.impulso;
    j.noChao = false;
    j.empinar = 0;
    j.manobra = false;
    som('pulo');
  }
  entrada.pulouAgora = false;

  atualizarEspecial(dt);

  j.yAnterior = j.y;
  if (!j.noChao) {
    const g = entrada.pular && j.vy > 0 && !j.manobraMassa ? FISICA.gravidadeSegurando : FISICA.gravidade;
    j.vy -= g * dt;
    j.y += j.vy * dt;
    if (j.manobraMassa) {
      j.tempoManobra += dt;
      // rastro de fogo
      jogo.particulas.push({ tipo: 'fogo', x: j.x + 40 + Math.random() * 30, y: j.y + 30 + Math.random() * 50, vida: 0.5, max: 0.5 });
    }
    if (j.y <= 0) {
      j.y = 0;
      j.vy = 0;
      j.noChao = true;
      j.pouso = 0.14;
      j.combo = 0;   // pisões seguidos só valem enquanto não toca o chão
      if (j.manobra) { pontuar(50, 'MANOBRA! +50'); j.manobra = false; }
      if (j.manobraMassa) {
        j.manobraMassa = false;
        j.invencivel = 0.8;
        pontuar(ESPECIAL.pontos, `MANOBRA MASSA! +${ESPECIAL.pontos}`);
        som('vida');
        vibrar();
      }
    }
  }

  // Impinar: segurar levanta a roda e gasta o equilíbrio; soltar baixa devagar e recupera
  const segurando = j.noChao && entrada.impinar;
  if (segurando) {
    j.empinar = Math.min(1, j.empinar + dt * EQUILIBRIO.subida);
    if (j.empinar >= EQUILIBRIO.naRoda) j.equilibrio -= EQUILIBRIO.gastoSegurando * dt;
  } else {
    j.empinar = Math.max(0, j.empinar - dt * (j.noChao ? EQUILIBRIO.descida : 6));
    j.equilibrio = Math.min(100, j.equilibrio + EQUILIBRIO.recuperaSoltando * dt);
  }

  if (j.empinar >= EQUILIBRIO.naRoda) {
    j.tempoNaRoda += dt;
    jogo.pontos += 40 * dt;   // pontos extras na roda
    if (!j.dicaEquilibrio && j.tempoNaRoda > 0.6) {
      j.dicaEquilibrio = true;
      texto('SOLTA E APERTA!', '#7cff6b');
    }
  } else {
    j.tempoNaRoda = 0;
  }

  if (j.equilibrio <= 0) return cairDaRoda();

  // Pontos por distância
  jogo.pontos += passo / 20;

  // Novos objetos
  jogo.proximo -= passo;
  if (jogo.proximo <= 0) criarObjetos();

  moverObjetos(passo);
  atualizarInimigos(dt);
  colisoes();

  // Textos flutuantes e partículas
  for (const t of jogo.textos) { t.y -= 40 * dt; t.vida -= dt; }
  jogo.textos = jogo.textos.filter((t) => t.vida > 0);
  for (const p of jogo.particulas) {
    p.vida -= dt;
    p.x -= passo + (p.vx || 0) * dt;
    if (p.vy !== undefined) { p.vy -= 1400 * dt; p.y += p.vy * dt; }
  }
  jogo.particulas = jogo.particulas.filter((p) => p.vida > 0);
}

// ---------------------------------------------------------------------
//  Especial: meta de pontos libera o botão; a vida dele vai acabando
// ---------------------------------------------------------------------
function atualizarEspecial(dt) {
  const e = jogo.especial;
  if (!e.disponivel && !jogo.jogador.manobraMassa && jogo.pontos >= e.meta) {
    e.disponivel = true;
    e.vida = 1;
    e.vezes++;
    e.meta = Math.floor(jogo.pontos) + ESPECIAL.intervalo + 500 * e.vezes;
    texto('★ ESPECIAL LIBERADO!', '#ffd23f');
    som('moeda');
  }
  if (e.disponivel) {
    e.vida -= dt / ESPECIAL.duracaoBotao;
    if (e.vida <= 0) { e.disponivel = false; e.vida = 0; }
  }
}

function usarEspecial() {
  const e = jogo.especial;
  const j = jogo.jogador;
  if (modo !== 'jogando' || !e.disponivel || j.caido > 0) return;
  e.disponivel = false;
  e.vida = 0;
  j.manobraMassa = true;
  j.tempoManobra = 0;
  j.manobra = false;
  j.vy = ESPECIAL.impulso;
  j.noChao = false;
  j.empinar = 0;
  j.equilibrio = 100;
  som('rampa');
}

// Durante o especial, o Davi atravessa os obstáculos quebrando tudo
function quebrar(o) {
  o.pego = true;
  pontuar(ESPECIAL.pontosPorQuebra, `POW! +${ESPECIAL.pontosPorQuebra}`);
  som('batida');
  for (let i = 0; i < 10; i++) {
    jogo.particulas.push({
      tipo: 'caco', x: o.x + Math.random() * o.w, y: Math.random() * o.h,
      vx: -200 + Math.random() * 400, vy: 300 + Math.random() * 400,
      vida: 0.8, max: 0.8, cor: Math.random() < 0.5 ? '#8a5a2b' : '#2a2a2a',
    });
  }
}

function moverObjetos(passo) {
  for (const o of jogo.objetos) o.x -= passo;
  jogo.objetos = jogo.objetos.filter((o) => o.x + o.w > -50 && !o.pego);
}

function caixaJogador() {
  const j = jogo.jogador;
  // só a bike + pernas (a cabeça não conta, para ser justo)
  return { x: j.x + 18, y: j.y + 4, w: 70, h: 62 };
}

function encosta(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function colisoes() {
  const j = jogo.jogador;
  const cj = caixaJogador();

  for (const o of jogo.objetos) {
    if (o.tipo === 'obstaculo') {
      const co = { x: o.x + o.w * 0.12, y: 0, w: o.w * 0.76, h: o.h * 0.82 };
      if (encosta(cj, co)) {
        if (j.manobraMassa) quebrar(o);
        else if (j.invencivel <= 0) bater(o);
      }
    } else if (o.tipo === 'inimigo') {
      if (o.morto > 0) continue;
      const ci = { x: o.x + 4, y: o.y, w: o.w - 8, h: o.h - 4 };
      if (!encosta(cj, ci)) continue;
      // caindo e, no quadro anterior, com a roda acima do meio dele = pisou na cabeça
      const pisou = j.vy < 0 && (j.yAnterior ?? j.y) + 4 >= o.y + o.h * 0.5;
      if (j.manobraMassa) esmagar(o, false);
      else if (pisou) esmagar(o, true);
      else if (j.invencivel <= 0) bater(o);
    } else if (o.tipo === 'rampa') {
      // passou pela rampa no chão: decola alto
      if (j.noChao && cj.x + cj.w > o.x + 20 && cj.x < o.x + o.w - 30 && !o.usada) {
        o.usada = true;
        j.vy = FISICA.impulsoRampa;
        j.noChao = false;
        j.empinar = 0;
        j.manobra = true;
        som('rampa');
      }
    } else if (o.tipo === 'moeda' || o.tipo === 'coracao') {
      if (encosta({ x: cj.x, y: cj.y, w: cj.w, h: 120 }, o)) {
        o.pego = true;
        if (o.tipo === 'moeda') {
          jogo.moedas++;
          pontuar(10);
          som('moeda');
        } else {
          jogo.vidas = Math.min(3, jogo.vidas + 1);
          texto('+1 VIDA', '#ff5c7a');
          som('vida');
        }
      }
    }
  }
}

function bater(obst) {
  const j = jogo.jogador;
  obst.pego = true;
  jogo.vidas--;
  j.caido = 0.9;
  j.manobra = false;
  jogo.velocidade = Math.max(FISICA.velInicial, jogo.velocidade * 0.85);
  som('batida');
  vibrar();
}

// Vibra o celular (só depois que a pessoa já tocou na tela)
function vibrar() {
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(120);
}

// Segurou demais na roda: perdeu o equilíbrio e caiu
function cairDaRoda() {
  const j = jogo.jogador;
  jogo.vidas--;
  j.caido = 0.9;
  j.empinar = 0;
  j.equilibrio = 100;
  texto('CAIU DA RODA!', '#ff5c7a');
  som('batida');
  vibrar();
}

function pontuar(valor, rotulo) {
  jogo.pontos += valor;
  if (rotulo) texto(rotulo, '#ffd23f');
}

function texto(t, cor) {
  const j = jogo.jogador;
  jogo.textos.push({ t, cor, x: Math.max(j.x + 60, 120), y: CHAO - j.y - 195, vida: 1.2 });
}

// ---------------------------------------------------------------------
//  Desenho
// ---------------------------------------------------------------------
function sprite(nome, x, base, s = ESCALA_SPRITE, alfa = 1) {
  const img = IMG[nome];
  if (!img || !img.width) return;
  const a = AJUSTE[nome] || {};
  const sx = a.sx || 0;
  const w = img.width - sx;
  ctx.globalAlpha = alfa;
  ctx.drawImage(img, sx, 0, w, img.height,
    Math.round(x + (a.ox || 0) * s), Math.round(base - img.height * s), Math.round(w * s), Math.round(img.height * s));
  ctx.globalAlpha = 1;
}

function quadroDoJogador() {
  const j = jogo.jogador;
  if (!j.noChao) {
    if (j.manobra && j.vy > -200) return 'pulo_1';
    return j.vy > 0 ? 'pulo_2' : 'pulo_3';
  }
  if (j.pouso > 0) return 'pulo_4';
  if (j.empinar >= 0.95) return 'roda_' + (Math.floor(j.anim * 5) % 3);
  if (j.empinar > 0.05) return 'sobe_' + Math.min(3, Math.floor(j.empinar * 4));
  return 'pedal_' + (Math.floor(j.anim * 10) % 6);
}

function desenhar() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // faixas acima/abaixo do mundo (celular em pé)
  ctx.fillStyle = '#3f9be6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#8a867f';
  ctx.fillRect(0, (deslocY + (ALTURA - cameraTopo) * escala) * dpr - 2, canvas.width, canvas.height);

  ctx.setTransform(escala * dpr, 0, 0, escala * dpr, ((w - LARGURA * escala) / 2) * dpr, (deslocY - cameraTopo * escala) * dpr);
  ctx.imageSmoothingEnabled = false;

  desenharCenario(jogo.distancia);

  // linhas de velocidade ao acelerar
  if ((jogo.turbo || 0) > 0.2) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * jogo.turbo})`;
    for (let i = 0; i < 9; i++) {
      const ly = 120 + ((i * 97) % 320);
      const lx = LARGURA - ((jogo.distancia * 1.6 + i * 233) % (LARGURA + 200));
      ctx.fillRect(Math.round(lx), ly, 90 + (i % 3) * 40, 3);
    }
  }

  // objetos
  for (const o of jogo.objetos) {
    if (o.tipo === 'obstaculo') {
      ctx.drawImage(IMG.icone_5, Math.round(o.x), Math.round(CHAO - o.h + 4), Math.round(o.w), Math.round(o.h));
    } else if (o.tipo === 'rampa') {
      desenharRampa(o);
    } else if (o.tipo === 'inimigo') {
      desenharInimigo(o);
    } else if (o.tipo === 'moeda') {
      const giro = Math.abs(Math.cos(jogo.distancia / 40 + o.x / 60));
      const mw = Math.max(4, o.w * giro);
      ctx.drawImage(IMG.icone_7, Math.round(o.x + (o.w - mw) / 2), Math.round(CHAO - o.y - o.h), Math.round(mw), o.h);
    } else if (o.tipo === 'coracao') {
      const pulso = 1 + Math.sin(jogo.distancia / 30) * 0.1;
      ctx.drawImage(IMG.icone_6, o.x, CHAO - o.y - o.h * pulso, o.w * pulso, o.h * pulso);
    }
  }

  // Davi (no menu ele aparece grande, parado, na tela inicial)
  const j = jogo.jogador;
  if (modo === 'menu') return;
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const sombra = Math.max(0.4, 1 - j.y / 300);
  ctx.beginPath();
  ctx.ellipse(j.x + 52, CHAO + 2, 50 * sombra, 6 * sombra, 0, 0, Math.PI * 2);
  ctx.fill();

  if (j.caido > 0) {
    const t = 0.9 - j.caido;
    sprite('icone_4', j.x - 10 + t * 40, CHAO + 4 - Math.sin(Math.min(1, t * 2.5) * Math.PI) * 40, 0.85);
  } else if (j.manobraMassa) {
    desenharParticulas('fogo');
    // mortal de 360° girando em volta do centro da bike, com brilho dourado
    const cx = j.x + 52, cy = CHAO - j.y - 55;
    const giro = Math.min(1, j.tempoManobra / ESPECIAL.giro) * Math.PI * 2;
    const brilho = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
    brilho.addColorStop(0, 'rgba(255, 230, 120, 0.55)');
    brilho.addColorStop(1, 'rgba(255, 180, 0, 0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(cx - 90, cy - 90, 180, 180);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-giro);
    sprite(giro < Math.PI * 2 ? 'pulo_1' : 'pulo_2', -52, 57);
    ctx.restore();
  } else {
    const piscando = j.invencivel > 0 && Math.floor(j.invencivel * 10) % 2 === 0;
    sprite(quadroDoJogador(), j.x, CHAO + 2 - j.y, ESCALA_SPRITE, piscando ? 0.35 : 1);
  }
  desenharParticulas('caco');
  if (!j.manobraMassa) desenharParticulas('fogo');

  if (j.caido <= 0 && (j.empinar > 0.05 || j.equilibrio < 100)) desenharEquilibrio(j);

  // textos flutuantes
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  for (const t of jogo.textos) {
    ctx.globalAlpha = Math.min(1, t.vida * 2);
    ctx.fillStyle = '#1a0f26';
    ctx.fillText(t.t, t.x + 2, t.y + 2);
    ctx.fillStyle = t.cor;
    ctx.fillText(t.t, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function desenharParticulas(tipo) {
  for (const p of jogo.particulas) {
    if (p.tipo !== tipo) continue;
    const v = p.vida / p.max;
    ctx.globalAlpha = Math.max(0, v);
    if (tipo === 'fogo') {
      const s = 0.25 + v * 0.35;
      ctx.drawImage(IMG.icone_3, p.x, CHAO - p.y - IMG.icone_3.height * s, IMG.icone_3.width * s, IMG.icone_3.height * s);
    } else {
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(p.x), Math.round(CHAO - p.y), 6, 6);
    }
  }
  ctx.globalAlpha = 1;
}

// Barra de equilíbrio em cima do Davi
function desenharEquilibrio(j) {
  const w = 96, h = 12;
  const x = Math.round(j.x + 6), y = Math.round(CHAO - j.y - 162);
  const v = Math.max(0, j.equilibrio) / 100;
  const perigo = v < 0.3;

  ctx.fillStyle = '#1a0f26';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#4a3a5a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = perigo ? (Math.floor(jogo.tempo * 8) % 2 ? '#ff2e4d' : '#ffd23f') : v < 0.6 ? '#ffb02e' : '#4cd964';
  ctx.fillRect(x, y, Math.round(w * v), h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, Math.round(w * v), 3);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a0f26';
  ctx.fillText(perigo ? 'SOLTA!' : 'EQUILÍBRIO', x + w / 2 + 1, y - 7);
  ctx.fillStyle = perigo ? '#ff5c7a' : '#fff8e7';
  ctx.fillText(perigo ? 'SOLTA!' : 'EQUILÍBRIO', x + w / 2, y - 8);
}

function desenharRampa(o) {
  const x = Math.round(o.x), b = CHAO + 2;
  ctx.fillStyle = '#6f6a66';
  ctx.beginPath();
  ctx.moveTo(x, b);
  ctx.lineTo(x + o.w * 0.75, b - o.h);
  ctx.lineTo(x + o.w, b - o.h);
  ctx.lineTo(x + o.w, b);
  ctx.closePath();
  ctx.fill();
  // pedras
  ctx.fillStyle = '#8c8682';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + o.w * 0.35 + i * 18, b - 10 - (i % 2) * 12, 14, 6);
  ctx.fillStyle = '#4b4744';
  ctx.fillRect(x + o.w * 0.75, b - o.h, o.w * 0.25, 5);
}

// ---------------------------------------------------------------------
//  HUD e telas
// ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let ultimoHud = '';

function atualizarHud() {
  const j = jogo.jogador;
  const combo = j.manobraMassa ? '★ MANOBRA MASSA! ★'
    : j.empinar >= EQUILIBRIO.naRoda ? 'IMPINANDO! ×2'
    : (jogo.turbo || 0) > 0.5 ? 'ACELERANDO!' : '';

  // Botão do especial e a vida dele (muda todo quadro)
  const esp = jogo.especial;
  $('btn-especial').hidden = !esp.disponivel || modo !== 'jogando';
  if (esp.disponivel) {
    const barra = $('barra-especial');
    barra.style.width = Math.round(esp.vida * 100) + '%';
    barra.style.background = esp.vida < 0.3 ? '#e53935' : esp.vida < 0.6 ? '#ff8a1f' : '#2e9e3a';
  }

  const chave = [Math.floor(jogo.pontos), jogo.moedas, jogo.vidas, combo].join('|');
  if (chave === ultimoHud) return;
  ultimoHud = chave;

  $('pontos').textContent = Math.floor(jogo.pontos);
  $('moedas').textContent = jogo.moedas;
  $('combo').textContent = combo;
  const vidas = $('vidas');
  if (vidas.children.length !== 3) {
    vidas.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const img = document.createElement('img');
      img.src = 'assets/sprites/icone_6.png';
      img.alt = '';
      vidas.appendChild(img);
    }
  }
  [...vidas.children].forEach((img, i) => img.classList.toggle('perdida', i >= jogo.vidas));
}

function mostrar(tela) {
  ['tela-inicio', 'tela-pausa', 'tela-fim'].forEach((id) => $(id).classList.toggle('ativo', id === tela));
  const jogando = modo === 'jogando';
  $('hud').hidden = modo === 'menu';
  $('controles').hidden = !jogando;
  document.body.classList.toggle('jogando', modo !== 'menu');
}

// No celular, entra em tela cheia e trava na horizontal ao começar
function telaCheiaHorizontal() {
  const celular = matchMedia('(pointer: coarse)').matches;
  if (!celular) return;
  const el = document.documentElement;
  const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
  const jaCheia = document.fullscreenElement || document.webkitFullscreenElement
    || matchMedia('(display-mode: fullscreen)').matches;
  const travar = () => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {});
  if (!jaCheia && pedir) {
    Promise.resolve(pedir.call(el)).then(travar).catch(() => {});
  } else {
    travar();
  }
}

function iniciar() {
  telaCheiaHorizontal();
  novoJogo();
  modo = 'jogando';
  ultimoHud = '';
  mostrar(null);
  atualizarHud();
}

function pausar() {
  if (modo !== 'jogando') return;
  modo = 'pausado';
  mostrar('tela-pausa');
}

function continuar() {
  if (modo !== 'pausado') return;
  modo = 'jogando';
  mostrar(null);
}

function irParaMenu() {
  modo = 'menu';
  novoJogo();
  $('recorde-inicio').textContent = recorde;
  mostrar('tela-inicio');
}

function fimDeJogo() {
  modo = 'fim';
  const pontos = Math.floor(jogo.pontos);
  const novo = pontos > recorde;
  if (novo) {
    recorde = pontos;
    try { localStorage.setItem('davizeira-recorde', recorde); } catch (e) {}
  }
  $('fim-pontos').textContent = pontos;
  $('fim-moedas').textContent = jogo.moedas;
  $('fim-recorde').textContent = recorde;
  $('novo-recorde').hidden = !novo;
  mostrar('tela-fim');
}

// ---------------------------------------------------------------------
//  Controles: teclado e toque
// ---------------------------------------------------------------------
function apertarPulo() {
  if (!entrada.pular) entrada.pulouAgora = true;
  entrada.pular = true;
}

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (modo === 'menu' || modo === 'fim') return iniciar();
    apertarPulo();
  }
  if (['ShiftLeft', 'ShiftRight', 'KeyD'].includes(e.code)) entrada.impinar = true;
  if (['ArrowRight', 'KeyK'].includes(e.code)) entrada.acelerar = true;
  if (e.code === 'KeyP' || e.code === 'Escape') modo === 'pausado' ? continuar() : pausar();
  if (e.code === 'KeyE' || e.code === 'ArrowDown') usarEspecial();
});

window.addEventListener('keyup', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) entrada.pular = false;
  if (['ShiftLeft', 'ShiftRight', 'KeyD'].includes(e.code)) entrada.impinar = false;
  if (['ArrowRight', 'KeyK'].includes(e.code)) entrada.acelerar = false;
});

function botaoSegurar(el, aoApertar, aoSoltar) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('apertado');
    aoApertar();
  });
  const soltar = () => { el.classList.remove('apertado'); aoSoltar(); };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);
}

botaoSegurar($('btn-pular'), apertarPulo, () => { entrada.pular = false; });
botaoSegurar($('btn-acelerar'), () => { entrada.acelerar = true; }, () => { entrada.acelerar = false; });
botaoSegurar($('btn-impinar'), () => { entrada.impinar = true; }, () => { entrada.impinar = false; });
botaoSegurar($('btn-especial'), usarEspecial, () => {});

// Tocar na tela (fora dos botões) também pula
canvas.addEventListener('pointerdown', (e) => {
  if (modo !== 'jogando') return;
  e.preventDefault();
  apertarPulo();
});
canvas.addEventListener('pointerup', () => { entrada.pular = false; });

// ---------------------------------------------------------------------
//  Instalar como app
// ---------------------------------------------------------------------
let pedidoInstalacao = null;
const rodandoComoApp = () => matchMedia('(display-mode: fullscreen)').matches
  || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Chrome/Edge no Android avisam quando dá para instalar: guardamos o pedido para o botão
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoInstalacao = e;
  $('btn-instalar').hidden = false;
});
window.addEventListener('appinstalled', () => {
  pedidoInstalacao = null;
  $('btn-instalar').hidden = true;
});
if (!rodandoComoApp()) $('btn-instalar').hidden = false;

$('btn-instalar').addEventListener('click', async () => {
  if (pedidoInstalacao) {
    pedidoInstalacao.prompt();
    const { outcome } = await pedidoInstalacao.userChoice;
    pedidoInstalacao = null;
    if (outcome === 'accepted') $('btn-instalar').hidden = true;
    return;
  }
  // Sem o pedido do navegador: explica como instalar à mão
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const dentroDeApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua);
  const passos = ios
    ? ['Abra este link no <b>Safari</b>.', 'Toque em <b>Compartilhar</b> (quadrado com seta ⬆).', 'Escolha <b>Adicionar à Tela de Início</b>.', 'Abra pelo <b>ícone do Davi</b>.']
    : ['Abra este link no <b>Google Chrome</b> (não dentro do WhatsApp ou Instagram).', 'Toque em <b>⋮</b> no canto de cima.', 'Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial → Instalar</b>).', 'Abra pelo <b>ícone do Davi</b> na tela do celular.'];
  if (dentroDeApp) passos.unshift('⚠ Você abriu pelo navegador de outro app, que não instala jogos. Toque em <b>⋮ → Abrir no navegador</b>.');
  $('passos-instalar').innerHTML = passos.map((p, i) => `<p>${i + 1}. ${p}</p>`).join('');
  $('tela-instalar').classList.add('ativo');
});
$('btn-fechar-instalar').addEventListener('click', () => $('tela-instalar').classList.remove('ativo'));

$('btn-jogar').addEventListener('click', iniciar);
$('btn-denovo').addEventListener('click', iniciar);
$('btn-menu').addEventListener('click', irParaMenu);
$('btn-sair').addEventListener('click', irParaMenu);
$('btn-continuar').addEventListener('click', continuar);
$('btn-pausa').addEventListener('click', pausar);
$('btn-som').addEventListener('click', () => {
  somLigado = !somLigado;
  $('btn-som').textContent = somLigado ? '🔊' : '🔇';
});

// Sai do app / troca de aba: pausa sozinho
document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });

// ---------------------------------------------------------------------
//  Laço principal
// ---------------------------------------------------------------------
let anterior = performance.now();
function laco(agora) {
  const dt = Math.min(0.05, (agora - anterior) / 1000);
  anterior = agora;
  atualizar(dt);
  atualizarCamera(dt);
  desenhar();
  if (modo !== 'menu') atualizarHud();
  requestAnimationFrame(laco);
}

ajustarTela();
montarCenario();
montarInimigos();
novoJogo();
$('recorde-inicio').textContent = recorde;
carregarImagens().then(() => requestAnimationFrame(laco));
