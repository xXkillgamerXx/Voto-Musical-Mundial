# Levanta el entorno local (sin Docker) contra la base de datos de PRODUCCION.
# Abre 3 ventanas: tunel SSH, API (NestJS) y frontend (Vite).
#
# Uso:  npm run dev:local   (o)   powershell -ExecutionPolicy Bypass -File .\dev-local.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$key = "$env:USERPROFILE\.ssh\vmm_server"

if (-not (Test-Path $key)) {
  Write-Host "No se encontro la llave SSH en $key" -ForegroundColor Red
  Write-Host "Genera la llave o ajusta la ruta en dev-local.ps1" -ForegroundColor Yellow
  exit 1
}

Write-Host "1/3  Abriendo tunel SSH (PostgreSQL 5432 + Redis 6379)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "ssh -N -L 127.0.0.1:5432:127.0.0.1:5432 -L 127.0.0.1:6379:127.0.0.1:6379 -p 2981 -i `"$key`" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 root@213.136.69.57"
)

Start-Sleep -Seconds 3

Write-Host "2/3  Iniciando API local (http://localhost:4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd `"$root\backend`"; npm run start:dev"
)

Start-Sleep -Seconds 2

Write-Host "3/3  Iniciando frontend (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd `"$root`"; npm run dev"
)

Write-Host ""
Write-Host "Entorno local listo. Abre: http://localhost:5173" -ForegroundColor Green
Write-Host "OJO: usa la base de datos REAL de produccion." -ForegroundColor Yellow
Write-Host "Para apagar todo, cierra las 3 ventanas que se abrieron." -ForegroundColor DarkGray
