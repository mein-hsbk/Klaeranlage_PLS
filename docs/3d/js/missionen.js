// Missionen: vorbereitete Betriebssituationen mit Auftrag (Briefing), Start in der Begehung,
// Auswertung (Missionsbericht am Bildschirm und als PDF, siehe bericht.js).
import { sim, startSzenario, logText, logA } from './anlage-sim.js';
import { P } from './faulung-modell.js';
import { f0, f1 } from './instrumente.js';
import { sammleBericht, renderBericht, berichtAlsPDF } from './bericht.js';
import { KARTEN, VOR_ORT_BEHEBBAR, TEILE, SCHADTEIL, wsRepariert, PEGEL_KARTE, LI, lmBehoben } from './pumpwerk-modell.js';

const $ = (id) => document.getElementById(id);
const hat = (re) => sim.log.some((l) => re.test(l.text));
const erstes = (re) => sim.log.find((l) => re.test(l.text));
const meldung = () => sim.log.some((l) => l.art === 'meldung');
const min = (l) => (l ? Math.round(l.tr / 60000) : null);

// Diagrammvorlagen für den Bericht
const CH = {
  lm: { titel: 'Pegel Pumpensumpf: Anzeige LI-001 und tatsächlicher Wasserstand', einheit: 'm', src: 'P', min: 0, max: 3, serien: [{ key: 'li', label: 'LI-001 Anzeige', farbe: '#e1a100' }, { key: 'lw', label: 'tatsächlich', farbe: '#2e86de', strich: true }] },
  bhfPegel: { titel: 'Pegel Sammelbecken APW-01 (über Beckensohle)', einheit: 'm', src: 'H', min: -1, max: 5.2, serien: [{ key: 'h', label: 'Pegel', farbe: '#e1a100' }] },
  bhfQ: { titel: 'Zufluss Druckrohr DN 300 und laufende Pumpen', einheit: 'L/s bzw. Anzahl × 10', src: 'H', min: 0, max: 80, serien: [{ key: 'qz', label: 'Zufluss [L/s]', farbe: '#00a8b5' }, { key: 'np', label: 'Pumpen in Betrieb × 10', farbe: '#d63031', f: 10, strich: true }] },
  gas: { titel: 'Gasspeicher GS-1 (LI 609), Fackelbetrieb orange hinterlegt', einheit: '%', src: 'S', min: 0, max: 100, band: { key: 'f' }, serien: [{ key: 'lvl', label: 'Füllstand LI 609', farbe: '#e1a100' }] },
  bhkw: { titel: 'BHKW und Faulgas', einheit: 'kW bzw. Nm³/h', src: 'S', min: 0, max: 140, serien: [{ key: 'pel', label: 'BHKW P el [kW]', farbe: '#0097a7' }, { key: 'q', label: 'Faulgas FI 608 [Nm³/h]', farbe: '#e67e22', strich: true }] },
  temp: { titel: 'Faulturmtemperatur (TI 1001)', einheit: '°C', src: 'S', min: 28, max: 40, serien: [{ key: 'T', label: 'TI 1001', farbe: '#d63031' }] },
  ch4: { titel: 'Methangehalt Faulgas (QI 614)', einheit: 'Vol-%', src: 'S', min: 40, max: 66, serien: [{ key: 'ch4', label: 'QI 614 CH4', farbe: '#6c5ce7' }] },
  o2: { titel: 'Sauerstoff Straße 1: Messwert und tatsächlicher Wert', einheit: 'mg/L', src: 'B', min: 0, max: 11, serien: [{ key: 'm1', label: 'QI 301 Messwert', farbe: '#e1a100' }, { key: 'o1', label: 'O2 tatsächlich Str. 1', farbe: '#d63031', strich: true }, { key: 'm2', label: 'QI 311 Str. 2', farbe: '#2e86de', dick: 1.4 }] },
  luft: { titel: 'Luftmengen je Straße (FI 301 / FI 311)', einheit: 'Nm³/h', src: 'B', min: 0, max: 3500, serien: [{ key: 'l1', label: 'Straße 1', farbe: '#00a8b5' }, { key: 'l2', label: 'Straße 2', farbe: '#6c8ebf' }] },
  pegel: { titel: 'Pegel Pumpensumpf (LI-001)', einheit: 'm', src: 'P', min: 0, max: 3, serien: [{ key: 'li', label: 'LI-001', farbe: '#e1a100' }] },
  qpw: { titel: 'Förderstrom der Pumpen', einheit: 'm³/h', src: 'P', min: 0, max: 150, serien: [{ key: 'q1', label: 'P-001', farbe: '#00a8b5' }, { key: 'q2', label: 'P-002', farbe: '#6c5ce7', strich: true }] },
  ipw: { titel: 'Motorstrom und Schwingung P-001', einheit: 'A bzw. mm/s', src: 'P', min: 0, max: 30, serien: [{ key: 'i1', label: 'Strom P-001 [A]', farbe: '#d63031' }, { key: 'i2', label: 'Strom P-002 [A]', farbe: '#e17055', strich: true }, { key: 'v1', label: 'Schwingung P-001 [mm/s]', farbe: '#2e86de', dick: 1.4 }] },
  pgeb: { titel: 'Leistung Gebläsestation (JI 201)', einheit: 'kW', src: 'B', min: 0, max: 150, serien: [{ key: 'p', label: 'Ist-Leistung', farbe: '#d63031' }, { key: 'pr', label: 'bei richtiger O2-Messung', farbe: '#1e8e5a', strich: true }] },
};

// ------------------------------------------------------------------ Pumpwerk Talstraße: Störungskarten (LS „Störung beim Betrieb einer Kreiselradpumpe“)
const SYMPTOM = {
  K1: 'Die Leitwarte meldet „P-001 Förderstrom unter Sollwert“. Die Pumpe läuft mit normaler Drehzahl, FI-001 zeigt aber deutlich weniger als die üblichen 100 m³/h.',
  K2: 'Bei der Wochenkontrolle ist aufgefallen, dass der Füllstand im Vorlagebehälter der Gleitringdichtung von P-001 steigt und die Flüssigkeit trüb aussieht.',
  K3: 'Ein Kollege berichtet von ungewöhnlich lauten Laufgeräuschen der Pumpe P-001.',
  K4: 'Beim Rundgang wurde unter der Pumpe P-001 eine Pfütze entdeckt – vermutlich erhöhte Leckage an der Wellendichtung.',
};
const LOESUNG = {
  zopf: 'Faserzopf (Feuchttücher) am Laufrad: Förderstrom ≈ 90–95 m³/h, geringere Förderhöhe (PI 001.2 ≈ 1,95 bar), Strom etwas geringer, Schwingung ≈ 4,6 mm/s. Nicht vor Ort behebbar → Reserve in Betrieb, P-001 freischalten und entleeren, Laufrad in der Werkstatt reinigen.',
  spalt: 'Spaltring/Verschleißwand verschlissen: Förderstrom ≈ 95 m³/h bei ruhigem Lauf, geringere Förderhöhe bei kaum verändertem Strom – der Wirkungsgrad sinkt (innere Rückströmung). Werkstatt: Spalt nachstellen bzw. Verschleißteile erneuern.',
  schieber: 'Druckschieber V-001.2 nach Arbeiten nur zu 25 % geöffnet: Förderstrom ≈ 80 m³/h, Druck PI 001.2 höher als üblich (≈ 2,5 statt 2,2 bar), Strom geringer. Vor Ort behebbar: Druckschieber ganz öffnen und Förderstrom kontrollieren.',
  saug: 'Saugschieber V-001.1 stark gedrosselt (14 %): Unterdruck ≈ −0,6 bar an PI 001.1, Kavitation (prasselndes Geräusch), Schwingung ≈ 6,5 mm/s, Förderstrom ≈ 65 m³/h. Vor Ort behebbar: Saugschieber ganz öffnen. Hinweis: Saugseitig wird nie gedrosselt.',
  glrd: 'Produktseitige Gleitringdichtung verschlissen: Abwasser dringt in die Vorlage, Stand steigt über MAX, Flüssigkeit trüb. Nachfüllen oder Ablassen beseitigt die Ursache nicht → Außerbetriebnahme, Dichtung in der Werkstatt tauschen.',
  oring: 'O-Ring (Nebendichtung) der produktseitigen Gleitringdichtung beschädigt – Symptome wie bei verschlissenen Gleitflächen (Vorlage steigt, trüb). Unterscheidung erst bei der Demontage in der Werkstatt; Außerbetriebnahme.',
  trocken: 'Im Störungsspeicher der Pumpensteuerung steht „gestern 23:14 Trockenlaufschutz ausgelöst“: Die produktseitige Gleitringdichtung wurde durch Trockenlauf beschädigt (Vorlage steigt, trüb). Außerbetriebnahme, Dichtung tauschen und die Ursache des Trockenlaufs klären.',
  luft: 'Ausschaltpegel in der Pumpensteuerung auf 0,30 m statt 0,80 m verstellt: Gegen Ende jedes Pumpzyklus bildet sich ein Hohlwirbel, die Pumpe zieht Luft (schlürfend, Förderstrom und Druck schwanken, Schwingung ≈ 5,5 mm/s). Vor Ort behebbar: Ausschaltpegel auf 0,80 m zurückstellen.',
  lager: 'Wälzlagerschaden im Lagerträger: Lagertemperatur ≈ 85 °C, Schwingung ≈ 7,4 mm/s (Schadensbereich), mahlendes Geräusch, Strom leicht erhöht. Sofort außer Betrieb nehmen, Lager in der Werkstatt tauschen.',
  fremd: 'Fremdkörper im bzw. Beschädigung am Laufrad: Unwucht mit rhythmischem Klopfen, Schwingung ≈ 6,2 mm/s, Förderstrom leicht verringert. Außerbetriebnahme, Laufrad in der Werkstatt prüfen.',
  kupplung: 'Elastische Kupplung (Elastomerkranz) verschlissen: Klappern an der Kupplung, schwarzer Gummiabrieb unter dem Kupplungsschutz, Schwingung ≈ 4,8 mm/s. Außerbetriebnahme, Kupplungskranz tauschen, Ausrichtung prüfen.',
  aussen: 'Atmosphärenseitige Gleitringdichtung verschlissen: Vorlagestand fällt unter MIN, Tropfen am Dichtungsgehäuse, Pfütze unter der Pumpe. Außerbetriebnahme, Dichtung tauschen.',
  stopfen: 'Verschraubung am Vorlagebehälter locker: Tropfen an der Verschraubung, Vorlagestand unter MIN. Vor Ort behebbar: Verschraubung nachziehen und Vorlageflüssigkeit nachfüllen.',
  gehaeuse: 'Gehäusedichtung am Gehäusedeckel undicht: Abwasser tritt am Gehäusedeckel aus, Pfütze; Vorlagebehälter unauffällig. Außerbetriebnahme, Gehäusedichtung in der Werkstatt erneuern.',
};
const pidx = (re, ab = 0) => { const i = sim.log.slice(ab).findIndex((l) => re.test(l.text)); return i < 0 ? -1 : i + ab; };
const U0 = () => sim.P.ursache0;
function pwBehoben() {
  const P = sim.P, x = P.p[0], u = U0();
  if (u === 'schieber') return x.vd >= 95;
  if (u === 'saug') return x.vs >= 95;
  if (u === 'luft') return P.liAus >= 0.7 && P.liAus <= 1.0;
  if (u === 'stopfen') return !!x.stopfenFest && x.vorlage >= 40 && x.vorlage <= 75;
  return false;
}
const bereit2 = () => { const x = sim.P.p[1]; return x.wahl === 'auto' && x.rep && !x.stoer && x.vs > 95 && x.vd > 95; };
// Prüfschritte, nach Abschnitten
function chkSymptom(k) {
  if (k === 'K1') return [['Förderstrom und Drücke vor Ort abgelesen (FI-001, PI 001.1, PI 001.2)', () => hat(/angesehen: FI-001/) && hat(/angesehen: PI 001\.1/) && hat(/angesehen: PI 001\.2/), 'Aus Saug- und Druckmanometer ergibt sich die Förderhöhe; zusammen mit dem Förderstrom lässt sich der Betriebspunkt mit der Kennlinie vergleichen.'],
    ['Stellung von Saug- und Druckschieber geprüft', () => hat(/angesehen: V-001\.1/) && hat(/angesehen: V-001\.2/), 'Ein nicht ganz geöffneter Schieber ist die einfachste Ursache und schnell auszuschließen.']];
  if (k === 'K2') return [['Vorlagebehälter der Gleitringdichtung begutachtet', () => hat(/angesehen: LG 001/), 'Stand und Farbe der Vorlageflüssigkeit zeigen, welche der beiden Dichtungen undicht ist.'],
    ['Störungsspeicher der Pumpensteuerung angesehen', () => hat(/angesehen: PW-Steuerung/), 'Ein vorausgegangener Trockenlauf ist eine typische Ursache für Gleitringdichtungsschäden – er steht im Störungsspeicher.']];
  if (k === 'K3') return [['Pumpe P-001 abgehört', () => hat(/P-001 abgehört/), 'Geräuschbild (Prasseln, Schlürfen, Mahlen, Klopfen, Klappern) grenzt die Ursache ein.'],
    ['Schwingung und Lagertemperatur von P-001 gemessen', () => hat(/P-001 Schwingschnelle/) && hat(/P-001 Lagertemperatur/), 'Messwerte statt Eindruck: Schwingschnelle nach DIN ISO 10816-3, Lagertemperatur über 80 °C deutet auf Lagerschaden.'],
    ['Pegel bzw. Pumpensteuerung geprüft', () => hat(/angesehen: (PW-Steuerung|Pumpensumpf)/), 'Lufteinzug durch zu tiefen Pegel erzeugt ebenfalls laute Geräusche – die Ursache liegt dann nicht an der Pumpe.']];
  return [['Sichtprüfung an Pumpe und Dichtung', () => hat(/P-001 Sichtprüfung/), 'Die Austrittsstelle (Gehäusedeckel, Dichtungsgehäuse, Verschraubung) entscheidet über die Ursache.'],
    ['Vorlagebehälter der Gleitringdichtung begutachtet', () => hat(/angesehen: LG 001/), 'Fällt der Stand, geht Vorlageflüssigkeit nach außen verloren; ist er normal, kommt die Leckage nicht von der Gleitringdichtung.']];
}
const chkDiagnose = () => [['Ursache richtig festgestellt (Auswahl in der Meldung)', () => sim.diagnose === U0(), 'Die Diagnose bestimmt, ob vor Ort behoben werden kann oder die Pumpe in die Werkstatt muss.']];
const chkVorOrt = () => { const x1 = sim.P.p[0]; return [
  ['Ursache vor Ort beseitigt', pwBehoben, 'Die Ursache lag nicht an der Pumpe selbst und konnte ohne Werkstatt behoben werden.'],
  ['P-001 wieder in AUTO und betriebsbereit', () => x1.wahl === 'auto' && x1.rep && !x1.stoer && x1.vs > 95 && x1.vd > 95, 'Nach der Beseitigung muss die Führungspumpe wieder im Automatikbetrieb laufen.'],
  ['Reservepumpe P-002 betriebsbereit (AUTO, Reparaturschalter EIN, beide Schieber offen)', bereit2, 'Zum Kontrollgang gehört auch die Reserve: Sie muss jederzeit übernehmen können.']]; };
const chkAusser = () => { const P = sim.P, x1 = P.p[0], x2 = P.p[1]; return [
  ['Reservepumpe P-002 betriebsbereit (AUTO, Reparaturschalter EIN, beide Schieber offen)', bereit2, 'Erst wenn die Reserve sicher fördert, darf die gestörte Pumpe außer Betrieb gehen.'],
  ['P-002 hat nachweislich gefördert (≥ 100 m³/h)', () => x2.qMax >= 100, 'Kontrolle an FI-001 und am Druckmanometer: Läuft die Reserve auch wirklich?'],
  ['P-001 am Wahlschalter abgeschaltet, bevor der Reparaturschalter betätigt wurde', () => hat(/P-001 Reparaturschalter AUS/) && !hat(/P-001 Reparaturschalter AUS \(0\) – Pumpe lief noch/), 'Der Reparaturschalter ist ein Lasttrennschalter zum Sichern, kein Betriebsschalter.'],
  ['Reparaturschalter P-001 auf 0 und mit Vorhängeschloss gesichert', () => hat(/P-001 Reparaturschalter mit Vorhängeschloss/), '2. Sicherheitsregel: gegen Wiedereinschalten sichern.'],
  ['Wirksamkeit der Freischaltung geprüft (Einschaltversuch)', () => hat(/P-001 Einschaltversuch \(Wahlschalter HAND\): Pumpe läuft nicht an/), 'Sinngemäß 3. Sicherheitsregel: Erst ein Einschaltversuch zeigt, dass wirklich der richtige Antrieb freigeschaltet ist.'],
  ['Erst Druck-, dann Saugschieber geschlossen', () => { const d = pidx(/P-001 Druckschieber \d+ → 0 %/), sg = pidx(/P-001 Saugschieber \d+ → 0 %/); return d >= 0 && sg > d; }, 'Der Druckschieber trennt die Pumpe vom Druck der Leitung; danach wird saugseitig abgesperrt.'],
  ['Pumpe über die Entleerung drucklos gemacht, ohne Abwasseraustritt', () => hat(/P-001 Entleerung geöffnet/) && !hat(/P-001 Entleerung geöffnet – ACHTUNG/), 'Erst nach dem Schließen beider Schieber entleeren – sonst läuft der Raum voll.']]; };
const einbauIdx = () => pidx(/P-001 Einschubeinheit wieder eingebaut/);
const nachEinbau = (re) => { const e = einbauIdx(); return e >= 0 && pidx(re, e) > e; };
const chkWerkstatt = () => { const P = sim.P, ws = () => P.ws, sch = () => SCHADTEIL[P.wsUrsache]; return [
  ['Befund am schadhaften Bauteil aufgenommen', () => ws() && ws().teile[sch()] && ws().teile[sch()].befund, 'Der Befund am Bauteil bestätigt die Diagnose und gehört in den Instandsetzungsbericht.'],
  ['Schadhaftes Bauteil fachgerecht instand gesetzt', () => ws() && wsRepariert(P), 'Erst wenn das schadhafte Teil gereinigt bzw. ersetzt ist, ist die Ursache beseitigt.'],
  ['Kein Teil ohne Befund ersetzt', () => ws() && TEILE.every((T) => !ws().teile[T.id].ersetzt || ws().teile[T.id].befund || T.id === 'gdicht'), 'Erst prüfen, dann tauschen – sonst bleibt die Ursache unter Umständen unerkannt.'],
  ['Keine unnötigen Neuteile', () => ws() && TEILE.every((T) => !ws().teile[T.id].ersetzt || T.id === sch() || T.id === 'gdicht'), 'Neuteile kosten Geld; intakte Teile werden wieder verwendet. Ausnahme: Flachdichtungen.'],
  ['Gehäusedichtung erneuert', () => ws() && ws().teile.gdicht.ersetzt, 'Flachdichtungen werden nach jeder Demontage erneuert – eine gebrauchte Dichtung dichtet nicht zuverlässig.'],
  ['Einschubeinheit wieder eingebaut', () => ws() && ws().eingebaut, ''],
]; };
const chkWiB = () => { const P = sim.P, x1 = P.p[0]; return [
  ['Entleerung geschlossen, bevor die Schieber geöffnet wurden', () => { const e = einbauIdx(), a = pidx(/P-001 Entleerung geschlossen/, e), s1 = pidx(/P-001 (Saug|Druck)schieber 0 → [1-9]/, e); return e >= 0 && a > e && s1 > a; }, 'Sonst läuft Abwasser aus Sumpf oder Druckleitung über die offene Entleerung in den Pumpenraum.'],
  ['Vorlagebehälter vor dem Anlauf befüllt', () => einbauIdx() >= 0 && !hat(/läuft mit leerem Vorlagebehälter/) && x1.vorlage >= 40, 'Nach einem Dichtungstausch ist der Vorlageraum leer; ohne Vorlageflüssigkeit läuft die atmosphärenseitige Dichtung trocken.'],
  ['Saug- und Druckschieber wieder ganz geöffnet', () => x1.vs > 95 && x1.vd > 95, 'Gedrosselte Schieber führen zu Kavitation (saugseitig) bzw. zu geringem Förderstrom.'],
  ['Schloss entfernt, Reparaturschalter EIN, Wahlschalter AUTO', () => !x1.schloss && x1.rep && x1.wahl === 'auto', 'Nur im AUTO-Betrieb übernimmt P-001 wieder die Niveausteuerung als Führungspumpe.'],
  ['Probelauf: P-001 fördert wieder mindestens 100 m³/h', () => einbauIdx() >= 0 && x1.qMax >= 100, 'Kontrolle an FI-001: Erreicht die Pumpe wieder ihren Betriebspunkt?'],
  ['Probelauf: Schwingung gemessen und unter 2,8 mm/s', () => { const e = einbauIdx(); if (e < 0) return false; const l = sim.log.slice(e).filter((x) => /P-001 Schwingschnelle am Lagerträger: ([\d,]+)/.test(x.text)).pop(); return !!l && parseFloat(l.text.match(/: ([\d,]+) mm/)[1].replace(',', '.')) < 2.8; }, 'Eine Schwingungsmessung nach der Instandsetzung belegt den einwandfreien Lauf (Zone A nach DIN ISO 10816-3).'],
]; };
const chkEnde = () => { const P = sim.P; return [
  ['Kein Trockenlauf ausgelöst', () => !hat(/Abschaltung durch Trockenlaufschutz/) && !hat(/läuft mit leerem Vorlagebehälter/), 'Trockenlauf zerstört Gleitringdichtungen in kurzer Zeit.'],
  ['Kein Notüberlauf während des Einsatzes', () => P.vUeb < 0.5, 'Ein Abschlag ungereinigten Abwassers ins Gewässer ist meldepflichtig.'],
  ['Meldung an die Schichtleitung abgegeben', () => hat(/^MELDUNG an Schichtleitung/), 'Befund, festgestellte Ursache, Maßnahmen, Zustand der Pumpen und ggf. Ersatzteile.']]; };
function pwChecks(art) {
  const P = sim.P, fix = VOR_ORT_BEHEBBAR.includes(U0());
  if (art === 'werkstatt') return [...chkDiagnose(), ...chkWerkstatt(), ...chkWiB(), ...chkEnde()];
  const c = [...chkSymptom(P.karte), ...chkDiagnose()];
  if (fix) return [...c, ...chkVorOrt(), ...chkEnde()];
  return [...c, ...chkAusser(), ...(art === 'komplett' ? [...chkWerkstatt(), ...chkWiB()] : []), ...chkEnde()];
}
const zust = (x) => x.ausgebaut ? 'ausgebaut (Werkstatt)' : x.stoer ? `Störung (${x.stoer})` : !x.rep ? `Rep.-Sch. 0${x.schloss ? ', gesichert' : ''}` : x.run ? `Betrieb, ${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[x.wahl]}` : `bereit, ${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[x.wahl]}`;
const REIHENFOLGE_AUS = 'Reserve P-002 prüfen (Wahlschalter AUTO, Reparaturschalter EIN, Schieber offen) – P-001 Wahlschalter 0 – P-002 übernimmt, Förderung an FI-001 kontrollieren – Reparaturschalter P-001 auf 0, Schloss – Einschaltversuch – Druckschieber zu – Saugschieber zu – Entleerung öffnen';
const REIHENFOLGE_WIB = 'Wiederinbetriebnahme: Entleerung schließen – Vorlagebehälter befüllen (nach Dichtungstausch) – Saugschieber öffnen (Pumpe füllt sich) – Druckschieber öffnen – Schloss entfernen, Reparaturschalter EIN – Wahlschalter AUTO – Probelauf: Förderstrom an FI-001, Schwingung messen.';
const WERKSTATT_LOES = { zopf: 'Laufrad reinigen (Zopf entfernen); Neuteil nicht nötig.', fremd: 'Laufrad ersetzen (Schaufelkante ausgebrochen, Unwucht).', spalt: 'Verschleißwand/Spaltring erneuern (Spalt 2,4 mm statt 0,3–0,5 mm).', glrd: 'Produktseitige Gleitringdichtung erneuern.', oring: 'Produktseitige Gleitringdichtung (inkl. O-Ringe) erneuern.', trocken: 'Produktseitige Gleitringdichtung erneuern; Ursache des Trockenlaufs (Pegel, Trockenlaufschutz) klären.', aussen: 'Atmosphärenseitige Gleitringdichtung erneuern.', gehaeuse: 'Gehäusedichtung erneuern.', lager: 'Beide Wälzlager erneuern und mit Fett befüllen.', kupplung: 'Elastomerkranz der Kupplung erneuern, Ausrichtung prüfen.' };

function pwMission(karte, art = 'karte') {
  const zufall = art !== 'karte', ziel = art === 'werkstatt'
    ? 'Die Einschubeinheit von P-001 liegt bereits in der Werkstatt, P-002 fördert. Zerlege die Einheit, finde das schadhafte Bauteil, setze es instand und baue P-001 wieder ein. Nimm P-001 fachgerecht wieder in Betrieb (Probelauf mit Schwingungsmessung) und gib eine Meldung mit der festgestellten Ursache ab.'
    : `Stelle die Ursache fest. Kann sie vor Ort beseitigt werden, tu das. Sonst nimm die baugleiche Reservepumpe P-002 sicher in Betrieb und nimm P-001 fachgerecht außer Betrieb.${art === 'komplett' ? ' Baue dann die Einschubeinheit aus, setze sie in der Werkstatt instand und nimm P-001 wieder in Betrieb.' : ''} Gib eine Meldung mit der festgestellten Ursache an die Schichtleitung ab.`;
  const titel = { karte: `Pumpwerk: ${KARTEN[karte].kurz}`, zufall: 'Störung Kreiselpumpe (Zufallskarte)', komplett: 'Pumpe: Störung bis Wiederinbetriebnahme', werkstatt: 'Pumpe instand setzen (Werkstatt)' }[art];
  const symptom = art === 'werkstatt' ? `P-001 wurde heute früh außer Betrieb genommen. Meldung des Frühdienstes: ${SYMPTOM[karte].replace('Die Leitwarte meldet', 'Die Leitwarte meldete').replace('Ein Kollege berichtet', 'Ein Kollege berichtete')}` : `Routinekontrolle im Abwasserpumpwerk Talstraße. ${SYMPTOM[karte]}`;
  return {
    id: { karte: `pw_${karte}`, zufall: 'pw_zufall', komplett: 'pw_komplett', werkstatt: 'pw_werkstatt' }[art], titel, karte, pw: karte, pwOpt: { werkstatt: art === 'werkstatt' }, art, faul: 'S0', bel: 'B0',
    bereich: art === 'werkstatt' ? 'Pumpwerk Talstraße · Werkstatt' : 'Pumpwerk Talstraße · Instandhaltung', dauer: art === 'komplett' ? '60–90 min' : '30–45 min', stufe: 3, start: 'talstr', tab: 'pw', vorlauf: 2, speed: 5,
    auftrag: zufall ? `${art === 'werkstatt' ? 'Eine zufällige Störungskarte wird beim Start gezogen und im Auftrag genannt. ' : 'Bei der Routinekontrolle im Abwasserpumpwerk Talstraße fällt eine Störung an der Führungspumpe P-001 auf (eine zufällige Störungskarte wird beim Start gezogen). '}${ziel}` : `${symptom} ${ziel}`,
    auftragStart: `${symptom} ${ziel}`,
    werkstattStart: art === 'werkstatt',
    lehrer: `Die Ursache wird bei jedem Start zufällig gezogen (der Bericht nennt sie). ${art === 'karte' ? `Mögliche Ursachen: ${Object.values(KARTEN[karte].ursachen).join(' · ')}. ` : 'Karten: ' + Object.entries(KARTEN).map(([k, v]) => `${k} ${v.titel}`).join(' · ') + '. '}${art === 'werkstatt' ? 'Gezogen werden nur Ursachen an der Pumpe selbst. ' : 'Vor Ort behebbar sind gedrosselte Schieber, der verstellte Ausschaltpegel und die lockere Verschraubung am Vorlagebehälter; alle anderen Ursachen erfordern die Außerbetriebnahme. '}${art !== 'werkstatt' ? `Fachgerechte Reihenfolge: ${REIHENFOLGE_AUS} – Meldung. Falle: In etwa einem Drittel der Starts ist der Druckschieber der Reservepumpe nach der Wartung von vorgestern geschlossen geblieben; P-002 läuft dann gegen den geschlossenen Schieber, der Sumpf läuft in wenigen Minuten (×5) bis zum Notüberlauf voll. ` : ''}${art !== 'karte' && art !== 'zufall' ? `Werkstatt (Rückziehbauweise, Spiralgehäuse bleibt eingebaut): zerlegen, Befund aufnehmen, messen (Spaltmaß, Rundlauf, Lagerspiel), nur das schadhafte Teil ersetzen bzw. reinigen, Gehäusedichtung immer erneuern. ${REIHENFOLGE_WIB} Nach einem Dichtungstausch ist der Vorlagebehälter leer – Anlauf ohne Befüllen beschädigt die atmosphärenseitige Dichtung. ` : ''}Fehlbedienungen mit Folgen: Saugschieber bei laufender Pumpe schließen oder HAND bei tiefem Pegel (Trockenlauf), Entleerung bei offenen Schiebern (Wassermelder).`,
    lehrerBericht() { const P = sim.P, u = U0(); return `Gezogen: ${KARTEN[P.karte].titel} – Ursache: ${KARTEN[P.karte].ursachen[u]}. ${LOESUNG[u]}${WERKSTATT_LOES[u] && art !== 'karte' && art !== 'zufall' ? ` Werkstatt: ${WERKSTATT_LOES[u]}` : ''} ${P.falle ? 'Falle aktiv: Der Druckschieber V-002.2 der Reservepumpe war geschlossen.' : ''} ${this.lehrer}`; },
    checks: () => pwChecks(art),
    werte: () => { const P = sim.P; return [['Pegel LI-001', P.li.toFixed(2).replace('.', ','), 'm'], ['Förderstrom FI-001', f0(P.q), 'm³/h'], ['P-001', zust(P.p[0]), ''], ['P-002', zust(P.p[1]), ''], ['Vorlagebehälter P-001', f0(P.p[0].vorlage), '%'], ['Ersatzteile', P.ws ? f0(P.ws.kosten) : '0', '€'], ['Notüberlauf seit Start', f0(P.vUeb), 'm³']]; },
    charts: [CH.pegel, CH.qpw, CH.ipw],
    kennzahl: () => { const P = sim.P; return `Seit Missionsstart gefördert ${f0(P.vGef)} m³ mit ${f1(P.eKwh)} kWh (${P.vGef > 1 ? f0(P.eKwh / P.vGef * 1000) : '–'} Wh/m³).${P.ws ? ` Ersatzteilkosten: ${f0(P.ws.kosten)} €.` : ''}${P.vUeb > 0 ? ` Über den Notüberlauf ungereinigt abgeschlagen: ${f0(P.vUeb)} m³.` : ''}`; },
    hinweise: () => {
      const P = sim.P, h = [], u = U0(), fix = VOR_ORT_BEHEBBAR.includes(u);
      h.push(`Gezogene Karte: ${KARTEN[P.karte].titel}. Tatsächliche Ursache: ${KARTEN[P.karte].ursachen[u]}.`);
      if (sim.diagnose && sim.diagnose !== u) h.push(`Gewählt wurde: ${sim.diagnose === 'unklar' ? 'Ursache nicht eindeutig' : KARTEN[P.karte].ursachen[sim.diagnose]}.`);
      if (!sim.diagnose) h.push('Es wurde keine Ursache in einer Meldung angegeben.');
      if (fix && hat(/P-001 Reparaturschalter AUS/)) h.push('Die Ursache war vor Ort behebbar – eine Außerbetriebnahme von P-001 war nicht nötig.');
      if (P.falle) h.push(hat(/P-002 Druckschieber 0 → /) ? 'Der nach der Wartung geschlossene Druckschieber der Reservepumpe wurde erkannt und geöffnet.' : 'Der Druckschieber V-002.2 der Reservepumpe war nach der Wartung geschlossen geblieben und wurde nicht geöffnet.');
      if (hat(/P-002 läuft länger gegen geschlossenen Druckschieber/)) h.push('P-002 lief mehrere Minuten gegen den geschlossenen Druckschieber (kein Förderstrom, Erwärmung).');
      if (hat(/Abschaltung durch Trockenlaufschutz/)) h.push('Der Trockenlaufschutz hat ausgelöst – die Gleitringdichtung ist gefährdet.');
      if (hat(/Pumpe lief noch/)) h.push('Ein Reparaturschalter wurde unter Last ausgeschaltet.');
      if (hat(/Wahlschalter \w+ → HAND/)) h.push('Eine Pumpe stand zeitweise in HAND – ohne Pegelschutz kann der Sumpf leerlaufen.');
      if (hat(/Entleerung geöffnet – ACHTUNG/) || P.flut > 0.5) h.push('Entleerung und Schieber waren gleichzeitig offen – Abwasser ist in den Pumpenraum gelaufen (Wassermelder).');
      if (hat(/P-001 Ausbau versucht, nicht freigegeben/)) h.push(`Der Ausbau wurde versucht, bevor die Pumpe sicher freigeschaltet war (${erstes(/P-001 Ausbau versucht/).text.split(': ')[1]}).`);
      if (P.vUeb > 0) h.push(`Der Notüberlauf sprang an: ${f0(P.vUeb)} m³ ungereinigtes Abwasser.`);
      if (P.karte === 'K2' && hat(/Vorlagebehälter auf Sollstand nachgefüllt/) && !P.ws) h.push('Nachfüllen der Vorlage behebt die undichte produktseitige Dichtung nicht.');
      if (hat(/P-001 Störung .* quittiert/)) h.push('Eine Störung wurde quittiert – vorher sollte die Ursache geklärt sein.');
      if (P.ws) {
        const t = P.ws.teile, unn = TEILE.filter((T) => t[T.id].ersetzt && T.id !== SCHADTEIL[P.wsUrsache] && T.id !== 'gdicht');
        const bef = TEILE.filter((T) => t[T.id].befund || t[T.id].gemessen).length;
        h.push(`Werkstatt: ${bef} ${bef === 1 ? 'Bauteil' : 'Bauteile'} befundet bzw. gemessen, Ersatzteilkosten ${f0(P.ws.kosten)} €.`);
        if (unn.length) h.push(`Unnötig ersetzt: ${unn.map((T) => `${T.name} (${T.preis} €)`).join(', ')}.`);
        if (P.ws.eingebaut && !P.ws.repariert) h.push('Die Ursache wurde in der Werkstatt nicht beseitigt – das Symptom tritt nach dem Einbau wieder auf.');
        if (P.ws.eingebaut && !t.gdicht.ersetzt) h.push('Die alte Gehäusedichtung wurde wiederverwendet.');
        if (P.wsUrsache === 'zopf' && t.laufrad.ersetzt) h.push('Beim Faserzopf hätte Reinigen gereicht – das Laufrad war unbeschädigt.');
        if (hat(/läuft mit leerem Vorlagebehälter/)) h.push('P-001 ist mit leerem Vorlagebehälter angelaufen – die atmosphärenseitige Gleitringdichtung lief trocken und ist beschädigt.');
      }
      return h;
    },
  };
}

// ------------------------------------------------------------------ Sammelbecken Bahnhofstraße (LS 4.1: Kapazität prüfen)
let BH = null;                                   // API aus bahnhof.js (initMissionen)
const zahl = (re) => { const l = [...sim.log].reverse().find((x) => /^BEWERTUNG/.test(x.text)); if (!l) return NaN; const m = l.text.match(re); if (!m) return NaN; const t = m[1]; return parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const bewertung = () => [...sim.log].reverse().find((x) => /^BEWERTUNG/.test(x.text));
const empf = () => { const b = bewertung(); return b ? (b.text.match(/Empfehlung: ([^·(]+)/) || [])[1]?.trim() || '' : ''; };
function bhfChecks() {
  const B = BH.B;
  return [
    ['Bauwerk von innen begutachtet (Deckel geöffnet, hineingeleuchtet)', () => hat(/APW-01 Blick ins Bauwerk/), 'Zustand und Einbauten lassen sich nur durch die Öffnungen beurteilen. Einsteigen wäre nur mit Freimessen, Höhensicherung und Sicherungsposten zulässig (DGUV Regel 103-003).'],
    ['Innenmaße nachgemessen (Länge, Breite)', () => hat(/APW-01 Innenmaße gemessen/), 'Die Unterlagen stammen von 1987, spätere Umbauten sind nicht dokumentiert – Maße vor einer Berechnung vor Ort prüfen.'],
    ['Tiefe gelotet und Ablagerungen festgestellt', () => hat(/APW-01 Gelotet ab OK Deckel/), 'Das Lot zeigt die feste Sohle und die weiche Schlammauflage. Ablagerungen verringern das nutzbare Volumen.'],
    ['Notüberlaufschwelle eingemessen (Obergrenze des Speichervolumens)', () => hat(/APW-01 Notüberlaufschwelle/), 'Speichern lässt sich nur bis zur Notüberlaufschwelle; darüber läuft das Abwasser ungereinigt ab.'],
    ['Zulauf geprüft (Höhenlage bzw. Zustand)', () => hat(/APW-01 Zulauf DN 300: Rohrsohle/) || hat(/APW-01 Zulauf: Druckrohr/), 'Lage und Zustand des Zulaufs bestimmen, wie hoch eingestaut werden darf, und zeigen Verzopfungen.'],
    ['Zufluss vor Ort bestimmt (Füllversuch)', () => hat(/APW-01 Füllversuch beendet/), 'Aus Pegelanstieg, Zeit und Beckenfläche ergibt sich der Zufluss (Q = A · Δh / Δt) – ein Abgleich mit dem Wert aus den Unterlagen (Q = v · A).'],
    ['Ablauf geprüft (Schieberschacht, Druck der Sammelleitung)', () => hat(/APW-01 Schieberschacht:/) || hat(/APW-01 Manometer Sammelleitung/), 'Schieber offen, Rückschlagklappen funktionsfähig, Druck plausibel – sonst fördern die Pumpen nicht wie erwartet.'],
    ['Steigeisen geprüft', () => hat(/APW-01 Steigeisen|APW-01 Steigleiter/), 'Korrodierte oder fehlende Steigeisen sind eine Absturzgefahr für alle, die später einsteigen.'],
    ['Betonzustand untersucht (Abklopfen oder Rückprallhammer)', () => hat(/APW-01 Wand im Gasraum|APW-01 Rückprallhammer/), 'Im Gasraum greift biogene Schwefelsäure den Beton an. Für eine Aufstockung muss die vorhandene Wand tragfähig sein.'],
    ['Grundwasserstand gemessen', () => hat(/GWM 3: Abstich/), 'Für Anbau oder Neubau entscheidend: Baugrube, Wasserhaltung, Auftriebssicherheit des leeren Beckens.'],
    ['Lageplan aus dem Bestandsordner ausgewertet', () => hat(/angesehen: Lageplan/), 'Grundstücksgrenze, freie Fläche und Leitungen im Gehweg begrenzen, wo erweitert werden kann.'],
    ['Kleine Mängel selbst behoben (Zöpfe, Treibgut, Stopfbuchse)', () => !B.zopf && !B.treibgut && !B.sLeck, 'Was ohne Fremdfirma und ohne Einsteigen möglich ist, wird bei der Begehung gleich erledigt.'],
    ['Reinigung der Sohle beauftragt (Saugspülfahrzeug)', () => hat(/AUFTRAG APW-01 an Kanalreinigung/), 'Die Ablagerungen nehmen Speichervolumen weg und faulen – Reinigung durch Fremdfirma mit Saugspülfahrzeug.'],
    ['Erneuerung der Steigleiter beauftragt', () => hat(/AUFTRAG APW-01 an Schlosserei/), 'Defekte Steigeisen werden durch eine Edelstahl-Steigleiter mit Steigschutz ersetzt.'],
    ['Weitere Mängel gemeldet (Aktivkohlefilter, Betonschäden)', () => hat(/AUFTRAG APW-01 an Fachfirma Lüftung/) && hat(/AUFTRAG APW-01 an Ingenieurbüro/), 'Geruchsbeschwerden und freiliegende Bewehrung müssen weiterverfolgt werden.'],
    ['Erforderliches Speichervolumen richtig bestimmt (≈ 229 m³)', () => { const v = zahl(/V erforderlich ([\d.,]+)/); return v >= 224 && v <= 234; }, 'Q_SR = v_SR · A = 1,8 m/s · π/4 · (0,30 m)² ≈ 0,127 m³/s; über 30 min: V ≈ 229 m³.'],
    ['Vorhandenes nutzbares Volumen plausibel (≈ 200 m³, bei Ablagerungen weniger)', () => { const v = zahl(/V vorhanden ([\d.,]+)/); return v >= 180 && v <= 205; }, 'L · B · nutzbare Tiefe (Sohle bis Notüberlaufschwelle) ≈ 8,0 · 5,0 · 5,0 m = 200 m³; mit Schlammauflage weniger.'],
    ['Empfehlung berücksichtigt das Volumendefizit', () => { const e = empf(); return !!e && !/reicht aus|nach Reinigung/i.test(e); }, 'Auch nach der Reinigung fehlen rund 30 m³ – das Becken reicht für die Betreibervorgabe nicht aus.'],
    ['Aufstockung nur mit Untersuchung der Tragfähigkeit', () => !/Aufstockung/.test(empf()) || hat(/AUFTRAG APW-01 an Ingenieurbüro/), 'Eine Aufstockung belastet die vorhandenen Wände zusätzlich; bei Betonkorrosion im Gasraum ist vorher eine Bauwerksuntersuchung nötig.'],
    ['Kein Notüberlauf durch eigene Versuche ausgelöst', () => B.vUeb < 0.5, 'Füll- und Pumpversuche nur bei ausreichender Reserve bis zur Überlaufschwelle durchführen.'],
    ['Anlage ordnungsgemäß verlassen (Pumpen in AUTO, alle Deckel geschlossen)', () => B.modus === 'auto' && B.sperre <= 0 && !Object.values(B.offen).some(Boolean), 'Offene Deckel sind eine Absturzgefahr; die Pumpen müssen wieder automatisch nach Pegel schalten.'],
    ['Meldung an die Vorgesetzte abgegeben', () => hat(/^MELDUNG an Schichtleitung/), 'Ergebnis der Kapazitätsprüfung, Befunde, erledigte Arbeiten und erteilte Aufträge.'],
  ];
}
const BHF_MISSION = {
  id: 'bhf', titel: 'Sammelbecken Bahnhofstraße prüfen', bereich: 'Außenstation APW-01 · Bauwerk', dauer: '45–60 min', stufe: 2, faul: 'S0', bel: 'B0', start: 'bahnhof', tab: null, vorlauf: 2, speed: 5,
  onStart: () => BH && BH.reset(),
  auftrag: 'Aufgrund zunehmender Starkregenereignisse soll geprüft werden, ob das ältere Sammelbecken am Pumpwerk Bahnhofstraße bei Starkregen den Zufluss 30 Minuten lang speichern kann. Prüfe vor Ort Maße, Zustand, Zulauf und Ablauf, erledige kleine Mängel selbst und beauftrage Reinigung und Reparaturen. Beurteile, ob das Becken ausreicht oder ob eine Aufstockung, ein Anbau oder ein Neubau nötig ist, und notiere deine Kapazitätsbewertung. Gib zum Schluss eine Meldung an deine Vorgesetzte ab.',
  auftragStart: '„Das Sammelbecken vom Pumpwerk an der Bahnhofstraße ist schon etwas älter. Ich möchte wissen, ob es bei Starkregen den Zufluss 30 Minuten lang aufnehmen kann – und falls nicht, ob wir es erweitern können oder neu bauen müssen. Schauen Sie sich das Becken vor Ort an, prüfen Sie die Maße aus den alten Unterlagen nach (Bauwerksdatenblatt und Skizze in der Leitwarte unter Außenanlagen), sehen Sie sich Zulauf und Ablauf an und lassen Sie reinigen bzw. reparieren, was nötig ist. Ihre Bewertung notieren Sie bitte und schicken mir anschließend eine kurze Meldung.“',
  lehrer: 'Lösung: Q_SR = 1,8 m/s · π/4 · 0,30² m² ≈ 0,127 m³/s (127 L/s); V_erf = 0,127 · 1.800 s ≈ 229 m³. Vorhanden: 8,0 · 5,0 · 5,0 m = 200 m³ (vor Ort 7,98 × 4,99 m, nutzbare Tiefe Sohle bis Notüberlaufschwelle 5,00 m; Schlammauflage ≈ 0,36 m kostet zusätzlich rund 14 m³). Defizit ≈ 29 m³ → reicht auch nach Reinigung nicht. Aufstockung um ≥ 0,73 m (29 m³ / 40 m²) hebt den Höchstwasserstand über Gelände: Wände ≈ 1 m über Gelände verlängern, neue Decke, Notüberlauf und Lüftung anheben; Zulauf ist eine Druckleitung, Einstau hydraulisch unkritisch. Gegen eine Aufstockung sprechen Betonkorrosion im Gasraum (Rückprall R ≈ 21–25) und die unbekannte Statik → Bauwerksuntersuchung. Alternative: zweite Kammer/Anbau auf der freien Grünfläche westlich (Grundwasser 2,35 m unter Gelände → Wasserhaltung, Auftriebssicherung); Neubau, wenn die Bausubstanz nicht mehr sanierungsfähig ist. Füllversuch: Pegelanstieg ≈ 12–14 cm in 120 s bei A ≈ 40 m² → Q ≈ 40–47 L/s (Trockenwetter, Datenblatt 42 L/s). Kleine Mängel vor Ort: Zöpfe an der Prallplatte, Treibgut an der Überlaufschwelle, Stopfbuchse Schieber P2. Aufträge: Saugspülfahrzeug, Steigleiter, Aktivkohlefilter, Ingenieurbüro (Beton).',
  checks: bhfChecks,
  werte: () => { const B = BH.B; return [['Pegel über Sohle', B.h.toFixed(2).replace('.', ','), 'm'], ['Ablagerungen', f0(B.sed * 100), 'cm'], ['Offene Deckel', String(Object.values(B.offen).filter(Boolean).length), ''], ['Pumpenbetrieb', B.modus === 'auto' ? 'AUTO' : 'HAND leerpumpen', ''], ['Erteilte Aufträge', String(sim.log.filter((l) => /^AUFTRAG APW-01/.test(l.text)).length), ''], ['Notüberlauf seit Start', f1(BH.B.vUeb), 'm³']]; },
  charts: [CH.bhfPegel, CH.bhfQ],
  kennzahlTitel: 'Notierte Kapazitätsbewertung',
  kennzahl: () => { const b = bewertung(); return b ? b.text.replace(/^BEWERTUNG Kapazität APW-01: /, 'Notierte Bewertung: ') : 'Es wurde keine Kapazitätsbewertung notiert.'; },
  hinweise: () => {
    const h = [], B = BH.B;
    const mess = sim.log.filter((l) => /^APW-01 (Innenmaße|Gelotet|Abstich|Notüberlaufschwelle|Zulauf DN|Füllversuch beendet|Pumpversuch P1 beendet|An der Einstieg|Pumpensumpf:|Rückprall|Grundwasser)/.test(l.text) || /GWM 3/.test(l.text));
    if (mess.length) h.push(`Messergebnisse: ${mess.map((l) => l.text.replace(/^APW-01 /, '')).join(' | ')}`);
    if (!bewertung()) h.push('Es wurde keine Kapazitätsbewertung notiert (Schaltschrank bzw. „Kapazität bewerten“).');
    if (/nach Reinigung/i.test(empf())) h.push('Die Reinigung bringt nur rund 14 m³ zurück – das Defizit von etwa 29 m³ bleibt.');
    if (/reicht aus/i.test(empf()) && !/nach Reinigung/i.test(empf())) h.push('Mit rund 200 m³ nutzbarem Volumen werden die erforderlichen ≈ 229 m³ nicht erreicht.');
    if (B.modus === 'leer') h.push('Das Becken wurde im Handbetrieb leergepumpt und nicht wieder auf AUTO gestellt.');
    if (Object.values(B.offen).some(Boolean)) h.push('Beim Verlassen waren noch Deckel offen.');
    if (B.vUeb > 0.5) h.push(`Der Notüberlauf ist angesprungen (${f1(B.vUeb)} m³).`);
    if (B.zopf || B.treibgut || B.sLeck) h.push(`Nicht erledigt: ${[B.zopf && 'Zöpfe an der Prallplatte', B.treibgut && 'Treibgut an der Überlaufschwelle', B.sLeck && 'Stopfbuchse Schieber P2'].filter(Boolean).join(', ')}.`);
    return h;
  },
};

// ------------------------------------------------------------------ Niveaumessung LI-001 PW Talstraße (Messkette, Fehlersuche)
const f2 = (x) => Number(x).toFixed(2).replace('.', ',');
const num = (x) => { if (x == null) return NaN; const t = String(x).trim().replace(',', '.'); return t === '' ? NaN : parseFloat(t); };
const isoll = (pegel) => 4 + 16 * (pegel - LI.EINBAU) / LI.MB;
const nachT = (p) => sim.P.lm.behobenT !== null && p.w.abT !== null && p.w.abT >= sim.P.lm.behobenT && p.w.iT !== null && p.w.iT >= sim.P.lm.behobenT;
function protoVor() { return sim.P.lm.proto.find((p) => !p.w.behoben); }
function protoNach() { return [...sim.P.lm.proto].reverse().find((p) => p.w.behoben && nachT(p)); }
// Eintragungen werden gegen die eigenen Messungen geprüft (letzter Abstich, letzte Messung an der Prüfbuchse)
const protoErfasst = (p) => { if (!p || p.w.abstich === null) return false; const a = num(p.e.abstich), pg = num(p.e.pegel); return Math.abs(a - p.w.abstich) <= 0.03 && Math.abs(pg - (LI.BEZUG - a)) <= 0.02; };
const protoSoll = (p) => { if (!p) return false; const pg = num(p.e.pegel), i = num(p.e.iSoll); return Math.abs(i - isoll(pg)) <= 0.1; };
const protoMess = (p) => {
  if (!p || p.w.iGem === null || p.w.abT === null) return false;
  const e = p.e, w = p.w, fe = sim.P.lm.ursache === 'feucht' && !w.behoben, tolI = fe ? 0.8 : 0.12, tolA = fe ? 0.5 : 0.1;
  const zeitnah = Math.abs(w.iT - w.abT) <= 900;
  const iOk = Math.abs(num(e.iMess) - w.iGem) <= tolI;
  const a = String(e.anz ?? '').trim(), ungueltig = a === '' || /^[-–—]+$|gest/i.test(a);
  const aOk = [w.anzAb, w.anz].some((x) => (x === null ? ungueltig : Math.abs(num(a) - x) <= tolA));
  return zeitnah && iOk && aOk;
};
function pegelChecks() {
  const P = sim.P, L = P.lm, u = L.ursache;
  return [
    ['Störungsspeicher und Anzeige der Pumpensteuerung angesehen', () => hat(/angesehen: PW-Steuerung/), 'Ausgangspunkt jeder Fehlersuche: Welche Meldungen stehen an, in welcher Betriebsart läuft die Niveausteuerung?'],
    ['Wasserstand unabhängig gemessen (Abstich mit Lichtlot)', () => hat(/Abstich LI-001/), 'Ohne unabhängige Vergleichsmessung lässt sich nicht entscheiden, ob die Anzeige falsch ist.'],
    ['Schleifenstrom an der Prüfbuchse im Klemmenkasten gemessen', () => hat(/LI-001 Schleifenstrom an der Prüfbuchse/), 'Der Strom in der Feldschleife ist das eigentliche Messsignal: 4 mA ≙ Messanfang, 20 mA ≙ Messende, < 3,6 mA ≙ Leitungsunterbrechung.'],
    ['Strom am Ein- und Ausgang des Trennverstärkers gemessen', () => hat(/Trennverstärker Eingang/) && hat(/Trennverstärker Ausgang/), 'Der Vergleich Eingang/Ausgang zeigt, ob das Signal im Schaltschrank verfälscht wird.'],
    ['Alle drei Schwimmerschalter geprüft', () => hat(/Schwimmerschalter S1/) && hat(/Schwimmerschalter S2/) && hat(/Schwimmerschalter S3/), 'Die Schwimmer sichern Trockenlauf und Hochwasser ab und tragen den Notbetrieb – sie gehören zu jeder Prüfung der Niveausteuerung.'],
    ['Messprotokoll vor der Instandsetzung: Abstich und Pegel richtig erfasst', () => protoErfasst(protoVor()), 'Pegel = Bezugshöhe − Abstich (Bezug OK Lukenrahmen 3,95 m über Sumpfsohle).'],
    ['Messprotokoll vor der Instandsetzung: Sollstrom richtig berechnet', () => protoSoll(protoVor()), 'I = 4 mA + 16 mA · (Pegel − 0,10 m) / 5 m (Messbereich der Sonde 0–5 mWS, Einbau 0,10 m über Sohle).'],
    ['Messprotokoll vor der Instandsetzung: Strom und Anzeige richtig abgelesen', () => protoMess(protoVor()), 'Strom an der Prüfbuchse und Anzeige zeitnah zum Abstich ablesen (höchstens 15 min Abstand) – erst der Vergleich Soll/Ist lokalisiert den Fehler.'],
    ['Ursache richtig festgestellt (Auswahl in der Meldung)', () => sim.diagnose === u, 'Die Diagnose begründet, welches Teil der Messkette instand gesetzt wird.'],
    ['Messkette nur im Schwimmer-Notbetrieb bearbeitet', () => !hat(/Niveausteuerung lief im Sondenbetrieb!/), 'Wer an Sonde, Leitung, Trennverstärker oder Parametern arbeitet, während die Pumpen nach dem Messwert schalten, riskiert Trockenlauf oder Überlauf.'],
    ['Ursache beseitigt', () => lmBehoben(P), 'Die Messkette liefert wieder den richtigen Wert.'],
    ['Keine intakten Teile getauscht', () => (L.getauscht.sonde === 0 || u === 'kap') && (L.getauscht.trenn === 0 || u === 'trenn'), 'Tauschen „auf Verdacht“ kostet Geld und verschleiert die Ursache. Eine verschlammte Sonde wird gereinigt, nicht ersetzt.'],
    ['Funktionsprüfung nach der Instandsetzung (zweites Protokoll: Anzeige = Pegel ± 0,05 m)', () => { const p = protoNach(); return !!p && protoErfasst(p) && protoMess(p) && Math.abs(num(p.e.anz) - num(p.e.pegel)) <= 0.06 && Math.abs(num(p.e.iMess) - num(p.e.iSoll)) <= 0.2; }, 'Erst die Kontrollmessung nach der Reparatur (neuer Abstich, neue Strommessung) belegt, dass die Messkette wieder stimmt: Anzeige = Pegel, Strom = Sollstrom.'],
    ['Anlage in Normalbetrieb übergeben (Sondenbetrieb, Sonde eingehängt, Klemmenkasten zu, Pumpen AUTO)', () => L.modus === 'sonde' && !L.sondeOut && L.lage === 'ok' && !L.kkOffen && P.p.every((x) => x.wahl === 'auto' && x.rep), 'Nach Arbeiten an der Messkette läuft die Niveausteuerung wieder nach LI-001.'],
    ['Kein Notüberlauf und kein Trockenlauf während der Arbeiten', () => P.vUeb < 0.5 && !hat(/Abschaltung durch Trockenlaufschutz/), 'Während der Fehlersuche muss das Pumpwerk weiter sicher fördern.'],
    ['Meldung an die Schichtleitung abgegeben', meldung, 'Befund mit Messwerten, Ursache, Maßnahme, Ergebnis der Funktionsprüfung.'],
  ];
}
const PEGEL_MISSION = {
  id: 'pegel', titel: 'Pegelmessung PW Talstraße unplausibel', bereich: 'Pumpwerk Talstraße · Messtechnik', dauer: '45–60 min', stufe: 3, faul: 'S0', bel: 'B0', pw: null, pwOpt: { pegel: true }, diag: true, start: 'talstr', tab: 'pw', vorlauf: 2, speed: 5,
  auftrag: 'Im Abwasserpumpwerk Talstraße ist die Niveausteuerung seit der Nacht auffällig. Prüfe die Messkette der Pegelmessung LI-001 von der Sonde bis zur Steuerung, erfasse deine Messwerte in einem Messprotokoll, finde die Ursache und setze die Messung instand. Belege den Erfolg mit einer Kontrollmessung und gib eine Meldung mit der festgestellten Ursache ab. Das Pumpwerk muss währenddessen sicher weiterlaufen.',
  auftragStart: 'Schichtbeginn. Die Bereitschaft hat heute Nacht um 03:12 eine Störmeldung vom Abwasserpumpwerk Talstraße bekommen: Die Niveausteuerung ist auffällig, die Pumpen schalten nicht wie gewohnt, der angezeigte Pegel kommt den Kollegen merkwürdig vor. Gefunden wurde nichts. Prüfe die Messkette LI-001 von der Pegelsonde bis zur Steuerung, halte deine Messwerte im Messprotokoll fest, setze die Messung instand und belege den Erfolg mit einer Kontrollmessung. Das Pumpwerk muss währenddessen sicher weiterlaufen. Gib zum Schluss eine Meldung mit der Ursache ab.',
  lehrer: `Die Ursache wird bei jedem Start zufällig gezogen: ${Object.values(PEGEL_KARTE.ursachen).join(' · ')}. Messkette: hydrostatische Sonde 0–5 mWS, 4–20 mA, Einbau 0,10 m über Sohle → Klemmenkasten am Sumpf (Prüfbuchse) → Trennverstärker im Schaltschrank → Steuerung (Anzeige = (I − 4)/16 · Messbereich + 0,10 m). Bezug OK Lukenrahmen 3,95 m über Sohle. Mindestpensum unabhängig von der Ursache: Störungsspeicher, Abstich, Schleifenstrom, Trennverstärker Ein/Aus, alle Schwimmer, Messprotokoll vor der Instandsetzung (Pegel = 3,95 − Abstich; I_soll = 4 + 16 · (Pegel − 0,10)/5), Arbeiten nur im Schwimmer-Notbetrieb, Kontrollprotokoll danach, Übergabe in den Sondenbetrieb. Erkennungsmerkmale: Leitungsunterbrechung 0 mA, 24 V Leerlaufspannung an den Sondenklemmen, Ader abgerissen; Feuchtigkeit: Schleifenstrom springt, Sondenader-Strom kleiner als Schleifenstrom (Nebenschluss); Kapillare: Strom passt nicht zum Abstich und wandert, an Luft nicht 4,00 mA, Kabelmantel eingerissen → Sonde tauschen; Schlamm: Strom zu hoch und träge, Kabelmarkierung verrutscht → reinigen, auf Markierung einhängen; Messbereich: Strom passt zum Abstich, Anzeige nicht (Faktor 0,8) → Parameter 5,00 m (Kabelfahne); Trennverstärker: Eingang plausibel, Ausgang fest 12,00 mA; Hochwasserschwimmer: Messkette stimmt, S3 dauerhaft betätigt → freimachen.`,
  lehrerBericht() { const u = sim.P.lm.ursache; return `Gezogen: ${PEGEL_KARTE.ursachen[u]}. ${this.lehrer}`; },
  checks: pegelChecks,
  werte: () => { const P = sim.P, L = P.lm; return [['LI-001 Anzeige', L.valid ? f2(L.liAnz) : '––', 'm'], ['Wasserstand tatsächlich', f2(P.li), 'm'], ['Schleifenstrom', f2(L.iLoop), 'mA'], ['Niveausteuerung', L.modus === 'sonde' ? 'Sonde' : 'Schwimmer-Notbetrieb', ''], ['Messbereich Steuerung', f2(L.mbPar), 'm'], ['Starts P-001 / P-002', `${P.p[0].starts} / ${P.p[1].starts}`, ''], ['Notüberlauf seit Start', f0(P.vUeb), 'm³']]; },
  charts: [CH.lm, CH.qpw],
  kennzahlTitel: 'Messprotokolle',
  kennzahl: () => { const L = sim.P.lm; return L.proto.length ? L.proto.map((p, i) => `${i + 1}. ${p.w.behoben ? 'nach' : 'vor'} der Instandsetzung – eingetragen: Abstich ${p.e.abstich || '–'} m, Pegel ${p.e.pegel || '–'} m, Anzeige ${p.e.anz || '–'} m, Strom ${p.e.iMess || '–'} mA, Soll ${p.e.iSoll || '–'} mA | tatsächlich: Pegel ${f2(p.w.pegel)} m, Anzeige ${p.w.anz === null ? '––' : f2(p.w.anz)} m, Schleifenstrom ${f2(p.w.iLoop)} mA`).join('  ·  ') : 'Es wurde kein Messprotokoll ausgefüllt.'; },
  hinweise: () => {
    const h = [], L = sim.P.lm, u = L.ursache;
    h.push(`Gezogene Ursache: ${PEGEL_KARTE.ursachen[u]}.`);
    if (sim.diagnose && sim.diagnose !== u) h.push(`Gewählt wurde: ${sim.diagnose === 'unklar' ? 'Ursache nicht eindeutig' : PEGEL_KARTE.ursachen[sim.diagnose]}.`);
    const v = protoVor(); if (v) { const pg = num(v.e.pegel); if (!isNaN(pg)) h.push(`Sollstrom zum eingetragenen Pegel ${String(v.e.pegel)} m: ${f2(isoll(pg))} mA (eingetragen: ${v.e.iSoll || '–'} mA).`); }
    if (hat(/Niveausteuerung lief im Sondenbetrieb!/)) h.push(`Arbeiten im Sondenbetrieb: ${sim.log.filter((l) => /Niveausteuerung lief im Sondenbetrieb!/.test(l.text)).map((l) => l.text.split(' – ')[0]).join('; ')}.`);
    if (L.getauscht.sonde && u !== 'kap') h.push('Die Sonde wurde getauscht, obwohl sie nicht defekt war.');
    if (L.getauscht.trenn && u !== 'trenn') h.push('Der Trennverstärker wurde getauscht, obwohl er in Ordnung war.');
    if (sim.P.vUeb > 0.5) h.push(`Notüberlauf angesprungen: ${f0(sim.P.vUeb)} m³.`);
    if (!protoNach()) h.push('Es fehlt das Kontrollprotokoll nach der Instandsetzung.');
    return h;
  },
};

// Gruppierung und Nummerierung nach Lernfeldern (Umwelttechnologe für Abwasserbewirtschaftung)
export const LERNFELDER = [
  { lf: 0, titel: 'Einstieg', sub: 'alle Ausbildungsjahre' },
  { lf: 4, titel: 'Umwelttechnische Anlagen und Leitungsnetze betreiben', sub: '1. Ausbildungsjahr' },
  { lf: 6, titel: 'Stoffe fördern', sub: '2. Ausbildungsjahr' },
  { lf: 12, titel: 'Schlämme behandeln', sub: '3. Ausbildungsjahr' },
  { lf: 15, titel: 'Abwassertechnische Anlagen steuern und regeln', sub: '3. Ausbildungsjahr' },
];
const ZUORDNUNG = { frei: [0, '0', 'Einweisung'], bhf: [4, '4.1', 'Bauwerke prüfen'], pw_K1: [6, '6.1', 'Störungskarten Pumpwerk Talstraße'], pw_K2: [6, '6.2', 'Störungskarten Pumpwerk Talstraße'], pw_K3: [6, '6.3', 'Störungskarten Pumpwerk Talstraße'], pw_K4: [6, '6.4', 'Störungskarten Pumpwerk Talstraße'],
  pw_zufall: [6, '6.5', 'Zufallskarte und Instandsetzung'], pw_werkstatt: [6, '6.6', 'Zufallskarte und Instandsetzung'], pw_komplett: [6, '6.7', 'Zufallskarte und Instandsetzung'], bhkw: [12, '12.1', 'Faulung und Gasverwertung'], heizung: [12, '12.2', 'Faulung und Gasverwertung'], geblaese: [15, '15.1', 'Belüftungsregelung'], pegel: [15, '15.2', 'Messtechnik'] };

export const MISSIONEN = [
  {
    id: 'frei', titel: 'Freies Üben', bereich: 'Gesamte Anlage', dauer: 'offen', stufe: 1, faul: 'S0', bel: 'B0', start: 'leitwarte', tab: 'faul', vorlauf: 2,
    auftrag: 'Normalbetrieb ohne Störung. Erkunde die Anlage, lies die Vor-Ort-Instrumente ab und vergleiche sie mit den Werten in der Leitwarte.',
    lehrer: 'Keine Störung. Geeignet zur Einweisung in Bedienung und Instrumente sowie für eine Energiebilanz (Eigenversorgungsgrad, Anteil der Gebläsestation am Eigenbedarf).',
    checks: [],
    werte: () => [['BHKW Leistung el.', f0(sim.S.pel), 'kW'], ['Leistung Gebläsestation', f0(sim.B.pkw), 'kW'], ['Eigenbedarf Anlage', f0(sim.S.bedarf || P.BEDARF), 'kW'], ['Eigenversorgung', f0(sim.S.pel / (sim.S.bedarf || P.BEDARF) * 100), '%']],
    charts: [CH.gas, CH.pgeb],
    hinweise: () => [`Angesehene Vor-Ort-Instrumente: ${new Set(sim.log.filter((l) => /^angesehen: /.test(l.text)).map((l) => l.text.slice(11).split(' (')[0])).size}.`],
  },
  {
    id: 'bhkw', titel: 'BHKW steht', bereich: 'Faulung · Gas', dauer: '20–30 min', stufe: 2, faul: 'S1', bel: 'B0', start: 'leitwarte', tab: 'faul', vorlauf: 2,
    auftrag: 'Schichtbeginn 08:00 Uhr. In der Leitwarte steht eine Sammelstörung des BHKW an. Finde vor Ort die Ursache, beseitige sie, wenn das gefahrlos möglich ist, und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Kugelhahn HA 611 vor dem Gasverdichter wurde nach einer Wartung nicht wieder geöffnet. Vor Ort: BHKW-Bedienfeld „Gasdruck min PSL 613“, PI 610 ≈ 22 mbar, PI 613 ≈ 0 mbar, Hebel HA 611 quer zur Leitung. Der Gasspeicher läuft voll, bei ×60 zündet die Fackel nach etwa 2,5 Minuten. Lösung: HA 611 öffnen, Störung quittieren. Im Fachgespräch: Warum reicht die Sammelstörung in der Leitwarte allein nicht aus? Wie wird die Wiederinbetriebnahme nach Wartungsarbeiten abgesichert (Freigabe, Schaltprotokoll)?',
    checks: [
      ['Bedienfeld des BHKW vor Ort angesehen', () => hat(/angesehen: BHKW G10\.1/), 'Die Leitwarte meldet nur eine Sammelstörung; die genaue Ursache („Gasdruck min PSL 613“) steht am örtlichen Bedienfeld.'],
      ['Gasdruck vor und nach dem Verdichter verglichen (PI 610 / PI 613)', () => hat(/angesehen: PI 610/) && hat(/angesehen: PI 613/), 'Normaler Druck am Speicher, aber kein Druck vor dem BHKW grenzt den Fehler auf die Strecke dazwischen ein.'],
      ['Kugelhahn HA 611 geöffnet', () => sim.S.ha611, 'Hebel quer zur Leitung = geschlossen. Erst mit offenem Hahn kann der Verdichter Gas fördern.'],
      ['Störung am BHKW erfolgreich quittiert', () => hat(/BHKW Störung quittiert – Anlage betriebsbereit/), 'Quittieren ist erst sinnvoll, wenn die Ursache beseitigt ist – sonst steht die Störung sofort wieder an.'],
      ['BHKW läuft wieder', () => sim.S.bhkw === 'betrieb', 'Das BHKW startet automatisch, sobald der Gasspeicher über 45 % gefüllt ist.'],
      ['Meldung an die Schichtleitung abgegeben', meldung, 'Befund, Ursache, Maßnahme und Hinweis auf die Freigabe nach Wartung gehören in die Meldung.'],
    ],
    werte: () => [['Gasspeicher LI 609', f0(sim.S.V / 6), '%'], ['BHKW', { aus: 'bereit', start: 'Start', betrieb: 'Betrieb', stoerung: 'Störung' }[sim.S.bhkw], ''], ['BHKW Leistung el.', f0(sim.S.pel), 'kW'], ['Fackel F6.1', sim.S.fackel ? 'ein' : 'aus', ''], ['Kugelhahn HA 611', sim.S.ha611 ? 'offen' : 'zu', ''], ['Gasdruck PI 613', f0(Math.max(0, sim.S.p613)), 'mbar']],
    charts: [CH.gas, CH.bhkw],
    kennzahl: () => { const v = sim.S.vFackel; return `Seit Missionsstart abgefackelt: ${f0(v)} Nm³ Faulgas – das wären im BHKW etwa ${f0(v * P.HU62 * P.ETA_EL)} kWh Strom gewesen.`; },
    hinweise: () => {
      const h = [], auf = erstes(/HA 611 betätigt: Hebel längs/), q = sim.log.filter((l) => /BHKW Störung quittiert – Störung steht weiter an/.test(l.text)).length;
      h.push(auf ? `HA 611 wurde nach ${min(auf)} min (Echtzeit) geöffnet.` : 'HA 611 wurde nicht geöffnet – die Ursache blieb bestehen.');
      if (q) h.push(`${q}× wurde quittiert, bevor die Ursache beseitigt war.`);
      if (sim.S.vAbblasen > 0) h.push(`Achtung: Die Überdrucksicherung des Gasspeichers hat ${f0(sim.S.vAbblasen)} Nm³ Faulgas ungenutzt abgeblasen (Methanemission).`);
      if (sim.S.vFackel > 0) h.push(`Die Fackel war in Betrieb (${f0(sim.S.vFackel)} Nm³).`);
      return h;
    },
  },
  {
    id: 'heizung', titel: 'Faulturm kühlt aus', bereich: 'Faulung · Heizung', dauer: '20–30 min', stufe: 2, faul: 'S2', bel: 'B0', start: 'leitwarte', tab: 'faul', vorlauf: 12,
    auftrag: 'In der Leitwarte steht seit gestern Abend eine Sammelstörung der Heizung Faulung an, die Faulturmtemperatur sinkt langsam. Kläre die Ursache vor Ort, stelle den Normalbetrieb wieder her und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Motorschutzschalter Q11.1 der Heizwasserpumpe P11.1 (Maschinenhaus) hat ausgelöst. Vor Ort: Pumpe steht, Vor- und Rücklauf TI 1101/1102 kühlen ab, Störleuchte am Schaltkasten. Ohne Eingriff sinken Gasproduktion und Methangehalt; bei ×60 schaltet das BHKW nach rund 22 Minuten ab. Lösung: Motorschutz einschalten, Temperaturverlauf beobachten; im Fachgespräch Ursache des Auslösens hinterfragen (Überlast, Lagerschaden, Einstellwert).',
    checks: [
      ['Faulturmtemperatur vor Ort abgelesen (TI 1001)', () => hat(/angesehen: TI 1001/), 'Bestätigt den Leitwartenwert und schließt einen Messfehler aus.'],
      ['Heizwasserpumpe bzw. Schaltkasten im Maschinenhaus geprüft', () => hat(/angesehen: (P11\.1|=\+SK P11\.1)/), 'Die Sammelstörung „Heizung“ nennt keine Ursache; sie steht am Vor-Ort-Schaltkasten.'],
      ['Vor- und Rücklauftemperatur abgelesen', () => hat(/angesehen: TI 1101/) || hat(/angesehen: TI 1102/), 'Abgekühlter Vor- und Rücklauf zeigt: Es zirkuliert kein Heizwasser.'],
      ['Motorschutz eingeschaltet, Pumpe läuft', () => sim.S.p11, 'Nach dem Einschalten sollte geklärt werden, warum der Motorschutz ausgelöst hat.'],
      ['Meldung an die Schichtleitung abgegeben', meldung, 'Inhalt: Befund, Maßnahme und Empfehlung, die Ursache des Auslösens zu klären.'],
    ],
    werte: () => [['Faulturmtemperatur TI 1001', f1(sim.S.T_ft), '°C'], ['Methangehalt QI 614', f1(sim.S.ch4), 'Vol-%'], ['Faulgas FI 608', f1(sim.S.qProd), 'Nm³/h'], ['Vorlauf TI 1101', f0(sim.S.tVL), '°C'], ['Heizwasserpumpe P11.1', sim.S.p11 ? 'läuft' : 'steht', '']],
    charts: [CH.temp, CH.ch4, CH.bhkw],
    kennzahl: () => `Faulturmtemperatur jetzt ${f1(sim.S.T_ft)} °C, Methangehalt ${f1(sim.S.ch4)} Vol-%.`,
    hinweise: () => {
      const h = [], ein = erstes(/Q11\.1 Motorschutz P11\.1 eingeschaltet/);
      h.push(ein ? `Motorschutz nach ${min(ein)} min (Echtzeit) eingeschaltet.` : 'Der Motorschutz wurde nicht eingeschaltet.');
      if (hat(/BHKW schaltet ab: Methangehalt/)) h.push('Das BHKW hat wegen zu geringem Methangehalt abgeschaltet – die Störung wurde zu spät behoben.');
      return h;
    },
  },
  {
    id: 'geblaese', titel: 'Stromfresser Gebläsestation', bereich: 'Belüftung · MSR · Energie', dauer: '30–45 min', stufe: 3, faul: 'S0', bel: 'B1', start: 'leitwarte', tab: 'bel', vorlauf: 12,
    auftrag: 'Das Energiemonitoring meldet: Die Gebläsestation braucht seit gestern Nachmittag deutlich mehr Strom als sonst, obwohl sich an Zulauf und Fahrweise nichts geändert hat. Prüfe Leitwarte und Anlage, finde die Ursache und stelle den Normalbetrieb fachgerecht wieder her. Schätze ab, was der Fehler pro Tag an Energie kostet, und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Die O₂-Sonde QI 301 (Straße 1) hat Belag auf der Membran und zeigt nur etwa 45 % des tatsächlichen Werts. QIC 301 regelt auf den falschen Istwert und bläst zu viel Luft ein (tatsächlich ≈ 4,3–4,5 mg/L). Hinweise: Trend – Luftmenge Str. 1 und Gebläseleistung seit gestern ≈ 14 Uhr gestiegen, O₂-Istwerte unverändert; FV 301 ≈ 88 %, FV 311 ≈ 63 %; Blasenbild Straße 1 deutlich stärker; Handmessung Str. 1 ≈ 4,4 mg/L, Str. 2 ≈ 2,0 mg/L. Fachgerecht: QIC 301 auf HAND (Stellwert halten), Sonde ziehen, Membran reinigen, Luftkalibrierung, einsetzen, QIC 301 auf AUTO. Wird die Sonde im AUTO-Betrieb gezogen, sieht der Regler an Luft einen hohen Messwert und drosselt die Luft – O₂ in Straße 1 fällt ab (Fehler im Protokoll sichtbar). Bei der Luftkalibrierung muss der aktuelle Luftdruck eingegeben werden: Es herrscht Tiefdruckwetter mit 982 hPa (Leitwarte, PI 001). Wer mit 1013 hPa kalibriert, erhält eine um ≈ 3 % zu hohe Anzeige. Mehrverbrauch im voll ausgeprägten Fehlerzustand ≈ 20–25 kW; in den 24 h vor Missionsstart (Belag baut sich ab gestern ≈ 12 Uhr auf) ≈ 550 kWh. Die Auswertung zeigt den genauen Wert. Mögliche Fehlbedienungen vor Ort: G1.2 zusätzlich auf AUTO (Parallelbetrieb, höhere Verluste), Klappen auf ORT stehen lassen (Regler wirkungslos), Gebläse in HAND oder AUS.',
    checks: [
      ['Vergleichsmessung Straße 1 mit dem Handmessgerät', () => hat(/Vergleichsmessung Handmessgerät Straße 1/), 'Erst die unabhängige Messung belegt, dass die Sonde falsch misst und nicht der Prozess gestört ist.'],
      ['QIC 301 vor dem Ziehen der Sonde auf HAND geschaltet', () => hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf HAND/) && !hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf AUTO/), 'An Luft zeigt die Sonde die Sättigung (≈ 10 mg/L). Im AUTO-Betrieb würde der Regler die Luft fast ganz zurücknehmen.'],
      ['Membran der Sonde QI 301 gereinigt', () => hat(/QI 301 Membran gereinigt/), 'Der Belag behindert die Diffusion des Sauerstoffs zur Membran – deshalb zeigt die Sonde zu wenig an.'],
      ['QI 301 an Luft kalibriert', () => hat(/QI 301 Luftkalibrierung/), 'Nach der Reinigung bleibt ein Restfehler; die Luftkalibrierung stellt die Steilheit der Messkette wieder her.'],
      ['Dabei den aktuellen Luftdruck verwendet (± 5 hPa)', () => hat(/QI 301 Luftkalibrierung/) && Math.abs(sim.B.s[0].kalP - sim.B.pAir) <= 5, 'Die O₂-Sättigung an Luft hängt vom Luftdruck ab (c_s ∝ p). Mit Normdruck statt des tatsächlichen Drucks wird die Sonde falsch kalibriert.'],
      ['Sonde eingesetzt, QIC 301 wieder in AUTO', () => !sim.B.s[0].out && sim.B.s[0].ctrl.auto, 'Erst mit eingesetzter Sonde und AUTO-Betrieb regelt die Anlage wieder selbstständig.'],
      ['QI 301 misst wieder richtig (Abweichung < 0,1 mg/L)', () => Math.abs(sim.B.s[0].meas - sim.B.s[0].o2) < 0.1, 'Kontrolle des Erfolgs der Maßnahme.'],
      ['Belüftung in Automatik hinterlassen (G1.1 AUTO, G1.2 RESERVE, Klappen FERN, Regler AUTO)', () => { const B = sim.B; return B.g[0].mode === 'auto' && B.g[1].mode === 'reserve' && B.s.every((s) => !s.fv.ort && s.ctrl.auto); }, 'Nach Eingriffen vor Ort muss die Anlage wieder im regulären Automatikbetrieb laufen – sonst regelt sie nicht oder verbraucht unnötig Energie.'],
      ['Meldung an die Schichtleitung abgegeben', meldung, 'Inhalt: Befund (Belag auf QI 301), Maßnahme, Energiemehrverbrauch und Empfehlung (Reinigungsintervall prüfen).'],
    ],
    werte: () => { const B = sim.B; return [['QI 301 Anzeige Str. 1', f1(Math.max(0, B.s[0].meas)), 'mg/L'], ['O₂ tatsächlich Str. 1', f1(B.s[0].o2), 'mg/L'], ['Luftmenge Str. 1', f0(B.s[0].L), 'Nm³/h'], ['Luftmenge Str. 2', f0(B.s[1].L), 'Nm³/h'], ['Klappe FV 301 / FV 311', `${f0(B.s[0].klappe)} / ${f0(B.s[1].klappe)}`, '%'], ['Gebläse G1.1 / G1.2', `${f1(B.g[0].hz)} / ${f1(B.g[1].hz)}`, 'Hz'], ['Druck Sammelleitung PI 202', f0(B.pD), 'mbar'], ['Leistung Gebläsestation', f0(B.pkw), 'kW']]; },
    charts: [CH.o2, CH.luft, CH.pgeb],
    kennzahl: () => { const B = sim.B, m = B.mehr24 || 0, mehr = Math.max(0, B.eGeb - B.eRef); return `Mehrverbrauch der Gebläsestation durch die Fehlmessung in den 24 h vor Missionsstart: ≈ ${f0(m)} kWh (im Mittel ≈ ${f0(m / 24)} kW), bei 0,25 €/kWh ≈ ${f0(m * 0.25)} € pro Tag bzw. ≈ ${f0(m * 0.25 * 365)} € im Jahr. Seit Missionsstart zusätzlich ≈ ${f0(mehr)} kWh.`; },
    hinweise: () => {
      const h = [], s = sim.B.s[0];
      const hm = erstes(/Vergleichsmessung Handmessgerät Straße 1/), rein = erstes(/QI 301 Membran gereinigt/), kal = erstes(/QI 301 Luftkalibrierung/);
      h.push(hm ? `Vergleichsmessung Straße 1 nach ${min(hm)} min (Echtzeit): ${hm.text.split(': ')[1]}.` : 'Ohne Vergleichsmessung war nicht belegt, ob die Sonde oder der Prozess die Ursache ist.');
      if (hat(/QI 311 aus dem Becken gezogen/)) h.push('Auch die Sonde QI 311 (Straße 2) wurde gezogen – sie war in Ordnung.');
      if (s.minOutAuto != null && s.minOutAuto < 99) h.push(`Die Sonde wurde im AUTO-Betrieb gezogen: Der Regler drosselte die Luft, der tatsächliche O₂-Gehalt in Straße 1 fiel bis auf ${f1(s.minOutAuto)} mg/L.`);
      if (kal && rein && kal.tr < rein.tr) h.push('Die Luftkalibrierung wurde vor der Reinigung durchgeführt – sie gleicht dann den Belag aus und muss nach der Reinigung wiederholt werden.');
      if (kal && !rein) h.push('Kalibriert, aber nicht gereinigt: Die Anzeige stimmt vorübergehend, der Belag wächst jedoch weiter und die Sonde reagiert träge.');
      if (hat(/QI 301 Luftkalibrierung/) && Math.abs(s.kalP - sim.B.pAir) > 5) h.push(`QI 301 wurde mit ${Math.round(s.kalP)} hPa kalibriert, der Luftdruck betrug aber ${Math.round(sim.B.pAir)} hPa – die Anzeige liegt um ≈ ${f1(Math.abs(s.kalP / sim.B.pAir - 1) * 100)} % daneben.`);
      if (hat(/G1\.2 Betriebsart am FU: \w+ → AUTO/)) h.push('G1.2 lief zeitweise parallel zu G1.1 (beide AUTO). Zwei Gebläse im Teillastbetrieb haben höhere Verluste als eines.');
      if (hat(/FV 3[01]1 auf ORT/)) h.push('Eine Regelklappe stand zeitweise auf ORT – in dieser Zeit hatte der O₂-Regler der Straße keinen Einfluss.');
      if (hat(/G1\.[12] Betriebsart am FU: \w+ → (HAND|AUS)/)) h.push('Ein Gebläse wurde vor Ort auf HAND bzw. AUS geschaltet.');
      if (hat(/Keine Belüftung – kein Gebläse in Betrieb/)) h.push('Achtung: Zeitweise lief kein Gebläse – die Belebung war ohne Belüftung.');
      const par = sim.log.filter((l) => /^QIC 3[01]1: (Sollwert|Kp|Tn)/.test(l.text));
      if (par.length) h.push(`Reglerparameter geändert: ${par.map((l) => l.text).join('; ')}.`);
      if (rein) h.push(`Membran gereinigt nach ${min(rein)} min (Echtzeit).`);
      return h;
    },
  },
  BHF_MISSION,
  PEGEL_MISSION,
  ...Object.keys(KARTEN).map((k) => pwMission(k)),
  ...['zufall', 'werkstatt', 'komplett'].map((art) => ({ ...pwMission('K1', art), wuerfel: () => pwMission(Object.keys(KARTEN)[Math.floor(Math.random() * 4)], art) })),
];

export function initMissionen({ ui, walk, wks, setExam, bhf }) {
  BH = bhf || null;
  let aktiv = null, ctx = null, bericht = null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  for (const m of MISSIONEN) { const z = ZUORDNUNG[m.id] || [0, '–', '']; [m.lf, m.nr, m.gruppe] = z; }
  const nrSort = (a, b) => a.nr.localeCompare(b.nr, 'de', { numeric: true });
  $('misList').innerHTML = LERNFELDER.map((L) => {
    const ms = MISSIONEN.filter((m) => m.lf === L.lf).sort(nrSort); if (!ms.length) return '';
    let grp = null;
    return `<details class="misLF" ${L.lf === 0 ? '' : 'open'}><summary><span class="lfN">${L.lf ? `LF ${L.lf}` : '★'}</span><span class="lfT">${L.titel}<small>${L.sub} · ${ms.length} ${ms.length === 1 ? 'Mission' : 'Missionen'}</small></span></summary>` +
      ms.map((m) => { const kopf = m.gruppe !== grp ? `<div class="misG">${(grp = m.gruppe)}</div>` : '';
        return `${kopf}<details class="misI"><summary><span class="misNr">${m.nr}</span><span class="misTi">${m.titel}</span><span class="st" title="Schwierigkeit">${stars(m.stufe)}</span><span class="misD">${m.dauer}</span></summary>
        <div class="misB"><div class="misM">${m.bereich}${m.speed ? ` · Zeitraffer ×${m.speed}` : ''}</div><p>${m.auftrag}</p>
        <details class="misL"><summary>Lösungshinweise (Lehrkräfte)</summary><p>${m.lehrer}</p></details>
        <button class="btn on" data-m="${m.id}">▶ Mission ${m.nr} starten</button></div></details>`; }).join('') + '</details>';
  }).join('');
  ui.overlays.push('mis', 'brief', 'ausw');

  const open = () => { $('spSel').value = String(sim.speed); $('mis').style.display = 'flex'; };
  $('bMis').onclick = open; $('bMis2').onclick = open;
  $('misClose').onclick = () => { $('mis').style.display = 'none'; };
  $('spSel').onchange = () => { sim.speed = +$('spSel').value; };
  $('misList').onclick = (e) => {
    const id = e.target.dataset.m; if (!id) return;
    let m = MISSIONEN.find((x) => x.id === id);
    if (m.wuerfel) m = Object.assign(m.wuerfel(), { nr: m.nr, lf: m.lf });
    m = Object.assign(Object.create(Object.getPrototypeOf(m)), m, { titel: `Mission ${m.nr}: ${m.titel}` });
    const exam = $('misExam').checked; ui.erklaer = !exam; setExam(exam);
    startSzenario({ faul: m.faul, bel: m.bel, pw: m.pw || null, pwOpt: m.pwOpt || {}, speed: m.speed || +$('spSel').value, titel: `Mission „${m.titel}“${exam ? ' (Prüfungsmodus)' : ''}` });
    if (m.onStart) m.onStart();
    ui.diagnose = !!(m.pw || m.diag); document.body.classList.toggle('mis-pegel', m.id === 'pegel');
    aktiv = m; ctx = { t0: performance.now(), tSim0: sim.S.t, exam, werteStart: m.werte ? m.werte() : [] };
    $('mis').style.display = 'none';
    $('briefT').textContent = m.titel; $('briefM').textContent = `${m.bereich} · ${m.dauer}`; $('briefA').textContent = m.auftragStart || m.auftrag;
    $('brief').style.display = 'flex'; $('misBar').style.display = 'flex'; document.body.classList.add('mission'); $('misName').textContent = m.titel;
  };
  $('briefGo').onclick = () => { $('brief').style.display = 'none'; walk.enter(aktiv ? aktiv.start : 'leitwarte'); if (aktiv) { if (aktiv.tab) ui.showPLS(aktiv.tab); if (aktiv.werkstattStart && !ctx.wsGeoeffnet) { ctx.wsGeoeffnet = true; wks.open(); } } };
  $('bAuftrag').onclick = () => { $('brief').style.display = 'flex'; };

  $('bEnde').onclick = () => {
    if (!aktiv) return;
    if (!ctx.beendet) { logA(`Mission „${aktiv.titel}“ beendet`, 'sys'); ctx.beendet = true; }
    bericht = sammleBericht(aktiv, ctx);
    $('auswT').textContent = aktiv.titel;
    $('ausw').style.display = 'flex';
    renderBericht($('auswBody'), bericht);
  };
  $('auswPDF').onclick = async () => {
    if (!bericht) return;
    bericht.name = $('auswName').value.trim();
    const b = $('auswPDF'); b.disabled = true; b.textContent = 'PDF wird erstellt …';
    try { const f = await berichtAlsPDF(bericht, { musterloesung: $('auswML').checked }); ui.toast(`Gespeichert: ${f}`); }
    catch (err) { ui.toast(`PDF konnte nicht erstellt werden: ${err.message}`); }
    finally { b.disabled = false; b.textContent = '⬇ Bericht als PDF'; }
  };
  $('auswCopy').onclick = async () => {
    const txt = `${$('auswT').textContent}\n${$('auswBody').innerText}\n\n${logText()}`;
    try { await navigator.clipboard.writeText(txt); ui.toast('Bericht und Protokoll kopiert.'); } catch { ui.toast('Kopieren nicht möglich.'); }
  };
  $('auswClose').onclick = () => { $('ausw').style.display = 'none'; };
  $('auswNeu').onclick = () => { $('ausw').style.display = 'none'; aktiv = null; ui.diagnose = null; ctx = null; $('misBar').style.display = 'none'; document.body.classList.remove('mission'); setExam(false); ui.erklaer = true; open(); };
  setInterval(() => { if (aktiv) { const s = Math.floor((performance.now() - ctx.t0) / 1000); $('misTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 1000);
}
