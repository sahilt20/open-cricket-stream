# Pi provisioning

Everything needed to take a fresh Raspberry Pi 5 (Bookworm 64-bit Lite) and turn it into a self-contained streaming rig.

## What gets installed

| Package | Purpose |
|---|---|
| Node.js 20 | Runs the score-engine |
| MediaMTX | SRT/RTMP ingest server |
| FFmpeg | Video composition + RTMPS push |
| Samba | Network share for PCS Pro to write into |
| Caddy | HTTPS reverse proxy for the PWA |
| hostapd + dnsmasq | Wi-Fi access point (phone & scorer connect here) |
| chromium-browser | Headless renderer for overlay PNG (Phase 2) |

## First-time setup

1. Flash Raspberry Pi OS Lite 64-bit (Bookworm) to the SD card. Enable SSH and set a strong password during imaging.
2. Boot the Pi, SSH in, and clone this repo:
   ```bash
   git clone https://github.com/sahilt20/open-cricket-stream.git
   cd open-cricket-stream
   ```
3. Run the bootstrap:
   ```bash
   sudo ./pi/setup.sh
   ```
   The script is **idempotent** — re-run it whenever you change configs or pull updates.
4. Drop your secrets in `/etc/ocs/score-engine.env` (see `score-engine/.env.example`):
   ```bash
   sudo install -m 0600 -o ocs -g ocs packages/score-engine/.env.example /etc/ocs/score-engine.env
   sudo nano /etc/ocs/score-engine.env
   ```
5. Reboot. The rig should come up with the AP `OCS-Rig` broadcasting and the PWA reachable at `https://score.ocs.local` (or `http://10.42.0.1:5173` in dev).

## What runs at boot

| systemd unit | Description |
|---|---|
| `mediamtx.service` | Listens on SRT :8890 and RTMP :1935 for the phone's push. |
| `score-engine.service` | The Node app. Owns MatchState, runs adapters, mirrors to Supabase. |
| `ffmpeg-stream.service` | Pulls from MediaMTX, composites overlay, pushes to YouTube. |
| `caddy.service` | HTTPS proxy for the PWA. |
| `smbd.service` | Network share at `\\10.42.0.1\score-in`. |
| `hostapd.service` | Wi-Fi access point. |
| `dnsmasq.service` | DHCP + DNS for the AP. |

All units `Restart=always`. A watchdog in the score-engine restarts FFmpeg if the YouTube push goes silent for more than 15 seconds.

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
