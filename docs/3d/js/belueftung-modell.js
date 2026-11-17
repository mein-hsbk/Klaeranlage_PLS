// Prozessmodell Belüftung: zwei Belebungsstraßen mit eigener O₂-Regelung (QIC 301 / QIC 311,
// PI-Regler → Luftmenge je Straße), zwei Drehkolbengebläse G1.1 / G1.2 mit FU (Betriebsart
// AUTO / RESERVE / HAND / AUS), Sammelleitung mit Druck und Luftregelklappen FV 301 / FV 311
// (FERN = automatisch nach „Most-Open-Valve“, ORT = Handstellung vor Ort).
// Kennwerte wie im Kläranlagen-PLS (klaeranlage_pls.py): Gebläse max. 5.200 Nm³/h bei 50 Hz,
// min. 25 %, 25,2 Wh/Nm³; Nitrifikation nach Monod (NIT). Zeitbasis: Sekunden Simulationszeit.

export const PB = {
  L_MAX: 5200, L_MIN: 1300, WH_NM3: 25.2, T: 14,
  OUR0: 27.8,          // mittlere Sauerstoffzehrung je Straße (Nitrifikationszone) [mg/(L·h)]
  L0: 1653,            // Luftmenge je Straße bei O₂ = 2 mg/L und mittlerer Last [Nm³/h]
  P_STAT: 450,         // statischer Gegendruck (Einblastiefe + Belüfter) [mbar]
  DP_NOM: 50,          // Druckverlust Klappe + Leitung bei 2.600 Nm³/h und 88 % Öffnung [mbar]
  P_VERL: 2.5,         // Leerlauf-/Antriebsverluste je laufendem Gebläse [kW]
  P_N: 1013.25,        // Normluftdruck [hPa]
};
// O₂-Sättigung in Wasser bei Normdruck (Polynom nach Elmore/Hayes, entspricht DIN EN ISO 5814, 0–30 °C)
export const csNorm = (T) => 14.652 - 0.41022 * T + 0.007991 * T * T - 0.000077774 * T ** 3;
const CS0 = csNorm(PB.T);
const CA = PB.OUR0 / (PB.L0 * (CS0 - 2.0));                             // kLa je Nm³/h [1/h]
const NIT = { MU: 0.47, TH: 1.103, B: 0.05, KN: 1.0, KO: 0.5, T_AER: 9.0 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, z, tau, dt) => x + (z - x) * (1 - Math.exp(-dt / tau));
// Klappenkennlinie (Absperrklappe) und Durchflusskonstante
const g = (k) => (clamp(k, 0, 100) / 100) ** 1.8;
const ginv = (y) => 100 * clamp(y, 0, 1) ** (1 / 1.8);
const KF = 2600 / (g(88) * Math.sqrt(PB.DP_NOM));

export const STR = [
  { name: 'Straße 1', qic: 'QIC 301', qi: 'QI 301', fv: 'FV 301', fi: 'FI 301' },
  { name: 'Straße 2', qic: 'QIC 311', qi: 'QI 311', fv: 'FV 311', fi: 'FI 311' },
];
export const GEB = ['G1.1', 'G1.2'];
export const MODI = { auto: 'AUTO', reserve: 'RESERVE', hand: 'HAND', aus: 'AUS' };

function nh4Stat(o2) {
  const T = PB.T, mu = NIT.MU * NIT.TH ** (T - 15) * o2 / (NIT.KO + o2), b = NIT.B * 1.04 ** (T - 15), gg = NIT.T_AER * (mu - b);
  return gg <= 1 ? 25 : Math.min(25, NIT.KN * (1 + b * NIT.T_AER) / (gg - 1));
}
const last = (t) => 1 + 0.25 * Math.sin(2 * Math.PI * (((t / 3600) % 24) - 8) / 24);   // Tagesgang Sauerstoffzehrung
const leistung = (L, dp, n) => L * PB.WH_NM3 / 1000 * (1 + (dp - 30) / 480) + PB.P_VERL * n;
const dpMOV = (Lmax) => (Lmax / (KF * g(88))) ** 2;

export function createBel(sz = 'B0') {
  const lane = () => ({ o2: 2.0, meas: 2.0, f: 1.0, cal: 1.0, out: false, clean: true, L: PB.L0, integ: PB.L0,
    ctrl: { auto: true, sp: 2.0, kp: 600, tn: 0.25, hand: PB.L0 }, fv: { ort: false, pos: 88 }, klappe: 88, hand: null, kalP: PB.P_N });
  const geb = (mode) => ({ mode, hzHand: 35, L: 0, hz: 0, pkw: 0, amp: 0, run: false, pD: 0 });
  return { sz, t: 8 * 3600, s: [lane(), lane()], g: [geb('auto'), geb('reserve')], pAir: 1013, dp: 30,
    Ltot: 2 * PB.L0, hz: 31.8, pkw: 83, amp: 141, pD: 480, tD: 68, pdi: 11,
    nh4: 1.0, eGeb: 0, eRef: 0, pref: 83, alarme: {}, hist: [], histNext: 0 };
}

// Luftverteilung: Volumenstrom je Straße bei Sammelleitungsdruck dp (über statischem Gegendruck)
function stroeme(b, R, dp) {
  const sq = Math.sqrt(Math.max(0, dp));
  return b.s.map((s, i) => (s.fv.ort ? KF * g(s.fv.pos) * sq : Math.min(R[i], KF * g(100) * sq)));
}

export function stepBel(b, dt, log) {
  const h = dt / 3600; b.t += dt;
  const cs = CS0 * b.pAir / PB.P_N, ld = last(b.t);

  // 1) O₂-Regler → angeforderte Luftmenge je Straße
  const R = b.s.map((s) => {
    const k = s.ctrl;
    if (!k.auto) { s.integ = k.hand; return clamp(k.hand, 0, PB.L_MAX); }
    if (s.fv.ort) { s.integ = s.L; return s.L; }                     // Klappe vor Ort: Regler wirkungslos → Integrator nachführen
    const e = k.sp - s.meas;
    s.integ = clamp(s.integ + k.kp / Math.max(k.tn, 0.02) * e * h, 150, PB.L_MAX);
    return clamp(s.integ + k.kp * e, 150, PB.L_MAX);
  });

  // 2) Laufende Gebläse: AUTO = Führung (mehrere = Parallelbetrieb), RESERVE übernimmt, wenn kein anderes läuft
  let autoRun = b.g.filter((x) => x.mode === 'auto');
  const handRun = b.g.filter((x) => x.mode === 'hand');
  if (!autoRun.length && !handRun.length) autoRun = b.g.filter((x) => x.mode === 'reserve').slice(0, 1);
  b.g.forEach((x) => { x.run = autoRun.includes(x) || handRun.includes(x); });
  const H = handRun.reduce((a, x) => a + PB.L_MAX * clamp(x.hzHand, 12.5, 50) / 50, 0);
  const qMin = H + autoRun.length * PB.L_MIN, qMax = H + autoRun.length * PB.L_MAX;

  // 3) Sammelleitungsdruck: Automatik hält die am weitesten offene FERN-Klappe bei 88 %
  const fern = b.s.map((s, i) => (s.fv.ort ? 0 : R[i]));
  const dpZiel = clamp(Math.max(...fern) > 0 ? dpMOV(Math.max(...fern)) : PB.DP_NOM, 5, 300);
  const summe = (dp) => stroeme(b, R, dp).reduce((a, v) => a + v, 0);
  let Q = summe(dpZiel), dp = dpZiel;
  const ziel = autoRun.length ? clamp(Q, qMin, qMax) : H;
  if (Math.abs(ziel - Q) > 1) {                                           // Gebläse an Grenze bzw. nur HAND: Druck stellt sich ein
    let lo = 0, hi = 600;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (summe(m) < ziel) lo = m; else hi = m; }
    dp = (lo + hi) / 2;
  }
  b.dp = approach(b.dp, dp, 20, dt);
  const F = stroeme(b, R, b.dp);
  b.s.forEach((s, i) => {
    s.L = F[i];
    const pos = s.fv.ort ? s.fv.pos : ginv(F[i] / (KF * Math.sqrt(Math.max(1, b.dp))));
    s.klappe = approach(s.klappe, pos, 15, dt);
  });
  b.Ltot = F[0] + F[1];

  // 4) Gebläse: Aufteilung, Drehzahl, Leistung
  const autoGes = Math.max(0, b.Ltot - H), handF = H > 0 ? Math.min(1, b.Ltot / H) : 0;
  b.pD = PB.P_STAT + b.dp;
  b.g.forEach((x) => {
    x.L = !x.run ? 0 : handRun.includes(x) ? PB.L_MAX * clamp(x.hzHand, 12.5, 50) / 50 * handF : autoGes / autoRun.length;
    x.hz = x.run ? (handRun.includes(x) ? clamp(x.hzHand, 12.5, 50) : clamp(50 * x.L / PB.L_MAX, 12.5, 50)) : 0;
    x.pkw = x.run ? leistung(x.L, b.dp, 1) : 0; x.amp = x.pkw * 1000 / (Math.sqrt(3) * 400 * 0.86);
    x.pD = x.run ? b.pD : 0;
  });
  b.hz = b.g[0].hz; b.pkw = b.g[0].pkw + b.g[1].pkw; b.amp = b.g[0].amp;
  b.tD = approach(b.tD, b.g[0].run ? 58 + 22 * b.g[0].L / PB.L_MAX + (b.dp - 30) * 0.08 : 20, 600, dt);
  b.pdi = b.g[0].run ? 6 + 9 * (b.g[0].L / PB.L_MAX) ** 2 : 0;

  // 5) Sauerstoffhaushalt je Straße und Messung (an Luft: Sättigung beim aktuellen Luftdruck)
  let o2m = 0;
  const Lref = [0, 0];
  b.s.forEach((s, i) => {
    const our = PB.OUR0 * ld;
    s.o2 = clamp(s.o2 + (CA * s.L * (cs - s.o2) - our) * h, 0, cs);
    const sig = (s.out ? cs : s.o2) * s.f * s.cal;
    s.meas = approach(s.meas, sig, s.f < 0.8 ? 300 : 60, dt);
    o2m += s.o2 / 2;
    if (s.out && s.ctrl.auto && !s.fv.ort) s.minOutAuto = Math.min(s.minOutAuto ?? 99, s.o2);
    Lref[i] = our / (CA * (cs - Math.min(s.ctrl.sp, cs - 0.5)));
  });
  b.pref = leistung(clamp(Lref[0] + Lref[1], PB.L_MIN, PB.L_MAX), dpMOV(Math.max(...Lref)), 1);   // Leistung bei richtiger Messung, 1 Gebläse
  b.nh4 = approach(b.nh4, nh4Stat(o2m) * ld * ld, 2 * 3600, dt);
  b.eGeb += b.pkw * h;
  b.eRef += b.pref * h;

  const al = (key, aktiv, text, klasse) => {
    const a = b.alarme[key];
    if (aktiv && !(a && a.aktiv)) { b.alarme[key] = { aktiv: true, text, klasse, kommt: b.t }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = b.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  al('gmax', autoRun.length > 0 && b.Ltot >= qMax * 0.995, 'Gebläse an Maximaldrehzahl', 'W');
  al('gaus', b.Ltot < 50, 'Keine Belüftung – kein Gebläse in Betrieb', 'A');
  al('p202', b.pD > 650, 'PISA+ 202 Druck Sammelleitung hoch', 'A');
  b.g.forEach((x, i) => al(`gm${i}`, i === 0 ? x.mode !== 'auto' : x.mode !== 'reserve', `${GEB[i]} Betriebsart ${MODI[x.mode]}`, 'M'));
  b.s.forEach((s, i) => {
    al(`lo${i}`, s.meas < 1.0, `${STR[i].qi} O₂ ${STR[i].name} niedrig`, 'A');
    al(`hi${i}`, s.meas > 4.5, `${STR[i].qi} O₂ ${STR[i].name} hoch`, 'W');
    al(`fv${i}`, s.fv.ort, `${STR[i].fv} im Vor-Ort-Betrieb`, 'M');
  });
  al('nh4', b.nh4 > 5, 'QI 302 NH₄-N Ablauf Belebung hoch', 'A');

  if (b.t >= b.histNext) {
    b.hist.push({ t: b.t, m1: b.s[0].meas, m2: b.s[1].meas, o1: b.s[0].o2, o2: b.s[1].o2, l1: b.s[0].L, l2: b.s[1].L, p: b.pkw, pr: b.pref, nh4: b.nh4, pd: b.pD });
    if (b.hist.length > 1000) b.hist.shift();
    b.histNext = b.t + 300;
  }
}

// Szenarien: B0 Normalbetrieb, B1 Belag auf der Membran der O₂-Sonde QI 301 (zeigt zu wenig an)
export function setupBel(sz) {
  const b = createBel(sz);
  b.pAir = sz === 'B1' ? 982 : 1013;                                   // B1: Tiefdruckwetter
  b.s.forEach((s) => { s.kalP = b.pAir; });                            // Sonden zuletzt korrekt kalibriert (cal = 1)
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

// ------------------------------------------------------------------ Bedienhandlungen vor Ort
const n1 = (x) => x.toFixed(1).replace('.', ',');
export function sondeZiehen(b, i, log) {
  const s = b.s[i]; s.out = !s.out; s.hand = null;
  log(`${STR[i].qi} ${s.out ? 'aus dem Becken gezogen' : 'wieder eingesetzt'} – Regler ${STR[i].qic} steht auf ${s.ctrl.auto ? 'AUTO' : 'HAND'}`);
}
export function sondeReinigen(b, i, log) {
  const s = b.s[i]; if (!s.out) return 'Sonde zuerst aus dem Becken ziehen.';
  const war = s.f < 0.8; s.f = 0.93; s.clean = true;
  log(`${STR[i].qi} Membran gereinigt${war ? ' (deutlicher Bewuchs entfernt)' : ''}`);
  return 'Membran gereinigt.';
}
// Luftkalibrierung: Der Messumformer setzt die Anzeige an Luft auf die Sättigung beim eingegebenen Luftdruck
export function sondeKalibrieren(b, i, pEin, log) {
  const s = b.s[i]; if (!s.out) return 'Luftkalibrierung nur außerhalb des Beckens möglich.';
  if (!(pEin > 850 && pEin < 1100)) return 'Luftdruck zwischen 850 und 1100 hPa eingeben.';
  const csT = csNorm(PB.T), soll = csT * pEin / PB.P_N, ist = csT * b.pAir / PB.P_N;
  const vor = ist * s.f * s.cal; s.cal = soll / (ist * s.f); s.kalP = pEin;
  log(`${STR[i].qi} Luftkalibrierung mit ${Math.round(pEin)} hPa: Anzeige an Luft vorher ${n1(vor)} mg/L, jetzt ${n1(soll)} mg/L`);
  return `Kalibriert auf ${n1(soll)} mg/L (${n1(csT)} mg/L × ${Math.round(pEin)} hPa / 1013 hPa).`;
}
export function handmessung(b, i, log) {
  const s = b.s[i]; if (s.out) return 'Handmessung im Becken: Sonde des Handmessgeräts eintauchen – die Prozesssonde ist gerade gezogen.';
  const v = s.o2 + (Math.random() - 0.5) * 0.15;
  s.hand = { v, t: b.t };
  log(`Vergleichsmessung Handmessgerät ${STR[i].name}: ${n1(v)} mg/L (${STR[i].qi} zeigt ${n1(s.meas)} mg/L)`, 'messung');
  return null;
}
export function gebMode(b, i, mode, log) {
  const x = b.g[i]; if (x.mode === mode) return;
  log(`${GEB[i]} Betriebsart am FU: ${MODI[x.mode]} → ${MODI[mode]}${mode === 'hand' ? ` (${n1(x.hzHand)} Hz)` : ''}`);
  x.mode = mode;
}
export function gebHz(b, i, hz, log) {
  const x = b.g[i], v = clamp(hz, 12.5, 50); log(`${GEB[i]} Hand-Frequenz ${n1(x.hzHand)} → ${n1(v)} Hz`); x.hzHand = v;
}
export function fvOrt(b, i, ort, log) {
  const s = b.s[i]; if (s.fv.ort === ort) return;
  if (ort) s.fv.pos = Math.round(s.klappe);
  s.fv.ort = ort; log(`${STR[i].fv} auf ${ort ? `ORT (Handstellung ${Math.round(s.fv.pos)} %)` : 'FERN (Automatik)'} geschaltet`);
}
export function fvPos(b, i, pos, log) {
  const s = b.s[i], v = clamp(pos, 0, 100); log(`${STR[i].fv} Handstellung ${Math.round(s.fv.pos)} → ${Math.round(v)} %`); s.fv.pos = v;
}
export const csWert = (b) => CS0 * (b ? b.pAir : PB.P_N) / PB.P_N;
