# 🚲 Davizeira no Pedal

Jogo de bike em pixel art feito com HTML, CSS e JavaScript puro (Canvas 2D).
O Davizeira pedala pela quebrada, pula obstáculos, pega moedas e impina a bike.

## Como jogar

| Ação | Celular | Teclado |
|---|---|---|
| Pular | botão **PULAR** ou tocar na tela | Espaço / ↑ / W |
| Acelerar | segurar **ACELERAR** | → / K |
| Impinar | segurar **IMPINAR** | Shift / D |
| Especial | botão **★ ESPECIAL** | E / ↓ |
| Pausar | ⏸ | P / Esc |

- Segure o pulo para saltar mais alto (passa por obstáculos duplos).
- Impinando você ganha pontos em dobro, mas fique de olho na **barra de equilíbrio**:
  segurar demais derruba o Davi. Aperte e solte para se equilibrar na roda.
- Passe pela rampa para uma manobra com bônus.
- Ao bater a meta de pontos aparece o botão **★ ESPECIAL** (ou tecla E / ↓): a manobra massa
  dá um mortal com fogo, quebra os obstáculos no caminho e vale +300. A barra do botão
  vai acabando — use antes que ele suma!
- Pule na cabeça das **baratas**, **ratões** e **pombos** — pisões seguidos sem tocar o chão viram combo.
- São 3 vidas; corações aparecem de vez em quando para recuperar.

## Estrutura

- `index.html`, `style.css`, `game.js` — o jogo
- `assets/sprite-sheet.jpg` — folha original dos personagens
- `assets/sprites/` — quadros recortados com fundo transparente
- `ferramentas/recortar.ps1` — recorta a folha de sprites (rode de novo se trocar a imagem)
- `ferramentas/icones.ps1` — gera os ícones do app
- `ferramentas/recortar-capa.ps1` — tira o fundo liso da ilustração do Davi (gera `assets/davi.png`)
- `assets/davi-original.jpg` → `assets/davi.png` — ilustração da tela inicial (original e recortada)
- `manifest.json`, `service-worker.js`, `icons/` — app instalável (PWA), funciona offline
- `privacidade.html` — política de privacidade (exigida pela Google Play)

Ao alterar qualquer arquivo do jogo, aumente a `VERSAO` em `service-worker.js`
para os aparelhos baixarem a versão nova.

---

Developed by **Marco Nunes**
