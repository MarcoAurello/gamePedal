# Gera os quadros do Davi ABAIXADO na bike a partir dos quadros da pedalada.
# O corpo acima do quadril é achatado e inclinado para a frente (sobre o guidão);
# a bike e as pernas ficam como estão, então ele continua pedalando.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\abaixar.ps1
param([double]$Quadril = 0.50, [double]$Achatar = 0.52, [double]$Inclinar = 0.45)

$raiz = Split-Path $PSScriptRoot -Parent
$pasta = Join-Path $raiz 'assets\sprites'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Abaixar {
  // Peças da bike (azul/roxo do quadro e guidão, cinza do metal) não se mexem
  static int W_, H_;
  static bool EhBike(byte b, byte g, byte r, int x, int y) {
    int mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b));
    int lum = (r + g + b) / 3;
    // azul / roxo do quadro (forte); o halo azul-claro em volta do Davi não conta
    if (b > r + 50 && b > g + 30) return true;          // azul das rodas
    if (r > g + 40 && b > g + 40) return true;          // roxo do quadro
    // metal cinza só na região do guidão (na frente e mais embaixo); o contorno do Davi também é cinza
    if (mx - mn < 22 && lum > 70 && lum < 190 && x > W_ * 0.6 && y > H_ * 0.38) return true;
    return false;
  }

  // pixel claro e azulado = sobra do fundo da folha de sprites
  static bool Halo(byte b, byte g, byte r) { return (r + g + b) / 3 > 150 && b >= r; }

  public static void Gerar(string entrada, string saida, double quadril, double achatar, double inclinar) {
    var bmp = new Bitmap(entrada);
    int W = bmp.Width, H = bmp.Height; W_ = W; H_ = H;
    var src = new byte[W * H * 4];
    var d = bmp.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    Marshal.Copy(d.Scan0, src, 0, src.Length);
    bmp.UnlockBits(d);
    int hy = (int)(H * quadril);   // linha do quadril (selim)

    // 1) base: tudo abaixo do quadril + a bike acima dele
    var dst = new byte[src.Length];
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
      int i = (y * W + x) * 4;
      if (src[i+3] == 0) continue;
      if (y >= hy || (EhBike(src[i], src[i+1], src[i+2], x, y) && !Halo(src[i], src[i+1], src[i+2]))) {
        dst[i] = src[i]; dst[i+1] = src[i+1]; dst[i+2] = src[i+2]; dst[i+3] = src[i+3];
      }
    }

    // 2) tronco, braços e cabeça: achatados para baixo e puxados para a frente
    for (int y = 0; y < hy; y++) for (int x = 0; x < W; x++) {
      double sy = hy - (hy - y) / achatar;                 // de onde vem esse pixel
      if (sy < 0) continue;
      double sx = x - inclinar * (hy - sy) * (1 - achatar);
      int ix = (int)Math.Round(sx), iy = (int)Math.Round(sy);
      if (ix < 0 || ix >= W || iy < 0 || iy >= hy) continue;
      int s = (iy * W + ix) * 4, t = (y * W + x) * 4;
      if (src[s+3] == 0 || EhBike(src[s], src[s+1], src[s+2], ix, iy) || Halo(src[s], src[s+1], src[s+2])) continue;
      dst[t] = src[s]; dst[t+1] = src[s+1]; dst[t+2] = src[s+2]; dst[t+3] = src[s+3];
    }

    var final = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    var fd = final.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    Marshal.Copy(dst, 0, fd.Scan0, dst.Length);
    final.UnlockBits(fd);
    final.Save(saida, ImageFormat.Png);
    final.Dispose(); bmp.Dispose();
  }
}
'@

for ($i = 0; $i -lt 6; $i++) {
  [Abaixar]::Gerar((Join-Path $pasta "pedal_$i.png"), (Join-Path $pasta "abaixado_$i.png"), $Quadril, $Achatar, $Inclinar)
}
Get-ChildItem $pasta -Filter 'abaixado_*.png' | Select-Object Name, Length | Format-Table -AutoSize | Out-String
