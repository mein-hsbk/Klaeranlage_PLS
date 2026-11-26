// Faulung im Detail: Faulturm FT-1, Maschinenhaus (begehbar), Gasspeicher GS-1,
// Gasstrecke mit HA 611 / V6.1, BHKW G10.1 und Gasfackel F6.1 – mit Vor-Ort-Instrumenten,
// deren Anzeigen live aus dem Prozessmodell (anlage-sim.js) kommen.
import * as THREE from 'three';
import { P, bhkwQuittieren } from './faulung-modell.js';
import { sim, logA, logSys } from './anlage-sim.js';
import { f1, f0, noise, gauge, lcd, lamp, plate, senses, insts, instMeshes, makeInstFactory, pipeFactory } from './instrumente.js';

// ------------------------------------------------------------------ Aufbau
// h = Hilfsfunktionen aus index.html: { box, cyl, railing, circlePts, reg, M, std }
export function buildFaulung(scene, h, hooks = {}) {
  const { box, cyl, railing, circlePts, reg, M, std } = h;
  const toast = hooks.toast || (() => {});
  const anim = {};
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };

  const pipe = pipeFactory();
  const stuetze = (g, x, z, y) => noCol(box(g, 0.12, y, 0.12, M.steelDark, x, 0, z, 0, false));

  const makeInst = makeInstFactory(scene, M);

  // ================================================================ Faulturm FT-1 + Maschinenhaus
  const FT = { x: 28, z: 45 };
  {
    const g = new THREE.Group(), { x: cx, z: cz } = FT, R = 7.8, H = 26, sunk = 4;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8; const c2 = cv.getContext('2d');
    c2.fillStyle = '#c9cdd1'; c2.fillRect(0, 0, 64, 8); c2.fillStyle = '#a9aeb3'; for (let i = 0; i < 64; i += 8) c2.fillRect(i, 0, 3, 8);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 1); tex.colorSpace = THREE.SRGBColorSpace;
    const pts = []; let yTop = 0;
    for (let i = 0; i <= 60; i++) {
      const th = i / 60 * Math.PI, r = R * Math.pow(Math.sin(th), 0.85), y = -sunk + H / 2 * (1 - Math.cos(th));
      if (i > 30 && r < 2.2) { yTop = y; pts.push(new THREE.Vector2(2.2, y), new THREE.Vector2(0, y)); break; }
      pts.push(new THREE.Vector2(Math.max(r, 0.01), y));
    }
    const egg = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.45 }));
    egg.position.set(cx, 0, cz); egg.castShadow = egg.receiveShadow = true; g.add(egg);
    cyl(g, 6.3, 6.5, 0.8, M.concrete, cx, 0, cz, 48);
    cyl(g, 1.5, 1.5, 1.6, M.steel, cx, yTop, cz, 24);                        // Gasdom
    cyl(g, 4.6, 4.6, 0.15, M.grating, cx, yTop - 0.2, cz, 40);               // Bühne
    railing(circlePts(cx, cz, 4.5, 36), yTop - 0.05);
    const tx = cx + R + 3.2;                                                 // Treppenturm
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) box(g, 0.2, yTop, 0.2, M.steelDark, tx + dx, 0, cz + dz);
    for (let y = 3; y < yTop; y += 3) { box(g, 3.2, 0.12, 3.2, M.grating, tx, y, cz); railing([[tx - 1.6, cz - 1.6], [tx + 1.6, cz - 1.6], [tx + 1.6, cz + 1.6], [tx - 1.6, cz + 1.6], [tx - 1.6, cz - 1.6]], y + 0.12, 1.0); }
    box(g, (tx - 1.5) - (cx + 4.4), 0.12, 1.2, M.grating, (tx - 1.5 + cx + 4.4) / 2, yTop - 0.2, cz);
    // Faulgasleitung: Dom → Steigleitung am Treppenturm → Rohrbrücke (y = 3 m) → Gasspeicher
    const rx = tx + 1.8;
    pipe(g, [[cx + 1.4, yTop + 1.2, cz], [rx, yTop + 1.2, cz], [rx, 0.4, cz]], 0.22, M.gas);
    pipe(g, [[rx, 3, cz], [50.8, 3, cz], [50.8, 3, 58], [60.5, 3, 58], [60.5, 1.1, 58], [62.3, 1.1, 58], [62.3, 0.8, 58]], 0.2, M.gas);
    for (const [x, z] of [[46, 45], [50.8, 51.5], [55.5, 58]]) noCol(box(g, 0.25, 3, 0.25, M.steelDark, x, 0, z, 0, false));
    // Gaszähler FQ 608 an der Steigleitung
    noCol(box(g, 0.45, 0.42, 0.5, M.steelDark, rx, 0.95, cz));
    noCol(box(g, 0.08, 1.25, 0.08, M.steelDark, rx + 0.5, 0, cz));
    makeInst('fq608', { name: 'Gaszähler Faulgas', tag: 'FQ 608', pos: [rx + 0.56, 1.45, cz], rotY: Math.PI / 2, size: 0.42, aspect: 0.75,
      info: 'Gaszähler in der Faulgasleitung vom Faulturm zum Gasspeicher mit Zählwerk (Normkubikmeter) und örtlicher Durchflussanzeige.',
      draw: (ctx, W, Hc) => {
        lcd(ctx, W, Hc, 'FQ 608  Faulgas', [], { lcdH: 0.28, bg: '#111' });
        const z = String(Math.floor(sim.S.fq608)).padStart(8, '0');
        ctx.font = `bold ${W * 0.09}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i < 7 ? '#f5f6fa' : '#ff7675'; ctx.fillRect(W * 0.1 + i * W * 0.1, Hc * 0.2, W * 0.085, Hc * 0.22); ctx.fillStyle = '#111'; ctx.fillText(z[i], W * 0.115 + i * W * 0.1, Hc * 0.31); }
        ctx.fillStyle = '#2d3436'; ctx.font = `${W * 0.05}px Arial`; ctx.fillText('Nm³', W * 0.42, Hc * 0.5);
        ctx.fillStyle = '#0d2310'; ctx.fillRect(W * 0.1, Hc * 0.6, W * 0.8, Hc * 0.22);
        ctx.fillStyle = '#7CFC9a'; ctx.font = `${W * 0.075}px monospace`; ctx.fillText(`Q = ${f1(sim.S.qProd + noise(0.6, 1))} Nm³/h`, W * 0.14, Hc * 0.71);
      } });
    // Schlammumwälzleitung mit TI 1001 (Südseite)
    pipe(g, [[cx - 2, 1.0, cz + 6.4], [cx - 2, 1.0, cz + 7.8], [cx + 2, 1.0, cz + 7.8], [cx + 2, 1.0, cz + 6.4]], 0.14, std(0x6e5843, { r: 0.6, m: 0.2 }));
    noCol(box(g, 0.1, 0.25, 0.1, M.steelDark, cx, 1.0, cz + 7.9, 0, false));
    makeInst('ti1001', { name: 'Thermometer Faulschlamm (Umwälzleitung)', tag: 'TI 1001', pos: [cx, 1.35, cz + 7.97], size: 0.34, round: true,
      info: 'Bimetall-Zeigerthermometer in der Schlammumwälzleitung des Faulturms FT-1.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 60, ticks: 6, unit: '°C', tag: 'TI 1001', val: sim.S.T_ft }) });

    // ---------- Maschinenhaus Faulung (begehbar, Tür Ost) ----------
    const x0 = 22.5, x1 = 33.5, z0 = 55.5, z1 = 61.5, hh = 4.5, t = 0.3, dz0 = 57.6, dz1 = 59.6;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.concreteDark || M.concrete);
    fl.rotation.x = -Math.PI / 2; fl.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); fl.receiveShadow = true; g.add(fl);
    box(g, x1 - x0, hh, t, M.brick, (x0 + x1) / 2, 0, z0);
    box(g, x1 - x0, hh, t, M.brick, (x0 + x1) / 2, 0, z1);
    box(g, t, hh, z1 - z0, M.brick, x0, 0, (z0 + z1) / 2);
    box(g, t, hh, dz0 - z0, M.brick, x1, 0, (z0 + dz0) / 2);
    box(g, t, hh, z1 - dz1, M.brick, x1, 0, (dz1 + z1) / 2);
    box(g, t, hh - 2.5, dz1 - dz0, M.brick, x1, 2.5, (dz0 + dz1) / 2);
    box(g, x1 - x0 + 0.3, 0.45, z1 - z0 + 0.3, M.roof, (x0 + x1) / 2, hh, (z0 + z1) / 2);
    const leaf = box(g, 1.0, 2.4, 0.06, M.door, x1 + 0.5, 0, dz0 + 0.15, 0, false); leaf.userData.noCol = true;
    const l1 = new THREE.PointLight(0xfff2d6, 16, 12, 1.6); l1.position.set(30, 3.8, 58.5); g.add(l1);
    const l2 = new THREE.PointLight(0xfff2d6, 12, 12, 1.6); l2.position.set(25, 3.8, 58.5); g.add(l2);
    // Schlammwärmetauscher W10.1 an der Südwand
    for (let i = 0; i < 3; i++) { const m = cyl(g, 0.22, 0.22, 7, M.steel, 27.1, 0, 60.6, 20); m.rotation.z = Math.PI / 2; m.position.y = 0.8 + i * 0.55; }
    box(g, 7.4, 0.5, 0.5, M.steelDark, 27.1, 0, 60.6);
    // Heizwasserpumpe P11.1 (Pumpe Ost, Motor West, Achse x)
    box(g, 1.7, 0.25, 0.7, M.concrete, 30.1, 0, 57.2);
    { const m = cyl(g, 0.26, 0.26, 0.55, M.green, 29.6, 0, 57.2, 20); m.rotation.z = Math.PI / 2; m.position.y = 0.75; }
    { const m = cyl(g, 0.24, 0.24, 0.3, std(0x2e86de, { r: 0.5, m: 0.3 }), 30.6, 0, 57.2, 20); m.rotation.z = Math.PI / 2; m.position.y = 0.75; }
    anim.coupling = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.05), std(0xe67e22)); anim.coupling.position.set(30.12, 0.75, 57.2); g.add(anim.coupling);
    pipe(g, [[33.4, 2.6, 57.2], [31.3, 2.6, 57.2], [31.3, 0.75, 57.2], [30.76, 0.75, 57.2]], 0.1, std(0xc0392b, { r: 0.5, m: 0.1 }));
    pipe(g, [[30.6, 0.99, 57.2], [30.6, 1.9, 57.2], [30.6, 1.9, 60.38]], 0.1, std(0xc0392b, { r: 0.5, m: 0.1 }));
    pipe(g, [[23.6, 1.35, 60.6], [23.2, 1.35, 60.6], [23.2, 2.2, 60.6], [23.2, 2.2, 56.2], [33.4, 2.2, 56.2]], 0.1, std(0x2e86de, { r: 0.5, m: 0.1 }));
    makeInst('p111', { name: 'Heizwasser-Umwälzpumpe Faulturm', tag: 'P11.1', pos: [29.6, 1.08, 57.2], size: 0.32, aspect: 0.35, res: 256,
      info: 'Umwälzpumpe im Heizwasserkreis vom BHKW bzw. Heizkessel zum Schlammwärmetauscher W10.1. Ohne Umwälzung wird der Faulturm nicht beheizt.',
      draw: plate('P11.1\nHeizwasserpumpe'),
      detail: (ctx, W, Hc) => senses(ctx, W, Hc, 'Heizwasserpumpe P11.1', sim.S.p11 ? ['Motor brummt gleichmäßig,', 'Kupplung dreht sich,', 'Pumpengehäuse warm.'] : ['Motor steht, kein Geräusch.', 'Kupplung steht still.', 'Pumpengehäuse lauwarm.'], sim.S.p11) });
    makeInst('ti1101', { name: 'Thermometer Heizwasser-Vorlauf', tag: 'TI 1101', pos: [30.6, 1.45, 57.34], size: 0.24, round: true,
      info: 'Zeigerthermometer im Heizwasser-Vorlauf zum Schlammwärmetauscher W10.1.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 120, ticks: 6, unit: '°C', tag: 'TI 1101 VL', val: sim.S.tVL }) });
    makeInst('ti1102', { name: 'Thermometer Heizwasser-Rücklauf', tag: 'TI 1102', pos: [26.0, 1.92, 56.34], size: 0.24, round: true,
      info: 'Zeigerthermometer im Heizwasser-Rücklauf vom Schlammwärmetauscher W10.1.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 120, ticks: 6, unit: '°C', tag: 'TI 1102 RL', val: sim.S.tRL }) });
    // Vor-Ort-Schaltkasten P11.1 (Nordwand innen)
    box(g, 0.7, 0.9, 0.2, M.sheet, 32.0, 1.0, 55.75, 0, false);
    makeInst('sk111', { name: 'Vor-Ort-Schaltkasten Heizwasserpumpe', tag: '=+SK P11.1', pos: [32.0, 1.45, 55.86], size: 0.62, aspect: 1.25,
      info: 'Schaltkasten mit Motorschutzschalter Q11.1, Hand-0-Auto-Wahlschalter und Meldeleuchten der Heizwasserpumpe P11.1.',
      draw: (ctx, W, Hc) => {
        const S = sim.S;
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(0, 0, W, Hc);
        ctx.fillStyle = '#2d3436'; ctx.font = `bold ${W * 0.07}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('P11.1 Heizwasserpumpe', W / 2, Hc * 0.03);
        lamp(ctx, W * 0.28, Hc * 0.17, W * 0.055, '#00b894', S.p11, 'Betrieb', W);
        lamp(ctx, W * 0.72, Hc * 0.17, W * 0.055, '#d63031', S.p11Trip, 'Störung', W);
        ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(W * 0.5, Hc * 0.44, W * 0.09, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(W * 0.5, Hc * 0.44); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ecf0f1'; ctx.fillRect(-W * 0.015, -W * 0.09, W * 0.03, W * 0.1); ctx.restore();
        ctx.fillStyle = '#2d3436'; ctx.font = `${W * 0.05}px Arial`; ctx.fillText('H', W * 0.33, Hc * 0.34); ctx.fillText('0', W * 0.5, Hc * 0.3); ctx.fillText('A', W * 0.67, Hc * 0.34);
        ctx.font = `bold ${W * 0.05}px Arial`; ctx.fillText('Q11.1  Motorschutz  4,0 A', W / 2, Hc * 0.6);
        ctx.fillStyle = '#7f8c8d'; ctx.fillRect(W * 0.32, Hc * 0.67, W * 0.36, Hc * 0.26);
        ctx.save(); ctx.translate(W * 0.5, Hc * 0.8); ctx.rotate(S.p11 ? 0 : (S.p11Trip ? -Math.PI / 4 : -Math.PI / 2));
        ctx.fillStyle = '#111'; ctx.fillRect(-W * 0.03, -Hc * 0.1, W * 0.06, Hc * 0.2); ctx.restore();
        ctx.fillStyle = '#111'; ctx.font = `${W * 0.045}px Arial`; ctx.fillText('0', W * 0.36, Hc * 0.69); ctx.fillText('I', W * 0.5, Hc * 0.66);
        if (S.p11Trip) { ctx.fillStyle = '#e67e22'; ctx.fillRect(W * 0.6, Hc * 0.84, W * 0.06, W * 0.04); ctx.fillStyle = '#2d3436'; ctx.textAlign = 'left'; ctx.font = `${W * 0.038}px Arial`; ctx.fillText('Trip', W * 0.69, Hc * 0.83); }
      },
      actions: () => [{ label: sim.S.p11 ? 'Motorschutz ausschalten (0)' : 'Motorschutz einschalten (I)', fn: () => {
        const S = sim.S;
        if (S.p11) { S.p11 = false; logA('Q11.1 Motorschutz P11.1 ausgeschaltet'); }
        else { S.p11 = true; S.p11Trip = false; logA('Q11.1 Motorschutz P11.1 eingeschaltet – Pumpe läuft'); }
      } }] });
    // Gasanalysator QI 614 (Westwand innen)
    box(g, 0.2, 0.8, 0.6, M.sheet, 22.75, 1.1, 57.6, 0, false);
    makeInst('qi614', { name: 'Gasanalysator Faulgas', tag: 'QI 614', pos: [22.86, 1.5, 57.6], rotY: Math.PI / 2, size: 0.55, aspect: 1.1,
      info: 'Kontinuierliche Faulgasanalyse (Infrarot für CH4/CO2, elektrochemisch für H2S und O2). Der Methangehalt geht auch in die Leitwarte.',
      draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'QI 614  Gasanalyse', [`CH4  ${f1(sim.S.ch4 + noise(0.15, 4))} Vol-%`, `CO2  ${f1(100 - sim.S.ch4 - 1.6 + noise(0.15, 5))} Vol-%`, 'O2    0,2 Vol-%', `H2S  ${f0(85 + (62 - sim.S.ch4) * 9 + noise(3, 6))} ppm`], { lcdH: 0.7, fs: 0.07, fg: '#81ecec', bg: '#0b1d2a' }) });

    reg('ft', g, { name: 'Faulturm FT-1', kks: 'P10.1 / P10.2 · W10.1 · FI 608',
      text: 'Anaerobe Stabilisierung des Dickschlamms bei 37 °C. Der Faulturminhalt wird über die Umwälzpumpen und den Schlammwärmetauscher umgewälzt und beheizt; das entstehende Faulgas wird gespeichert und im BHKW verwertet.',
      rows: [['Volumen', '2.200 m³'], ['Betrieb', 'mesophil, 37 °C'], ['Umwälzung', 'P10.1/P10.2 KSB Sewabloc F 100-254 (Betrieb/Reserve)'], ['Beheizung', 'W10.1 Rohr-in-Rohr-WT, Heizwasser BHKW, Umwälzpumpe P11.1'], ['Messung', 'FI 608 Faulgas, TI 1001 Faulschlamm'], ['Maschinenhaus', 'begehbar: P11.1, TI 1101/1102, QI 614']], note: true, walk: 'faulturm' });
  }

  // ================================================================ Gasspeicher GS-1 + Gasstrecke zum BHKW
  const GS = { x: 70, z: 58 };
  {
    const g = new THREE.Group(), { x: cx, z: cz } = GS;
    cyl(g, 8.4, 8.4, 0.7, M.concrete, cx, 0, cz, 48);
    const d = new THREE.Mesh(new THREE.SphereGeometry(8, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), M.membrane);
    d.scale.y = 0.75; d.position.set(cx, 0.7, cz); d.castShadow = d.receiveShadow = true; g.add(d);
    box(g, 1.6, 1.2, 1.0, M.green, cx - 9.5, 0, cz + 3);                     // Stützluftgebläse
    pipe(g, [[cx - 9.5, 1.0, cz + 2.5], [cx - 7.2, 1.0, cz + 1.6]], 0.1, M.steel);
    for (let a = 0; a < 16; a++) { const m = box(g, 0.3, 0.2, 0.3, M.steelDark, cx + Math.cos(a / 16 * 6.283) * 8.3, 0.7, cz + Math.sin(a / 16 * 6.283) * 8.3, 0, false); m.userData.noCol = true; }
    // Füllstandsanzeige LI 609 (Tafel an der Westseite)
    for (const dz of [-0.45, 0.45]) noCol(box(g, 0.1, 2.6, 0.1, M.steelDark, 61.0, 0, 54 + dz, 0, false));
    makeInst('li609', { name: 'Füllstandsanzeige Gasspeicher', tag: 'LI 609', pos: [60.93, 1.55, 54], rotY: -Math.PI / 2, size: 0.9, aspect: 1.3,
      info: 'Mechanische Füllstandsanzeige des Doppelmembranspeichers: Die Innenmembran zieht über einen Seilzug den Zeiger. Die Außenmembran wird vom Stützluftgebläse in Form gehalten – von außen sieht man den Füllstand deshalb nicht.',
      draw: (ctx, W, Hc) => {
        ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0, 0, W, Hc);
        ctx.fillStyle = '#2d3436'; ctx.font = `bold ${W * 0.08}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('LI 609', W / 2, Hc * 0.03); ctx.font = `${W * 0.055}px Arial`; ctx.fillText('Gasspeicher GS-1', W / 2, Hc * 0.1);
        const y0 = Hc * 0.92, y1 = Hc * 0.2, x = W * 0.45;
        ctx.fillStyle = '#fff'; ctx.fillRect(x - W * 0.08, y1, W * 0.16, y0 - y1); ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2; ctx.strokeRect(x - W * 0.08, y1, W * 0.16, y0 - y1);
        ctx.fillStyle = 'rgba(214,48,49,0.25)'; ctx.fillRect(x - W * 0.08, y1, W * 0.16, (y0 - y1) * 0.1);
        ctx.font = `${W * 0.05}px Arial`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (let p = 0; p <= 100; p += 10) { const y = y0 - (y0 - y1) * p / 100; ctx.fillStyle = '#2d3436'; ctx.fillRect(x - W * 0.08, y - 1, p % 50 ? W * 0.05 : W * 0.08, 2); ctx.fillText(String(p), x - W * 0.1, y); }
        ctx.textAlign = 'left'; ctx.fillText('%', x + W * 0.1, y1);
        const y = y0 - (y0 - y1) * sim.S.V / P.V_GS;
        ctx.fillStyle = '#d63031'; ctx.beginPath(); ctx.moveTo(x + W * 0.09, y); ctx.lineTo(x + W * 0.2, y - W * 0.04); ctx.lineTo(x + W * 0.2, y + W * 0.04); ctx.fill();
        ctx.fillRect(x - W * 0.08, y - 2, W * 0.17, 4);
      } });
    // Gasleitung GS-1 → HA 611 → V6.1 → BHKW (Fließrichtung Nord, -z)
    pipe(g, [[cx, 0.65, 50.0], [cx, 1.1, 49.4], [cx, 1.1, 37.7], [cx - 0.5, 0.9, 37.25]], 0.14, M.gas);
    for (const z of [43, 40]) stuetze(g, cx, z, 1.0);
    noCol(box(g, 0.05, 0.3, 0.05, M.steelDark, cx - 0.32, 1.1, 48.0, 0, false));
    makeInst('pi610', { name: 'Manometer Gasleitung nach Speicher', tag: 'PI 610', pos: [cx - 0.32, 1.48, 48.0], rotY: -Math.PI / 2, size: 0.26, round: true,
      info: 'Manometer in der Gasleitung zwischen Gasspeicher GS-1 und Kugelhahn HA 611.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 60, ticks: 6, unit: 'mbar', tag: 'PI 610', val: sim.S.p610 + noise(0.3, 2) }) });
    // Kugelhahn HA 611
    { const m = cyl(g, 0.2, 0.2, 0.32, M.steelDark, cx, 0.94, 46.0, 20); m.rotation.x = Math.PI / 2; m.position.y = 1.1; m.userData.noCol = true; }
    anim.valve = new THREE.Group(); anim.valve.position.set(cx, 1.36, 46.0); g.add(anim.valve);
    { const hb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.62), M.gas); hb.position.set(0, 0, 0.27); hb.castShadow = true; anim.valve.add(hb);
      const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), M.steelDark); hs.position.y = -0.08; anim.valve.add(hs); noCol(anim.valve); }
    makeInst('ha611', { name: 'Kugelhahn Gaszuleitung Verdichter', tag: 'HA 611', pos: [cx + 0.45, 1.2, 46.0], rotY: Math.PI / 2, size: 0.22, aspect: 0.5, res: 256,
      info: 'Handbetätigter Kugelhahn (Viertelumdrehung) in der Gasleitung vom Gasspeicher zum Gasverdichter V6.1. Der gelbe Hebel zeigt die Stellung der Kugel an.',
      draw: plate('HA 611\nKugelhahn Gas', '#f1c40f'),
      detail: (ctx, W, Hc) => {
        ctx.fillStyle = '#c8d0d4'; ctx.fillRect(0, 0, W, Hc);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(0, Hc * 0.42, W, Hc * 0.16); ctx.fillStyle = '#e1b40e'; ctx.fillRect(0, Hc * 0.42, W, Hc * 0.04);
        ctx.fillStyle = '#4b545c'; ctx.fillRect(W * 0.38, Hc * 0.36, W * 0.24, Hc * 0.28);
        ctx.save(); ctx.translate(W * 0.5, Hc * 0.5); if (!sim.S.ha611) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#f1c40f'; ctx.strokeStyle = '#7d6608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(-W * 0.04, -Hc * 0.04, W * 0.4, Hc * 0.08); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(0, 0, W * 0.035, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#2d3436'; ctx.font = `${W * 0.04}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('Draufsicht', W * 0.04, Hc * 0.08); ctx.fillText('Fließrichtung →  zum Verdichter V6.1', W * 0.04, Hc * 0.9);
      },
      actions: () => [{ label: sim.S.ha611 ? 'Hebel quer stellen' : 'Hebel längs stellen', fn: () => { sim.S.ha611 = !sim.S.ha611; logA(`HA 611 betätigt: Hebel ${sim.S.ha611 ? 'längs zur Leitung' : 'quer zur Leitung'}`); } }] });
    // Gasverdichter V6.1 auf Grundrahmen
    box(g, 1.4, 0.15, 2.6, M.steelDark, cx, 0, 36.8);
    box(g, 0.9, 0.7, 0.9, M.sheet, cx - 0.5, 0.15, 36.8);
    { const m = cyl(g, 0.32, 0.32, 0.9, M.green, cx + 0.3, 0.3, 36.3, 20); m.rotation.x = Math.PI / 2; m.position.y = 0.6; }
    anim.fan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), std(0x15181b)); anim.fan.position.set(cx + 0.3, 0.6, 35.83); g.add(anim.fan);
    pipe(g, [[cx - 0.5, 0.9, 36.35], [cx - 0.5, 1.1, 35.2], [cx - 0.5, 1.1, 31.6], [60.2, 1.1, 31.6], [60.2, 1.9, 30.05]], 0.12, M.gas);
    for (const [x, z] of [[cx - 0.5, 33.5], [64.5, 31.6]]) stuetze(g, x, z, 1.0);
    noCol(box(g, 0.05, 0.3, 0.05, M.steelDark, cx - 0.18, 1.1, 34.0, 0, false));
    makeInst('pi613', { name: 'Manometer Gasdruck nach Verdichter', tag: 'PI 613', pos: [cx - 0.18, 1.48, 34.0], rotY: Math.PI / 2, size: 0.26, round: true,
      info: 'Manometer auf der Druckseite des Gasverdichters V6.1 (Gaszuführung BHKW). Daneben liegt der Druckschalter PSL 613 der BHKW-Gasregelstrecke.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 150, ticks: 6, unit: 'mbar', tag: 'PI 613', val: sim.S.p613 + noise(sim.S.verd ? 1.2 : 0.1, 3) }) });
    makeInst('v61', { name: 'Gasverdichter (Seitenkanalverdichter)', tag: 'V6.1', pos: [cx - 0.04, 0.55, 36.95], rotY: Math.PI / 2, size: 0.4, aspect: 0.4, res: 256,
      info: 'Seitenkanalverdichter: erhöht den Gasdruck vom Speicherniveau auf den Vordruck der BHKW-Gasregelstrecke. Er läuft, wenn das BHKW startet oder in Betrieb ist.',
      draw: plate('V6.1\nGasverdichter'),
      detail: (ctx, W, Hc) => senses(ctx, W, Hc, 'Gasverdichter V6.1', sim.S.verd ? ['Motor läuft, gleichmäßiges Pfeifen', 'des Seitenkanalverdichters,', 'Lüfterrad dreht sich.'] : ['Motor steht. Kein Geräusch,', 'Lüfterrad steht still.'], sim.S.verd) });
    // Fackelleitung GS-1 → F6.1
    pipe(g, [[78.5, 0.7, cz], [79.2, 1.1, cz], [96, 1.1, cz], [96, 1.1, 67.8], [97.3, 0.6, 69.4]], 0.14, M.gas);
    for (const x of [84, 90]) stuetze(g, x, cz, 1.0); stuetze(g, 96, 63, 1.0);

    reg('gs', g, { name: 'Gasspeicher GS-1', kks: 'GS-1 · LI 609 · PI 610 · HA 611 · V6.1',
      text: 'Zwischenspeicherung des Faulgases zum Ausgleich zwischen Gasproduktion und Gasverbrauch im BHKW. Die Außenmembran wird vom Stützluftgebläse in Form gehalten. Vom Speicher führt die Gasleitung über den Kugelhahn HA 611 zum Gasverdichter V6.1 und weiter zum BHKW; eine zweite Leitung versorgt die Fackel.',
      rows: [['Bauart', 'Doppelmembranspeicher, ≈ 600 m³ *'], ['Zubehör', 'Stützluftgebläse, Füllstandsanzeige LI 609'], ['Vor Ort', 'PI 610, HA 611, V6.1, PI 613']], note: true, walk: 'gasspeicher' });
  }

  // ================================================================ BHKW G10.1
  {
    const g = new THREE.Group();
    box(g, 12, 3.6, 3.6, M.green, 58, 0, 28);
    box(g, 3.2, 1.2, 2.4, M.steelDark, 54, 3.6, 28);
    for (const x of [53.2, 54.8]) cyl(g, 0.55, 0.55, 0.08, M.rubber, x, 4.8, 28, 20);
    cyl(g, 0.3, 0.3, 9.5, M.steel, 63, 0, 26.8, 16);
    box(g, 2, 2, 1.4, M.sheetBlue, 66, 0, 28);
    for (const x of [54, 58, 62]) box(g, 1.2, 2.2, 0.08, M.door, x, 0, 29.85, 0, false);
    box(g, 0.9, 1.2, 0.2, std(0x8a9399, { r: 0.6, m: 0.3 }), 56, 0.9, 29.9, 0, false);
    makeInst('bhkw', { name: 'BHKW-Bedienfeld', tag: 'BHKW G10.1', pos: [56, 1.5, 30.01], size: 0.8, aspect: 1.15,
      info: 'Örtliches Bedienfeld des Blockheizkraftwerks (Gas-Otto-Motor, 125 kW el.). Zeigt Betriebszustand, Leistung und die genaue Störmeldung. Die Leitwarte erhält nur eine Sammelstörung.',
      draw: (ctx, W, Hc) => {
        const S = sim.S, st = { aus: 'BEREIT (AUS)', start: 'START …', betrieb: 'BETRIEB', stoerung: 'STÖRUNG' }[S.bhkw];
        const lines = [`Status: ${st}`, `P el     ${f0(S.pel)} kW`, `n        ${S.bhkw === 'betrieb' ? '1500' : '   0'} 1/min`, `p Gas    ${f0(Math.max(0, S.p613))} mbar`, `CH4      ${f1(S.ch4)} %`, `Bh       ${f0(S.bhkwH)} h`];
        if (S.bhkw === 'stoerung') lines.push({ t: `! ${S.bhkwStoer}`, c: '#ff7675' });
        lcd(ctx, W, Hc, 'BHKW G10.1  Faulgas', lines, { lcdH: 0.62, fs: 0.06 });
        lamp(ctx, W * 0.2, Hc * 0.86, W * 0.045, '#00b894', S.bhkw === 'betrieb', 'Betrieb', W);
        lamp(ctx, W * 0.5, Hc * 0.86, W * 0.045, '#d63031', S.bhkw === 'stoerung' && (performance.now() % 1000 < 600), 'Störung', W);
        ctx.fillStyle = '#0984e3'; ctx.fillRect(W * 0.68, Hc * 0.8, W * 0.24, Hc * 0.1); ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.045}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Quittieren', W * 0.8, Hc * 0.85);
      },
      actions: () => [{ label: 'Störung quittieren', fn: () => toast(bhkwQuittieren(sim.S, logSys)) }] });
    reg('bhkw', g, { name: 'Blockheizkraftwerk G10.1', kks: 'BHKW G10.1 · V6.1',
      text: 'Verwertung des Faulgases in einem Gasmotor mit Generator. Die Abwärme beheizt über das Heizwasser den Faulturm und die Gebäude, der Strom deckt einen Teil des Eigenbedarfs der Kläranlage.',
      rows: [['Aggregat', 'Gas-Otto-Motor mit Generator, 125 kW el. (Container)'], ['Gasverdichter', 'V6.1 Seitenkanalverdichter'], ['Wärme', 'Heizwasser ⇄ W10.1 (Faulturm)'], ['Vor Ort', 'Bedienfeld mit Störmeldungen (Südseite)']], walk: 'bhkw' });
  }

  // ================================================================ Gasfackel F6.1
  {
    const g = new THREE.Group();
    box(g, 5, 0.3, 5, M.concrete, 98, 0, 70);
    cyl(g, 0.9, 0.9, 8, M.steel, 98, 0.3, 70, 24); cyl(g, 0.95, 0.95, 1.2, M.steelDark, 98, 7.3, 70, 24);
    railing([[95.5, 67.5], [100.5, 67.5], [100.5, 72.5], [95.5, 72.5], [95.5, 67.5]], 0.3, 1.8);
    anim.glow = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0x331100 }));
    anim.glow.position.set(98, 8.52, 70); g.add(anim.glow);
    box(g, 0.3, 1.0, 0.7, std(0x8a9399, { r: 0.6, m: 0.3 }), 94.0, 0.8, 69.5, 0, false);
    noCol(box(g, 0.08, 0.8, 0.08, M.steelDark, 94.0, 0, 69.5, 0, false));
    makeInst('f61', { name: 'Schaltkasten Gasfackel', tag: 'F6.1', pos: [93.84, 1.3, 69.5], rotY: -Math.PI / 2, size: 0.6, aspect: 0.95,
      info: 'Hochtemperaturfackel mit geschlossener Brennkammer: die Flamme ist von außen nicht sichtbar. Der Betrieb ist am Schaltkasten (Brennkammertemperatur) und an der Wärmeabstrahlung am Kopf erkennbar.',
      draw: (ctx, W, Hc) => {
        lcd(ctx, W, Hc, 'Fackel F6.1', [`TI Brennk. ${f0(sim.S.tFackel)} °C`, 'Freigabe:  AUTO'], { lcdH: 0.34, fs: 0.07 });
        lamp(ctx, W * 0.25, Hc * 0.68, W * 0.06, '#f39c12', sim.S.fackel, 'Betrieb', W);
        lamp(ctx, W * 0.6, Hc * 0.68, W * 0.06, '#d63031', false, 'Störung', W);
      } });
    reg('fackel', g, { name: 'Gasfackel F6.1', kks: 'F6.1',
      text: 'Sicherheitseinrichtung: verbrennt Überschussgas, wenn der Gasspeicher voll ist oder das BHKW nicht abnehmen kann. Geschlossene Brennkammer – die Flamme ist von außen nicht sichtbar.',
      rows: [['Bauart', 'Hochtemperaturfackel (geschlossen)'], ['Betrieb', 'nur bei Gasüberschuss, Zündung ab 90 % Speicherfüllstand'], ['Vor Ort', 'Schaltkasten mit Brennkammertemperatur']], walk: 'fackel' });
  }

  // ================================================================ Animationen, Texturen
  const smoke = [];
  const puffGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const puff = (x, y, z, warm) => {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: warm ? 0xffd8a8 : 0xdfe6e9, transparent: true, opacity: warm ? 0.18 : 0.35, depthWrite: false }));
    m.position.set(x, y, z); m.userData = { age: 0, warm, noCol: true }; scene.add(m); smoke.push(m);
  };
  function update(dt) {
    const S = sim.S;
    anim.valve.rotation.y += ((S.ha611 ? 0 : Math.PI / 2) - anim.valve.rotation.y) * Math.min(1, dt * 6);
    if (S.verd) anim.fan.rotation.z += dt * 40;
    if (S.p11) anim.coupling.rotation.x += dt * 30;
    const glow = Math.max(0, (S.tFackel - 100) / 850);
    anim.glow.material.color.setRGB(0.2 + glow * 0.8, 0.07 + glow * 0.35, 0.02);
    if (Math.random() < dt * (S.bhkw === 'betrieb' ? 6 : 0)) puff(63, 9.6, 26.8, false);
    if (Math.random() < dt * glow * 8) puff(98 + (Math.random() - 0.5), 8.6, 70 + (Math.random() - 0.5), true);
    for (let i = smoke.length - 1; i >= 0; i--) {
      const m = smoke[i]; m.userData.age += dt; m.position.y += dt * (m.userData.warm ? 1.6 : 1.1); m.position.x += dt * 0.5;
      m.scale.setScalar(1 + m.userData.age * 1.2); m.material.opacity = Math.max(0, (m.userData.warm ? 0.18 : 0.35) * (1 - m.userData.age / 4));
      if (m.userData.age > 4) { scene.remove(m); m.material.dispose(); smoke.splice(i, 1); }
    }
  }
  return { update };
}
