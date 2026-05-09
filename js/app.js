import { state } from "./state.js";
import { MS_PER_DAY } from "./kepler.js";
import { initRender, resizeCanvas, draw, updatePulses, addPulse } from "./render.js";
import {
  updatePlanetCache,
  advanceProbes,
  advanceUfos,
  advanceComets,
  processReader,
  spawnComet,
} from "./sim.js";
import { processGates } from "./gates.js";
import { initUi, getDom, renderSelectedPanel, renderLists, updateHud, logEvent, processAutoLaunches } from "./ui.js";

const canvas = document.getElementById("space");
initRender(canvas);
resizeCanvas();
initUi(canvas);
updatePlanetCache();
renderLists();
logEvent("Instrument ready");

state.nextCometAt = performance.now() + 8000;

function scheduleNextComet(now) {
  state.nextCometAt = now + 30000 + Math.random() * 60000;
}

function tick(now) {
  const elapsed = Math.min(0.08, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  let deltaDays = 0;
  if (state.running) {
    deltaDays = elapsed * state.speedDaysPerSecond;
    state.simDate = new Date(state.simDate.getTime() + deltaDays * MS_PER_DAY);
  }

  updatePlanetCache();
  if (state.running) {
    const dom = getDom();
    if (now > state.nextCometAt) {
      spawnComet(logEvent);
      scheduleNextComet(now);
      renderLists();
    }
    advanceProbes(deltaDays, dom, addPulse, logEvent);
    advanceUfos(deltaDays, dom, addPulse, logEvent);
    advanceComets(deltaDays, addPulse, logEvent);
    state.comets = state.comets.filter((c) => c.status !== "gone");
    processAutoLaunches(now);
  }
  processReader(addPulse);
  processGates(addPulse, logEvent);
  updatePulses(elapsed);

  if (now - state.lastUiUpdate > 180) {
    renderSelectedPanel();
    updateHud();
    state.lastUiUpdate = now;
  }
  draw();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
