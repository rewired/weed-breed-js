// apps/client/src/lib/simToggle.js
// Vanilla single-toggle mount helper for non-React pages/sections.

import { getState, start, pause, resume, stop, setSpeed, openUiWs } from './simApi.js';

/**
 * Mounts a single toggle button and optional stop element & speed buttons.
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement} statusEl
 * @param {HTMLElement[]} speedButtons elements with data-speed="2" etc.
 */
export async function mountSimToggle(btn, statusEl, speedButtons = []) {
  let state = 'idle';
  let tick = 0;
  let speed = 1;

  const stopEl = document.querySelector('[data-sim-stop]');

  const labelFor = (s) => (s === 'running' ? 'Pause' : s === 'paused' ? 'Resume' : 'Start');

  function render() {
    if (btn) btn.textContent = labelFor(state);
    if (stopEl) stopEl.style.display = (state === 'running' || state === 'paused') ? '' : 'none';
    if (statusEl) statusEl.textContent = `State: ${state} | Tick: ${tick} | Speed: ${speed}x`;
  }

  async function refresh() {
    try {
      const s = await getState();
      state = s.state ?? 'idle';
      tick  = s.tick ?? 0;
      speed = s.speed ?? 1;
    } catch {}
    render();
  }

  btn?.addEventListener('click', async () => {
    if (state === 'idle')       await start(speed);
    else if (state === 'running') await pause();
    else if (state === 'paused')  await resume();
    await refresh();
  });

  stopEl?.addEventListener('click', async (e) => { e.preventDefault(); await stop(); await refresh(); });

  speedButtons.forEach((el) => {
    el.addEventListener('click', async () => {
      const v = Number(el.dataset.speed);
      if (Number.isFinite(v) && v > 0) {
        await setSpeed(v);
        speed = v; // optimistic
        render();
      }
    });
  });

  // WS tick telemetry
  openUiWs((evt) => {
    const last = Array.isArray(evt) ? evt[evt.length - 1] : evt;
    if (last?.type === 'sim.tickCompleted') {
      const t = last?.payload?.tick;
      if (Number.isFinite(t)) {
        tick = t;
        render();
      }
    }
  });

  await refresh();
}
