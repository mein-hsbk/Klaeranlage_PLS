// Werkstatt (Stufe 2): Einschubeinheit der KSB Sewatec E 100-317 als Explosionsdarstellung.
// Zerlegen per Regler, Bauteile anklicken, Befund aufnehmen, messen, reinigen, Neuteile einbauen,
// Zusammenbauen und wieder in das Pumpwerk einbauen. Eigener Renderer, läuft nur bei geöffneter Ansicht.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TEILE, teilAktion, befundText, einbauen } from './pumpwerk-modell.js';
import { sim, logA } from './anlage-sim.js';

const $ = (id) => document.getElementById(id);
const AX = 1.35;                                                    // Wellenachse über dem Boden (Werkbank)
// Grundlage (zusammengebaut), Explosionsposition und Zerlegestufe je Bauteil
const LAGE = {
  kupplung: { x: 0.95, ex: [3.05, 0], s: 0.0 }, motor: { x: 1.62, ex: [4.0, 0], s: 0.0 },
  gehaeuse: { x: -0.6, ex: [-2.05, 0], s: 0.08 }, mutter: { x: -0.735, ex: [-1.5, 0], s: 0.2 },
  laufrad: { x: -0.6, ex: [-1.1, 0], s: 0.25 }, verschleiss: { x: -0.74, ex: [-2.85, 0], s: 0.3 },
  gdicht: { x: -0.45, ex: [-0.62, 0], s: 0.3 }, deckel: { x: -0.41, ex: [-0.22, 0], s: 0.38 },
  glrd1: { x: -0.3, ex: [0.22, 0], s: 0.45 }, vorlage: { x: -0.19, ex: [0.68, 0], s: 0.5 },
  glrd2: { x: -0.07, ex: [1.1, 0], s: 0.55 }, welle: { x: 0.08, ex: [0.95, -0.42, 0.42], s: 0.65 },
  lager: { x: 0, ex: [1.45, -0.37, -0.4], s: 0.7 }, lagertr: { x: 0.26, ex: [1.95, 0], s: 0.7 },
};
const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const frei = (id, f) => f >= LAGE[id].s + 0.15;

export function initWerkstatt(ui) {
  // ------------------------------------------------------------------ Oberfläche
  const st = document.createElement('style');
  st.textContent = `
  #wks{position:fixed;inset:0;z-index:70;display:none;background:#0b1424;color:#dfe6e9;font-family:Arial,sans-serif}
  #wksMain{display:flex;height:100%}
  #wksView{flex:1;position:relative;min-width:0}#wksView canvas{display:block;width:100%;height:100%}
  #wksTop{position:absolute;left:10px;right:10px;top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none}
  #wksTop>*{pointer-events:auto}#wksTop h2{margin:0;font-size:17px;color:#ffeaa7;flex:1;text-shadow:0 1px 3px #000}
  #wksBot{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(11,20,36,.85);padding:8px 10px;border-radius:8px}
  #wksBot input[type=range]{flex:1;min-width:140px}
  #wksSide{width:360px;max-width:42vw;overflow:auto;background:#13203a;border-left:1px solid #2d4a7a;padding:12px;box-sizing:border-box}
  #wksSide h3{margin:4px 0 6px;font-size:15px;color:#ffeaa7}
  .wkL{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}
  .wkL button{display:flex;gap:6px;align-items:center;text-align:left;background:#0f2a4a;border:1px solid #2d4a7a;color:#dfe6e9;border-radius:6px;padding:5px 8px;font-size:13px;cursor:pointer}
  .wkL button.sel{border-color:#ffeaa7;background:#1e3b63}.wkL button.zu{opacity:.5}.wkL .ic{margin-left:auto;font-size:12px;color:#81ecec;white-space:nowrap}
  #wkTeil .nr{color:#7f8fa6;font-size:12px}#wkTeil p{font-size:13px;line-height:1.4;margin:6px 0}
  #wkTeil .bef{background:#0d2310;border-radius:6px;padding:8px;font-size:13px;line-height:1.4;color:#c8f7c5;margin:6px 0}
  #wkTeil .btn{margin:3px 4px 3px 0}
  #wksKost{font-size:13px;background:rgba(11,20,36,.85);padding:5px 9px;border-radius:6px}
  @media (max-width:820px){#wksTop .lg{display:none}#wksBot{gap:6px;padding:6px}#wksBot .btn{font-size:12px;padding:5px 8px}#wksMain{flex-direction:column}#wksSide{width:auto;max-width:none;height:46%;border-left:0;border-top:1px solid #2d4a7a}#wksView{height:54%;flex:none}}`;
  document.head.appendChild(st);
  const ov = document.createElement('div'); ov.id = 'wks';
  ov.innerHTML = `<div id="wksMain"><div id="wksView">
      <div id="wksTop"><h2>Werkstatt · Einschubeinheit P-001<span class="lg"> (KSB Sewatec E 100-317)</span></h2><span id="wksKost"></span><button class="btn" id="wksZu" title="Pumpe bleibt in der Werkstatt">Zurück ins Pumpwerk</button></div>
      <div id="wksBot"><span>Zusammengebaut</span><input type="range" id="wksF" min="0" max="100" value="0"><span>Zerlegt</span>
      <button class="btn" id="wksAll">Ganz zerlegen</button><button class="btn" id="wksGes">Gesamtansicht</button><button class="btn on" id="wksEin">Zusammenbauen und einbauen</button></div>
    </div><div id="wksSide"><h3>Bauteile</h3><div class="wkL" id="wkList"></div><div id="wkTeil"></div></div></div>`;
  document.body.appendChild(ov);
  ui.overlays.push('wks');

  // ------------------------------------------------------------------ 3D-Szene
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
  $('wksView').prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b2533);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60); camera.position.set(0.6, 3.1, 6.2);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0.6, 1.3, 0); controls.enableDamping = true; controls.maxPolarAngle = 1.5; controls.minDistance = 0.6; controls.maxDistance = 12;
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a3226, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 6, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 3, bottom: -3 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7); fill.position.set(-4, 3, -3); scene.add(fill);
  const std = (c, r = 0.55, m = 0.3, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), std(0x55595e, 0.9, 0)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 1.3), std(0x8a6d4b, 0.8, 0)); bank.position.set(0.6, 0.86, 0); bank.receiveShadow = true; scene.add(bank);
  for (const x of [-3, 4.2]) for (const z of [-0.55, 0.55]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.08), std(0x444a50)); l.position.set(x, 0.43, z); scene.add(l); }

  const M = { ksb: () => std(0x24508f, 0.45, 0.3), guss: () => std(0x5a6068, 0.6, 0.5), stahl: () => std(0xb7bcc1, 0.3, 0.85), sic: () => std(0x8d9196, 0.25, 0.4),
    gummi: () => std(0x1d1d1d, 0.9, 0), motor: () => std(0x6f7f8c, 0.5, 0.4), elast: () => std(0xc0392b, 0.7, 0), dicht: () => std(0x6b7d5c, 0.9, 0) };
  // Hilfen: Zylinder und Ring entlang der x-Achse
  const cx = (g, r, len, mat, x, seg = 32, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const ring = (g, ro, ri, len, mat, x, seg = 40) => {
    const V = THREE.Vector2, m = new THREE.Mesh(new THREE.LatheGeometry([new V(ri, -len / 2), new V(ro, -len / 2), new V(ro, len / 2), new V(ri, len / 2), new V(ri, -len / 2)], seg), mat);
    m.rotation.z = -Math.PI / 2; m.position.x = x; m.castShadow = true; g.add(m); return m;
  };

  const teile = {}, schaden = {};
  const neu = (id, g) => { teile[id] = { g, mats: [] }; g.traverse((o) => { if (o.isMesh) { o.userData.teil = id; teile[id].mats.push(o.material); } }); scene.add(g); };
  // Spiralgehäuse
  { const g = new THREE.Group(), m = M.ksb();
    cx(g, 0.38, 0.26, m, 0, 48);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.11, 18, 48), m); t.rotation.y = Math.PI / 2; t.castShadow = true; g.add(t);
    cx(g, 0.1, 0.36, m, -0.3); cx(g, 0.17, 0.04, m, -0.47);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.42, 24), m); d.position.set(0, 0.55, -0.2); d.castShadow = true; g.add(d);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 24), m); fl.position.set(0, 0.77, -0.2); g.add(fl);
    const fu = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.5), m); fu.position.set(0, -0.32, 0); g.add(fu);
    neu('gehaeuse', g); }
  // Verschleißwand mit Spaltring
  { const g = new THREE.Group(), m = M.guss(); ring(g, 0.24, 0.11, 0.035, m, 0); ring(g, 0.125, 0.105, 0.05, M.stahl(), 0.02); neu('verschleiss', g); schaden.verschleiss = m; }
  // Laufrad (Zweikanalrad) mit Faserzopf/Fremdkörper
  { const g = new THREE.Group(), m = std(0x4f5a63, 0.55, 0.45);
    cx(g, 0.27, 0.025, m, 0.07, 48); ring(g, 0.27, 0.1, 0.02, m, -0.07); cx(g, 0.06, 0.2, m, 0.03, 24);
    const bl = [];
    for (const ph of [0, Math.PI]) for (let k = 0; k < 7; k++) {
      const a = ph + k * 0.42, r = 0.1 + k * 0.024, b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.07), m);
      b.position.set(0, Math.cos(a) * r, Math.sin(a) * r); b.rotation.x = -a; b.castShadow = true; g.add(b); bl.push(b);
    }
    const z = new THREE.Group(), zm = std(0xcfc7b4, 1, 0);
    for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.11 + k * 0.012, 0.025, 8, 30), zm); t.rotation.set(Math.PI / 2 * 0 + k * 0.3, Math.PI / 2 + k * 0.12, k); t.position.x = -0.06 + k * 0.012; z.add(t); }
    g.add(z);
    const stein = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055), std(0x7d756a, 0.95, 0)); stein.position.set(-0.01, 0.17, 0.08); g.add(stein);
    neu('laufrad', g); schaden.laufrad = { zopf: z, stein, kante: bl[6], mat: m }; }
  { const g = new THREE.Group(); cx(g, 0.045, 0.05, M.stahl(), 0, 6); neu('mutter', g); }
  // Gehäusedichtung (ganz bzw. eingerissen)
  { const g = new THREE.Group(), m = M.dicht();
    const voll = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 60), m); voll.rotation.y = Math.PI / 2; voll.scale.z = 0.15; g.add(voll);
    const riss = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 60, Math.PI * 2 - 0.25), m); riss.rotation.y = Math.PI / 2; riss.scale.z = 0.15; g.add(riss);
    neu('gdicht', g); schaden.gdicht = { voll, riss }; }
  { const g = new THREE.Group(), m = M.ksb(); ring(g, 0.4, 0.06, 0.05, m, 0); ring(g, 0.2, 0.06, 0.12, m, 0.08); neu('deckel', g); }
  // Gleitringdichtungen: rotierender und stehender Gleitring, Feder, O-Ring
  const glrd = (id, s) => {
    const g = new THREE.Group(), f = M.sic();
    ring(g, 0.09 * s, 0.055, 0.03, f, -0.02); ring(g, 0.1 * s, 0.055, 0.03, f, 0.015); ring(g, 0.075 * s, 0.05, 0.05, M.stahl(), -0.07);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.006, 6, 24), M.stahl()); sp.rotation.y = Math.PI / 2; sp.position.x = -0.06 - k * 0.012; g.add(sp); }
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.009, 8, 32), M.gummi()); o.rotation.y = Math.PI / 2; o.position.x = 0.04; g.add(o);
    neu(id, g); schaden[id] = { f, o };
  };
  glrd('glrd1', 1); glrd('glrd2', 0.85);
  // Dichtungsgehäuse mit Vorlagebehälter
  { const g = new THREE.Group(), m = M.ksb(); ring(g, 0.2, 0.06, 0.2, m, 0);
    const vb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 20), std(0xdfe6e9, 0.2, 0.1, { transparent: true, opacity: 0.45 })); vb.position.set(0, 0.42, 0.12); g.add(vb);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.15, 20), std(0x74b9ff, 0.3, 0)); fl.position.set(0, 0.37, 0.12); g.add(fl);
    neu('vorlage', g); schaden.vorlage = fl.material; }
  { const g = new THREE.Group(); cx(g, 0.035, 1.62, M.stahl(), 0, 24); const k = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.02), M.guss()); k.position.set(0.82, 0.035, 0); g.add(k); neu('welle', g); }
  // Wälzlager (Satz)
  { const g = new THREE.Group(), r1 = std(0xb7bcc1, 0.3, 0.85), kug = std(0xd0d4d8, 0.2, 0.9);
    for (const x of [0, 0.52]) { ring(g, 0.085, 0.066, 0.04, r1, x); ring(g, 0.054, 0.035, 0.04, r1, x);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), kug); b.position.set(x, Math.cos(a) * 0.06, Math.sin(a) * 0.06); g.add(b); } }
    neu('lager', g); schaden.lager = [r1, kug]; }
  { const g = new THREE.Group(), m = M.ksb(); ring(g, 0.15, 0.09, 0.62, m, 0, 36); const fu = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.42), m); fu.position.set(0.05, -0.33, 0); g.add(fu);
    for (const x of [-0.2, 0.2]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.36), m); r.position.set(x, -0.08, 0); g.add(r); }
    neu('lagertr', g); }
  { const g = new THREE.Group(), e = M.elast(); cx(g, 0.1, 0.09, M.guss(), -0.1); cx(g, 0.1, 0.09, M.guss(), 0.1); cx(g, 0.105, 0.09, e, 0, 6); neu('kupplung', g); schaden.kupplung = { e, mesh: g.children[2] }; }
  { const g = new THREE.Group(), m = M.motor(); cx(g, 0.27, 1.05, m, 0); for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.025, 0.6), m); r.position.y = -0.24 + k * 0.06; g.add(r); }
    cx(g, 0.25, 0.22, m, 0.62); const kk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.26), m); kk.position.set(-0.05, 0.36, 0); g.add(kk);
    const fu = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.62), m); fu.position.set(0, -0.37, 0); g.add(fu); cx(g, 0.035, 0.2, M.stahl(), -0.6, 16);
    neu('motor', g); }

  // ------------------------------------------------------------------ Zustand, Darstellung
  let f = 0, fZiel = 0, sel = null, offen = false, nachEinbau = null;
  const W = () => sim.P.ws, U = () => sim.P.wsUrsache;
  function schadensbild() {
    if (!W()) return;
    const t = W().teile, u = U(), set = (mat, c) => mat.color.setHex(c);
    const L = schaden.laufrad; L.zopf.visible = u === 'zopf' && !t.laufrad.gereinigt && !t.laufrad.ersetzt; L.stein.visible = u === 'fremd' && !t.laufrad.gereinigt && !t.laufrad.ersetzt;
    L.kante.scale.x = u === 'fremd' && !t.laufrad.ersetzt ? 0.35 : 1; set(L.mat, t.laufrad.ersetzt ? 0x6c7a86 : 0x4f5a63);
    set(schaden.verschleiss, t.verschleiss.ersetzt ? 0x7f8c8d : u === 'spalt' ? 0x7a5236 : 0x5a6068);
    schaden.gdicht.voll.visible = !(u === 'gehaeuse' && !t.gdicht.ersetzt); schaden.gdicht.riss.visible = !schaden.gdicht.voll.visible;
    set(schaden.gdicht.voll.material, t.gdicht.ersetzt ? 0x2f3640 : 0x6b7d5c);
    const g1 = ['glrd', 'trocken'].includes(u) && !t.glrd1.ersetzt; set(schaden.glrd1.f, g1 ? (u === 'trocken' ? 0x5b3a29 : 0x4a4f55) : t.glrd1.ersetzt ? 0xc8ccd0 : 0x8d9196);
    schaden.glrd1.o.scale.setScalar(u === 'oring' && !t.glrd1.ersetzt ? 1.25 : 1); set(schaden.glrd1.o.material, u === 'oring' && !t.glrd1.ersetzt ? 0x5a2d1a : 0x1d1d1d);
    set(schaden.glrd2.f, u === 'aussen' && !t.glrd2.ersetzt ? 0x4a4f55 : t.glrd2.ersetzt ? 0xc8ccd0 : 0x8d9196);
    set(schaden.vorlage, ['glrd', 'oring', 'trocken'].includes(u) && !t.glrd1.ersetzt ? 0x7d6a4f : 0x74b9ff);
    const lg = u === 'lager' && !t.lager.ersetzt; set(schaden.lager[0], lg ? 0x6e5a45 : 0xb7bcc1); set(schaden.lager[1], lg ? 0x4b3f33 : 0xd0d4d8);
    const ku = u === 'kupplung' && !t.kupplung.ersetzt; set(schaden.kupplung.e, ku ? 0x3a3a3a : 0xc0392b); schaden.kupplung.mesh.scale.set(1, ku ? 0.82 : 1, ku ? 0.82 : 1);
  }
  function lage() {
    for (const id in teile) {
      const L = LAGE[id], p = sstep((f - L.s) / 0.2), g = teile[id].g;
      g.position.set(L.x + (L.ex[0] - L.x) * p, AX + L.ex[1] * p, (L.ex[2] || 0) * p);
      for (const m of teile[id].mats) m.emissive && m.emissive.setHex(id === sel ? 0x3a3000 : 0x000000);
    }
  }

  // ------------------------------------------------------------------ Seitenleiste
  const icon = (id) => { const t = W().teile[id]; return [t.befund ? 'Befund' : '', t.gemessen ? 'gemessen' : '', t.gereinigt ? 'gereinigt' : '', t.ersetzt ? 'NEU' : ''].filter(Boolean).join(' · '); };
  function liste() {
    $('wkList').innerHTML = TEILE.map((T) => `<button data-t="${T.id}" class="${T.id === sel ? 'sel' : ''} ${frei(T.id, f) ? '' : 'zu'}"><span>${T.name}</span><span class="ic">${icon(T.id)}</span></button>`).join('');
    $('wksKost').textContent = `Ersatzteile: ${W().kosten.toLocaleString('de-DE')} €`;
  }
  function teilPanel() {
    const box = $('wkTeil'); if (!sel) { box.innerHTML = '<p>Bauteil in der Liste oder im Bild anklicken. Mit dem Regler unten wird die Einschubeinheit Schritt für Schritt zerlegt.</p>'; return; }
    const T = TEILE.find((t) => t.id === sel), t = W().teile[sel], ok = frei(sel, f);
    let h = `<h3>${T.name}</h3><div class="nr">Teil-Nr. ${T.nr}${T.preis ? ` · Ersatzteil ${T.preis} €` : ''}</div>`;
    if (ui.erklaer) h += `<p>${T.fkt}</p>`;
    if (!ok) h += '<p><i>Noch verbaut – erst weiter zerlegen.</i></p>';
    else {
      if (t.befund) h += `<div class="bef">${befundText(sim.P, sel)}</div>`;
      if (t.gemessen && T.messen) h += `<div class="bef">${T.messen}: ${t.messText}</div>`;
      h += `<div><button class="btn act" data-a="befund">Befund aufnehmen</button>`;
      if (T.messen) h += `<button class="btn act" data-a="messen">${T.messen}</button>`;
      if (T.reinigen) h += `<button class="btn act" data-a="reinigen">Reinigen</button>`;
      if (T.ersetzbar && !t.ersetzt) h += `<button class="btn act" data-a="ersetzen">${T.ersetzbar}</button>`;
      h += '</div>';
    }
    box.innerHTML = h;
  }
  const refresh = () => { liste(); teilPanel(); schadensbild(); };
  let fokus = null;                                                  // Kamerafahrt zum gewählten Bauteil bzw. zur Gesamtansicht
  const waehle = (id) => { sel = id; refresh(); const p = new THREE.Vector3(); new THREE.Box3().setFromObject(teile[id].g).getCenter(p); fokus = { t: p, d: id === 'motor' || id === 'gehaeuse' ? 2.4 : id === 'welle' || id === 'lagertr' ? 1.9 : 1.2, dir: new THREE.Vector3(-0.75, 0.5, 1).normalize() }; };
  const gesamt = () => { fokus = { t: new THREE.Vector3(0.6 + 0.3 * f, 1.3, 0), d: 6.4 * (1 + 0.55 * f) }; };
  $('wkList').onclick = (e) => { const b = e.target.closest('button'); if (b) waehle(b.dataset.t); };
  $('wkTeil').onclick = (e) => {
    const a = e.target.dataset.a; if (!a || !sel) return;
    if (a === 'ersetzen' && !W().teile[sel].befund && !confirm('Ohne Befund ersetzen?')) return;
    const r = teilAktion(sim.P, sel, a, logA);
    if (a === 'messen') W().teile[sel].messText = r;
    ui.toast(r); refresh();
  };
  $('wksF').oninput = () => { fZiel = +$('wksF').value / 100; };
  $('wksAll').onclick = () => { fZiel = 1; $('wksF').value = 100; };
  $('wksZu').onclick = () => schliessen();
  $('wksGes').onclick = () => gesamt();
  renderer.domElement.addEventListener('wheel', () => { fokus = null; });
  $('wksEin').onclick = () => {
    const t = W().teile, fehlt = [];
    if (!t.gdicht.ersetzt && f > 0.4) fehlt.push('Die alte Gehäusedichtung wird wiederverwendet.');
    if (!confirm(`Einschubeinheit zusammenbauen und in das Pumpwerk einbauen?${fehlt.length ? `\n\n${fehlt.join('\n')}` : ''}`)) return;
    fZiel = 0; $('wksF').value = 0; nachEinbau = () => { einbauen(sim.P, logA); schliessen(); ui.toast('P-001 wieder eingebaut. Jetzt fachgerecht wieder in Betrieb nehmen.'); };
  };
  // Klick im Bild
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; fokus = null; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(Object.values(teile).map((t) => t.g), true).find((x) => x.object.visible);
    if (h) waehle(h.object.userData.teil);
  });

  // ------------------------------------------------------------------ Öffnen, Schleife
  let last = 0, fAlt = -1;
  function loop(t) {
    if (!offen) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - last) / 1000 || 0); last = t;
    const v = $('wksView'), w = v.clientWidth, hh = v.clientHeight;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(hh * renderer.getPixelRatio())) { renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
    if (Math.abs(fZiel - f) > 1e-3) {
      const f0 = f; f += Math.sign(fZiel - f) * Math.min(Math.abs(fZiel - f), dt * 0.35);
      const off = camera.position.clone().sub(controls.target);                // beim Zerlegen mitzoomen
      camera.position.copy(controls.target).add(off.multiplyScalar((1 + 0.55 * f) / (1 + 0.55 * f0)));
      controls.target.x += (f - f0) * 0.3; camera.position.x += (f - f0) * 0.3;
    }
    else if (nachEinbau) { const n = nachEinbau; nachEinbau = null; n(); return; }
    if (Math.abs(f - fAlt) > 0.004) { const war = TEILE.map((T) => frei(T.id, fAlt)).join(); fAlt = f; if (TEILE.map((T) => frei(T.id, f)).join() !== war) { liste(); teilPanel(); } }
    if (fokus) {
      const k = Math.min(1, dt * 4), off = fokus.dir ? fokus.dir.clone() : camera.position.clone().sub(controls.target).normalize();
      controls.target.lerp(fokus.t, k); const zielPos = fokus.t.clone().add(off.multiplyScalar(fokus.d));
      camera.position.lerp(zielPos, k); if (camera.position.distanceTo(zielPos) < 0.01) fokus = null;
    }
    lage(); controls.update(); renderer.render(scene, camera);
  }
  function oeffnen() {
    if (!sim.P.ws || !sim.P.p[0].ausgebaut) { ui.toast('Die Einschubeinheit ist nicht ausgebaut.'); return; }
    offen = true; ov.style.display = 'flex'; sel = null; fAlt = -1; refresh(); lage();
    logA('Werkstatt geöffnet (Einschubeinheit P-001)', 'blick');
    last = performance.now(); requestAnimationFrame(loop);
  }
  function schliessen() { offen = false; ov.style.display = 'none'; }
  return { open: oeffnen, close: schliessen, get offen() { return offen; } };
}
