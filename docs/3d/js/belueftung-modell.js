// Prozessmodell Belüftung: zwei Belebungsstraßen mit eigener O₂-Regelung (QIC 301 / QIC 311,
// PI-Regler → Luftmenge je Straße), Drehkolbengebläse G1.1 mit FU, Luftregelklappen FV 301 / FV 311
// nach dem „Most-Open-Valve“-Prinzip. Kennwerte wie im Kläranlagen-PLS (klaeranlage_pls.py):
// Gebläse max. 5.200 Nm³/h bei 50 Hz, min. 25 %, 25,2 Wh/Nm³; Nitrifikation nach Monod (NIT).
// Zeitbasis: Sekunden Simulationszeit.

export const PB = {
  L_MAX: 5200, L_MIN: 1300, WH_NM3: 25.2, T: 14,
  OUR0: 27.8,          // mittlere Sauerstoffzehrung je Straße (Nitrifikationszone) [mg/(L·h)]
  L0: 1653,            // Luftmenge je Straße bei O₂ = 2 mg/L und mittlerer Last [Nm³/h]
  P_GRUND: 92,         // elektrischer Eigenbedarf der übrigen Anlage (ohne Gebläse) [kW]
};
const cs = () => 14.65 - 0.41 * PB.T + 0.0079 * PB.T * PB.T;          // O₂-Sättigung [mg/L]
const CA = PB.OUR0 / (PB.L0 * (cs() - 2.0));                            // kLa je Nm³/h [1/h]
const NIT = { MU: 0.47, TH: 1.103, B: 0.05, KN: 1.0, KO: 0.5, T_AER: 9.0 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, z, tau, dt) => x + (z - x) * (1 - Math.exp(-dt / tau));

export const STR = [
  { name: 'Straße 1', qic: 'QIC 301', qi: 'QI 301', fv: 'FV 301', fi: 'FI 301' },
  { name: 'Straße 2', qic: 'QIC 311', qi: 'QI 311', fv: 'FV 311', fi: 'FI 311' },
];

function nh4Stat(o2) {
  const T = PB.T, mu = NIT.MU * NIT.TH ** (T - 15) * o2 / (NIT.KO + o2), b = NIT.B * 1.04 ** (T - 15), g = NIT.T_AER * (mu - b);
  return g <= 1 ? 25 : Math.min(25, NIT.KN * (1 + b * NIT.T_AER) / (g - 1));
}
const last = (t) => 1 + 0.25 * Math.sin(2 * Math.PI * (((t / 3600) % 24) - 8) / 24);   // Tagesgang Sauerstoffzehrung

export function createBel(sz = 'B0') {
  const lane = () => ({ o2: 2.0, meas: 2.0, f: 1.0, cal: 1.0, out: false, clean: true, L: PB.L0, integ: PB.L0, klappe: 88,
    ctrl: { auto: true, sp: 2.0, kp: 600, tn: 0.25, hand: PB.L0 }, hand: null });
  return { sz, t: 8 * 3600, s: [lane(), lane()], Ltot: 2 * PB.L0, hz: 31.8, pkw: 83, amp: 141, pD: 490, tD: 68, pdi: 11,
    nh4: 1.0, eGeb: 0, eRef: 0, alarme: {}, hist: [], histNext: 0, g12: 'bereit' };
}

export function stepBel(b, dt, log) {
  const h = dt / 3600; b.t += dt;
  const c = cs(), ld = last(b.t);
  // Regler → Luftmengen-Sollwert je Straße
  const Lsp = b.s.map((s) => {
    const k = s.ctrl;
    if (!k.auto) { s.integ = k.hand; return clamp(k.hand, 0, PB.L_MAX); }
    const e = k.sp - s.meas;
    s.integ = clamp(s.integ + k.kp / Math.max(k.tn, 0.02) * e * h, 150, PB.L_MAX);
    return clamp(s.integ + k.kp * e, 150, PB.L_MAX);
  });
  // Gebläse: Summe begrenzen, Überschuss/Mangel anteilig verteilen
  const sum = Lsp[0] + Lsp[1];
  b.Ltot = clamp(sum, PB.L_MIN, PB.L_MAX);
  b.s.forEach((s, i) => { s.L = sum > 0 ? Lsp[i] * b.Ltot / sum : b.Ltot / 2; });
  const Lm = Math.max(b.s[0].L, b.s[1].L, 1);
  b.s.forEach((s) => { s.klappe = approach(s.klappe, clamp((b.Ltot >= PB.L_MAX * 0.995 ? 100 : 88) * s.L / Lm, 3, 100), 20, dt); });
  b.hz = 50 * b.Ltot / PB.L_MAX;
  b.pkw = b.Ltot * PB.WH_NM3 / 1000;
  b.amp = b.pkw * 1000 / (Math.sqrt(3) * 400 * 0.86);
  b.pD = approach(b.pD, 470 + 80 * (b.Ltot / PB.L_MAX) ** 2, 30, dt);
  b.tD = approach(b.tD, 58 + 22 * b.Ltot / PB.L_MAX, 600, dt);
  b.pdi = 6 + 9 * (b.Ltot / PB.L_MAX) ** 2;
  // Sauerstoffhaushalt je Straße und Messung
  let o2m = 0, Lref = 0;
  b.s.forEach((s) => {
    const our = PB.OUR0 * ld;
    s.o2 = clamp(s.o2 + (CA * s.L * (c - s.o2) - our) * h, 0, c);
    const sig = (s.out ? c : s.o2) * s.f * s.cal;
    s.meas = approach(s.meas, sig, s.f < 0.8 ? 300 : 60, dt);
    o2m += s.o2 / 2;
    Lref += our / (CA * (c - Math.min(s.ctrl.sp, c - 0.5)));
  });
  b.nh4 = approach(b.nh4, nh4Stat(o2m) * ld * ld, 2 * 3600, dt);
  b.pref = clamp(Lref, PB.L_MIN, PB.L_MAX) * PB.WH_NM3 / 1000;    // Leistung bei richtiger Messung
  b.eGeb += b.pkw * h;
  b.eRef += b.pref * h;

  const al = (key, aktiv, text, klasse) => {
    const a = b.alarme[key];
    if (aktiv && !(a && a.aktiv)) { b.alarme[key] = { aktiv: true, text, klasse, kommt: b.t }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = b.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  al('gmax', b.Ltot >= PB.L_MAX * 0.995, 'G1.1 an Maximaldrehzahl', 'W');
  b.s.forEach((s, i) => {
    al(`lo${i}`, s.meas < 1.0, `${STR[i].qi} O₂ ${STR[i].name} niedrig`, 'A');
    al(`hi${i}`, s.meas > 4.5, `${STR[i].qi} O₂ ${STR[i].name} hoch`, 'W');
  });
  al('nh4', b.nh4 > 5, 'QI 302 NH₄-N Ablauf Belebung hoch', 'A');

  if (b.t >= b.histNext) {
    b.hist.push({ t: b.t, m1: b.s[0].meas, m2: b.s[1].meas, l1: b.s[0].L, l2: b.s[1].L, p: b.pkw, nh4: b.nh4 });
    if (b.hist.length > 600) b.hist.shift();
    b.histNext = b.t + 300;
  }
}

// Szenario B1: Bewuchs auf der Membran der O₂-Sonde QI 301 (Straße 1) – die Sonde zeigt zu wenig an
export function setupBel(sz) {
  const b = createBel(sz);
  b.t = -34 * 3600; b.histNext = b.t;
  const steps = 42 * 3600 / 30;
  for (let i = 0; i < steps; i++) {
    if (sz === 'B1') { const th = b.t / 3600; b.s[0].f = th < -20 ? 1 : th > -14 ? 0.45 : 1 - 0.55 * (th + 20) / 6; b.s[0].clean = b.s[0].f > 0.9; }
    stepBel(b, 30);
    if (b.t > -16 * 3600) b.mehr24 = (b.mehr24 || 0) + (b.pkw - b.pref) * 30 / 3600;   // 24 h vor 08:00 Uhr
  }
  b.alarme = {}; b.eGeb = 0; b.eRef = 0;
  return b;
}

// Bedienhandlungen vor Ort
export function sondeZiehen(b, i, log) {
  const s = b.s[i]; s.out = !s.out;
  log(`${STR[i].qi} ${s.out ? 'aus dem Becken gezogen' : 'wieder eingesetzt'} – Regler ${STR[i].qic} steht auf ${s.ctrl.auto ? 'AUTO' : 'HAND'}`);
}
export function sondeReinigen(b, i, log) {
  const s = b.s[i]; if (!s.out) return 'Sonde zuerst aus dem Becken ziehen.';
  const war = s.f < 0.8; s.f = 0.93; s.clean = true;
  log(`${STR[i].qi} Membran gereinigt${war ? ' (deutlicher Bewuchs entfernt)' : ''}`);
  return 'Membran gereinigt.';
}
export function sondeKalibrieren(b, i, log) {
  const s = b.s[i]; if (!s.out) return 'Luftkalibrierung nur außerhalb des Beckens möglich.';
  const vor = cs() * s.f * s.cal; s.cal = 1 / s.f;
  log(`${STR[i].qi} Luftkalibrierung: Anzeige an Luft vorher ${vor.toFixed(1).replace('.', ',')} mg/L, Sollwert ${cs().toFixed(1).replace('.', ',')} mg/L`);
  return `Kalibriert: Anzeige an Luft jetzt ${cs().toFixed(1).replace('.', ',')} mg/L.`;
}
export function handmessung(b, i, log) {
  const s = b.s[i]; if (s.out) return 'Handmessung im Becken: Sonde des Handmessgeräts eintauchen – die Prozesssonde ist gerade gezogen.';
  const v = s.o2 + (Math.random() - 0.5) * 0.15;
  s.hand = { v, t: b.t };
  log(`Vergleichsmessung Handmessgerät ${STR[i].name}: ${v.toFixed(1).replace('.', ',')} mg/L (${STR[i].qi} zeigt ${s.meas.toFixed(1).replace('.', ',')} mg/L)`, 'messung');
  return null;
}
export const csWert = cs;
