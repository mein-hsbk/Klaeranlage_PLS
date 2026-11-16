// Oberfläche zur Faulungssimulation: Leitwarte, Instrument-Detailansicht,
// Protokoll, Meldung an die Schichtleitung, Szenario-/Zeitraffer-Menü.
import { P, SZENARIEN, fmtZeit } from './faulung-modell.js';
import { sim, logA, logText, startSzenario } from './faulung-sim.js';

const $ = (id) => document.getElementById(id);
const f1 = (x) => x.toFixed(1).replace('.', ','), f0 = (x) => Math.round(x).toLocaleString('de-DE');

export function initFaulungUI() {
  let insts = {};
  const ui = { erklaer: true };

  // ---------------- Toast
  let toastT;
  ui.toast = (m) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = 'none'), 3200); };

  // ---------------- Detailansicht Instrument
  const dcv = $('dcv'), detail = { id: null, ctx: dcv.getContext('2d') }, lastInspect = {};
  ui.detail = detail;
  ui.setInsts = (i) => { insts = i; };
  ui.openDetail = (id, msg) => {
    if (!id) { if (msg) ui.toast(msg); return; }
    const it = insts[id]; detail.id = id;
    $('dTitle').textContent = it.tag; $('dName').textContent = it.name;
    $('dInfo').textContent = it.info; $('dInfo').style.display = ui.erklaer ? '' : 'none';
    dcv.width = 512; dcv.height = Math.round(512 * (it.detail ? 0.75 : (it.aspect || 1)));
    (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height);
    renderActions(); $('detail').style.display = 'flex';
    if (!lastInspect[id] || performance.now() - lastInspect[id] > 30000) logA(`angesehen: ${it.tag} (${it.name})`, 'blick');
    lastInspect[id] = performance.now();
  };
  function renderActions() {
    const it = insts[detail.id], box = $('dAct'); box.innerHTML = '';
    (it.actions ? it.actions() : []).forEach((a) => {
      const b = document.createElement('button'); b.className = 'btn act'; b.textContent = a.label;
      b.onclick = () => { a.fn(); renderActions(); }; box.appendChild(b);
    });
  }
  const closeDetail = () => { detail.id = null; $('detail').style.display = 'none'; };
  $('dClose').onclick = closeDetail;
  $('detail').addEventListener('click', (e) => { if (e.target.id === 'detail') closeDetail(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { closeDetail(); $('meld').style.display = 'none'; $('szMenu').style.display = 'none'; } });

  // ---------------- Leitwarte
  let plsOpen = false;
  const togglePLS = () => { plsOpen = !plsOpen; $('pls').style.display = plsOpen ? 'block' : 'none'; $('bPLS').classList.toggle('on', plsOpen); if (plsOpen) { logA('Leitwarte geöffnet', 'blick'); renderPLS(); } };
  $('bPLS').onclick = togglePLS; $('plsClose').onclick = togglePLS;
  addEventListener('keydown', (e) => { if (e.code === 'Tab' && document.body.classList.contains('walking')) { e.preventDefault(); togglePLS(); } });
  function renderPLS() {
    const S = sim.S, lvl = S.V / P.V_GS * 100, bed = S.bedarf || P.BEDARF;
    const row = (tg, name, val, unit, cls = '') => `<tr><td class="tg">${tg}</td><td>${name}</td><td class="v ${cls}">${val}</td><td class="u">${unit}</td></tr>`;
    const bh = { aus: 'Bereit', start: 'Start', betrieb: 'Betrieb', stoerung: 'Störung' }[S.bhkw];
    $('plsVals').innerHTML = `<table>
      ${row('LI 609', 'Gasspeicher GS-1', f0(lvl), '%', lvl >= 88 ? 'w' : '')}
      ${row('FI 608', 'Faulgasproduktion', f1(S.qProd), 'Nm³/h')}
      ${row('G10.1', 'BHKW Zustand', bh, '', S.bhkw === 'stoerung' ? 'a' : '')}
      ${row('JI 101', 'BHKW Leistung el.', f0(S.pel), 'kW')}
      ${row('F6.1', 'Fackel', S.fackel ? 'Ein' : 'Aus', '', S.fackel ? 'w' : '')}
      ${row('TI 1001', 'Faulturmtemperatur', f1(S.T_ft), '°C', S.T_ft < 35 ? 'w' : '')}
      ${row('QI 614', 'Methangehalt', f1(S.ch4), 'Vol-%', S.ch4 < 55 ? 'w' : '')}
      ${row('JI 001', 'Eigenbedarf Anlage', f0(bed), 'kW')}
      ${row('', 'Eigenversorgung', f0(S.pel / bed * 100), '%')}
    </table>
    <div class="cnt">Zähler seit Start: BHKW ${f0(S.eBhkw)} kWh · Fackel ${f0(S.vFackel)} Nm³ · Netzbezug ${f0(S.eBezug)} kWh${S.vAbblasen > 0 ? ` · <span class="a">abgeblasen ${f0(S.vAbblasen)} Nm³</span>` : ''}</div>`;
    const al = Object.values(S.alarme).sort((a, b) => (b.aktiv - a.aktiv) || (b.kommt - a.kommt)).slice(0, 8);
    $('plsAl').innerHTML = al.length ? al.map((a) => `<div class="al ${a.aktiv ? 'on' : ''} k${a.klasse}"><span>${fmtZeit(a.kommt)}</span>${a.text}${a.aktiv ? '' : ` <i>(geht ${fmtZeit(a.geht)})</i>`}</div>`).join('') : '<div class="al">Keine Meldungen</div>';
    drawTrend();
  }
  function drawTrend() {
    const c = $('trend'), W = c.clientWidth, H = c.clientHeight; if (!W) return;
    c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; const x = c.getContext('2d'); x.scale(devicePixelRatio, devicePixelRatio);
    x.fillStyle = '#0b1424'; x.fillRect(0, 0, W, H);
    const S = sim.S, t1 = S.t, t0 = t1 - 12 * 3600, X = (t) => 34 + (W - 44) * (t - t0) / (t1 - t0), Y = (v) => H - 18 - (H - 30) * v / 100;
    x.strokeStyle = '#1f3352'; x.fillStyle = '#7f8fa6'; x.font = '10px Arial'; x.lineWidth = 1;
    for (let v = 0; v <= 100; v += 25) { x.beginPath(); x.moveTo(34, Y(v)); x.lineTo(W - 10, Y(v)); x.stroke(); x.fillText(v, 8, Y(v) + 3); }
    for (let k = 0; k <= 12; k += 3) { const tt = t1 - (12 - k) * 3600; x.fillText(fmtZeit(tt), X(tt) - 14, H - 4); }
    const ser = [['lvl', '#ffd32a', (v) => v], ['pel', '#00d2d3', (v) => v / 1.25], ['q', '#ff9f43', (v) => v * 1.25], ['ch4', '#a29bfe', (v) => v], ['T', '#ff6b6b', (v) => (v - 20) * 4]];
    for (const [k, col, sc] of ser) { x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); let st = false; for (const p of S.hist) { if (p.t < t0) continue; const px = X(p.t), py = Y(sc(p[k])); st ? x.lineTo(px, py) : x.moveTo(px, py); st = true; } x.stroke(); }
    x.fillStyle = 'rgba(255,120,40,0.25)'; for (const p of S.hist) if (p.f && p.t >= t0) x.fillRect(X(p.t) - 1, H - 18, 3, 5);
  }

  // ---------------- Protokoll, Meldung
  let logOpen = false;
  const renderLog = () => { if (logOpen) $('logBody').textContent = logText(); };
  sim.listeners.add(renderLog);
  $('bLog').onclick = () => { logOpen = !logOpen; $('log').style.display = logOpen ? 'block' : 'none'; $('bLog').classList.toggle('on', logOpen); renderLog(); };
  $('logClose').onclick = () => { logOpen = false; $('log').style.display = 'none'; $('bLog').classList.remove('on'); };
  $('logCopy').onclick = async () => { try { await navigator.clipboard.writeText(logText()); ui.toast('Protokoll kopiert.'); } catch { ui.toast('Kopieren nicht möglich – Text markieren und kopieren.'); } };
  $('bMeld').onclick = () => { $('meld').style.display = 'flex'; $('meldText').focus(); };
  $('meldCancel').onclick = () => { $('meld').style.display = 'none'; };
  $('meldOk').onclick = () => { const t = $('meldText').value.trim(); if (t) { logA(`MELDUNG an Schichtleitung: ${t}`, 'meldung'); ui.toast('Meldung protokolliert.'); } $('meldText').value = ''; $('meld').style.display = 'none'; };

  // ---------------- Szenario-Menü
  $('szInfo').innerHTML = Object.values(SZENARIEN).map((z) => `<p><b>${z.code} ${z.titel}:</b> ${z.prueferInfo}</p>`).join('');
  $('bSz').onclick = () => { $('szSel').value = sim.S.szenario; $('spSel').value = String(sim.speed); $('szMenu').style.display = 'flex'; };
  $('szCancel').onclick = () => { $('szMenu').style.display = 'none'; };
  $('szStart').onclick = () => {
    ui.erklaer = !$('szExam').checked;
    startSzenario($('szSel').value, +$('spSel').value);
    $('szMenu').style.display = 'none'; ui.toast(`Szenario ${sim.S.szenario} gestartet.`);
  };
  $('spSel').onchange = () => { sim.speed = +$('spSel').value; };

  // ---------------- zyklische Aktualisierung
  let t = 0;
  ui.update = (dt) => {
    t -= dt; if (t > 0) return; t = 0.5;
    const S = sim.S;
    $('simClock').textContent = `Faulung · Tag ${Math.floor(S.t / 86400) + 1} · ${fmtZeit(S.t)} · ×${sim.speed}`;
    const nA = Object.values(S.alarme).filter((a) => a.aktiv && a.klasse === 'A').length;
    $('bPLS').textContent = nA ? `Leitwarte (${nA} ⚠)` : 'Leitwarte';
    $('bPLS').classList.toggle('alarm', nA > 0);
    if (plsOpen) renderPLS();
  };
  ui.isBlocked = () => ['detail', 'meld', 'szMenu'].some((id) => $(id).style.display === 'flex');
  return ui;
}
