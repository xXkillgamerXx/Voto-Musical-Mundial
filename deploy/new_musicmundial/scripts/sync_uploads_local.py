#!/usr/bin/env python3
"""Pull production poll/admin uploads into backend/uploads for local npm run dev."""

from __future__ import annotations

import os
import tarfile
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
LOCAL_UPLOADS = REPO / "backend" / "uploads"
REMOTE = "/www/wwwroot/new_musicmundial"
REMOTE_TGZ = "/tmp/nmm-uploads-poll.tgz"
# Keep it focused: poll banners + artist media commonly needed on /vote/
REMOTE_PATHS = [
    f"{REMOTE}/uploads/admin/poll-banner",
    f"{REMOTE}/uploads/admin/artist-banner",
    f"{REMOTE}/uploads/admin/artist-profile",
]


def load_password() -> str:
    pw = os.environ.get("NMM_SSH_PASSWORD", "").strip()
    if pw:
        return pw
    env = REPO / "deploy" / "new_musicmundial" / ".env.contabo"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("NMM_SSH_PASSWORD="):
                return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("Missing NMM_SSH_PASSWORD")


def main() -> None:
    LOCAL_UPLOADS.mkdir(parents=True, exist_ok=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=load_password(),
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )

    # Diagnose first
    check = " ; ".join(
        [
            f'echo "=== {path} ==="; ls -la "{path}" 2>&1 | head -8; find "{path}" -type f 2>/dev/null | wc -l'
            for path in REMOTE_PATHS
        ]
        + [
            "echo === other upload roots ===",
            "ls -d /www/wwwroot/*/uploads/admin/poll-banner 2>/dev/null || true",
            "docker exec nmm-api sh -c 'ls /app/uploads/admin/poll-banner 2>&1 | head -5; find /app/uploads/admin/poll-banner -type f 2>/dev/null | wc -l'",
            "docker exec vmm-api sh -c 'ls /app/uploads/admin/poll-banner 2>&1 | head -5; find /app/uploads/admin/poll-banner -type f 2>/dev/null | wc -l' || true",
        ]
    )
    _i, out, err = client.exec_command(check, timeout=90)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace").strip()
    if e:
        print(e)

    pack = f"""
set -e
rm -f {REMOTE_TGZ}
# Prefer nmm volume; fall back to any poll-banner tree under /www/wwwroot
SRC=""
if [ -d {REMOTE}/uploads/admin/poll-banner ] && [ "$(find {REMOTE}/uploads/admin/poll-banner -type f 2>/dev/null | head -1)" ]; then
  SRC="{REMOTE}/uploads"
elif docker exec nmm-api sh -c 'test -d /app/uploads/admin/poll-banner && find /app/uploads/admin/poll-banner -type f | head -1' >/dev/null 2>&1; then
  docker cp nmm-api:/app/uploads /tmp/nmm-uploads-from-api
  SRC="/tmp/nmm-uploads-from-api"
else
  CAND=$(ls -d /www/wwwroot/*/uploads 2>/dev/null | head -1 || true)
  if [ -n "$CAND" ] && [ -d "$CAND/admin/poll-banner" ]; then
    SRC="$CAND"
  fi
fi
if [ -z "$SRC" ]; then
  echo "NO_UPLOADS_FOUND"
  exit 2
fi
echo "SRC=$SRC"
cd "$SRC"
tar -czf {REMOTE_TGZ} admin/poll-banner admin/artist-banner admin/artist-profile 2>/dev/null || tar -czf {REMOTE_TGZ} admin/poll-banner
ls -lh {REMOTE_TGZ}
"""
    _i, out, err = client.exec_command(pack, timeout=180)
    pack_out = out.read().decode("utf-8", "replace")
    pack_err = err.read().decode("utf-8", "replace")
    print(pack_out)
    if pack_err.strip():
        print(pack_err)
    if "NO_UPLOADS_FOUND" in pack_out:
        client.close()
        raise SystemExit("No poll-banner uploads found on 161")

    local_tgz = REPO / "deploy" / "new_musicmundial" / "nmm-uploads-poll.tgz"
    if local_tgz.exists():
        local_tgz.unlink()
    sftp = client.open_sftp()
    sftp.get(REMOTE_TGZ, str(local_tgz))
    sftp.close()
    client.exec_command(f"rm -f {REMOTE_TGZ}", timeout=30)
    client.close()

    with tarfile.open(local_tgz, "r:gz") as tar:
        tar.extractall(LOCAL_UPLOADS)
    print(f"extracted -> {LOCAL_UPLOADS}")
    banners = LOCAL_UPLOADS / "admin" / "poll-banner"
    count = len(list(banners.glob("*"))) if banners.exists() else 0
    print(f"poll-banner files: {count}")
    local_tgz.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
