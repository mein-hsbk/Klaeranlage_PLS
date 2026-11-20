// Sammelbecken Pumpwerk Bahnhofstraße (APW-01, Baujahr 1987): unterirdisches Rechteckbecken aus Stahlbeton
// mit Pumpensumpf (2 Tauchmotorpumpen), Zulauf Druckrohrleitung DN 300, Notüberlauf, Schieberschacht und
// Schaltschrank. Begehbar an der Oberfläche; Blick ins Becken durch die Öffnungen (Handlampe/Kamerastange),
// Maße nachprüfen, Zulauf/Ablauf prüfen, Becken leerpumpen, Füllversuch, Reinigung/Reparatur beauftragen,
// Kapazitätsbewertung notieren. Werte bewusst passend zum Bauwerksdatenblatt im PLS (8,00 × 5,00 × 5,00 m).
import * as THREE from 'three';
import { sim, logA } from './anlage-sim.js';
import { f1, f0, noise, lcd, lamp, plate, senses, makeInstFactory, insts } from './instrumente.js';

// Lage (Weltkoordinaten): Becken innen x −252 … −244 (L = 8 m), z 68 … 73 (B = 5 m)
export const BHF = { x0: -252, x1: -244, z0: 68, z1: 73, wand: 0.3, sohle: -5.7, ok: 0.08, nue: -0.7, zul: -0.55, sumpf: -6.7 };
export const BHF_ORT = [{ x0: -262, x1: -233, z0: 56, z1: 84 }, { x0: -262, x1: -204, z0: 56.5, z1: 63.5 }];
export const BHF_LOCH = [-254, -240, 66, 76];          // ausgesparte Geländezellen (2-m-Raster) für Becken und Schieberschacht
const A = 40, A_SUMPF = 1.6 * 3.0, Q_P = [0.060, 0.057];
const n2 = (x) => x.toFixed(2).replace('.', ',');

export function buildBahnhof(scene, h, hooks = {}) {
  const { box, reg, M, std } = h;
  const toast = hooks.toast || (() => {});
  const makeInst = makeInstFactory(scene, M);
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };
  const { x0, x1, z0, z1, wand: t, sohle, ok } = BHF, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
  const B0 = () => ({
    h: 1.25, sed: 0.36, schwimm: true, zopf: true, treibgut: true, leiter: 'alt', filter: 'alt', sLeck: true, deckel: 'alt', beton: 'befund',
    p: [{ run: false, bh: 26480 }, { run: false, bh: 3120 }], modus: 'auto', sperre: 0, sperreH0: 0, test: null,
    offen: { ein: false, zieh: false, rev: false, sch: false }, auftraege: [], saug: 0, t: 8 * 3600, peek: null, hist: [], vUeb: 0, ueber: false,
  });
  const B = B0(); sim.H = B;

  const g = new THREE.Group();
  // ---------------------------------------------------------------- Oberfläche: Pflaster mit Aussparungen, Decken, Zaun
  const SX0 = -243.4, SX1 = -241.8, SZ0 = 69.6, SZ1 = 71.6, ST = 0.2, SSOHLE = -2.0;     // Schieberschacht innen
  {
    const [lx0, lx1, lz0, lz1] = BHF_LOCH, sh = new THREE.Shape();
    sh.moveTo(lx0, -lz0); sh.lineTo(lx1, -lz0); sh.lineTo(lx1, -lz1); sh.lineTo(lx0, -lz1); sh.lineTo(lx0, -lz0);
    const hole = (a0, a1, b0, b1) => { const p = new THREE.Path(); p.moveTo(a0, -b0); p.lineTo(a0, -b1); p.lineTo(a1, -b1); p.lineTo(a1, -b0); p.lineTo(a0, -b0); sh.holes.push(p); };
    hole(x0 - t, x1 + t, z0 - t, z1 + t); hole(SX0 - ST, SX1 + ST, SZ0 - ST, SZ1 + ST);
    const pf = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), M.paving); pf.position.y = 0.02; pf.receiveShadow = true; g.add(pf);
  }
  const deckM = std(0xa7a49c, { r: 0.9 }), innenM = std(0x6d6a63, { r: 0.95 }), deckU = std(0x55524c, { r: 1 });
  function decke(a0, a1, b0, b1, loecher, dick) {
    const sh = new THREE.Shape(); sh.moveTo(a0, -b0); sh.lineTo(a1, -b0); sh.lineTo(a1, -b1); sh.lineTo(a0, -b1); sh.lineTo(a0, -b0);
    for (const [c0, c1, d0, d1] of loecher) { const p = new THREE.Path(); p.moveTo(c0, -d0); p.lineTo(c0, -d1); p.lineTo(c1, -d1); p.lineTo(c1, -d0); p.lineTo(c0, -d0); sh.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: dick, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [deckM, deckU]); m.position.y = ok - dick; m.castShadow = m.receiveShadow = true; noCol(m); g.add(m);
  }
  const OEFF = { ein: [-250.8, -250.0, 72.0, 72.8], rev: [-251.8, -251.0, 70.1, 70.9], zieh: [-245.4, -244.2, 69.4, 71.6], sch: [-243.1, -242.1, 69.9, 71.3] };
  decke(x0 - t, x1 + t, z0 - t, z1 + t, [OEFF.ein, OEFF.rev, OEFF.zieh], 0.25);
  decke(SX0 - ST, SX1 + ST, SZ0 - ST, SZ1 + ST, [OEFF.sch], 0.2);

  // Innenwände mit Zustand: Wasserwechselzone mit Fettrand, Gasraum mit Betonkorrosion (freiliegende Bewehrung)
  const wandTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const c = cv.getContext('2d');
    const H = 5.7 - 0.17, py = (y) => 512 - (y - sohle) / H * 512;                     // y: Welthöhe
    const gr = c.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#8e8a80'); gr.addColorStop(0.55, '#7d796f'); gr.addColorStop(1, '#4a463e'); c.fillStyle = gr; c.fillRect(0, 0, 512, 512);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${40 + r() * 60},${40 + r() * 55},${35 + r() * 45},${0.08 + r() * 0.12})`; c.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 6); }
    c.fillStyle = 'rgba(70,58,40,0.55)'; c.fillRect(0, py(sohle + 1.7), 512, py(sohle + 0.9) - py(sohle + 1.7));             // Fettrand Wasserwechselzone
    c.fillStyle = 'rgba(52,44,32,0.7)'; c.fillRect(0, py(sohle + 1.0), 512, 512 - py(sohle + 1.0));
    c.fillStyle = 'rgba(80,66,44,0.35)'; c.fillRect(0, py(sohle + 3.4), 512, 6);                                             // alte Hochwassermarke
    for (let i = 0; i < 900; i++) {                                                                                          // Gasraum: Korrosion (mürbe, Zuschlag frei)
      const x = r() * 512, y = py(-0.17) + Math.pow(r(), 1.6) * (py(-1.6) - py(-0.17)), w = 1 + r() * 4;
      c.fillStyle = `rgba(${170 + r() * 50},${165 + r() * 45},${150 + r() * 40},${0.25 + r() * 0.35})`; c.fillRect(x, y, w, w * (0.6 + r()));
    }
    for (let i = 0; i < 14; i++) {                                                                                           // Abplatzungen mit Bewehrung
      const x = r() * 512, y = py(-0.25 - r() * 0.8), w = 8 + r() * 14;
      c.fillStyle = 'rgba(120,112,98,0.7)'; c.beginPath(); c.ellipse(x, y, w, w * 0.5, r(), 0, 7); c.fill();
      if (r() < 0.6) { c.strokeStyle = 'rgba(140,70,25,0.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + w, y + 1); c.stroke(); }
    }
    for (let i = 0; i < 16; i++) { const x = r() * 512; c.strokeStyle = 'rgba(115,72,35,0.22)'; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(x, py(-0.5)); c.lineTo(x + r() * 6 - 3, py(-0.6 - r() * 1.2)); c.stroke(); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; return tx;
  })();
  const wandM = new THREE.MeshStandardMaterial({ map: wandTex, roughness: 1, color: 0xb0aca4 });
  const yTop = ok - 0.25, hW = yTop - sohle;
  for (const [w, cx, cz, ry] of [[x1 - x0, xm, z0, 0], [x1 - x0, xm, z1, Math.PI], [z1 - z0, x0, zm, Math.PI / 2], [z1 - z0, x1, zm, -Math.PI / 2]]) {
    const tex = wandTex.clone(); tex.repeat.set(w / 5, 1); tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hW), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: 0xb0aca4 })); m.position.set(cx, sohle + hW / 2, cz); m.rotation.y = ry; noCol(m); g.add(m);
  }
  noCol(box(g, x1 - x0, 0.05, z1 - z0, innenM, xm, sohle - 0.05, zm, 0, false));
  // Pumpensumpf (vertieft, Ostseite)
  const PS = [-245.6, -244, 69, 72];
  {
    const d = sohle - BHF.sumpf;
    for (const [w, cx, cz, ry] of [[PS[1] - PS[0], (PS[0] + PS[1]) / 2, PS[2], 0], [PS[1] - PS[0], (PS[0] + PS[1]) / 2, PS[3], Math.PI], [PS[3] - PS[2], PS[0], (PS[2] + PS[3]) / 2, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), innenM); m.position.set(cx, BHF.sumpf + d / 2, cz); m.rotation.y = ry; noCol(m); g.add(m);
    }
    noCol(box(g, PS[1] - PS[0], 0.05, PS[3] - PS[2], innenM, (PS[0] + PS[1]) / 2, BHF.sumpf - 0.05, (PS[2] + PS[3]) / 2, 0, false));
  }
  // Ablagerungen auf der Sohle (unregelmäßig)
  const sedGeo = new THREE.PlaneGeometry(PS[0] - x0 - 0.02, z1 - z0 - 0.02, 32, 20).rotateX(-Math.PI / 2);
  { const p = sedGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.18 * Math.sin(x * 1.7 + 1) * Math.sin(z * 2.1) + 0.12 * Math.sin(x * 4.3 + z * 3.1) - 0.1 * x / 4); } sedGeo.computeVertexNormals(); }
  const sed = new THREE.Mesh(sedGeo, std(0x5b4a35, { r: 1 })); sed.position.set((x0 + PS[0]) / 2, sohle, zm); noCol(sed); g.add(sed);
  // Wasser
  const wasserM = new THREE.MeshStandardMaterial({ color: 0x4f4a3c, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.97 });
  const wasser = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), wasserM); wasser.position.set(xm, sohle + B.h, zm); noCol(wasser); g.add(wasser);
  const schwimmGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2); { const p = schwimmGeo.attributes.position; for (let i = 1; i < p.count; i++) { const k = 0.82 + 0.18 * Math.sin(i * 0.45) + 0.06 * Math.sin(i * 1.3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
  const schwimm = new THREE.Mesh(schwimmGeo, new THREE.MeshStandardMaterial({ color: 0x5f563f, roughness: 0.95, transparent: true, opacity: 0.85 }));
  schwimm.scale.set(2.6, 1, 1.7); noCol(schwimm); g.add(schwimm);
  // Zulauf DN 300: Druckrohr durch die Westwand, Krümmer nach unten auf Prallplatte
  const guss = std(0x3d4246, { r: 0.6, m: 0.4 });
  const zr = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 3.3, 20).rotateZ(Math.PI / 2), guss); zr.position.set(x0 - 1.3, BHF.zul + 0.15, 70.5); noCol(zr); g.add(zr);
  const kr = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.17, 12, 20, Math.PI / 2), guss); kr.position.set(x0 + 0.3, BHF.zul - 0.15, 70.5); kr.rotation.z = Math.PI / 2; kr.rotation.y = Math.PI; noCol(kr); g.add(kr);
  const prall = box(g, 0.7, 0.04, 0.7, std(0x6f7276, { m: 0.3 }), x0 + 0.62, BHF.zul - 1.35, 70.5, 0, false); noCol(prall);
  for (const [a, b] of [[x0 + 0.02, 0], [x0 + 1.0, 0]]) noCol(box(g, 0.05, 0.05, 0.05, M.steel, a, BHF.zul - 1.35, 70.5 + b, 0, false));
  const strahl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x7d7461, transparent: true, opacity: 0.65, roughness: 0.3 }));
  noCol(strahl); g.add(strahl);
  const zopf = new THREE.Group(); for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.006, 0.5 + (i % 3) * 0.25, 5), std(0x8a8270)); s.position.set(x0 + 0.35 + i * 0.07, BHF.zul - 1.6 - (i % 3) * 0.12, 70.2 + (i % 4) * 0.18); s.rotation.z = (i - 3) * 0.12; zopf.add(s); } noCol(zopf); g.add(zopf);
  // Notüberlauf in der Nordwand (Schwelle BHF.nue), Überlaufleitung DN 400 zum Regenwasserkanal
  noCol(box(g, 0.9, 0.12, 0.35, innenM, -248, BHF.nue - 0.12, z1 - 0.17, 0, false));
  const nueOeff = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshBasicMaterial({ color: 0x0b0b0b })); nueOeff.position.set(-248, BHF.nue + 0.21, z1 - 0.01); nueOeff.rotation.y = Math.PI; noCol(nueOeff); g.add(nueOeff);
  const treib = new THREE.Group(); for (let i = 0; i < 6; i++) { const m = box(treib, 0.12 + (i % 2) * 0.1, 0.05, 0.08, std([0xd8d2c0, 0x6b5b45, 0xc0392b][i % 3]), -248.35 + i * 0.13, BHF.nue, z1 - 0.15 - (i % 2) * 0.06, i * 0.4, false); } noCol(treib); g.add(treib);
  // Steigleiter (Steigeisen, teils korrodiert, eines fehlt) unter dem Einstieg
  const eisenAlt = std(0x8a4b22, { r: 0.8, m: 0.3 }), eisen = std(0x6d6f72, { r: 0.6, m: 0.5 }), edel = std(0xc9ced3, { r: 0.3, m: 0.8 });
  const leiterAlt = new THREE.Group(), leiterNeu = new THREE.Group();
  for (let k = 0, y = -0.5; y > sohle + 0.3; y -= 0.28, k++) {
    if (k === 7) continue;
    noCol(box(leiterAlt, 0.4, 0.03, 0.16, k % 3 === 1 || k > 11 ? eisenAlt : eisen, -250.4, y, z1 - 0.08, 0, false));
    noCol(box(leiterNeu, 0.42, 0.03, 0.18, edel, -250.4, y, z1 - 0.12, 0, false));
  }
  for (const dx of [-0.22, 0.22]) noCol(box(leiterNeu, 0.04, -0.4 - sohle, 0.04, edel, -250.4 + dx, sohle, z1 - 0.2, 0, false));
  leiterNeu.visible = false; g.add(leiterAlt, leiterNeu);
  // Tauchmotorpumpen auf Kupplungsfüßen mit Führungsrohren, Druckleitungen DN 150 an der Ostwand
  const pumpM = std(0x2c5d8f, { r: 0.45, m: 0.3 });
  [69.9, 71.1].forEach((z, i) => {
    const pk = new THREE.Group();
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 20), pumpM); k.position.set(-244.85, BHF.sumpf + 0.75, z); pk.add(k);
    const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.25, 20), pumpM); kopf.position.set(-244.85, BHF.sumpf + 1.32, z); pk.add(kopf);
    noCol(box(pk, 0.5, 0.25, 0.5, guss, -244.5, BHF.sumpf, z, 0, false));
    for (const dz of [-0.12, 0.12]) { const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, BHF.ok - BHF.sumpf, 8), M.galv); fr.position.set(-244.25, (BHF.ok + BHF.sumpf) / 2, z + dz); pk.add(fr); }
    const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, -1.0 - BHF.sumpf, 14), guss); dl.position.set(-244.15, (BHF.sumpf - 1.0) / 2 + 0.1, z); pk.add(dl);
    const dq = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.0, 14).rotateZ(Math.PI / 2), guss); dq.position.set(-243.75, -1.0, z); pk.add(dq);
    const kette = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, BHF.ok - BHF.sumpf - 1.4, 4), M.steel); kette.position.set(-244.85, (BHF.ok + BHF.sumpf + 1.4) / 2, z); pk.add(kette);
    noCol(pk); g.add(pk);
  });
  // Schieberschacht mit 2 Keilflachschiebern, 2 Rückschlagklappen, Manometer, Sammelleitung DN 200 zur KA
  {
    for (const [w, cx, cz, ry] of [[SX1 - SX0, (SX0 + SX1) / 2, SZ0, 0], [SX1 - SX0, (SX0 + SX1) / 2, SZ1, Math.PI], [SZ1 - SZ0, SX0, (SZ0 + SZ1) / 2, Math.PI / 2], [SZ1 - SZ0, SX1, (SZ0 + SZ1) / 2, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ok - 0.2 - SSOHLE), innenM); m.position.set(cx, (ok - 0.2 + SSOHLE) / 2, cz); m.rotation.y = ry; noCol(m); g.add(m);
    }
    noCol(box(g, SX1 - SX0, 0.05, SZ1 - SZ0, innenM, (SX0 + SX1) / 2, SSOHLE - 0.05, (SZ0 + SZ1) / 2, 0, false));
    const sg = new THREE.Group();
    [69.9, 71.1].forEach((z, i) => {
      const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.5, 14).rotateZ(Math.PI / 2), guss); r1.position.set(-242.5, -1.0, z); sg.add(r1);
      box(sg, 0.22, 0.3, 0.3, std(0x2e4f7a, { m: 0.3 }), -242.95, -1.15, z, 0, false);                   // Rückschlagklappe
      box(sg, 0.14, 0.36, 0.26, std(0x2e4f7a, { m: 0.3 }), -242.4, -1.18, z, 0, false);                   // Schieber
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), M.steel); sp.position.set(-242.4, -0.6, z); sg.add(sp);
    });
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.6, 16), guss); sl.position.set(-242.05, -1.0, 70.5); sl.rotation.x = Math.PI / 2; sg.add(sl);
    const ab = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.5, 16).rotateZ(Math.PI / 2), guss); ab.position.set(-240.8, -1.0, 70.5); sg.add(ab);
    noCol(sg); g.add(sg);
  }
  const pfuetze = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3e4a4e, roughness: 0.1, metalness: 0.2 }));
  pfuetze.position.set(-242.6, SSOHLE + 0.01, 70.6); noCol(pfuetze); g.add(pfuetze);

  // Deckel (aufklappbar)
  const deckelM = std(0x55595c, { r: 0.55, m: 0.55 }), deckel = {};
  for (const [k, [a0, a1, b0, b1]] of Object.entries(OEFF)) {
    const piv = new THREE.Group(); piv.position.set(a0, ok, (b0 + b1) / 2);
    const lid = box(piv, a1 - a0 + 0.06, 0.04, b1 - b0 + 0.06, deckelM, (a1 - a0) / 2, 0, 0, 0, false); noCol(lid);
    g.add(piv); deckel[k] = piv;
  }
  const deckelSetzen = () => { for (const k in deckel) deckel[k].rotation.z = B.offen[k] ? 1.75 : 0; for (const k in INST_D) insts[INST_D[k]].mesh.material.opacity = B.offen[k] ? 0 : 1; };
  // Schaltschrank, Lüftung mit Aktivkohlefilter, Grundwassermessstelle, Zaun, Schild, Straßenschild
  box(g, 1.3, 1.65, 0.45, std(0x9aa0a6, { r: 0.6, m: 0.3 }), -240.7, 0, 66.9);
  box(g, 1.5, 0.15, 0.6, M.concrete, -240.7, 0, 66.9);
  const lr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 12), M.galv); lr.position.set(-246.2, 1.3, 73.6); g.add(lr);
  const kf = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 18), std(0x2d6a4f, { r: 0.6 })); kf.position.set(-246.2, 2.3, 73.6); g.add(kf);
  const hb = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 18), M.galv); hb.position.set(-246.2, 2.8, 73.6); g.add(hb);
  const gw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 12), std(0x2f6fa8, { m: 0.4 })); gw.position.set(-253.2, 0.3, 66.6); g.add(gw);
  const fx0 = -259, fx1 = -238.8, fz0 = 65.2, fz1 = 80;
  const zaun = (a, b, c, d) => { const len = Math.hypot(c - a, d - b), m = box(g, len, 1.8, 0.04, M.fence, (a + c) / 2, 0, (b + d) / 2, -Math.atan2(d - b, c - a), false); for (let s = 0; s <= len; s += 2.5) box(g, 0.06, 1.85, 0.06, M.steelDark, a + (c - a) * s / len, 0, b + (d - b) * s / len, 0, false); return m; };
  zaun(fx0, fz0, -249.2, fz0); zaun(-246.0, fz0, fx1, fz0); zaun(fx1, fz0, fx1, fz1); zaun(fx1, fz1, fx0, fz1); zaun(fx0, fz1, fx0, fz0);
  box(g, 0.06, 1.85, 0.06, M.steelDark, -249.2, 0, fz0, 0, false);
  { const pf2 = box(g, 0.05, 2.4, 0.05, M.galv, -236.2, 0, 63.9, 0, false); }
  // Saugspülfahrzeug (nur während der Reinigung)
  const lkw = new THREE.Group();
  box(lkw, 2.4, 2.6, 6.4, std(0xe67e22, { r: 0.5, m: 0.3 }), -244, 0.5, 60.5); box(lkw, 2.4, 1.6, 2.0, std(0xecf0f1), -244, 0.5, 57.0);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4.4, 20).rotateX(Math.PI / 2), std(0xe67e22, { r: 0.4, m: 0.4 })); tank.position.set(-244, 2.6, 61.2); lkw.add(tank);
  const sch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9.5, 8), std(0x222222)); sch.rotation.x = Math.PI / 2.6; sch.position.set(-244.6, 1.4, 66.4); lkw.add(sch);
  lkw.visible = false; noCol(lkw); scene.add(lkw);

  // Stadtkulisse: Häuser, Bahnstrecke mit Bahnhof
  const haus = (x, z, w, d, hh, col) => { box(scene, w, hh, d, std(col), x, 0, z); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.62, 2.2, 4, 1).rotateY(Math.PI / 4), M.roof); r.scale.set(1, 1, d / w); r.position.set(x, hh + 1.1, z); r.castShadow = true; scene.add(r); };
  haus(-258, 92, 9, 10, 6.5, 0xd9cbb4); haus(-243, 94, 10, 9, 7, 0xe3ddd0); haus(-228, 91, 8, 9, 6.2, 0xc9b8a0); haus(-266, 76, 7, 8, 6, 0xe8e0d0);
  box(scene, 4.2, 0.6, 360, std(0x7f7a72, { r: 1 }), -289, 0, 40, 0, false);
  for (const dx of [-0.72, 0.72]) box(scene, 0.07, 0.15, 360, M.steel, -289 + dx, 0.6, 40, 0, false);
  box(scene, 14, 4.5, 8, std(0xb9775a), -280, 0, 76); box(scene, 15, 0.4, 9, M.roof, -280, 4.5, 76);
  box(scene, 3, 0.9, 40, M.concrete, -285.8, 0, 75, 0, false);

  // ---------------------------------------------------------------- Modell
  const zulauf = () => 0.0424 * (1 + 0.28 * Math.sin((B.t / 3600 - 9) / 24 * 2 * Math.PI));
  const V = (h) => h >= 0 ? A * h : A_SUMPF * h;
  function step(dt) {
    B.t += dt;
    const lauf = B.sperre > 0 ? [false, false] : B.modus === 'leer' ? B.p.map((p) => (p.run ? B.h > -0.85 : B.h > -0.3)) : [B.p[0].run ? B.h > 0.9 : B.h >= 1.6, B.p[1].run ? B.h > 0.9 : B.h >= 3.4];
    if (B.sperre > 0) { B.sperre -= dt; if (B.sperre <= 0) { const dh = B.h - B.sperreH0; logA(`APW-01 Füllversuch beendet: Pegelanstieg ${n2(dh * 100)} cm in 120 s bei gesperrten Pumpen (Beckenfläche lt. Messung beachten)`, 'messung'); toast(`Füllversuch: Pegel ${n2(dh * 100)} cm in 120 s gestiegen. Pumpen wieder in AUTO.`); } }
    B.p.forEach((p, i) => { p.run = lauf[i]; if (p.run) p.bh += dt / 3600; });
    if (B.test) { B.test.t += dt; if (B.test.t >= 120) { const dh = B.test.h0 - B.h; logA(`APW-01 Pumpversuch P1 beendet: Pegelabsenkung ${n2(dh * 100)} cm in 120 s (Zulauf läuft weiter)`, 'messung'); toast(`Pumpversuch: Pegel ${n2(dh * 100)} cm in 120 s gesunken.`); B.test = null; B.modus = 'auto'; } }
    const qp = B.test ? Q_P[0] : (lauf[0] ? Q_P[0] : 0) + (lauf[1] ? Q_P[1] : 0);
    let vol = V(B.h) + (zulauf() - qp) * dt;
    B.h = vol >= 0 ? vol / A : Math.max(-1, vol / A_SUMPF);
    if (B.h > BHF.nue - sohle) { B.vUeb += (B.h - (BHF.nue - sohle)) * A; B.h = BHF.nue - sohle; if (!B.ueber) logA('APW-01 Notüberlauf springt an', 'alarm'); B.ueber = true; } else B.ueber = false;
    if (!B.hist.length || B.t - B.hist[B.hist.length - 1].t >= 60) B.hist.push({ t: B.t, h: B.h, qz: zulauf() * 1000, np: (lauf[0] ? 1 : 0) + (lauf[1] ? 1 : 0) });
    if (B.saug > 0) { B.saug -= dt; B.sed = Math.max(0.02, B.sed - dt / 1800 * 0.34); if (B.saug <= 0) { B.sed = 0.02; B.schwimm = false; logA('APW-01 Reinigung abgeschlossen: Sohle und Pumpensumpf gesaugt, Schwimmschlamm entfernt (ca. 14 m³ Sand/Schlamm entsorgt)', 'sys'); toast('Reinigung abgeschlossen.'); } }
    for (const a of B.auftraege) if (!a.fertig && B.t >= a.fertigT) { a.fertig = true; a.wirkung(); logA(`APW-01 Auftrag erledigt: ${a.text}`, 'sys'); }
  }
  function pegelText() { return B.h >= 0 ? `${n2(B.h)} m über Sohle` : 'im Pumpensumpf'; }

  // ---------------------------------------------------------------- Vor-Ort-Elemente
  const deckelDraw = (txt, sub) => (ctx, W, Hc) => {
    ctx.fillStyle = '#4b4f52'; ctx.fillRect(0, 0, W, Hc); ctx.strokeStyle = '#2f3234'; ctx.lineWidth = W * 0.02;
    for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, Hc * i / 10); ctx.lineTo(W, Hc * i / 10 - Hc * 0.06); ctx.stroke(); }
    ctx.strokeStyle = '#1e2123'; ctx.lineWidth = W * 0.04; ctx.strokeRect(W * 0.02, W * 0.02, W * 0.96, Hc - W * 0.04);
    ctx.fillStyle = '#c8ccd0'; ctx.font = `bold ${W * 0.11}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, W / 2, Hc * 0.42); ctx.font = `${W * 0.07}px Arial`; ctx.fillText(sub, W / 2, Hc * 0.6);
  };
  const oeffnen = (k, name) => ({ label: B.offen[k] ? `${name} schließen` : `${name} öffnen`, fn: () => { B.offen[k] = !B.offen[k]; deckelSetzen(); logA(`APW-01 ${name} ${B.offen[k] ? 'geöffnet (Absturzsicherung gestellt)' : 'geschlossen'}`); } });
  const peekAct = (k, label) => ({ label, fn: () => { if (!B.offen[k]) return toast('Erst den Deckel öffnen.'); hooks.peek && setTimeout(() => hooks.peek(k), 0); } });
  const mess = (txt, toastTxt) => { logA(`APW-01 ${txt}`, 'messung'); toast(toastTxt || txt); };
  const zuOkDeckel = () => n2(ok - (sohle + Math.max(B.h, -1)));
  const INST_D = { ein: 'bh_ein', rev: 'bh_rev', zieh: 'bh_zieh', sch: 'bh_sch' };
  const lid = (id, k, pos, size, aspect, name, txt, sub, info, extra) => {
    const it = makeInst(id, { name, tag: txt, pos, size, aspect, res: 256, info, draw: deckelDraw(txt, sub),
      detail: (ctx, W, Hc) => senses(ctx, W, Hc, name, B.offen[k] ? ['Deckel offen, Absturzsicherung steht.', 'Aus der Öffnung riecht es nach Abwasser.', `Wasserspiegel ca. ${zuOkDeckel()} m unter Deckel.`] : ['Deckel geschlossen und verriegelt.', 'Zum Hineinsehen erst öffnen.'], true),
      actions: () => [oeffnen(k, name.split(' (')[0]), ...extra()] });
    it.mesh.rotation.x = -Math.PI / 2; it.mesh.material.transparent = true; it.mesh.material.depthWrite = false;
    return it;
  };
  lid('bh_ein', 'ein', [-250.4, ok + 0.035, 72.4], 0.8, 1, 'Einstiegsöffnung mit Steigleiter', 'Einstieg', 'APW-01',
    'Einstieg in das Sammelbecken über Steigeisen. Einsteigen nur nach DGUV Regel 103-003 (umschlossene Räume): Freimessen, Gaswarngerät, Dreibein mit Höhensicherung, Sicherungsposten. Für die Inspektion reicht der Blick von oben mit Handlampe bzw. Kamerastange.',
    () => [
      peekAct('ein', 'Mit Handlampe hineinleuchten (Blick ins Becken)'),
      { typ: 'titel', label: 'Messen (von oben)' },
      { label: 'Länge und Breite innen messen (Laser-Entfernungsmesser)', fn: () => B.offen.ein ? mess('Innenmaße gemessen: L = 7,98 m (Westwand–Ostwand), B = 4,99 m (Südwand–Nordwand)', 'Laser: Länge innen 7,98 m, Breite innen 4,99 m.') : toast('Erst den Deckel öffnen.') },
      { label: 'Tiefe loten (Kanallot bis zur Sohle)', fn: () => B.offen.ein ? mess(`Gelotet ab OK Deckel: Lot sinkt bei ${n2(ok - sohle - B.sed)} m in weichen Grund, fester Grund bei ${n2(ok - sohle)} m – Ablagerungen ca. ${f0(B.sed * 100)} cm`, `Lot: weicher Grund bei ${n2(ok - sohle - B.sed)} m, fester Grund bei ${n2(ok - sohle)} m unter OK Deckel.`) : toast('Erst den Deckel öffnen.') },
      { label: 'Wasserstand messen (Abstich mit Lichtlot)', fn: () => B.offen.ein ? mess(`Abstich Wasserspiegel: ${zuOkDeckel()} m unter OK Deckel`) : toast('Erst den Deckel öffnen.') },
      { label: 'Wand- und Deckenstärke an der Öffnung messen', fn: () => B.offen.ein ? mess('An der Einstiegsöffnung gemessen: Deckenstärke 0,25 m; Wandstärke (Nordwand, Einstieg an der Wand) 0,30 m') : toast('Erst den Deckel öffnen.') },
      { label: 'Steigeisen prüfen', fn: () => B.offen.ein ? mess(B.leiter === 'alt' ? 'Steigeisen: stark korrodiert, teils lose, das 8. Steigeisen fehlt – nicht sicher begehbar' : 'Steigleiter: neue Edelstahlleiter mit Steigschutzschiene, in Ordnung') : toast('Erst den Deckel öffnen.') },
    ]);
  lid('bh_rev', 'rev', [-251.4, ok + 0.035, 70.5], 0.8, 1, 'Revisionsöffnung über dem Zulauf', 'Zulauf', 'DN 300',
    'Öffnung über dem Einlauf der Druckrohrleitung DN 300. Von hier sind Zulauf, Prallplatte und Notüberlauf einsehbar.',
    () => [
      peekAct('rev', 'Hineinleuchten: Zulauf und Notüberlauf ansehen'),
      { typ: 'titel', label: 'Zulauf prüfen' },
      { label: 'Höhenlage Zulauf messen (Rohrsohle)', fn: () => B.offen.rev ? mess(`Zulauf DN 300: Rohrsohle ${n2(ok - BHF.zul - 0.0)} m unter OK Deckel, Rohrscheitel ${n2(ok - BHF.zul - 0.3)} m`) : toast('Erst den Deckel öffnen.') },
      { label: 'Zulauf begutachten', fn: () => B.offen.rev ? mess(`Zulauf: Druckrohr DN 300 (Guss) endet mit 90°-Krümmer nach unten auf Prallplatte; Zufluss gleichmäßig, ${zulauf() > 0.045 ? 'kräftig' : 'mäßig'}; ${B.zopf ? 'Zopfbildung (Feuchttücher/Fasern) an der Prallplatte' : 'Prallplatte frei'}`) : toast('Erst den Deckel öffnen.') },
      { label: 'Zöpfe an der Prallplatte mit dem Haken entfernen', fn: () => { if (!B.offen.rev) return toast('Erst den Deckel öffnen.'); if (!B.zopf) return toast('Prallplatte ist frei.'); B.zopf = false; mess('Zöpfe an der Prallplatte mit Räumhaken entfernt und im Container entsorgt', 'Zöpfe entfernt.'); } },
      { typ: 'titel', label: 'Notüberlauf' },
      { label: 'Höhe der Notüberlaufschwelle messen', fn: () => B.offen.rev ? mess(`Notüberlaufschwelle (Nordwand) ${n2(ok - BHF.nue)} m unter OK Deckel; Überlaufleitung DN 400 zum Regenwasserkanal`) : toast('Erst den Deckel öffnen.') },
      { label: 'Treibgut von der Überlaufschwelle entfernen', fn: () => { if (!B.offen.rev) return toast('Erst den Deckel öffnen.'); if (!B.treibgut) return toast('Schwelle ist frei.'); B.treibgut = false; mess('Treibgut (Kunststoff, Holz) an der Notüberlaufschwelle mit Räumhaken entfernt', 'Treibgut entfernt.'); } },
    ]);
  lid('bh_zieh', 'zieh', [-244.8, ok + 0.035, 70.5], 1.2, 2.2 / 1.2, 'Montageöffnung Pumpensumpf', 'Pumpen', 'P1 · P2',
    'Montageöffnung über dem Pumpensumpf. Die beiden Tauchmotorpumpen sitzen auf Kupplungsfüßen und werden an Führungsrohren mit der Kette gezogen.',
    () => [
      peekAct('zieh', 'Hineinleuchten: Pumpensumpf und Pumpen ansehen'),
      { label: 'Pumpensumpf loten', fn: () => B.offen.zieh ? mess(`Pumpensumpf: Sohle ${n2(ok - BHF.sumpf)} m unter OK Deckel (1,00 m unter Beckensohle), Grundfläche ca. 1,6 × 3,0 m`) : toast('Erst den Deckel öffnen.') },
      { label: 'Laufgeräusch der Pumpen abhören', fn: () => B.offen.zieh ? mess(B.p.some((p) => p.run) ? 'Pumpe läuft ruhig, gleichmäßiges Brummen, keine Kavitationsgeräusche' : 'Pumpen stehen (Einschaltpegel noch nicht erreicht)') : toast('Erst den Deckel öffnen.') },
    ]);
  lid('bh_sch', 'sch', [-242.6, ok + 0.035, 70.6], 1.0, 1.4, 'Schieberschacht (Ablauf / Druckleitung zur KA)', 'Schieber', 'DN 150/200',
    'Armaturenschacht neben dem Becken: je Pumpe Rückschlagklappe und Absperrschieber DN 150, danach Sammel-Druckleitung DN 200 zur Kläranlage.',
    () => [
      peekAct('sch', 'Hineinleuchten: Armaturen ansehen'),
      { typ: 'titel', label: 'Ablauf prüfen' },
      { label: 'Armaturen und Stellungen begutachten', fn: () => B.offen.sch ? mess(`Schieberschacht: Schieber P1 und P2 offen, Rückschlagklappen ${B.p.some((p) => p.run) ? 'P1 offen (Pumpe läuft), P2 geschlossen' : 'geschlossen'}; ${B.sLeck ? 'Stopfbuchse Schieber P2 tropft, Wasser auf der Schachtsohle' : 'Schacht trocken'}`) : toast('Erst den Deckel öffnen.') },
      { label: 'Druck in der Sammelleitung ablesen', fn: () => B.offen.sch ? mess(`Manometer Sammelleitung DN 200: ${B.p.some((p) => p.run) ? `${f1(1.9 + noise(0.05, 3))} bar` : '0,4 bar (Ruhedruck, Pumpen aus)'}`) : toast('Erst den Deckel öffnen.') },
      { label: 'Stopfbuchse am Schieber P2 nachziehen', fn: () => { if (!B.offen.sch) return toast('Erst den Deckel öffnen.'); if (!B.sLeck) return toast('Stopfbuchse ist dicht.'); B.sLeck = false; mess('Stopfbuchse Schieber P2 gleichmäßig nachgezogen – dicht', 'Stopfbuchse dicht.'); } },
    ]);
  makeInst('bh_ss', { name: 'Schaltschrank Außenstation APW-01 (Niveausteuerung, Fernwirktechnik)', tag: 'Schaltschrank APW-01', pos: [-240.7, 1.15, 66.66], rotY: Math.PI, size: 0.95, aspect: 1.0,
    info: 'Niveausteuerung über Drucksonde: P1 ein bei 1,60 m, aus bei 0,90 m; P2 schaltet bei 3,40 m zu. Meldungen gehen über Fernwirktechnik an die Leitwarte der Kläranlage. Im Schrank liegt der Bestandsordner mit Lageplan.',
    draw: (ctx, W, Hc) => {
      lcd(ctx, W, Hc, 'APW-01 Bahnhofstraße', [`LI Pegel ${B.h >= 0 ? n2(B.h) + ' m' : 'Sumpf'}`, `P1 ${B.p[0].run ? 'EIN' : 'aus'}  ${f0(B.p[0].bh)} h`, `P2 ${B.p[1].run ? 'EIN' : 'aus'}  ${f0(B.p[1].bh)} h`, B.sperre > 0 ? { t: 'Füllversuch', c: '#ffeaa7' } : B.modus === 'leer' ? { t: 'HAND leerpumpen', c: '#ffeaa7' } : B.ueber ? { t: 'NOTÜBERLAUF', c: '#ff7675' } : 'AUTO'], { lcdH: 0.6, fs: 0.075 });
      lamp(ctx, W * 0.25, Hc * 0.82, W * 0.045, '#00b894', B.p[0].run, 'P1', W); lamp(ctx, W * 0.5, Hc * 0.82, W * 0.045, '#00b894', B.p[1].run, 'P2', W); lamp(ctx, W * 0.75, Hc * 0.82, W * 0.045, '#d63031', B.ueber, 'Überlauf', W);
    },
    actions: () => [
      { typ: 'titel', label: 'Betrieb' },
      { label: B.modus === 'leer' ? 'Leerpumpen beenden (AUTO)' : 'Becken leerpumpen (P1 + P2 HAND bis Trockenlaufschutz)', fn: () => { B.modus = B.modus === 'leer' ? 'auto' : 'leer'; B.test = null; logA(`APW-01 ${B.modus === 'leer' ? 'Becken wird leergepumpt (P1 + P2 HAND)' : 'Pumpen wieder in AUTO'}`); } },
      { label: 'Füllversuch: Pumpen 120 s sperren, Pegelanstieg messen', fn: () => { if (B.h < 0.3) return toast('Pegel zu niedrig – erst etwas auffüllen lassen.'); B.modus = 'auto'; B.sperre = 120; B.sperreH0 = B.h; logA(`APW-01 Füllversuch gestartet: Pumpen gesperrt, Pegel ${n2(B.h)} m`); toast('Pumpen 120 s gesperrt – Pegel wird beobachtet.'); } },
      { label: 'Pumpversuch: P1 allein 120 s, Pegelabsenkung messen', fn: () => { if (B.h < 0.5) return toast('Pegel zu niedrig für den Pumpversuch.'); B.modus = 'auto'; B.test = { t: 0, h0: B.h }; logA(`APW-01 Pumpversuch P1 gestartet bei Pegel ${n2(B.h)} m`); toast('P1 läuft 120 s – Pegel wird beobachtet.'); } },
      { typ: 'titel', label: 'Unterlagen und Aufträge' },
      { label: 'Lageplan aus dem Bestandsordner ansehen', fn: () => hooks.openDetail && setTimeout(() => hooks.openDetail('bh_lage'), 0) },
      { label: 'Reinigungs- oder Reparaturauftrag erteilen', fn: () => setTimeout(oeffneAuftrag, 0) },
      { label: 'Kapazitätsbewertung notieren', fn: () => setTimeout(oeffneBewertung, 0) },
    ] });
  makeInst('bh_lage', { name: 'Lageplan Pumpwerk Bahnhofstraße (Bestandsordner)', tag: 'Lageplan', pos: [-240.7, 0.5, 66.66], rotY: Math.PI, size: 0.3, aspect: 0.75, detailW: 1024, detailAspect: 0.82,
    info: 'Auszug aus dem Liegenschaftskataster mit Bauwerken, Grundstücksgrenze und Leitungen im Gehweg (Leitungsauskunft 2019).',
    draw: plate('Lageplan', '#fffef5'),
    detail: (ctx, W, Hc) => {
      ctx.fillStyle = '#fffef5'; ctx.fillRect(0, 0, W, Hc);
      const s = W / 34, X = (x) => (x + 262) * s, Z = (z) => W * 0.055 + (81.5 - z) * s;
      ctx.fillStyle = '#5a4820'; ctx.font = `bold ${W * 0.024}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Lageplan APW-01 Bahnhofstraße · M 1 : 200 (Auszug) · Norden oben', W * 0.02, W * 0.015);
      ctx.fillStyle = '#d5d2c8'; ctx.fillRect(X(-262), Z(63), 34 * s, 6 * s); ctx.fillStyle = '#ece8db'; ctx.fillRect(X(-262), Z(65), 34 * s, 2 * s);
      ctx.fillStyle = '#5a4820'; ctx.font = `italic ${W * 0.02}px Georgia`; ctx.fillText('Bahnhofstraße', X(-232), Z(61.2)); ctx.fillText('Gehweg', X(-236), Z(64.6));
      ctx.strokeStyle = '#a03040'; ctx.setLineDash([10, 6]); ctx.lineWidth = 2; ctx.strokeRect(X(-259), Z(80), 21 * s, 15 * s); ctx.setLineDash([]);
      ctx.fillStyle = '#a03040'; ctx.fillText('Grundstücksgrenze Flurstück 312', X(-258.6), Z(80) + 4);
      ctx.fillStyle = '#c9c4b5'; ctx.strokeStyle = '#2c1810'; ctx.lineWidth = 1.5;
      ctx.fillRect(X(-252.3), Z(73.3), 8.6 * s, 5.6 * s); ctx.strokeRect(X(-252.3), Z(73.3), 8.6 * s, 5.6 * s);
      ctx.fillRect(X(-243.6), Z(71.8), 2 * s, 2.4 * s); ctx.strokeRect(X(-243.6), Z(71.8), 2 * s, 2.4 * s); ctx.fillRect(X(-241.35), Z(67.1), 1.3 * s, 0.5 * s);
      ctx.fillStyle = '#2c1810'; ctx.font = `${W * 0.019}px Arial`; ctx.fillText('Sammelbecken', X(-250.4), Z(71.3)); ctx.fillText('SS', X(-243.2), Z(71)); ctx.fillText('Schaltschrank', X(-243.5), Z(66.6));
      ctx.fillStyle = '#e6efd8'; ctx.fillRect(X(-258.8), Z(79.8), 6.2 * s, 13.6 * s); ctx.fillStyle = '#4a6b2a'; ctx.fillText('Grünfläche (städt.)', X(-258.4), Z(76)); ctx.fillText('frei, unbebaut', X(-258.4), Z(75));
      const ln = (zz, c, t2) => { ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(-262), Z(zz)); ctx.lineTo(X(-228), Z(zz)); ctx.stroke(); ctx.fillStyle = c; ctx.fillText(t2, X(-231), Z(zz) - 16); };
      ln(64.4, '#e1b12c', 'Gas'); ln(65.3, '#0984e3', 'TW'); ln(60, '#6c5ce7', 'Telekom');
      ctx.strokeStyle = '#2c1810'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(-262), Z(70.5)); ctx.lineTo(X(-252.3), Z(70.5)); ctx.stroke(); ctx.fillStyle = '#2c1810'; ctx.fillText('Zulauf DR DN 300', X(-261.6), Z(70.5) - 18);
      ctx.beginPath(); ctx.moveTo(X(-241.6), Z(70.5)); ctx.lineTo(X(-238.6), Z(70.5)); ctx.lineTo(X(-238.6), Z(57)); ctx.stroke(); ctx.fillText('DR DN 200 → KA', X(-238.3), Z(58.5));
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(-248), Z(73.3)); ctx.lineTo(X(-248), Z(81.5)); ctx.stroke(); ctx.setLineDash([]); ctx.fillText('Notüberlauf DN 400 → RW-Kanal', X(-247.6), Z(81.4));
      ctx.fillStyle = '#2f6fa8'; ctx.beginPath(); ctx.arc(X(-253.2), Z(66.6), 5, 0, 7); ctx.fill(); ctx.fillText('GWM 3', X(-252.7), Z(66.2));
      ctx.fillStyle = '#5a4820'; ctx.font = `italic ${W * 0.018}px Georgia`; ctx.fillText('Maße in der Örtlichkeit prüfen. Abstände nicht abgreifen!', W * 0.02, Hc - W * 0.035);
    } });
  makeInst('bh_lueft', { name: 'Be- und Entlüftung mit Aktivkohlefilter', tag: 'Lüftung', pos: [-246.2, 1.4, 73.52], rotY: Math.PI, size: 0.16, aspect: 1.2, res: 128,
    info: 'Beim Füllen verdrängt das Abwasser die Luft im Becken. Sie entweicht über den Aktivkohlefilter, damit es in der Bahnhofstraße nicht riecht. Erschöpfte Kohle lässt Geruch (H₂S) durch.',
    draw: plate('AKF', '#d1f2eb'),
    detail: (ctx, W, Hc) => senses(ctx, W, Hc, 'Lüftung mit Aktivkohlefilter', B.filter === 'alt' ? ['Deutlicher Geruch nach faulen Eiern am Austritt.', 'Prüfaufkleber Filtertausch: 04/2022.', 'Anwohnerbeschwerde im Ordner vermerkt.'] : ['Kein Geruch wahrnehmbar.', 'Prüfaufkleber Filtertausch: aktuell.'], true),
    actions: () => [{ label: 'Geruch am Austritt prüfen', fn: () => mess(B.filter === 'alt' ? 'Lüftung: deutlicher H₂S-Geruch am Austritt, Aktivkohle laut Aufkleber zuletzt 04/2022 getauscht' : 'Lüftung: geruchlos') }] });
  makeInst('bh_gwm', { name: 'Grundwassermessstelle GWM 3', tag: 'GWM 3', pos: [-253.2, 0.66, 66.6], rotY: 0, size: 0.14, round: true, res: 128,
    info: 'Grundwassermessstelle (Pegelrohr) am Grundstücksrand. Der Grundwasserstand ist wichtig für Bauarbeiten: Baugrube, Wasserhaltung, Auftriebssicherheit eines leeren Beckens.',
    draw: plate('GWM 3', '#74b9ff'),
    actions: () => [{ label: 'Grundwasserstand messen (Lichtlot)', fn: () => mess('Grundwassermessstelle GWM 3: Abstich 2,35 m unter Geländeoberkante') }] });
  makeInst('bh_beton', { name: 'Betonoberfläche an der Einstiegsöffnung', tag: 'Beton', pos: [-250.4, ok - 0.2, 72.84], rotY: Math.PI, size: 0.14, aspect: 0.6, res: 128,
    info: 'Wandoberfläche direkt unter der Einstiegsöffnung (Gasraum). Hier lassen sich Abklopfen und Rückprallhammer ansetzen.',
    draw: plate('Beton', '#bdc3c7'),
    actions: () => [
      { label: 'Abklopfen (Hammer)', fn: () => mess('Wand im Gasraum: Oberfläche mürbe, sandet ab; Zuschlag freiliegend, an zwei Stellen Bewehrung sichtbar und korrodiert (Abplatzungen)') },
      { label: 'Rückprallhammer ansetzen (Gasraum und Wasserwechselzone)', fn: () => mess('Rückprallhammer: Gasraum oberes 1 m R ≈ 21–25; tiefer (über Leiter erreichbar) R ≈ 38–42 → oberflächennahe Festigkeit im Gasraum deutlich reduziert') },
    ] });
  makeInst('bh_schild', { name: 'Bauwerksschild am Tor', tag: 'APW-01', pos: [-247.6, 1.9, 65.1], rotY: Math.PI, size: 0.7, aspect: 0.4,
    info: 'Bauwerksschild des Abwasserbetriebs am Zufahrtstor.',
    draw: (ctx, W, Hc) => { ctx.fillStyle = '#1e3799'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${W * 0.055}px Arial`; ctx.fillText('Stadt Schwierbach · Abwasserbetrieb', W / 2, Hc * 0.25); ctx.font = `bold ${W * 0.075}px Arial`; ctx.fillText('Pumpwerk Bahnhofstraße', W / 2, Hc * 0.55); ctx.font = `${W * 0.05}px Arial`; ctx.fillText('APW-01 · Betreten verboten', W / 2, Hc * 0.82); } });
  makeInst('bh_str', { name: 'Straßenschild', tag: 'Bahnhofstraße', pos: [-236.2, 2.25, 63.85], rotY: Math.PI, size: 0.9, aspect: 0.22, res: 256,
    info: 'Straßenschild.', draw: (ctx, W, Hc) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, Hc); ctx.strokeStyle = '#111'; ctx.lineWidth = W * 0.02; ctx.strokeRect(W * 0.03, Hc * 0.1, W * 0.94, Hc * 0.8); ctx.fillStyle = '#111'; ctx.font = `bold ${Hc * 0.55}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Bahnhofstraße', W / 2, Hc * 0.52); } });

  reg('bhf', g, { name: 'Pumpwerk Bahnhofstraße – Sammelbecken', kks: 'APW-01',
    text: 'Außenstation im Kanalnetz der Stadt: unterirdisches Sammelbecken aus Stahlbeton mit Pumpensumpf und zwei Tauchmotorpumpen. Das Abwasser kommt über eine Druckrohrleitung, die Pumpen fördern es über eine Druckleitung zur Kläranlage. Vor Ort sichtbar: Deckel, Schieberschacht, Schaltschrank, Lüftung.',
    rows: [['Bauwerk', 'Stahlbeton, rechteckig, unterirdisch, Baujahr 1987'], ['Pumpen', '2 Tauchmotorpumpen (Betrieb/Reserve)'], ['Unterlagen', 'Bauwerksdatenblatt und Skizze im PLS (Außenanlagen)']], walk: 'bahnhof' });

  // ---------------------------------------------------------------- Aufträge und Bewertung (Overlays in index.html)
  const MAENGEL = [
    ['saug', 'Ablagerungen auf der Sohle, Schwimmschlamm – Reinigung mit Saugspülfahrzeug', 'Kanalreinigung', () => { B.saug = 1800; lkw.visible = true; }, 0],
    ['leiter', 'Steigeisen korrodiert / fehlend – Erneuerung durch Edelstahl-Steigleiter mit Steigschutz', 'Schlosserei', () => { B.leiter = 'neu'; leiterNeu.visible = true; leiterAlt.visible = false; }, 3 * 3600],
    ['filter', 'Aktivkohlefilter erschöpft (Geruch) – Filterfüllung tauschen', 'Fachfirma Lüftung', () => { B.filter = 'neu'; }, 2 * 3600],
    ['schieber', 'Stopfbuchse Schieber P2 undicht – Packung erneuern', 'Eigene Werkstatt', () => { B.sLeck = false; }, 3600],
    ['beton', 'Betonkorrosion im Gasraum, Bewehrung freiliegend – Bauwerksuntersuchung durch Ingenieurbüro', 'Ingenieurbüro', () => { B.beton = 'gutachten'; }, 6 * 3600],
    ['vermessung', 'Bestandsaufnahme/Vermessung für Erweiterungsplanung', 'Vermessungsbüro', () => {}, 6 * 3600],
  ];
  function oeffneAuftrag() {
    const $ = (id) => document.getElementById(id);
    $('aufArt').innerHTML = MAENGEL.map(([k, t, f]) => `<option value="${k}">${t} (${f})</option>`).join('');
    $('aufText').value = ''; $('auf').style.display = 'flex';
  }
  function oeffneBewertung() { document.getElementById('bew').style.display = 'flex'; }
  function initOverlays(ui) {
    const $ = (id) => document.getElementById(id);
    ui.overlays.push('auf', 'bew');
    $('aufClose').onclick = () => { $('auf').style.display = 'none'; };
    $('aufOk').onclick = () => {
      const k = $('aufArt').value, m = MAENGEL.find((x) => x[0] === k), dr = $('aufDring').value, txt = $('aufText').value.trim();
      if (B.auftraege.some((a) => a.k === k && !a.fertig) || (k === 'saug' && B.saug > 0)) return ui.toast('Dieser Auftrag läuft bereits.');
      logA(`AUFTRAG APW-01 an ${m[2]}: ${m[1]} · Dringlichkeit: ${dr}${txt ? ' · ' + txt : ''}`, 'meldung');
      if (k === 'saug') { m[3](); ui.toast('Saugspülfahrzeug ist unterwegs – Reinigung läuft.'); }
      else { B.auftraege.push({ k, text: m[1], fertigT: B.t + m[4], fertig: false, wirkung: m[3] }); ui.toast(`Auftrag an ${m[2]} erteilt.`); }
      $('auf').style.display = 'none';
    };
    $('bewClose').onclick = () => { $('bew').style.display = 'none'; };
    $('bewOk').onclick = () => {
      const v = (id) => $(id).value.trim();
      logA(`BEWERTUNG Kapazität APW-01: V erforderlich ${v('bewVerf') || '–'} m³ · V vorhanden ${v('bewVvorh') || '–'} m³ · Empfehlung: ${$('bewVar').selectedOptions[0].text}${v('bewDh') ? ` (${v('bewDh')})` : ''} · Begründung: ${v('bewText') || '–'}`, 'meldung');
      ui.toast('Bewertung im Protokoll notiert.'); $('bew').style.display = 'none';
    };
  }

  let tLast = null;
  function update(dt, camPos) {
    const ts = sim.S.t; if (tLast === null) { tLast = ts; B.t = ts; }
    let d = Math.max(0, Math.min(600, ts - tLast)); tLast = ts;
    while (d > 0) { const k = Math.min(5, d); step(k); d -= k; }
    wasser.position.y = sohle + Math.max(B.h, BHF.sumpf - sohle + 0.02);
    wasser.scale.x = B.h < 0 ? 0.2 : 1; wasser.position.x = B.h < 0 ? (PS[0] + PS[1]) / 2 : xm; wasser.scale.z = B.h < 0 ? 0.6 : 1;
    schwimm.visible = B.schwimm && B.h > B.sed; schwimm.position.set(xm - 0.8, wasser.position.y + 0.01, zm);
    sed.scale.y = Math.max(0.05, B.sed / 0.36); sed.position.y = sohle + B.sed * 0.55;
    zopf.visible = B.zopf; treib.visible = B.treibgut; pfuetze.visible = B.sLeck;
    const zuY = BHF.zul - 0.3, fall = Math.max(0.05, zuY - wasser.position.y);
    strahl.visible = zuY > wasser.position.y + 0.05; strahl.scale.y = fall; strahl.position.set(x0 + 0.6, zuY - fall / 2, 70.5);
    if (lkw.visible && B.saug <= 0) lkw.visible = false;
    if (camPos) { const nah = Math.hypot(camPos.x + 246, camPos.z - 70) < 40; for (const id of ['bAuf', 'bBew']) { const e = document.getElementById(id); if (e) e.style.display = nah ? '' : 'none'; } }
  }
  deckelSetzen();
  // Blickpunkte in die Öffnungen (Kamera knapp unter der Decke, Handlampe)
  const PEEK = { ein: { p: [-250.4, -0.45, 72.3], yaw: 0.93, pitch: -0.55, n: 'Einstieg', inst: 'bh_ein' }, rev: { p: [-250.75, -0.35, 70.5], yaw: -Math.PI / 2, pitch: -0.62, n: 'Zulauf und Notüberlauf', inst: 'bh_rev' },
    zieh: { p: [-244.9, -0.45, 70.5], yaw: -Math.PI / 2, pitch: -1.3, n: 'Pumpensumpf', inst: 'bh_zieh' }, sch: { p: [-242.6, -0.25, 70.6], yaw: 0, pitch: -1.2, n: 'Schieberschacht', inst: 'bh_sch' } };
  // Neustart (Mission): Ausgangszustand mit 2 h Vorlauf für die Diagramme
  function reset() {
    Object.assign(B, B0()); tLast = sim.S.t; B.t = sim.S.t - 7200;
    for (let k = 0; k < 7200; k += 5) step(5);
    leiterNeu.visible = false; leiterAlt.visible = true; lkw.visible = false; deckelSetzen();
  }
  const lastH = () => ({ t: B.t, h: B.h, qz: zulauf() * 1000, np: B.p.filter((p) => p.run).length });
  return { update, reset, lastH, B, PEEK, initOverlays, oeffneAuftrag, oeffneBewertung, mess: (k) => insts[INST_D[k]] };
}
