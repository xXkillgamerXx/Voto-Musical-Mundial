#!/usr/bin/env python3
"""SSH tunnel: local 5432/6379 -> production nmm-postgres / nmm-redis on host 161."""
from __future__ import annotations

import os
import select
import socket
import sys
import threading
import time
from pathlib import Path

import paramiko

HOST = "161.97.154.152"
PORT = 2981
USER = "root"
LOCAL_PG = 5432
REMOTE_PG = ("127.0.0.1", 5433)  # nmm-postgres published on host
LOCAL_REDIS = 6379


def load_password() -> str:
    password = os.environ.get("NMM_SSH_PASSWORD", "").strip()
    if password:
        return password
    env_file = Path(__file__).resolve().parents[1] / ".env.contabo"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.strip().startswith("NMM_SSH_PASSWORD="):
                return line.split("=", 1)[1].strip().strip("'").strip('"')
    raise SystemExit(
        "Define NMM_SSH_PASSWORD (root @ 161) o agregalo en deploy/new_musicmundial/.env.contabo"
    )


def redis_ip(client: paramiko.SSHClient) -> str:
    _stdin, stdout, stderr = client.exec_command(
        "docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nmm-redis",
        timeout=30,
    )
    ip = stdout.read().decode("utf-8", "replace").strip()
    err = stderr.read().decode("utf-8", "replace").strip()
    if not ip:
        raise SystemExit(f"No se pudo obtener IP de nmm-redis: {err or 'vacio'}")
    return ip


def ensure_local_free(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError as exc:
            raise SystemExit(f"Puerto local {port} ocupado: {exc}") from exc


def forward_loop(
    local_sock: socket.socket,
    transport: paramiko.Transport,
    remote_host: str,
    remote_port: int,
) -> None:
    while True:
        try:
            client_sock, _addr = local_sock.accept()
        except OSError:
            return
        thread = threading.Thread(
            target=handle_connection,
            args=(client_sock, transport, remote_host, remote_port),
            daemon=True,
        )
        thread.start()


def handle_connection(
    client_sock: socket.socket,
    transport: paramiko.Transport,
    remote_host: str,
    remote_port: int,
) -> None:
    try:
        channel = transport.open_channel(
            "direct-tcpip",
            (remote_host, remote_port),
            client_sock.getpeername(),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"forward error {remote_host}:{remote_port}: {exc}", flush=True)
        client_sock.close()
        return

    try:
        while True:
            readable, _, _ = select.select([client_sock, channel], [], [], 60)
            if not readable:
                continue
            if client_sock in readable:
                data = client_sock.recv(65536)
                if not data:
                    break
                channel.sendall(data)
            if channel in readable:
                data = channel.recv(65536)
                if not data:
                    break
                client_sock.sendall(data)
    except Exception:  # noqa: BLE001
        pass
    finally:
        try:
            channel.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            client_sock.close()
        except Exception:  # noqa: BLE001
            pass


def main() -> None:
    password = load_password()
    ensure_local_free(LOCAL_PG)
    ensure_local_free(LOCAL_REDIS)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Conectando a {USER}@{HOST}:{PORT}...", flush=True)
    client.connect(
        HOST,
        port=PORT,
        username=USER,
        password=password,
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=25,
    )
    remote_redis = (redis_ip(client), 6379)
    transport = client.get_transport()
    if transport is None:
        raise SystemExit("SSH transport no disponible")
    transport.set_keepalive(30)

    listeners: list[socket.socket] = []
    for local_port, remote in ((LOCAL_PG, REMOTE_PG), (LOCAL_REDIS, remote_redis)):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", local_port))
        sock.listen(100)
        listeners.append(sock)
        thread = threading.Thread(
            target=forward_loop,
            args=(sock, transport, remote[0], remote[1]),
            daemon=True,
        )
        thread.start()
        print(
            f"  127.0.0.1:{local_port} -> {remote[0]}:{remote[1]}",
            flush=True,
        )

    print("TUNNEL_READY", flush=True)
    print("Tunel SSH activo. No cierres esta ventana.", flush=True)
    try:
        while True:
            if not transport.is_active():
                raise SystemExit("Conexion SSH caida")
            time.sleep(5)
    except KeyboardInterrupt:
        print("Cerrando tunel...", flush=True)
    finally:
        for sock in listeners:
            try:
                sock.close()
            except Exception:  # noqa: BLE001
                pass
        client.close()


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        if exc.code not in (0, None):
            print(str(exc), file=sys.stderr, flush=True)
        raise
