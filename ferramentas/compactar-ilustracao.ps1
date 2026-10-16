# Deixa a ilustração da tela inicial leve sem perder resolução:
# separa a cor (JPEG) da transparência (máscara PNG), que o CSS junta de volta.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\compactar-ilustracao.ps1
param([int]$Qualidade = 86)

$raiz = Split-Path $PSScriptRoot -Parent
$entrada = Join-Path $raiz 'assets\davi-impinando.png'
$saidaCor = Join-Path $raiz 'assets\davi-impinando.jpg'
$saidaMascara = Join-Path $raiz 'assets\davi-impinando-mascara.png'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Compactar {
  public static void Processar(string entrada, string saidaCor, string saidaMascara, long qualidade) {
    var orig = new Bitmap(entrada);
    int W = orig.Width, H = orig.Height;
    var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(orig, 0, 0, W, H);
    var d = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var px = new byte[W * H * 4];
    Marshal.Copy(d.Scan0, px, 0, px.Length);

    // Máscara: só a transparência (cor preta constante comprime muito bem)
    var mascara = new byte[px.Length];
    for (int p = 0; p < W * H; p++) mascara[p * 4 + 3] = px[p * 4 + 3];

    // Cor: as áreas transparentes recebem a cor do pixel visível mais próximo,
    // para o JPEG não criar borda escura em volta do desenho
    var feito = new bool[W * H];
    var fila = new Queue<int>();
    for (int p = 0; p < W * H; p++) if (px[p * 4 + 3] > 200) { feito[p] = true; fila.Enqueue(p); }
    while (fila.Count > 0) {
      int p = fila.Dequeue(), x = p % W, y = p / W;
      int[] viz = { x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1 };
      foreach (int q in viz) {
        if (q < 0 || feito[q]) continue;
        feito[q] = true;
        px[q * 4] = px[p * 4]; px[q * 4 + 1] = px[p * 4 + 1]; px[q * 4 + 2] = px[p * 4 + 2];
        fila.Enqueue(q);
      }
    }
    for (int p = 0; p < W * H; p++) px[p * 4 + 3] = 255;
    Marshal.Copy(px, 0, d.Scan0, px.Length);
    bmp.UnlockBits(d);

    var enc = Array.Find(ImageCodecInfo.GetImageEncoders(), e => e.MimeType == "image/jpeg");
    var prm = new EncoderParameters(1);
    prm.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, qualidade);
    using (var cor = new Bitmap(W, H, PixelFormat.Format24bppRgb)) {
      using (var g = Graphics.FromImage(cor)) g.DrawImage(bmp, 0, 0, W, H);
      cor.Save(saidaCor, enc, prm);
    }

    // Máscara em 8 bits com paleta de 256 níveis de transparência (bem menor que 32 bits)
    using (var m = new Bitmap(W, H, PixelFormat.Format8bppIndexed)) {
      var paleta = m.Palette;
      for (int i = 0; i < 256; i++) paleta.Entries[i] = Color.FromArgb(i, 0, 0, 0);
      m.Palette = paleta;
      var md = m.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.WriteOnly, PixelFormat.Format8bppIndexed);
      var linha = new byte[md.Stride];
      for (int y = 0; y < H; y++) {
        for (int x = 0; x < W; x++) linha[x] = mascara[(y * W + x) * 4 + 3];
        Marshal.Copy(linha, 0, md.Scan0 + y * md.Stride, md.Stride);
      }
      m.UnlockBits(md);
      m.Save(saidaMascara, ImageFormat.Png);
    }
    bmp.Dispose(); orig.Dispose();
  }
}
'@

[Compactar]::Processar($entrada, $saidaCor, $saidaMascara, $Qualidade)
foreach ($f in $entrada, $saidaCor, $saidaMascara) { "{0,-28} {1,6} KB" -f (Split-Path $f -Leaf), [math]::Round((Get-Item $f).Length / 1KB) }
