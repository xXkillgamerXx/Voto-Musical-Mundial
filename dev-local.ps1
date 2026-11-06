# Levanta el entorno local completo contra la base de datos de PRODUCCION.
# 1) Tunel SSH  2) API NestJS  3) Frontend en :5174 (/ landing, /vote votacion)
#
# Uso:  npm run dev:local   |   npm run dev:prod

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$newsRoot = Join-Path $root "news"
$sshHost = "161.97.154.152"
$sshPort = "2981"
$sshUser = "root"
$frontendPort = 5174
$apiPort = 4000
$tunnelScript = Join-Path $root "deploy\new_musicmundial\scripts\ssh_tunnel_prod.py"

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
    [int]$TimeoutSeconds = 90
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

function Ensure-SshPassword {
  if ($env:NMM_SSH_PASSWORD) {
    return
  }
  $envFile = Join-Path $root "deploy\new_musicmundial\.env.contabo"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*NMM_SSH_PASSWORD\s*=\s*(.*)\s*$') {
        $env:NMM_SSH_PASSWORD = $Matches[1].Trim().Trim("'").Trim('"')
      }
    }
  }
  if (-not $env:NMM_SSH_PASSWORD) {
    Write-Host "Define NMM_SSH_PASSWORD (root @ ${sshHost}) o agregalo en deploy\new_musicmundial\.env.contabo" -ForegroundColor Red
    exit 1
  }
}

if (-not (Test-Path $tunnelScript)) {
  Write-Host "No se encontro el script de tunel: $tunnelScript" -ForegroundColor Red
  exit 1
}

Ensure-SshPassword

Write-Host "=== Entorno local (DB produccion via tunel SSH @ ${sshHost}) ===" -ForegroundColor Cyan

if (-not (Test-PortListening -Port 5432) -or -not (Test-PortListening -Port 6379)) {
  Write-Host "1/4  Abriendo tunel SSH (PostgreSQL 5432 -> 5433 + Redis nmm-redis)..." -ForegroundColor Cyan
  $pw = $env:NMM_SSH_PASSWORD.Replace("'", "''")
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:NMM_SSH_PASSWORD = '$pw'; py -3 `"$tunnelScript`""
  )

  if (-not (Wait-Port -Port 5432) -or -not (Wait-Port -Port 6379)) {
    Write-Host "No se pudo abrir el tunel SSH a produccion (${sshUser}@${sshHost}:${sshPort})." -ForegroundColor Red
    Write-Host "Revisa NMM_SSH_PASSWORD y que el host 161 este accesible." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "1/4  Tunel SSH ya activo (5432/6379)." -ForegroundColor Green
}

if (-not (Test-PortListening -Port $apiPort)) {
  Write-Host "2/4  Iniciando API local (http://localhost:${apiPort})..." -ForegroundColor Cyan
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
  Write-Host "2/4  API ya activa en http://localhost:${apiPort}." -ForegroundColor Green
  if (-not (Wait-ApiHealth -TimeoutSeconds 10)) {
    Write-Host "La API en ${apiPort} no responde ok en /api/health." -ForegroundColor Red
    exit 1
  }
}

$workerRunning = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'workers[/\\]main|start:worker' }
if (-not $workerRunning) {
  Write-Host "3/4  Iniciando worker (bots + sync de votos)..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd `"$root\backend`"; npm run start:worker:dev"
  )
  Start-Sleep -Seconds 2
} else {
  Write-Host "3/4  Worker ya activo." -ForegroundColor Green
}

if (-not (Test-Path $newsRoot)) {
  Write-Host "No se encontro Music Mundial en $newsRoot" -ForegroundColor Red
  exit 1
}

if (Test-PortListening -Port $frontendPort) {
  Write-Host "Liberando puerto ${frontendPort}..." -ForegroundColor Yellow
  Stop-ListenPort -Port $frontendPort
  Start-Sleep -Seconds 1
}

if (Test-PortListening -Port 5173) {
  Stop-ListenPort -Port 5173
}

Write-Host "4/4  Iniciando frontend (http://localhost:${frontendPort})..." -ForegroundColor Cyan
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
Write-Host "  Landing: http://localhost:${frontendPort}/" -ForegroundColor Green
Write-Host "  Votar:   http://localhost:${frontendPort}/vote/" -ForegroundColor Green
Write-Host "  API:     http://localhost:${apiPort}/api/health" -ForegroundColor Green
Write-Host "  Worker:  bots + vote-sync" -ForegroundColor Green
Write-Host "  DB:      produccion 161 via tunel SSH (5432->nmm-postgres, 6379->nmm-redis)" -ForegroundColor Yellow
Write-Host ""
Write-Host "No cierres las ventanas del tunel SSH, la API, el worker ni el frontend." -ForegroundColor DarkGray
