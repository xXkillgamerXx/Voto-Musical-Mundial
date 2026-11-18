#!/usr/bin/env python3
"""Upload maintenance.html and wire Apache ErrorDocument on host 161 (read/write Apache only)."""

from __future__ import annotations

import os
import textwrap
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
REMOTE_HTML = "/www/wwwroot/new_musicmundial/html"
LOCAL_PAGE = REPO / "news" / "public" / "maintenance.html"
INCLUDE = "/www/server/panel/vhost/apache/extension/www.musicmundial.com/maintenance.conf"


def password() -> str:
    pw = os.environ.get("NMM_SSH_PASSWORD", "").strip()
    if pw:
        return pw
    env = Path(__file__).resolve().parents[1] / ".env.contabo"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("NMM_SSH_PASSWORD="):
            return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("Missing NMM_SSH_PASSWORD")


def main() -> None:
    if not LOCAL_PAGE.exists():
        raise SystemExit(f"Missing {LOCAL_PAGE}")

    conf = textwrap.dedent(
        """\
        # Music Mundial — friendly page while upstream restarts
        ProxyErrorOverride On
        ProxyPass /maintenance.html !
        ProxyPassReverse /maintenance.html !
        ErrorDocument 500 /maintenance.html
        ErrorDocument 502 /maintenance.html
        ErrorDocument 503 /maintenance.html
        ErrorDocument 504 /maintenance.html
        """
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=password(),
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    try:
        sftp.put(str(LOCAL_PAGE), f"{REMOTE_HTML}/maintenance.html")
    finally:
        sftp.close()

    remote = f"""
set -e
EXT_DIR="/www/server/panel/vhost/apache/extension/www.musicmundial.com"
mkdir -p "$EXT_DIR" 2>/dev/null || mkdir -p /www/server/panel/vhost/apache/extension/musicmundial.com || true
TARGET="{INCLUDE}"
if [ ! -d "$(dirname "$TARGET")" ]; then
  TARGET="/www/server/panel/vhost/apache/musicmundial-maintenance.conf"
fi
cat > "$TARGET" <<'EOF'
{conf}
EOF
# Ensure the main Apache vhost includes our snippet (aaPanel usually auto-includes extension/).
for VHOST in \\
  /www/server/panel/vhost/apache/www.musicmundial.com.conf \\
  /www/server/panel/vhost/apache/musicmundial.com.conf \\
  /www/server/panel/vhost/apache/0.musicmundial.com.conf
do
  if [ -f "$VHOST" ] && ! grep -q 'musicmundial-maintenance\\|ErrorDocument 503 /maintenance.html' "$VHOST"; then
    if [ "$TARGET" = "/www/server/panel/vhost/apache/musicmundial-maintenance.conf" ]; then
      echo "" >> "$VHOST"
      echo "IncludeOptional $TARGET" >> "$VHOST"
    fi
  fi
done
chmod 644 '{REMOTE_HTML}/maintenance.html' 2>/dev/null || true
if command -v /etc/init.d/httpd >/dev/null 2>&1; then
  /etc/init.d/httpd reload || true
elif command -v systemctl >/dev/null 2>&1; then
  systemctl reload httpd 2>/dev/null || systemctl reload apache2 2>/dev/null || true
fi
echo "CONF=$TARGET"
ls -la '{REMOTE_HTML}/maintenance.html'
# Docker nginx may not have the file until next image/html sync; Apache docroot is what matters for 502.
curl -sS -o /dev/null -w 'apache-docroot-ok\\n' -f 'file:{REMOTE_HTML}/maintenance.html' 2>/dev/null || true
echo OK_PAGE
"""
    _i, out, err = client.exec_command(remote, timeout=60)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace").strip()
    if e:
        print(e)
    client.close()


if __name__ == "__main__":
    main()
