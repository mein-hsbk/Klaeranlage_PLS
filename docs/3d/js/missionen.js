// Missionen: vorbereitete Betriebssituationen mit Auftrag (Briefing), Start in der Begehung,
// und Auswertung anhand von Protokoll und Anlagenzustand.
import { sim, startSzenario, logText, logA } from './anlage-sim.js';
import { P } from './faulung-modell.js';
import { f0 } from './instrumente.js';

const $ = (id) => document.getElementById(id);
const hat = (re) => sim.log.some((l) => re.test(l.text));

export const MISSIONEN = [
  {
    id: 'frei', titel: 'Freies Üben', bereich: 'Gesamte Anlage', dauer: 'offen', stufe: 1, faul: 'S0', bel: 'B0', start: 'leitwarte', tab: 'faul',
    auftrag: 'Normalbetrieb ohne Störung. Erkunde die Anlage, lies die Vor-Ort-Instrumente ab und vergleiche sie mit den Werten in der Leitwarte.',
    lehrer: 'Keine Störung. Geeignet zur Einweisung in Bedienung und Instrumente sowie für eine Energiebilanz (Eigenversorgungsgrad, Anteil der Gebläsestation am Eigenbedarf).',
    checks: [],
  },
  {
    id: 'bhkw', titel: 'BHKW steht', bereich: 'Faulung · Gas', dauer: '20–30 min', stufe: 2, faul: 'S1', bel: 'B0', start: 'leitwarte', tab: 'faul',
    auftrag: 'Schichtbeginn 08:00 Uhr. In der Leitwarte steht eine Sammelstörung des BHKW an. Finde vor Ort die Ursache, beseitige sie, wenn das gefahrlos möglich ist, und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Kugelhahn HA 611 vor dem Gasverdichter wurde nach einer Wartung nicht wieder geöffnet. Vor Ort: BHKW-Bedienfeld „Gasdruck min PSL 613“, PI 610 ≈ 22 mbar, PI 613 ≈ 0 mbar, Hebel HA 611 quer zur Leitung. Der Gasspeicher läuft voll, bei ×60 zündet die Fackel nach etwa 2,5 Minuten. Lösung: HA 611 öffnen, Störung quittieren.',
    checks: [
      ['Bedienfeld des BHKW vor Ort angesehen', () => hat(/angesehen: BHKW G10\.1/)],
      ['Gasdruck vor und nach dem Verdichter verglichen (PI 610 / PI 613)', () => hat(/angesehen: PI 610/) && hat(/angesehen: PI 613/)],
      ['Kugelhahn HA 611 geöffnet', () => sim.S.ha611],
      ['Störung am BHKW erfolgreich quittiert', () => hat(/BHKW Störung quittiert – Anlage betriebsbereit/)],
      ['BHKW läuft wieder', () => sim.S.bhkw === 'betrieb'],
      ['Meldung an die Schichtleitung abgegeben', () => sim.log.some((l) => l.art === 'meldung')],
    ],
    kennzahl: () => { const v = sim.S.vFackel; return `Seit Missionsstart abgefackelt: ${f0(v)} Nm³ Faulgas – das wären im BHKW etwa ${f0(v * P.HU62 * P.ETA_EL)} kWh Strom gewesen.`; },
  },
  {
    id: 'heizung', titel: 'Faulturm kühlt aus', bereich: 'Faulung · Heizung', dauer: '20–30 min', stufe: 2, faul: 'S2', bel: 'B0', start: 'leitwarte', tab: 'faul',
    auftrag: 'In der Leitwarte steht seit gestern Abend eine Sammelstörung der Heizung Faulung an, die Faulturmtemperatur sinkt langsam. Kläre die Ursache vor Ort, stelle den Normalbetrieb wieder her und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Motorschutzschalter Q11.1 der Heizwasserpumpe P11.1 (Maschinenhaus) hat ausgelöst. Vor Ort: Pumpe steht, Vor- und Rücklauf TI 1101/1102 kühlen ab, Störleuchte am Schaltkasten. Ohne Eingriff sinken Gasproduktion und Methangehalt; bei ×60 schaltet das BHKW nach rund 22 Minuten ab. Lösung: Motorschutz einschalten, Temperaturverlauf beobachten; im Fachgespräch Ursache des Auslösens hinterfragen.',
    checks: [
      ['Faulturmtemperatur vor Ort abgelesen (TI 1001)', () => hat(/angesehen: TI 1001/)],
      ['Heizwasserpumpe bzw. Schaltkasten im Maschinenhaus geprüft', () => hat(/angesehen: (P11\.1|=\+SK P11\.1)/)],
      ['Vor- und Rücklauftemperatur abgelesen', () => hat(/angesehen: TI 1101/) || hat(/angesehen: TI 1102/)],
      ['Motorschutz eingeschaltet, Pumpe läuft', () => sim.S.p11],
      ['Meldung an die Schichtleitung abgegeben', () => sim.log.some((l) => l.art === 'meldung')],
    ],
    kennzahl: () => `Faulturmtemperatur jetzt ${sim.S.T_ft.toFixed(1).replace('.', ',')} °C, Methangehalt ${sim.S.ch4.toFixed(1).replace('.', ',')} Vol-%.`,
  },
  {
    id: 'geblaese', titel: 'Stromfresser Gebläsestation', bereich: 'Belüftung · MSR · Energie', dauer: '30–45 min', stufe: 3, faul: 'S0', bel: 'B1', start: 'leitwarte', tab: 'bel',
    auftrag: 'Das Energiemonitoring meldet: Die Gebläsestation braucht seit gestern Nachmittag deutlich mehr Strom als sonst, obwohl sich an Zulauf und Fahrweise nichts geändert hat. Prüfe Leitwarte und Anlage, finde die Ursache und stelle den Normalbetrieb fachgerecht wieder her. Schätze ab, was der Fehler pro Tag an Energie kostet, und gib eine Meldung an die Schichtleitung ab.',
    lehrer: 'Die O₂-Sonde QI 301 (Straße 1) hat Belag auf der Membran und zeigt nur etwa 45 % des tatsächlichen Werts. QIC 301 regelt auf den falschen Istwert und bläst zu viel Luft ein (tatsächlich ≈ 4,3–4,5 mg/L). Hinweise: Trend – Luftmenge Str. 1 und Gebläseleistung seit gestern ≈ 14 Uhr gestiegen, O₂-Istwerte unverändert; FV 301 ≈ 88 %, FV 311 ≈ 63 %; Blasenbild Straße 1 deutlich stärker; Handmessung Str. 1 ≈ 4,4 mg/L, Str. 2 ≈ 2,0 mg/L. Fachgerecht: QIC 301 auf HAND (Stellwert halten), Sonde ziehen, Membran reinigen, Luftkalibrierung, einsetzen, QIC 301 auf AUTO. Wird die Sonde im AUTO-Betrieb gezogen, sieht der Regler an Luft einen hohen Messwert und drosselt die Luft – O₂ in Straße 1 fällt ab (Fehler im Protokoll sichtbar). Mehrverbrauch im voll ausgeprägten Fehlerzustand ≈ 20–25 kW; in den 24 h vor Missionsstart (Belag baut sich ab gestern ≈ 12 Uhr auf) ≈ 400 kWh. Die Auswertung zeigt den genauen Wert.',
    checks: [
      ['Vergleichsmessung Straße 1 mit dem Handmessgerät', () => hat(/Vergleichsmessung Handmessgerät Straße 1/)],
      ['QIC 301 vor dem Ziehen der Sonde auf HAND geschaltet', () => hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf HAND/) && !hat(/QI 301 aus dem Becken gezogen – Regler QIC 301 steht auf AUTO/)],
      ['Membran der Sonde QI 301 gereinigt', () => hat(/QI 301 Membran gereinigt/)],
      ['QI 301 an Luft kalibriert', () => hat(/QI 301 Luftkalibrierung/)],
      ['Sonde eingesetzt, QIC 301 wieder in AUTO', () => !sim.B.s[0].out && sim.B.s[0].ctrl.auto],
      ['QI 301 misst wieder richtig (Abweichung < 0,3 mg/L)', () => Math.abs(sim.B.s[0].meas - sim.B.s[0].o2) < 0.3],
      ['Meldung an die Schichtleitung abgegeben', () => sim.log.some((l) => l.art === 'meldung')],
    ],
    kennzahl: () => { const B = sim.B, m = B.mehr24 || 0, mehr = Math.max(0, B.eGeb - B.eRef); return `Mehrverbrauch der Gebläsestation durch die Fehlmessung in den 24 h vor Missionsstart: ≈ ${f0(m)} kWh (im Mittel ≈ ${f0(m / 24)} kW), bei 0,25 €/kWh ≈ ${f0(m * 0.25)} € pro Tag. Seit Missionsstart zusätzlich ≈ ${f0(mehr)} kWh.`; },
  },
];

export function initMissionen({ ui, walk, setExam }) {
  let aktiv = null, t0 = 0;
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
    aktiv = m; t0 = performance.now();
    $('mis').style.display = 'none';
    $('briefT').textContent = m.titel; $('briefM').textContent = `${m.bereich} · ${m.dauer}`; $('briefA').textContent = m.auftrag;
    $('brief').style.display = 'flex'; $('misBar').style.display = 'flex'; document.body.classList.add('mission'); $('misName').textContent = m.titel;
  };
  $('briefGo').onclick = () => { $('brief').style.display = 'none'; walk.enter(aktiv ? aktiv.start : 'leitwarte'); if (aktiv) ui.showPLS(aktiv.tab); };
  $('bAuftrag').onclick = () => { $('brief').style.display = 'flex'; };
  $('bEnde').onclick = () => {
    if (!aktiv) return;
    logA(`Mission „${aktiv.titel}“ beendet`, 'sys');
    const res = aktiv.checks.map(([t, f]) => [t, !!f()]), ok = res.filter((r) => r[1]).length;
    const min = Math.round((performance.now() - t0) / 60000);
    $('auswT').textContent = aktiv.titel;
    $('auswBody').innerHTML = (res.length ? `<div class="sub">${ok} von ${res.length} Schritten erfüllt · Dauer ${min} min</div><ul class="chk">${res.map(([t, o]) => `<li class="${o ? 'ok' : 'no'}">${o ? '✓' : '✗'} ${t}</li>`).join('')}</ul>` : `<div class="sub">Dauer ${min} min</div>`) +
      (aktiv.kennzahl ? `<p class="kz">${aktiv.kennzahl()}</p>` : '');
    $('ausw').style.display = 'flex';
  };
  $('auswCopy').onclick = async () => {
    const txt = `${$('auswT').textContent}\n${$('auswBody').innerText}\n\n${logText()}`;
    try { await navigator.clipboard.writeText(txt); ui.toast('Auswertung und Protokoll kopiert.'); } catch { ui.toast('Kopieren nicht möglich.'); }
  };
  $('auswClose').onclick = () => { $('ausw').style.display = 'none'; };
  $('auswNeu').onclick = () => { $('ausw').style.display = 'none'; aktiv = null; $('misBar').style.display = 'none'; document.body.classList.remove('mission'); setExam(false); ui.erklaer = true; open(); };
  setInterval(() => { if (aktiv) { const s = Math.floor((performance.now() - t0) / 1000); $('misTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }, 1000);
}
