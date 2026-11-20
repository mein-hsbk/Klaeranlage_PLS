// Oberfläche der Anlagensimulation: Leitwarte (Faulung/Gas, Belüftung mit Reglerbedienung),
// Instrument-Detailansicht, Protokoll, Meldung an die Schichtleitung, Hinweise (Toast).
import { P, fmtZeit } from './faulung-modell.js';
import { PB, STR, MODI } from './belueftung-modell.js';
import { PP, KARTEN } from './pumpwerk-modell.js';
import { PO } from './pwost-modell.js';
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
    const dw = it.detailW || 512; dcv.width = dw; dcv.height = Math.round(dw * (it.detailAspect || (it.detail ? 0.75 : (it.aspect || 1))));
    (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height);
    renderActions(); $('detail').style.display = 'flex';
    if (!lastInspect[id] || performance.now() - lastInspect[id] > 30000) logA(`angesehen: ${it.tag} (${it.name})`, 'blick');
    lastInspect[id] = performance.now();
  };
  // Bedienelemente der Detailansicht: Knopf {label, fn}, Auswahl {typ:'wahl', label, optionen:[[wert, text]], wert, fn},
  // Zahl {typ:'zahl', label, wert, min, max, step, einheit, knopf, fn}, Zwischenüberschrift {typ:'titel', label}
  function renderActions() {
    const it = insts[detail.id], box = $('dAct'); box.innerHTML = '';
    const nach = () => { renderActions(); (it.detail || it.draw)(detail.ctx, dcv.width, dcv.height); };
    (it.actions ? it.actions() : []).forEach((a) => {
      if (a.typ === 'titel') { const d = document.createElement('div'); d.className = 'actT'; d.textContent = a.label; box.appendChild(d); return; }
      if (a.typ === 'wahl') {
        const d = document.createElement('div'); d.className = 'actRow';
        d.innerHTML = `<span class="actL">${a.label}</span><span class="seg">${a.optionen.map(([v, t]) => `<button class="btn${v === a.wert ? ' on' : ''}" data-v="${v}">${t}</button>`).join('')}</span>`;
        d.querySelector('.seg').onclick = (e) => { const v = e.target.dataset.v; if (v != null && v !== String(a.wert)) { a.fn(v); nach(); } };
        box.appendChild(d); return;
      }
      if (a.typ === 'zahl') {
        const d = document.createElement('div'); d.className = 'actRow';
        d.innerHTML = `<span class="actL">${a.label}</span><span class="num"><input inputmode="decimal" value="${String(a.wert).replace('.', ',')}"> ${a.einheit || ''} <button class="btn act">${a.knopf || 'Setzen'}</button></span>`;
        const inp = d.querySelector('input');
        const go = () => { const v = parseFloat(inp.value.replace(',', '.')); if (!isFinite(v)) return ui.toast('Bitte eine Zahl eingeben.'); a.fn(Math.max(a.min ?? -1e9, Math.min(a.max ?? 1e9, v))); nach(); };
        d.querySelector('button').onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        box.appendChild(d); return;
      }
      const b = document.createElement('button'); b.className = 'btn act'; b.textContent = a.label;
      b.onclick = () => { a.fn(); nach(); }; box.appendChild(b);
    });
  }
  const closeDetail = () => { detail.id = null; $('detail').style.display = 'none'; };
  $('dClose').onclick = closeDetail;
  $('detail').addEventListener('click', (e) => { if (e.target.id === 'detail') closeDetail(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { closeDetail(); $('meld').style.display = 'none'; } });

  // ---------------- Leitwarte mit Reitern
  let plsOpen = false, tab = 'faul';
  const TABN = { faul: 'Faulung/Gas', bel: 'Belüftung', pw: 'PW Talstraße', ost: 'PW Industriegebiet Ost' };
  const togglePLS = (quiet) => { plsOpen = !plsOpen; $('pls').style.display = plsOpen ? 'block' : 'none'; $('bPLS').classList.toggle('on', plsOpen); if (plsOpen) { if (quiet !== true) logA(`Leitwarte geöffnet (${TABN[tab]})`, 'blick'); renderPLS(); } };
  ui.showPLS = (t) => { if (t) setTab(t, true); if (!plsOpen) togglePLS(true); };
  $('bPLS').onclick = () => togglePLS(); $('plsClose').onclick = () => togglePLS();
  addEventListener('keydown', (e) => { if (e.code === 'Tab' && document.body.classList.contains('walking')) { e.preventDefault(); togglePLS(); } });
  function setTab(t, silent) {
    tab = t; for (const b of document.querySelectorAll('#plsTabs .btn')) b.classList.toggle('on', b.dataset.t === t);
    $('plsFaul').style.display = t === 'faul' ? '' : 'none'; $('plsBel').style.display = t === 'bel' ? '' : 'none'; $('plsPW').style.display = t === 'pw' ? '' : 'none'; $('plsOst').style.display = t === 'ost' ? '' : 'none';
    if (!silent) logA(`Leitwarte: Bild ${TABN[t]}`, 'blick');
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
    } else if (tab === 'pw') {
      const W = sim.P, st = (x) => x.stoer ? 'Störung' : !x.rep ? 'Rep.-Sch. 0' : x.run ? 'Betrieb' : 'Bereit';
      const cl = (x) => (x.stoer || !x.rep ? 'a' : '');
      $('pwVals').innerHTML = `<table>
        ${row('LI-001', 'Pegel Pumpensumpf', num(W.li, 2), 'm', W.li > 2.4 ? 'a' : '')}
        ${row('FI-001', 'Förderstrom Druckleitung', f0(W.q), 'm³/h', W.p.some((x) => x.run && x.laeuftT > 120 && x.q < PP.Q_SOLL) ? 'w' : '')}
        ${row('', 'Ein- / Ausschaltpegel', `${num(W.liEin, 2)} / ${num(W.liAus, 2)}`, 'm')}
      </table><table style="margin-top:4px">
        <tr><td></td><td></td><td class="v hd">P-001</td><td class="v hd">P-002</td><td></td></tr>
        <tr><td class="tg">YS</td><td>Zustand</td><td class="v ${cl(W.p[0])}">${st(W.p[0])}</td><td class="v ${cl(W.p[1])}">${st(W.p[1])}</td><td></td></tr>
        <tr><td class="tg">HS</td><td>Wahlschalter</td><td class="v ${W.p[0].wahl !== 'auto' ? 'w' : ''}">${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[W.p[0].wahl]}</td><td class="v ${W.p[1].wahl !== 'auto' ? 'w' : ''}">${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[W.p[1].wahl]}</td><td></td></tr>
        <tr><td class="tg">II</td><td>Motorstrom</td><td class="v">${num(W.p[0].amp)}</td><td class="v">${num(W.p[1].amp)}</td><td class="u">A</td></tr>
        <tr><td class="tg"></td><td>Betriebsstunden</td><td class="v">${f0(W.p[0].bh)}</td><td class="v">${f0(W.p[1].bh)}</td><td class="u">h</td></tr>
        <tr><td class="tg"></td><td>Schaltspiele seit Start</td><td class="v">${W.p[0].starts}</td><td class="v">${W.p[1].starts}</td><td></td></tr>
      </table>
      <div class="cnt">Seit Start: gefördert ${f0(W.vGef)} m³ · Energie ${f0(W.eKwh)} kWh${W.vUeb > 0 ? ` · <span class="a">Notüberlauf ${f0(W.vUeb)} m³</span>` : ''}</div>`;
      $('pwAl').innerHTML = alarmList(Object.values(W.alarme));
      drawTrend($('trendP'), W.hist, W.t, 3, [['li', '#ffd32a', (v) => v / 3 * 100], ['q1', '#00d2d3', (v) => v / 1.5], ['q2', '#74b9ff', (v) => v / 1.5], ['i1', '#ff6b6b', (v) => v / 30 * 100]]);
    } else if (tab === 'ost') {
      const W = sim.O, st = (x) => !x.rep ? 'Rep.-Sch. 0' : x.run ? 'Betrieb' : 'Bereit', cl = (x) => (!x.rep ? 'a' : '');
      $('ostVals').innerHTML = `<table>
        ${row('LI-101', 'Pegel Pumpensumpf', num(W.li, 2), 'm', W.li > PO.LI_HOCH ? 'a' : W.li > 2.0 ? 'w' : '')}
        ${row('FI-101', 'Förderstrom Druckleitung DL-02', f0(W.q), 'm³/h', W.alarme.qn && W.alarme.qn.aktiv ? 'w' : '')}
        ${row('', 'Ein- / Ausschaltpegel', `${num(W.liEin, 2)} / ${num(W.liAus, 2)}`, 'm')}
        ${row('', 'Spitzenlast-Zuschaltung P-002', W.spitze ? 'freigegeben' : 'gesperrt', '')}
      </table><table style="margin-top:4px">
        <tr><td></td><td></td><td class="v hd">P-001</td><td class="v hd">P-002</td><td></td></tr>
        <tr><td class="tg">YS</td><td>Zustand</td><td class="v ${cl(W.p[0])}">${st(W.p[0])}</td><td class="v ${cl(W.p[1])}">${st(W.p[1])}</td><td></td></tr>
        <tr><td class="tg">HS</td><td>Wahlschalter</td>${W.p.map((x) => `<td class="v ${x.wahl !== 'auto' ? 'w' : ''}">${({ hand: 'HAND', '0': '0', auto: 'AUTO' })[x.wahl]}</td>`).join('')}<td></td></tr>
        <tr><td class="tg">SI</td><td>Frequenz</td><td class="v ${W.p[0].fuOrt ? 'w' : ''}">${num(W.p[0].f)}${W.p[0].fuOrt ? ' ORT' : ''}</td><td class="v">${W.p[1].run ? '50,0' : '0,0'}</td><td class="u">Hz</td></tr>
        <tr><td class="tg">II</td><td>Motorstrom</td><td class="v">${num(W.p[0].amp)}</td><td class="v">${num(W.p[1].amp)}</td><td class="u">A</td></tr>
        <tr><td class="tg">PT</td><td>Druck saug / druck</td><td class="v">${num(W.p[0].ps, 2)} / ${num(W.p[0].pd, 2)}</td><td class="v">${num(W.p[1].ps, 2)} / ${num(W.p[1].pd, 2)}</td><td class="u">bar</td></tr>
        <tr><td class="tg"></td><td>Betriebsstunden</td><td class="v">${f0(W.p[0].bh)}</td><td class="v">${f0(W.p[1].bh)}</td><td class="u">h</td></tr>
      </table>
      <div class="cnt">Seit Start: gefördert ${f0(W.vGef)} m³ · Energie ${f0(W.eKwh)} kWh${W.vUeb > 0 ? ` · <span class="a">Notüberlauf ${f0(W.vUeb)} m³</span>` : ''}</div>`;
      $('ostAl').innerHTML = alarmList(Object.values(W.alarme));
      drawTrend($('trendO'), W.hist, W.t, 6, [['li', '#ffd32a', (v) => v / 3 * 100], ['q', '#00d2d3', (v) => v / 1.2], ['qin', '#ff9f43', (v) => v / 1.2], ['f1', '#a29bfe', (v) => v * 2]]);
    } else {
      const B = sim.B;
      $('belVals').innerHTML = `<table>
        <tr><td></td><td></td><td class="v hd">Str. 1</td><td class="v hd">Str. 2</td><td></td></tr>
        <tr><td class="tg">QI 301/311</td><td>O₂ Istwert</td><td class="v ${B.s[0].meas < 1 ? 'a' : ''}">${num(Math.max(0, B.s[0].meas))}</td><td class="v ${B.s[1].meas < 1 ? 'a' : ''}">${num(Math.max(0, B.s[1].meas))}</td><td class="u">mg/L</td></tr>
        <tr><td class="tg">FI 301/311</td><td>Luftmenge</td><td class="v">${f0(B.s[0].L)}</td><td class="v">${f0(B.s[1].L)}</td><td class="u">Nm³/h</td></tr>
        <tr><td class="tg">FV 301/311</td><td>Klappe</td><td class="v ${B.s[0].fv.ort ? 'w' : ''}">${f0(B.s[0].klappe)}${B.s[0].fv.ort ? ' ORT' : ''}</td><td class="v ${B.s[1].fv.ort ? 'w' : ''}">${f0(B.s[1].klappe)}${B.s[1].fv.ort ? ' ORT' : ''}</td><td class="u">%</td></tr>
        <tr><td class="tg">G1.1/G1.2</td><td>Betriebsart</td><td class="v ${B.g[0].mode !== 'auto' ? 'w' : ''}">${MODI[B.g[0].mode]}</td><td class="v ${B.g[1].mode !== 'reserve' ? 'w' : ''}">${MODI[B.g[1].mode]}</td><td></td></tr>
        <tr><td class="tg">SC 201/211</td><td>Drehzahl FU</td><td class="v">${num(B.g[0].hz)}</td><td class="v">${num(B.g[1].hz)}</td><td class="u">Hz</td></tr>
      </table><table style="margin-top:4px">
        ${row('FIC 201', 'Luftmenge gesamt', f0(B.Ltot), 'Nm³/h')}
        ${row('PI 202', 'Druck Sammelleitung', f0(B.pD), 'mbar', B.pD > 650 ? 'a' : '')}
        ${row('JI 201', 'Leistung Gebläse gesamt', f0(B.pkw), 'kW')}
        ${row('PI 001', 'Luftdruck (Wetterstation)', f0(B.pAir), 'hPa')}
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
  // Diagnoseauswahl (nur in Pumpwerksmissionen): ui.diagnose = true, wenn die Mission eine Diagnose verlangt
  ui.diagnose = null;
  $('bMeld').onclick = () => {
    const k = ui.diagnose && KARTEN[sim.P.karte], sel = $('meldDiag');
    $('meldDiagW').style.display = k ? '' : 'none';
    if (k) sel.innerHTML = '<option value="">– Ursache auswählen –</option>' + Object.entries(k.ursachen).map(([v, t]) => `<option value="${v}">${t}</option>`).join('') + '<option value="unklar">Ursache nicht eindeutig feststellbar</option>';
    $('meld').style.display = 'flex'; $('meldText').focus();
  };
  $('meldCancel').onclick = () => { $('meld').style.display = 'none'; };
  $('meldOk').onclick = () => {
    const t = $('meldText').value.trim(), k = ui.diagnose && KARTEN[sim.P.karte], d = k ? $('meldDiag').value : '';
    if (k && !d) return ui.toast('Bitte die festgestellte Ursache auswählen.');
    if (d) { sim.diagnose = d; logA(`DIAGNOSE: ${d === 'unklar' ? 'Ursache nicht eindeutig feststellbar' : k.ursachen[d]}`, 'meldung'); }
    if (t) logA(`MELDUNG an Schichtleitung: ${t}`, 'meldung');
    if (t || d) ui.toast('Meldung protokolliert.');
    $('meldText').value = ''; $('meld').style.display = 'none';
  };

  // ---------------- zyklische Aktualisierung
  let t = 0;
  ui.update = (dt) => {
    t -= dt; if (t > 0) return; t = 0.5;
    const S = sim.S;
    $('simClock').textContent = `Tag ${Math.floor(S.t / 86400) + 1} · ${fmtZeit(S.t)} · ×${sim.speed}`;
    const nA = [...Object.values(S.alarme), ...Object.values(sim.B.alarme), ...Object.values(sim.P.alarme), ...Object.values(sim.O.alarme)].filter((a) => a.aktiv && a.klasse === 'A').length;
    $('bPLS').textContent = nA ? `Leitwarte (${nA} ⚠)` : 'Leitwarte';
    $('bPLS').classList.toggle('alarm', nA > 0);
    if (plsOpen) renderPLS();
  };
  ui.isBlocked = () => ui.overlays.some((id) => $(id).style.display === 'flex');
  return ui;
}
