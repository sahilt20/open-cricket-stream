# PCS Pro integration (Source Option 2)

This directory contains everything needed to wire **Play-Cricket Scorer Pro** (PCS Pro, the ECB's free scoring software) to the Pi, so PCS Pro becomes the live data source for the rig.

## How it works

PCS Pro has a built-in **Custom Scoreboard Integration** feature. After every ball, PCS Pro re-writes a single output file using a configurable template. We point PCS Pro at the Pi's Samba share, ship a template that emits the JSON shape our `pcs-pro-file.ts` adapter expects, and the score-engine picks up changes via `chokidar`.

```
PCS Pro (Windows)  ─writes file─►  \\<pi-ip>\score-in\current.json
                                            │
                                            ▼
                                  chokidar file watcher
                                            │
                                            ▼
                            score-engine MatchStateStore
```

Latency target: 1-2 seconds from "scorer taps a run" to "overlay shows it".

## One-time setup on the scorer's laptop

1. **Mount the Samba share.**
   On Windows, open File Explorer, paste `\\10.42.0.1\score-in` into the address bar, choose to remember as a network drive (e.g. `Z:`).

2. **Drop the template file.**
   Copy `willow-overlay.template` from this directory into PCS Pro's `Templates` folder (commonly `C:\Users\<you>\Documents\Play-Cricket Scorer Pro\Templates\`).

3. **Configure PCS Pro to use it.**
   Open PCS Pro → `Tools > Configuration > Scoreboard tab`:
   - **Output folder:** `Z:\` (the mapped Samba share root)
   - **Output filename:** `current.json`
   - **Template:** `willow-overlay.template`
   - **Update frequency:** every ball (default)

4. **Test once before match day.**
   Score a fictitious ball. On the Pi, watch:
   ```bash
   journalctl -u score-engine -f | grep pcs-pro
   ```
   You should see a `pcs-pro event applied` log line within a second.

## The template

[`willow-overlay.template`](./willow-overlay.template) emits JSON in the shape our `PcsProSnapshot` type expects (see [`packages/score-engine/src/adapters/pcs-pro-file.ts`](../packages/score-engine/src/adapters/pcs-pro-file.ts)).

> ⚠️ **PCS Pro field names are not finalised in this stub.** PCS Pro's template syntax uses `{{fieldname}}` placeholders. The exact field names come from PCS Pro's own variable list — visible inside the configuration screen on the scorer's laptop. Phase 3 of the build plan includes "verify each placeholder resolves correctly" as an explicit exit criterion. Until that's done, treat this template as a draft.

## Switching sources mid-match

The score-engine runs both adapters simultaneously. You can flip from PWA → PCS Pro (or vice versa) by simply starting/stopping which one is producing events. Both adapters write into the same MatchState through the same idempotent store — there is no "switch" to flip.

## Why not the Play-Cricket REST API?

The ECB explicitly states the REST API is **not for real-time use** ("only able to support low-traffic data transfers such as consuming match results after play has finished, or syncing competitions overnight"). Polling it ball-by-ball would breach fair-use terms and the latency would be unusable. We use the *local* PCS Pro file feed for live data and reserve the REST API for adjacent features (fixture sync, post-match scorecards) — see Phase 6 of the build plan.
