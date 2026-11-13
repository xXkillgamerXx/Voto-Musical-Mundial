#!/usr/bin/env python3
"""Install automatic Charts bot on host 161 (scrape + publish into html/charts)."""

from __future__ import annotations

import os
import tarfile
import tempfile
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
BOT_SRC = REPO / "scripts" / "charts-bot"
REMOTE_ROOT = "/www/wwwroot/new_musicmundial"
REMOTE_BOT = f"{REMOTE_ROOT}/charts-bot"
REMOTE_HTML_CHARTS = f"{REMOTE_ROOT}/html/charts"
CRON_MARKER = "nmm-charts-bot"


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


def stage_tar() -> Path:
    needed = [
        "kworb.cjs",
        "scrape-site.cjs",
        "publish-to-site.cjs",
        "update-once.cjs",
        "allaccess.cjs",
    ]
    for name in needed:
        if not (BOT_SRC / name).exists():
            raise SystemExit(f"Missing {BOT_SRC / name}")
    tar_path = Path(tempfile.gettempdir()) / "nmm-charts-bot.tgz"
    with tarfile.open(tar_path, "w:gz") as tar:
        for name in needed:
            tar.add(BOT_SRC / name, arcname=f"charts-bot/{name}")
    return tar_path


def main() -> None:
    password = load_password()
    tar_path = stage_tar()

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
    sftp = client.open_sftp()
    sftp.put(str(tar_path), "/tmp/nmm-charts-bot.tgz")
    sftp.close()

    every = os.environ.get("CHARTS_CRON_EVERY", "30")
    cmd = rf"""
set -e
mkdir -p {REMOTE_BOT}/data {REMOTE_HTML_CHARTS}/spotify
tar -xzf /tmp/nmm-charts-bot.tgz -C {REMOTE_ROOT}
rm -f /tmp/nmm-charts-bot.tgz
chmod 755 {REMOTE_BOT}
chmod 644 {REMOTE_BOT}/*.cjs

# Wrapper for cron
cat > {REMOTE_BOT}/run.sh <<'EOF'
#!/bin/bash
set -euo pipefail
export CHARTS_DATA_DIR={REMOTE_BOT}/data
export CHARTS_OUT={REMOTE_HTML_CHARTS}
export CHARTS_TOP=40
export KW_DELAY=200
cd {REMOTE_BOT}
/usr/bin/node update-once.cjs >> {REMOTE_BOT}/bot.log 2>&1
EOF
chmod 755 {REMOTE_BOT}/run.sh

# Seed covers/data from current site if bot data empty
if [ ! -f {REMOTE_BOT}/data/kworb/spotify/global-daily.json ] && [ -f {REMOTE_HTML_CHARTS}/data.json ]; then
  echo "seed ok (site already has charts)"
fi

# Install cron every N minutes
tmp=$(mktemp)
crontab -l 2>/dev/null | grep -v '{CRON_MARKER}' > "$tmp" || true
echo "*/{every} * * * * {REMOTE_BOT}/run.sh # {CRON_MARKER}" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"

echo "--- cron ---"
crontab -l | grep '{CRON_MARKER}' || true

echo "--- first run ---"
{REMOTE_BOT}/run.sh
echo "--- tail log ---"
tail -n 40 {REMOTE_BOT}/bot.log || true
echo "--- verify ---"
curl -sS -o /dev/null -w 'data:%{{http_code}}\n' http://127.0.0.1:8088/charts/data.json
curl -sS -o /dev/null -w 'radio:%{{http_code}}\n' http://127.0.0.1:8088/charts/radio/
python3 - <<'PY'
import json
p="{REMOTE_HTML_CHARTS}/data.json"
d=json.load(open(p))
print("daily", d["daily"].get("date"), d["daily"].get("scrapedAt"))
print("radio", d["radio"].get("source"), d["radio"].get("date"), "tracks", len(d["radio"].get("tracks") or []))
print("countries", len(json.load(open("{REMOTE_HTML_CHARTS}/spotify/countries.json")).get("packed") or []))
PY
"""
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=900)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    print(out)
    if err.strip():
        print("STDERR", err[-3000:])
    if code != 0:
        raise SystemExit(code)
    print("Charts bot installed on 161 (every", every, "min).")


if __name__ == "__main__":
    main()
