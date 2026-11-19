<#
  Construye los recursos de marca de la app desde los originales de Agrovia.

  Fuente primaria: `logo color.png` (versión a color, la principal).
  Fuente de la versión blanca y del monocolor: `logo negro .png`.

  No se redibuja nada: se recorta el original, se quita el fondo y se compone
  en los tamaños que pide Expo. Si la marca cambia, se cambia la ruta y se
  vuelve a correr este script.
#>

Add-Type -AssemblyName System.Drawing

$carpetaMarca = 'F:\uni\Z- Semillero baston\identidad de marca'
$origenColor = Join-Path $carpetaMarca 'logo color.png'
$origenNegro = Join-Path $carpetaMarca 'logo negro .png'

$assets = Join-Path $PSScriptRoot '..\..\assets' | Resolve-Path -Relative
$assets = (Resolve-Path (Join-Path $PSScriptRoot '..\..\assets')).Path
$destinoMarca = Join-Path $assets 'brand'
if (-not (Test-Path $destinoMarca)) { New-Item -ItemType Directory -Path $destinoMarca | Out-Null }

$crema = [System.Drawing.Color]::FromArgb(249, 250, 245)
$blanco = [System.Drawing.Color]::White

<#
  Recorta una zona y quita el fondo por distancia de color.

  Se usa para la versión a color: el alfa sale de cuán lejos está el píxel del
  color de fondo, así el verde claro de los campos no se vuelve translúcido
  (que es lo que pasaría calculando el alfa con la luminancia).
#>
function New-RecorteColor([System.Drawing.Bitmap]$img, [System.Drawing.Rectangle]$rect, [System.Drawing.Color]$fondo, [string]$salida, [int]$margen) {
  $bmp = New-Object System.Drawing.Bitmap ($rect.Width + 2 * $margen), ($rect.Height + 2 * $margen)
  for ($y = 0; $y -lt $rect.Height; $y++) {
    for ($x = 0; $x -lt $rect.Width; $x++) {
      $c = $img.GetPixel($rect.X + $x, $rect.Y + $y)
      $distancia = [Math]::Max([Math]::Abs($c.R - $fondo.R), [Math]::Max([Math]::Abs($c.G - $fondo.G), [Math]::Abs($c.B - $fondo.B)))
      if ($distancia -le 8) { continue }
      $alfa = [Math]::Min(255, ($distancia - 8) * 6)
      $bmp.SetPixel($x + $margen, $y + $margen, [System.Drawing.Color]::FromArgb($alfa, $c.R, $c.G, $c.B))
    }
  }
  $bmp.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  $([System.IO.Path]::GetFileName($salida))  $($bmp.Width)x$($bmp.Height)"
}

<# Recorta una zona de un original en blanco y negro y la pinta de un color sólido. #>
function New-RecorteSilueta([System.Drawing.Bitmap]$img, [System.Drawing.Rectangle]$rect, [System.Drawing.Color]$color, [string]$salida, [int]$margen) {
  $bmp = New-Object System.Drawing.Bitmap ($rect.Width + 2 * $margen), ($rect.Height + 2 * $margen)
  for ($y = 0; $y -lt $rect.Height; $y++) {
    for ($x = 0; $x -lt $rect.Width; $x++) {
      $c = $img.GetPixel($rect.X + $x, $rect.Y + $y)
      $lum = [int](0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B)
      $alfa = 255 - $lum
      if ($alfa -le 4) { continue }
      $bmp.SetPixel($x + $margen, $y + $margen, [System.Drawing.Color]::FromArgb($alfa, $color.R, $color.G, $color.B))
    }
  }
  $bmp.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  $([System.IO.Path]::GetFileName($salida))  $($bmp.Width)x$($bmp.Height)"
}

<# Compone un lienzo cuadrado con una marca centrada y lo guarda. #>
function New-Lienzo([string]$marcaArchivo, [int]$lado, [System.Drawing.Color]$fondo, [double]$escala, [string]$salida) {
  $sello = [System.Drawing.Bitmap]::FromFile($marcaArchivo)
  $lienzo = New-Object System.Drawing.Bitmap $lado, $lado
  $g = [System.Drawing.Graphics]::FromImage($lienzo)
  $g.Clear($fondo)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $ancho = [int]($lado * $escala)
  $alto = [int]($ancho * $sello.Height / $sello.Width)
  $g.DrawImage($sello, [int](($lado - $ancho) / 2), [int](($lado - $alto) / 2), $ancho, $alto)
  $g.Dispose()
  $lienzo.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $sello.Dispose()
  $lienzo.Dispose()
  Write-Host "  $([System.IO.Path]::GetFileName($salida))  ${lado}x${lado}"
}

$color = [System.Drawing.Bitmap]::FromFile($origenColor)
$negro = [System.Drawing.Bitmap]::FromFile($origenNegro)

$fondoColor = $color.GetPixel(4, 4)

Write-Host 'Recortes de marca:'
# Marca A y logotipo horizontal de la versión a color (la principal).
New-RecorteColor $color (New-Object System.Drawing.Rectangle 393, 315, 472, 352) $fondoColor (Join-Path $destinoMarca 'agrovia-simbolo-color.png') 10
New-RecorteColor $color (New-Object System.Drawing.Rectangle 173, 689, 906, 244) $fondoColor (Join-Path $destinoMarca 'agrovia-logo-color.png') 10
# Las versiones blancas salen del original en blanco y negro (fondo blanco puro).
New-RecorteSilueta $negro (New-Object System.Drawing.Rectangle 353, 294, 550, 384) $blanco (Join-Path $destinoMarca 'agrovia-simbolo-blanco.png') 10
New-RecorteSilueta $negro (New-Object System.Drawing.Rectangle 108, 688, 1023, 270) $blanco (Join-Path $destinoMarca 'agrovia-logo-blanco.png') 10
New-RecorteSilueta $negro (New-Object System.Drawing.Rectangle 353, 294, 550, 384) ([System.Drawing.Color]::White) (Join-Path $destinoMarca 'agrovia-simbolo-monocromo.png') 10

$simboloColor = Join-Path $destinoMarca 'agrovia-simbolo-color.png'
$simboloMonocromo = Join-Path $destinoMarca 'agrovia-simbolo-monocromo.png'

Write-Host 'Iconos de la app:'
New-Lienzo $simboloColor 1024 $crema 0.60 (Join-Path $assets 'icon.png')
New-Lienzo $simboloColor 1024 ([System.Drawing.Color]::Transparent) 0.50 (Join-Path $assets 'android-icon-foreground.png')
New-Lienzo $simboloMonocromo 1024 ([System.Drawing.Color]::Transparent) 0.50 (Join-Path $assets 'android-icon-monochrome.png')
New-Lienzo $simboloColor 512 ([System.Drawing.Color]::Transparent) 0.86 (Join-Path $assets 'splash-icon.png')

$color.Dispose()
$negro.Dispose()
Write-Host 'Listo.'
