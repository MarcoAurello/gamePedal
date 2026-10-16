# Gera os ícones do app a partir do sprite do Davi pedalando.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\icones.ps1
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path $PSScriptRoot -Parent
$saida = Join-Path $raiz 'icons'
New-Item -ItemType Directory -Force $saida | Out-Null
$davi = [System.Drawing.Image]::FromFile((Join-Path $raiz 'assets\sprites\pedal_0.png'))

function Icone($tamanho, $escala, $arquivo, $cantos) {
  $bmp = New-Object System.Drawing.Bitmap $tamanho, $tamanho
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fundo: céu azul com chão de paralelepípedo
  $area = New-Object System.Drawing.Rectangle 0, 0, $tamanho, $tamanho
  $ceu = New-Object System.Drawing.Drawing2D.LinearGradientBrush $area, ([System.Drawing.Color]::FromArgb(255, 63, 155, 230)), ([System.Drawing.Color]::FromArgb(255, 200, 234, 252)), 90
  $forma = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($cantos) {
    $r = $tamanho * 0.22
    $forma.AddArc(0, 0, $r, $r, 180, 90)
    $forma.AddArc($tamanho - $r, 0, $r, $r, 270, 90)
    $forma.AddArc($tamanho - $r, $tamanho - $r, $r, $r, 0, 90)
    $forma.AddArc(0, $tamanho - $r, $r, $r, 90, 90)
    $forma.CloseFigure()
  } else {
    $forma.AddRectangle($area)
  }
  $g.FillPath($ceu, $forma)
  $g.SetClip($forma)

  $chaoY = [int]($tamanho * (0.5 + $escala * 0.36))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 138, 134, 127))), 0, $chaoY, $tamanho, $tamanho - $chaoY)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 241, 241, 236))), 0, $chaoY - [int]($tamanho * 0.02), $tamanho, [int]($tamanho * 0.025))

  # Sol amarelo atrás
  $sol = $tamanho * $escala * 0.55
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 210, 63))), [float]($tamanho / 2 - $sol / 2), [float]($chaoY - $sol * 1.05), [float]$sol, [float]$sol)

  # Davi na bike, em pixel art (sem suavizar)
  $g.InterpolationMode = 'NearestNeighbor'
  $g.PixelOffsetMode = 'Half'
  $w = $tamanho * $escala
  $h = $w * $davi.Height / $davi.Width
  $g.DrawImage($davi, [float](($tamanho - $w) / 2), [float]($chaoY - $h + $tamanho * 0.01), [float]$w, [float]$h)

  $bmp.Save($arquivo, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Icone 192 0.72 (Join-Path $saida 'icon-192.png') $true
Icone 512 0.72 (Join-Path $saida 'icon-512.png') $true
Icone 512 0.56 (Join-Path $saida 'icon-maskable-512.png') $false
Icone 180 0.66 (Join-Path $saida 'apple-touch-icon.png') $false
$davi.Dispose()
Get-ChildItem $saida | Select-Object Name, Length
