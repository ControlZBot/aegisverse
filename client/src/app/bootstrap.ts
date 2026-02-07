import { createRenderer, drawState } from '@client/render/scene';
import { ELEMENTS, getElementById } from '@client/elements/registry';
import { CONTROLS_TEXT } from '@client/ui/help';
import { QUICK_PRESETS } from '@client/scenes/presets';
import type { DebugState } from '@client/sim/types';

export function bootstrap(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div id="top" class="panel" role="toolbar" aria-label="Simulation controls">
      <button id="playPause">Pause</button>
      <button id="step">Step</button>
      <label>Time <select id="simSpeed"><option value="0.25">0.25x</option><option value="1" selected>1x</option><option value="2">2x</option><option value="4">4x</option></select></label>
      <label>Mode <select id="simMode"><option value="stable" selected>Stable</option><option value="advanced">Advanced</option></select></label>
      <label>Quality <select id="quality"><option>low</option><option selected>medium</option><option>high</option><option>ultra</option></select></label>
      <label>Seed <input id="seed" type="number" value="1337" /></label>
      <button id="reset">Reset</button>
      <button id="safeReset">Reset to safe state</button>
      <label>Gravity <select id="gravityMode"><option value="arcade">Arcade</option><option value="newtonian">Newtonian</option></select></label>
      <button id="export">Export JSON</button>
      <button id="copyShare">Copy share code</button>
      <input id="import" type="file" aria-label="Import world JSON" />
      <input id="shareInput" placeholder="Paste share code" aria-label="share code" />
      <button id="importShare">Import code</button>
    </div>
    <aside id="left" class="panel">
      <h3>Lab Console</h3>
      <input id="search" aria-label="Search elements" placeholder="Search" />
      <div class="label" id="elementCount">${ELEMENTS.length} elements</div>
      <div id="elements" class="list"></div>
      <h4>Quick presets</h4>
      <div id="presets">${QUICK_PRESETS.map((p) => `<button class='preset' data-preset='${p}'>${p}</button>`).join('')}</div>
      <h4>Tools</h4>
      <div class="grid-tools">
        <button id="toolBrush">Brush</button><button id="toolSpray">Spray</button><button id="toolLine">Line</button>
        <button id="toolBox">Box</button><button id="toolSphere">Sphere</button><button id="toolForce">Force</button>
        <button id="toolVortex">Vortex</button><button id="toolHeat">Heat/Cool</button><button id="toolGravity">Gravity well</button>
        <button id="toolVacuum">Vacuum</button><button id="toolWeld">Weld/Glue</button><button id="toolSelect">Select</button>
      </div>
      <h4>Effects</h4>
      <button id="toolExplosion">Explosion pulse</button>
      <button id="toolLaser">Laser sweep</button>
      <button id="toolShip">Spawn ship</button>
      <div class="label">Favorites/recent scaffold enabled</div>
    </aside>
    <main id="view"></main>
    <aside id="right" class="panel">
      <h3>Inspector</h3>
      <pre id="inspector"></pre>
      <h4>Element inspector</h4>
      <pre id="elementInspector"></pre>
      <h4>Controls</h4>
      <div class="help">${CONTROLS_TEXT}</div>
      <h4>Debug</h4>
      <label><input type="checkbox" id="dbgCollider"/> Colliders</label><br/>
      <label><input type="checkbox" id="dbgGrid"/> BVH/Grid</label><br/>
      <label><input type="checkbox" id="dbgTemp"/> Temperature map</label><br/>
      <label><input type="checkbox" id="dbgVelocity"/> Velocity vectors</label>
    </aside>
    <footer id="bottom" class="panel">
      <label>Brush size <input id="brushSize" type="range" min="1" max="50" value="8"></label>
      <label>Intensity <input id="intensity" type="range" min="1" max="100" value="30"></label>
      <label>Spawn rate <input id="spawnRate" type="range" min="1" max="300" value="80"></label>
    </footer>`;

  const view = document.getElementById('view') as HTMLElement;
  const renderer = createRenderer(view);
  const worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });

  let paused = false;
  let last = performance.now();
  let fps = 0;
  let lastStateRaw = '';
  const debug: DebugState = { colliders: false, grid: false, velocity: false, thermal: false };

  const hud = document.createElement('div');
  hud.className = 'hud';
  view.append(hud);
  const warning = document.createElement('div');
  warning.className = 'warning';
  warning.hidden = true;
  view.append(warning);

  function tick(now: number): void {
    const dt = (now - last) / 1000;
    last = now;
    fps = dt > 0 ? 1 / dt : fps;
    worker.postMessage({ type: 'tick', payload: { dt } });
    requestAnimationFrame(tick);
  }

  worker.onmessage = (event) => {
    if (event.data.type === 'state') {
      const state = event.data.payload;
      drawState(renderer, state, debug);
      hud.textContent = `FPS ${fps.toFixed(1)} | tick ${state.perf.tickMs.toFixed(2)}ms | bodies ${state.rigidBodies.length} | particles ${state.particles.length} | mode ${state.mode}`;
      (document.getElementById('inspector') as HTMLElement).textContent = JSON.stringify({ time: state.time.toFixed(2), mode: state.mode, gravity: state.gravityMode, quality: state.quality, health: state.health.status }, null, 2);
      warning.hidden = !state.warnings.length;
      warning.textContent = state.warnings[0] ?? '';
      lastStateRaw = JSON.stringify(state);
      localStorage.setItem('aegisverse.autosave', lastStateRaw);
    }
    if (event.data.type === 'export') {
      const blob = new Blob([event.data.payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aegisverse-world.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  (document.getElementById('playPause') as HTMLButtonElement).onclick = () => {
    paused = !paused;
    worker.postMessage({ type: 'pause', payload: { paused } });
  };
  (document.getElementById('step') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'tick', payload: { dt: 1 / 120 } });
  (document.getElementById('simMode') as HTMLSelectElement).onchange = (e) => worker.postMessage({ type: 'mode', payload: { mode: (e.target as HTMLSelectElement).value } });
  (document.getElementById('gravityMode') as HTMLSelectElement).onchange = (e) => worker.postMessage({ type: 'gravityMode', payload: { mode: (e.target as HTMLSelectElement).value } });
  (document.getElementById('quality') as HTMLSelectElement).onchange = (e) => worker.postMessage({ type: 'quality', payload: { quality: (e.target as HTMLSelectElement).value } });
  (document.getElementById('simSpeed') as HTMLSelectElement).onchange = (e) => worker.postMessage({ type: 'simSpeed', payload: { speed: Number((e.target as HTMLSelectElement).value) } });
  (document.getElementById('reset') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'reset', payload: { seed: Number((document.getElementById('seed') as HTMLInputElement).value) } });
  (document.getElementById('safeReset') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'reset', payload: { seed: 1337 } });
  (document.getElementById('export') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'export' });

  (document.getElementById('copyShare') as HTMLButtonElement).onclick = async () => {
    if (!lastStateRaw) return;
    const code = btoa(unescape(encodeURIComponent(lastStateRaw)));
    await navigator.clipboard.writeText(code);
    warning.hidden = false;
    warning.textContent = 'Share code copied.';
  };
  (document.getElementById('importShare') as HTMLButtonElement).onclick = () => {
    const raw = (document.getElementById('shareInput') as HTMLInputElement).value.trim();
    if (!raw) return;
    try {
      const json = decodeURIComponent(escape(atob(raw)));
      worker.postMessage({ type: 'import', payload: { json } });
    } catch {
      warning.hidden = false;
      warning.textContent = 'Invalid share code.';
    }
  };

  (document.getElementById('import') as HTMLInputElement).onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    worker.postMessage({ type: 'import', payload: { json: await file.text() } });
  };

  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.preset'))) {
    button.onclick = () => worker.postMessage({ type: 'preset', payload: { preset: button.dataset.preset } });
  }

  (document.getElementById('toolExplosion') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'explosion', payload: { x: 0, y: 0, z: 0, power: Number((document.getElementById('intensity') as HTMLInputElement).value) } });
  (document.getElementById('toolLaser') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'laser', payload: { ox: -12, oy: 1, oz: 0, dx: 1, dy: 0.02, dz: 0, heat: Number((document.getElementById('intensity') as HTMLInputElement).value) * 2 } });
  (document.getElementById('toolShip') as HTMLButtonElement).onclick = () => worker.postMessage({ type: 'ship' });

  (document.getElementById('dbgCollider') as HTMLInputElement).onchange = (e) => { debug.colliders = (e.target as HTMLInputElement).checked; };
  (document.getElementById('dbgGrid') as HTMLInputElement).onchange = (e) => { debug.grid = (e.target as HTMLInputElement).checked; };
  (document.getElementById('dbgTemp') as HTMLInputElement).onchange = (e) => { debug.thermal = (e.target as HTMLInputElement).checked; };
  (document.getElementById('dbgVelocity') as HTMLInputElement).onchange = (e) => { debug.velocity = (e.target as HTMLInputElement).checked; };

  window.addEventListener('keydown', (ev) => {
    const key = ev.key.toLowerCase();
    if (ev.code === 'Space') worker.postMessage({ type: 'pause', payload: { paused: (paused = !paused) } });
    if (key === 'r') worker.postMessage({ type: 'reset', payload: { seed: 1337 } });
    if (key === 't') debug.thermal = !debug.thermal;
    if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'q' || key === 'e') {
      worker.postMessage({ type: 'shipControl', payload: { thrust: key === 'w' ? 1 : key === 's' ? -1 : 0, roll: key === 'a' ? -1 : key === 'd' ? 1 : 0, boost: ev.shiftKey } });
    }
  });

  const elementHost = document.getElementById('elements') as HTMLElement;
  function renderElements(filter = ''): void {
    const list = ELEMENTS.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 180);
    elementHost.innerHTML = list.map((e) => `<button data-el='${e.id}' title='${e.description}' style='border-left:3px solid ${e.color}'>${e.name}</button>`).join('');
    for (const button of Array.from(elementHost.querySelectorAll<HTMLButtonElement>('button'))) {
      button.onclick = () => {
        const spec = getElementById(Number(button.dataset.el));
        (document.getElementById('elementInspector') as HTMLElement).textContent = JSON.stringify({
          id: spec.id,
          name: spec.name,
          category: spec.category,
          phase: spec.defaultPhase,
          density: spec.density,
          melt: spec.meltingPoint,
          boil: spec.boilingPoint,
          tags: spec.tags
        }, null, 2);
      };
    }
  }
  renderElements();
  (document.getElementById('search') as HTMLInputElement).oninput = (e) => renderElements((e.target as HTMLInputElement).value);

  const autosaved = localStorage.getItem('aegisverse.autosave');
  if (autosaved) worker.postMessage({ type: 'import', payload: { json: autosaved } });

  requestAnimationFrame(tick);
}
