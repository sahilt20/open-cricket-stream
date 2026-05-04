#!/usr/bin/env bash
# pi/setup.sh — bootstrap an open-cricket-stream rig on Raspberry Pi OS Lite (Bookworm 64-bit)
#
# Idempotent: safe to re-run after editing configs or pulling updates.
# Run as root from the repo root: `sudo ./pi/setup.sh`

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo ./pi/setup.sh" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OCS_USER="ocs"
OCS_HOME="/opt/ocs"
ETC_DIR="/etc/ocs"
VAR_DIR="/var/ocs"
SCORE_IN_DIR="/srv/score-in"

# ─── 1. System packages ─────────────────────────────────────────────────────
apt-get update
apt-get install -y --no-install-recommends \
  curl ca-certificates git \
  ffmpeg \
  samba \
  caddy \
  hostapd dnsmasq \
  chromium-browser \
  network-manager \
  build-essential python3

# Node.js 20 via NodeSource — the apt-shipped Node is too old for our deps.
if ! command -v node >/dev/null || [[ "$(node --version)" != v20.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# MediaMTX — install as a versioned binary; arm64 for Pi 5.
MEDIAMTX_VERSION="${MEDIAMTX_VERSION:-1.9.3}"
if ! command -v mediamtx >/dev/null; then
  TMP_DIR=$(mktemp -d)
  curl -fsSL "https://github.com/bluenviron/mediamtx/releases/download/v${MEDIAMTX_VERSION}/mediamtx_v${MEDIAMTX_VERSION}_linux_arm64.tar.gz" \
    | tar -xz -C "${TMP_DIR}"
  install -m 0755 "${TMP_DIR}/mediamtx" /usr/local/bin/mediamtx
  rm -rf "${TMP_DIR}"
fi

# ─── 2. App user + filesystem layout ────────────────────────────────────────
id -u "${OCS_USER}" >/dev/null 2>&1 || useradd --system --create-home --home-dir "${OCS_HOME}" --shell /usr/sbin/nologin "${OCS_USER}"
install -d -o "${OCS_USER}" -g "${OCS_USER}" -m 0755 "${OCS_HOME}" "${VAR_DIR}" "${VAR_DIR}/recordings" "${VAR_DIR}/overlay-out" "${SCORE_IN_DIR}"
install -d -m 0755 "${ETC_DIR}"

# Sync repo into the install location (rsync keeps it cheap on re-runs).
apt-get install -y rsync
rsync -a --delete \
  --exclude=.git --exclude=node_modules --exclude=dist --exclude='**/*.tsbuildinfo' \
  "${REPO_ROOT}/" "${OCS_HOME}/"
chown -R "${OCS_USER}:${OCS_USER}" "${OCS_HOME}"

# Install dependencies and build as the ocs user.
sudo -u "${OCS_USER}" -H bash -c "cd ${OCS_HOME} && npm install && npm run build --workspaces --if-present"

# ─── 3. Drop config files ───────────────────────────────────────────────────
install -m 0644 "${REPO_ROOT}/pi/configs/mediamtx.yml" "${ETC_DIR}/mediamtx.yml"
install -m 0644 "${REPO_ROOT}/pi/configs/hostapd.conf" /etc/hostapd/hostapd.conf
install -m 0644 "${REPO_ROOT}/pi/configs/dnsmasq.conf" /etc/dnsmasq.d/ocs-ap.conf
install -m 0644 "${REPO_ROOT}/pi/configs/Caddyfile"   /etc/caddy/Caddyfile
install -m 0755 "${REPO_ROOT}/pi/configs/ffmpeg-stream.sh" /usr/local/bin/ocs-ffmpeg-stream

# Append our Samba share if it isn't already there.
if ! grep -q "^\\[score-in\\]" /etc/samba/smb.conf; then
  cat "${REPO_ROOT}/pi/configs/smb.conf.snippet" >> /etc/samba/smb.conf
fi

# Create the .env file from the template if one doesn't exist; never overwrite.
if [[ ! -f "${ETC_DIR}/score-engine.env" ]]; then
  install -m 0600 -o "${OCS_USER}" -g "${OCS_USER}" \
    "${REPO_ROOT}/packages/score-engine/.env.example" "${ETC_DIR}/score-engine.env"
  echo "Created ${ETC_DIR}/score-engine.env from .env.example — edit it before rebooting." >&2
fi

# ─── 4. systemd units ───────────────────────────────────────────────────────
for unit in score-engine.service mediamtx.service ffmpeg-stream.service; do
  install -m 0644 "${REPO_ROOT}/pi/systemd/${unit}" "/etc/systemd/system/${unit}"
done

systemctl daemon-reload

# Enable hostapd + dnsmasq for AP mode.
systemctl unmask hostapd
systemctl enable hostapd dnsmasq smbd caddy mediamtx score-engine ffmpeg-stream

echo
echo "✓ open-cricket-stream provisioned."
echo "  Edit:    ${ETC_DIR}/score-engine.env"
echo "  Restart: systemctl restart score-engine ffmpeg-stream"
echo "  Logs:    journalctl -u score-engine -f"
