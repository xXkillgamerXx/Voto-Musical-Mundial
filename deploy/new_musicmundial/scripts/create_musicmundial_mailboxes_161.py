#!/usr/bin/env python3
"""Create musicmundial.com domain + info@ / vote@ / noreply@ in BillionMail on host 161.

Also points Cloudflare mail.musicmundial.com A -> 161 and refreshes SPF.
Writes mailbox secrets to /root/musicmundial-mailboxes.txt on the server
and updates /www/wwwroot/new_musicmundial/.env SMTP_* for noreply.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import string
import time
from pathlib import Path

import paramiko

HOST = "161.97.154.152"
SSH_PORT = 2981
DOMAIN = "musicmundial.com"
MAIL_HOST = f"mail.{DOMAIN}"
MAILBOXES = ("info", "vote", "noreply")
QUOTA = 5_368_709_120  # 5 GB
ZONE = "70649f8e7abd1f85055c568366b61991"
SMTP_HOST_FOR_APP = "172.17.0.1"  # docker bridge from nmm-api
SMTP_PORT_FOR_APP = 587


def load_password() -> str:
    password = os.environ.get("NMM_SSH_PASSWORD", "").strip()
    if password:
        return password
    env_file = Path(__file__).resolve().parents[1] / ".env.contabo"
    for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.strip().startswith("NMM_SSH_PASSWORD="):
            return line.split("=", 1)[1].strip().strip("'").strip('"')
    raise SystemExit("Define NMM_SSH_PASSWORD")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise SystemExit(f"CMD failed ({code}): {cmd}\n{out}\n{err}")
    return out


def gen_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def password_encode(plain: str) -> str:
    b64 = base64.b64encode(plain.encode("utf-8")).decode("ascii")
    return "".join(f"{ord(ch):02x}" for ch in b64)


REMOTE = r'''
set -euo pipefail
DOMAIN="__DOMAIN__"
MAIL_HOST="__MAIL_HOST__"
ZONE="__ZONE__"
SMTP_HOST_FOR_APP="__SMTP_HOST_FOR_APP__"
SMTP_PORT_FOR_APP="__SMTP_PORT_FOR_APP__"
NOW=$(date +%s)
PG="docker exec -e PGPASSWORD=$(grep ^DBPASS= /www/dk_project/dk_app/billionmail/billionmail/.env | cut -d= -f2-) billionmail-pgsql-billionmail-1"
PSQL="$PG psql -U billionmail -d billionmail -v ON_ERROR_STOP=1"
DOVE="docker exec billionmail-dovecot-billionmail-1"
VMAIL_ROOT="/www/dk_project/dk_app/billionmail/billionmail/data/vmail-data"

python3 - <<'PY'
import json, urllib.request, urllib.error
from pathlib import Path

ZONE = "__ZONE__"
MAIL_HOST = "__MAIL_HOST__"
HOST_IP = "161.97.154.152"
DOMAIN = "__DOMAIN__"

cfg = json.loads(Path("/www/server/panel/plugin/cloudflare_manage/data/cf_default.json").read_text(encoding="utf-8"))
if "data" in cfg and isinstance(cfg["data"], dict):
    cfg = cfg["data"]
headers = {"Content-Type": "application/json"}
if cfg.get("E-Mail") and cfg.get("API Key"):
    headers["X-Auth-Email"] = cfg["E-Mail"]
    headers["X-Auth-Key"] = cfg["API Key"]
elif cfg.get("API Token"):
    headers["Authorization"] = "Bearer " + cfg["API Token"]
else:
    raise SystemExit("no cloudflare creds")

def cf(method, path, payload=None):
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            body = json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode() or "{}")
        raise SystemExit(f"CF HTTP {e.code} {path} {body}")
    if not body.get("success"):
        raise SystemExit(f"CF FAIL {path} {body}")
    return body

# Ensure A record for mail host (DNS only / grey cloud)
recs = cf("GET", f"/zones/{ZONE}/dns_records?type=A&name={MAIL_HOST}")["result"]
payload = {"type": "A", "name": MAIL_HOST, "content": HOST_IP, "ttl": 300, "proxied": False}
if recs:
    rid = recs[0]["id"]
    if recs[0].get("content") != HOST_IP or recs[0].get("proxied"):
        cf("PUT", f"/zones/{ZONE}/dns_records/{rid}", payload)
        print("CF updated A", MAIL_HOST, "->", HOST_IP)
    else:
        print("CF A already ok", MAIL_HOST, "->", HOST_IP)
else:
    cf("POST", f"/zones/{ZONE}/dns_records", payload)
    print("CF created A", MAIL_HOST, "->", HOST_IP)

# Ensure MX
mx = cf("GET", f"/zones/{ZONE}/dns_records?type=MX&name={DOMAIN}")["result"]
wanted = {"type": "MX", "name": DOMAIN, "content": MAIL_HOST, "priority": 10, "ttl": 300}
if not mx:
    cf("POST", f"/zones/{ZONE}/dns_records", wanted)
    print("CF created MX", DOMAIN, "->", MAIL_HOST)
else:
    # keep existing MX if already pointing at mail host
    ok = any(r.get("content", "").rstrip(".") == MAIL_HOST for r in mx)
    print("CF MX present", [(r.get("content"), r.get("priority")) for r in mx], "ok" if ok else "CHECK")

# Refresh SPF: keep one SPF with current host IP
txts = cf("GET", f"/zones/{ZONE}/dns_records?type=TXT&name={DOMAIN}")["result"]
spf_records = [r for r in txts if any(str(s).lower().startswith("v=spf1") for s in ([r.get("content")] if isinstance(r.get("content"), str) else (r.get("content") or [])))]
# Cloudflare returns content as string for TXT
spf_records = [r for r in txts if str(r.get("content", "")).lower().startswith("v=spf1") or str(r.get("content", "")).lower().startswith('"v=spf1')]
new_spf = f"v=spf1 +a +mx +ip4:{HOST_IP} ~all"
if spf_records:
    # update first SPF, delete extras
    first = spf_records[0]
    cf("PUT", f"/zones/{ZONE}/dns_records/{first['id']}", {
        "type": "TXT", "name": DOMAIN, "content": new_spf, "ttl": 300
    })
    print("CF SPF updated", new_spf)
    for extra in spf_records[1:]:
        cf("DELETE", f"/zones/{ZONE}/dns_records/{extra['id']}")
        print("CF deleted duplicate SPF", extra.get("id"))
else:
    cf("POST", f"/zones/{ZONE}/dns_records", {
        "type": "TXT", "name": DOMAIN, "content": new_spf, "ttl": 300
    })
    print("CF SPF created", new_spf)
PY

# Domain row
EXISTS=$($PSQL -Atc "SELECT 1 FROM domain WHERE domain='${DOMAIN}'" | tr -d '\r')
if [ "$EXISTS" != "1" ]; then
  $PSQL -c "INSERT INTO domain (domain, a_record, mailboxes, mailbox_quota, quota, rate_limit, create_time, active, urls, hasbrandinfo, current_usage)
    VALUES ('${DOMAIN}', '${MAIL_HOST}', 50, 5368709120, 5368709120, 12, ${NOW}, 1, '{https://www.musicmundial.com}', 0, 0);"
  echo "DOMAIN_CREATED ${DOMAIN}"
else
  echo "DOMAIN_EXISTS ${DOMAIN}"
fi

mkdir -p "${VMAIL_ROOT}/${DOMAIN}"
chown -R 150:mem "${VMAIL_ROOT}/${DOMAIN}" 2>/dev/null || chown -R 150:150 "${VMAIL_ROOT}/${DOMAIN}" || true

SECRET_FILE=/root/musicmundial-mailboxes.txt
echo "# musicmundial.com mailboxes created $(date -Is)" > "$SECRET_FILE"
chmod 600 "$SECRET_FILE"

create_box() {
  local local_part="$1"
  local plain="$2"
  local email="${local_part}@${DOMAIN}"
  local hash encode
  hash=$($DOVE doveadm pw -s MD5-CRYPT -p "$plain" | sed 's/{MD5-CRYPT}//')
  encode=$(python3 - <<PY
import base64
plain = """${plain}"""
b64 = base64.b64encode(plain.encode()).decode()
print(''.join(f'{ord(c):02x}' for c in b64))
PY
)
  local found
  found=$($PSQL -Atc "SELECT 1 FROM mailbox WHERE username='${email}'" | tr -d '\r')
  if [ "$found" = "1" ]; then
    $PSQL -c "UPDATE mailbox SET password='${hash}', password_encode='${encode}', update_time=${NOW}, active=1, quota=${QUOTA:-5368709120}, quota_active=1 WHERE username='${email}';"
    echo "MAILBOX_UPDATED ${email}"
  else
    $PSQL -c "INSERT INTO mailbox (username, password, password_encode, full_name, is_admin, maildir, quota, local_part, domain, create_time, update_time, active, used_quota, quota_active)
      VALUES ('${email}', '${hash}', '${encode}', '${local_part}', 0, '${email}/', 5368709120, '${local_part}', '${DOMAIN}', ${NOW}, ${NOW}, 1, 0, 1);"
    echo "MAILBOX_CREATED ${email}"
  fi
  mkdir -p "${VMAIL_ROOT}/${DOMAIN}/${local_part}"
  chown -R 150:mem "${VMAIL_ROOT}/${DOMAIN}/${local_part}" 2>/dev/null || chown -R 150:150 "${VMAIL_ROOT}/${DOMAIN}/${local_part}" || true
  echo "${email}  password=${plain}  smtp=${MAIL_HOST}:587  imap=${MAIL_HOST}:993" >> "$SECRET_FILE"
}

INFO_PASS='__INFO_PASS__'
VOTE_PASS='__VOTE_PASS__'
NOREPLY_PASS='__NOREPLY_PASS__'
create_box info "$INFO_PASS"
create_box vote "$VOTE_PASS"
create_box noreply "$NOREPLY_PASS"

echo '=== mailboxes ==='
$PSQL -c "SELECT username, domain, active, quota FROM mailbox WHERE domain='${DOMAIN}' ORDER BY username;"

# DKIM for musicmundial.com via rspamd
RSPAMD=billionmail-rspamd-billionmail-1
DKIM_DIR="/var/lib/rspamd/dkim/${DOMAIN}"
docker exec "$RSPAMD" sh -lc "mkdir -p '${DKIM_DIR}'"
if ! docker exec "$RSPAMD" test -f "${DKIM_DIR}/default.private"; then
  docker exec "$RSPAMD" sh -lc "rspamadm dkim_keygen -s default -b 1024 -d '${DOMAIN}' -k '${DKIM_DIR}/default.private' > '${DKIM_DIR}/default.pub'"
  echo "DKIM_GENERATED ${DOMAIN}"
else
  echo "DKIM_EXISTS ${DOMAIN}"
fi
docker exec "$RSPAMD" sh -lc "chmod -R 755 '${DKIM_DIR}'"
DKIM_PUB=$(docker exec "$RSPAMD" cat "${DKIM_DIR}/default.pub" || true)
DKIM_TXT=$(DKIM_PUB="$DKIM_PUB" python3 - <<'PY'
import os,re
raw=os.environ.get("DKIM_PUB","")
print(''.join(re.findall(r'"([^"]+)"', raw)).replace(' ',''))
PY
)
if [ -n "$DKIM_TXT" ]; then
  python3 - <<PY
import json, urllib.request, urllib.error
from pathlib import Path
ZONE="$ZONE"
DOMAIN="$DOMAIN"
DKIM_TXT="""$DKIM_TXT"""
name=f"default._domainkey.{DOMAIN}"
cfg=json.loads(Path("/www/server/panel/plugin/cloudflare_manage/data/cf_default.json").read_text(encoding="utf-8"))
if "data" in cfg and isinstance(cfg["data"], dict): cfg=cfg["data"]
headers={"Content-Type":"application/json"}
if cfg.get("E-Mail") and cfg.get("API Key"):
  headers["X-Auth-Email"]=cfg["E-Mail"]; headers["X-Auth-Key"]=cfg["API Key"]
elif cfg.get("API Token"):
  headers["Authorization"]="Bearer "+cfg["API Token"]
else:
  raise SystemExit("no cloudflare creds")
def cf(method,path,payload=None):
  req=urllib.request.Request("https://api.cloudflare.com/client/v4"+path, data=None if payload is None else json.dumps(payload).encode(), headers=headers, method=method)
  try:
    with urllib.request.urlopen(req, timeout=45) as res: body=json.loads(res.read().decode())
  except urllib.error.HTTPError as e:
    body=json.loads(e.read().decode() or "{}"); raise SystemExit(f"CF HTTP {e.code} {path} {body}")
  if not body.get("success"): raise SystemExit(f"CF FAIL {path} {body}")
  return body
recs=cf("GET", f"/zones/{ZONE}/dns_records?type=TXT&name={name}")["result"]
payload={"type":"TXT","name":name,"content":DKIM_TXT,"ttl":300}
if recs:
  cf("PUT", f"/zones/{ZONE}/dns_records/{recs[0]['id']}", payload); print("CF DKIM updated", name)
else:
  cf("POST", f"/zones/{ZONE}/dns_records", payload); print("CF DKIM created", name)
print("DKIM_TXT", DKIM_TXT[:80]+"...")
PY
  # Ensure rspamd dkim_signing knows the domain (best-effort)
  docker exec "$RSPAMD" sh -lc "grep -q \"${DOMAIN}\" /etc/rspamd/local.d/dkim_signing.conf 2>/dev/null || printf '\n%s {\n  selectors [\n   {\n    path: \"/var/lib/rspamd/dkim/%s/default.private\";\n    selector: \"default\"\n   }\n  ]\n}\n' '${DOMAIN}' '${DOMAIN}' >> /etc/rspamd/local.d/dkim_signing.conf" || true
  docker restart "$RSPAMD" >/dev/null || true
else
  echo "DKIM_TXT_EMPTY"
fi

# Point app SMTP at noreply
ENV_FILE=/www/wwwroot/new_musicmundial/.env
if [ -f "$ENV_FILE" ]; then
  python3 - <<PY
from pathlib import Path
path = Path("$ENV_FILE")
text = path.read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()
kv = {
  "SMTP_HOST": "$SMTP_HOST_FOR_APP",
  "SMTP_PORT": "$SMTP_PORT_FOR_APP",
  "SMTP_USER": "noreply@$DOMAIN",
  "SMTP_PASS": "$NOREPLY_PASS",
  "MAIL_FROM": "Music Mundial <noreply@$DOMAIN>",
  "CONTACT_TO": "info@$DOMAIN",
}
out = []
seen = set()
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in kv:
        out.append(f"{key}={kv[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, val in kv.items():
    if key not in seen:
        out.append(f"{key}={val}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("ENV_UPDATED", path)
PY
  cd /www/wwwroot/new_musicmundial
  docker compose -p new_musicmundial up -d api worker >/tmp/nmm_mail_restart.log 2>&1 || true
  echo "API_RESTART_LOG"; tail -n 20 /tmp/nmm_mail_restart.log || true
else
  echo "ENV_MISSING $ENV_FILE"
fi

# Quick SMTP auth smoke for noreply via localhost submission
python3 - <<PY
import smtplib, ssl
user = "noreply@$DOMAIN"
password = """$NOREPLY_PASS"""
try:
    with smtplib.SMTP("127.0.0.1", 587, timeout=20) as s:
        s.ehlo()
        try:
            s.starttls(context=ssl.create_default_context())
            s.ehlo()
        except Exception as e:
            print("STARTTLS note:", e)
        s.login(user, password)
        print("SMTP_AUTH_OK", user)
except Exception as e:
    print("SMTP_AUTH_FAIL", type(e).__name__, e)
PY

echo "SECRETS_FILE $SECRET_FILE"
'''


def main() -> None:
    info_pass = gen_password()
    vote_pass = gen_password()
    noreply_pass = gen_password()

    script = (
        REMOTE.replace("__DOMAIN__", DOMAIN)
        .replace("__MAIL_HOST__", MAIL_HOST)
        .replace("__ZONE__", ZONE)
        .replace("__SMTP_HOST_FOR_APP__", SMTP_HOST_FOR_APP)
        .replace("__SMTP_PORT_FOR_APP__", str(SMTP_PORT_FOR_APP))
        .replace("__INFO_PASS__", info_pass)
        .replace("__VOTE_PASS__", vote_pass)
        .replace("__NOREPLY_PASS__", noreply_pass)
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        port=SSH_PORT,
        username="root",
        password=load_password(),
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )
    print(run(client, script, timeout=180))
    client.close()

    # Local backend .env for tunnel/dev against same mailboxes if needed
    local_env = Path(__file__).resolve().parents[3] / "backend" / ".env"
    if local_env.is_file():
        text = local_env.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        kv = {
            "SMTP_HOST": MAIL_HOST,
            "SMTP_PORT": "587",
            "SMTP_USER": f"noreply@{DOMAIN}",
            "SMTP_PASS": noreply_pass,
            "MAIL_FROM": f"Music Mundial <noreply@{DOMAIN}>",
            "CONTACT_TO": f"info@{DOMAIN}",
        }
        out = []
        seen = set()
        for line in lines:
            if not line or line.lstrip().startswith("#") or "=" not in line:
                out.append(line)
                continue
            key = line.split("=", 1)[0].strip()
            if key in kv:
                out.append(f"{key}={kv[key]}")
                seen.add(key)
            else:
                out.append(line)
        for key, val in kv.items():
            if key not in seen:
                out.append(f"{key}={val}")
        local_env.write_text("\n".join(out) + "\n", encoding="utf-8")
        print("LOCAL_ENV_UPDATED", local_env)

    print("\n=== CREDENTIALS (save these) ===")
    print(f"SMTP host: {MAIL_HOST}")
    print("SMTP ports: 587 (STARTTLS) / 465 (SSL)")
    print("IMAP: 993")
    print(f"info@{DOMAIN}  /  {info_pass}")
    print(f"vote@{DOMAIN}  /  {vote_pass}")
    print(f"noreply@{DOMAIN}  /  {noreply_pass}  (app SMTP)")
    print(f"CONTACT_TO -> info@{DOMAIN}")


if __name__ == "__main__":
    main()
