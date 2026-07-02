# Production Deploy Notes

## Server

- Host: `213.136.69.57`
- SSH port: `2981`
- SSH user: `root`
- SSH key: `~/.ssh/vmm_server`
- Domain: `https://vote.musicmundial.com`
- Site root: `/www/wwwroot/vote.musicmundial.com`
- Backend root: `/www/wwwroot/vote.musicmundial.com/backend`

## Runtime

- Web server: aaPanel Apache
- Frontend: Vue static build served from the site root
- Backend: Docker containers
- Database: aaPanel PostgreSQL, not Docker PostgreSQL
- Database host from backend: `127.0.0.1:5432`
- Database name/user: `vote_db`
- Redis: Docker container `vmm-redis`, exposed only on `127.0.0.1:6379`
- Uploads folder: `/www/wwwroot/vote.musicmundial.com/uploads`
- API uploads mount: `/www/wwwroot/vote.musicmundial.com/uploads:/app/uploads`

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

## Backend Deploy

Upload backend source to:

```bash
/www/wwwroot/vote.musicmundial.com/backend
```

Do not upload:

- `node_modules`
- `dist`
- local `.env`

Then run on the server:

```bash
cd /www/wwwroot/vote.musicmundial.com/backend
docker compose -f docker-compose.vote-db.yml build
docker compose -f docker-compose.vote-db.yml up -d
```

## Verification

Check web:

```bash
curl -I http://127.0.0.1 -H 'Host: vote.musicmundial.com'
```

Check API:

```bash
curl http://127.0.0.1/api/health -H 'Host: vote.musicmundial.com'
```

Check Docker:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check uploads mount:

```bash
docker inspect vmm-api --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

Expected upload mount:

```text
/www/wwwroot/vote.musicmundial.com/uploads -> /app/uploads
```

