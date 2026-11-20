// Prozessmodell Abwasserpumpwerk Industriegebiet Ost (APW-02) – LS „Bernoulli-Gleichung / Anlagenkennlinie“.
// Vorgeschichte: Vor zwei Tagen wurde P-001 gegen eine neue, energieeffizientere Pumpe getauscht (mit
// Frequenzumrichter). Gleichzeitig wurde die schadhafte Druckleitung DN 150 (GGG, 1979) durch Relining
// mit einem PE-HD-Rohr da 140 × 8,3 (SDR 17, d_i = 123,4 mm) saniert. Die neue Pumpe wurde für die alte
// Anlagenkennlinie ausgelegt (80 m³/h bei 22 m) – mit dem kleineren Querschnitt stellt sich ein deutlich
// kleinerer Förderstrom ein. P-002 ist die alte Pumpe (Festdrehzahl) und dient als Reserve.
// Hydraulik: Rohrreibung nach Colebrook (k = 0,05 mm, ν = 1,0·10⁻⁶ m²/s – entspricht dem KSB-Diagramm
// „neue rohe Stahlrohre“), dazu Einzelverluste im Pumpwerk. Parallelbetrieb über gemeinsame Druckleitung.
// Zeitbasis: Sekunden Simulationszeit.

export const PO = {
  A_SUMPF: 50,                      // Pumpensumpf + Stauraum im Zulaufkanal [m²]
  LI_EIN: 1.6, LI_AUS: 0.8, LI_SPITZE: 2.3, LI_HOCH: 2.2, LI_UEB: 2.8, Z_ACHSE: 0.6,
  Z_AUSLAUF: 20.2,                  // Auslauf Übergabeschacht KA über Sumpfsohle → H_geo = 18,0 m bei Pegel 2,20 m (Rückstau)
  L: 400, D_ALT: 0.150, D_NEU: 0.1234, K_RAU: 0.05e-3, NU: 1.0e-6,
  DZ_MANO: 0.50,                    // Höhendifferenz der Manometeranschlüsse (druckseitig höher)
  D_SAUG: 0.125, D_DRUCK: 0.100,    // Stutzen-Nennweiten der Pumpen (Saug DN 125 / Druck DN 100)
  KB: 1.25e-4,                      // Einzelverluste je Pumpenstrang (Einlauf, Krümmer, RSK, Schieber) [m/(m³/h)²]
  KS: 2.0e-5,                       // davon saugseitig
  KE: 1.6e-5,                       // Auslauf / Formstücke Übergabeschacht
  CV: 8e-5,                         // Drosselbeiwert Druckschieber (ganz offen ≈ 0)
  Q_SOLL: 80,
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, z, tau, dt) => x + (z - x) * (1 - Math.exp(-dt / tau));
const G = 9.81, BAR = 0.0981;                                  // 1 m Wassersäule ≈ 0,0981 bar

// Pumpenkennlinien bei Nenndrehzahl (identisch mit dem Arbeitsblatt): H in m, Q in m³/h
export const PUMPEN = [
  { nr: 'P-001', name: 'neue Pumpe', baujahr: 2026, H: (q) => 27 + 0.0125 * q - 0.0009375 * q * q, qMax: 155, etaMax: 0.74, qOpt: 82,
    motor: 7.5, n: 1460, fu: true, schild: ['Q 80 m³/h', 'H 22,0 m', 'n 1460 1/min', 'P 7,5 kW · IE4'] },
  { nr: 'P-002', name: 'alte Pumpe', baujahr: 1994, H: (q) => 32 - 0.0625 * q - 0.0003125 * q * q, qMax: 220, etaMax: 0.63, qOpt: 96,
    motor: 11, n: 1450, fu: false, schild: ['Q 95 m³/h', 'H 23,5 m', 'n 1450 1/min', 'P 11 kW'] },
];
// Pumpenkennlinie bei Frequenz f (Affinitätsgesetze)
const hPumpe = (k, q, f) => { const r = f / 50; if (r <= 0.05) return 0; return r * r * PUMPEN[k].H(q / r); };
const etaPumpe = (k, q, f) => { const r = Math.max(0.05, f / 50), P = PUMPEN[k], x = (q / r - P.qOpt) / P.qOpt; return clamp(P.etaMax * (1 - 0.95 * x * x), 0.12, P.etaMax); };

// Rohrreibung (Colebrook, wie im Diagramm „neue rohe Stahlrohre“)
function lambda(re, d) { let l = 0.02; for (let i = 0; i < 12; i++) l = Math.pow(-2 * Math.log10(2.51 / (re * Math.sqrt(l)) + PO.K_RAU / d / 3.71), -2); return l; }
export function hvLeitung(q, d = PO.D_NEU, L = PO.L) {
  if (q <= 0.01) return 0;
  const v = 4 * q / 3600 / Math.PI / d / d, re = v * d / PO.NU;
  return lambda(re, d) * L / d * v * v / (2 * G);
}
const vRohr = (q, d) => 4 * q / 3600 / Math.PI / d / d;

export function createOst(art) {
  const pumpe = (k) => ({ k, nr: PUMPEN[k].nr, wahl: 'auto', rep: true, vs: 100, vd: 100, run: false, q: 0, h: 0, ps: 0, pd: 0, pkw: 0, amp: 0, v: 0.1, tl: 30,
    f: 0, fSoll: 50, fuOrt: false, bh: k === 0 ? 46 : 61520, starts: 0, laeuftT: 0, gegenZu: 0, heissMeld: false, qMax: 0 });
  return {
    t: 8 * 3600, li: 1.3, liEin: PO.LI_EIN, liAus: PO.LI_AUS, spitze: art !== 'stoer', qIn: 40, q: 0, qUeb: 0, vUeb: 0, hman: 0,
    p: [pumpe(0), pumpe(1)], art, alarme: {}, hist: [], histNext: 0, eKwh: 0, vGef: 0, messungen: [],
    historie: ['Vorgestern 15:30  Inbetriebnahme P-001 (neu) nach Pumpentausch, Fa. Pumpenservice Rhein-Ruhr',
      'Vorgestern 15:10  Druckleitung nach Relining (PE-HD da 140) gespült und freigegeben',
      'Vorgestern 15:05  Spitzenlast-Zuschaltung P-002 deaktiviert (1 + 1 Betrieb/Reserve)'],
  };
}

// Zulauf: Industriegebiet – Produktionszeiten 6–22 Uhr, nachts Grundlast
export function zulauf(t) {
  const th = (t / 3600) % 24, s = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  return 28 + 47 * s(5, 7.5, th) * (1 - s(20.5, 23, th)) + 3 * Math.sin(th * 1.7);
}

// Förderstrom einer Pumpe bei vorgegebener Druckhöhe am Sammelpunkt (Rückschlagklappe schließt bei q ≤ 0)
function qBeiH(pw, x, hm) {
  if (!x.run || x.f < 1 || x.vd <= 1 || x.vs <= 1) return 0;
  const kv = PO.CV * (1 / (x.vd / 100) ** 2 - 1) + PO.CV * 0.3 * (1 / (x.vs / 100) ** 2 - 1);
  const net = (q) => hPumpe(x.k, q, x.f) - (PO.KB + kv) * q * q;
  if (net(0) <= hm) return 0;
  let lo = 0, hi = PUMPEN[x.k].qMax * x.f / 50;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (net(m) > hm) lo = m; else hi = m; }
  return lo;
}
export const hgeo = (li) => PO.Z_AUSLAUF - li;
export const hAnlage = (pw, q, d = PO.D_NEU) => hgeo(pw.li) + hvLeitung(q, d) + PO.KE * q * q;
// Betriebspunkt aller laufenden Pumpen (gemeinsame Druckleitung)
function betrieb(pw) {
  const H0 = hgeo(pw.li);
  let lo = H0, hi = 45;
  const qs = (hm) => pw.p.reduce((s, x) => s + qBeiH(pw, x, hm), 0);
  if (qs(H0 + 1e-6) <= 0) return { Q: 0, hm: H0 };
  for (let i = 0; i < 40; i++) { const hm = (lo + hi) / 2; const Q = qs(hm); if (hAnlage(pw, Q) < hm) hi = hm; else lo = hm; }
  return { Q: qs(lo), hm: lo };
}

export function stepOst(pw, dt, log) {
  const h = dt / 3600; pw.t += dt;
  pw.qIn = zulauf(pw.t);
  const [P1, P2] = pw.p;
  // Niveausteuerung: P-001 Führung, P-002 Reserve (Störung/nicht AUTO) bzw. Spitzenlast, wenn freigegeben
  const verf = (x) => x.rep && x.wahl === 'auto';
  pw.p.forEach((x, i) => {
    let soll;
    if (!x.rep || x.wahl === '0') soll = false;
    else if (x.wahl === 'hand') soll = true;
    else {
      const lead = i === 0 || !verf(P1);
      const ein = lead ? pw.li >= pw.liEin : (pw.spitze && pw.li >= PO.LI_SPITZE);
      const aus = lead ? pw.li <= pw.liAus : pw.li <= pw.liEin;
      soll = x.run ? !aus : ein;
    }
    if (soll && !x.run) { x.starts++; x.laeuftT = 0; }
    x.run = soll; x.laeuftT += x.run ? dt : 0;
    const fz = !x.run ? 0 : (PUMPEN[x.k].fu && x.fuOrt ? clamp(x.fSoll, 25, 50) : 50);
    x.f = approach(x.f, fz, x.run ? 4 : 2, dt);
    if (x.f < 0.5 && !x.run) x.f = 0;
  });
  const b = betrieb(pw); pw.hman = b.hm;
  let qOut = 0;
  pw.p.forEach((x) => {
    const q = x.run ? qBeiH(pw, x, b.hm) : 0;
    x.q = q; qOut += q;
    const hs = pw.li + PO.Z_ACHSE - PO.KS * q * q;                       // Druckhöhe vor der Pumpe [m]
    x.ps = x.vs > 1 ? hs * BAR : 0;
    if (x.run && x.f > 1) {
      x.h = hPumpe(x.k, q, x.f);                                            // Förderhöhe der Pumpe
      const dv = (vRohr(q, PO.D_DRUCK) ** 2 - vRohr(q, PO.D_SAUG) ** 2) / (2 * G);
      x.pd = x.ps + (x.h - PO.DZ_MANO - dv) * BAR;
      const pHyd = 1000 * G * (q / 3600) * x.h / 1000, eta = etaPumpe(x.k, q, x.f);
      const p0 = 0.32 * PUMPEN[x.k].motor * (x.f / 50) ** 3;
      x.pkw = (q > 0.5 ? Math.max(pHyd / eta, p0) : p0) / 0.92;
      x.amp = x.pkw * 1000 / (Math.sqrt(3) * 400 * 0.85) * (PUMPEN[x.k].fu ? 0.96 : 1);
      const teil = q / (PUMPEN[x.k].qOpt * x.f / 50);
      x.v = 1.6 + (teil < 0.35 ? (0.35 - teil) * 7 : 0) + (teil > 1.3 ? 1.2 : 0);
      x.gegenZu = q < 0.5 ? x.gegenZu + dt : 0;
      if (x.gegenZu > 300 && !x.heissMeld) { x.heissMeld = true; log && log(`${x.nr} läuft länger ohne Förderstrom (Nullförderhöhe nicht über Gegendruck) – Pumpe erwärmt sich`, 'sys'); }
      x.bh += h;
    } else { x.h = 0; x.pd = Math.max(0, x.ps - PO.DZ_MANO * BAR); x.pkw = 0; x.amp = 0; x.v = 0.1; x.gegenZu = 0; }
    x.tl = approach(x.tl, x.run ? (x.gegenZu > 120 ? 62 : 44) : 22, 1500, dt);
    x.qMax = Math.max(x.qMax, q);
  });
  pw.q = qOut;
  pw.li += (pw.qIn - qOut) * h / PO.A_SUMPF;
  pw.qUeb = 0;
  if (pw.li > PO.LI_UEB) { pw.qUeb = (pw.li - PO.LI_UEB) * PO.A_SUMPF / h; pw.vUeb += pw.qUeb * h; pw.li = PO.LI_UEB; }
  pw.li = Math.max(0.1, pw.li);
  pw.eKwh += (P1.pkw + P2.pkw) * h; pw.vGef += qOut * h;

  const al = (key, aktiv, text, klasse) => {
    const a = pw.alarme[key];
    if (aktiv && !(a && a.aktiv)) { pw.alarme[key] = { aktiv: true, text, klasse, kommt: pw.t }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = pw.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  al('qn', pw.p.some((x) => x.run && x.laeuftT > 180) && qOut < PO.Q_SOLL && pw.li > 1.8, 'PW Ind.-Ost: Förderstrom zu gering – Rückstau im Zulaufkanal steigt', 'W');
  al('lih', pw.li > PO.LI_HOCH, 'PW Ind.-Ost: LI-101 Pegel Pumpensumpf hoch', 'W');
  al('ueb', pw.qUeb > 0, 'PW Ind.-Ost: Notüberlauf in Betrieb (Abschlag ins Gewässer)', 'A');
  pw.p.forEach((x, i) => {
    al(`rep${i}`, !x.rep, `PW Ind.-Ost: ${x.nr} Reparaturschalter AUS`, 'A');
    al(`ni${i}`, x.wahl !== 'auto' || (x.fuOrt && PUMPEN[x.k].fu), `PW Ind.-Ost: ${x.nr} nicht in AUTO${x.fuOrt ? ' (FU Sollwert ORT)' : ''}`, 'M');
  });
  if (pw.t >= pw.histNext) {
    pw.hist.push({ t: pw.t, li: pw.li, q: qOut, q1: P1.q, q2: P2.q, f1: P1.f, i1: P1.amp, i2: P2.amp, qin: pw.qIn });
    if (pw.hist.length > 2000) pw.hist.shift();
    pw.histNext = pw.t + 60;
  }
}

export function setupOst(art = null) {
  const pw = createOst(art);
  pw.t = 4 * 3600; pw.histNext = pw.t; pw.li = 1.0;
  for (let i = 0; i < 5 * 3600 / 10; i++) stepOst(pw, 10);         // Vorlauf bis 09:00 Uhr
  pw.alarme = {}; pw.eKwh = 0; pw.vGef = 0; pw.vUeb = 0;
  pw.p.forEach((x) => { x.qMax = 0; x.heissMeld = false; });
  return pw;
}

// ------------------------------------------------------------------ Bedienhandlungen vor Ort
const n1 = (x) => x.toFixed(1).replace('.', ','), n2 = (x) => x.toFixed(2).replace('.', ',');
const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
export function setWahl(pw, i, w, log) { const x = pw.p[i]; if (x.wahl === w) return; log(`APW-02 ${x.nr} Wahlschalter ${WAHL[x.wahl]} → ${WAHL[w]}`); x.wahl = w; }
export function setRep(pw, i, ein, log) { const x = pw.p[i]; if (x.rep === ein) return; x.rep = ein; log(`APW-02 ${x.nr} Reparaturschalter ${ein ? 'EIN' : 'AUS (0)'}${!ein && x.run ? ' – Pumpe lief noch' : ''}`); }
export function setSchieber(pw, i, seite, pos, log) {
  const x = pw.p[i], k = seite === 's' ? 'vs' : 'vd', alt = x[k]; x[k] = clamp(pos, 0, 100);
  log(`APW-02 ${x.nr} ${seite === 's' ? 'Saugschieber' : 'Druckschieber'} ${Math.round(alt)} → ${Math.round(x[k])} % offen${x.run ? ' (Pumpe läuft)' : ''}`);
}
export function setFuOrt(pw, ort, log) { const x = pw.p[0]; if (x.fuOrt === ort) return; x.fuOrt = ort; log(`APW-02 P-001 FU Sollwertquelle ${ort ? `ORT (Handsollwert ${n1(x.fSoll)} Hz)` : 'FERN (Pumpensteuerung, 50 Hz)'}`); }
export function setFSoll(pw, f, log) { const x = pw.p[0], alt = x.fSoll; x.fSoll = clamp(f, 25, 50); log(`APW-02 P-001 FU Handsollwert ${n1(alt)} → ${n1(x.fSoll)} Hz${x.fuOrt ? '' : ' (wirkt erst bei Sollwertquelle ORT)'}`); }
export function setSpitze(pw, ein, log) { if (pw.spitze === ein) return; pw.spitze = ein; log(`APW-02 Pumpensteuerung: Spitzenlast-Zuschaltung P-002 ${ein ? 'freigegeben (ab 2,30 m)' : 'deaktiviert'}`); }
export function setEinPegel(pw, v, log) { const alt = pw.liEin; pw.liEin = clamp(v, 1.0, 2.2); log(`APW-02 Einschaltpegel ${n2(alt)} → ${n2(pw.liEin)} m`); }
export function setAusPegel(pw, v, log) { const alt = pw.liAus; pw.liAus = clamp(v, 0.5, 1.4); log(`APW-02 Ausschaltpegel ${n2(alt)} → ${n2(pw.liAus)} m`); }

// Anzeigen der Messumformer (gerundet wie im Display)
export const anzeige = (pw) => {
  const [a, b] = pw.p;
  return { li: pw.li, q: pw.q, f1: a.f, ps1: a.ps, pd1: a.pd, ps2: b.ps, pd2: b.pd, i1: a.amp, i2: b.amp };
};
// Messwerte notieren (Notizblock): alles, was vor Ort ablesbar ist
export function notieren(pw, log) {
  const a = pw.p[0], b = pw.p[1], laufen = pw.p.filter((x) => x.run && x.q > 0.5).map((x) => x.nr);
  const stat = Math.abs(a.f - (a.run ? (a.fuOrt ? a.fSoll : 50) : 0)) < 0.3;
  const m = { nr: pw.messungen.length + 1, t: pw.t, f: a.run ? a.f : 0, q: pw.q, ps: a.ps, pd: a.pd, li: pw.li, p1: a.run, p2: b.run, stat,
    hp: a.h, hman: pw.hman, i: a.amp };
  pw.messungen.push(m);
  log(`APW-02 Messwerte notiert (Nr. ${m.nr}): P-001 ${a.run ? `${n1(m.f)} Hz` : 'aus'}, P-002 ${b.run ? 'Betrieb' : 'aus'}, FI-101 ${Math.round(m.q)} m³/h, PI 101.1 ${n2(m.ps)} bar, PI 101.2 ${n2(m.pd)} bar, LI-101 ${n2(m.li)} m`, 'messung');
  return `Notiert (Nr. ${m.nr}): ${a.run ? `${n1(m.f)} Hz` : 'P-001 aus'} · ${Math.round(m.q)} m³/h · p_s ${n2(m.ps)} bar · p_d ${n2(m.pd)} bar · Pegel ${n2(m.li)} m${laufen.length > 1 ? ' – Achtung: zwei Pumpen in Betrieb' : ''}${!stat ? ' – Achtung: Frequenz noch nicht eingeschwungen' : ''}`;
}
// Förderhöhe aus Messwerten (Bernoulli zwischen Saug- und Druckstutzen) – für die Musterlösung
export function hAusMessung(m) {
  const dv = (vRohr(m.q, PO.D_DRUCK) ** 2 - vRohr(m.q, PO.D_SAUG) ** 2) / (2 * G);
  return (m.pd - m.ps) / BAR + PO.DZ_MANO + dv;
}
export function messung(pw, i, art, log) {
  const x = pw.p[i];
  if (art === 'hoeren') {
    const t = !x.run ? 'Pumpe steht – nichts zu hören.' : x.q < 0.5 ? 'Pumpe läuft, aber kein Strömungsgeräusch in der Druckleitung; Gehäuse wird warm.' : x.v > 3 ? 'Unruhiges, brummendes Laufgeräusch (Teillastbetrieb).' : 'Gleichmäßiges Laufgeräusch, Strömungsgeräusch in der Druckleitung.';
    log(`APW-02 ${x.nr} abgehört: ${t}`, 'messung'); return t;
  }
  if (art === 'schw') { if (!x.run) return 'Schwingungsmessung nur bei laufender Pumpe sinnvoll.'; const v = x.v * (0.95 + 0.1 * Math.random()); log(`APW-02 ${x.nr} Schwingschnelle: ${n1(v)} mm/s`, 'messung'); return `${n1(v)} mm/s – ${v < 2.8 ? 'gut' : v < 4.5 ? 'noch zulässig' : 'unzulässig hoch'} (Richtwerte DIN ISO 10816-3)`; }
  if (art === 'temp') { const v = x.tl + (Math.random() - 0.5); log(`APW-02 ${x.nr} Lagertemperatur: ${n1(v)} °C`, 'messung'); return `Lagerträger: ${n1(v)} °C`; }
}
