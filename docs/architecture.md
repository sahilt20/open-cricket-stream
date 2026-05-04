# Architecture

> This is the high-level architecture summary. The full design rationale, alternatives considered, and 8-week build plan live in [PLAN.md](PLAN.md).

## Three-node split

```
 ┌──────────────────┐                    ┌──────────────────────────────┐
 │ Phone (camera)   │   SRT push         │  Raspberry Pi 5              │
 │ Larix Broadcaster├───────────────────▶│  ┌────────────────────────┐  │
 │ Tripod-mounted   │   over local Wi-Fi │  │ MediaMTX (ingest)      │  │
 └──────────────────┘                    │  └───────────┬────────────┘  │
                                         │              │               │
 ┌──────────────────┐                    │  ┌───────────▼────────────┐  │
 │ SOURCE OPTION 1  │   WebSocket        │  │  Score Engine          │  │
 │ Our PWA scoring  ├───────────────────▶│  │ ┌────────────────────┐ │  │
 │ (browser)        │   score events     │  │ │ Adapter A: WS in   │ │  │
 └──────────────────┘                    │  │ │ Adapter B: file in │ │  │
                                         │  │ └─────────┬──────────┘ │  │
 ┌──────────────────┐                    │  │           ▼            │  │
 │ SOURCE OPTION 2  │   SMB/CIFS         │  │  Normalised match      │  │
 │ PCS Pro on       ├───────────────────▶│  │  state (SQLite)        │  │
 │ Windows laptop   │   writes JSON file │  │  + overlay PNG render  │  │
 └──────────────────┘   per ball         │  └───────────┬────────────┘  │
                                         │              ▼               │   RTMPS    ┌──────────┐
                                         │  ┌────────────────────────┐  ├──────────▶│ YouTube  │
                                         │  │ FFmpeg compositor:     │  │           │ Live     │
                                         │  │ video + overlay → enc. │  │           └──────────┘
                                         │  └────────────────────────┘  │
                                         └──────────────────────────────┘
```

## Why three nodes

The Pi is the **only** thing that talks to YouTube.

- Scorer disconnects? Stream keeps running with last-known score.
- Phone wobbles for 5 seconds? SRT recovers without YouTube noticing.
- 4G uplink drops? Local MP4 recording continues.

Each leg fails independently. That isolation is what separates a usable rig from a fragile one.

## The source-agnostic core

Both adapters write into the same `MatchState` shape (see [match-state.md](match-state.md)). The overlay renderer reads that shape — it does not know or care whether the data came from a tap on the PWA or from a JSON file written by PCS Pro on the scorer's laptop. Switching between sources is a config change, not a code change.

This is enforced by the type system: every event ends up calling the same `applyEvent(state, event) → state` reducer in `score-engine`.

## Network topology

The Pi runs in **AP (access point) mode** via `hostapd` + `dnsmasq`. Phone and scorer's laptop join the Pi's Wi-Fi, not the ground's nonexistent Wi-Fi. The Pi's 4G uplink (USB modem or tethered hotspot) is the **only** thing that needs working internet, and it only needs it for the YouTube push — local traffic stays local even if 4G drops.

```
Phone     ─┐
           ├─► Pi Wi-Fi (AP)  ─►  4G uplink  ─► YouTube
Scorer    ─┘                  ─►  local MP4 (always)
```

## Process tree on the Pi

| Service | systemd unit | Purpose |
|---|---|---|
| MediaMTX | `mediamtx.service` | Ingest server. Receives SRT from phone. |
| Score Engine | `score-engine.service` | Node app. Owns `MatchState`. Runs both adapters. |
| Overlay Renderer | bundled in score-engine | Watches state, regenerates PNG. |
| FFmpeg compositor | `ffmpeg-stream.service` | Pulls from MediaMTX, composites overlay, pushes RTMPS to YouTube. Also writes local MP4. |
| Caddy | `caddy.service` | HTTPS reverse proxy for the PWA on the AP. |
| Samba | `smbd.service` | Network share `\\<pi-ip>\score-in\` for PCS Pro. |
| hostapd / dnsmasq | system | Wi-Fi AP. |

Every service has `Restart=always`. A watchdog checks the YouTube push status and restarts FFmpeg if it dies.
