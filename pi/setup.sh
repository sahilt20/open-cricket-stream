#!/usr/bin/env bash
# pi/setup.sh — Docker-first deployment of open-cricket-stream on a Raspberry Pi 5.
#
# Installs Docker + Compose, fetches/builds the rig images, and registers a
# tiny systemd unit (ocs-rig.service) that runs `docker compose up -d` at boot.
# Wi-Fi access-point setup is in pi/setup-ap.sh — run it separately.
#
# Idempotent: safe to re-run after pulling updates or editing .env.
# Run as root from the repo root: `sudo ./pi/setup.sh`
#
# For the original native install (Node + MediaMTX + FFmpeg via apt, services
# managed individually by systemd) see pi/setup-legacy.sh.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo ./pi/setup.sh" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUDO_USER_NAME="${SUDO_USER:-pi}"

# ─── 1. Install Docker if it isn't already there ────────────────────────────
if ! command -v docker >/dev/null; then
  echo "→ installing Docker via get.docker.com"
  curl -fsSL https://get.docker.com | sh
fi

usermod -aG docker "${SUDO_USER_NAME}" || true

# Compose v2 plugin ships with modern docker-ce, but on older boxes we double-check.
if ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends docker-compose-plugin
fi

systemctl enable --now docker

# ─── 2. .env file (created from example if missing; never overwritten) ──────
if [[ ! -f "${REPO_ROOT}/.env" ]]; then
  cp "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env"
  chown "${SUDO_USER_NAME}:${SUDO_USER_NAME}" "${REPO_ROOT}/.env"
  echo "→ created ${REPO_ROOT}/.env from .env.example — edit it before continuing if you want YouTube/Supabase wired in."
fi

# ─── 3. Build images and bring the stack up ─────────────────────────────────
sudo -u "${SUDO_USER_NAME}" -H bash -c "cd ${REPO_ROOT} && docker compose build"
sudo -u "${SUDO_USER_NAME}" -H bash -c "cd ${REPO_ROOT} && docker compose --profile stream up -d"

# ─── 4. Install the boot-time systemd unit ──────────────────────────────────
install -m 0644 "${REPO_ROOT}/pi/systemd/ocs-rig.service" /etc/systemd/system/ocs-rig.service
# Patch the WorkingDirectory and User to match this install.
sed -i "s|__REPO_ROOT__|${REPO_ROOT}|g; s|__USER__|${SUDO_USER_NAME}|g" /etc/systemd/system/ocs-rig.service

systemctl daemon-reload
systemctl enable ocs-rig.service

echo
echo "✓ open-cricket-stream provisioned via Docker."
echo "  Compose:   cd ${REPO_ROOT} && docker compose ps"
echo "  Logs:      cd ${REPO_ROOT} && docker compose logs -f"
echo "  Boot unit: systemctl status ocs-rig"
echo
echo "Next: configure the Wi-Fi access point with:  sudo ${REPO_ROOT}/pi/setup-ap.sh"
