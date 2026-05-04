# overlay-templates

Self-contained HTML pages used to render the live scoreboard overlay. The score-engine serves them at `/overlay/<template-name>` and FFmpeg either composites the page directly (via a Chromium headless screenshot pipeline) or, simpler for v0, the page is open in a browser source on a control laptop.

Each template is a single folder with `index.html` and any assets. No build step — they're plain HTML/CSS/JS so they work both inside Puppeteer (Phase 2 PNG render) and as an OBS browser source if the rig is run in Path B (mini PC + OBS) mode.

## Available templates

- `default/` — minimalist green-and-gold scoreboard, optimised for 1080p output, score docked bottom-left.

## Adding a template

1. Copy `default/` to `your-name/`.
2. Edit `index.html`. Read state from `window.__matchState` or `fetch('/api/state')`.
3. Make sure the page is fully transparent except for the scoreboard chrome — FFmpeg composites it over the video, so any opaque pixels become a permanent block on the broadcast.
4. Restart the score-engine; new templates are auto-discovered.

## Rendering pipeline (Phase 2)

```
state.changed (in score-engine) ──► debounce 200ms ──► Puppeteer screenshot
                                                            │
                                                            ▼
                                                    overlay-out/overlay.png
                                                            │
                                                            ▼
                                                    FFmpeg overlay filter
                                                            │
                                                            ▼
                                                    YouTube live stream
```
