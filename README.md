# open-cricket-stream

An open-source, fixed-cost replacement for FrogBox-style live cricket streaming. Phone as camera, Raspberry Pi 5 as production hub, scorer's choice of UI — either a custom PWA or the ECB's Play-Cricket Scorer Pro via its local file feed. Streams to YouTube. Built for [Willow Cricket Club](https://willowcc.play-cricket.com/) (Warwickshire), designed to be portable to any UK recreational club.

> **Status:** Early scaffolding. See [docs/PLAN.md](docs/PLAN.md) for the design rationale and 8-week build plan.

## What's in this repo

| Path | Purpose |
|---|---|
| [`Dockerfile`](Dockerfile) | Multi-target build (`engine`, `pwa`). Same images run locally and on the Pi. |
| [`docker-compose.yml`](docker-compose.yml) | Local stack: engine, MediaMTX, PWA, plus optional simulated-phone and compositor profiles. |
| [`packages/score-engine/`](packages/score-engine/) | Node + TypeScript backend. Owns the canonical `MatchState`. Two source adapters. |
| [`packages/scoring-pwa/`](packages/scoring-pwa/) | Progressive web app for ball-by-ball scoring (React + Vite + Tailwind). |
| [`packages/db/`](packages/db/) | Supabase schema, RLS, typed client. The durable tier (fixtures, history, players). |
| [`packages/overlay-templates/`](packages/overlay-templates/) | HTML/CSS scoreboard overlays. Rendered to PNG, composited by FFmpeg. |
| [`pi/`](pi/) | Pi-specific: setup script, host-only configs (hostapd, dnsmasq), legacy systemd units. |
| [`pcs-pro/`](pcs-pro/) | Custom Scoreboard Integration template for PCS Pro plus setup notes. |
| [`docs/`](docs/) | Architecture, [data tier](docs/data.md), [local dev](docs/local-development.md), hardware BOM, build plan, schema. |

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

## Quickstart — run the whole stack locally with Docker

Until the Pi arrives, the entire rig (engine, MediaMTX, scoring PWA, FFmpeg compositor, simulated phone) runs in containers on your laptop. The same images deploy to the Pi later.

```bash
cp .env.example .env       # optional — defaults are fine
make build                 # build engine + PWA images
make demo                  # core + simulated phone (test pattern → SRT)
```

Then open:

- http://localhost:5173 — the scoring PWA
- http://localhost:8080/healthz — engine health
- http://localhost:8888/cam/index.m3u8 — HLS preview of the simulated stream

`make stream` adds the FFmpeg compositor (writes a local MP4). `make all` adds the optional Samba share for PCS Pro testing. Full guide: [docs/local-development.md](docs/local-development.md).

## Quickstart — host-mode development (no Docker)

For tight iteration with HMR:

```bash
npm install
npm run dev:engine     # tsx watch on :8080
npm run dev:pwa        # Vite dev server on :5173 with HMR
```

Requires Node 20+. Use this when you're iterating on the engine, reducer, or PWA UI; skip the streaming pipeline. Mix and match: `docker compose up -d mediamtx` plus host-mode engine works fine.

## Pi deployment

The Pi runs the same Docker images via `docker compose`. The `pi/setup.sh` script installs Docker + the host-only services (hostapd, dnsmasq for the Wi-Fi AP) and brings the compose stack up at boot. Legacy systemd units are still in [`pi/systemd/`](pi/systemd/) for users who prefer system-managed services. Full guide: [pi/README.md](pi/README.md).

## Hardware

See [docs/hardware-bom.md](docs/hardware-bom.md) for the full bill of materials (~£300 one-time spend).

## Licence

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it for your club.

## Credits

Inspired by the FrogBox commercial product. Uses the ECB's [Play-Cricket Scorer Pro Custom Scoreboard Integration](https://www.ecb.co.uk/play/play-cricket/scorer-pro) feature for source Option 2 — that's a feature of the official ECB scoring software, not part of this repo.
