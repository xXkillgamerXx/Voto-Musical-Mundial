# Refresh MusicMundial charts from the Desktop scraper pack, then publish into the site.
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\charts-bot\run-update.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\charts-bot\run-update.ps1 -SkipScrape
#   powershell -ExecutionPolicy Bypass -File .\scripts\charts-bot\run-update.ps1 -WithRadio

param(
  [switch]$SkipScrape,
  [switch]$WithRadio
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pack = if ($env:MUSICMUNDIAL_PACK) { $env:MUSICMUNDIAL_PACK } else { Join-Path $env:USERPROFILE "OneDrive\Escritorio\MusicMundial" }

if (-not (Test-Path $pack)) {
  throw "MusicMundial pack not found: $pack"
}

if (-not $SkipScrape) {
  Write-Host "Scraping kworb charts..." -ForegroundColor Cyan
  Push-Location $pack
  node .\kworb.js --once
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "kworb.js failed" }
  Pop-Location
}

if ($WithRadio) {
  if (-not $env:AA_USER -or -not $env:AA_PASS) {
    Write-Host "Skip radio: set AA_USER and AA_PASS to refresh All Access spins." -ForegroundColor Yellow
  } else {
    Write-Host "Scraping All Access radio..." -ForegroundColor Cyan
    Push-Location $pack
    node .\allaccess.js
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "allaccess.js failed" }
    Pop-Location
  }
}

Write-Host "Publishing into news/public/charts..." -ForegroundColor Cyan
$env:MUSICMUNDIAL_PACK = $pack
node (Join-Path $root "scripts\charts-bot\publish-to-site.cjs")
if ($LASTEXITCODE -ne 0) { throw "publish-to-site.cjs failed" }

Write-Host "Done. Local charts updated. Deploy when ready: deploy-prod.ps1 -FrontendOnly" -ForegroundColor Green
