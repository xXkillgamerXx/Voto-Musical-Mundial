#!/usr/bin/env python3
"""Upload nginx default.conf and reload nmm-nginx on 161 (account deletion URLs)."""

from __future__ import annotations

import os
from pathlib import Path

import paramiko

DEPLOY = Path(__file__).resolve().parents[1]
CONF = DEPLOY / "nginx" / "default.conf"
REMOTE_CONF = "/www/wwwroot/new_musicmundial/nginx/default.conf"


def main() -> None:
    if not CONF.exists():
        raise SystemExit(f"Missing {CONF}")
    password = os.environ.get("NMM_SSH_PASSWORD")
    if not password:
        raise SystemExit("Define NMM_SSH_PASSWORD")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=password,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    sftp.put(str(CONF), REMOTE_CONF)
    sftp.close()

    cmd = r"""
set -e
cd /www/wwwroot/new_musicmundial
# Prefer compose copy into the running nginx container volume/bind.
if [ -f docker-compose.yml ]; then
  docker compose cp nginx/default.conf nginx:/etc/nginx/conf.d/default.conf 2>/dev/null || true
fi
docker exec nmm-nginx nginx -t
docker exec nmm-nginx nginx -s reload
curl -sS -o /dev/null -w 'slash:%{http_code}\n' http://127.0.0.1:8088/eliminar-cuenta/
curl -sS -o /dev/null -w 'file:%{http_code}\n' http://127.0.0.1:8088/eliminar-cuenta/index.html
curl -sS -o /dev/null -w 'en:%{http_code}\n' http://127.0.0.1:8088/delete-account/
curl -sS -o /dev/null -w 'www:%{http_code}\n' https://www.musicmundial.com/eliminar-cuenta/
curl -sS -o /dev/null -w 'api:%{http_code}\n' http://127.0.0.1:8088/api/health
"""
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    print(out)
    if err.strip():
        print("STDERR", err[:2000])
    raise SystemExit(code)


if __name__ == "__main__":
    main()
