// Oberfläche der Anlagensimulation: Leitwarte (Faulung/Gas, Belüftung mit Reglerbedienung),
// Instrument-Detailansicht, Protokoll, Meldung an die Schichtleitung, Hinweise (Toast).
import { P, fmtZeit } from './faulung-modell.js';
import { PB, STR } from './belueftung-modell.js';
import { sim, logA, logText } from './anlage-sim.js';
import { insts, f1, f0 } from './instrumente.js';

const $ = (id) => document.getElementById(id);
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');

export function initAnlageUI() {
  const ui = { erklaer: true, overlays: ['detail', 'meld'] };

  // ---------------- Toast
  let toastT;
  ui.toast = (m) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = 'none'), 3600); };

  // ---------------- Detailansicht Instrument
  const dcv = $('dcv'), detail = { id: null, ctx: dcv.getContext('2d') }, lastInspect = {};
  ui.detail = detail;
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
      b.onclick = () => { a.fn(); renderActions(); (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height); }; box.appendChild(b);
    });
  }
  const closeDetail = () => { detail.id = null; $('detail').style.display = 'none'; };
  $('dClose').onclick = closeDetail;
  $('detail').addEventListener('click', (e) => { if (e.target.id === 'detail') closeDetail(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { closeDetail(); $('meld').style.display = 'none'; } });

  // ---------------- Leitwarte mit Reitern
  let plsOpen = false, tab = 'faul';
  const togglePLS = (quiet) => { plsOpen = !plsOpen; $('pls').style.display = plsOpen ? 'block' : 'none'; $('bPLS').classList.toggle('on', plsOpen); if (plsOpen) { if (quiet !== true) logA(`Leitwarte geöffnet (${tab === 'faul' ? 'Faulung/Gas' : 'Belüftung'})`, 'blick'); renderPLS(); } };
  ui.showPLS = (t) => { if (t) setTab(t, true); if (!plsOpen) togglePLS(true); };
  $('bPLS').onclick = () => togglePLS(); $('plsClose').onclick = () => togglePLS();
  addEventListener('keydown', (e) => { if (e.code === 'Tab' && document.body.classList.contains('walking')) { e.preventDefault(); togglePLS(); } });
  function setTab(t, silent) {
    tab = t; for (const b of document.querySelectorAll('#plsTabs .btn')) b.classList.toggle('on', b.dataset.t === t);
    $('plsFaul').style.display = t === 'faul' ? '' : 'none'; $('plsBel').style.display = t === 'bel' ? '' : 'none';
    if (!silent) logA(`Leitwarte: Bild ${t === 'faul' ? 'Faulung/Gas' : 'Belüftung'}`, 'blick');
    renderPLS();
  }
  $('plsTabs').onclick = (e) => { if (e.target.dataset.t) setTab(e.target.dataset.t); };

  const row = (tg, name, val, unit, cls = '') => `<tr><td class="tg">${tg}</td><td>${name}</td><td class="v ${cls}">${val}</td><td class="u">${unit}</td></tr>`;
  const alarmList = (al) => {
    al = al.sort((a, b) => (b.aktiv - a.aktiv) || (b.kommt - a.kommt)).slice(0, 8);
    return al.length ? al.map((a) => `<div class="al ${a.aktiv ? 'on' : ''} k${a.klasse}"><span>${fmtZeit(a.kommt)}</span>${a.text}${a.aktiv ? '' : ` <i>(geht ${fmtZeit(a.geht)})</i>`}</div>`).join('') : '<div class="al">Keine Meldungen</div>';
  };
  function renderPLS() {
    if (tab === 'faul') {
      const S = sim.S, lvl = S.V / P.V_GS * 100, bed = S.bedarf || P.BEDARF;
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
      $('plsAl').innerHTML = alarmList(Object.values(S.alarme));
      drawTrend($('trend'), S.hist, S.t, 12, [['lvl', '#ffd32a', (v) => v], ['pel', '#00d2d3', (v) => v / 1.25], ['q', '#ff9f43', (v) => v * 1.25], ['ch4', '#a29bfe', (v) => v], ['T', '#ff6b6b', (v) => (v - 20) * 4]], (p) => p.f);
    } else {
      const B = sim.B;
      $('belVals').innerHTML = `<table>
        <tr><td></td><td></td><td class="v hd">Str. 1</td><td class="v hd">Str. 2</td><td></td></tr>
        <tr><td class="tg">QI 301/311</td><td>O₂ Istwert</td><td class="v ${B.s[0].meas < 1 ? 'a' : ''}">${num(Math.max(0, B.s[0].meas))}</td><td class="v ${B.s[1].meas < 1 ? 'a' : ''}">${num(Math.max(0, B.s[1].meas))}</td><td class="u">mg/L</td></tr>
        <tr><td class="tg">FI 301/311</td><td>Luftmenge</td><td class="v">${f0(B.s[0].L)}</td><td class="v">${f0(B.s[1].L)}</td><td class="u">Nm³/h</td></tr>
        <tr><td class="tg">FV 301/311</td><td>Klappe</td><td class="v">${f0(B.s[0].klappe)}</td><td class="v">${f0(B.s[1].klappe)}</td><td class="u">%</td></tr>
      </table><table style="margin-top:4px">
        ${row('FIC 201', 'Luftmenge gesamt', f0(B.Ltot), 'Nm³/h')}
        ${row('G1.1', 'Drehzahl (FU)', num(B.hz), 'Hz', B.Ltot >= PB.L_MAX * 0.995 ? 'w' : '')}
        ${row('JI 201', 'Leistung Gebläse', f0(B.pkw), 'kW')}
        ${row('QI 302', 'NH₄-N Ablauf Belebung', num(B.nh4), 'mg/L', B.nh4 > 5 ? 'a' : '')}
      </table>
      <div class="cnt">Gebläse seit Start: ${f0(B.eGeb)} kWh</div>`;
      STR.forEach((st, i) => {
        const s = B.s[i], el = $(`fp${i}`);
        el.querySelector('.mode').textContent = s.ctrl.auto ? 'AUTO' : 'HAND';
        el.querySelector('.mode').classList.toggle('hand', !s.ctrl.auto);
        el.querySelector('.ist').textContent = `Ist ${num(Math.max(0, s.meas))} mg/L · Stellgröße ${f0(s.L)} Nm³/h`;
        for (const inp of el.querySelectorAll('input')) if (document.activeElement !== inp) inp.value = String(s.ctrl[inp.dataset.k]).replace('.', ',');
      });
      $('belAl').innerHTML = alarmList(Object.values(B.alarme));
      drawTrend($('trendB'), B.hist, B.t, 24, [['m1', '#ffd32a', (v) => v * 20], ['m2', '#fdcb6e', (v) => v * 20], ['l1', '#00d2d3', (v) => v / 30], ['l2', '#74b9ff', (v) => v / 30], ['p', '#ff6b6b', (v) => v / 2], ['nh4', '#a29bfe', (v) => v * 20]]);
    }
  }
  // Reglerbedienung (einmalig aufgebaut, Werte werden nur aktualisiert)
  $('belFP').innerHTML = STR.map((st, i) => `<div class="fp" id="fp${i}">
      <div class="fph"><b>${st.qic}</b> O₂-Regler ${st.name} <button class="btn mode" data-i="${i}"></button></div>
      <div class="ist"></div>
      <div class="fpi"><label>Sollwert<input data-i="${i}" data-k="sp" inputmode="decimal"> mg/L</label>
      <label>K<sub>p</sub><input data-i="${i}" data-k="kp" inputmode="decimal"> Nm³/h je mg/L</label>
      <label>T<sub>n</sub><input data-i="${i}" data-k="tn" inputmode="decimal"> h</label>
      <label>Hand-Stellwert<input data-i="${i}" data-k="hand" inputmode="decimal"> Nm³/h</label></div></div>`).join('');
  const LIM = { sp: [0.3, 5], kp: [0, 5000], tn: [0.02, 10], hand: [0, PB.L_MAX] }, UNIT = { sp: 'mg/L', kp: '', tn: 'h', hand: 'Nm³/h' };
  $('belFP').addEventListener('change', (e) => {
    const inp = e.target; if (inp.tagName !== 'INPUT') return;
    const i = +inp.dataset.i, k = inp.dataset.k, c = sim.B.s[i].ctrl, v = parseFloat(inp.value.replace(',', '.'));
    if (!isFinite(v)) { inp.value = String(c[k]); return; }
    const nv = Math.max(LIM[k][0], Math.min(LIM[k][1], v)), alt = c[k]; c[k] = nv;
    logA(`${STR[i].qic}: ${k === 'sp' ? 'Sollwert' : k === 'kp' ? 'Kp' : k === 'tn' ? 'Tn' : 'Hand-Stellwert'} ${String(alt).replace('.', ',')} → ${String(nv).replace('.', ',')} ${UNIT[k]}`, 'aktion');
  });
  $('belFP').addEventListener('click', (e) => {
    const b = e.target.closest('.mode'); if (!b) return;
    const i = +b.dataset.i, s = sim.B.s[i];
    s.ctrl.auto = !s.ctrl.auto; if (!s.ctrl.auto) s.ctrl.hand = Math.round(s.L);
    logA(`${STR[i].qic} auf ${s.ctrl.auto ? 'AUTO' : `HAND (Stellwert ${f0(s.ctrl.hand)} Nm³/h)`} geschaltet`);
    renderPLS();
  });

  function drawTrend(c, hist, t1, hours, ser, flag) {
    const W = c.clientWidth, H = c.clientHeight; if (!W) return;
    c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; const x = c.getContext('2d'); x.scale(devicePixelRatio, devicePixelRatio);
    x.fillStyle = '#0b1424'; x.fillRect(0, 0, W, H);
    const t0 = t1 - hours * 3600, X = (t) => 34 + (W - 44) * (t - t0) / (t1 - t0), Y = (v) => H - 18 - (H - 30) * Math.max(0, Math.min(100, v)) / 100;
    x.strokeStyle = '#1f3352'; x.fillStyle = '#7f8fa6'; x.font = '10px Arial'; x.lineWidth = 1;
    for (let v = 0; v <= 100; v += 25) { x.beginPath(); x.moveTo(34, Y(v)); x.lineTo(W - 10, Y(v)); x.stroke(); x.fillText(v, 8, Y(v) + 3); }
    const st = hours / 4; for (let k = 0; k <= 4; k++) { const tt = t1 - (hours - k * st) * 3600; x.fillText(fmtZeit(tt), X(tt) - 14, H - 4); }
    for (const [k, col, sc] of ser) { x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); let s0 = false; for (const p of hist) { if (p.t < t0) continue; const px = X(p.t), py = Y(sc(p[k])); s0 ? x.lineTo(px, py) : x.moveTo(px, py); s0 = true; } x.stroke(); }
    if (flag) { x.fillStyle = 'rgba(255,120,40,0.25)'; for (const p of hist) if (flag(p) && p.t >= t0) x.fillRect(X(p.t) - 1, H - 18, 3, 5); }
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

  // ---------------- zyklische Aktualisierung
  let t = 0;
  ui.update = (dt) => {
    t -= dt; if (t > 0) return; t = 0.5;
    const S = sim.S;
    $('simClock').textContent = `Tag ${Math.floor(S.t / 86400) + 1} · ${fmtZeit(S.t)} · ×${sim.speed}`;
    const nA = [...Object.values(S.alarme), ...Object.values(sim.B.alarme)].filter((a) => a.aktiv && a.klasse === 'A').length;
    $('bPLS').textContent = nA ? `Leitwarte (${nA} ⚠)` : 'Leitwarte';
    $('bPLS').classList.toggle('alarm', nA > 0);
    if (plsOpen) renderPLS();
  };
  ui.isBlocked = () => ui.overlays.some((id) => $(id).style.display === 'flex');
  return ui;
}
