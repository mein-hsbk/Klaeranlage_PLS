// Messprotokoll Niveaumessung LI-001 (PW Talstraße) – nicht-modales Feld wie die Leitwarte:
// bleibt beim Gehen offen, zwei Protokolle (vor / nach der Instandsetzung) ablegen, wieder öffnen, bearbeiten.
import { sim, logA } from './anlage-sim.js';
import { protokollAblegen, PROT_ART, LI } from './pumpwerk-modell.js';
import { fmtZeit } from './faulung-modell.js';

const CSS = `
#mprot{position:fixed;left:8px;top:calc(env(safe-area-inset-top) + 58px);width:min(470px,calc(100% - 16px));max-height:calc(100% - 170px);overflow:auto;box-sizing:border-box;
  background:#f4f1e8;color:#1e272e;border:1px solid #2d4a7a;border-radius:10px;padding:10px 12px;display:none;z-index:3;font-size:13px;box-shadow:0 6px 24px #0008}
body.mission #mprot{top:calc(env(safe-area-inset-top) + 92px);max-height:calc(100% - 200px)}
#mprot h3{margin:0;font-size:15px;flex:1}
#mprot .kopf{display:flex;align-items:center;gap:8px;margin-bottom:6px}
#mprot .x{background:#2d3436;color:#fff;border:0;border-radius:6px;width:30px;height:28px;font-size:16px;cursor:pointer}
#mprot .tabs{display:flex;gap:6px;margin-bottom:6px}
#mprot .tabs button{flex:1;border:1px solid #2d4a7a;background:#fff;border-radius:6px;padding:6px 4px;font-size:12.5px;cursor:pointer;color:#1e272e}
#mprot .tabs button.on{background:#0f3460;color:#fff;font-weight:bold}
#mprot .tabs small{display:block;font-weight:normal;font-size:11px;opacity:.8}
#mprot .stamm{font-size:11.5px;color:#4b5563;border-bottom:2px solid #1e272e;padding-bottom:5px;margin-bottom:6px}
#mprot fieldset{border:1px solid #b9b3a3;border-radius:7px;margin:0 0 8px;padding:6px 8px 8px;background:#fffdf7}
#mprot legend{font-weight:bold;font-size:12.5px;padding:0 4px}
#mprot input,#mprot textarea{font:inherit;font-size:15px;padding:4px 6px;border:1px solid #8d8778;border-radius:5px;background:#fff;color:#111;box-sizing:border-box;width:100%}
#mprot input{text-align:right;font-family:monospace}
#mprot .zeile{display:grid;grid-template-columns:1fr 96px 30px;align-items:center;gap:6px;margin:3px 0}
#mprot .op{font-size:11.5px;color:#4b5563}
#mprot table{width:100%;border-collapse:collapse}
#mprot th{font-size:11px;text-align:left;color:#4b5563;font-weight:normal;padding:2px 3px;border-bottom:1px solid #b9b3a3}
#mprot td{padding:3px 3px;border-bottom:1px solid #e2ddd0;vertical-align:middle}
#mprot td.ist{width:86px}
#mprot td.soll{font-family:monospace;font-size:12.5px;white-space:nowrap;color:#374151}
#mprot .bw{display:flex;gap:3px}
#mprot .bw button{border:1px solid #8d8778;background:#fff;border-radius:5px;padding:4px 5px;font-size:11.5px;cursor:pointer;white-space:nowrap;color:#1e272e}
#mprot .bw button.io.on{background:#00b894;border-color:#00b894;color:#fff;font-weight:bold}
#mprot .bw button.nio.on{background:#d63031;border-color:#d63031;color:#fff;font-weight:bold}
#mprot svg{width:100%;height:auto;display:block;background:#fff;border:1px solid #b9b3a3;border-radius:5px;touch-action:none}
#mprot .fuss{display:flex;align-items:center;gap:8px;margin-top:4px}
#mprot .stat{flex:1;font-size:11.5px;color:#4b5563}
#mprot .ablegen{background:#0f3460;color:#fff;border:0;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;font-weight:bold}
`;

const FELDER = ['abstich', 'pegel', 'iSoll', 'iPb', 'iTvE', 'iTvA', 'anz', 'bFeld', 'bTv', 'bSt', 'bSchw', 'bem'];
const num = (x) => { const t = String(x ?? '').trim().replace(',', '.'); return t === '' ? NaN : parseFloat(t); };

// Diagramm-Geometrie: Pegel 0…3 m (x), Strom 3…14 mA (y)
const G = { x0: 46, x1: 392, y0: 210, y1: 12, pMax: 3, iMin: 3, iMax: 14 };
const px = (p) => G.x0 + (p / G.pMax) * (G.x1 - G.x0);
const py = (i) => G.y0 - ((i - G.iMin) / (G.iMax - G.iMin)) * (G.y0 - G.y1);

function kennlinieSVG() {
  let s = `<svg id="mpSvg" viewBox="0 0 400 248" xmlns="http://www.w3.org/2000/svg" font-family="Arial">`;
  for (let k = 0; k <= 30; k++) { const x = px(k / 10), maj = k % 5 === 0; s += `<line x1="${x}" y1="${G.y1}" x2="${x}" y2="${G.y0}" stroke="${maj ? '#9aa3ad' : '#dfe3e8'}" stroke-width="${maj ? 0.9 : 0.5}"/>`; if (maj) s += `<text x="${x}" y="${G.y0 + 13}" font-size="10" text-anchor="middle" fill="#333">${(k / 10).toFixed(1).replace('.', ',')}</text>`; }
  for (let k = 0; k <= 55; k++) { const i = G.iMin + k * 0.2, y = py(i), maj = k % 5 === 0; s += `<line x1="${G.x0}" y1="${y}" x2="${G.x1}" y2="${y}" stroke="${maj ? '#9aa3ad' : '#dfe3e8'}" stroke-width="${maj ? 0.9 : 0.5}"/>`; if (maj) s += `<text x="${G.x0 - 5}" y="${y + 3.5}" font-size="10" text-anchor="end" fill="#333">${Math.round(i)}</text>`; }
  // Kennlinie: 0,10 m ≙ 4 mA … 5,10 m ≙ 20 mA (Ausschnitt bis 3 m)
  const pEnd = G.pMax, iEnd = 4 + 16 * (pEnd - LI.EINBAU) / LI.MB;
  s += `<line x1="${px(0)}" y1="${py(4)}" x2="${px(LI.EINBAU)}" y2="${py(4)}" stroke="#0f3460" stroke-width="1.4" stroke-dasharray="3 2"/>`;
  s += `<line x1="${px(LI.EINBAU)}" y1="${py(4)}" x2="${px(pEnd)}" y2="${py(iEnd)}" stroke="#0f3460" stroke-width="2.2"/>`;
  s += `<rect x="${G.x0}" y="${G.y1}" width="${G.x1 - G.x0}" height="${G.y0 - G.y1}" fill="none" stroke="#333" stroke-width="1"/>`;
  s += `<text x="${(G.x0 + G.x1) / 2}" y="${G.y0 + 27}" font-size="10.5" text-anchor="middle" fill="#111">Pegel über Sumpfsohle in m</text>`;
  s += `<text x="12" y="${(G.y0 + G.y1) / 2}" font-size="10.5" text-anchor="middle" fill="#111" transform="rotate(-90 12 ${(G.y0 + G.y1) / 2})">Ausgangsstrom in mA</text>`;
  s += `<text x="${px(0.18)}" y="${py(13.3)}" font-size="9.5" fill="#0f3460">Kennlinie LI-001: 0,10 m ≙ 4 mA · 5,10 m ≙ 20 mA</text>`;
  s += `<g id="mpCross" visibility="hidden"><line id="mpCx" y1="${G.y1}" y2="${G.y0}" stroke="#e17055" stroke-width="0.8" stroke-dasharray="4 3"/><line id="mpCy" x1="${G.x0}" x2="${G.x1}" stroke="#e17055" stroke-width="0.8" stroke-dasharray="4 3"/></g>`;
  s += `<g id="mpPunkte"></g></svg>`;
  return s;
}

const bewHTML = (k) => `<div class="bw" data-k="${k}"><button class="io" data-v="io">i. O.</button><button class="nio" data-v="nio">n. i. O.</button></div>`;

export function initMessprotokoll() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'mprot';
  el.innerHTML = `<div class="kopf"><h3>📋 Messprotokoll · Niveaumessung LI-001</h3><button class="x" id="mpX" aria-label="Schließen">×</button></div>
  <div class="tabs"><button data-a="vor">Vor der Instandsetzung<small id="mpSvor"></small></button><button data-a="nach">Nach der Instandsetzung<small id="mpSnach"></small></button></div>
  <div class="stamm">Abwasserpumpwerk Talstraße · Hydrostatische Pegelsonde 0–5 mWS ≙ 4–20 mA (Zweileiter) · Einbauhöhe 0,10 m über Sohle · Bezug: OK Lukenrahmen = ${String(LI.BEZUG).replace('.', ',')} m über Sumpfsohle</div>
  <fieldset><legend>1 · Vergleichsmessung mit dem Lichtlot</legend>
    <div class="zeile"><span>Abstich ab OK Lukenrahmen</span><input data-f="abstich" inputmode="decimal"><span>m</span></div>
    <div class="zeile"><span>Pegel über Sohle <span class="op">= ${String(LI.BEZUG).replace('.', ',')} m − Abstich</span></span><input data-f="pegel" inputmode="decimal"><span>m</span></div>
  </fieldset>
  <fieldset><legend>2 · Kennlinie des Messumformers</legend>
    ${kennlinieSVG()}
    <div class="zeile" style="margin-top:6px"><span>Sollstrom beim Pegel aus Feld 1 <span class="op">(aus der Kennlinie abgelesen)</span></span><input data-f="iSoll" inputmode="decimal"><span>mA</span></div>
    <div class="op">Eingetragene Werte erscheinen im Diagramm: ● Messpunkt (Pegel | Strom Prüfbuchse), ✕ abgelesener Sollstrom.</div>
  </fieldset>
  <fieldset><legend>3 · Messkette: Ist / Soll / Bewertung</legend>
    <table><tr><th>Messstelle</th><th>Ist</th><th>Soll</th><th>Bewertung</th></tr>
    <tr><td>Sonde + Feldleitung<br><span class="op">Prüfbuchse Klemmenkasten</span></td><td class="ist"><input data-f="iPb" inputmode="decimal"></td><td class="soll"><span data-e="iSoll"></span> mA<br><span class="op">Kennlinie</span></td><td>${bewHTML('bFeld')}</td></tr>
    <tr><td>Trennverstärker Eingang<br><span class="op">Feldseite</span></td><td class="ist"><input data-f="iTvE" inputmode="decimal"></td><td class="soll"><span data-e="iPb"></span> mA<br><span class="op">= Prüfbuchse</span></td><td></td></tr>
    <tr><td>Trennverstärker Ausgang<br><span class="op">zur Steuerung</span></td><td class="ist"><input data-f="iTvA" inputmode="decimal"></td><td class="soll"><span data-e="iTvE"></span> mA<br><span class="op">= Eingang</span></td><td>${bewHTML('bTv')}</td></tr>
    <tr><td>Anzeige LI-001<br><span class="op">Steuerung / Leitwarte, m</span></td><td class="ist"><input data-f="anz" inputmode="decimal" placeholder="----"></td><td class="soll"><span data-e="pegel"></span> m<br><span class="op">= Pegel</span></td><td>${bewHTML('bSt')}</td></tr>
    <tr><td>Schwimmerschalter S1–S3</td><td class="ist op">–</td><td class="soll op">frei, schalten</td><td>${bewHTML('bSchw')}</td></tr>
    </table>
  </fieldset>
  <fieldset><legend>4 · Befund / Bemerkung</legend><textarea data-f="bem" rows="2" placeholder="z. B. festgestellte Ursache, durchgeführte Maßnahme"></textarea></fieldset>
  <div class="fuss"><span class="stat" id="mpStat"></span><button class="ablegen" id="mpAblegen">Protokoll ablegen</button></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);

  let art = 'vor', lm = null, entwurf = { vor: {}, nach: {} }, geaendert = { vor: false, nach: false }, offen = false;
  const sync = () => { // neue Mission → neue Protokollblätter
    if (sim.P.lm === lm) return; lm = sim.P.lm;
    entwurf = { vor: {}, nach: {} }; geaendert = { vor: false, nach: false };
    for (const a of ['vor', 'nach']) if (lm.prot[a]) entwurf[a] = { ...lm.prot[a].e };
  };
  function zeige() {
    const e = entwurf[art];
    for (const inp of el.querySelectorAll('[data-f]')) if (document.activeElement !== inp) inp.value = e[inp.dataset.f] ?? '';
    for (const bw of el.querySelectorAll('.bw')) for (const b of bw.querySelectorAll('button')) b.classList.toggle('on', e[bw.dataset.k] === b.dataset.v);
    for (const b of el.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.a === art);
    status(); echo(); punkte();
  }
  function echo() { const e = entwurf[art]; for (const s of el.querySelectorAll('[data-e]')) s.textContent = e[s.dataset.e] || '…'; }
  function status() {
    for (const a of ['vor', 'nach']) { const p = lm.prot[a]; $(`#mpS${a}`).textContent = p ? `abgelegt ${fmtZeit(p.ts)}${geaendert[a] ? ' · geändert' : ''}` : (geaendert[a] ? 'Entwurf' : 'leer'); }
    const p = lm.prot[art];
    $('#mpStat').textContent = p ? (geaendert[art] ? 'Änderungen noch nicht abgelegt.' : `Abgelegt um ${fmtZeit(p.ts)} – zum Ändern einfach bearbeiten und erneut ablegen.`) : 'Noch nicht abgelegt. Werte lassen sich beim Messen nach und nach eintragen.';
    $('#mpAblegen').textContent = p ? 'Änderungen ablegen' : 'Protokoll ablegen';
  }
  function punkte() {
    const e = entwurf[art], pg = num(e.pegel), ip = num(e.iPb), is = num(e.iSoll); let s = '';
    const inB = (p, i) => p >= 0 && p <= G.pMax && i >= G.iMin && i <= G.iMax;
    if (inB(pg, is)) { const x = px(pg), y = py(is); s += `<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}" stroke="#0984e3" stroke-width="2"/>`; }
    if (inB(pg, ip)) s += `<circle cx="${px(pg)}" cy="${py(ip)}" r="4.5" fill="#e17055" stroke="#fff" stroke-width="1.2"/>`;
    $('#mpPunkte').innerHTML = s;
  }
  el.addEventListener('input', (ev) => { const f = ev.target.dataset.f; if (!f) return; entwurf[art][f] = ev.target.value; geaendert[art] = true; status(); echo(); punkte(); });
  for (const bw of el.querySelectorAll('.bw')) bw.addEventListener('click', (ev) => { const v = ev.target.dataset.v; if (!v) return; const e = entwurf[art]; e[bw.dataset.k] = e[bw.dataset.k] === v ? '' : v; geaendert[art] = true; zeige(); });
  for (const b of el.querySelectorAll('.tabs button')) b.onclick = () => { art = b.dataset.a; zeige(); };
  $('#mpAblegen').onclick = () => {
    const e = {}; for (const f of FELDER) e[f] = String(entwurf[art][f] ?? '').trim();
    protokollAblegen(sim.P, art, e, logA); lm.prot[art].ts = sim.S.t; geaendert[art] = false; zeige();
  };
  // Fadenkreuz als Ablesehilfe (ohne Zahlenwerte)
  const svg = $('#mpSvg'), cross = $('#mpCross');
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 400, y = (ev.clientY - r.top) / r.height * 248;
    if (x < G.x0 || x > G.x1 || y < G.y1 || y > G.y0) { cross.setAttribute('visibility', 'hidden'); return; }
    cross.setAttribute('visibility', 'visible'); $('#mpCx').setAttribute('x1', x); $('#mpCx').setAttribute('x2', x); $('#mpCy').setAttribute('y1', y); $('#mpCy').setAttribute('y2', y);
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', () => cross.setAttribute('visibility', 'hidden'));
  // Eingaben im Protokoll dürfen nicht die Begehung steuern
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.target.blur?.(); } ev.stopPropagation(); });

  const api = {
    open() { sync(); offen = true; el.style.display = 'block'; zeige(); document.getElementById('bMp')?.classList.add('on'); if (!api.geloggt) { logA('Messprotokoll LI-001 geöffnet', 'blick'); api.geloggt = true; } },
    close() { offen = false; el.style.display = 'none'; document.getElementById('bMp')?.classList.remove('on'); },
    toggle() { offen ? api.close() : api.open(); },
    get offen() { return offen; },
  };
  $('#mpX').onclick = api.close;
  setInterval(() => { if (offen && !document.body.classList.contains('mis-pegel')) api.close(); if (offen && sim.P.lm !== lm) { sync(); zeige(); } }, 1000);
  addEventListener('keydown', (ev) => { if (ev.code === 'KeyM' && !/TEXTAREA|INPUT|SELECT/.test(ev.target.tagName) && document.body.classList.contains('mis-pegel')) api.toggle(); });
  return api;
}
