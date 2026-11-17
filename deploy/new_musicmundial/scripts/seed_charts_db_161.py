#!/usr/bin/env python3
"""Seed Charts into Nest/Prisma Postgres on host 161 and wire the bot ingest."""

from __future__ import annotations

import os
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
REMOTE_ROOT = "/www/wwwroot/new_musicmundial"
REMOTE_BOT = f"{REMOTE_ROOT}/charts-bot"
REMOTE_HTML_CHARTS = f"{REMOTE_ROOT}/html/charts"


def load_password() -> str:
    password = os.environ.get("NMM_SSH_PASSWORD", "").strip()
    if password:
        return password
    env_file = Path(__file__).resolve().parents[1] / ".env.contabo"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("NMM_SSH_PASSWORD="):
                return line.split("=", 1)[1].strip().strip("'").strip('"')
    raise SystemExit("Define NMM_SSH_PASSWORD")


def main() -> None:
    password = load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )

    # Ensure remote bot dir exists, then upload seed/publish scripts.
    client.exec_command(f"mkdir -p {REMOTE_BOT}/data {REMOTE_HTML_CHARTS}/spotify")
    sftp = client.open_sftp()
    for name in ("seed-db-from-json.cjs", "publish-to-site.cjs", "update-once.cjs", "scrape-site.cjs", "kworb.cjs"):
        local = REPO / "scripts" / "charts-bot" / name
        if local.exists():
            sftp.put(str(local), f"{REMOTE_BOT}/{name}")
    sftp.close()

    cmd = f"""
set -euo pipefail
NODE_BIN="$(command -v node || echo /usr/local/bin/node)"
test -x "$NODE_BIN"
mkdir -p {REMOTE_BOT}/data {REMOTE_HTML_CHARTS}/spotify

python3 - <<'PY'
from pathlib import Path
import secrets
env = Path("{REMOTE_ROOT}/.env")
text = env.read_text(encoding="utf-8", errors="replace")
if "CHARTS_INGEST_SECRET=" not in text:
    secret = secrets.token_hex(24)
    with env.open("a", encoding="utf-8") as fh:
        fh.write("\\nCHARTS_INGEST_SECRET=" + secret + "\\n")
    print("added CHARTS_INGEST_SECRET")
else:
    print("CHARTS_INGEST_SECRET already set")
PY

cd {REMOTE_ROOT}
docker compose up -d --force-recreate api worker
sleep 14

python3 - <<'PY'
from pathlib import Path
import shutil
env = Path("{REMOTE_ROOT}/.env")
secret = ""
for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
    if line.startswith("CHARTS_INGEST_SECRET="):
        secret = line.split("=", 1)[1].strip().strip("'").strip('"')
        break
if not secret:
    raise SystemExit("missing CHARTS_INGEST_SECRET")
node = shutil.which("node") or "/usr/local/bin/node"
run = Path("{REMOTE_BOT}/run.sh")
content = (
    "#!/bin/bash\\n"
    "set -euo pipefail\\n"
    "export PATH=/usr/local/bin:$PATH\\n"
    "export CHARTS_DATA_DIR={REMOTE_BOT}/data\\n"
    "export CHARTS_OUT={REMOTE_HTML_CHARTS}\\n"
    "export CHARTS_TOP=40\\n"
    "export KW_DELAY=200\\n"
    "export CHARTS_API_URL=http://127.0.0.1:8088/api\\n"
    "export CHARTS_INGEST_SECRET=" + secret + "\\n"
    "cd {REMOTE_BOT}\\n"
    "exec " + node + " update-once.cjs >> {REMOTE_BOT}/bot.log 2>&1\\n"
)
run.write_text(content, encoding="utf-8")
run.chmod(0o755)
print("run.sh ready")
PY

tmp=$(mktemp)
crontab -l 2>/dev/null | grep -v 'nmm-charts-bot' > "$tmp" || true
echo "*/30 * * * * {REMOTE_BOT}/run.sh # nmm-charts-bot" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "cron ok"

echo "--- wait api ---"
for i in $(seq 1 40); do
  code=$(curl -sS -o /dev/null -w '%{{http_code}}' http://127.0.0.1:8088/api/health || true)
  if [ "$code" = "200" ]; then echo "health:$code"; break; fi
  sleep 2
done

SECRET="$(python3 - <<'PY'
from pathlib import Path
for line in Path("{REMOTE_ROOT}/.env").read_text(encoding="utf-8", errors="replace").splitlines():
    if line.startswith("CHARTS_INGEST_SECRET="):
        print(line.split("=", 1)[1].strip().strip("'").strip('"'))
        break
PY
)"
export CHARTS_OUT={REMOTE_HTML_CHARTS}
export CHARTS_API_URL=http://127.0.0.1:8088/api
export CHARTS_INGEST_SECRET="$SECRET"

echo "--- seed DB from JSON ---"
"$NODE_BIN" {REMOTE_BOT}/seed-db-from-json.cjs

echo "--- verify API ---"
curl -sS -o /tmp/charts-api.json -w 'api:%{{http_code}}\\n' http://127.0.0.1:8088/api/charts/data
python3 - <<'PY'
import json
d=json.load(open("/tmp/charts-api.json"))
print("daily tracks", len((d.get("daily") or {{}}).get("tracks") or []))
print("radio tracks", len((d.get("radio") or {{}}).get("tracks") or []))
print("daily date", (d.get("daily") or {{}}).get("date"))
print("keys", sorted(d.keys()))
PY
"""

    _stdin, stdout, stderr = client.exec_command(cmd, timeout=480)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    print(out)
    if err.strip():
        print("STDERR", err[-5000:])
    if code != 0:
        raise SystemExit(code)
    print("Charts DB seed complete (Nest/Prisma).")


if __name__ == "__main__":
    main()
