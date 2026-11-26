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

// ------------------------------------------------------------------ Niveaumessung LI-001 (Messkette)
// Hydrostatische Pegelsonde (0–5 mWS, 4–20 mA, Einbau 0,10 m über Sohle) → Klemmenkasten am Sumpf → Feldkabel →
// Trennverstärker im Schaltschrank → Analogeingang der Steuerung (Skalierung Messbereich + Einbauhöhe).
// Schwimmerschalter: S1 Trockenlauf 0,45 m (hart), S2 Notbetrieb EIN 2,00 m (Nachlauf 25 min), S3 Hochwasser 2,50 m.
export const PEGEL_KARTE = { kurz: 'Pegelmessung unplausibel', titel: 'Niveaumessung LI-001 / Niveausteuerung gestört', ursachen: {
  kabel: 'Leitungsunterbrechung: Ader im Klemmenkasten am Sumpf korrodiert und abgerissen',
  feucht: 'Feuchtigkeit im Klemmenkasten (Nebenschluss), Messwert springt',
  kap: 'Pegelsonde defekt: Wasser in der Druckausgleichskapillare, Messwert driftet',
  schlamm: 'Pegelsonde von der Halterung gerutscht, liegt verschlammt auf der Sohle',
  skal: 'Messbereich in der Steuerung falsch eingestellt (4 m statt 5 m) nach Sondentausch',
  trenn: 'Trennverstärker im Schaltschrank defekt (Ausgang hängt)',
  hw: 'Hochwasserschwimmer S3 verhakt – Pegelmessung in Ordnung' } };
export const LI = { BEZUG: 3.95, EINBAU: 0.10, MB: 5, S1: 0.45, S1_AUS: 0.7, S2: 2.0, S3: 2.5, NACHLAUF: 1500 };
function createLM() {
  return { ursache: null, mbPar: LI.MB, sondeOut: false, lage: 'ok', schlamm: false, kap: false, ader: true, feucht: false, kkOffen: false, trenn: true,
    modus: 'sonde', hwHaengt: false, iSf: 4, iLoop: 4, iOut: 4, liAnz: 0, valid: true, s1: false, s2: false, s3: false, nach: 0, mess: [], prot: { vor: null, nach: null }, getauscht: { sonde: 0, trenn: 0 }, behobenT: null };
}
function stepLM(pw, dt, log) {
  const L = pw.lm, t = pw.t;
  const drift = L.kap ? 0.16 + 0.2 * Math.sin(t / 4100) + 0.07 * Math.sin(t / 970) : 0;
  const hLage = L.lage === 'sohle' ? 0 : LI.EINBAU;
  const hS = L.sondeOut ? 0 : Math.max(0, pw.li - hLage) + (L.schlamm ? 0.14 : 0);
  const iS = clamp(4 + 16 * (hS + drift) / LI.MB, 3.9, 20.5);
  L.iSf = L.schlamm && !L.sondeOut ? approach(L.iSf, iS, 400, dt) : iS;
  const shunt = L.feucht ? 1.3 + 0.9 * Math.sin(t / 47) * Math.sin(t / 13) + 0.35 * Math.sin(t / 5) : 0;
  L.iLoop = L.ader ? L.iSf + shunt : 0;
  L.iOut = L.trenn ? L.iLoop : 12.0;
  const v = L.iOut >= 3.6 && L.iOut <= 21;
  if (!v && L.valid) { log && log('Steuerung PW Talstr.: LI-001 Messwert gestört (Strom < 3,6 mA) – Umschaltung auf Schwimmer-Notbetrieb', 'sys'); L.modus = 'schwimmer'; }
  L.valid = v;
  L.liAnz = v ? (L.iOut - 4) / 16 * L.mbPar + LI.EINBAU : null;
  L.s1 = L.s1 ? pw.li < LI.S1_AUS : pw.li < LI.S1;
  L.s2 = pw.li >= LI.S2; L.s3 = L.hwHaengt || pw.li >= LI.S3;
  if (L.s2) L.nach = LI.NACHLAUF; else L.nach = Math.max(0, L.nach - dt);
}

export function createPW(karte = null, ursache = null, falle = false) {
  const pumpe = (nr) => ({ nr, wahl: 'auto', rep: true, schloss: false, vs: 100, vd: 100, ablass: false, run: false, q: 0, h: 0, ps: 0, pd: 0,
    pkw: 0, amp: 0, v: 1.8, tl: 45, vorlage: 60, trueb: 0, puddle: 0, leck: 0, bh: nr === 1 ? 21840 : 19960, starts: 0, stoer: '', tsa: 0, luft: false, kav: false, laeuftT: 0 });
  const pw = { t: 8 * 3600, li: 1.2, liAus: PP.LI_AUS, liEin: PP.LI_EIN, qIn: 70, qUeb: 0, vUeb: 0, flut: 0, p: [pumpe(1), pumpe(2)],
    karte, ursache, ursache0: ursache, falle, alarme: {}, hist: [], histNext: 0, eKwh: 0, vGef: 0, glrdSchaden: false, historie: [], lm: createLM() };
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

const verfuegbar = (x) => x.rep && !x.stoer && x.wahl !== '0' && !x.ausgebaut;

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
  stepLM(pw, dt, log);
  const L = pw.lm;
  const anf = (x, i) => {
    if (!x.rep || x.stoer || x.wahl === '0' || x.ausgebaut) return false;
    if (x.wahl === 'hand') return true;
    if (L.s1) return false;                                            // Trockenlaufschwimmer: hart aus
    if (L.s3) return true;                                             // Hochwasserschwimmer: alle verfügbaren Pumpen
    const lead = i === 0 || !(P1.wahl === 'auto' && verfuegbar(P1));
    if (L.modus === 'schwimmer' || !L.valid) return lead && (x.run ? L.nach > 0 : L.s2);
    const lv = L.liAnz;
    const ein = lead ? lv >= pw.liEin : lv >= PP.LI_RES;
    return x.run ? lv > pw.liAus : ein;
  };
  let qOut = 0;
  pw.p.forEach((x, i) => {
    const soll = anf(x, i);
    if (soll && !x.run) {
      x.starts++; x.laeuftT = 0;
      if (i === 0 && x.vorlage < 20 && !pw.vorlageLeerMeld) {         // nach Dichtungstausch nicht befüllt
        pw.vorlageLeerMeld = true; if (!pw.ursache) pw.ursache = 'aussen';
        log && log('P-001 läuft mit leerem Vorlagebehälter an – die atmosphärenseitige Gleitringdichtung läuft trocken', 'sys');
      }
    }
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
    if (x.ablass || x.ausgebaut) { x.ps = 0; x.pd = 0; }
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
  al('lih', L.valid && L.liAnz > 2.4, 'PW Talstr.: LI-001 Pegel Pumpensumpf hoch', 'W');
  al('lim', !L.valid, 'PW Talstr.: LI-001 Messwert gestört', 'A');
  al('hw', L.s3, 'PW Talstr.: Hochwasserschwimmer S3 angesprochen', 'A');
  al('tl', L.s1, 'PW Talstr.: Trockenlaufschwimmer S1 angesprochen', 'W');
  al('not', L.modus === 'schwimmer', 'PW Talstr.: Niveausteuerung im Schwimmer-Notbetrieb', 'M');
  al('ueb', pw.qUeb > 0, 'PW Talstr.: Notüberlauf in Betrieb (Abschlag ins Gewässer)', 'A');
  al('flut', pw.flut > 0.5, 'PW Talstr.: Wassermelder Pumpenraum', 'A');
  pw.p.forEach((x, i) => {
    al(`st${i}`, !!x.stoer || !x.rep, `PW Talstr.: P-00${x.nr} Störung${x.stoer ? ` (${x.stoer})` : ' (Reparaturschalter AUS)'}`, 'A');
    al(`qn${i}`, x.run && x.laeuftT > 120 && x.q < PP.Q_SOLL, `PW Talstr.: P-00${x.nr} Förderstrom unter Sollwert`, 'W');
    al(`ni${i}`, x.wahl !== 'auto', `PW Talstr.: P-00${x.nr} nicht in AUTO`, 'M');
  });
  if (pw.t >= pw.histNext) {
    pw.hist.push({ t: pw.t, li: L.valid ? L.liAnz : 0, lw: pw.li, q: qOut, q1: P1.q, q2: P2.q, i1: P1.amp, i2: P2.amp, v1: P1.v, vor: P1.vorlage });
    if (pw.hist.length > 2000) pw.hist.shift();
    pw.histNext = pw.t + 60;
  }
}

export function setupPW(karte, opt = {}) {
  let ursache = null, falle = false;
  if (karte && KARTEN[karte]) {
    let k = Object.keys(KARTEN[karte].ursachen);
    if (opt.werkstatt) k = k.filter((u) => SCHADTEIL[u]);              // nur Ursachen, die in der Werkstatt zu beheben sind
    ursache = k[Math.floor(Math.random() * k.length)]; falle = !opt.werkstatt && Math.random() < 0.35;
  }
  const pw = createPW(karte, ursache, falle);
  if (opt.pegel) {                                                    // Mission Niveaumessung: Ursache zufällig
    const k = Object.keys(PEGEL_KARTE.ursachen), u = opt.ursache || k[Math.floor(Math.random() * k.length)], L = pw.lm;
    pw.karte = 'LM'; L.ursache = u; pw.ursache0 = u;
    if (u === 'kabel') L.ader = false; if (u === 'feucht') L.feucht = true; if (u === 'kap') L.kap = true;
    if (u === 'schlamm') { L.lage = 'sohle'; L.schlamm = true; } if (u === 'skal') { L.mbPar = 4; pw.historie.push('Vor 6 Tagen  Pegelsonde LI-001 durch Fremdfirma getauscht (anderes Fabrikat)'); }
    if (u === 'trenn') L.trenn = false; if (u === 'hw') L.hwHaengt = true;
    pw.historie.push('Heute 03:12  Bereitschaft: Störmeldung PW Talstraße, Niveausteuerung auffällig');
  }
  pw.t = 6 * 3600; pw.histNext = pw.t;
  const fl = pw.flut; for (let i = 0; i < 2 * 3600 / 10; i++) stepPW(pw, 10);
  pw.alarme = {}; pw.eKwh = 0; pw.vGef = 0; pw.vUeb = 0; pw.flut = fl;
  pw.p.forEach((x) => { x.qMax = 0; x.heissMeld = false; });
  if (karte) { pw.li = ursache === 'luft' ? 0.85 : 1.35; pw.p[0].run = true; pw.p[1].run = false; }
  if (ursache === 'gehaeuse' || ursache === 'stopfen' || ursache === 'aussen') pw.p[0].puddle = 1.2;
  if (opt.werkstatt) {                                                // P-001 bereits freigeschaltet und ausgebaut, P-002 in Betrieb
    Object.assign(pw.p[0], { wahl: '0', rep: false, schloss: true, vs: 0, vd: 0, ablass: true, run: false });
    pw.historie.unshift('Heute 06:40  P-001 außer Betrieb genommen, Einschubeinheit in die Werkstatt');
    for (let i = 0; i < 60; i++) stepPW(pw, 10);
    ausbauen(pw, () => {}); pw.alarme = {}; pw.p[1].qMax = 0;
  }
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
  const raus = x.ablass && alt <= 2 && x[k] > 2;
  if (raus) pw.flut += 1;                                           // Abwasser schießt aus der offenen Entleerung
  log(`${pumpeName(i)} ${seite === 's' ? 'Saugschieber' : 'Druckschieber'} ${Math.round(alt)} → ${Math.round(x[k])} % offen${x.run ? ' (Pumpe läuft)' : ''}${raus ? ' – ACHTUNG: Entleerung offen, Abwasser tritt aus!' : ''}`);
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

// ------------------------------------------------------------------ Werkstatt (Stufe 2): Ausbau der Einschubeinheit, Befund, Instandsetzung
// Sewatec in Rückziehbauweise: Das Spiralgehäuse bleibt in der Rohrleitung, die Einschubeinheit
// (Gehäusedeckel, Laufrad, Dichtungen, Lagerträger mit Welle und Lagern) wird mit der Kupplung ausgebaut.
export const TEILE = [
  { id: 'kupplung', nr: '840', name: 'Elastische Kupplung mit Elastomerkranz', preis: 45, ersetzbar: 'Elastomerkranz erneuern',
    fkt: 'Überträgt das Drehmoment vom Motor auf die Pumpenwelle und gleicht kleine Fluchtungsfehler aus. Der Elastomerkranz ist Verschleißteil.' },
  { id: 'gehaeuse', nr: '102', name: 'Spiralgehäuse', reinigen: true,
    fkt: 'Sammelt das vom Laufrad beschleunigte Wasser und wandelt Geschwindigkeit in Druck um. Bleibt bei der Rückziehbauweise in der Rohrleitung eingebaut.' },
  { id: 'verschleiss', nr: '135 / 502', name: 'Verschleißwand mit Spaltring', preis: 180, messen: 'Spaltmaß messen (Fühlerlehre)', ersetzbar: 'Verschleißwand/Spaltring erneuern',
    fkt: 'Bildet mit dem Laufrad den engen Dichtspalt zwischen Druck- und Saugseite. Wird der Spalt durch Verschleiß größer, strömt Wasser zurück – Förderstrom und Wirkungsgrad sinken.' },
  { id: 'mutter', nr: '922', name: 'Laufradmutter mit Sicherung', preis: 12, ersetzbar: 'Laufradmutter erneuern',
    fkt: 'Hält das Laufrad auf dem Wellenende. Beim Lösen Drehrichtung beachten, Sicherung beim Zusammenbau erneuern.' },
  { id: 'laufrad', nr: '230', name: 'Laufrad (Zweikanalrad ø 286)', preis: 950, reinigen: true, ersetzbar: 'Neues Laufrad einbauen',
    fkt: 'Überträgt die Energie auf das Abwasser. Das Kanalrad hat große freie Durchgänge für Feststoffe; Fasern können sich trotzdem an den Eintrittskanten festsetzen (Zopfbildung).' },
  { id: 'gdicht', nr: '400', name: 'Gehäusedichtung (Flachdichtung)', preis: 25, ersetzbar: 'Neue Gehäusedichtung einlegen',
    fkt: 'Dichtet Spiralgehäuse und Gehäusedeckel gegeneinander ab. Flachdichtungen werden nach jeder Demontage erneuert.' },
  { id: 'deckel', nr: '161', name: 'Gehäusedeckel', fkt: 'Schließt das Spiralgehäuse zur Antriebsseite und nimmt die Gleitringdichtung auf.' },
  { id: 'glrd1', nr: '433.01', name: 'Gleitringdichtung produktseitig (mit O-Ringen)', preis: 1150, ersetzbar: 'Gleitringdichtung erneuern',
    fkt: 'Dichtet die Welle gegen das Abwasser ab. Ein rotierender und ein stehender Gleitring (Siliciumcarbid) laufen mit einem dünnen Flüssigkeitsfilm aufeinander; Nebendichtungen (O-Ringe) dichten statisch.' },
  { id: 'vorlage', nr: '441 / 591', name: 'Dichtungsgehäuse mit Vorlagebehälter', fkt: 'Raum zwischen den beiden Gleitringdichtungen, gefüllt mit Vorlageflüssigkeit (Wasser-Glykol) aus dem Vorlagebehälter.' },
  { id: 'glrd2', nr: '433.02', name: 'Gleitringdichtung atmosphärenseitig', preis: 640, ersetzbar: 'Gleitringdichtung erneuern',
    fkt: 'Dichtet den Vorlageraum nach außen ab. Wird von der Vorlageflüssigkeit geschmiert und gekühlt – ohne Vorlage läuft sie trocken.' },
  { id: 'welle', nr: '210', name: 'Welle', preis: 620, messen: 'Rundlauf messen (Messuhr)', ersetzbar: 'Neue Welle einbauen',
    fkt: 'Trägt das Laufrad und überträgt das Drehmoment. Rundlauffehler führen zu Unwucht und Dichtungsverschleiß.' },
  { id: 'lager', nr: '321 / 322', name: 'Wälzlager (Satz pumpen- und antriebsseitig)', preis: 160, messen: 'Lager von Hand drehen, Lagerspiel prüfen', ersetzbar: 'Neue Lager einbauen und mit Fett befüllen',
    fkt: 'Nehmen Radial- und Axialkräfte der Welle auf. Fettgeschmiert; Lager werden immer paarweise getauscht.' },
  { id: 'lagertr', nr: '330', name: 'Lagerträger', fkt: 'Gehäuse für Welle und Lager, verbindet die Einschubeinheit mit dem Fuß.' },
  { id: 'motor', nr: '800', name: 'Drehstrommotor 15 kW IE3', messen: 'Isolationsmessung (Elektrofachkraft)', fkt: 'Antrieb. Wird nicht zerlegt; elektrische Prüfung durch eine Elektrofachkraft.' },
];
const BEFUND = {
  kupplung: { kupplung: 'Elastomerkranz stark abgerieben, Zähne rissig und teilweise abgeschert, schwarzer Gummistaub im Kupplungsschutz.' },
  verschleiss: { spalt: 'Verschleißwand mit tiefen Riefen und Auswaschungen, Spalt deutlich vergrößert.' },
  laufrad: { zopf: 'Dicker Faserzopf (Feuchttücher, Haare) um Nabe und Eintrittskanten gewickelt, Kanäle teilweise zugesetzt.', fremd: 'Stein im Laufradkanal verklemmt, eine Schaufeleintrittskante ausgebrochen – Laufrad unwuchtig.', spalt: 'Laufrad an der Saugseite leicht angelaufen, sonst in Ordnung.' },
  gdicht: { gehaeuse: 'Flachdichtung versprödet, an einer Stelle eingerissen, Auswaschung an der Dichtfläche des Deckels.' },
  glrd1: { glrd: 'Gleitflächen eingelaufen, umlaufende Riefen; Dichtspalt nicht mehr dicht (Abwasser im Vorlageraum).', oring: 'Gleitflächen glatt, aber O-Ring des stehenden Gleitrings gequollen und eingerissen.', trocken: 'Gleitflächen mit Brandrissen (thermische Risse) und Verfärbung – typisches Bild nach Trockenlauf.' },
  vorlage: { glrd: 'Vorlageflüssigkeit trüb, Schlamm am Boden des Dichtungsgehäuses.', oring: 'Vorlageflüssigkeit trüb, Schlamm am Boden des Dichtungsgehäuses.', trocken: 'Vorlageflüssigkeit trüb, Schlamm am Boden des Dichtungsgehäuses.', stopfen: 'Gewinde der Verschraubung in Ordnung, Dichtring flachgedrückt.' },
  glrd2: { aussen: 'Gleitflächen verschlissen, Riefen; Spuren von Vorlageflüssigkeit an der Atmosphärenseite.' },
  lager: { lager: 'Pumpenseitiges Lager rau und mit spürbarem Spiel, Laufbahn mit Pittings, Fett verbraucht und dunkel verfärbt.' },
  welle: { lager: 'Rundlauf in Ordnung; Lagersitz pumpenseitig leicht angelaufen, noch maßhaltig.' },
};
const MESS = {
  verschleiss: (u) => u === 'spalt' ? 'Spaltmaß 2,4 mm (Neuzustand 0,3–0,5 mm, Grenzwert 1,0 mm)' : 'Spaltmaß 0,5 mm (Neuzustand 0,3–0,5 mm) – in Ordnung',
  welle: (u) => `Rundlauf am Laufradsitz ${u === 'fremd' ? '0,04' : '0,02'} mm (zulässig 0,05 mm) – in Ordnung`,
  lager: (u) => u === 'lager' ? 'Pumpenseitiges Lager läuft rau, deutliches Radialspiel – Lagerschaden' : 'Lager laufen leicht und ruhig, kein spürbares Spiel',
  motor: () => 'Isolationswiderstand > 100 MΩ, Wicklungen symmetrisch – Motor in Ordnung',
};
// Welche Instandsetzung beseitigt die Ursache?
const REPARATUR = { zopf: (t) => t.laufrad.gereinigt || t.laufrad.ersetzt, fremd: (t) => t.laufrad.ersetzt, spalt: (t) => t.verschleiss.ersetzt,
  glrd: (t) => t.glrd1.ersetzt, oring: (t) => t.glrd1.ersetzt, trocken: (t) => t.glrd1.ersetzt, aussen: (t) => t.glrd2.ersetzt,
  gehaeuse: (t) => t.gdicht.ersetzt, lager: (t) => t.lager.ersetzt, kupplung: (t) => t.kupplung.ersetzt };
export const SCHADTEIL = { zopf: 'laufrad', fremd: 'laufrad', spalt: 'verschleiss', glrd: 'glrd1', oring: 'glrd1', trocken: 'glrd1', aussen: 'glrd2', gehaeuse: 'gdicht', lager: 'lager', kupplung: 'kupplung' };
export const PUMPEN_URSACHEN = Object.keys(REPARATUR);

export function befundText(pw, id) { const b = BEFUND[id] && BEFUND[id][pw.wsUrsache]; const t = pw.ws.teile[id]; if (t.ersetzt) return 'Neuteil eingebaut.'; if (t.gereinigt && id === 'laufrad') return pw.wsUrsache === 'fremd' ? 'Gereinigt, Stein entfernt – die ausgebrochene Schaufelkante bleibt.' : 'Gereinigt, Kanäle frei, Schaufeln unbeschädigt.'; return b || 'Ohne Befund – keine Verschleiß- oder Schadensspuren.'; }
export function ausbauBereit(pw) {
  const x = pw.p[0], f = [];
  if (x.run) f.push('Pumpe läuft');
  if (x.rep) f.push('Reparaturschalter nicht auf 0');
  if (!x.schloss) f.push('Reparaturschalter nicht gegen Wiedereinschalten gesichert');
  if (x.vd > 2) f.push('Druckschieber nicht geschlossen');
  if (x.vs > 2) f.push('Saugschieber nicht geschlossen');
  if (!x.ablass) f.push('Pumpe nicht entleert (Entleerung zu)');
  return f;
}
export function ausbauen(pw, log) {
  const f = ausbauBereit(pw);
  if (f.length) { log(`P-001 Ausbau versucht, nicht freigegeben: ${f.join(', ')}`); return `Ausbau nicht zulässig: ${f.join(', ')}.`; }
  const x = pw.p[0]; x.ausgebaut = true; x.puddle = 0; pw.flut = 0;
  pw.wsUrsache = pw.ursache;
  pw.ws = { kosten: 0, eingebaut: false, teile: Object.fromEntries(TEILE.map((t) => [t.id, { befund: false, gemessen: false, gereinigt: false, ersetzt: false }])) };
  log('P-001 Einschubeinheit ausgebaut und in die Werkstatt gebracht (Spiralgehäuse bleibt eingebaut)');
  return null;
}
export function teilAktion(pw, id, art, log) {
  const T = TEILE.find((t) => t.id === id), t = pw.ws.teile[id], u = pw.wsUrsache;
  if (art === 'befund') { t.befund = true; const b = befundText(pw, id); log(`Werkstatt Befund ${T.name}: ${b}`, 'messung'); return b; }
  if (art === 'messen') { t.gemessen = true; const m = MESS[id](u); log(`Werkstatt ${T.messen}: ${m}`, 'messung'); return m; }
  if (art === 'reinigen') { t.gereinigt = true; log(`Werkstatt ${T.name} gereinigt`); return befundText(pw, id); }
  if (art === 'ersetzen') { t.ersetzt = true; pw.ws.kosten += T.preis || 0; log(`Werkstatt ${T.name}: ${T.ersetzbar} (${T.preis} €)`); return `${T.ersetzbar}.`; }
}
export const wsRepariert = (pw) => { const u = pw.wsUrsache; return !REPARATUR[u] || REPARATUR[u](pw.ws.teile); };
export function einbauen(pw, log) {
  const x = pw.p[0], t = pw.ws.teile, u = pw.wsUrsache;
  const ok = !u || !REPARATUR[u] || REPARATUR[u](t);
  if (REPARATUR[u] && ok) pw.ursache = null;
  if (t.glrd1.ersetzt) { pw.glrdSchaden = false; x.trueb = 0; }
  if (t.glrd1.ersetzt || t.glrd2.ersetzt) x.vorlage = 0;                // Dichtungsraum nach Tausch leer
  x.ausgebaut = false; x.puddle = 0; x.qMax = 0; x.stopfenFest = x.stopfenFest || u === 'stopfen';
  pw.ws.eingebaut = true; pw.ws.repariert = ok; pw.vorlageLeerMeld = false;
  log(`P-001 Einschubeinheit wieder eingebaut (Ersatzteile ${pw.ws.kosten} €)`);
}

// ------------------------------------------------------------------ Niveaumessung: Handlungen vor Ort
const n2 = (x) => x.toFixed(2).replace('.', ','), nmA = (x) => x.toFixed(2).replace('.', ',');
const imSonde = (pw) => (pw.lm.modus === 'sonde' ? ' – Niveausteuerung lief im Sondenbetrieb!' : '');
export const lmBehoben = (pw) => { const L = pw.lm, u = L.ursache; return !u || ({ kabel: L.ader, feucht: !L.feucht, kap: !L.kap, schlamm: !L.schlamm && L.lage === 'ok', skal: L.mbPar === LI.MB, trenn: L.trenn, hw: !L.hwHaengt })[u]; };
function merkBehoben(pw, log) { if (pw.lm.ursache && lmBehoben(pw) && pw.lm.behobenT === null) { pw.lm.behobenT = pw.t; log(`LI-001 Instandsetzung abgeschlossen`, 'sys'); } }
// Messwerte merken (Zeit, Phase, Anzeige im selben Moment) – Grundlage für die Prüfung der Protokolle
function merkMess(pw, k, v) { const L = pw.lm; L.mess.push({ k, v: Math.round(v * 100) / 100, t: pw.t, nach: L.behobenT !== null, anz: L.valid ? Math.round(L.liAnz * 100) / 100 : null }); }
export function abstich(pw, log) { const a = LI.BEZUG - pw.li + (Math.random() - 0.5) * 0.01; log(`Abstich LI-001 (Lichtlot ab OK Lukenrahmen): ${n2(a)} m`, 'messung'); pw.lm.abstich = { a, t: pw.t, anz: pw.lm.valid ? pw.lm.liAnz : null }; merkMess(pw, 'ab', a); return `Lichtlot: Wasserspiegel ${n2(a)} m unter OK Lukenrahmen.`; }
export function schwimmerPruefen(pw, k, log) {
  const L = pw.lm, nm = ['', 'S1 Trockenlauf', 'S2 Notbetrieb EIN', 'S3 Hochwasser'][k];
  let t;
  if (k === 3 && L.hwHaengt) t = 'Schwimmer S3 hängt mit dem Kabel an einem Steigeisen verhakt, Kugel steht senkrecht nach oben – Kontakt dauerhaft betätigt.';
  else t = `Schwimmer ${nm} hängt frei, Kabel unbeschädigt; beim Anheben schaltet er hörbar – Rückmeldung an der Steuerung kommt.`;
  log(`Schwimmerschalter ${nm} geprüft: ${t}`, 'messung'); return t;
}
export function schwimmerFrei(pw, log) { const L = pw.lm; if (!L.hwHaengt) return 'Alle Schwimmer hängen frei.'; L.hwHaengt = false; log('Schwimmer S3 vom Steigeisen gelöst, Kabel neu am Halter abgefangen'); merkBehoben(pw, log); return 'Schwimmer S3 hängt wieder frei.'; }
export function sondeZiehen(pw, raus, log) {
  const L = pw.lm; if (L.sondeOut === raus) return null;
  if (raus) { L.sondeOut = true; log(`Pegelsonde LI-001 aus dem Sumpf gezogen${imSonde(pw)}`); return null; }
  L.sondeOut = false; L.lage = 'ok'; log('Pegelsonde LI-001 eingehängt, Kabelmarkierung auf Halteklemme (Einbauhöhe 0,10 m über Sohle)'); merkBehoben(pw, log); return null;
}
export function sondeBegutachten(pw, log) {
  const L = pw.lm; if (!L.sondeOut) return 'Die Sonde hängt im Sumpf – zum Begutachten erst ziehen.';
  const t = L.schlamm ? 'Membranschutzkappe mit Schlamm und Sand zugesetzt; Kabelmarkierung „0,10 m“ lag 0,1 m unterhalb der Halteklemme – die Sonde ist abgerutscht und lag auf der Sohle.'
    : L.kap ? 'Sonde äußerlich sauber. Kabelmantel ca. 2 m über der Sonde eingerissen, die Druckausgleichskapillare ist dort offen; im Kabelende im Klemmenkasten Wassertropfen.'
    : 'Sonde und Kabel äußerlich in Ordnung, Membranschutz frei, Kabelmarkierung an der Halteklemme.';
  log(`Pegelsonde LI-001 begutachtet: ${t}`, 'messung'); return t;
}
export function sondeReinigen(pw, log) { const L = pw.lm; if (!L.sondeOut) return 'Erst ziehen.'; L.schlamm = false; log('Pegelsonde LI-001 gereinigt (Membranschutzkappe gespült)'); return 'Sonde gereinigt.'; }
export function sondeTauschen(pw, log) { const L = pw.lm; if (!L.sondeOut) return 'Erst ziehen.'; L.kap = false; L.schlamm = false; L.getauscht.sonde++; log(`Pegelsonde LI-001 gegen Ersatzsonde aus dem Lager getauscht (0–5 mWS, 4–20 mA)${imSonde(pw)}`); return 'Ersatzsonde angeschlossen – noch einhängen.'; }
export function kkOeffnen(pw, auf, log) { pw.lm.kkOffen = auf; log(`Klemmenkasten LI-001 am Sumpf ${auf ? 'geöffnet' : 'geschlossen'}`); }
export function kkSicht(pw, log) {
  const L = pw.lm; if (!L.kkOffen) return 'Klemmenkasten ist geschlossen.';
  const t = !L.ader ? 'Ader 1 (+) an Klemme X1:1 grün korrodiert und aus der Aderendhülse abgerissen; übrige Klemmen in Ordnung.'
    : L.feucht ? 'Kondenswasser im Gehäuse, Deckeldichtung spröde und gerissen, Klemmen beschlagen.'
    : L.kap ? 'Klemmen trocken; am Ende des Sondenkabels tritt aus der Kapillare etwas Wasser aus.'
    : 'Klemmen trocken und fest, Dichtung in Ordnung.';
  log(`Klemmenkasten LI-001 Sichtprüfung: ${t}`, 'messung'); return t;
}
export function kkMessen(pw, art, log) {
  const L = pw.lm; let t;
  if (art === 'loop') { const i = L.iLoop + (L.iLoop > 0 ? (Math.random() - 0.5) * 0.02 : 0); L.iGem = { i, t: pw.t }; merkMess(pw, 'loop', i); t = `Schleifenstrom an der Prüfbuchse der Trennklemme: ${nmA(i)} mA`; }
  else if (!L.kkOffen) return 'Für diese Messung den Klemmenkasten öffnen.';
  else if (art === 'sonde') t = `Strom in der Sondenader (Multimeter in Reihe): ${nmA(L.ader ? L.iSf : 0)} mA${L.sondeOut ? ' (Sonde an Luft)' : ''}`;
  else t = `Spannung an den Sondenklemmen X1:1/X1:2: ${L.ader ? '15,6' : '24,1'} V`;
  log(`LI-001 ${t}`, 'messung'); return t;
}
export function aderAuflegen(pw, log) { const L = pw.lm; if (!L.kkOffen) return 'Erst öffnen.'; if (L.ader) return 'Alle Adern fest.'; L.ader = true; log(`Ader 1 an X1:1 gekürzt, neu abisoliert, neue Aderendhülse, aufgelegt${imSonde(pw)}`); merkBehoben(pw, log); return 'Ader neu aufgelegt.'; }
export function kkTrocknen(pw, log) { const L = pw.lm; if (!L.kkOffen) return 'Erst öffnen.'; L.feucht = false; log(`Klemmenkasten getrocknet, Klemmen gereinigt, Deckeldichtung und Kabelverschraubung erneuert${imSonde(pw)}`); merkBehoben(pw, log); return 'Klemmenkasten trocken, neue Dichtung.'; }
export function tvMessen(pw, wo, log) { const L = pw.lm, i0 = wo === 'ein' ? L.iLoop : L.iOut, i = i0 + (i0 > 0 ? (Math.random() - 0.5) * 0.02 : 0); merkMess(pw, wo === 'ein' ? 'tvE' : 'tvA', i); const t = `Trennverstärker ${wo === 'ein' ? 'Eingang (Feldseite)' : 'Ausgang (zur Steuerung)'}: ${nmA(i)} mA`; log(`LI-001 ${t}`, 'messung'); return t; }
export function tvTauschen(pw, log) { const L = pw.lm; L.trenn = true; L.getauscht.trenn++; log(`Trennverstärker LI-001 gegen Ersatzgerät aus dem Lager getauscht${imSonde(pw)}`); merkBehoben(pw, log); return 'Trennverstärker getauscht.'; }
export function setNiveauModus(pw, m, log) { const L = pw.lm; if (m === L.modus) return null; if (m === 'sonde' && !L.valid) return 'Sondenbetrieb nicht möglich – Messwert gestört.'; L.modus = m; log(`Niveausteuerung auf ${m === 'sonde' ? 'Sondenbetrieb (LI-001)' : 'Schwimmer-Notbetrieb'} umgeschaltet`); return null; }
export function setMessbereich(pw, v, log) { const L = pw.lm, a = L.mbPar; L.mbPar = clamp(Math.round(v * 100) / 100, 1, 10); log(`Parameter LI-001 Messbereichsendwert ${n2(a)} → ${n2(L.mbPar)} m${imSonde(pw)}`); merkBehoben(pw, log); }
export const PROT_ART = { vor: 'vor der Instandsetzung', nach: 'nach der Instandsetzung' };
export function protokollAblegen(pw, art, e, log) {
  const L = pw.lm, neu = !L.prot[art]; L.prot[art] = { e: { ...e }, t: pw.t };
  const f = (x) => (x === '' || x == null ? '–' : x), b = (x) => ({ io: 'i. O.', nio: 'n. i. O.' })[x] || '–';
  log(`MESSPROTOKOLL LI-001 (${PROT_ART[art]}) ${neu ? 'abgelegt' : 'überarbeitet'}: Abstich ${f(e.abstich)} m, Pegel ${f(e.pegel)} m · Prüfbuchse ${f(e.iPb)} mA (Soll lt. Kennlinie ${f(e.iSoll)} mA, ${b(e.bFeld)}) · Trennverstärker ${f(e.iTvE)} / ${f(e.iTvA)} mA (${b(e.bTv)}) · Anzeige ${f(e.anz)} m (${b(e.bSt)}) · Schwimmer ${b(e.bSchw)}${e.bem ? ' · ' + e.bem : ''}`, 'messung');
}
