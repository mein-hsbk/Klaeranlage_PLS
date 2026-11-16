// Laufende Simulation Faulung/Gas: Zustand, Zeitraffer, Protokoll.
// Wird von der 3D-Szene (Instrumente) und der Oberfläche (Leitwarte, Protokoll) gemeinsam genutzt.
import { createState, run, fmtZeit, tag } from './faulung-modell.js';

export const sim = {
  S: createState('S0'),
  speed: 60,              // Simulationssekunden je Echtzeitsekunde
  paused: false,
  log: [],
  t0real: performance.now(),
  listeners: new Set(),
};

const stamp = () => {
  const s = Math.floor((performance.now() - sim.t0real) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
function push(text, art) {
  sim.log.push({ real: stamp(), sim: `T${tag(sim.S.t)} ${fmtZeit(sim.S.t)}`, art, text });
  for (const f of sim.listeners) f();
}
export const logA = (text, art = 'aktion') => push(text, art);
export const logSys = (text, art = 'sys') => push(text, art);

export function logText() {
  return ['Echtzeit\tSimzeit\tArt\tEreignis', ...sim.log.map((l) => `${l.real}\t${l.sim}\t${l.art}\t${l.text}`)].join('\n');
}

// Neustart mit Szenario; erzeugt 12 h Vorgeschichte für die Trends
export function startSzenario(sz, speed) {
  const S = createState(sz);
  const s2 = sz === 'S2', pre = createState(s2 ? 'S2' : 'S0');
  pre.t = -4 * 3600; pre.histNext = pre.t;
  if (s2) { pre.T_ft = 37.5; pre.ch4 = 62; }
  run(pre, 12 * 3600);
  S.hist = pre.hist.filter((h) => h.t < S.t);
  if (s2) Object.assign(S, { T_ft: pre.T_ft, ch4: pre.ch4, V: pre.V, tVL: pre.tVL, tRL: pre.tRL });
  sim.S = S; sim.speed = speed ?? sim.speed; sim.log.length = 0; sim.t0real = performance.now();
  logSys(`Start Szenario ${sz} · Zeitraffer ×${sim.speed}`);
  run(S, 1, logSys);
  if (S.alarme.heiz) S.alarme.heiz.kommt = -4 * 3600;
  for (const f of sim.listeners) f();
}

export function simTick(dtReal) {
  if (!sim.paused) run(sim.S, Math.min(1, dtReal) * sim.speed, logSys);
}

startSzenario('S0', 60);
