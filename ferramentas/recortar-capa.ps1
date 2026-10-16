# Tira o fundo claro e liso da ilustração do Davi e salva PNG transparente.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\recortar-capa.ps1 caminho\da\imagem.jpg
param([Parameter(Mandatory = $true)][string]$Entrada)

$raiz = Split-Path $PSScriptRoot -Parent
$saida = Join-Path $raiz 'assets\davi.png'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class RecorteCapa {
  public static string Processar(string entrada, string saida, int limiar, int larguraFinal) {
    var orig = new Bitmap(entrada);
    int W = orig.Width, H = orig.Height;
    var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(orig, 0, 0, W, H);
    var d = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var px = new byte[W * H * 4];
    Marshal.Copy(d.Scan0, px, 0, px.Length);

    // Cor do fundo: média das bordas
    double fb = 0, fg = 0, fr = 0; int n = 0;
    for (int x = 0; x < W; x += 4) foreach (int y in new[] { 2, H - 3 }) { int i = (y * W + x) * 4; fb += px[i]; fg += px[i+1]; fr += px[i+2]; n++; }
    for (int y = 0; y < H; y += 4) foreach (int x in new[] { 2, W - 3 }) { int i = (y * W + x) * 4; fb += px[i]; fg += px[i+1]; fr += px[i+2]; n++; }
    fb /= n; fg /= n; fr /= n;

    var dist = new double[W * H];
    var pareceFundo = new bool[W * H];
    for (int p = 0; p < W * H; p++) {
      int i = p * 4;
      dist[p] = Math.Sqrt(Math.Pow(px[i] - fb, 2) + Math.Pow(px[i+1] - fg, 2) + Math.Pow(px[i+2] - fr, 2));
      pareceFundo[p] = dist[p] < limiar;
    }

    // Regiões parecidas com o fundo viram transparentes se tocam a borda
    // ou se são grandes (vãos entre os raios das rodas, entre braço e corpo)
    var visto = new int[W * H];
    var transparente = new bool[W * H];
    var pilha = new Stack<int>();
    var regiao = new List<int>();
    int id = 0;
    for (int p0 = 0; p0 < W * H; p0++) {
      if (!pareceFundo[p0] || visto[p0] != 0) continue;
      id++; regiao.Clear(); bool borda = false;
      visto[p0] = id; pilha.Push(p0);
      while (pilha.Count > 0) {
        int q = pilha.Pop(); regiao.Add(q);
        int qx = q % W, qy = q / W;
        if (qx == 0 || qy == 0 || qx == W - 1 || qy == H - 1) borda = true;
        if (qx > 0 && pareceFundo[q-1] && visto[q-1] == 0) { visto[q-1] = id; pilha.Push(q-1); }
        if (qx < W-1 && pareceFundo[q+1] && visto[q+1] == 0) { visto[q+1] = id; pilha.Push(q+1); }
        if (qy > 0 && pareceFundo[q-W] && visto[q-W] == 0) { visto[q-W] = id; pilha.Push(q-W); }
        if (qy < H-1 && pareceFundo[q+W] && visto[q+W] == 0) { visto[q+W] = id; pilha.Push(q+W); }
      }
      if (borda || regiao.Count > 120) foreach (int q in regiao) transparente[q] = true;
    }

    // Aplica a transparência com borda suave (anti-serrilhado)
    int minX = W, minY = H, maxX = 0, maxY = 0;
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
      int p = y * W + x, i = p * 4;
      if (transparente[p]) { px[i+3] = 0; continue; }
      bool vizinhoFundo = (x > 0 && transparente[p-1]) || (x < W-1 && transparente[p+1]) || (y > 0 && transparente[p-W]) || (y < H-1 && transparente[p+W]);
      if (vizinhoFundo) {
        double a = Math.Min(1, Math.Max(0, (dist[p] - limiar * 0.6) / (limiar * 1.2)));
        px[i+3] = (byte)(255 * a);
      }
      if (px[i+3] > 20) { minX = Math.Min(minX, x); maxX = Math.Max(maxX, x); minY = Math.Min(minY, y); maxY = Math.Max(maxY, y); }
    }
    Marshal.Copy(px, 0, d.Scan0, px.Length);
    bmp.UnlockBits(d);

    // Recorta na área útil e reduz para a largura final
    int m = 6;
    minX = Math.Max(0, minX - m); minY = Math.Max(0, minY - m); maxX = Math.Min(W - 1, maxX + m); maxY = Math.Min(H - 1, maxY + m);
    int cw = maxX - minX + 1, ch = maxY - minY + 1;
    int fw = Math.Min(larguraFinal, cw), fh = (int)Math.Round(ch * (double)fw / cw);
    var final = new Bitmap(fw, fh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(final)) {
      g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
      g.DrawImage(bmp, new Rectangle(0, 0, fw, fh), new Rectangle(minX, minY, cw, ch), GraphicsUnit.Pixel);
    }
    final.Save(saida, ImageFormat.Png);
    string info = String.Format("fundo=({0:0},{1:0},{2:0}) recorte={3}x{4} final={5}x{6}", fr, fg, fb, cw, ch, fw, fh);
    final.Dispose(); bmp.Dispose(); orig.Dispose();
    return info;
  }
}
'@

[RecorteCapa]::Processar((Resolve-Path $Entrada).Path, $saida, 30, 720)
"salvo em $saida ($([math]::Round((Get-Item $saida).Length / 1KB)) KB)"
