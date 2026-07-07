# Levanta el entorno local completo contra la base de datos de PRODUCCION.
# 1) Tunel SSH  2) API NestJS  3) Frontend Vite en http://localhost:5173
#
# Uso:  npm run dev:local

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$key = "$env:USERPROFILE\.ssh\vmm_server"
$sshHost = "213.136.69.57"
$sshPort = "2981"
$sshUser = "root"
$frontendPort = 5173
$apiPort = 4000

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-ListenPort {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 45
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening -Port $Port) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Wait-ApiHealth {
  param([int]$TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:${apiPort}/api/health" -TimeoutSec 5
      if ($response.ok -eq $true) {
        return $true
      }
    } catch {
      # API still booting
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

if (-not (Test-Path $key)) {
  Write-Host "No se encontro la llave SSH en $key" -ForegroundColor Red
  exit 1
}

Write-Host "=== Entorno local (DB produccion via tunel SSH) ===" -ForegroundColor Cyan

if (-not (Test-PortListening -Port 5432) -or -not (Test-PortListening -Port 6379)) {
  Write-Host "1/3  Abriendo tunel SSH (PostgreSQL 5432 + Redis 6379)..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Write-Host 'Tunel SSH activo. No cierres esta ventana.' -ForegroundColor Green; ssh -N -L 127.0.0.1:5432:127.0.0.1:5432 -L 127.0.0.1:6379:127.0.0.1:6379 -p ${sshPort} -i `"$key`" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 ${sshUser}@${sshHost}"
  )

  if (-not (Wait-Port -Port 5432) -or -not (Wait-Port -Port 6379)) {
    Write-Host "No se pudo abrir el tunel SSH a produccion." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "1/3  Tunel SSH ya activo (5432/6379)." -ForegroundColor Green
}

if (-not (Test-PortListening -Port $apiPort)) {
  Write-Host "2/3  Iniciando API local (http://localhost:${apiPort})..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd `"$root\backend`"; npm run start:dev"
  )

  if (-not (Wait-Port -Port $apiPort)) {
    Write-Host "La API no arranco en el puerto ${apiPort}." -ForegroundColor Red
    exit 1
  }

  if (-not (Wait-ApiHealth)) {
    Write-Host "La API no responde en /api/health. Revisa backend/.env y el tunel." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "2/3  API ya activa en http://localhost:${apiPort}." -ForegroundColor Green
  if (-not (Wait-ApiHealth -TimeoutSeconds 10)) {
    Write-Host "La API en ${apiPort} no responde ok en /api/health." -ForegroundColor Red
    exit 1
  }
}

if (Test-PortListening -Port $frontendPort) {
  Write-Host "Liberando puerto ${frontendPort}..." -ForegroundColor Yellow
  Stop-ListenPort -Port $frontendPort
  Start-Sleep -Seconds 1
}

Stop-ListenPort -Port 5174

Write-Host "3/3  Iniciando frontend (http://localhost:${frontendPort})..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd `"$root`"; npm run dev"
)

if (-not (Wait-Port -Port $frontendPort)) {
  Write-Host "El frontend no arranco en http://localhost:${frontendPort}." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Listo:" -ForegroundColor Green
Write-Host "  Web:  http://localhost:${frontendPort}" -ForegroundColor Green
Write-Host "  API:  http://localhost:${apiPort}/api/health" -ForegroundColor Green
Write-Host "  DB:   produccion via tunel SSH (5432/6379)" -ForegroundColor Yellow
Write-Host ""
Write-Host "No cierres la ventana del tunel SSH ni la de la API." -ForegroundColor DarkGray
