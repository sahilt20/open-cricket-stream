/**
 * Polls the score-engine for state and updates the DOM.
 *
 * Two modes:
 *   1. Browser dev mode — fetch /api/state from the score-engine.
 *   2. Puppeteer render mode — the engine injects window.__matchState before
 *      taking the screenshot. We just read from there and skip polling.
 */
const POLL_MS = 1_000;
const ENGINE_URL = window.__OCS_ENGINE_URL ?? '';

async function loadState() {
  if (window.__matchState) return window.__matchState;
  const res = await fetch(`${ENGINE_URL}/api/state`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`engine returned ${res.status}`);
  return res.json();
}

function fmtBall(b) {
  if (b.wicket) return 'W';
  const k = b.extras?.kind;
  if (k === 'wide') return 'wd';
  if (k === 'noBall') return 'nb';
  if (k === 'bye') return 'b';
  if (k === 'legBye') return 'lb';
  if (b.batterRuns === 0) return '·';
  return String(b.batterRuns);
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function render(state) {
  if (!state) return;
  const innings = state.innings?.[state.currentInningsIndex];
  if (!innings) return;

  const battingTeam =
    innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;

  set('batting-team', battingTeam.shortName);
  set('format', state.format);
  set('runs', innings.totalRuns);
  set('wickets', innings.wickets);
  set('overs', `${innings.oversDisplay} ov`);
  set('rr', innings.runRate.toFixed(2));

  const rrrWrap = document.querySelector('.rrr-wrap');
  if (innings.requiredRunRate !== undefined) {
    rrrWrap?.removeAttribute('hidden');
    set('rrr', innings.requiredRunRate.toFixed(2));
  } else {
    rrrWrap?.setAttribute('hidden', 'true');
  }

  const s = innings.currentBatters?.striker;
  const ns = innings.currentBatters?.nonStriker;
  if (s) {
    set('striker-name', `${s.player.name}*`);
    set('striker-line', `${s.runs} (${s.balls})`);
  }
  if (ns) {
    set('non-striker-name', ns.player.name);
    set('non-striker-line', `${ns.runs} (${ns.balls})`);
  }

  const b = innings.currentBowler;
  if (b) {
    set('bowler-name', b.player.name);
    set(
      'bowler-line',
      `${Math.floor(b.ballsBowled / 6)}.${b.ballsBowled % 6}-${b.maidens}-${b.runsConceded}-${b.wickets}`,
    );
  }

  set('recent-balls', innings.recentBalls.slice(-6).map(fmtBall).join(' ') || '—');
}

async function loop() {
  try {
    const state = await loadState();
    render(state);
  } catch (err) {
    console.warn('[overlay] state fetch failed', err);
  }
  if (!window.__matchState) setTimeout(loop, POLL_MS);
}

loop();
