// apps/client/public/js/simToggle.js
import { getState, start, pause, resume, stop, setSpeed, openUiWs } from './simApi.js';

/**
 * Mounts a single toggle button and an optional small stop element.
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement} statusEl
 * @param {HTMLElement[]} speedButtons elements with data-speed="2" etc.
 */
export async function mountSimToggle(btn, statusEl, speedButtons = []) {
  let state = 'idle';
  let tick = 0;
  let speed = 1;

  const stopEl = document.querySelector('[data-sim-stop]');

  function labelFor(s) {
    if (s === 'running') return 'Pause';
    if (s === 'paused') return 'Resume';
    return 'Start';
  }
  function render() {
    btn.textContent = labelFor(state);
    if (stopEl) stopEl.style.display = (state === 'running' || state === 'paused') ? '' : 'none';
    if (statusEl) statusEl.textContent = `State: ${state} | Tick: ${tick} | Speed: ${speed}x`;
  }
  async function refresh() {
    try {
      const s = await getState();
      state = s.state; tick = s.tick; speed = s.speed;
    } catch {}
    render();
  }

  btn.addEventListener('click', async () => {
    if (state === 'idle') await start(speed);
    else if (state === 'running') await pause();
    else if (state === 'paused') await resume();
    await refresh();
  });

  if (stopEl) stopEl.addEventListener('click', async () => {
    await stop();
    await refresh();
  });

  speedButtons.forEach(el => {
    el.addEventListener('click', async () => {
      const v = Number(el.dataset.speed);
      if (Number.isFinite(v) && v > 0) {
        await setSpeed(v);
        speed = v; // optimistic
        render();
      }
    });
  });

  // WS telemetry (optional)
  openUiWs((evt) => {
    if (evt?.type === 'sim.tickCompleted') {
      tick = evt.payload?.tick ?? tick;
      render();
    }
  });

  await refresh();
}
