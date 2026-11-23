$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = 'D:\Development\craft-glass'
$webAssets = Join-Path $root 'web\assets'
$storeDir = Join-Path $root 'store-assets'
$resDir = Join-Path $root 'android\res'

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Load-SpriteFrame([string]$relPath, [int]$cellSize = 80) {
  $full = Join-Path $webAssets $relPath
  $src = [System.Drawing.Bitmap]::FromFile($full)
  if ($src.Width -gt $cellSize -and $src.Height -gt $cellSize) {
    $crop = New-Object System.Drawing.Bitmap($cellSize, $cellSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($crop)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $cellSize, $cellSize)), (New-Object System.Drawing.Rectangle(0, 0, $cellSize, $cellSize)), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $src.Dispose()
    return $crop
  }
  return $src
}

$heroStudy = Load-SpriteFrame 'heroes\boy-b-study.png' 80
$heroIdle = Load-SpriteFrame 'heroes\boy-b-idle.png' 80
$foxIdle = Load-SpriteFrame 'creatures\twigfox-idle.png' 80
$crownImg = Load-SpriteFrame 'equipment\head-crown.png' 48
$worldImg = [System.Drawing.Bitmap]::FromFile((Join-Path $webAssets 'worlds\world-01.png'))
$iconMasterPath = Join-Path $storeDir 'icon-master-1024.png'
if (-not (Test-Path $iconMasterPath)) {
  throw "Missing icon master PNG: $iconMasterPath"
}
$iconMaster = [System.Drawing.Bitmap]::FromFile($iconMasterPath)

# 1. Generate 512x512 App Icon, Android Adaptive Foreground, Mipmaps, and Web/PWA Icons
function Render-AppIcon([string]$outPath, [int]$size, [bool]$isRound = $false) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($isRound) {
    $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clipPath.AddEllipse(0, 0, $size, $size)
    $g.SetClip($clipPath)
    $clipPath.Dispose()
  }

  $g.DrawImage($iconMaster, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))

  $g.Dispose()
  $dir = Split-Path $outPath -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Render-AppIcon (Join-Path $storeDir 'icon-512.png') 512 $false
Render-AppIcon (Join-Path $resDir 'drawable\ic_launcher_foreground.png') 432 $false
Render-AppIcon (Join-Path $webAssets 'icon-192.png') 192 $false
Render-AppIcon (Join-Path $webAssets 'icon-512.png') 512 $false

$mipmaps = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}
foreach ($kv in $mipmaps.GetEnumerator()) {
  $mDir = Join-Path $resDir $kv.Key
  Render-AppIcon (Join-Path $mDir 'ic_launcher.png') $kv.Value $false
  Render-AppIcon (Join-Path $mDir 'ic_launcher_round.png') $kv.Value $true
}
$iconMaster.Dispose()

# 2. Generate 1024x500 Feature Graphic
$fw = 1024; $fh = 500
$fgBmp = New-Object System.Drawing.Bitmap($fw, $fh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fg = [System.Drawing.Graphics]::FromImage($fgBmp)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Crisp pixel world backdrop across right/full canvas
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$fg.DrawImage($worldImg, (New-Object System.Drawing.Rectangle(0, 0, $fw, $fh)))

# Deep-emerald glass gradient scrim from left for clean readable branding
$scrim = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point($fw, 0)),
  [System.Drawing.Color]::FromArgb(245, 6, 78, 59),
  [System.Drawing.Color]::FromArgb(75, 6, 78, 59)
)
$fg.FillRectangle($scrim, 0, 0, $fw, $fh)
$scrim.Dispose()

# Draw large crisp Pixel Hero + Companion on right stage
$fg.DrawImage($heroIdle, (New-Object System.Drawing.Rectangle(635, 165, 220, 220)))
$fg.DrawImage($foxIdle, (New-Object System.Drawing.Rectangle(820, 240, 150, 150)))

# Typography & Liquid Glass Pills on left
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$titleFont = New-Object System.Drawing.Font('Segoe UI', 54, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Regular)
$pillFont = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)

$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$mintBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 167, 243, 208))
$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 253, 230, 138))

$fg.DrawString('Craft Glass', $titleFont, $whiteBrush, 56, 86)
$fg.DrawString('Proof of Real Human Effort', $subFont, $mintBrush, 60, 178)
$fg.DrawString('Weekly Pools  •  90m Anti-Cram Cap  •  400h Pixel Guild', $bodyFont, $whiteBrush, 60, 232)

# Three crisp frosted pills
$pills = @('Blurred Timelapses', 'Human Blessing Pacts', 'FSRS & Local-First')
$px = 60
foreach ($text in $pills) {
  $sz = $fg.MeasureString($text, $pillFont)
  $pw = [int]$sz.Width + 28
  $ph = 40
  $pp = New-RoundedRectPath $px 305 $pw $ph 20
  $pBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
  $fg.FillPath($pBg, $pp)
  $darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 6, 95, 70))
  $fg.DrawString($text, $pillFont, $darkBrush, ($px + 14), 314)
  $pBg.Dispose(); $darkBrush.Dispose(); $pp.Dispose()
  $px += $pw + 12
}

$fg.DrawString('Zero AI Hype  •  Free or Pro  •  Zero Pay-to-Win', $pillFont, $goldBrush, 60, 385)

$titleFont.Dispose(); $subFont.Dispose(); $bodyFont.Dispose(); $pillFont.Dispose()
$whiteBrush.Dispose(); $mintBrush.Dispose(); $goldBrush.Dispose()
$fg.Dispose()
$fgBmp.Save((Join-Path $storeDir 'feature-graphic-1024x500.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$fgBmp.Dispose()

$heroStudy.Dispose(); $heroIdle.Dispose(); $foxIdle.Dispose(); $crownImg.Dispose(); $worldImg.Dispose()
Write-Output 'Generated icon-512.png, feature-graphic-1024x500.png, and Android launcher mipmaps.'
