# Recorta a sprite sheet em quadros PNG com fundo transparente.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\recortar.ps1
# Gera assets\sprites\*.png e assets\sprites\sprites.json

$raiz = Split-Path $PSScriptRoot -Parent
$folha = Join-Path $raiz 'assets\sprite-sheet.jpg'
$saida = Join-Path $raiz 'assets\sprites'
New-Item -ItemType Directory -Force $saida | Out-Null
Get-ChildItem $saida -Filter *.png | Remove-Item

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public static class Recortador {
  static int W, H;
  static byte[] px;      // BGRA
  static bool[] fundo;

  static int Idx(int x, int y) { return (y * W + x) * 4; }

  public static string Processar(string arquivo, string saida, int[][] faixas, string[] nomes, int[] esperados, int limiar) {
    var orig = new Bitmap(arquivo);
    W = orig.Width; H = orig.Height;
    var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(orig, 0, 0, W, H);
    var dados = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    px = new byte[W * H * 4];
    Marshal.Copy(dados.Scan0, px, 0, px.Length);
    bmp.UnlockBits(dados);

    // Cor do fundo por linha (média da borda esquerda e direita)
    fundo = new bool[W * H];
    for (int y = 0; y < H; y++) {
      double b = 0, gg = 0, r = 0; int n = 0;
      for (int x = 1; x < 7; x++) { int i = Idx(x, y); b += px[i]; gg += px[i+1]; r += px[i+2]; n++; }
      for (int x = W - 7; x < W - 1; x++) { int i = Idx(x, y); b += px[i]; gg += px[i+1]; r += px[i+2]; n++; }
      b /= n; gg /= n; r /= n;
      for (int x = 0; x < W; x++) {
        int i = Idx(x, y);
        double d = Math.Sqrt(Math.Pow(px[i] - b, 2) + Math.Pow(px[i+1] - gg, 2) + Math.Pow(px[i+2] - r, 2));
        fundo[y * W + x] = d < limiar;
      }
    }

    var json = new StringBuilder("{\n");
    bool primeiro = true;

    for (int f = 0; f < faixas.Length; f++) {
      int y0 = faixas[f][0], y1 = faixas[f][1];

      // Linha do chão: linhas da faixa que atravessam quase toda a largura
      int chao = y1;
      for (int y = y0; y <= y1; y++) {
        int maior = 0, atual = 0;   // maior trecho contínuo sem fundo
        for (int x = 0; x < W; x++) {
          atual = fundo[y * W + x] ? 0 : atual + 1;
          if (atual > maior) maior = atual;
        }
        if (maior > W * 0.6) {
          // O chão é a base da faixa: descarta a linha e tudo abaixo dela
          chao = y;
          for (int yy = y; yy <= y1; yy++) for (int x = 0; x < W; x++) fundo[yy * W + x] = true;
          y1 = y - 1;
          break;
        }
      }

      // Rampa de pedra (cinza, sem cor) na base da faixa do pulo: vira fundo
      if (nomes[f] == "pulo") {
        for (int y = y1 - 34; y <= y1; y++) for (int x = 0; x < W; x++) {
          int i = Idx(x, y);
          int mx = Math.Max(px[i], Math.Max(px[i+1], px[i+2])), mn = Math.Min(px[i], Math.Min(px[i+1], px[i+2]));
          int lum = (px[i] + px[i+1] + px[i+2]) / 3;
          if (mx - mn < 28 && lum > 45 && lum < 215) fundo[y * W + x] = true;
        }
      }

      // Componentes conectados de primeiro plano
      var rotulo = new int[W * H];
      var caixas = new List<int[]>();   // minX, minY, maxX, maxY, area
      var pilha = new Stack<int>();
      for (int y = y0; y <= y1; y++) for (int x = 0; x < W; x++) {
        int p = y * W + x;
        if (fundo[p] || rotulo[p] != 0) continue;
        int id = caixas.Count + 1;
        var c = new int[] { x, y, x, y, 0 };
        rotulo[p] = id; pilha.Push(p);
        while (pilha.Count > 0) {
          int q = pilha.Pop(); int qx = q % W, qy = q / W;
          c[0] = Math.Min(c[0], qx); c[1] = Math.Min(c[1], qy);
          c[2] = Math.Max(c[2], qx); c[3] = Math.Max(c[3], qy); c[4]++;
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            int nx = qx + dx, ny = qy + dy;
            if (nx < 0 || nx >= W || ny < y0 || ny > y1) continue;
            int np = ny * W + nx;
            if (!fundo[np] && rotulo[np] == 0) { rotulo[np] = id; pilha.Push(np); }
          }
        }
        caixas.Add(c);
      }

      // Junta componentes próximos (até 6px) em grupos = um quadro cada
      var grupos = new List<int[]>();
      var descartado = new bool[caixas.Count + 1];
      for (int id = 1; id <= caixas.Count; id++) {
        var c = caixas[id - 1];
        bool lixo = c[4] < 4;
        // Restos de linha do chão/rampa: finos ou ralos, encostados na base da faixa
        if (nomes[f] != "icone" && c[1] > y1 - 45) {
          int cw = c[2] - c[0] + 1, ch = c[3] - c[1] + 1;
          if (ch <= 6 || c[4] < 0.15 * cw * ch) lixo = true;
        }
        if (lixo) descartado[id] = true;
        else grupos.Add(new int[] { c[0], c[1], c[2], c[3], c[4] });
      }
      for (int y = y0; y <= y1; y++) for (int x = 0; x < W; x++) {
        int p = y * W + x;
        if (rotulo[p] != 0 && descartado[rotulo[p]]) fundo[p] = true;
      }
      bool mudou = true;
      while (mudou) {
        mudou = false;
        for (int a = 0; a < grupos.Count && !mudou; a++) for (int b = a + 1; b < grupos.Count && !mudou; b++) {
          var A = grupos[a]; var B = grupos[b]; int m = 6;
          if (A[0] - m <= B[2] && B[0] - m <= A[2] && A[1] - m <= B[3] && B[1] - m <= A[3]) {
            A[0] = Math.Min(A[0], B[0]); A[1] = Math.Min(A[1], B[1]);
            A[2] = Math.Max(A[2], B[2]); A[3] = Math.Max(A[3], B[3]); A[4] += B[4];
            grupos.RemoveAt(b); mudou = true;
          }
        }
      }
      grupos.RemoveAll(g => g[4] < 600);
      grupos.Sort((a, b) => a[0].CompareTo(b[0]));

      // Quadros encostados (rodas se tocando): corta onde há menos pixels entre eles
      int n = esperados[f];
      if (n > 0 && grupos.Count != n) {
        int gx0 = W, gx1 = 0, gy0 = y1, gy1 = y0;
        foreach (var g in grupos) { gx0 = Math.Min(gx0, g[0]); gx1 = Math.Max(gx1, g[2]); gy0 = Math.Min(gy0, g[1]); gy1 = Math.Max(gy1, g[3]); }
        var coluna = new int[W];
        for (int x = gx0; x <= gx1; x++) for (int y = gy0; y <= gy1; y++) if (!fundo[y * W + x]) coluna[x]++;
        var cortes = new List<int> { gx0 };
        int largura = gx1 - gx0 + 1, janela = largura / (n * 3);
        for (int k = 1; k < n; k++) {
          int ideal = gx0 + largura * k / n, melhor = ideal;
          for (int x = ideal - janela; x <= ideal + janela; x++) if (coluna[x] < coluna[melhor]) melhor = x;
          cortes.Add(melhor);
        }
        cortes.Add(gx1 + 1);
        grupos.Clear();
        for (int k = 0; k < n; k++) {
          var g = new int[] { W, H, 0, 0, 0 };
          for (int x = cortes[k]; x < cortes[k + 1]; x++) for (int y = gy0; y <= gy1; y++) {
            if (fundo[y * W + x]) continue;
            g[0] = Math.Min(g[0], x); g[1] = Math.Min(g[1], y); g[2] = Math.Max(g[2], x); g[3] = Math.Max(g[3], y); g[4]++;
          }
          grupos.Add(g);   // a caixa já fica dentro da fatia [cortes[k], cortes[k+1])
        }
      }

      for (int k = 0; k < grupos.Count; k++) {
        var g = grupos[k];
        int w = g[2] - g[0] + 1, h = g[3] - g[1] + 1;
        var quadro = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        var qd = quadro.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        var buf = new byte[w * h * 4];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
          int sx = g[0] + x, sy = g[1] + y; int s = Idx(sx, sy), d = (y * w + x) * 4;
          if (fundo[sy * W + sx]) continue;
          buf[d] = px[s]; buf[d+1] = px[s+1]; buf[d+2] = px[s+2]; buf[d+3] = 255;
        }
        Marshal.Copy(buf, 0, qd.Scan0, buf.Length);
        quadro.UnlockBits(qd);
        string nome = nomes[f] + "_" + k;
        quadro.Save(System.IO.Path.Combine(saida, nome + ".png"), ImageFormat.Png);
        quadro.Dispose();

        // altura: distância entre a base do quadro e a linha do chão da faixa
        json.Append(primeiro ? "" : ",\n");
        json.AppendFormat("  \"{0}\": {{ \"w\": {1}, \"h\": {2}, \"x\": {3}, \"altura\": {4} }}", nome, w, h, g[0], chao - 1 - g[3]);
        primeiro = false;
      }
    }
    json.Append("\n}\n");
    return json.ToString();
  }
}
'@

# Faixas (y inicial, y final) de cada linha da folha, logo abaixo dos títulos
$faixas = @(
  ,@(66, 230)     # ciclo de pedalada
  ,@(299, 470)    # subida para a roda
  ,@(530, 708)    # equilíbrio na roda
  ,@(780, 956)    # pulo e aterrissagem (+ rampa)
  ,@(1030, 1126)  # ícones
)
$nomes = @('pedal', 'sobe', 'roda', 'pulo', 'icone')

$esperados = @(6, 4, 3, 5, 0)   # quadros por linha (0 = automático)

$json = [Recortador]::Processar($folha, $saida, $faixas, $nomes, $esperados, 42)
Set-Content -Path (Join-Path $saida 'sprites.json') -Value $json -Encoding UTF8
$json
