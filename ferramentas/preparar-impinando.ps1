# Prepara a ilustração do Davi impinando (já com fundo transparente):
# corta as bordas vazias, reduz e mede as duas rodas para a animação dos pneus.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\preparar-impinando.ps1
param([int]$Largura = 900)

$raiz = Split-Path $PSScriptRoot -Parent
$entrada = Join-Path $raiz 'assets\impinando-original.png'
$saida = Join-Path $raiz 'assets\davi-impinando.png'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Impinando {
  static byte[] Ler(Bitmap b) {
    var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var px = new byte[b.Width * b.Height * 4];
    Marshal.Copy(d.Scan0, px, 0, px.Length);
    b.UnlockBits(d);
    return px;
  }

  // Caixa dos pixels escuros e opacos (pneu) dentro de uma região
  // lado: -1 = mede pela borda esquerda do pneu, +1 = pela direita (o outro lado tem quadro/chinelo)
  static string Roda(byte[] px, int W, int x0, int y0, int x1, int y1, int lado) {
    int mnx = x1, mny = y1, mxx = x0, mxy = y0;
    for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) {
      int i = (y * W + x) * 4;
      if (px[i+3] > 200 && (px[i] + px[i+1] + px[i+2]) / 3 < 70) {
        mnx = Math.Min(mnx, x); mxx = Math.Max(mxx, x); mny = Math.Min(mny, y); mxy = Math.Max(mxy, y);
      }
    }
    double r = (mxy - mny) / 2.0, cy = mny + r, cx = lado < 0 ? mnx + r : mxx - r;
    return String.Format(System.Globalization.CultureInfo.InvariantCulture, "{{ \"cx\": {0:0}, \"cy\": {1:0}, \"r\": {2:0} }}", cx, cy, r);
  }

  public static string Processar(string entrada, string saida, int larguraFinal) {
    var orig = new Bitmap(entrada);
    int W = orig.Width, H = orig.Height;
    var px = Ler(orig);
    int minX = W, minY = H, maxX = 0, maxY = 0;
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > 20) { minX = Math.Min(minX, x); maxX = Math.Max(maxX, x); minY = Math.Min(minY, y); maxY = Math.Max(maxY, y); }
    }
    int cw = maxX - minX + 1, ch = maxY - minY + 1;
    int fw = Math.Min(larguraFinal, cw), fh = (int)Math.Round(ch * (double)fw / cw);
    var final = new Bitmap(fw, fh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(final)) {
      g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
      g.DrawImage(orig, new Rectangle(0, 0, fw, fh), new Rectangle(minX, minY, cw, ch), GraphicsUnit.Pixel);
    }
    final.Save(saida, ImageFormat.Png);

    // Mede as rodas na imagem final: traseira embaixo à esquerda, dianteira em cima à direita
    var fp = Ler(final);
    string tras = Roda(fp, fw, 0, (int)(fh * 0.55), (int)(fw * 0.45), fh, -1);
    string frente = Roda(fp, fw, (int)(fw * 0.6), 0, fw, (int)(fh * 0.75), 1);
    final.Dispose(); orig.Dispose();
    return String.Format("{{ \"w\": {0}, \"h\": {1}, \"traseira\": {2}, \"dianteira\": {3} }}", fw, fh, tras, frente);
  }
}
'@

$json = [Impinando]::Processar($entrada, $saida, $Largura)
$json
"salvo em $saida ($([math]::Round((Get-Item $saida).Length / 1KB)) KB)"
