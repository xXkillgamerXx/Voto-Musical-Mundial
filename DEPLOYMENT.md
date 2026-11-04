# Production Deploy Notes

## Server (primary: 161)

- Host: `161.97.154.152`
- SSH port: `2981`
- SSH user: `root`
- Auth: `NMM_SSH_PASSWORD` (password; the old `vmm_server` key is for the retired 213 host)
- Public news URL: `https://www.musicmundial.com/`
- Public vote URL: `https://www.musicmundial.com/vote/`
- API: `https://www.musicmundial.com/api` (Flutter may still use `https://vote.musicmundial.com/api` if DNS/proxy points here)
- Site root: `/www/wwwroot/new_musicmundial`
- HTML root: `/www/wwwroot/new_musicmundial/html`
- Backend: Docker project `new_musicmundial` in that same folder

## Runtime

| Layer | How it runs |
| --- | --- |
| Frontend | Static builds: news in `html/`, vote in `html/vote/` |
| Backend API | Docker `nmm-api` |
| Background jobs | Docker `nmm-worker` |
| Redis | Docker `nmm-redis` |
| PostgreSQL | Docker `nmm-postgres` (or host DB if configured in server `.env`) |
| News MySQL | Host MySQL via `nmm-mysql-proxy` |
| Uploads | `/www/wwwroot/new_musicmundial/uploads` |

Do **not** deploy backend with `npm start` on the host. Always rebuild/restart the Docker stack on 161.

## Quick deploy

From repo root:

```powershell
$env:NMM_SSH_PASSWORD = '...'
powershell -ExecutionPolicy Bypass -File .\deploy-prod.ps1
```

Optional flags:

- `-FrontendOnly` — only upload `dist-news` + `dist` HTML
- `-BackendOnly` — skip rebuild if HTML already built; still runs full 161 stack deploy script

Scripts:

- Full stack: `py -3 deploy\new_musicmundial\scripts\deploy_contabo.py`
- HTML only: `py -3 deploy\new_musicmundial\scripts\upload_html_161.py`

## Frontend build values

```powershell
$env:VITE_API_BASE_URL='/vote/api'
$env:VITE_FIREBASE_VAPID_KEY='BNQEx4dNvUVEV_CJ1qV64yzOA3xXPB2Y30EN_m4RLTf22tbVe_E1lkV-jNK7lbh4pbTxN2aOAN5mLPUMdYcRZuc'
$env:VITE_TURNSTILE_SITE_KEY='0x4AAAAAADscx-A_CXbgnFea'
npm run build
npx vite build --config news/vite.config.js
```

## After upload

```bash
find /www/wwwroot/new_musicmundial/html -type d -exec chmod 755 {} +
find /www/wwwroot/new_musicmundial/html -type f -exec chmod 644 {} +
```

## Verification

```bash
curl -I https://www.musicmundial.com/
curl -I https://www.musicmundial.com/vote/
curl https://www.musicmundial.com/api/health
```

On the server:

```bash
docker compose -p new_musicmundial ps
curl http://127.0.0.1:8088/api/health
```

Expected containers include `nmm-api`, `nmm-worker`, `nmm-redis`.
