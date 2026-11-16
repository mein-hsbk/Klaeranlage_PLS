// Prozessmodell Faulung / Gasstrecke – Kläranlage Schwierbach (Prototyp)
// Zeitbasis: Sekunden Simulationszeit. Kennwerte an klaeranlage_pls.py angelehnt
// (BHKW 125 kW el., eta_el 0,36, Hu 6,4 kWh/Nm³ bei 62 % CH4, ca. 1.000 Nm³/d Faulgas).

export const P = {
  V_GS: 600,          // nutzbares Volumen Gasspeicher GS-1 [m³]
  Q_NENN: 42,         // mittlere Faulgasproduktion [Nm³/h]
  P_EL: 125,          // BHKW Nennleistung el. [kW]
  ETA_EL: 0.36,
  HU62: 6.4,          // Heizwert bei 62 % CH4 [kWh/Nm³]
  BEDARF: 175,        // mittlerer elektrischer Eigenbedarf der Anlage [kW] (ohne Kopplung)
  GRUND: 92,          // Eigenbedarf ohne Gebläsestation [kW] (mit Kopplung an die Belüftung)
  T_SOLL: 37,         // Faulturmtemperatur [°C]
  P_GS: 22,           // Gasdruck Speicher (Stützluft) [mbar]
  P_VERD: 85,         // Druck nach Verdichter V6.1 [mbar]
  PSL613: 40,         // BHKW Gasdruck min [mbar]
  CH4_MIN: 45,        // BHKW Abschaltung Methan [%]
  FACKEL_EIN: 0.90, FACKEL_AUS: 0.80,
  BHKW_EIN: 0.45, BHKW_AUS: 0.15,
};

export const SZENARIEN = {
  S0: { code: 'S0', titel: 'Normalbetrieb',
    prueferInfo: 'Keine Störung. Geeignet für Einweisung, Ablesen der Vor-Ort-Instrumente und Energiebilanz (Eigenversorgungsgrad).' },
  S1: { code: 'S1', titel: 'BHKW-Störung nach Wartung',
    prueferInfo: 'Kugelhahn HA 611 vor dem Gasverdichter wurde nach einer Wartung nicht wieder geöffnet. Leitwarte zeigt nur „BHKW Sammelstörung“. Vor Ort: BHKW-Panel „Gasdruck min PSL 613“, PI 610 normal (≈22 mbar), PI 613 ≈0 mbar, Hebel HA 611 quer zur Leitung. Gasspeicher läuft voll, Fackel geht in Betrieb. Lösung: HA 611 öffnen, Störung am BHKW quittieren.' },
  S2: { code: 'S2', titel: 'Heizung Faulturm ausgefallen',
    prueferInfo: 'Motorschutzschalter der Heizwasserpumpe P11.1 (Maschinenhaus) hat ausgelöst. Leitwarte zeigt nur „Sammelstörung Heizung“ und eine langsam fallende Faulturmtemperatur. Vor Ort: Pumpe steht, Vor- und Rücklauf TI 1101/1102 kühlen ab. Folge ohne Eingriff: Gasproduktion und Methangehalt sinken, BHKW taktet bzw. schaltet bei CH4 < 45 % ab. Lösung: Motorschutz einschalten, Temperaturverlauf beobachten.' },
};

export function createState(szenario = 'S0') {
  const s = {
    szenario, t: 8 * 3600,            // Start 08:00 Uhr
    V: 0.62 * P.V_GS, T_ft: 37.0, ch4: 62.0,
    ha611: true, p11: true, p11Trip: false,
    bhkw: 'betrieb', bhkwStoer: '', bhkwStartT: 0, bhkwTripTimer: 0, bhkwH: 41237.0,
    L: 0.75, pel: 0, qBhkw: 0, qProd: 0, qFackel: 0, qAbblasen: 0,
    fackel: false, tFackel: 18, p610: P.P_GS, p613: P.P_VERD, verd: true,
    tVL: 75, tRL: 58, fq608: 2714389.0, eBhkw: 0, vFackel: 0, vAbblasen: 0, eBezug: 0,
    alarme: {},   // key -> {aktiv, text, kommt}
    hist: [],     // Trends
    histNext: 0,
  };
  if (szenario === 'S1') {
    s.ha611 = false; s.bhkw = 'stoerung'; s.bhkwStoer = 'Gasdruck min PSL 613'; s.V = 0.72 * P.V_GS; s.verd = false;
  }
  if (szenario === 'S2') {
    s.p11 = false; s.p11Trip = true; s.T_ft = 36.1; s.ch4 = 60.5; s.tVL = 52; s.tRL = 41;
  }
  return s;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, target, tau, dt) => x + (target - x) * (1 - Math.exp(-dt / tau));

// Ein Integrationsschritt; dt in s Simulationszeit (≤ 30 s)
export function step(s, dt, log) {
  const h = dt / 3600;
  s.t += dt;
  const th = (s.t / 3600) % 24;
  const lvl = s.V / P.V_GS;

  // Faulturmtemperatur: Heizung nur mit laufender Heizwasserpumpe P11.1 (Wärme aus BHKW bzw. Heizkessel)
  if (s.p11) s.T_ft = s.T_ft < P.T_SOLL ? Math.min(P.T_SOLL, s.T_ft + 0.25 * h) : approach(s.T_ft, P.T_SOLL, 3600, dt);
  else s.T_ft -= 0.12 * h;
  s.tVL = approach(s.tVL, s.p11 ? 75 : 34, s.p11 ? 600 : 9000, dt);
  s.tRL = approach(s.tRL, s.p11 ? 58 : 30, s.p11 ? 600 : 9000, dt);

  // Gasproduktion und Methangehalt (Temperaturabfall → Hemmung der Methanbildner, Versäuerung)
  const fT = clamp(1 - 0.07 * (P.T_SOLL - s.T_ft), 0.3, 1.02);
  s.qProd = P.Q_NENN * fT * (1 + 0.12 * Math.sin(2 * Math.PI * (th - 10) / 24));
  const ch4Ziel = clamp(62 - Math.max(0, 36 - s.T_ft) * 3.4, 38, 62);
  s.ch4 = approach(s.ch4, ch4Ziel, 3 * 3600, dt);

  // Gasverdichter V6.1 und Drücke
  s.verd = s.bhkw === 'start' || s.bhkw === 'betrieb';
  s.p610 = lvl > 0.02 ? P.P_GS : P.P_GS * lvl / 0.02;
  const p613Ziel = s.verd ? (s.ha611 ? P.P_VERD : -8) : (s.ha611 ? s.p610 : 0);
  s.p613 = approach(s.p613, p613Ziel, 20, dt);

  // BHKW
  const tripp = (grund) => {
    s.bhkw = 'stoerung'; s.bhkwStoer = grund; s.bhkwTripTimer = 0;
    log && log(`BHKW schaltet ab: ${grund}`, 'sys');
  };
  if (s.bhkw === 'aus' && lvl > P.BHKW_EIN && s.ch4 >= P.CH4_MIN + 2) { s.bhkw = 'start'; s.bhkwStartT = 0; }
  if (s.bhkw === 'start') {
    s.bhkwStartT += dt;
    if (s.p613 < P.PSL613 && s.bhkwStartT > 30) tripp('Gasdruck min PSL 613');
    else if (s.bhkwStartT > 120) s.bhkw = 'betrieb';
  }
  if (s.bhkw === 'betrieb') {
    if (s.p613 < P.PSL613) { s.bhkwTripTimer += dt; if (s.bhkwTripTimer > 10) tripp('Gasdruck min PSL 613'); }
    else s.bhkwTripTimer = 0;
    if (s.bhkw === 'betrieb' && s.ch4 < P.CH4_MIN) tripp('Methangehalt min QSL 614');
    if (s.bhkw === 'betrieb' && lvl < P.BHKW_AUS) { s.bhkw = 'aus'; log && log('BHKW: Normalabschaltung (Gasspeicher leer)', 'sys'); }
  }
  const hu = P.HU62 * s.ch4 / 62;
  if (s.bhkw === 'betrieb') {
    s.L = clamp(0.4 + (lvl - 0.3) / 0.5 * 0.6, 0.4, 1.0);
    s.pel = P.P_EL * s.L;
    s.qBhkw = s.pel / (P.ETA_EL * hu);
    s.bhkwH += h;
  } else { s.pel = 0; s.qBhkw = s.bhkw === 'start' ? 4 : 0; }

  // Fackel F6.1
  if (!s.fackel && lvl >= P.FACKEL_EIN) { s.fackel = true; log && log('Fackel F6.1 zündet (Gasspeicher > 90 %)', 'sys'); }
  if (s.fackel && lvl <= P.FACKEL_AUS) { s.fackel = false; log && log('Fackel F6.1 aus', 'sys'); }
  s.qFackel = s.fackel ? 60 : 0;
  s.tFackel = approach(s.tFackel, s.fackel ? 950 : 18, s.fackel ? 90 : 900, dt);

  // Speicherbilanz inkl. Über-/Unterdrucksicherung
  s.V += (s.qProd - s.qBhkw - s.qFackel) * h;
  s.qAbblasen = 0;
  if (s.V > P.V_GS) { s.qAbblasen = (s.V - P.V_GS) / h; s.V = P.V_GS; s.vAbblasen += s.qAbblasen * h; }
  if (s.V < 0) { s.V = 0; if (s.bhkw === 'betrieb') { s.bhkw = 'aus'; } }

  s.fq608 += s.qProd * h;
  s.eBhkw += s.pel * h;
  s.vFackel += s.qFackel * h;
  // Eigenbedarf: Grundlast der Anlage + Gebläseleistung aus der Belüftungssimulation (falls gekoppelt)
  const grund = s.pGeb != null ? P.GRUND : P.BEDARF;
  const bedarf = grund * (1 + 0.15 * Math.sin(2 * Math.PI * (th - 9) / 24)) + (s.pGeb ?? 0);
  s.bedarf = bedarf;
  s.eBezug += Math.max(0, bedarf - s.pel) * h;

  // Alarme / Meldungen der Leitwarte (bewusst nur Sammelmeldungen)
  const al = (key, aktiv, text, klasse) => {
    const a = s.alarme[key];
    if (aktiv && !(a && a.aktiv)) { s.alarme[key] = { aktiv: true, text, klasse, kommt: s.t, quit: false }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = s.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  al('bhkw', s.bhkw === 'stoerung', 'BHKW G10.1 Sammelstörung', 'A');
  s.lsh = s.lsh ? lvl > 0.84 : lvl >= 0.88;
  al('lsh609', s.lsh, 'LSH 609 Gasspeicher Füllstand hoch', 'W');
  al('lshh609', s.qAbblasen > 0, 'LSHH 609 Überdrucksicherung GS-1 spricht an', 'A');
  al('fackel', s.fackel, 'Fackel F6.1 in Betrieb', 'M');
  al('heiz', s.p11Trip, 'Sammelstörung Heizung Faulung', 'A');
  al('tsl1001', s.T_ft < 35, 'TSL 1001 Faulturmtemperatur niedrig', 'W');
  al('qsl614', s.ch4 < 55, 'QSL 614 Methangehalt niedrig', 'W');

  if (s.t >= s.histNext) {
    s.hist.push({ t: s.t, lvl: lvl * 100, q: s.qProd, pel: s.pel, T: s.T_ft, ch4: s.ch4, f: s.fackel ? 1 : 0 });
    if (s.hist.length > 400) s.hist.shift();
    s.histNext = s.t + 300;
  }
}

export function run(s, dtTotal, log) {
  let r = dtTotal;
  while (r > 0) { const d = Math.min(30, r); step(s, d, log); r -= d; }
}

export function bhkwQuittieren(s, log) {
  if (s.bhkw !== 'stoerung') return 'Keine Störung anstehend.';
  if (s.ha611 && s.ch4 >= P.CH4_MIN + 2) { s.bhkw = 'aus'; s.bhkwStoer = ''; log && log('BHKW Störung quittiert – Anlage betriebsbereit', 'aktion'); return 'Störung quittiert. BHKW startet automatisch, wenn der Gasspeicher > 45 % ist.'; }
  log && log('BHKW Störung quittiert – Störung steht weiter an', 'aktion');
  return 'Quittierung nicht möglich: Störung steht weiterhin an.';
}

export const fmtZeit = (t) => { const m = ((Math.floor(t / 60) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const tag = (t) => Math.floor(t / 86400) + 1;
