#!/usr/bin/env bash
# pi/setup-ap.sh — set up the host-only Wi-Fi AP services (hostapd + dnsmasq).
#
# These services must run on the Pi host itself because they configure Wi-Fi
# hardware. Everything else (engine, mediamtx, ffmpeg, pwa) runs in Docker via
# `docker compose up`. See pi/README.md for the full deployment story.
#
# Idempotent: safe to re-run whenever you tweak hostapd.conf or dnsmasq.conf.
# Run as root: sudo ./pi/setup-ap.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo ./pi/setup-ap.sh" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

apt-get update
apt-get install -y --no-install-recommends hostapd dnsmasq iw rfkill

# Drop our configs (overwriting whatever was there).
install -m 0644 "${REPO_ROOT}/pi/configs/hostapd.conf" /etc/hostapd/hostapd.conf
install -m 0644 "${REPO_ROOT}/pi/configs/dnsmasq.conf" /etc/dnsmasq.d/ocs-ap.conf

# Static IP for the AP interface so the phone and scorer can reach the rig
# at a predictable address.
if ! grep -q "^interface=wlan0$" /etc/dhcpcd.conf 2>/dev/null; then
  cat >> /etc/dhcpcd.conf <<'EOF'

# open-cricket-stream — static IP for the AP interface
interface wlan0
    static ip_address=10.42.0.1/24
    nohook wpa_supplicant
EOF
fi

# Make sure the radio isn't soft-blocked.
rfkill unblock wlan || true

systemctl unmask hostapd
systemctl enable --now hostapd dnsmasq

echo
echo "✓ Wi-Fi AP services configured."
echo "  SSID:        $(awk -F= '/^ssid=/{print $2}' /etc/hostapd/hostapd.conf)"
echo "  Pi address:  10.42.0.1"
echo "  Status:      systemctl status hostapd dnsmasq"
