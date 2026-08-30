# Deploy vote.musicmundial.com to production.
# Frontend: Apache static files
# Backend: Docker (docker-compose.vote-db.yml)

param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$key = "$env:USERPROFILE\.ssh\vmm_server"
$hostName = "213.136.69.57"
$sshPort = "2981"
$sshUser = "root"
$siteRoot = "/www/wwwroot/vote.musicmundial.com"
$backendRoot = "$siteRoot/backend"
$composeFile = "docker-compose.vote-db.yml"

if (-not (Test-Path $key)) {
  Write-Host "No se encontro la llave SSH en $key" -ForegroundColor Red
  exit 1
}

$ssh = @("-p", $sshPort, "-i", $key, "${sshUser}@${hostName}")
$scp = @("-P", $sshPort, "-i", $key)

function Invoke-Ssh {
  param([string]$Command)
  & ssh @ssh $Command
  if ($LASTEXITCODE -ne 0) { throw "SSH command failed: $Command" }
}

if (-not $BackendOnly) {
  Write-Host "Building frontend..." -ForegroundColor Cyan
  Push-Location $root
  $env:VITE_API_BASE_URL = "/api"
  $env:VITE_FIREBASE_VAPID_KEY = "BNQEx4dNvUVEV_CJ1qV64yzOA3xXPB2Y30EN_m4RLTf22tbVe_E1lkV-jNK7lbh4pbTxN2aOAN5mLPUMdYcRZuc"
  $env:VITE_TURNSTILE_SITE_KEY = "0x4AAAAAADscx-A_CXbgnFea"
  $env:VITE_INSTAGRAM_HANDLE = "musicmundial_awards"
  $env:VITE_INSTAGRAM_URL = "https://www.instagram.com/musicmundial_awards/"
  npm run build
  Remove-Item Env:VITE_API_BASE_URL, Env:VITE_FIREBASE_VAPID_KEY, Env:VITE_TURNSTILE_SITE_KEY, Env:VITE_INSTAGRAM_HANDLE, Env:VITE_INSTAGRAM_URL -ErrorAction SilentlyContinue
  Pop-Location

  Write-Host "Uploading frontend dist..." -ForegroundColor Cyan
  & scp @scp -r "$root\dist\*" "${sshUser}@${hostName}:${siteRoot}/"
  if ($LASTEXITCODE -ne 0) { throw "Frontend upload failed" }

  Write-Host "Fixing frontend permissions..." -ForegroundColor Cyan
  Invoke-Ssh "chmod 755 ${siteRoot}/assets && find ${siteRoot}/assets -type d -exec chmod 755 {} \; && find ${siteRoot}/assets -type f -exec chmod 644 {} \;"
}

if (-not $FrontendOnly) {
  Write-Host "Validating backend..." -ForegroundColor Cyan
  Push-Location "$root\backend"
  npm run lint
  npm run build
  Pop-Location

  Write-Host "Packaging backend source..." -ForegroundColor Cyan
  $archive = Join-Path $root "backend-deploy.tgz"
  if (Test-Path $archive) { Remove-Item $archive -Force }
  & tar -czf $archive --exclude=node_modules --exclude=dist --exclude=.env -C "$root\backend" .

  Write-Host "Uploading backend source..." -ForegroundColor Cyan
  & scp @scp $archive "${sshUser}@${hostName}:/tmp/backend-deploy.tgz"
  if ($LASTEXITCODE -ne 0) { throw "Backend upload failed" }
  Remove-Item $archive -Force

  Write-Host "Rebuilding Docker stack..." -ForegroundColor Cyan
  Invoke-Ssh "cd ${backendRoot} && tar -xzf /tmp/backend-deploy.tgz && rm /tmp/backend-deploy.tgz && docker compose -f ${composeFile} build && docker compose -f ${composeFile} up -d"
}

Write-Host "Verifying production..." -ForegroundColor Cyan
Invoke-Ssh "echo WEB:; curl -sI http://127.0.0.1 -H 'Host: vote.musicmundial.com' | head -1; echo API:; curl -s http://127.0.0.1/api/health -H 'Host: vote.musicmundial.com'; echo; echo ASSET:; curl -sI http://127.0.0.1/assets/ -H 'Host: vote.musicmundial.com' | head -1; echo DOCKER:; docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'NAMES|vmm-'"

Write-Host "Deploy finished." -ForegroundColor Green
