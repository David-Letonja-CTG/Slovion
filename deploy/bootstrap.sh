#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 VM (OCI Always Free, Arm) for Slovion; see docs/hosting.md. Run once as root:
#   sudo bash bootstrap.sh "ssh-ed25519 AAAA... slovion-deploy"
# The argument is the public half of the GitHub deploy key. Running it again is safe.
set -euo pipefail

deploy_key="${1:?usage: bootstrap.sh \"<deploy public key>\"}"
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }

export DEBIAN_FRONTEND=noninteractive

echo "== packages and automatic security updates"
apt-get update -q
# Answer iptables-persistent's questions up front, so the install never waits for input.
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
apt-get install -y -q ca-certificates curl gnupg unattended-upgrades iptables-persistent
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Docker Engine with the compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "== deploy user"
id slovion >/dev/null 2>&1 || useradd --create-home --shell /bin/bash slovion
usermod -aG docker slovion
install -d -m 700 -o slovion -g slovion /home/slovion/.ssh
touch /home/slovion/.ssh/authorized_keys
grep -qxF "$deploy_key" /home/slovion/.ssh/authorized_keys || echo "$deploy_key" >> /home/slovion/.ssh/authorized_keys
chown slovion:slovion /home/slovion/.ssh/authorized_keys
chmod 600 /home/slovion/.ssh/authorized_keys
install -d -m 750 -o slovion -g slovion /opt/slovion

echo "== firewall: HTTP and HTTPS (Oracle's Ubuntu images reject them by default)"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
netfilter-persistent save

echo "== SSH: keys only"
cat > /etc/ssh/sshd_config.d/60-slovion.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
systemctl reload ssh

echo "== daily backup timer (03:30 UTC)"
cat > /etc/systemd/system/slovion-backup.service <<'EOF'
[Unit]
Description=Slovion database backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=slovion
ExecStart=/opt/slovion/backup.sh
EOF
cat > /etc/systemd/system/slovion-backup.timer <<'EOF'
[Unit]
Description=Daily Slovion database backup

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now slovion-backup.timer

echo "== done. The deploy workflow copies compose.yml, backup.sh and .env to /opt/slovion."
