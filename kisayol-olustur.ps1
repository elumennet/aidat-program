$ErrorActionPreference = 'Stop'
# Aidat - masaüstü kısayolu oluşturur
# (C) 2026 Cemal Solmaz - Tüm hakları saklıdır.

$masa = [Environment]::GetFolderPath('Desktop')
$klasor = Join-Path $masa 'Aidat'
$bat = Join-Path $klasor 'Aidat.bat'
$ikon = Join-Path $klasor 'ikon.ico'

if (-not (Test-Path $bat)) { throw "Aidat.bat bulunamadi: $bat" }

# ico üret (ikon-192.png'den basit ICO)
$png = Join-Path $klasor 'Uygulama\icon-192.png'
if (Test-Path $png) {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile($png)
  $bmp = New-Object System.Drawing.Bitmap 64, 64
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, 64, 64)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes = $ms.ToArray()
  $ms.Dispose(); $bmp.Dispose(); $img.Dispose()

  $fs = [System.IO.File]::Create($ikon)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([UInt16]0)            # reserved
  $bw.Write([UInt16]1)            # type = icon
  $bw.Write([UInt16]1)            # count
  $bw.Write([Byte]64)             # width
  $bw.Write([Byte]64)             # height
  $bw.Write([Byte]0)              # colors
  $bw.Write([Byte]0)              # reserved
  $bw.Write([UInt16]1)            # planes
  $bw.Write([UInt16]32)           # bpp
  $bw.Write([UInt32]$pngBytes.Length)
  $bw.Write([UInt32]22)           # offset
  $bw.Write($pngBytes)
  $bw.Flush(); $bw.Close(); $fs.Close()
}

# Kısayollar: masaüstü + Başlat menüsü
$hedefler = @(
  (Join-Path $masa 'Aidat.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Aidat.lnk')
)
foreach ($lnk in $hedefler) {
  $ws = New-Object -ComObject WScript.Shell
  $s = $ws.CreateShortcut($lnk)
  $s.TargetPath = $bat
  $s.WorkingDirectory = $klasor
  $s.Description = 'Aidat - Bina Gelir Gider (C) 2026 Cemal Solmaz'
  if (Test-Path $ikon) { $s.IconLocation = "$ikon,0" }
  $s.WindowStyle = 7
  $s.Save()
  Write-Output "Kisayol olusturuldu: $lnk"
}

Write-Output 'TAMAM'
