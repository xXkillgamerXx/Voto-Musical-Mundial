#!/usr/bin/env python3
"""Deploy new_musicmundial Docker to 161.97.154.152. Does not touch vmm-* vote containers."""

from __future__ import annotations

import os
import secrets
import shutil
import tarfile
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
DEPLOY = Path(__file__).resolve().parents[1]
HOST = "161.97.154.152"
PORT = 2981
USER = "root"
REMOTE = "/www/wwwroot/new_musicmundial"
PUBLIC_PORT = "8088"


def secret(n: int = 48) -> str:
    return secrets.token_urlsafe(n)[:n]


def write_env(path: Path) -> None:
    pg = secrets.token_urlsafe(24)
    origin = f"http://{HOST}:{PUBLIC_PORT}"
    path.write_text(
        "\n".join(
            [
                "NODE_ENV=production",
                "PORT=4000",
                f"APP_ORIGIN={origin}",
                f"MISSION_VISIT_ORIGINS={origin}",
                "GOOGLE_CLIENT_ID=927668152816-gko08hdb5upa01a3psav544t0gf9m1a4.apps.googleusercontent.com",
                "TURNSTILE_ENABLED=false",
                "POSTGRES_DB=nmm_vote",
                "POSTGRES_USER=nmm_vote",
                f"POSTGRES_PASSWORD={pg}",
                f"DATABASE_URL=postgresql://nmm_vote:{pg}@postgres:5432/nmm_vote",
                "REDIS_URL=redis://redis:6379",
                f"JWT_ACCESS_SECRET={secret()}",
                f"JWT_REFRESH_SECRET={secret()}",
                f"JWT_ANONYMOUS_SECRET={secret()}",
                f"IP_HASH_SALT={secret(32)}",
                "JWT_ACCESS_EXPIRES_IN=15m",
                "JWT_REFRESH_EXPIRES_IN=30d",
                "JWT_ANONYMOUS_EXPIRES_IN=365d",
                "NEWS_MYSQL_HOST=172.17.0.1",
                "NEWS_MYSQL_PORT=3309",
                "NEWS_MYSQL_USER_ES=mega",
                "NEWS_MYSQL_PASSWORD_ES=efwEA2d3xEwbDJ4h",
                "NEWS_MYSQL_DATABASE_ES=mega",
                "NEWS_MYSQL_PREFIX_ES=wpgn_",
                "NEWS_MYSQL_USER_EN=ingles",
                "NEWS_MYSQL_PASSWORD_EN=3MnBxPMad6YmSMDr",
                "NEWS_MYSQL_DATABASE_EN=ingles",
                "NEWS_MYSQL_PREFIX_EN=pohyn_",
                "",
            ]
        ),
        encoding="utf-8",
    )


def ignore_backend(_dir: str, names: list[str]) -> list[str]:
    skip = {"node_modules", "dist", ".env", ".git", "coverage", "tmp"}
    return [n for n in names if n in skip or n.endswith(".log") or n.startswith("tmp-")]


def stage() -> Path:
    html_src = REPO / "dist-news"
    vote_src = REPO / "dist"
    if not html_src.exists() or not (vote_src / "index.html").exists():
        raise SystemExit("Faltan dist-news o dist")

    html = DEPLOY / "html"
    if html.exists():
        shutil.rmtree(html)
    shutil.copytree(html_src, html)
    public = REPO / "news" / "public"
    if public.exists():
        shutil.copytree(public, html, dirs_exist_ok=True)
    shutil.copytree(vote_src, html / "vote")

    backend = DEPLOY / "backend"
    if backend.exists():
        shutil.rmtree(backend)
    shutil.copytree(REPO / "backend", backend, ignore=ignore_backend)
    (backend / ".dockerignore").write_text("node_modules\ndist\n.env\n*.log\ntmp-*\n", encoding="utf-8")
    dockerfile = backend / "Dockerfile"
    text = dockerfile.read_text(encoding="utf-8")
    if "openssl" not in text:
        dockerfile.write_text(
            text.replace(
                "FROM node:22-alpine AS deps\nWORKDIR /app\n",
                "FROM node:22-alpine AS deps\nRUN apk add --no-cache openssl libc6-compat\nWORKDIR /app\n",
            ).replace(
                "FROM node:22-alpine AS runtime\nWORKDIR /app\n",
                "FROM node:22-alpine AS runtime\nRUN apk add --no-cache openssl libc6-compat\nWORKDIR /app\n",
            ),
            encoding="utf-8",
        )

    (DEPLOY / "uploads").mkdir(exist_ok=True)
    return DEPLOY


def make_tar(src: Path) -> Path:
    tar_path = src / "new_musicmundial.tgz"
    if tar_path.exists():
        tar_path.unlink()
    include = [
        "docker-compose.yml",
        "nginx",
        "html",
        "backend",
    ]
    with tarfile.open(tar_path, "w:gz") as tar:
        for name in include:
            path = src / name
            if path.exists():
                tar.add(path, arcname=name)
    print(f"tar {tar_path.stat().st_size / 1_048_576:.1f} MB", flush=True)
    return tar_path


def ssh_stream(client: paramiko.SSHClient, command: str) -> int:
    transport = client.get_transport()
    assert transport is not None
    transport.set_keepalive(30)
    chan = transport.open_session()
    chan.get_pty()
    chan.exec_command(command)
    while True:
        if chan.recv_ready():
            print(chan.recv(8192).decode("utf-8", "replace").encode("ascii", "replace").decode("ascii"), end="", flush=True)
        if chan.recv_stderr_ready():
            print(chan.recv_stderr(8192).decode("utf-8", "replace").encode("ascii", "replace").decode("ascii"), end="", flush=True)
        if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
            break
    return chan.recv_exit_status()


def main() -> None:
    password = os.environ.get("NMM_SSH_PASSWORD")
    if not password:
        raise SystemExit("Define NMM_SSH_PASSWORD")
    stage()
    tar_path = make_tar(DEPLOY)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        port=PORT,
        username=USER,
        password=password,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=20,
    )
    sftp = client.open_sftp()
    print("upload tar...", flush=True)
    sftp.put(str(tar_path), "/tmp/new_musicmundial.tgz")
    sftp.close()

    remote = f"""
set -euo pipefail
mkdir -p {REMOTE}
if [ -f {REMOTE}/.env ]; then
  cp {REMOTE}/.env /tmp/nmm.env.bak
fi
if [ -d {REMOTE}/uploads ]; then
  mv {REMOTE}/uploads /tmp/nmm.uploads.bak
fi
tar -xzf /tmp/new_musicmundial.tgz -C {REMOTE}
rm -f /tmp/new_musicmundial.tgz
if [ -f /tmp/nmm.env.bak ]; then
  mv /tmp/nmm.env.bak {REMOTE}/.env
fi
if [ -d /tmp/nmm.uploads.bak ]; then
  rm -rf {REMOTE}/uploads
  mv /tmp/nmm.uploads.bak {REMOTE}/uploads
fi
if [ ! -f {REMOTE}/.env ]; then
  echo 'Falta {REMOTE}/.env' >&2
  exit 1
fi
if ! grep -q '^GOOGLE_CLIENT_ID=' {REMOTE}/.env; then
  echo 'GOOGLE_CLIENT_ID=927668152816-gko08hdb5upa01a3psav544t0gf9m1a4.apps.googleusercontent.com' >> {REMOTE}/.env
fi
if grep -q '^PUBLIC_NEWS_ORIGIN=' {REMOTE}/.env; then
  sed -i 's|^PUBLIC_NEWS_ORIGIN=.*|PUBLIC_NEWS_ORIGIN=https://www.musicmundial.com|' {REMOTE}/.env
else
  echo 'PUBLIC_NEWS_ORIGIN=https://www.musicmundial.com' >> {REMOTE}/.env
fi
find {REMOTE}/html -type d -exec chmod 755 {{}} +
find {REMOTE}/html -type f -exec chmod 644 {{}} +
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port={PUBLIC_PORT}/tcp || true
  firewall-cmd --reload || true
fi
iptables -C INPUT -p tcp --dport {PUBLIC_PORT} -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport {PUBLIC_PORT} -j ACCEPT || true
cd {REMOTE}
# Never touch vmm-* / vote.musicmundial.com
docker compose -p new_musicmundial up -d --build
sleep 5
docker compose -p new_musicmundial restart nginx || true
sleep 2
docker compose -p new_musicmundial ps
echo '--- health ---'
curl -sS -o /tmp/nmm-health.txt -w 'health:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/api/health || true
cat /tmp/nmm-health.txt; echo
curl -sS -o /tmp/nmm-news.txt -w '\\nnews:%{{http_code}}\\n' 'http://127.0.0.1:{PUBLIC_PORT}/api/news/home?locale=es' || true
head -c 220 /tmp/nmm-news.txt; echo
curl -sS -o /dev/null -w 'home:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/ || true
curl -sS -o /dev/null -w 'vote:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/vote/ || true
curl -sS -o /dev/null -w 'robots:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/robots.txt || true
curl -sS -o /dev/null -w 'sitemap:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/sitemap_index.xml || true
curl -sS -o /dev/null -w 'news-sitemap:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/news-sitemap.xml || true
curl -sS -o /dev/null -w 'es-sitemap:%{{http_code}}\\n' http://127.0.0.1:{PUBLIC_PORT}/es/sitemap_index.xml || true
echo '--- vmm still up ---'
docker ps --format '{{{{.Names}}}}' | grep -E '^(vmm-|nmm-)' || true
"""
    code = ssh_stream(client, remote)
    client.close()
    if code != 0:
        raise SystemExit(f"remote failed: {code}")
    print(f"Listo: http://{HOST}:{PUBLIC_PORT}/")


if __name__ == "__main__":
    main()
