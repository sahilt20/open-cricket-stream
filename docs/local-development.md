# Local development with Docker

Until the Pi is on a tripod at the ground, the entire rig runs on your laptop in containers. The container images are the same ones we'll deploy to the Pi — so what works locally works there too, modulo Wi-Fi AP and the 4G uplink (which are hardware-bound and only run on the Pi itself).

## Prerequisites

- Docker Desktop (or Docker Engine) — `docker version` should report 24+
- Docker Compose v2 — `docker compose version` should be v2.20+
- Optional, for the durable tier: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) if you want a real Postgres-backed Supabase locally

Node.js is **only** needed if you want to run reducer tests or use the host-mode dev workflow (`npm run dev:engine` etc.). For the containerised stack, Docker is enough.

## TL;DR

```bash
cp .env.example .env       # optional — defaults are fine
make build                 # builds engine + PWA images
make demo                  # core stack + simulated phone
```

Then open:

- http://localhost:5173 — the scoring PWA
- http://localhost:8080/healthz — engine health
- http://localhost:8888/cam/index.m3u8 — HLS preview of the simulated stream

`make stream` adds the FFmpeg compositor that pulls the stream, applies the overlay, and writes a local MP4 inside the `ocs-recordings` Docker volume.

## What runs

| Service | Container | Image | Default | What it does |
|---|---|---|---|---|
| `mediamtx` | `ocs-mediamtx` | `bluenviron/mediamtx:1.9.3` | ✓ | SRT/RTMP ingest server. Receives the camera feed. |
| `score-engine` | `ocs-engine` | built locally (target `engine`) | ✓ | The Node app. Owns `MatchState`, runs PWA WS + PCS Pro adapters. |
| `scoring-pwa` | `ocs-pwa` | built locally (target `pwa`) | ✓ | The scoring PWA, served by nginx. |
| `test-stream-source` | `ocs-test-source` | `linuxserver/ffmpeg:latest` | `--profile demo` | Simulates the phone — pushes a test pattern over SRT. |
| `ffmpeg-compositor` | `ocs-compositor` | `linuxserver/ffmpeg:latest` | `--profile stream` | Pulls from MediaMTX, applies overlay, writes MP4 (or pushes RTMPS). |
| `samba` | `ocs-samba` | `dperson/samba:latest` | `--profile share` | Network share so a Windows PCS Pro install can write into the engine's score-in dir. |

## Profiles cheat-sheet

```bash
make up         # core only:       engine + mediamtx + pwa
make demo       # + test source:   simulated phone pushing SRT
make stream     # + compositor:    full pipeline writing local MP4
make all        # + samba:         everything, including PCS Pro share
```

Or directly with docker compose:

```bash
docker compose up -d                                          # core
docker compose --profile demo up -d                           # + simulated phone
docker compose --profile demo --profile stream up -d          # full pipeline
docker compose --profile demo --profile stream --profile share up -d  # + samba
```

`make logs`, `make ps`, `make down`, `make clean` for the obvious things.

## Where data lives

Two Docker volumes:

- `ocs-data` — mounted at `/var/ocs` inside the engine. SQLite event log lives here. Nuked by `make clean`.
- `ocs-recordings` — mounted at `/out` inside the compositor. Local MP4s.

You can grab a recorded match off the volume with:

```bash
docker run --rm -v ocs-recordings:/in -v "$PWD":/out alpine cp /in/local.mp4 /out/match.mp4
```

## Pointing at YouTube (optional)

Edit `.env` to point the compositor at YouTube Live:

```bash
OUTPUT_URL=rtmps://a.rtmp.youtube.com/live2/<your-stream-key>
```

Then `make stream` (or restart compositor). The same env var is used on the Pi.

## Wiring up Supabase locally

The score-engine and PWA work without Supabase — the engine's SQLite log is the source of truth during a match. Supabase is the durable tier (history, fixtures, players); it's optional in dev.

To add it:

```bash
make supabase-start         # boots local Supabase via the CLI
```

The CLI prints out URLs and keys. Copy them into `.env`:

```bash
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...    # from `supabase status`
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...       # from `supabase status`
```

Then rebuild and restart:

```bash
make build && make up
```

The score-engine starts mirroring ball events into Supabase. The PWA can read history, fixtures, and player data from it.

> ⚠️ The PWA's `VITE_*` vars are baked at build time, so changing them requires `make build` — not just `make up`. The engine's vars are read at runtime, so a `docker compose restart score-engine` is enough.

## Host-mode development (no Docker)

For tight iteration loops with HMR, run the workspaces directly on your host:

```bash
npm install
npm run dev:engine    # tsx watch on port 8080
npm run dev:pwa       # Vite dev server on port 5173 with HMR
```

This skips MediaMTX/FFmpeg entirely, which is fine for working on the engine, the reducer, the PWA UI, the overlay HTML, or the Supabase mirror. Reach for `make up` again when you need the streaming pipeline.

You can mix the two: run docker for `mediamtx` only and host-mode for the engine:

```bash
docker compose up -d mediamtx
npm run dev:engine
```

## Testing the PCS Pro adapter without Windows

Drop a JSON snapshot into the `score-in` directory and the engine's file watcher picks it up. With docker:

```bash
docker exec ocs-engine sh -c 'cat > /var/ocs/score-in/current.json' < pcs-pro/example-output.json
docker compose logs score-engine --tail=10
```

You should see a `pcs-pro event applied` log line within a second.

## Architecture diagrams of the local stack

```
                 ┌──────────────────────────────────────────┐
                 │                Docker host                │
                 │                                            │
  Browser ───► localhost:5173 ──► ocs-pwa (nginx)            │
                                     │                       │
  Browser ───► ws://localhost:8080 ──┴──► ocs-engine ◄── ocs-pwa source
                                              │              │
                                              ▼              │
                                          ocs-data           │
                                          (SQLite +          │
                                           overlay-out)      │
                                              ▲              │
                                              │              │
                  ocs-test-source ──SRT──► ocs-mediamtx ──► ocs-compositor
                  (simulated phone)         (1935/8890)     │
                                                            ▼
                                                      ocs-recordings
                                                      (local MP4)
                 └──────────────────────────────────────────┘

  Optional   :   `supabase start` runs a separate Postgres+REST stack on :54321,
                 reachable from inside containers via host.docker.internal.
```

## Troubleshooting

- **PWA can't reach the engine** — the PWA runs in your browser and points at `VITE_ENGINE_URL` (default `http://localhost:8080`), which is the host port mapping. If you changed `ENGINE_PORT`, also rebuild the PWA with the matching `VITE_ENGINE_URL`.
- **`make stream` shows "Connection refused" from the compositor** — MediaMTX hasn't received a publisher yet. Make sure `--profile demo` is also on, or push a real stream (e.g. from Larix) to `srt://localhost:8890?streamid=publish:cam`.
- **Compositor logs "Invalid PNG signature"** — the `ocs-data` volume has a corrupt overlay file (very old data from a previous failed run). `make clean` then `make demo` regenerates the placeholder.
- **Apple Silicon "platform mismatch"** — the FFmpeg image is multi-arch; if you see warnings, run `docker pull linuxserver/ffmpeg:latest` to refresh and Docker picks the right arch.
