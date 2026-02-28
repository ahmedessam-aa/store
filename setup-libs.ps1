$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$libs = Join-Path $root 'libs'
if (-not (Test-Path $libs)) {
  New-Item -ItemType Directory -Path $libs | Out-Null
}

$files = @(
  @{ Url = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'; Out = 'chart.umd.min.js' },
  @{ Url = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; Out = 'jspdf.umd.min.js' },
  @{ Url = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; Out = 'xlsx.full.min.js' }
)

foreach ($f in $files) {
  $target = Join-Path $libs $f.Out
  Write-Host "Downloading $($f.Out)..."
  Invoke-WebRequest -Uri $f.Url -OutFile $target
  if (-not (Test-Path $target)) {
    throw "Failed to download $($f.Out)"
  }
}

Write-Host ''
Write-Host 'Done. Libraries are installed in:' $libs
Get-ChildItem $libs | Select-Object Name, Length
