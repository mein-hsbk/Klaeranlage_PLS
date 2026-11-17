// Missionen: vorbereitete Betriebssituationen mit Auftrag (Briefing), Start in der Begehung,
// Auswertung (Missionsbericht am Bildschirm und als PDF, siehe bericht.js).
import { sim, startSzenario, logText, logA } from './anlage-sim.js';
import { P } from './faulung-modell.js';
import { f0, f1 } from './instrumente.js';
import { sammleBericht, renderBericht, berichtAlsPDF } from './bericht.js';

const $ = (id) => document.getElementById(id);
const hat = (re) => sim.log.some((l) => re.test(l.text));
const erstes = (re) => sim.log.find((l) => re.test(l.text));
const meldung = () => sim.log.some((l) => l.art === 'meldung');
const min = (l) => (l ? Math.round(l.tr / 60000) : null);

// Diagrammvorlagen für den Bericht
const CH = {
  gas: { titel: 'Gasspeicher GS-1 (LI 609), Fackelbetrieb orange hinterlegt', einheit: '%', src: 'S', min: 0, max: 100, band: { key: 'f' }, serien: [{ key: 'lvl', label: 'Füllstand LI 609', farbe: '#e1a100' }] },
  bhkw: { titel: 'BHKW und Faulgas', einheit: 'kW bzw. Nm³/h', src: 'S', min: 0, max: 140, serien: [{ key: 'pel', label: 'BHKW P el [kW]', farbe: '#0097a7' }, { key: 'q', label: 'Faulgas FI 608 [Nm³/h]', farbe: '#e67e22', strich: true }] },
  temp: { titel: 'Faulturmtemperatur (TI 1001)', einheit: '°C', src: 'S', min: 28, max: 40, serien: [{ key: 'T', label: 'TI 1001', farbe: '#d63031' }] },
  ch4: { titel: 'Methangehalt Faulgas (QI 614)', einheit: 'Vol-%', src: 'S', min: 40, max: 66, serien: [{ key: 'ch4', label: 'QI 614 CH4', farbe: '#6c5ce7' }] },
  o2: { titel: 'Sauerstoff Straße 1: Messwert und tatsächlicher Wert', einheit: 'mg/L', src: 'B', min: 0, max: 11, serien: [{ key: 'm1', label: 'QI 301 Messwert', farbe: '#e1a100' }, { key: 'o1', label: 'O2 tatsächlich Str. 1', farbe: '#d63031', strich: true }, { key: 'm2', label: 'QI 311 Str. 2', farbe: '#2e86de', dick: 1.4 }] },
  luft: { titel: 'Luftmengen je Straße (FI 301 / FI 311)', einheit: 'Nm³/h', src: 'B', min: 0, max: 3500, serien: [{ key: 'l1', label: 'Straße 1', farbe: '#00a8b5' }, { key: 'l2', label: 'Straße 2', farbe: '#6c8ebf' }] },
  pgeb: { titel: 'Leistung Gebläsestation (JI 201)', einheit: 'kW', src: 'B', min: 0, max: 150, serien: [{ key: 'p', label: 'Ist-Leistung', farbe: '#d63031' }, { key: 'pr', label: 'bei richtiger O2-Messung', farbe: '#1e8e5a', strich: true }] },
};

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
    lehrer: 'Die O₂-Sonde QI 301 (Straße 1) hat Belag auf der Membran und zeigt nur etwa 45 % des tatsächlichen Werts. QIC 301 regelt auf den falschen Istwert und bläst zu viel Luft ein (tatsächlich ≈ 4,3–4,5 mg/L). Hinweise: Trend – Luftmenge Str. 1 und Gebläseleistung seit gestern ≈ 14 Uhr gestiegen, O₂-Istwerte unverändert; FV 301 ≈ 88 %, FV 311 ≈ 63 %; Blasenbild Straße 1 deutlich stärker; Handmessung Str. 1 ≈ 4,4 mg/L, Str. 2 ≈ 2,0 mg/L. Fachgerecht: QIC 301 auf HAND (Stellwert halten), Sonde ziehen, Membran reinigen, Luftkalibrierung, einsetzen, QIC 301 auf AUTO. Wird die Sonde im AUTO-Betrieb gezogen, sieht der Regler an Luft einen hohen Messwert und drosselt die Luft – O₂ in Straße 1 fällt ab (Fehler im Protokoll sichtbar). Mehrverbrauch im voll ausgeprägten Fehlerzustand ≈ 20–25 kW; in den 24 h vor Missionsstart (Belag baut sich ab gestern ≈ 12 Uhr auf) ≈ 400 kWh. Die Auswertung zeigt den genauen Wert.',
    checks: [
      ['Vergleichsmessung Straße 1 mit dem Handmessgerät', () => hat(/Vergleichsmessung Handmessgerät Straße 1/), 'Erst die unabhängige Messung belegt, dass die Sonde falsch misst und nicht der Prozess gestört ist.'],
      ['QIC 301 vor dem Ziehen der Sonde auf HAND geschaltet', () => hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf HAND/) && !hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf AUTO/), 'An Luft zeigt die Sonde die Sättigung (≈ 10 mg/L). Im AUTO-Betrieb würde der Regler die Luft fast ganz zurücknehmen.'],
      ['Membran der Sonde QI 301 gereinigt', () => hat(/QI 301 Membran gereinigt/), 'Der Belag behindert die Diffusion des Sauerstoffs zur Membran – deshalb zeigt die Sonde zu wenig an.'],
      ['QI 301 an Luft kalibriert', () => hat(/QI 301 Luftkalibrierung/), 'Nach der Reinigung bleibt ein Restfehler; die Luftkalibrierung stellt die Steilheit der Messkette wieder her.'],
      ['Sonde eingesetzt, QIC 301 wieder in AUTO', () => !sim.B.s[0].out && sim.B.s[0].ctrl.auto, 'Erst mit eingesetzter Sonde und AUTO-Betrieb regelt die Anlage wieder selbstständig.'],
      ['QI 301 misst wieder richtig (Abweichung < 0,3 mg/L)', () => Math.abs(sim.B.s[0].meas - sim.B.s[0].o2) < 0.3, 'Kontrolle des Erfolgs der Maßnahme.'],
      ['Meldung an die Schichtleitung abgegeben', meldung, 'Inhalt: Befund (Belag auf QI 301), Maßnahme, Energiemehrverbrauch und Empfehlung (Reinigungsintervall prüfen).'],
    ],
    werte: () => { const B = sim.B; return [['QI 301 Anzeige Str. 1', f1(Math.max(0, B.s[0].meas)), 'mg/L'], ['O₂ tatsächlich Str. 1', f1(B.s[0].o2), 'mg/L'], ['Luftmenge Str. 1', f0(B.s[0].L), 'Nm³/h'], ['Luftmenge Str. 2', f0(B.s[1].L), 'Nm³/h'], ['Klappe FV 301 / FV 311', `${f0(B.s[0].klappe)} / ${f0(B.s[1].klappe)}`, '%'], ['Gebläse G1.1', f1(B.hz), 'Hz'], ['Leistung Gebläsestation', f0(B.pkw), 'kW']]; },
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
      const par = sim.log.filter((l) => /^QIC 3[01]1: (Sollwert|Kp|Tn)/.test(l.text));
      if (par.length) h.push(`Reglerparameter geändert: ${par.map((l) => l.text).join('; ')}.`);
      if (rein) h.push(`Membran gereinigt nach ${min(rein)} min (Echtzeit).`);
      return h;
    },
  },
];

export function initMissionen({ ui, walk, setExam }) {
  let aktiv = null, ctx = null, bericht = null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  $('misList').innerHTML = MISSIONEN.map((m) => `<div class="mis">
    <div class="misT"><b>${m.titel}</b><span class="st" title="Schwierigkeit">${stars(m.stufe)}</span></div>
    <div class="misM">${m.bereich} · ${m.dauer}</div>
    <p>${m.auftrag}</p>
    <details><summary>Lösungshinweise (Lehrkräfte)</summary><p>${m.lehrer}</p></details>
    <button class="btn on" data-m="${m.id}">▶ Mission starten</button></div>`).join('');
  ui.overlays.push('mis', 'brief', 'ausw');

  const open = () => { $('spSel').value = String(sim.speed); $('mis').style.display = 'flex'; };
  $('bMis').onclick = open; $('bMis2').onclick = open;
  $('misClose').onclick = () => { $('mis').style.display = 'none'; };
  $('spSel').onchange = () => { sim.speed = +$('spSel').value; };
  $('misList').onclick = (e) => {
    const id = e.target.dataset.m; if (!id) return;
    const m = MISSIONEN.find((x) => x.id === id);
    const exam = $('misExam').checked; ui.erklaer = !exam; setExam(exam);
    startSzenario({ faul: m.faul, bel: m.bel, speed: +$('spSel').value, titel: `Mission „${m.titel}“${exam ? ' (Prüfungsmodus)' : ''}` });
    aktiv = m; ctx = { t0: performance.now(), tSim0: sim.S.t, exam, werteStart: m.werte ? m.werte() : [] };
    $('mis').style.display = 'none';
    $('briefT').textContent = m.titel; $('briefM').textContent = `${m.bereich} · ${m.dauer}`; $('briefA').textContent = m.auftrag;
    $('brief').style.display = 'flex'; $('misBar').style.display = 'flex'; document.body.classList.add('mission'); $('misName').textContent = m.titel;
  };
  $('briefGo').onclick = () => { $('brief').style.display = 'none'; walk.enter(aktiv ? aktiv.start : 'leitwarte'); if (aktiv) ui.showPLS(aktiv.tab); };
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
  $('auswNeu').onclick = () => { $('ausw').style.display = 'none'; aktiv = null; ctx = null; $('misBar').style.display = 'none'; document.body.classList.remove('mission'); setExam(false); ui.erklaer = true; open(); };
  setInterval(() => { if (aktiv) { const s = Math.floor((performance.now() - ctx.t0) / 1000); $('misTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 1000);
}
