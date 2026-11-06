#!/usr/bin/env bash
# Levanta el entorno local completo contra la base de datos de PRODUCCION.
# 1) Tunel SSH  2) API NestJS  3) Worker  4) Frontend Vite en http://localhost:5173
#
# Uso:  npm run dev:prod

set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
ssh_host="161.97.154.152"
ssh_port="2981"
ssh_user="root"
frontend_port=5174
api_port=4000
tunnel_pid=""
api_pid=""
worker_pid=""
tunnel_script="$root/deploy/new_musicmundial/scripts/ssh_tunnel_prod.py"
env_contabo="$root/deploy/new_musicmundial/.env.contabo"

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
gray() { printf '\033[90m%s\033[0m\n' "$*"; }

port_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

stop_listen_port() {
  local pids
  pids="$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi
}

wait_port() {
  local port="$1"
  local timeout="${2:-45}"
  local i=0
  while [ "$i" -lt "$timeout" ]; do
    if port_listening "$port"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

wait_api_health() {
  local timeout="${1:-90}"
  local i=0
  while [ "$i" -lt "$timeout" ]; do
    if curl -sf "http://127.0.0.1:${api_port}/api/health" 2>/dev/null | grep -q '"ok":true'; then
      return 0
    fi
    sleep 2
    i=$((i + 2))
  done
  return 1
}

cleanup() {
  trap - EXIT INT TERM
  gray "Cerrando tunel, API y worker..."
  if [ -n "$api_pid" ]; then kill "$api_pid" 2>/dev/null || true; fi
  if [ -n "$worker_pid" ]; then kill "$worker_pid" 2>/dev/null || true; fi
  if [ -n "$tunnel_pid" ]; then kill "$tunnel_pid" 2>/dev/null || true; fi
}

trap cleanup EXIT INT TERM

if [ ! -f "$root/backend/.env" ]; then
  red "Falta backend/.env"
  gray "Copia backend/.env.example a backend/.env y ajusta los secretos de produccion."
  exit 1
fi

if [ -z "${NMM_SSH_PASSWORD:-}" ] && [ -f "$env_contabo" ]; then
  NMM_SSH_PASSWORD="$(grep -E '^\s*NMM_SSH_PASSWORD\s*=' "$env_contabo" | tail -n1 | cut -d= -f2- | tr -d "\"'" | xargs || true)"
  export NMM_SSH_PASSWORD
fi

if [ -z "${NMM_SSH_PASSWORD:-}" ]; then
  red "Define NMM_SSH_PASSWORD (root @ ${ssh_host}) o agregalo en deploy/new_musicmundial/.env.contabo"
  exit 1
fi

if [ ! -f "$tunnel_script" ]; then
  red "No se encontro el script de tunel: $tunnel_script"
  exit 1
fi

if [ ! -d "$root/backend/node_modules" ]; then
  cyan "Instalando dependencias del backend..."
  (cd "$root/backend" && npm install)
fi

cyan "=== Entorno local (DB produccion via tunel SSH @ ${ssh_host}) ==="

if ! port_listening 5432 || ! port_listening 6379; then
  cyan "1/4  Abriendo tunel SSH (PostgreSQL 5432 -> 5433 + Redis nmm-redis)..."
  py -3 "$tunnel_script" &
  tunnel_pid=$!

  if ! wait_port 5432 || ! wait_port 6379; then
    red "No se pudo abrir el tunel SSH a produccion (${ssh_user}@${ssh_host}:${ssh_port})."
    exit 1
  fi
else
  green "1/4  Tunel SSH ya activo (5432/6379)."
fi

if ! port_listening "$api_port"; then
  cyan "2/4  Iniciando API local (http://localhost:${api_port})..."
  (cd "$root/backend" && npm run start:dev) &
  api_pid=$!

  if ! wait_port "$api_port"; then
    red "La API no arranco en el puerto ${api_port}."
    exit 1
  fi

  if ! wait_api_health; then
    red "La API no responde en /api/health. Revisa backend/.env y el tunel."
    exit 1
  fi
else
  green "2/4  API ya activa en http://localhost:${api_port}."
  if ! wait_api_health 10; then
    red "La API en ${api_port} no responde ok en /api/health."
    exit 1
  fi
fi

if pgrep -f 'workers/main|start:worker' >/dev/null 2>&1; then
  green "3/4  Worker ya activo."
else
  cyan "3/4  Iniciando worker (bots + sync de votos)..."
  (cd "$root/backend" && npm run start:worker:dev) &
  worker_pid=$!
  sleep 2
fi

if port_listening "$frontend_port"; then
  yellow "Liberando puerto ${frontend_port}..."
  stop_listen_port "$frontend_port"
  sleep 1
fi

stop_listen_port 5174

cyan "4/4  Iniciando frontend (http://localhost:${frontend_port})..."
echo
green "Listo:"
green "  Web:  http://localhost:${frontend_port}"
green "  API:  http://localhost:${api_port}/api/health"
green "  Worker: bots + vote-sync"
yellow "  DB:   produccion 161 via tunel SSH (5432->nmm-postgres, 6379->nmm-redis)"
echo
gray "Ctrl+C cierra el frontend, la API, el worker y el tunel."
echo

cd "$root"
npm run dev
