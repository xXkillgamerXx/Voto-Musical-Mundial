#!/usr/bin/env python3
"""Upload news+vote static html to 161. Does not rebuild Docker or touch 213."""

from __future__ import annotations

import os
import shutil
import tarfile
from pathlib import Path

import paramiko

REPO = Path(__file__).resolve().parents[3]
DEPLOY = Path(__file__).resolve().parents[1]
REMOTE = "/www/wwwroot/new_musicmundial"


def stage_html() -> Path:
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
    tar_path = DEPLOY / "nmm-html.tgz"
    if tar_path.exists():
        tar_path.unlink()
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(html, arcname="html")
    print(f"tar {tar_path.stat().st_size / 1_048_576:.1f} MB", flush=True)
    return tar_path


def main() -> None:
    tar_path = stage_html()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=os.environ["NMM_SSH_PASSWORD"],
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    sftp.put(str(tar_path), "/tmp/nmm-html.tgz")
    sftp.close()
    cmd = f"""
set -e
tar -xzf /tmp/nmm-html.tgz -C {REMOTE}
rm -f /tmp/nmm-html.tgz
find {REMOTE}/html -type d -exec chmod 755 {{}} +
find {REMOTE}/html -type f -exec chmod 644 {{}} +
curl -sS -o /dev/null -w 'vote:%{{http_code}}\\n' https://www.musicmundial.com/vote/
curl -sS -o /dev/null -w 'home:%{{http_code}}\\n' https://www.musicmundial.com/
curl -sS -o /dev/null -w 'health:%{{http_code}}\\n' http://127.0.0.1:8088/api/health
"""
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", "replace").encode("ascii", "replace").decode("ascii"))
    err = stderr.read().decode("utf-8", "replace").encode("ascii", "replace").decode("ascii")
    if err.strip():
        print("STDERR", err[:2000])
    code = stdout.channel.recv_exit_status()
    client.close()
    raise SystemExit(code)


if __name__ == "__main__":
    main()
