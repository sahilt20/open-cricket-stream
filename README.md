# open-cricket-stream

An open-source, fixed-cost replacement for FrogBox-style live cricket streaming. Phone as camera, Raspberry Pi 5 as production hub, scorer's choice of UI — either a custom PWA or the ECB's Play-Cricket Scorer Pro via its local file feed. Streams to YouTube. Built for [Willow Cricket Club](https://willowcc.play-cricket.com/) (Warwickshire), designed to be portable to any UK recreational club.

> **Status:** Early scaffolding. See [docs/PLAN.md](docs/PLAN.md) for the design rationale and 8-week build plan.

## What's in this repo

| Path | Purpose |
|---|---|
| [`packages/score-engine/`](packages/score-engine/) | Node + TypeScript backend on the Pi. Owns the canonical `MatchState`. Two source adapters. |
| [`packages/scoring-pwa/`](packages/scoring-pwa/) | Progressive web app for ball-by-ball scoring (React + Vite + Tailwind). |
| [`packages/overlay-templates/`](packages/overlay-templates/) | HTML/CSS scoreboard overlays. Rendered to PNG, composited by FFmpeg. |
| [`pi/`](pi/) | Provisioning for the Raspberry Pi 5: systemd units, hostapd/dnsmasq for AP mode, Samba share, Caddy, MediaMTX config. |
| [`pcs-pro/`](pcs-pro/) | Custom Scoreboard Integration template for PCS Pro plus setup notes. |
| [`docs/`](docs/) | Architecture, hardware BOM, build plan, schema. |

## Architecture (one-liner)

```
phone (Larix → SRT) ─► MediaMTX ─► FFmpeg ─► YouTube
                                    ▲
                          overlay PNG (regenerated on score change)
                                    ▲
                  Score Engine ◄─── Adapter A (PWA WebSocket)
                              ◄─── Adapter B (PCS Pro file watcher)
```

The Score Engine is **source-agnostic**: both adapters normalise into the same `MatchState`, so the overlay renderer doesn't care who's scoring. Adapter is selectable per-match. See [docs/architecture.md](docs/architecture.md).

## Quickstart (development, on a Mac/Linux dev box)

Requires Node 20+.

```bash
npm install
npm run dev:engine     # starts score-engine on :8080
npm run dev:pwa        # starts scoring PWA on :5173 with HMR
```

Open `http://localhost:5173`, tap "+1", and watch the engine log update. The PWA points at `ws://localhost:8080` by default — set `VITE_ENGINE_URL` to override.

## Pi deployment

See [pi/README.md](pi/README.md). The `pi/setup.sh` script installs MediaMTX, FFmpeg, Samba, Caddy, hostapd, dnsmasq, and registers the systemd units.

## Hardware

See [docs/hardware-bom.md](docs/hardware-bom.md) for the full bill of materials (~£300 one-time spend).

## Licence

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it for your club.

## Credits

Inspired by the FrogBox commercial product. Uses the ECB's [Play-Cricket Scorer Pro Custom Scoreboard Integration](https://www.ecb.co.uk/play/play-cricket/scorer-pro) feature for source Option 2 — that's a feature of the official ECB scoring software, not part of this repo.
