# Production Deploy Notes

## Server

- Host: `213.136.69.57`
- SSH port: `2981`
- SSH user: `root`
- SSH key: `~/.ssh/vmm_server`
- Domain: `https://vote.musicmundial.com`
- Site root: `/www/wwwroot/vote.musicmundial.com`
- Backend root: `/www/wwwroot/vote.musicmundial.com/backend`

## Runtime (important)

| Layer | How it runs |
| --- | --- |
| Frontend | Static Vue build served by **aaPanel Apache** from the site root |
| Backend API | **Docker** container `vmm-api` |
| Background jobs | **Docker** container `vmm-worker` |
| Redis | **Docker** container `vmm-redis` on `127.0.0.1:6379` |
| PostgreSQL | **aaPanel**, not Docker (`127.0.0.1:5432`, db `vote_db`) |
| Uploads | Host folder mounted into Docker: `/www/wwwroot/vote.musicmundial.com/uploads:/app/uploads` |

Do **not** deploy backend with `npm start` on the host. Always rebuild/restart the Docker stack.

## Active Docker Compose

Use this compose file on the server:

```bash
/www/wwwroot/vote.musicmundial.com/backend/docker-compose.vote-db.yml
```

Active containers:

- `vmm-api`
- `vmm-worker`
- `vmm-redis`

Do not use `vmm-postgres` for production. PostgreSQL is managed by aaPanel.

## Frontend Deploy

From local repo:

```powershell
$env:VITE_API_BASE_URL='/api'
$env:VITE_FIREBASE_VAPID_KEY='BNQEx4dNvUVEV_CJ1qV64yzOA3xXPB2Y30EN_m4RLTf22tbVe_E1lkV-jNK7lbh4pbTxN2aOAN5mLPUMdYcRZuc'
$env:VITE_TURNSTILE_SITE_KEY='0x4AAAAAADscx-A_CXbgnFea'
npm run build
Remove-Item Env:VITE_API_BASE_URL
Remove-Item Env:VITE_FIREBASE_VAPID_KEY
Remove-Item Env:VITE_TURNSTILE_SITE_KEY
```

Upload the generated `dist` contents to:

```bash
/www/wwwroot/vote.musicmundial.com
```

Preserve these server folders/files:

- `/www/wwwroot/vote.musicmundial.com/backend`
- `/www/wwwroot/vote.musicmundial.com/uploads`
- `/www/wwwroot/vote.musicmundial.com/.well-known`
- aaPanel config files such as `.user.ini`

### Fix permissions after upload (required)

`scp` as `root` can recreate `assets/` with mode `700`. Apache then returns **403** on JS/CSS and the page looks frozen.

Run on the server immediately after uploading `dist`:

```bash
chmod 755 /www/wwwroot/vote.musicmundial.com/assets
find /www/wwwroot/vote.musicmundial.com/assets -type d -exec chmod 755 {} \;
find /www/wwwroot/vote.musicmundial.com/assets -type f -exec chmod 644 {} \;
```

## Backend Deploy (Docker)

Upload backend **source** to:

```bash
/www/wwwroot/vote.musicmundial.com/backend
```

Do not upload:

- `node_modules`
- `dist`
- local `.env`

Then rebuild and restart the Docker stack on the server:

```bash
cd /www/wwwroot/vote.musicmundial.com/backend
docker compose -f docker-compose.vote-db.yml build
docker compose -f docker-compose.vote-db.yml up -d
```

The API runs inside `vmm-api`. Apache proxies `/api` to that container.

## Verification

Check web:

```bash
curl -I http://127.0.0.1 -H 'Host: vote.musicmundial.com'
```

Check a JS asset (must be `200`, not `403`):

```bash
curl -I http://127.0.0.1/assets/index-*.js -H 'Host: vote.musicmundial.com'
```

Check API:

```bash
curl http://127.0.0.1/api/health -H 'Host: vote.musicmundial.com'
```

Check Docker:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expected running containers: `vmm-api`, `vmm-worker`, `vmm-redis`.

Check uploads mount:

```bash
docker inspect vmm-api --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

Expected upload mount:

```text
/www/wwwroot/vote.musicmundial.com/uploads -> /app/uploads
```

## App Links (abrir app desde links compartidos)

Para que `https://vote.musicmundial.com/votacion/...` abra la app si está instalada:

1. Desplegar frontend (incluye `public/.well-known/`).
2. En Play Console → App signing → copiar el **SHA-256** y reemplazar `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` en `.well-known/assetlinks.json`.
3. En Apple Developer → Team ID: reemplazar `TEAMID` en `.well-known/apple-app-site-association`.
4. Verificar:
   - `https://vote.musicmundial.com/.well-known/assetlinks.json`
   - `https://vote.musicmundial.com/.well-known/apple-app-site-association`
5. Apache debe servir `apple-app-site-association` como `application/json` (sin redirect).

Scheme de respaldo (siempre funciona en builds con el intent-filter): `vmm://votacion/2026/slug`

## Quick deploy script

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-prod.ps1
```

Optional flags:

- `-FrontendOnly` — only upload `dist` and fix permissions
- `-BackendOnly` — only upload backend source and rebuild Docker
