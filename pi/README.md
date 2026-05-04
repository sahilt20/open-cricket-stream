# Pi provisioning

Everything needed to take a fresh Raspberry Pi 5 (Bookworm 64-bit Lite) and turn it into a self-contained streaming rig.

The recommended deployment path is **Docker Compose** — the same images you run locally with `make demo` run on the Pi. This keeps dev and prod the same. The legacy systemd units in [`systemd/`](systemd/) are kept as an alternative for users who prefer system-managed services without Docker.

## What gets installed

| Package | Purpose |
|---|---|
| Docker + Compose v2 | Runs engine, MediaMTX, FFmpeg, PWA as containers |
| hostapd + dnsmasq | Wi-Fi access point (phone & scorer connect here) — host-only |
| samba (optional) | Network share if you don't want to run the Samba container |
| chromium-browser (later) | Headless renderer for overlay PNG (Phase 2) |

## First-time setup (Docker path — recommended)

1. Flash Raspberry Pi OS Lite 64-bit (Bookworm) to the SD card. Enable SSH and set a strong password during imaging.
2. Boot the Pi, SSH in, and install Docker + Compose:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```
3. Clone this repo:
   ```bash
   git clone https://github.com/sahilt20/open-cricket-stream.git
   cd open-cricket-stream
   ```
4. Configure secrets:
   ```bash
   cp .env.example .env
   nano .env       # set SUPABASE_*, OUTPUT_URL with your YouTube key, etc.
   ```
5. Bring up the rig services:
   ```bash
   make build
   make stream     # core + simulated phone + compositor (writes local MP4)
                   # or `make all` to also start the Samba share
   ```
   When you have a real phone pushing instead of the simulated source, drop `--profile demo`:
   ```bash
   docker compose --profile stream up -d
   ```
6. Configure the host-only Wi-Fi AP services (Docker doesn't manage Wi-Fi hardware):
   ```bash
   sudo ./pi/setup-ap.sh         # installs hostapd + dnsmasq, applies our configs
   ```
7. Reboot. The Pi broadcasts the `OCS-Rig` AP; phone and scorer connect; the PWA is reachable at `http://10.42.0.1:5173`.

## What runs at boot

The Docker stack is brought up by a small systemd unit that runs `docker compose up -d`. The unit is installed by `pi/setup.sh`. Inside Compose, every service has `restart: unless-stopped`, so individual services recover from crashes; the systemd unit recovers from full reboots.

| Compose service | Image | Description |
|---|---|---|
| `mediamtx` | `bluenviron/mediamtx` | Listens on SRT :8890 and RTMP :1935 for the phone's push. |
| `score-engine` | local build, target `engine` | Node app. Owns MatchState, runs adapters, mirrors to Supabase. |
| `scoring-pwa` | local build, target `pwa` | nginx serving the static PWA build. |
| `ffmpeg-compositor` | `linuxserver/ffmpeg` | Pulls from MediaMTX, composites overlay, pushes to YouTube. |
| `samba` (optional) | `dperson/samba` | Network share at `\\10.42.0.1:1445\score-in` for PCS Pro. |

Plus the host-only services (not in Docker because they touch hardware):

| Host service | Description |
|---|---|
| `hostapd` | Wi-Fi access point on `wlan0`. |
| `dnsmasq` | DHCP + DNS for the AP, maps `score.ocs.local` → 10.42.0.1. |

## Legacy: systemd-only path (no Docker)

If you'd rather not run Docker on the Pi, the original [`systemd/`](systemd/) units and host-installed binaries (Node 20, MediaMTX, FFmpeg, Samba, Caddy) still work. Run `pi/setup-legacy.sh` instead of `pi/setup.sh`. The legacy path is **not the primary supported configuration** going forward — you'll get less help from CI and the Docker images.

## Switching scoring source per match

Edit `/etc/ocs/score-engine.env` and toggle the adapter. Both adapters can run simultaneously; the engine deduplicates by event-id, so picking "wrong" mid-match is recoverable.

## Network topology

```
                     ┌─── 4G uplink (USB modem or hotspot) ──► YouTube ──► Internet
                     │
   Pi (10.42.0.1) ───┤
                     │
                     ├─── Phone (Larix) ─── SRT to 10.42.0.1:8890
                     │
                     └─── Scorer's laptop or tablet ─── PWA at https://score.ocs.local
                                                        or PCS Pro writing to \\10.42.0.1\score-in
```

## Field-day checklist

The PWA's pre-flight checklist will eventually automate this, but for now:

- [ ] Power banks fully charged (both phone and Pi)
- [ ] 4G SIM has data left
- [ ] YouTube event scheduled and stream key in `/etc/ocs/score-engine.env`
- [ ] SD card has >10 GB free for the local MP4 fallback
- [ ] Tripod and clamp packed
- [ ] PCS Pro template is on the scorer's laptop (if using Adapter B)
