// Abwasserpumpwerk Industriegebiet Ost (APW-02, begehbar) – östlich des Schwierbachs im Gewerbegebiet.
// P-001 neu (2026, Frequenzumrichter), P-002 alt (1994, Festdrehzahl) – trocken aufgestellt neben dem
// Pumpensumpf. Manometer saug-/druckseitig, Druckmessumformer, MID FI-101, Pumpensteuerung, FU-Bedienteil,
// Anlagendokumentation (Inbetriebnahmeprotokoll nach Pumpentausch und Relining der Druckleitung).
import * as THREE from 'three';
import { PO, PUMPEN, setWahl, setRep, setSchieber, setFuOrt, setFSoll, setSpitze, setEinPegel, setAusPegel, notieren, messung } from './pwost-modell.js';
import { sim, logA } from './anlage-sim.js';
import { f1, f0, noise, gauge, lcd, lamp, plate, senses, makeInstFactory, pipeFactory } from './instrumente.js';

export const OST = { x: 214, z: 18 };                                         // Mitte Pumpwerk
export const OST_ORT = { x0: 193, x1: 240, z0: -2, z1: 40 };                 // begehbare Fläche
const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
const n2 = (x) => x.toFixed(2).replace('.', ',');

export function buildOst(scene, h, hooks = {}) {
  const { box, cyl, reg, M, std } = h;
  const toast = hooks.toast || (() => {});
  const makeInst = makeInstFactory(scene, M);
  const pipe = pipeFactory();
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };
  const neuM = std(0x2f5f8a, { r: 0.4, m: 0.3 }), altM = std(0x4e6b4a, { r: 0.7, m: 0.2 }), motorM = std(0x6f7f8c, { r: 0.5, m: 0.4 }), guss = std(0x3a3f44, { r: 0.6, m: 0.5 });
  const rohrM = std(0x5d6d7e, { r: 0.5, m: 0.5 }), rot = std(0xb03a2e, { r: 0.5, m: 0.3 }), gelb = std(0xe1b12c, { r: 0.5 }), peM = std(0x1b1b1b, { r: 0.6 });
  const cylX = (g, r, len, mat, xc, y, z, seg = 28) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(xc, y, z); m.castShadow = true; g.add(m); return m; };
  const anim = { kupplung: [] };
  const P = () => sim.O;

  const g = new THREE.Group();
  const X0 = 206, X1 = 222, Z0 = 14, Z1 = 23, HH = 4.2, T = 0.3, D0 = 214, D1 = 216.2;
  // ---------------------------------------------------------------- Gebäude, Pumpensumpf, Umgebung (Gewerbegebiet)
  {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), M.concreteDark); fl.rotation.x = -Math.PI / 2; fl.position.set((X0 + X1) / 2, 0.03, (Z0 + Z1) / 2); fl.receiveShadow = true; g.add(fl);
    box(g, X1 - X0, HH, T, M.plaster, (X0 + X1) / 2, 0, Z1);
    box(g, T, HH, Z1 - Z0, M.plaster, X0, 0, (Z0 + Z1) / 2); box(g, T, HH, Z1 - Z0, M.plaster, X1, 0, (Z0 + Z1) / 2);
    box(g, D0 - X0, HH, T, M.plaster, (X0 + D0) / 2, 0, Z0); box(g, X1 - D1, HH, T, M.plaster, (D1 + X1) / 2, 0, Z0);
    box(g, D1 - D0, HH - 2.6, T, M.plaster, (D0 + D1) / 2, 2.6, Z0);
    box(g, X1 - X0 + 0.6, 0.35, Z1 - Z0 + 0.6, M.roof, (X0 + X1) / 2, HH, (Z0 + Z1) / 2);
    noCol(box(g, 1.0, 2.5, 0.06, M.door, D0 - 0.55, 0, Z0 - 0.2, 0, false));
    for (const x of [209, 219.5]) noCol(box(g, 1.6, 0.9, 0.08, M.window, x, 2.6, Z0 - 0.17, 0, false));
    const l1 = new THREE.PointLight(0xfff2d6, 16, 13, 1.6); l1.position.set(210, 3.8, 18.5); g.add(l1);
    const l2 = new THREE.PointLight(0xfff2d6, 12, 13, 1.6); l2.position.set(218, 3.8, 18.5); g.add(l2);
    box(g, 4.4, 0.05, 6, M.asphalt, (D0 + D1) / 2, 0, 10.5, 0, false);                             // Zufahrt
    box(scene, 60, 0.05, 6, M.asphalt, 236, 0, 5, 0, false);                                        // Erschließungsstraße Gewerbegebiet
    box(g, 7, 0.55, Z1 - Z0, M.concrete, 202.5, 0, (Z0 + Z1) / 2);                                 // Pumpensumpf, abgedeckt
    noCol(box(g, 1.2, 0.06, 1.2, M.grating, 202.5, 0.55, 16.2, 0, false));
    noCol(box(g, 0.25, 0.25, 0.25, std(0x2c3e50), 201.4, 0.55, 20.5, 0, false));                   // LI-101 Ultraschall
    pipe(g, [[198.9, 0.2, 21.5], [196.5, 0.2, 21.5], [196.5, -0.4, 24]], 0.2, M.concreteDark);    // Notüberlauf
    pipe(g, [[199, -0.3, 16], [192, -0.3, 16]], 0.3, M.concreteDark);                             // Zulaufkanal
    // Gewerbehallen (Kulisse, nicht Teil des Pumpwerks)
    const k = scene;
    box(k, 26, 8, 18, M.sheet, 240, 0, 32); box(k, 26.4, 0.4, 18.4, M.roof, 240, 8, 32);
    for (let x = 230; x <= 250; x += 5) box(k, 3.6, 4, 0.1, M.door, x, 0, 22.95, 0, false);
    box(k, 20, 6.5, 14, M.sheetBlue, 240, 0, -14); box(k, 20.4, 0.4, 14.4, M.roof, 240, 6.5, -14);
    box(k, 14, 9, 12, M.sheet, 264, 0, 10); box(k, 14.4, 0.4, 12.4, M.roof, 264, 9, 10);
    cyl(k, 0.5, 0.5, 16, M.steel, 270, 0, 3, 16);
  }

  // ---------------------------------------------------------------- Pumpenaggregate (P-001 neu, P-002 alt)
  const ZP = [16.6, 20.4], SIDE = [1, -1], AX = 0.75;
  ZP.forEach((zc, i) => {
    const s = SIDE[i], za = zc + s * 0.12, ry = s > 0 ? 0 : Math.PI, nr = PUMPEN[i].nr, zr = zc - s * 0.2, pm = i === 0 ? neuM : altM;
    box(g, 4.9, 0.12, 1.1, M.concrete, 211.4, 0, zc);
    box(g, 4.6, 0.13, 0.85, guss, 211.4, 0.12, zc);
    cylX(g, 0.085, 2.4, rohrM, 207.8, AX, zc);                                                    // Saugleitung DN 150
    box(g, 0.28, 0.42, 0.34, guss, 208.0, AX - 0.21, zc);                                          // Saugschieber
    cylX(g, 0.15, 0.04, guss, 207.83, AX, zc); cylX(g, 0.15, 0.04, guss, 208.17, AX, zc);
    noCol(box(g, 0.05, 0.6, 0.05, M.steel, 208.0, AX + 0.2, zc, 0, false));
    { const hw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 24), rot); hw.rotation.x = Math.PI / 2; hw.position.set(208.0, AX + 0.82, zc); hw.userData.noCol = true; g.add(hw); }
    { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.45, 20), pm); k.rotation.z = Math.PI / 2; k.position.set(209.25, AX, zc); g.add(k); }
    cylX(g, i === 0 ? 0.4 : 0.45, 0.3, pm, 209.62, AX, zc, 36);                                   // Spiralgehäuse
    cylX(g, i === 0 ? 0.34 : 0.39, 0.12, pm, 209.83, AX, zc, 36);
    box(g, 0.3, 0.33, 0.6, pm, 209.62, 0.25, zc);
    cyl(g, 0.065, 0.085, 0.45, pm, 209.62, AX + 0.25, zr, 20);                                    // Druckstutzen DN 100
    cyl(g, 0.14, 0.14, 0.04, guss, 209.62, AX + 0.7, zr);
    pipe(g, [[209.62, AX + 0.72, zr], [209.62, 2.62, zr]], 0.065, rohrM);
    box(g, 0.3, 0.3, 0.26, guss, 209.62, 1.42, zr);                                                // Rückschlagklappe
    noCol(box(g, 0.08, 0.08, 0.3, M.steel, 209.82, 1.57, zr, 0, false));
    noCol(box(g, 0.3, 0.42, 0.3, guss, 209.62, 1.8, zr, 0, false));                               // Druckschieber
    noCol(box(g, 0.05, 0.05, 0.42, M.steel, 209.62, 2.0, zr + s * 0.2, 0, false));
    { const hw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 24), rot); hw.position.set(209.62, 2.0, zr + s * 0.42); hw.userData.noCol = true; g.add(hw); }
    cylX(g, 0.15, 0.95, pm, 210.6, AX, zc);                                                        // Lagerträger
    box(g, 0.3, 0.5, 0.5, pm, 210.8, 0.25, zc);
    const ku = new THREE.Group(); ku.position.set(211.4, AX, zc); g.add(ku);
    { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 20), guss); a.rotation.z = Math.PI / 2; ku.add(a);
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), gelb); mk.position.y = 0.11; ku.add(mk); noCol(ku); anim.kupplung.push(ku); }
    noCol(box(g, 0.6, 0.42, 0.42, std(0xf1c40f, { r: 0.5, x: { transparent: true, opacity: 0.35, depthWrite: false } }), 211.4, AX - 0.21, zc, 0, false));
    box(g, 0.6, 0.2, 0.42, std(0xf1c40f, { r: 0.5 }), 211.4, AX - 0.42, zc);
    const mr = i === 0 ? 0.24 : 0.29, ml = i === 0 ? 1.05 : 1.35;
    cylX(g, mr, ml, motorM, 211.75 + ml / 2 + 0.05, AX, zc);
    for (let k = 0; k < 7; k++) noCol(box(g, ml - 0.15, 0.03, mr * 2.2, motorM, 211.8 + ml / 2, AX - mr + k * mr / 3.2, zc, 0, false));
    box(g, 0.3, 0.2, 0.26, motorM, 212.2, AX + mr, zc);
    box(g, ml - 0.1, 0.36, 0.6, motorM, 211.8 + ml / 2, 0.25, zc);
    // Vor-Ort-Schaltkasten
    noCol(box(g, 0.08, 1.2, 0.08, M.steel, 214.4, 0, zc, 0, false));
    box(g, 0.22, 0.6, 0.5, std(0xd5d8db, { r: 0.6, m: 0.2 }), 214.4, 1.1, zc);

    makeInst(`po_p${i}`, { name: `Kreiselpumpe ${nr} (${PUMPEN[i].name}, Baujahr ${PUMPEN[i].baujahr})`, tag: nr,
      pos: [209.62, AX + 0.05, zc + s * 0.46], rotY: ry, size: 0.34, aspect: 0.4, res: 128,
      info: i === 0 ? 'Trocken aufgestellte Abwasser-Kreiselpumpe, vor zwei Tagen eingebaut. Antrieb über Frequenzumrichter (FU), im Automatikbetrieb mit 50 Hz. Saugstutzen DN 125, Druckstutzen DN 100.'
        : 'Trocken aufgestellte Abwasser-Kreiselpumpe aus dem Bestand (Festdrehzahl, Stern-Dreieck-Anlauf). Saugstutzen DN 125, Druckstutzen DN 100.',
      draw: plate(nr, '#dfe6e9'),
      detail: (ctx, W, Hc) => {
        const x = P().p[i]; ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
        ctx.fillStyle = '#c8ccd0'; ctx.fillRect(W * 0.05, Hc * 0.06, W * 0.5, Hc * 0.58); ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.strokeRect(W * 0.05, Hc * 0.06, W * 0.5, Hc * 0.58);
        ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold ${W * 0.036}px Arial`; ctx.fillText(`Typenschild ${nr}`, W * 0.08, Hc * 0.09);
        ctx.font = `${W * 0.033}px monospace`; [`Baujahr ${PUMPEN[i].baujahr}`, ...PUMPEN[i].schild, i === 0 ? 'Betrieb an FU 50 Hz' : 'Stern-Dreieck'].forEach((t, k) => ctx.fillText(t, W * 0.08, Hc * (0.17 + k * 0.075)));
        ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.036}px Arial`;
        const l = x.run ? [x.q < 0.5 ? 'Läuft – kein Strömungsgeräusch,' : x.v > 3 ? 'Läuft unruhig, brummend.' : 'Läuft gleichmäßig.', x.q < 0.5 ? 'Gehäuse wird warm.' : 'Strömungsgeräusch in der Steigleitung.'] : ['Steht.'];
        [...l, `Wahlschalter ${WAHL[x.wahl]}, Rep.-Schalter ${x.rep ? 'EIN' : '0'}`].forEach((t, k) => ctx.fillText(t, W * 0.06, Hc * (0.7 + k * 0.08)));
        ctx.fillStyle = x.run ? '#00b894' : '#636e72'; ctx.beginPath(); ctx.arc(W * 0.75, Hc * 0.3, W * 0.06, 0, 7); ctx.fill();
        ctx.fillStyle = '#dfe6e9'; ctx.textAlign = 'center'; ctx.fillText(x.run ? 'in Betrieb' : 'Stillstand', W * 0.75, Hc * 0.42);
      },
      actions: () => [
        { label: 'Abhören (Stethoskop)', fn: () => toast(messung(P(), i, 'hoeren', logA)) },
        { label: 'Schwingung messen (Lagerträger)', fn: () => toast(messung(P(), i, 'schw', logA)) },
        { label: 'Lagertemperatur messen', fn: () => toast(messung(P(), i, 'temp', logA)) },
      ] });
    makeInst(`po_ps${i}`, { name: `Manometer Saugseite ${nr} (Manovakuummeter, Anschluss auf Höhe der Pumpenachse)`, tag: `PI 10${i + 1}.1`, pos: [208.65, AX + 0.3, za], rotY: ry, size: 0.2, round: true,
      info: 'Druck im Saugstutzen DN 125. Anschluss auf Höhe der Pumpenachse. Der Messumformer PT 10x.1 daneben liefert denselben Wert digital an die Pumpensteuerung.',
      draw: (ctx, W) => gauge(ctx, W, { min: -1, max: 1.5, ticks: 5, unit: 'bar', tag: `PI 10${i + 1}.1`, val: P().p[i].ps + (P().p[i].run ? noise(0.008, 3 + i) : 0), red: [-1, -0.6] }) });
    makeInst(`po_pd${i}`, { name: `Manometer Druckseite ${nr} (Anschluss am Druckstutzen, 0,50 m über dem saugseitigen Anschluss)`, tag: `PI 10${i + 1}.2`, pos: [209.62, 1.25, zr + s * 0.1], rotY: ry, size: 0.22, round: true,
      info: 'Druck am Druckstutzen DN 100 vor der Rückschlagklappe. Der Anschluss liegt 0,50 m höher als der saugseitige. Messumformer PT 10x.2 → Pumpensteuerung.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 4, ticks: 4, unit: 'bar', tag: `PI 10${i + 1}.2`, val: P().p[i].pd + (P().p[i].run ? noise(0.015, 7 + i) : 0) }) });
    const ventil = (id, seite, tag, name, pos, info) => makeInst(id, { name, tag, pos, rotY: ry, size: 0.2, aspect: 0.7, res: 128, info,
      draw: (ctx, W, Hc) => {
        const v = P().p[i][seite === 's' ? 'vs' : 'vd'];
        ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.15}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(tag, W / 2, Hc * 0.06);
        ctx.fillStyle = '#b2bec3'; ctx.fillRect(W * 0.1, Hc * 0.48, W * 0.8, Hc * 0.2); ctx.fillStyle = v > 95 ? '#00b894' : v < 3 ? '#d63031' : '#e1b12c'; ctx.fillRect(W * 0.1, Hc * 0.48, W * 0.8 * v / 100, Hc * 0.2);
        ctx.fillStyle = '#111'; ctx.font = `${W * 0.12}px Arial`; ctx.fillText(v < 3 ? 'ZU' : v > 95 ? 'AUF' : `${Math.round(v)} %`, W / 2, Hc * 0.74);
      },
      actions: () => [
        { typ: 'zahl', label: 'Stellung (Handrad)', wert: Math.round(P().p[i][seite === 's' ? 'vs' : 'vd']), min: 0, max: 100, einheit: '% offen', fn: (v) => setSchieber(P(), i, seite, v, logA) },
        { label: 'Ganz öffnen', fn: () => setSchieber(P(), i, seite, 100, logA) },
        { label: 'Schließen', fn: () => setSchieber(P(), i, seite, 0, logA) },
      ] });
    ventil(`po_vs${i}`, 's', `V-10${i + 1}.1`, `Saugschieber ${nr}`, [208.0, AX + 0.32, zc + s * 0.18], 'Absperrschieber in der Saugleitung. Im Betrieb immer ganz offen.');
    ventil(`po_vd${i}`, 'd', `V-10${i + 1}.2`, `Druckschieber ${nr}`, [209.62, 2.25, zr + s * 0.17], 'Absperrschieber in der Druckleitung oberhalb der Rückschlagklappe. Im Betrieb ganz offen.');
    makeInst(`po_sk${i}`, { name: `Vor-Ort-Schaltkasten ${nr}`, tag: `=+SK ${nr}`, pos: [214.27, 1.4, zc], rotY: -Math.PI / 2, size: 0.46, aspect: 1.0,
      info: 'Wahlschalter HAND/0/AUTO (AUTO = Niveausteuerung, HAND = Dauerbetrieb ohne Pegelschutz) und abschließbarer Reparaturschalter.',
      draw: (ctx, W, Hc) => {
        const x = P().p[i];
        lcd(ctx, W, Hc, `=+SK ${nr}`, [`Wahlschalter ${WAHL[x.wahl]}`, `Reparatursch. ${x.rep ? 'EIN' : '0'}`, `Strom ${f1(x.amp)} A`, `Bh ${f0(x.bh)} h`], { lcdH: 0.52, fs: 0.075 });
        lamp(ctx, W * 0.3, Hc * 0.82, W * 0.05, '#00b894', x.run, 'Betrieb', W);
        lamp(ctx, W * 0.7, Hc * 0.82, W * 0.05, '#f1c40f', !x.rep, 'Rep.-Sch.', W);
      },
      actions: () => {
        const x = P().p[i];
        return [
          { typ: 'wahl', label: 'Wahlschalter', wert: x.wahl, optionen: [['hand', 'HAND'], ['0', '0'], ['auto', 'AUTO']], fn: (v) => setWahl(P(), i, v, logA) },
          { typ: 'wahl', label: 'Reparaturschalter', wert: x.rep ? 'ein' : 'aus', optionen: [['ein', 'EIN'], ['aus', '0']], fn: (v) => setRep(P(), i, v === 'ein', logA) },
        ];
      } });
  });

  // Sammelleitung → Druckleitung zur Kläranlage (Austritt Ostwand), MID FI-101
  pipe(g, [[209.62, 2.62, 16.4], [209.62, 2.62, 20.6]], 0.085, rohrM);
  pipe(g, [[209.62, 2.62, 18.5], [222.6, 2.62, 18.5], [222.6, 0.4, 18.5]], 0.09, rohrM);
  pipe(g, [[222.6, 0.4, 18.5], [222.6, -0.3, 18.5]], 0.075, peM);
  noCol(box(g, 0.36, 0.36, 0.36, std(0x2f6fa8, { r: 0.5, m: 0.3 }), 219.0, 2.44, 18.5, 0, false));
  makeInst('po_fi', { name: 'Magnetisch-induktive Durchflussmessung Druckleitung', tag: 'FI-101', pos: [219.0, 2.0, 18.69], size: 0.34, aspect: 0.55,
    info: 'MID in der gemeinsamen Druckleitung zur Kläranlage: Förderstrom aller laufenden Pumpen zusammen.',
    draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'FI-101', [`${f0(Math.max(0, P().q + (P().q > 1 ? noise(0.6, 4) : 0)))} m³/h`], { lcdH: 0.55, fs: 0.15 }) });

  // Frequenzumrichter P-001 (Wandschrank Nordwand)
  box(g, 0.8, 1.3, 0.35, std(0xd5d8db, { r: 0.6, m: 0.2 }), 212.6, 0.8, 14.33);
  makeInst('po_fu', { name: 'Frequenzumrichter P-001 mit Bedienteil', tag: 'FU P-001', pos: [212.6, 1.5, 14.52], size: 0.62, aspect: 0.85,
    info: 'Frequenzumrichter der neuen Pumpe. Sollwertquelle FERN: Die Pumpensteuerung gibt 50 Hz vor. Sollwertquelle ORT: Frequenz-Handsollwert am Bedienteil (25–50 Hz, Rampe 4 s). Ein/Aus weiterhin über Wahlschalter bzw. Niveausteuerung.',
    draw: (ctx, W, Hc) => {
      const x = P().p[0];
      lcd(ctx, W, Hc, 'FU P-001', [`f     ${f1(x.f).padStart(5)} Hz`, `I     ${f1(x.amp).padStart(5)} A`, `P     ${f1(x.pkw).padStart(5)} kW`, `Soll  ${x.fuOrt ? `ORT ${f1(x.fSoll)} Hz` : 'FERN'}`], { lcdH: 0.6, fs: 0.085, bg: '#06223a', fg: '#7fd8ff' });
      lamp(ctx, W * 0.3, Hc * 0.86, W * 0.04, '#00b894', x.run, 'Run', W);
      lamp(ctx, W * 0.7, Hc * 0.86, W * 0.04, '#f1c40f', x.fuOrt, 'Ort', W);
    },
    actions: () => {
      const x = P().p[0];
      return [
        { typ: 'wahl', label: 'Sollwertquelle', wert: x.fuOrt ? 'ort' : 'fern', optionen: [['fern', 'FERN'], ['ort', 'ORT']], fn: (v) => setFuOrt(P(), v === 'ort', logA) },
        { typ: 'zahl', label: 'Frequenz-Handsollwert', wert: +x.fSoll.toFixed(1), min: 25, max: 50, einheit: 'Hz', fn: (v) => setFSoll(P(), v, logA) },
        { label: 'Messwerte notieren', fn: () => toast(notieren(P(), logA)) },
      ];
    } });

  // Pumpensteuerung (Schrank Ostwand)
  box(g, 0.5, 2.0, 1.4, std(0xd5d8db, { r: 0.6, m: 0.2 }), 221.6, 0, 21.2);
  const stZeilen = (pw) => [`LI-101  Pegel    ${n2(pw.li)} m`, `FI-101  Förderstr. ${f0(pw.q)} m³/h`, `PT 101.1 ${n2(pw.p[0].ps)}  PT 101.2 ${n2(pw.p[0].pd)} bar`, `PT 102.1 ${n2(pw.p[1].ps)}  PT 102.2 ${n2(pw.p[1].pd)} bar`,
    ...pw.p.map((x) => `${x.nr} ${WAHL[x.wahl].padEnd(4)} ${!x.rep ? 'Rep.-Sch.0' : x.run ? `Betrieb ${f1(x.amp)} A` : 'bereit'}`)];
  makeInst('po_st', { name: 'Pumpensteuerung PW Industriegebiet Ost', tag: 'APW-02 Steuerung', pos: [221.34, 1.45, 21.2], rotY: -Math.PI / 2, size: 0.95, aspect: 0.9,
    info: 'Niveausteuerung nach LI-101: P-001 Führung (ein bei Einschaltpegel, aus bei Ausschaltpegel). P-002 übernimmt, wenn P-001 nicht in AUTO ist; Spitzenlast-Zuschaltung ab 2,30 m nur bei Freigabe. Notüberlauf ab 2,80 m. Anzeige der Druckmessumformer PT saug-/druckseitig.',
    draw: (ctx, W, Hc) => {
      const pw = P();
      lcd(ctx, W, Hc, 'Pumpensteuerung APW-02', [...stZeilen(pw), `Zulauf ca. ${f0(pw.qIn)} m³/h`], { lcdH: 0.64, fs: 0.052 });
      lamp(ctx, W * 0.2, Hc * 0.88, W * 0.035, '#f1c40f', pw.li > PO.LI_HOCH, 'Pegel hoch', W);
      lamp(ctx, W * 0.5, Hc * 0.88, W * 0.035, '#00b894', pw.spitze, 'Spitzenlast', W);
      lamp(ctx, W * 0.8, Hc * 0.88, W * 0.035, '#d63031', pw.qUeb > 0, 'Notüberlauf', W);
    },
    detail: (ctx, W, Hc) => {
      const pw = P(); ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
      ctx.fillStyle = '#0d2310'; ctx.fillRect(W * 0.03, Hc * 0.03, W * 0.94, Hc * 0.47);
      ctx.fillStyle = '#7CFC9a'; ctx.font = `${W * 0.03}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      [...stZeilen(pw), `Ein ${n2(pw.liEin)} m  Aus ${n2(pw.liAus)} m  Spitzenlast ${pw.spitze ? 'frei' : 'gesperrt'}`].forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.05 + k * 0.062)));
      ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${W * 0.032}px Arial`; ctx.fillText('Ereignisspeicher', W * 0.05, Hc * 0.54);
      ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.027}px Arial`;
      const al = Object.values(pw.alarme).filter((a) => a.klasse !== 'M').sort((a, b) => b.kommt - a.kommt).slice(0, 3).map((a) => `${a.aktiv ? '● ' : '○ '}${a.text.replace('PW Ind.-Ost: ', '')}`);
      [...al, ...pw.historie].slice(0, 6).forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.61 + k * 0.055)));
    },
    actions: () => [
      { label: 'Messwerte notieren', fn: () => toast(notieren(P(), logA)) },
      { typ: 'wahl', label: 'Spitzenlast-Zuschaltung P-002', wert: P().spitze ? 'ein' : 'aus', optionen: [['aus', 'gesperrt'], ['ein', 'frei']], fn: (v) => setSpitze(P(), v === 'ein', logA) },
      { typ: 'zahl', label: 'Einschaltpegel', wert: +P().liEin.toFixed(2), min: 1.0, max: 2.2, einheit: 'm', fn: (v) => setEinPegel(P(), v, logA) },
      { typ: 'zahl', label: 'Ausschaltpegel', wert: +P().liAus.toFixed(2), min: 0.5, max: 1.4, einheit: 'm', fn: (v) => setAusPegel(P(), v, logA) },
    ] });

  // Anlagendokumentation an der Wand (Inbetriebnahmeprotokoll)
  noCol(box(g, 0.9, 1.15, 0.04, std(0xf5f1e6, { r: 0.9 }), 217.5, 1.0, 22.83, 0, false));
  makeInst('po_doku', { name: 'Anlagendokumentation APW-02 (Aushang Inbetriebnahmeprotokoll)', tag: 'Doku APW-02', pos: [217.5, 1.58, 22.8], rotY: Math.PI, size: 0.85, aspect: 1.25, res: 256,
    info: 'Aushang im Pumpenraum nach dem Umbau: Daten der Pumpen und der Druckleitung, Höhenbezüge.', detailW: 640, detailAspect: 1.15,
    draw: plate('Anlagendaten', '#f5f1e6'),
    detail: (ctx, W, Hc) => {
      ctx.fillStyle = '#f5f1e6'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `bold ${W * 0.032}px Arial`; ctx.fillText('APW-02 Industriegebiet Ost – Anlagendaten nach Umbau', W * 0.04, Hc * 0.025);
      const L = [
        ['b', 'Druckleitung DL-02 (Pumpwerk → Übergabeschacht KA Schwierbach)'],
        ['', 'Länge 400 m, Bestand Guss DN 150 (Baujahr 1979)'],
        ['', 'Saniert vorgestern: Relining PE-HD da 140 × 8,3 mm (SDR 17), d_i = 123,4 mm'],
        ['', 'Grund: Korrosion und Undichtigkeiten (Kamerabefahrung)'],
        ['', 'Auslauf Übergabeschacht: 20,20 m über Sohle Pumpensumpf (freier Auslauf)'],
        ['b', 'Pumpen'],
        ['', 'P-001 (neu): Auslegung Q = 80 m³/h, H = 22,0 m bei 50 Hz, Frequenzumrichter'],
        ['', '   Auslegung lt. Angebot: H_geo 18 m + Rohrreibung ≈ 4 m'],
        ['', 'P-002 (Bestand): Q = 95 m³/h bei H = 23,5 m, Festdrehzahl'],
        ['', 'Saugstutzen DN 125, Druckstutzen DN 100'],
        ['b', 'Höhen / Messstellen'],
        ['', 'Pumpenachse 0,60 m unter Sohle Pumpensumpf'],
        ['', 'PI/PT 10x.1 auf Achshöhe, PI/PT 10x.2 0,50 m über Achse'],
        ['', 'LI-101: Pegel über Sohle Pumpensumpf; Notüberlauf ab 2,80 m'],
        ['b', 'Steuerung'],
        ['', 'Ein 1,60 m · Aus 0,80 m · Spitzenlast-Zuschaltung P-002: deaktiviert'],
        ['', 'Freigabe durch: Pumpenservice Rhein-Ruhr / Stadtwerke, Abt. Netze'],
      ];
      L.forEach(([st, t], k) => { ctx.font = st === 'b' ? `bold ${W * 0.027}px Arial` : `${W * 0.025}px Arial`; ctx.fillText(t, W * 0.05, Hc * (0.085 + k * 0.053)); });
    } });

  // Pumpensumpf: Blick durch die Einstiegsluke
  noCol(box(g, 0.06, 1.1, 0.06, M.galv, 202.5, 0.55, 15.35, 0, false));
  makeInst('po_sumpf', { name: 'Pumpensumpf APW-02 (Blick durch die Einstiegsluke)', tag: 'Pumpensumpf', pos: [202.5, 1.55, 15.3], rotY: Math.PI, size: 0.4, aspect: 0.5, res: 256,
    info: 'Nassschacht mit Zulauf aus dem Gewerbegebiet (Mischwasser) und den Saugrohren der beiden Pumpen. Bei hohem Pegel staut das Abwasser in den Zulaufkanal zurück.',
    draw: plate('Pumpensumpf\nEinstiegsluke', '#f6e58d'),
    detail: (ctx, W, Hc) => {
      const pw = P(), run = pw.p.some((x) => x.run);
      senses(ctx, W, Hc, 'Pumpensumpf', [`Wasserstand ca. ${f1(pw.li)} m über der Sohle${pw.li > PO.LI_HOCH ? ' – Zulaufkanal eingestaut!' : ''}.`,
        `Zulauf: ${pw.qIn > 60 ? 'kräftig (Produktionszeit)' : 'mäßig'}, Abwasser grau-trüb.`,
        run ? 'Wasseroberfläche über den Saugrohren ruhig.' : 'Pumpen stehen, Wasserspiegel steigt.',
        pw.qUeb > 0 ? 'Wasser läuft über die Notüberlaufschwelle!' : 'Notüberlaufschwelle trocken.'], run);
    } });

  reg('ost', g, { name: 'Abwasserpumpwerk Industriegebiet Ost', kks: 'APW-02 · P-001 / P-002 · LI-101 · FI-101',
    text: 'Außenpumpwerk im Gewerbegebiet östlich des Schwierbachs: Hebt das Abwasser über die Druckleitung DL-02 (400 m) zur Kläranlage. Vor zwei Tagen wurde P-001 gegen eine neue Pumpe mit Frequenzumrichter getauscht und die Druckleitung im Relining-Verfahren saniert.',
    rows: [['Pumpen', 'P-001 neu (2026, FU) · P-002 Bestand (1994)'], ['Druckleitung', 'DL-02, 400 m, DN 150 Guss mit PE-HD-Inliner da 140'], ['Steuerung', 'Niveau LI-101: Ein 1,60 m / Aus 0,80 m'], ['Auslegung P-001', '80 m³/h bei 22 m']], walk: 'ost' });

  function update(dt) { const pw = P(); anim.kupplung.forEach((k, i) => { if (pw.p[i].run) k.rotation.x += dt * 25 * pw.p[i].f / 50; }); }
  return { update };
}
