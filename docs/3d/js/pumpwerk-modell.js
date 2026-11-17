// Prozessmodell Abwasserpumpwerk Talstraße (Außenpumpwerk, Druckleitung zur Kläranlage):
// zwei baugleiche, trocken aufgestellte KSB Sewatec E 100-317 (Laufrad ø286, 1450 1/min, 15 kW),
// P-001 Führung, P-002 Reserve. Kennlinie und Wirkungsgrad wie im Kläranlagen-PLS (KENNLINIEN).
// Wellendichtung: Tandem-Gleitringdichtung mit Vorlagebehälter, Wälzlager fettgeschmiert.
// Zeitbasis: Sekunden Simulationszeit.

const H286 = [29.68, 28.77, 27.90, 27.07, 26.27, 25.50, 24.75, 24.02, 23.31, 22.61, 21.92, 21.23,
  20.53, 19.84, 19.13, 18.40, 17.66, 16.90, 16.11, 15.29, 14.43, 13.53, 12.68];        // Q = 0, 10, … 210, 219 m³/h
const ETA = [[0, 0], [66.6, 55], [83, 60], [111.4, 65], [145.4, 66.8], [184.4, 65], [217.8, 60]];
export const PP = {
  A_SUMPF: 20, LI_EIN: 1.6, LI_AUS: 0.8, LI_RES: 2.3, LI_UEB: 2.8, Z_ACHSE: 0.6,       // Pumpensumpf [m², m]
  H_GEO: 12.5, KD: 0.000876, KS: 0.00004, CV: 0.00008, CVS: 0.00004, Q_SOLL: 100, ETA_M: 0.93,
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const approach = (x, z, tau, dt) => x + (z - x) * (1 - Math.exp(-dt / tau));
function hKenn(q) { if (q <= 0) return H286[0]; if (q >= 219) return Math.max(0, 12.68 - (q - 219) * 0.09); const i = Math.min(20, Math.floor(q / 10)), q0 = i * 10, q1 = i === 20 ? 219 : q0 + 10; return H286[i] + (H286[i + 1] - H286[i]) * (q - q0) / (q1 - q0); }
function eta(q) { for (let i = 1; i < ETA.length; i++) if (q <= ETA[i][0]) { const [a, b] = ETA[i - 1], [c, d] = ETA[i]; return (b + (d - b) * (q - a) / (c - a)) / 100; } return 0.58; }

// Störungskarten (an die Sewatec angepasst) und mögliche Ursachen
export const KARTEN = {
  K1: { kurz: 'Pumpe fördert zu wenig', titel: 'Fördermenge der Pumpe geringer als der Sollwert (Drehzahl in Ordnung)', ursachen: {
    zopf: 'Laufrad durch Faserzopf (Feuchttücher) verlegt',
    spalt: 'Spaltring/Verschleißwand verschlissen (erhöhter Spaltverlust)',
    schieber: 'Druckschieber nach Arbeiten nicht vollständig geöffnet',
    saug: 'Saugschieber stark gedrosselt (Kavitation)' } },
  K2: { kurz: 'Vorlage der Gleitringdichtung steigt', titel: 'Füllstand im Vorlagebehälter der Gleitringdichtung steigt, Flüssigkeit trüb', ursachen: {
    glrd: 'Produktseitige Gleitringdichtung: Gleitflächen verschlissen',
    oring: 'Produktseitige Gleitringdichtung: Nebendichtung (O-Ring) beschädigt',
    trocken: 'Produktseitige Gleitringdichtung nach Trockenlauf beschädigt' } },
  K3: { kurz: 'Pumpe läuft laut', titel: 'Ungewöhnlich laute Laufgeräusche der Pumpe', ursachen: {
    luft: 'Lufteinzug durch Wirbelbildung: Ausschaltpegel zu tief eingestellt',
    lager: 'Wälzlagerschaden im Lagerträger',
    fremd: 'Fremdkörper im Laufrad / Laufrad beschädigt (Unwucht)',
    kupplung: 'Elastische Kupplung verschlissen' } },
  K4: { kurz: 'Leckage an der Wellendichtung', titel: 'Erhöhte Leckage an der Wellendichtung nach außen', ursachen: {
    aussen: 'Atmosphärenseitige Gleitringdichtung verschlissen',
    stopfen: 'Verschraubung am Vorlagebehälter undicht',
    gehaeuse: 'Gehäusedichtung am Gehäusedeckel undicht (Abwasser tritt aus)' } },
};
export const VOR_ORT_BEHEBBAR = ['schieber', 'saug', 'luft', 'stopfen'];

export function createPW(karte = null, ursache = null, falle = false) {
  const pumpe = (nr) => ({ nr, wahl: 'auto', rep: true, schloss: false, vs: 100, vd: 100, ablass: false, run: false, q: 0, h: 0, ps: 0, pd: 0,
    pkw: 0, amp: 0, v: 1.8, tl: 45, vorlage: 60, trueb: 0, puddle: 0, leck: 0, bh: nr === 1 ? 21840 : 19960, starts: 0, stoer: '', tsa: 0, luft: false, kav: false, laeuftT: 0 });
  const pw = { t: 8 * 3600, li: 1.2, liAus: PP.LI_AUS, liEin: PP.LI_EIN, qIn: 70, qUeb: 0, vUeb: 0, flut: 0, p: [pumpe(1), pumpe(2)],
    karte, ursache, falle, alarme: {}, hist: [], histNext: 0, eKwh: 0, vGef: 0, glrdSchaden: false, historie: [] };
  const P1 = pw.p[0];
  if (ursache === 'schieber') P1.vd = 25;
  if (ursache === 'saug') P1.vs = 14;
  if (ursache === 'luft') pw.liAus = 0.3;
  if (ursache === 'trocken') pw.historie.push('Gestern 23:14  P-001 Trockenlaufschutz ausgelöst, vor Ort quittiert');
  if (ursache === 'stopfen' || ursache === 'aussen') P1.vorlage = 38;
  if (karte === 'K2') { P1.vorlage = 78; P1.trueb = 0.7; }
  if (falle) pw.p[1].vd = 0;                                      // Druckschieber der Reservepumpe nach Wartung geschlossen
  pw.historie.push('Vorgestern 10:02  P-002 Wartung abgeschlossen, freigegeben');
  return pw;
}

const verfuegbar = (x) => x.rep && !x.stoer && x.wahl !== '0';

// hydraulischer Betriebspunkt einer Pumpe
function betriebspunkt(pw, x, i) {
  const u = i === 0 ? pw.ursache : null, hzu = pw.li + PP.Z_ACHSE;
  const dVd = x.vd <= 0 ? Infinity : PP.CV * (1 / (x.vd / 100) ** 2 - 1);
  const dVs = x.vs <= 0 ? Infinity : PP.CVS * (1 / (x.vs / 100) ** 2 - 1);
  let hf = 1, qShift = 0, etaF = 1;
  if (u === 'zopf') { hf = 0.82; etaF = 0.85; }
  if (u === 'spalt') { qShift = 40; hf = 0.97; etaF = 0.86; }
  if (u === 'fremd') { hf = 0.96; etaF = 0.95; }
  if (x.luft) { hf *= 0.9; etaF *= 0.92; }
  const hp = (q) => hKenn(q + qShift) * hf;
  const sys = (q) => PP.H_GEO - hzu + (PP.KD + PP.KS) * q * q + (isFinite(dVd) ? dVd * q * q : 1e9) + (isFinite(dVs) ? dVs * q * q : 1e9);
  if (!isFinite(dVd) || !isFinite(dVs) || hp(0) <= PP.H_GEO - hzu) return { q: 0, h: hp(0), hs: hzu, etaF, kav: !isFinite(dVs) };
  let lo = 0, hi = 260;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (hp(m) > sys(m)) lo = m; else hi = m; }
  let q = lo;
  const hsQ = (qq) => hzu - PP.KS * qq * qq - (isFinite(dVs) ? dVs * qq * qq : 0);   // Druckhöhe saugseitig
  const reserve = (qq) => (10.1 + hsQ(qq) - 0.24) - 1.15 * (2.0 + 0.00012 * qq * qq); // NPSHa − 1,15·NPSHr
  let kav = false;
  if (reserve(q) < 0) {                                         // Kavitation begrenzt den Förderstrom
    kav = true; let a = 0, b = q;
    for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (reserve(m) > 0) a = m; else b = m; }
    q = a * 0.97;
  }
  const hs = hsQ(q);
  return { q, h: hp(q), hs, etaF, kav };
}

export function stepPW(pw, dt, log) {
  const h = dt / 3600; pw.t += dt;
  const th = (pw.t / 3600) % 24;
  pw.qIn = 70 * (1 + 0.3 * Math.sin(2 * Math.PI * (th - 7) / 24));
  const [P1, P2] = pw.p;
  // Steuerung: P-001 Führung, P-002 Reserve (ersetzt P-001 oder Spitzenlast)
  const anf = (x, i) => {
    if (!x.rep || x.stoer || x.wahl === '0') return false;
    if (x.wahl === 'hand') return true;
    const lead = i === 0 || !(P1.wahl === 'auto' && verfuegbar(P1));
    const ein = lead ? pw.li >= pw.liEin : pw.li >= PP.LI_RES;
    return x.run ? pw.li > pw.liAus : ein;
  };
  let qOut = 0;
  pw.p.forEach((x, i) => {
    const soll = anf(x, i);
    if (soll && !x.run) { x.starts++; x.laeuftT = 0; }
    x.run = soll; x.laeuftT += x.run ? dt : 0;
    x.luft = x.run && pw.li < 0.7;                                     // Hohlwirbel bei tiefem Pegel
    if (x.run) {
      const b = betriebspunkt(pw, x, i);
      x.kav = b.kav;
      x.q = b.q * (x.luft ? 0.88 + 0.1 * Math.sin(pw.t / 7) : 1); x.h = b.h;
      x.ps = b.hs * 0.0981; x.pd = x.ps + x.h * 0.0981;
      const pW = x.q > 1 ? 1000 * 9.81 * (x.q / 3600) * x.h / (eta(x.q) * b.etaF) / 1000 : 2.4 + 0.02 * x.h;
      const extra = i === 0 ? (pw.ursache === 'lager' ? 0.6 : pw.ursache === 'kupplung' ? 0.2 : 0) : 0;
      x.pkw = (pW + extra) / PP.ETA_M; x.amp = x.pkw * 1000 / (Math.sqrt(3) * 400 * 0.86);
      // Trockenlauf: Saugschieber zu oder Sumpf leer
      if (x.vs <= 2 || pw.li < 0.15) {
        x.tsa += dt;
        if (x.tsa > 20) { x.stoer = 'Trockenlaufschutz (TSA)'; x.run = false; pw.glrdSchaden = pw.glrdSchaden || i === 0; log && log(`P-00${x.nr} Abschaltung durch Trockenlaufschutz – Gleitringdichtung gefährdet`, 'sys'); }
      } else x.tsa = 0;
      if (x.vd <= 2 && x.laeuftT > 300 && !x.heissMeld) { x.heissMeld = true; log && log(`P-00${x.nr} läuft länger gegen geschlossenen Druckschieber – Pumpe erwärmt sich`, 'sys'); }
      x.bh += h;
    } else { x.q = 0; x.h = 0; x.ps = (pw.li + PP.Z_ACHSE) * 0.0981 * (x.vs > 0 ? 1 : 0); x.pd = x.ps; x.pkw = 0; x.amp = 0; x.kav = false; x.luft = false; }
    if (x.ablass) { x.ps = 0; x.pd = x.vd > 0 ? x.pd : 0; }
    qOut += x.q; x.qMax = Math.max(x.qMax || 0, x.q);
    // Schwingung, Lagertemperatur
    const u = i === 0 ? pw.ursache : null;
    let v = 1.8 + (x.q < 50 && x.run ? 1.2 : 0);
    if (x.run) { if (u === 'zopf') v = 4.6; if (u === 'fremd') v = 6.2; if (u === 'lager') v = 7.4; if (u === 'kupplung') v = 4.8; if (x.luft) v = Math.max(v, 5.5); if (x.kav) v = Math.max(v, 6.5); }
    x.v = x.run ? v : 0.1;
    x.tl = approach(x.tl, x.run ? (u === 'lager' ? 86 : u === 'kupplung' ? 55 : 49) : 20, 1800, dt);
    // Gleitringdichtung, Vorlagebehälter, Leckage
    let dVor = 0, leck = 0;
    if (u === 'glrd' || u === 'oring' || u === 'trocken' || (i === 0 && pw.glrdSchaden)) { if (x.run || x.pd > 0.3) { dVor = 2; x.trueb = Math.min(1, x.trueb + 0.05 * h); } }
    if (u === 'aussen' || u === 'stopfen') { dVor = -3; leck = 0.6; }
    if (u === 'gehaeuse' && (x.run || x.pd > 0.3)) leck = 1.2;
    if (u === 'stopfen' && x.stopfenFest) { dVor = 0; leck = 0; }
    x.vorlage = clamp(x.vorlage + dVor * h, 0, 100); x.leck = leck;
    x.puddle = clamp(x.puddle + leck * h * (x.run ? 1 : 0.4), 0, 6);
  });
  // Pumpensumpf, Notüberlauf
  pw.li += (pw.qIn - qOut) * h / PP.A_SUMPF;
  pw.qUeb = 0;
  if (pw.li > PP.LI_UEB) { pw.qUeb = (pw.li - PP.LI_UEB) * PP.A_SUMPF / h; pw.vUeb += pw.qUeb * h; pw.li = PP.LI_UEB; }
  pw.li = Math.max(0.05, pw.li);
  // Entleerung bei offenem Ablass: bei offenen Schiebern läuft Abwasser in den Raum
  pw.p.forEach((x) => { if (x.ablass && (x.vs > 2 || x.vd > 2)) { pw.flut += ((x.vs > 2 ? 40 : 0) + (x.vd > 2 ? 25 : 0)) * h; } });
  pw.q = qOut;
  pw.eKwh += (P1.pkw + P2.pkw) * h; pw.vGef += qOut * h;

  const al = (key, aktiv, text, klasse) => {
    const a = pw.alarme[key];
    if (aktiv && !(a && a.aktiv)) { pw.alarme[key] = { aktiv: true, text, klasse, kommt: pw.t }; log && log(`Leitwarte kommt: ${text}`, 'alarm'); }
    else if (!aktiv && a && a.aktiv) { a.aktiv = false; a.geht = pw.t; log && log(`Leitwarte geht: ${text}`, 'alarm'); }
  };
  al('lih', pw.li > 2.4, 'PW Talstr.: LI-001 Pegel Pumpensumpf hoch', 'W');
  al('ueb', pw.qUeb > 0, 'PW Talstr.: Notüberlauf in Betrieb (Abschlag ins Gewässer)', 'A');
  al('flut', pw.flut > 0.5, 'PW Talstr.: Wassermelder Pumpenraum', 'A');
  pw.p.forEach((x, i) => {
    al(`st${i}`, !!x.stoer || !x.rep, `PW Talstr.: P-00${x.nr} Störung${x.stoer ? ` (${x.stoer})` : ' (Reparaturschalter AUS)'}`, 'A');
    al(`qn${i}`, x.run && x.laeuftT > 120 && x.q < PP.Q_SOLL, `PW Talstr.: P-00${x.nr} Förderstrom unter Sollwert`, 'W');
    al(`ni${i}`, x.wahl !== 'auto', `PW Talstr.: P-00${x.nr} nicht in AUTO`, 'M');
  });
  if (pw.t >= pw.histNext) {
    pw.hist.push({ t: pw.t, li: pw.li, q: qOut, q1: P1.q, q2: P2.q, i1: P1.amp, i2: P2.amp, v1: P1.v, vor: P1.vorlage });
    if (pw.hist.length > 2000) pw.hist.shift();
    pw.histNext = pw.t + 60;
  }
}

export function setupPW(karte) {
  let ursache = null, falle = false;
  if (karte && KARTEN[karte]) { const k = Object.keys(KARTEN[karte].ursachen); ursache = k[Math.floor(Math.random() * k.length)]; falle = Math.random() < 0.35; }
  const pw = createPW(karte, ursache, falle);
  pw.t = 6 * 3600; pw.histNext = pw.t;
  const fl = pw.flut; for (let i = 0; i < 2 * 3600 / 10; i++) stepPW(pw, 10);
  pw.alarme = {}; pw.eKwh = 0; pw.vGef = 0; pw.vUeb = 0; pw.flut = fl;
  pw.p.forEach((x) => { x.qMax = 0; x.heissMeld = false; });
  if (karte) { pw.li = ursache === 'luft' ? 0.85 : 1.35; pw.p[0].run = true; pw.p[1].run = false; }
  if (ursache === 'gehaeuse' || ursache === 'stopfen' || ursache === 'aussen') pw.p[0].puddle = 1.2;
  return pw;
}

// ------------------------------------------------------------------ Bedienhandlungen vor Ort
const n1 = (x) => x.toFixed(1).replace('.', ',');
export const pumpeName = (i) => `P-00${i + 1}`;
export function setWahl(pw, i, w, log) { const x = pw.p[i]; if (x.wahl === w) return; log(`${pumpeName(i)} Wahlschalter ${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[x.wahl]} → ${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[w]}`); x.wahl = w; }
export function setRep(pw, i, ein, log) {
  const x = pw.p[i]; if (x.rep === ein) return;
  if (ein && x.schloss) return 'Reparaturschalter ist mit Vorhängeschloss gesichert – erst Schloss entfernen.';
  x.rep = ein; log(`${pumpeName(i)} Reparaturschalter ${ein ? 'EIN' : 'AUS (0)'}${!ein && x.run ? ' – Pumpe lief noch' : ''}`);
}
export function setSchloss(pw, i, an, log) {
  const x = pw.p[i]; if (an && x.rep) return 'Erst Reparaturschalter auf 0 stellen, dann sichern.';
  x.schloss = an; log(`${pumpeName(i)} Reparaturschalter ${an ? 'mit Vorhängeschloss gegen Wiedereinschalten gesichert' : 'Schloss entfernt'}`);
}
export function setSchieber(pw, i, seite, pos, log) {
  const x = pw.p[i], k = seite === 's' ? 'vs' : 'vd', alt = x[k]; x[k] = clamp(pos, 0, 100);
  log(`${pumpeName(i)} ${seite === 's' ? 'Saugschieber' : 'Druckschieber'} ${Math.round(alt)} → ${Math.round(x[k])} % offen${x.run ? ' (Pumpe läuft)' : ''}`);
}
export function setAblass(pw, i, auf, log) {
  const x = pw.p[i]; x.ablass = auf;
  log(`${pumpeName(i)} Entleerung ${auf ? 'geöffnet' : 'geschlossen'}${auf && (x.vs > 2 || x.vd > 2) ? ' – ACHTUNG: Schieber nicht geschlossen, Abwasser tritt aus!' : ''}${auf && x.run ? ' – Pumpe läuft!' : ''}`);
}
export function quittieren(pw, i, log) {
  const x = pw.p[i]; if (!x.stoer) return 'Keine Störung anstehend.';
  log(`${pumpeName(i)} Störung „${x.stoer}“ quittiert`); x.stoer = ''; x.tsa = 0; return 'Störung quittiert.';
}
export function setEinPegel(pw, v, log) { const alt = pw.liEin; pw.liEin = clamp(v, 1.0, 2.4); log(`Einschaltpegel ${n1(alt)} → ${n1(pw.liEin)} m`); }
export function setAusPegel(pw, v, log) { const alt = pw.liAus; pw.liAus = clamp(v, 0.2, 1.4); log(`Ausschaltpegel ${n1(alt)} → ${n1(pw.liAus)} m`); }
export function stopfenNachziehen(pw, i, log) {
  const x = pw.p[i]; log(`${pumpeName(i)} Verschraubung am Vorlagebehälter nachgezogen`);
  if (i === 0 && pw.ursache === 'stopfen') { x.stopfenFest = true; return 'Verschraubung war locker – nachgezogen, kein Austritt mehr. Vorlageflüssigkeit nachfüllen.'; }
  return 'Verschraubung war fest.';
}
export function vorlageNachfuellen(pw, i, log) { const x = pw.p[i]; log(`${pumpeName(i)} Vorlagebehälter auf Sollstand nachgefüllt (vorher ${Math.round(x.vorlage)} %)`); x.vorlage = 60; if (x.trueb > 0.3) return 'Nachgefüllt – Flüssigkeit war trüb, die Ursache besteht weiter.'; return 'Nachgefüllt.'; }

// Messungen mit Handgeräten / Sinneswahrnehmung (nur Text, Ergebnis ins Protokoll)
export function messung(pw, i, art, log) {
  const x = pw.p[i], u = i === 0 ? pw.ursache : null, n = pumpeName(i);
  if (art === 'temp') { const v = x.tl + (Math.random() - 0.5); log(`${n} Lagertemperatur (Handthermometer, Lagerträger antriebsseitig): ${n1(v)} °C`, 'messung'); return `Lagerträger: ${n1(v)} °C`; }
  if (art === 'schw') { if (!x.run) return 'Schwingungsmessung nur bei laufender Pumpe sinnvoll.'; const v = x.v * (0.95 + 0.1 * Math.random()); log(`${n} Schwingschnelle am Lagerträger: ${n1(v)} mm/s (Effektivwert)`, 'messung'); return `${n1(v)} mm/s – ${v < 2.8 ? 'gut' : v < 4.5 ? 'noch zulässig' : v < 7.1 ? 'unzulässig hoch, Ursache klären' : 'Schadensbereich'} (Richtwerte DIN ISO 10816-3)`; }
  if (art === 'hoeren') {
    let t;
    if (!x.run) t = 'Pumpe steht – nichts zu hören.';
    else if (x.kav) t = 'Prasselndes Geräusch wie „Kies in der Pumpe“ am Saugstutzen.';
    else if (x.luft) t = 'Schlürfendes, unregelmäßiges Geräusch, Förderstrom schwankt.';
    else if (u === 'lager') t = 'Rumpelndes, mahlendes Geräusch am Lagerträger, Lagerträger fühlbar heiß.';
    else if (u === 'fremd') t = 'Rhythmisches Klopfen im Takt der Drehzahl, deutliche Vibration.';
    else if (u === 'kupplung') t = 'Klappern im Bereich der Kupplung, besonders beim Anlauf.';
    else if (u === 'zopf') t = 'Unruhiger Lauf, leichte Vibration.';
    else t = 'Gleichmäßiges Laufgeräusch, unauffällig.';
    log(`${n} abgehört: ${t}`, 'messung'); return t;
  }
  if (art === 'sicht') {
    let t = [];
    if (u === 'kupplung') t.push('unter dem Kupplungsschutz liegt schwarzer Gummiabrieb');
    if (x.leck > 0 && u === 'gehaeuse') t.push('Abwasser tritt am Gehäusedeckel aus');
    if (x.leck > 0 && u === 'aussen') t.push('Tropfen am Dichtungsgehäuse zwischen Pumpe und Lagerträger');
    if (x.leck > 0 && u === 'stopfen') t.push('Tropfen an der Verschraubung des Vorlagebehälters');
    if (x.trueb > 0.3) t.push('Vorlageflüssigkeit trüb, grau-bräunlich');
    if (!t.length) t.push('keine Auffälligkeiten');
    const s = t.join('; '); log(`${n} Sichtprüfung: ${s}`, 'messung'); return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }
}
