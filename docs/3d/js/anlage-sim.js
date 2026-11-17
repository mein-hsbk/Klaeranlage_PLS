// Laufende Anlagensimulation (Faulung/Gas + Belüftung): Zustand, Zeitraffer, Protokoll.
// Wird von der 3D-Szene (Instrumente), der Leitwarte und den Missionen gemeinsam genutzt.
import { createState, run as runFaul, step as stepFaul, fmtZeit, tag } from './faulung-modell.js';
import { setupBel, stepBel } from './belueftung-modell.js';

export const sim = {
  S: createState('S0'),     // Faulung/Gas
  B: setupBel('B0'),        // Belüftung
  speed: 60,                // Simulationssekunden je Echtzeitsekunde
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
  sim.log.push({ real: stamp(), sim: `T${tag(sim.S.t)} ${fmtZeit(sim.S.t)}`, art, text, ts: sim.S.t, tr: performance.now() - sim.t0real });
  for (const f of sim.listeners) f();
}
export const logA = (text, art = 'aktion') => push(text, art);
export const logSys = (text, art = 'sys') => push(text, art);
export function logText() {
  return ['Echtzeit\tSimzeit\tArt\tEreignis', ...sim.log.map((l) => `${l.real}\t${l.sim}\t${l.art}\t${l.text}`)].join('\n');
}

// Faulung mit 12 h Vorgeschichte für die Trends
function setupFaul(sz) {
  const S = createState(sz);
  const s2 = sz === 'S2', pre = createState(s2 ? 'S2' : 'S0');
  pre.t = -4 * 3600; pre.histNext = pre.t;
  if (s2) { pre.T_ft = 37.5; pre.ch4 = 62; }
  runFaul(pre, 12 * 3600);
  S.hist = pre.hist.filter((h) => h.t < S.t);
  if (s2) Object.assign(S, { T_ft: pre.T_ft, ch4: pre.ch4, V: pre.V, tVL: pre.tVL, tRL: pre.tRL });
  return S;
}

// gemeinsamer Zeitschritt: Gebläseleistung geht in den Eigenbedarf der Faulungsbilanz ein
function stepAll(dt) {
  stepBel(sim.B, dt, logSys);
  sim.S.pGeb = sim.B.pkw;
  stepFaul(sim.S, dt, logSys);
}
function run(dt) { let r = dt; while (r > 0) { const d = Math.min(30, r); stepAll(d); r -= d; } }

export function startSzenario({ faul = 'S0', bel = 'B0', speed, titel } = {}) {
  sim.S = setupFaul(faul); sim.B = setupBel(bel);
  sim.B.t = sim.S.t;
  sim.speed = speed ?? sim.speed; sim.log.length = 0; sim.t0real = performance.now();
  logSys(`Start ${titel || `Szenario ${faul}/${bel}`} · Zeitraffer ×${sim.speed}`);
  run(1);
  if (sim.S.alarme.heiz) sim.S.alarme.heiz.kommt = -4 * 3600;
  for (const f of sim.listeners) f();
}

export function simTick(dtReal) { if (!sim.paused) run(Math.min(1, dtReal) * sim.speed); }

startSzenario({ titel: 'Normalbetrieb' });
