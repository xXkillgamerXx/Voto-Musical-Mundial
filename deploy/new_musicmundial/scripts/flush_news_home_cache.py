#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path

import paramiko


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
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "161.97.154.152",
        port=2981,
        username="root",
        password=password(),
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    cmd = (
        "docker exec nmm-redis redis-cli DEL cache:news:home:es cache:news:home:en; "
        "docker exec nmm-redis redis-cli KEYS 'cache:news:home:*'"
    )
    _i, out, err = client.exec_command(cmd, timeout=30)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace").strip()
    if e:
        print(e)
    client.close()


if __name__ == "__main__":
    main()
