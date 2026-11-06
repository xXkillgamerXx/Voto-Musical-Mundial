# Deploy production to host 161 (www.musicmundial.com).
# - News HTML + vote SPA static files
# - Backend Docker stack (new_musicmundial / nmm-*)
#
# Requires: NMM_SSH_PASSWORD (root @ 161.97.154.152:2981)

param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$hostName = "161.97.154.152"

if (-not $env:NMM_SSH_PASSWORD) {
  $envFile = Join-Path $root "deploy\new_musicmundial\.env.contabo"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*NMM_SSH_PASSWORD\s*=\s*(.*)\s*$') {
        $env:NMM_SSH_PASSWORD = $Matches[1].Trim().Trim("'").Trim('"')
      }
    }
  }
}

if (-not $env:NMM_SSH_PASSWORD) {
  Write-Host "Define NMM_SSH_PASSWORD (root del host 161) y vuelve a correr deploy-prod.ps1" -ForegroundColor Red
  exit 1
}

if (-not $BackendOnly) {
  Write-Host "Building vote frontend..." -ForegroundColor Cyan
  Push-Location $root
  $env:VITE_API_BASE_URL = "/vote/api"
  $env:VITE_FIREBASE_VAPID_KEY = "BNQEx4dNvUVEV_CJ1qV64yzOA3xXPB2Y30EN_m4RLTf22tbVe_E1lkV-jNK7lbh4pbTxN2aOAN5mLPUMdYcRZuc"
  $env:VITE_TURNSTILE_SITE_KEY = "0x4AAAAAADscx-A_CXbgnFea"
  $env:VITE_INSTAGRAM_HANDLE = "musicmundial_awards"
  $env:VITE_INSTAGRAM_URL = "https://www.instagram.com/musicmundial_awards/"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Vote frontend build failed" }
  Remove-Item Env:VITE_API_BASE_URL, Env:VITE_FIREBASE_VAPID_KEY, Env:VITE_TURNSTILE_SITE_KEY, Env:VITE_INSTAGRAM_HANDLE, Env:VITE_INSTAGRAM_URL -ErrorAction SilentlyContinue

  Write-Host "Building news frontend (www.musicmundial.com)..." -ForegroundColor Cyan
  npx vite build --config news/vite.config.js
  if ($LASTEXITCODE -ne 0) { throw "News frontend build failed" }
  Pop-Location
}

if ($FrontendOnly) {
  Write-Host "Uploading news+vote HTML to 161..." -ForegroundColor Cyan
  Push-Location $root
  py -3 .\deploy\new_musicmundial\scripts\upload_html_161.py
  if ($LASTEXITCODE -ne 0) { throw "HTML upload to 161 failed" }
  Pop-Location
} elseif ($BackendOnly) {
  Write-Host "Validating backend..." -ForegroundColor Cyan
  Push-Location "$root\backend"
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "Backend lint failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
  Pop-Location

  Write-Host "Deploying backend+HTML stack to 161..." -ForegroundColor Cyan
  Push-Location $root
  py -3 .\deploy\new_musicmundial\scripts\deploy_contabo.py
  if ($LASTEXITCODE -ne 0) { throw "161 deploy failed" }
  Pop-Location
} else {
  Write-Host "Validating backend..." -ForegroundColor Cyan
  Push-Location "$root\backend"
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "Backend lint failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
  Pop-Location

  Write-Host "Deploying full stack (HTML + Docker) to 161 ($hostName)..." -ForegroundColor Cyan
  Push-Location $root
  py -3 .\deploy\new_musicmundial\scripts\deploy_contabo.py
  if ($LASTEXITCODE -ne 0) { throw "161 deploy failed" }
  Pop-Location
}

Write-Host "Verifying www.musicmundial.com..." -ForegroundColor Cyan
try {
  $landing = Invoke-WebRequest -Uri "https://www.musicmundial.com/" -UseBasicParsing -TimeoutSec 25
  Write-Host "HOME: $($landing.StatusCode)"
} catch {
  Write-Host "HOME: $($_.Exception.Message)" -ForegroundColor Yellow
}
try {
  $vote = Invoke-WebRequest -Uri "https://www.musicmundial.com/vote/" -UseBasicParsing -TimeoutSec 25
  Write-Host "VOTE: $($vote.StatusCode)"
} catch {
  Write-Host "VOTE: $($_.Exception.Message)" -ForegroundColor Yellow
}
try {
  $api = Invoke-WebRequest -Uri "https://www.musicmundial.com/api/health" -UseBasicParsing -TimeoutSec 25
  Write-Host "API: $($api.Content)"
} catch {
  Write-Host "API: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "Deploy finished (host 161)." -ForegroundColor Green
