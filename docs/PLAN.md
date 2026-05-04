# Open-Source FrogBox Replacement — Build Plan

**Goal:** Build a portable, fixed-cost, open-source live cricket streaming + scoring rig that broadcasts to YouTube using a smartphone as the camera, a Raspberry Pi as the production hub, and **a choice of scoring sources** — either our own open-source PWA or the ECB's existing Play-Cricket Scorer Pro (PCS Pro) software via its local scoreboard feed. One-time hardware spend, zero recurring SaaS fees.

**Target user:** Club-level cricket (Willow C.C. context) — not broadcast TV. The bar is "watchable on a phone, with a usable scoreboard overlay, reliably for a 6-hour match."

---

## 1. What FrogBox actually does (so we know what to replicate)

FrogBox bundles four things into one box:

1. **Camera ingest** — takes one or two video sources.
2. **Live graphics overlay** — score, batter names, over count, run-rate.
3. **Encoder** — H.264/H.265 to RTMP.
4. **Streaming + scoring app** — scorer's tablet talks to the box, score updates push into the overlay, stream goes to YouTube/Facebook.

Our open-source equivalent splits these into three nodes (phone, Pi, scorer's device) connected over a local network. That separation is *good* — it means each part can fail independently without bricking the rest.

---

## 2. Scoring source — two supported options (key design decision)

The rig supports **two interchangeable scoring sources**, both feeding the same internal overlay engine. The scorer (or club) picks per match.

### Option 1 — Our open-source PWA scoring app
Custom PWA, runs on phone/tablet, talks to the Pi over WebSocket. Fully ours, fully free, ball-by-ball latency under 1 second.

### Option 2 — Play-Cricket Scorer Pro (PCS Pro) integration
PCS Pro is the ECB's official free scoring software for recreational cricket, used by 400+ clubs already streaming. It exposes a **Custom Scoreboard Integration** feature — every ball, it writes a JSON/XML file to a local or network folder using a configurable template. We just point it at a network share hosted on the Pi.

**Why this is a big deal for Willow C.C.:**
- Our scorers already know PCS Pro; zero retraining.
- Match data automatically flows to Play-Cricket (single source of truth — no double entry).
- League fixtures, squads, and scoring rules pre-load from Play-Cricket on match day.
- Compatible with the same mechanism as commercial LED scoreboards already use.
- League/club admin scorecard validation workflow stays intact.

**Constraint:** PCS Pro is Windows-only (runs on Mac via Parallels). So Option 2 requires the home scorer to bring a Windows laptop. Option 1 doesn't.

**Important — what about the Play-Cricket REST API?** It exists, but the ECB explicitly states it's *not* for real-time use ("only able to support low-traffic data transfers such as consuming match results after play has finished, or syncing competitions overnight"). Polling it ball-by-ball would breach their fair-use terms and the latency would be unusable anyway. Option 2 uses the *local* PCS Pro feed (low-latency, designed for exactly this), not the REST API.

We can still use the Play-Cricket REST API for *adjacent* features — pulling fixture lists, squads, post-match scorecards into the rig's web dashboard — just not for live overlay data.

---

## 3. Architecture

```
 ┌──────────────────┐                    ┌──────────────────────────────┐
 │ Phone (camera)   │   SRT/RTMP push    │  Raspberry Pi 5              │
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

**Why this shape**

- The Pi is the *only* thing talking to YouTube. Scorer disconnects? Stream keeps running with last-known score. Phone wobbles for 5 seconds? SRT recovers without YouTube noticing.
- Local network only — no cloud relay = no recurring cost, no extra latency, no extra failure point.
- Pi runs in **AP (access point) mode**, so the phone and scorer connect *to the Pi*, not to the ground's nonexistent Wi-Fi. This is the single biggest reliability decision in the whole design.
- **Source-agnostic core.** The overlay renderer doesn't know or care whether the score came from our PWA or from PCS Pro — both adapters write into the same normalised match-state schema. Either source can be swapped mid-season without re-engineering the rig.

---

## 4. Hardware bill of materials (one-time spend, UK pricing)

| Item | Purpose | Cost (£) |
|---|---|---|
| Raspberry Pi 5 (8 GB) | Production hub | 80 |
| Active cooler / case | Pi 5 throttles hard without cooling | 15 |
| 27W USB-C PSU (official) | Stable power | 12 |
| 64 GB A2 microSD (SanDisk Extreme) | OS + match recordings | 12 |
| USB 4G/5G modem **or** mobile hotspot | Internet uplink at the ground | 30–60 |
| Decent 4G SIM (one-off PAYG data) | Uplink data | varies |
| Phone tripod + heavy-duty clamp | Camera mounting | 25 |
| Power bank (20,000 mAh, USB-C PD) | Phone power for 6+ hours | 35 |
| Pi power bank (20,000 mAh, 5V/3A min) | Pi power if no mains | 30 |
| Short Cat6 cable + USB-Ethernet adapter (optional) | Wired uplink to hotspot for stability | 10 |
| Weatherproof box / Peli-style case | Rain, it's English cricket | 30–50 |
| **Total fixed cost** | | **~£280–340** |

**Things you do *not* need to buy:**
- Capture card — phone streams over IP, no HDMI in the chain.
- Dedicated camera — modern phone cameras (1080p30) match what FrogBox actually outputs.
- Cloud encoder — the Pi handles it.

**Phone:** any iPhone from XR onwards or any Android with a decent rear camera (Pixel 6+, Galaxy S20+, etc.). Use the team's existing phone or a cheap second-hand one dedicated to the rig.

---

## 5. Software stack (all FOSS / free)

### 5.1 On the phone (camera)
- **Larix Broadcaster** (free, iOS + Android) — pushes SRT or RTMP. SRT is strongly preferred over Wi-Fi because it tolerates packet loss; RTMP doesn't.
- Lock to 1080p @ 30 fps, ~4 Mbps, H.264 baseline. YouTube doesn't need more for cricket and your uplink will thank you.

### 5.2 On the Raspberry Pi
- **OS:** Raspberry Pi OS Lite (64-bit, Bookworm). No desktop — saves RAM and boot time.
- **MediaMTX** (formerly rtsp-simple-server) — ingest server. Speaks SRT, RTMP, WebRTC, RTSP. One binary, written in Go, ~30 MB RAM.
- **FFmpeg** — composites video + HTML overlay, re-encodes, pushes to YouTube. Use the V4L2 / `h264_v4l2m2m` hardware encoder on Pi 5 to keep CPU under 50%.
- **Chromium headless** — renders the score overlay HTML to a frame buffer that FFmpeg picks up. Or simpler: render overlay as a transparent PNG that's regenerated whenever the score changes (less CPU, no Chromium needed).
- **Node.js + Express + Socket.io** — scoring backend. Implements both source adapters:
  - **WebSocket adapter** for our PWA (Option 1).
  - **File-watcher adapter** using `chokidar` watching the SMB share that PCS Pro writes to (Option 2).
  - Both adapters parse incoming events into a single normalised `MatchState` object before anything else looks at them.
- **Samba (smbd)** — exposes a network share `\\<pi-ip>\score-in\` so PCS Pro on the scorer's laptop can write its template output directly to the Pi.
- **SQLite** — match state. No Postgres needed for this scale.
- **Caddy** — reverse proxy, automatic HTTPS for the local scoring app on the AP.
- **hostapd + dnsmasq** — turns the Pi into a Wi-Fi access point.
- **systemd** — supervises everything. Each service in its own unit, with `Restart=always`.

### 5.3 Scoring app — Source Option 1 (our PWA)
- **PWA** (Progressive Web App) — installable, works offline, single codebase for iOS + Android + laptop.
- **Stack:** React + Vite + Tailwind, or Svelte if you want it lighter. Connects to the Pi over WebSocket.
- **Cricket-specific UI:** ball-by-ball entry, undo, wides/no-balls/byes/leg-byes, wicket modal, batter-on-strike toggle, over completion auto-rotate. Steal the UX patterns from Play-Cricket's own scoring app — you've used it, you know what works.
- **Offline buffer:** if WebSocket drops, queue events locally and replay on reconnect.

### 5.4 Scoring app — Source Option 2 (PCS Pro)
- Scorer runs **PCS Pro** on a Windows laptop as normal.
- One-time setup on the laptop: in `Tools > Configuration > Scoreboard tab`, point the output to `\\<pi-ip>\score-in\` and select our custom template file (we ship a `willow-overlay.template` that emits exactly the JSON shape our file-watcher adapter expects).
- The template uses the `{{fieldname}}` placeholder syntax PCS Pro supports — every ball, PCS Pro re-writes the JSON file with current state.
- Our file-watcher on the Pi sees the change, parses, and updates the overlay.
- **Bonus:** because PCS Pro is also live-uploading to Play-Cricket, the match centre on play-cricket.com stays in sync automatically. Single source, two destinations.

### 5.5 Streaming pipeline (the FFmpeg command, conceptually)
```
[SRT in from phone] ──► decode ──► overlay filter (HTML/PNG) ──► h264_v4l2m2m encode ──► RTMPS to YouTube
```
The overlay updates by re-reading the PNG file (or HTML render output) every ~1 second — fast enough for cricket, slow enough to stay cheap on CPU.

---

## 6. Build phases (suggested 8-week part-time plan)

**Phase 1 — Bench prototype (week 1–2)**
- Image Pi, install MediaMTX, get phone pushing SRT to it, view the stream on VLC.
- Get FFmpeg pulling from MediaMTX and pushing to a test YouTube stream key. End-to-end pipeline working without overlay.
- *Exit criterion:* you can watch yourself on YouTube from the phone, end-to-end on home Wi-Fi.

**Phase 2 — Overlay (week 3)**
- Build a static HTML scoreboard. Render it to PNG with a tiny script. Wire FFmpeg's `overlay` filter.
- *Exit criterion:* hardcoded score appears bottom-left of the YouTube stream.

**Phase 3 — Score Engine + dual source adapters (week 4–5)**
- Node + SQLite + Socket.io backend. Define the canonical `MatchState` schema (innings, overs, balls, batters, bowlers).
- **Adapter A (PWA / Option 1):** WebSocket endpoint. Build the React PWA with the ball-by-ball UI on top.
- **Adapter B (PCS Pro / Option 2):** Set up Samba share on the Pi. Write a `willow-overlay.template` for PCS Pro. Add a `chokidar`-based file watcher in the backend that parses the JSON output and fires the same internal events as Adapter A.
- Both adapters write into the same `MatchState` → same overlay PNG regenerator. Test by switching between them mid-session.
- *Exit criterion:* tap "4 runs" on the PWA → overlay updates within 2 seconds. Score the same ball in PCS Pro → overlay updates within 2 seconds. The compositor doesn't know or care which source it was.

**Phase 4 — Field hardening (week 6)**
- Pi as Wi-Fi AP. 4G uplink via USB modem or tethered hotspot.
- Auto-start everything on boot via systemd. Watchdog scripts that restart FFmpeg if the YouTube push dies.
- Local recording fallback — FFmpeg also writes a local MP4 in case the upload fails entirely. You still have the match.
- Add a "select source" toggle on the rig's local web dashboard so the operator picks Option 1 or Option 2 before going live.
- *Exit criterion:* unplug everything, drive to the ground, plug it in, stream comes up with one button.

**Phase 5 — Real match trial (week 7)**
- Pre-season friendly or net session. Run the full rig. Note every failure, even small ones.
- If possible, run **both source paths back-to-back in the same session** to confirm they produce identical overlay output.

**Phase 6 — Polish (week 8)**
- Sponsor logos in overlay (useful for club kit sponsors). Pre/post-match graphics. A "scorer's view" page for the captain.
- Optional: pull fixture list from the Play-Cricket REST API into the rig dashboard so the operator can pick "today's match" with one tap (this is exactly the use case the REST API *is* fit for).

---

## 7. Reliability engineering — the boring stuff that actually matters

This is where most DIY rigs die. Get this right and the rest is easy.

- **Power:** two power banks, both rated for the full match length plus 2 hours. Cricket runs over.
- **Heat:** Pi 5 + active cooler + don't put it in direct sun. Test with the lid closed in summer.
- **Network:** Pi as AP means phone and scorer never lose connection to the rig even if 4G drops. Stream to YouTube will pause; local recording continues; it resumes when 4G's back.
- **SRT not RTMP** for the phone-to-Pi leg. SRT is built for lossy networks; RTMP isn't.
- **Local MP4 recording always on.** Belt and braces. If YouTube fails entirely, you still upload a VOD afterwards.
- **One-button start.** A physical button on the Pi (GPIO) or a single "GO LIVE" tile on the scorer's PWA that triggers the whole pipeline. The person setting up should not need a terminal.
- **Status LEDs / web dashboard** showing: ingest OK, encoder OK, YouTube push OK, scorer connected. Anyone can glance at it and know what's broken.
- **Pre-flight checklist** built into the PWA: "stream key set? SD card has space? YouTube event scheduled? overlay loaded?" — green ticks before the GO LIVE button activates.

---

## 8. Alternatives worth considering

| Option | Pros | Cons | When to pick it |
|---|---|---|---|
| **Pi 5 + phone (this plan)** | Truly fixed cost, fully open, hackable, ~£300 | You build it. ~8 weeks of evening work. | You want to own the stack and the cost. |
| **Mini PC (Beelink / Minisforum N100)** instead of Pi | x86, runs OBS natively, more headroom | £180 vs £80, slightly less portable, more power draw | If overlay rendering or 1080p60 becomes a problem on Pi. |
| **Phone-only with RTMP app + cloud overlay** (e.g. Streamlabs free tier) | Zero hardware besides phone | Cloud service = dependency, free tier limits, watermarks | Throwaway use; not for a club season. |
| **OBS on a laptop at the ground** | Most flexible, well-documented | Laptop battery, not weather-tolerant, not "portable rig" feel | If a club volunteer already brings a laptop. |
| **NV Play Live Streaming for PCS Pro** | Official ECB partner solution, professional overlays, integrated with Play-Cricket | £500/season recurring + camera kit, exactly what you're trying to avoid | If the club ever flips on this and decides volunteer engineering time is more expensive than £500/year. |
| **Commercial: Mevo Start / LiveU Solo** | Just works | £400–£1,500+ and often paired with subscription apps | If budget exists and time doesn't. |
| **Ground-share streaming with another club** | Zero cost to you | Not your stream, not your data | Short-term while you build. |

**Honest assessment:** if your time is worth more than ~£40/hr and you have it to spare, a Beelink mini PC running OBS Studio + a cricket-scoring overlay browser source is the *fastest* path to "working" — it skips the AP setup, the FFmpeg tuning, and the hardware encoder fiddliness. The Pi route is the right answer if (a) you want it as a club-asset/learning project, (b) you genuinely value the open-source angle, or (c) you want to publish it and let other clubs reuse it.

---

## 9. Risks and how to handle them

- **No mobile signal at the ground.** Scout the location *before* the first match. If 4G is genuinely dead, the rig records locally and uploads as a VOD post-match — make sure that fallback is tested, not just assumed.
- **Scorer enters wrong ball.** Undo button must be one tap, must work offline, must propagate to the overlay within 1 second.
- **Pi SD card corruption.** Use industrial-grade A2 cards, mount root as read-only where possible, write match data to a separate partition.
- **YouTube stream key leak.** Store in a `.env` file with restrictive perms. Rotate after a known-bad volunteer leaves the key chain.
- **GDPR / image rights.** Players (especially juniors) need to consent to being live-streamed. As Club Secretary you'll already be tracking this — bake it into the registration form for next season.
- **ECB Safeguarding for junior matches.** Streaming junior cricket has specific ECB guidance — check Willow's affiliation paperwork before livestreaming any U-section game.

---

## 10. Recommended first decision

Two decisions, in order, before writing any code:

**Decision 1 — Hardware path:**
- **Path A — Pi-native FOSS rig (this plan as written):** £300 hardware, ~8 weeks part-time build, 100% yours, publishable as open source for other Warwickshire clubs.
- **Path B — Mini PC + OBS rig:** £200–250 hardware, ~2 weekends to set up, less novel but proven.

**Decision 2 — Which scoring source(s) to support at launch:**
- **Just Option 1 (PWA only):** simpler v1, fully ours, but Willow's existing scorers have to learn the new app.
- **Just Option 2 (PCS Pro only):** zero retraining, automatic Play-Cricket sync, but requires a Windows laptop in the rig every match.
- **Both (recommended):** the Score Engine is built source-agnostic from day one. Adapter B (PCS Pro) is genuinely about a week of work on top of Adapter A. Strongly worth the small extra effort — it future-proofs the rig and means Willow can use whichever scorer turns up on the day.

Both hardware paths meet "fixed cost, no recurring fees." Path A is the more interesting engineering project; Path B is the more pragmatic season-opener. Either one supports the dual-source design.

---

## 11. Next concrete steps

1. Pick Path A or Path B (hardware).
2. Confirm dual-source design (recommended) or single-source for v1.
3. Order hardware (Pi 5 kit or Beelink, plus tripod + power banks regardless).
4. Pick a domain for the scoring app (e.g. `score.willowcc.local` if AP-only, or a real domain if you want remote scorers).
5. Set up a GitHub repo — `willowcc/openfrog` or similar — with the architecture diagram and this plan as the README.
6. Apply for a Play-Cricket API key via the ECB helpdesk (you'll need it for fixture sync in Phase 6, and the agreement takes a few weeks).
7. Phase 1 prototype on the home network before anything else.
