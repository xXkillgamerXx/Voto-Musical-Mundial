import os
import paramiko

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
cmd = r"""
grep -n 'charts/radio' /www/wwwroot/new_musicmundial/nginx/default.conf
echo '---'
docker exec nmm-nginx grep -n 'charts/radio' /etc/nginx/conf.d/default.conf
echo '---'
curl -sI http://127.0.0.1:8088/charts/ | tr -d '\r' | grep -iE 'HTTP|location'
"""
_stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[:1000])
client.close()
