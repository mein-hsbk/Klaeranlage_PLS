// Abwasserpumpwerk Talstraße (Außenpumpwerk an der Zufahrt, begehbar): zwei trocken aufgestellte
// KSB Sewatec E 100-317 mit Saug-/Druckschieber, Rückschlagklappe, Manometern, Vorlagebehälter der
// Tandem-Gleitringdichtung, Vor-Ort-Schaltkasten (Wahlschalter, Reparaturschalter) und Pumpensteuerung.
import * as THREE from 'three';
import { PP, LI, PEGEL_KARTE, abstich, schwimmerPruefen, schwimmerFrei, sondeZiehen, sondeBegutachten, sondeReinigen, sondeTauschen, kkOeffnen, kkSicht, kkMessen, aderAuflegen, kkTrocknen, tvMessen, tvTauschen, setNiveauModus, setMessbereich, ausbauen, setWahl, setRep, setSchloss, setSchieber, setAblass, quittieren, setAusPegel, setEinPegel, stopfenNachziehen, vorlageNachfuellen, messung, pumpeName } from './pumpwerk-modell.js';
import { sim, logA } from './anlage-sim.js';
import { f1, f0, noise, gauge, lcd, lamp, plate, senses, makeInstFactory, pipeFactory } from './instrumente.js';

export const PW_ORT = { x0: -205, x1: -139, z0: 52, z1: 80 };          // begehbare Fläche Zufahrt + Pumpwerk
export const PW_WAENDE = [[-140.3, 52, -139.7, 54.2], [-140.3, 65.8, -139.7, 80]]; // Zaun Westseite (Tor z 54…66)

const WAHL = { hand: 'HAND', '0': '0', auto: 'AUTO' };
const n2 = (x) => x.toFixed(2).replace('.', ',');

export function buildPumpwerk(scene, h, hooks = {}) {
  const { box, cyl, reg, M, std } = h;
  const toast = hooks.toast || (() => {});
  const makeInst = makeInstFactory(scene, M);
  const pipe = pipeFactory();
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };
  const ksb = std(0x24508f, { r: 0.45, m: 0.3 }), motorM = std(0x6f7f8c, { r: 0.5, m: 0.4 }), guss = std(0x3a3f44, { r: 0.6, m: 0.5 });
  const rohrM = std(0x5d6d7e, { r: 0.5, m: 0.5 }), rot = std(0xb03a2e, { r: 0.5, m: 0.3 }), gelb = std(0xe1b12c, { r: 0.5 });
  const cylX = (g, r, len, mat, xc, y, z, seg = 28) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(xc, y, z); m.castShadow = true; g.add(m); return m; };
  const anim = { kupplung: [], pfuetze: [], einschub: [] };
  const P = () => sim.P;

  const g = new THREE.Group();
  const X0 = -198, X1 = -182, Z0 = 66, Z1 = 75, HH = 4.2, T = 0.3, D0 = -188.2, D1 = -186;
  // ---------------------------------------------------------------- Gebäude
  {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), M.concreteDark); fl.rotation.x = -Math.PI / 2; fl.position.set((X0 + X1) / 2, 0.03, (Z0 + Z1) / 2); fl.receiveShadow = true; g.add(fl);
    box(g, X1 - X0, HH, T, M.brick, (X0 + X1) / 2, 0, Z1);
    box(g, T, HH, Z1 - Z0, M.brick, X0, 0, (Z0 + Z1) / 2); box(g, T, HH, Z1 - Z0, M.brick, X1, 0, (Z0 + Z1) / 2);
    box(g, D0 - X0, HH, T, M.brick, (X0 + D0) / 2, 0, Z0); box(g, X1 - D1, HH, T, M.brick, (D1 + X1) / 2, 0, Z0);
    box(g, D1 - D0, HH - 2.6, T, M.brick, (D0 + D1) / 2, 2.6, Z0);
    box(g, X1 - X0 + 0.6, 0.35, Z1 - Z0 + 0.6, M.roof, (X0 + X1) / 2, HH, (Z0 + Z1) / 2);
    noCol(box(g, 1.0, 2.5, 0.06, M.door, D0 - 0.55, 0, Z0 - 0.2, 0, false));                // Türflügel, nach außen aufgeschlagen
    for (const x of [-195, -184.5]) noCol(box(g, 1.6, 0.9, 0.08, M.window, x, 2.6, Z0 - 0.17, 0, false));
    const l1 = new THREE.PointLight(0xfff2d6, 16, 13, 1.6); l1.position.set(-193, 3.8, 70.5); g.add(l1);
    const l2 = new THREE.PointLight(0xfff2d6, 12, 13, 1.6); l2.position.set(-186, 3.8, 70.5); g.add(l2);
    // Zufahrt, Schild
    box(g, 4.4, 0.05, 3.2, M.asphalt, (D0 + D1) / 2, 0, 64.4, 0, false);
    // Pumpensumpf (Nassschacht) westlich, abgedeckt, mit Einstiegsluke
    box(g, 7, 0.55, Z1 - Z0, M.concrete, -201.5, 0, (Z0 + Z1) / 2);
    noCol(box(g, 1.2, 0.06, 1.2, M.grating, -201.5, 0.55, 68.2, 0, false));
    noCol(box(g, 0.06, 0.9, 0.06, M.galv, -200.5, 0.55, 67.42, 0, false));                     // Pfosten Klemmenkasten LI-001
    noCol(box(g, 0.32, 0.38, 0.14, std(0x95a5a6, { r: 0.6 }), -200.5, 0.95, 67.35, 0, false));
    noCol(box(g, 0.12, 0.08, 0.06, std(0x2c3e50), -201.9, 0.61, 67.62, 0, false));             // Kabelabfangung Pegelsonde
    pipe(g, [[-204.6, 0.2, 73.5], [-207, 0.2, 73.5], [-207, -0.4, 76]], 0.2, M.concreteDark); // Notüberlauf
  }

  // ---------------------------------------------------------------- Pumpenaggregate
  const ZP = [68.6, 72.4], SIDE = [1, -1], AX = 0.75;
  ZP.forEach((zc, i) => {
    const s = SIDE[i], za = zc + s * 0.12, ry = s > 0 ? 0 : Math.PI, nr = pumpeName(i), zr = zc - s * 0.2;
    // Fundament, Grundplatte
    box(g, 4.9, 0.12, 1.1, M.concrete, -193.6, 0, zc);
    box(g, 4.6, 0.13, 0.85, guss, -193.6, 0.12, zc);
    // Saugleitung aus dem Sumpf, Saugschieber, Konus
    cylX(g, 0.085, 2.4, rohrM, -197.2, AX, zc);
    box(g, 0.28, 0.42, 0.34, guss, -197.0, AX - 0.21, zc);
    cylX(g, 0.15, 0.04, guss, -197.17, AX, zc); cylX(g, 0.15, 0.04, guss, -196.83, AX, zc);
    noCol(box(g, 0.05, 0.6, 0.05, M.steel, -197.0, AX + 0.2, zc, 0, false));
    { const hw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 24), rot); hw.rotation.x = Math.PI / 2; hw.position.set(-197.0, AX + 0.82, zc); hw.userData.noCol = true; g.add(hw); }
    { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.45, 20), ksb); k.rotation.z = Math.PI / 2; k.position.set(-195.75, AX, zc); g.add(k); }
    // Spiralgehäuse mit Druckstutzen nach oben, Gehäusedeckel
    cylX(g, 0.43, 0.3, ksb, -195.38, AX, zc, 36);
    const gE = new THREE.Group(); g.add(gE); anim.einschub.push(gE);   // Einschubeinheit (Rückziehbauweise)
    cylX(gE, 0.37, 0.12, ksb, -195.17, AX, zc, 36);
    box(g, 0.3, 0.33, 0.6, ksb, -195.38, 0.25, zc);                                           // Gehäusefuß
    cyl(g, 0.075, 0.09, 0.45, ksb, -195.38, AX + 0.25, zr, 20);                               // Druckstutzen
    // Steigleitung: Rückschlagklappe RK, Druckschieber, Sammelleitung
    cyl(g, 0.15, 0.15, 0.04, guss, -195.38, AX + 0.7, zr);
    pipe(g, [[-195.38, AX + 0.72, zr], [-195.38, 2.62, zr]], 0.065, rohrM);
    box(g, 0.3, 0.3, 0.26, guss, -195.38, 1.42, zr);                                          // RK
    noCol(box(g, 0.08, 0.08, 0.3, M.steel, -195.38 + 0.2, 1.57, zr, 0, false));                // RK-Hebel
    noCol(box(g, 0.3, 0.42, 0.3, guss, -195.38, 1.8, zr, 0, false));                           // Druckschieber
    noCol(box(g, 0.05, 0.05, 0.42, M.steel, -195.38, 2.0, zr + s * 0.2, 0, false));
    { const hw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 24), rot); hw.position.set(-195.38, 2.0, zr + s * 0.42); hw.userData.noCol = true; g.add(hw); }
    // Dichtungsgehäuse (Tandem-GLRD), Lagerträger, Vorlagebehälter
    cylX(gE, 0.2, 0.25, ksb, -194.98, AX, zc);
    cylX(gE, 0.15, 0.95, ksb, -194.38, AX, zc);
    box(gE, 0.3, 0.5, 0.5, ksb, -194.2, 0.25, zc);
    noCol(box(gE, 0.04, 0.6, 0.04, M.steel, -194.75, AX, zc + s * 0.3, 0, false));            // Halter
    noCol(cyl(gE, 0.08, 0.08, 0.34, std(0xdfe6e9, { r: 0.2, m: 0.1, x: { transparent: true, opacity: 0.55 } }), -194.75, 1.18, zc + s * 0.3, 18));
    noCol(cyl(gE, 0.085, 0.085, 0.04, M.steel, -194.75, 1.52, zc + s * 0.3, 18));
    pipe(gE, [[-194.98, AX + 0.18, zc + s * 0.1], [-194.98, 1.0, zc + s * 0.3], [-194.8, 1.2, zc + s * 0.3]], 0.012, std(0x111111));
    pipe(gE, [[-194.92, AX + 0.18, zc + s * 0.14], [-194.7, 1.45, zc + s * 0.3]], 0.012, std(0x111111));
    // Kupplung mit Schutz, Motor
    const ku = new THREE.Group(); ku.position.set(-193.6, AX, zc); gE.add(ku);
    { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 20), guss); a.rotation.z = Math.PI / 2; ku.add(a);
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), gelb); mk.position.y = 0.11; ku.add(mk); noCol(ku); anim.kupplung.push(ku); }
    noCol(box(gE, 0.6, 0.42, 0.42, std(0xf1c40f, { r: 0.5, x: { transparent: true, opacity: 0.35, depthWrite: false } }), -193.6, AX - 0.21, zc, 0, false));
    box(gE, 0.6, 0.2, 0.42, std(0xf1c40f, { r: 0.5 }), -193.6, AX - 0.42, zc);
    cylX(g, 0.27, 1.25, motorM, -192.65, AX, zc);
    for (let k = 0; k < 8; k++) noCol(box(g, 1.1, 0.03, 0.6, motorM, -192.65, AX - 0.28 + k * 0.08, zc, 0, false));
    cylX(g, 0.25, 0.22, motorM, -191.9, AX, zc);
    box(g, 0.3, 0.2, 0.26, motorM, -192.7, AX + 0.27, zc);                                   // Klemmenkasten
    box(g, 1.0, 0.36, 0.6, motorM, -192.65, 0.25, zc);
    // Entleerung unter dem Spiralgehäuse
    noCol(box(g, 0.06, 0.06, 0.32, M.steel, -195.38, 0.36, zc + s * 0.3, 0, false));
    noCol(box(g, 0.14, 0.04, 0.03, rot, -195.38, 0.36, zc + s * 0.45, 0, false));
    // Pfütze (Leckage)
    const pf = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), std(0x4b4232, { r: 0.15, m: 0.1, x: { transparent: true, opacity: 0.8 } }));
    pf.position.set(-194.9, 0.045, zc + s * 0.55); pf.visible = false; pf.userData.noCol = true; g.add(pf); anim.pfuetze.push(pf);
    // Vor-Ort-Schaltkasten an Ständer östlich des Motors
    noCol(box(g, 0.08, 1.2, 0.08, M.steel, -190.75, 0, zc, 0, false));
    box(g, 0.22, 0.6, 0.5, std(0xd5d8db, { r: 0.6, m: 0.2 }), -190.75, 1.1, zc);

    // ---------------- Instrumente und Bedienstellen
    makeInst(`pw_p${i}`, { name: `Kreiselpumpe ${nr} (KSB Sewatec E 100-317, Laufrad ø 286 mm, 15 kW, 1450 1/min)`, tag: nr,
      pos: [-195.38, AX + 0.05, zc + s * 0.44], rotY: ry, size: 0.34, aspect: 0.4, res: 128,
      info: 'Trocken aufgestellte Abwasser-Kreiselpumpe mit Spiralgehäuse und Freistrom-/Kanalrad. Welle in fettgeschmierten Wälzlagern im Lagerträger; Abdichtung durch zwei Gleitringdichtungen in Tandemanordnung mit Vorlagebehälter (Sperr-/Quenchflüssigkeit). Antrieb über elastische Kupplung.',
      draw: plate(nr, '#dfe6e9'),
      detail: (ctx, W, Hc) => {
        const x = P().p[i], u = i === 0 ? P().ursache : null, l = [];
        if (x.ausgebaut) { senses(ctx, W, Hc, `Pumpe ${nr}`, ['Einschubeinheit ausgebaut (Werkstatt).', 'Nur das Spiralgehäuse ist noch eingebaut,', 'Öffnung mit Blinddeckel abgedeckt.'], false); return; }
        if (x.run) {
          l.push(x.kav ? 'Läuft, prasselndes Geräusch am Saugstutzen.' : x.luft ? 'Läuft, schlürfend und unruhig.' : u === 'lager' ? 'Läuft, mahlendes Geräusch am Lagerträger.' : u === 'fremd' ? 'Läuft, spürbares Klopfen im Takt der Drehzahl.' : u === 'kupplung' ? 'Läuft, Klappern an der Kupplung.' : 'Läuft gleichmäßig.');
          l.push(x.v > 4.5 ? 'Deutliche Vibration an Grundplatte und Rohrleitung.' : 'Kaum Vibration spürbar.');
          l.push(x.tl > 70 ? 'Lagerträger sehr heiß (Hand nicht auflegbar).' : 'Lagerträger handwarm.');
        } else l.push('Steht. Kein Geräusch, Gehäuse handwarm bis kalt.');
        if (x.leck > 0) l.push('Unter der Pumpe hat sich eine Pfütze gebildet.');
        l.push(`Wahlschalter ${WAHL[x.wahl]}, Reparaturschalter ${x.rep ? 'EIN' : '0'}`);
        senses(ctx, W, Hc, `Pumpe ${nr}`, l, x.run);
      },
      actions: () => i === 0 && P().p[0].ausgebaut ? [{ label: 'Werkstatt öffnen (Einschubeinheit P-001)', fn: () => hooks.werkstatt && hooks.werkstatt() }] : [
        ...(i === 0 ? [{ label: 'Einschubeinheit ausbauen → Werkstatt', fn: () => { const m = ausbauen(P(), logA); if (m) toast(m); else hooks.werkstatt && hooks.werkstatt(); } }] : []),
        { label: 'Abhören (Stethoskop)', fn: () => toast(messung(P(), i, 'hoeren', logA)) },
        { label: 'Lagertemperatur messen', fn: () => toast(messung(P(), i, 'temp', logA)) },
        { label: 'Schwingung messen (Lagerträger)', fn: () => toast(messung(P(), i, 'schw', logA)) },
        { label: 'Sichtprüfung Pumpe, Dichtung, Kupplung', fn: () => toast(messung(P(), i, 'sicht', logA)) },
      ] });
    makeInst(`pw_ps${i}`, { name: `Manometer Saugseite ${nr} (Manovakuummeter)`, tag: `PI 00${i + 1}.1`, pos: [-196.35, AX + 0.3, za], rotY: ry, size: 0.2, round: true,
      info: 'Druck im Saugstutzen. Bei normalem Zulauf leicht positiv (Zulaufhöhe minus Verluste). Unterdruck zeigt hohe Saugverluste an, z. B. gedrosselter Saugschieber oder verstopfte Saugleitung.',
      draw: (ctx, W) => gauge(ctx, W, { min: -1, max: 1.5, ticks: 5, unit: 'bar', tag: `PI 00${i + 1}.1`, val: P().p[i].ps + (P().p[i].run ? noise(0.01, 3 + i) + (P().p[i].kav ? noise(0.06, 5) : 0) : 0), red: [-1, -0.6] }) });
    makeInst(`pw_pd${i}`, { name: `Manometer Druckseite ${nr}`, tag: `PI 00${i + 1}.2`, pos: [-195.38, 1.18, zr + s * 0.1], rotY: ry, size: 0.22, round: true,
      info: 'Druck am Druckstutzen vor der Rückschlagklappe. Differenz Druck- minus Saugseite × 10,2 ergibt die Förderhöhe in m, die mit der Kennlinie verglichen werden kann.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 4, ticks: 4, unit: 'bar', tag: `PI 00${i + 1}.2`, val: P().p[i].pd + (P().p[i].run ? noise(0.02, 7 + i) + (P().p[i].luft ? noise(0.12, 2) : 0) : 0) }) });
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
    ventil(`pw_vs${i}`, 's', `V-00${i + 1}.1`, `Saugschieber ${nr}`, [-197.0, AX + 0.32, zc + s * 0.18],
      'Absperrschieber in der Saugleitung. Im Betrieb immer ganz offen – Drosseln auf der Saugseite führt zu Unterdruck und Kavitation. Wird zum Freischalten der Pumpe nach dem Druckschieber geschlossen.');
    ventil(`pw_vd${i}`, 'd', `V-00${i + 1}.2`, `Druckschieber ${nr}`, [-195.38, 2.25, zr + s * 0.17],
      'Absperrschieber in der Druckleitung oberhalb der Rückschlagklappe RK-00x. Im Betrieb ganz offen. Zum Freischalten zuerst schließen: Er hält den Druck der Druckleitung von der Pumpe fern.');
    makeInst(`pw_ab${i}`, { name: `Entleerung Spiralgehäuse ${nr}`, tag: `V-00${i + 1}.3`, pos: [-195.38, 0.52, zc + s * 0.47], rotY: ry, size: 0.16, aspect: 0.6, res: 128,
      info: 'Entleerungshahn am tiefsten Punkt des Spiralgehäuses. Erst öffnen, wenn Saug- und Druckschieber geschlossen sind – sonst läuft Abwasser aus Sumpf bzw. Druckleitung in den Pumpenraum.',
      draw: (ctx, W, Hc) => { const a = P().p[i].ablass; ctx.fillStyle = a ? '#ffeaa7' : '#ecf0f1'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.15}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`V-00${i + 1}.3`, W / 2, Hc * 0.3); ctx.font = `${W * 0.14}px Arial`; ctx.fillText(a ? 'offen' : 'zu', W / 2, Hc * 0.72); },
      actions: () => [{ typ: 'wahl', label: 'Entleerungshahn', wert: P().p[i].ablass ? 'auf' : 'zu', optionen: [['zu', 'ZU'], ['auf', 'AUF']], fn: (v) => setAblass(P(), i, v === 'auf', logA) }] });
    makeInst(`pw_vb${i}`, { name: `Vorlagebehälter Gleitringdichtung ${nr}`, tag: `LG 00${i + 1}`, pos: [-194.75, 1.2, zc + s * 0.4], rotY: ry, size: 0.14, aspect: 1.8, res: 128,
      info: 'Vorlagebehälter der Tandem-Gleitringdichtung, gefüllt mit Sperr-/Quenchflüssigkeit (Wasser-Glykol). Er schmiert und kühlt die atmosphärenseitige Dichtung. Steigt der Stand und wird die Flüssigkeit trüb, dringt Abwasser über die produktseitige Dichtung ein. Fällt der Stand, geht Flüssigkeit nach außen verloren.',
      draw: (ctx, W, Hc) => {
        const x = P().p[i]; ctx.fillStyle = '#7f8c8d'; ctx.fillRect(0, 0, W, Hc);
        const x0 = W * 0.25, w = W * 0.5, y0 = Hc * 0.08, hh = Hc * 0.84; ctx.fillStyle = '#ecf0f1'; ctx.fillRect(x0, y0, w, hh);
        const lv = hh * x.vorlage / 100; ctx.fillStyle = x.trueb > 0.3 ? `rgb(${140 - x.trueb * 40},${120 - x.trueb * 50},${90 - x.trueb * 40})` : '#74b9ff'; ctx.fillRect(x0, y0 + hh - lv, w, lv);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; for (const m of [0.4, 0.75]) { ctx.beginPath(); ctx.moveTo(x0 - W * 0.12, y0 + hh * (1 - m)); ctx.lineTo(x0 + w + W * 0.12, y0 + hh * (1 - m)); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.13}px Arial`; ctx.textAlign = 'left'; ctx.fillText('MAX', 2, y0 + hh * 0.25 - 4); ctx.fillText('MIN', 2, y0 + hh * 0.6 + 16);
      },
      detail: (ctx, W, Hc) => {
        const x = P().p[i]; ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
        const x0 = W * 0.08, w = W * 0.18, y0 = Hc * 0.08, hh = Hc * 0.84; ctx.fillStyle = '#ecf0f1'; ctx.fillRect(x0, y0, w, hh);
        const lv = hh * x.vorlage / 100; ctx.fillStyle = x.trueb > 0.3 ? `rgb(${140 - x.trueb * 40},${120 - x.trueb * 50},${90 - x.trueb * 40})` : '#74b9ff'; ctx.fillRect(x0, y0 + hh - lv, w, lv);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; for (const m of [0.4, 0.75]) { ctx.beginPath(); ctx.moveTo(x0 - 8, y0 + hh * (1 - m)); ctx.lineTo(x0 + w + 8, y0 + hh * (1 - m)); ctx.stroke(); }
        ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.045}px Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const st = x.vorlage > 75 ? 'über MAX' : x.vorlage < 40 ? 'unter MIN' : 'zwischen MIN und MAX';
        [`Schauglas Vorlagebehälter ${nr}`, `Füllstand: ${st}`, `Flüssigkeit: ${x.trueb > 0.3 ? 'trüb, grau-bräunlich' : 'klar, bläulich'}`, '', 'Sollzustand laut Betriebsanweisung:', 'Stand zwischen MIN und MAX, klar.', x.stopfenFest ? 'Verschraubung nachgezogen.' : ''].forEach((t, k) => ctx.fillText(t, W * 0.33, Hc * (0.1 + k * 0.1)));
      },
      actions: () => [
        { label: 'Verschraubung nachziehen', fn: () => toast(stopfenNachziehen(P(), i, logA)) },
        { label: 'Vorlageflüssigkeit nachfüllen', fn: () => toast(vorlageNachfuellen(P(), i, logA)) },
      ] });
    makeInst(`pw_sk${i}`, { name: `Vor-Ort-Schaltkasten ${nr}`, tag: `=+SK ${nr}`, pos: [-190.63, 1.4, zc], rotY: Math.PI / 2, size: 0.46, aspect: 1.0,
      info: 'Vor-Ort-Bedienung: Wahlschalter HAND/0/AUTO (AUTO = Pumpensteuerung nach Pegel, HAND = Dauerbetrieb ohne Pegelschutz) und abschließbarer Reparaturschalter (Lasttrennschalter) zum sicheren Freischalten. Der Reparaturschalter darf nicht als Betriebsschalter unter Last benutzt werden.',
      draw: (ctx, W, Hc) => {
        const x = P().p[i];
        lcd(ctx, W, Hc, `=+SK ${nr}`, [`Wahlschalter ${WAHL[x.wahl]}`, `Reparatursch. ${x.rep ? 'EIN' : '0'}${x.schloss ? ' 🔒' : ''}`, `Strom ${f1(x.amp)} A`, x.stoer ? { t: x.stoer, c: '#ff7675' } : `Bh ${f0(x.bh)} h`], { lcdH: 0.52, fs: 0.075 });
        lamp(ctx, W * 0.25, Hc * 0.82, W * 0.05, '#00b894', x.run, 'Betrieb', W);
        lamp(ctx, W * 0.5, Hc * 0.82, W * 0.05, '#d63031', !!x.stoer, 'Störung', W);
        lamp(ctx, W * 0.75, Hc * 0.82, W * 0.05, '#f1c40f', !x.rep, 'Rep.-Sch.', W);
      },
      actions: () => {
        const x = P().p[i];
        return [
          { typ: 'wahl', label: 'Wahlschalter', wert: x.wahl, optionen: [['hand', 'HAND'], ['0', '0'], ['auto', 'AUTO']], fn: (v) => setWahl(P(), i, v, logA) },
          { typ: 'wahl', label: 'Reparaturschalter', wert: x.rep ? 'ein' : 'aus', optionen: [['ein', 'EIN'], ['aus', '0']], fn: (v) => { const m = setRep(P(), i, v === 'ein', logA); if (m) toast(m); } },
          { label: x.schloss ? 'Vorhängeschloss entfernen' : 'Vorhängeschloss anbringen (gegen Wiedereinschalten sichern)', fn: () => { const m = setSchloss(P(), i, !x.schloss, logA); if (m) toast(m); } },
          { label: 'Störung quittieren', fn: () => toast(quittieren(P(), i, logA)) },
          { label: 'Wirksamkeit der Freischaltung prüfen (Einschaltversuch)', fn: () => {
            if (x.rep) { logA(`${nr} Einschaltversuch bei Reparaturschalter EIN – nicht freigeschaltet`); toast('Der Reparaturschalter steht auf EIN – die Pumpe ist nicht freigeschaltet!'); return; }
            logA(`${nr} Einschaltversuch (Wahlschalter HAND): Pumpe läuft nicht an – Freischaltung wirksam`, 'messung'); toast('Pumpe läuft nicht an – die Freischaltung ist wirksam. Wahlschalter zurück auf 0.');
          } },
        ];
      } });
  });

  // Sammelleitung → Druckleitung zur Kläranlage
  pipe(g, [[-195.38, 2.62, 68.4], [-195.38, 2.62, 72.6]], 0.08, rohrM);
  pipe(g, [[-195.38, 2.62, 70.5], [-181.4, 2.62, 70.5], [-181.4, 0.4, 70.5]], 0.09, rohrM);
  noCol(box(g, 0.36, 0.36, 0.36, std(0x2f6fa8, { r: 0.5, m: 0.3 }), -184.2, 2.44, 70.5, 0, false));     // MID FI-001
  makeInst('pw_fi', { name: 'Magnetisch-induktive Durchflussmessung Druckleitung', tag: 'FI-001', pos: [-184.2, 2.0, 70.69], size: 0.34, aspect: 0.55,
    info: 'MID in der gemeinsamen Druckleitung zur Kläranlage: Förderstrom der laufenden Pumpe(n). Sollwert für eine Pumpe laut Betriebsanweisung ≥ 100 m³/h.',
    draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'FI-001', [`${f0(Math.max(0, P().q + (P().q > 1 ? noise(1.2, 4) : 0)))} m³/h`], { lcdH: 0.55, fs: 0.15 }) });
  makeInst('pw_fi_b', { name: 'Durchflussmessung (Rückseite)', tag: 'FI-001', pos: [-184.2, 2.0, 70.31], rotY: Math.PI, size: 0.34, aspect: 0.55, info: 'Anzeige des MID in der Druckleitung.',
    draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'FI-001', [`${f0(Math.max(0, P().q))} m³/h`], { lcdH: 0.55, fs: 0.15 }) });

  // Pumpensteuerung (Schrank an der Ostwand)
  box(g, 0.5, 2.0, 1.4, std(0xd5d8db, { r: 0.6, m: 0.2 }), -182.4, 0, 72.8);
  makeInst('pw_st', { name: 'Pumpensteuerung PW Talstraße', tag: 'PW-Steuerung', pos: [-182.66, 1.45, 72.8], rotY: -Math.PI / 2, size: 0.95, aspect: 0.9,
    info: 'Niveausteuerung der Pumpen nach dem Pegel im Pumpensumpf (LI-001): Führungspumpe P-001 ein bei Einschaltpegel, aus bei Ausschaltpegel. P-002 übernimmt, wenn P-001 nicht in AUTO oder gestört ist, und läuft bei Pegel > 2,30 m zusätzlich. Ab 2,80 m springt der Notüberlauf an.',
    draw: (ctx, W, Hc) => {
      const pw = P(), z = (i) => { const x = pw.p[i]; return `${pumpeName(i)} ${WAHL[x.wahl].padEnd(4)} ${x.stoer ? 'STÖRUNG' : !x.rep ? 'Rep.-Sch.0' : x.run ? `Betrieb ${f0(x.amp)} A` : 'bereit'}`; };
      const L = pw.lm, la = L.valid ? `${n2(L.liAnz)} m` : '---- (gestört)';
      lcd(ctx, W, Hc, 'Pumpensteuerung PW Talstraße', [`LI-001 Pegel   ${la}`, `FI-001        ${f0(pw.q)} m³/h`, `Ein ${n2(pw.liEin)} m  Aus ${n2(pw.liAus)} m`, z(0), z(1), `Zulauf ca.    ${f0(pw.qIn)} m³/h`], { lcdH: 0.62, fs: 0.058 });
      lamp(ctx, W * 0.2, Hc * 0.87, W * 0.035, '#d63031', pw.p.some((x) => x.stoer), 'Störung', W);
      lamp(ctx, W * 0.45, Hc * 0.87, W * 0.035, '#f1c40f', (L.valid && L.liAnz > 2.4) || L.s3, 'Pegel hoch', W);
      lamp(ctx, W * 0.72, Hc * 0.87, W * 0.035, '#d63031', pw.qUeb > 0, 'Notüberlauf', W);
    },
    detail: (ctx, W, Hc) => {
      const pw = P(); ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
      ctx.fillStyle = '#0d2310'; ctx.fillRect(W * 0.03, Hc * 0.03, W * 0.94, Hc * 0.42);
      ctx.fillStyle = '#7CFC9a'; ctx.font = `${W * 0.031}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const z = (i) => { const x = pw.p[i]; return `${pumpeName(i)} ${WAHL[x.wahl].padEnd(4)} ${(x.stoer ? 'STÖRUNG' : !x.rep ? 'Rep.-Sch.0' : x.run ? 'Betrieb' : 'bereit').padEnd(10)}${f1(x.amp).padStart(5)} A Bh ${f0(x.bh)} St ${x.starts}`; };
      [`LI-001 Pegel ${pw.lm.valid ? n2(pw.lm.liAnz) + ' m' : '---- '}  FI-001 ${f0(pw.q)} m³/h`, `Ein ${n2(pw.liEin)} m  Aus ${n2(pw.liAus)} m  ${pw.lm.modus === 'sonde' ? 'Sondenbetrieb' : 'NOTBETRIEB Schwimmer'}`, `LI-001 0–${n2(pw.lm.mbPar)} m (4–20 mA), Einbau +0,10 m  S1 ${pw.lm.s1 ? '●' : '○'} S2 ${pw.lm.s2 ? '●' : '○'} S3 ${pw.lm.s3 ? '●' : '○'}`, z(0), z(1), `Notüberlauf seit Start ${f0(pw.vUeb)} m³`].forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.06 + k * 0.075)));
      ctx.fillStyle = '#ffeaa7'; ctx.font = `bold ${W * 0.034}px Arial`; ctx.fillText('Störungsspeicher', W * 0.05, Hc * 0.49);
      ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.029}px Arial`;
      const al = Object.values(pw.alarme).filter((a) => a.klasse !== 'M').sort((a, b) => b.kommt - a.kommt).slice(0, 4).map((a) => `${a.aktiv ? '● ' : '○ '}${a.text.replace('PW Talstr.: ', '')}`);
      [...al, ...pw.historie].slice(0, 6).forEach((t, k) => ctx.fillText(t, W * 0.05, Hc * (0.56 + k * 0.058)));
      ctx.fillStyle = '#81ecec'; ctx.font = `${W * 0.028}px Arial`; ctx.fillText('Betriebsanweisung: Ein 1,60 m · Aus 0,80 m (Saugrohr-Überdeckung)', W * 0.05, Hc * 0.9); ctx.fillText('Förderstrom je Pumpe ≥ 100 m³/h', W * 0.05, Hc * 0.945);
    },
    actions: () => [
      { typ: 'zahl', label: 'Einschaltpegel', wert: +P().liEin.toFixed(2), min: 1.0, max: 2.4, einheit: 'm', fn: (v) => setEinPegel(P(), v, logA) },
      { typ: 'zahl', label: 'Ausschaltpegel', wert: +P().liAus.toFixed(2), min: 0.2, max: 1.4, einheit: 'm', fn: (v) => setAusPegel(P(), v, logA) },
      { typ: 'titel', label: 'Niveaumessung LI-001' },
      { typ: 'wahl', label: 'Niveausteuerung', wert: P().lm.modus, optionen: [['sonde', 'Sonde LI-001'], ['schwimmer', 'Schwimmer-Notbetrieb']], fn: (v) => { const m = setNiveauModus(P(), v, logA); if (m) toast(m); } },
      { typ: 'zahl', label: 'Messbereichsendwert LI-001 (Anfang 0 m ≙ 4 mA)', wert: +P().lm.mbPar.toFixed(2), min: 1, max: 10, einheit: 'm', fn: (v) => setMessbereich(P(), v, logA) },
      ...(hooks.messprotokoll ? [{ label: 'Messprotokoll LI-001 ausfüllen', fn: () => setTimeout(hooks.messprotokoll, 0) }] : []),
    ] });
  makeInst('pw_tv', { name: 'Trennverstärker LI-001 (Hutschiene im Schaltschrank)', tag: 'Trennverstärker LI-001', pos: [-182.66, 0.72, 72.25], rotY: -Math.PI / 2, size: 0.2, aspect: 0.8, res: 128,
    info: 'Galvanische Trennung des 4–20-mA-Signals zwischen Feld (Pegelsonde, Speisung 24 V) und Analogeingang der Steuerung. Messbuchsen für Eingang und Ausgang an der Front – Strom messen ohne den Kreis aufzutrennen. Ersatzgerät liegt im Schrank.',
    draw: (ctx, W, Hc) => { ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#2d3436'; ctx.fillRect(W * 0.3, Hc * 0.08, W * 0.4, Hc * 0.84); ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.09}px Arial`; ctx.textAlign = 'center'; ctx.fillText('LI-001', W / 2, Hc * 0.3); lamp(ctx, W * 0.5, Hc * 0.62, W * 0.05, '#00b894', true, '', W); },
    actions: () => [
      { label: 'Strom am Eingang messen (Feldseite)', fn: () => toast(tvMessen(P(), 'ein', logA)) },
      { label: 'Strom am Ausgang messen (zur Steuerung)', fn: () => toast(tvMessen(P(), 'aus', logA)) },
      { label: 'Trennverstärker gegen Ersatzgerät tauschen', fn: () => toast(tvTauschen(P(), logA)) },
    ] });

  // Pumpensumpf: Blick durch die Einstiegsluke
  noCol(box(g, 0.06, 1.1, 0.06, M.galv, -201.5, 0.55, 67.35, 0, false));
  makeInst('pw_sumpf', { name: 'Pumpensumpf (Blick durch die Einstiegsluke)', tag: 'Pumpensumpf', pos: [-201.5, 1.55, 67.3], rotY: Math.PI, size: 0.4, aspect: 0.5, res: 128,
    info: 'Nassschacht mit Zulauf aus dem Kanalnetz und den Saugrohren der beiden Pumpen. Fällt der Wasserstand zu tief über den Saugrohren, bilden sich Hohlwirbel, die Luft in die Pumpe ziehen.',
    draw: plate('Pumpensumpf', '#f6e58d'),
    detail: (ctx, W, Hc) => {
      const pw = P(), run = pw.p.some((x) => x.run), luft = pw.p.some((x) => x.luft);
      senses(ctx, W, Hc, 'Pumpensumpf', [`Wasserstand ca. ${f1(pw.li)} m über der Sohle${pw.li > 2.4 ? ' – sehr hoch!' : ''}.`,
        `Zulauf aus dem Kanal: ${pw.qIn > 75 ? 'kräftig' : 'mäßig'}, Abwasser grau, Schwimmstoffe.`,
        run ? (luft ? 'Über dem Saugrohr dreht sich ein Luftwirbel (Hohlwirbel), schlürfendes Geräusch.' : 'Wasseroberfläche über den Saugrohren ruhig.') : 'Pumpen stehen, Wasserspiegel steigt.',
        pw.qUeb > 0 ? 'Wasser läuft über die Notüberlaufschwelle!' : 'Notüberlaufschwelle trocken.', `Schild am Rahmen: OK Lukenrahmen = ${n2(LI.BEZUG)} m über Sumpfsohle.`, 'Drei Schwimmerschalter und das Kabel der Pegelsonde hängen an der Abfangung.'], run);
    },
    actions: () => [
      { label: 'Abstich messen (Lichtlot ab OK Lukenrahmen)', fn: () => toast(abstich(P(), logA)) },
      { typ: 'titel', label: 'Schwimmerschalter' },
      { label: 'S1 Trockenlauf (0,45 m) prüfen', fn: () => toast(schwimmerPruefen(P(), 1, logA)) },
      { label: 'S2 Notbetrieb EIN (2,00 m) prüfen', fn: () => toast(schwimmerPruefen(P(), 2, logA)) },
      { label: 'S3 Hochwasser (2,50 m) prüfen', fn: () => toast(schwimmerPruefen(P(), 3, logA)) },
      { label: 'Verhakten Schwimmer freimachen', fn: () => toast(schwimmerFrei(P(), logA)) },
    ] });
  makeInst('pw_kk', { name: 'Klemmenkasten LI-001 am Pumpensumpf', tag: 'Klemmenkasten LI-001', pos: [-200.5, 1.14, 67.27], rotY: Math.PI, size: 0.3, aspect: 1.15, res: 128,
    info: 'Übergang vom Sondenkabel (mit Druckausgleichskapillare) auf das Feldkabel zum Schaltschrank. Trennklemmen mit Prüfbuchse: Schleifenstrom messen ohne Auftrennen. Kleinspannung 24 V DC.',
    draw: (ctx, W, Hc) => { const L = P().lm; ctx.fillStyle = L.kkOffen ? '#636e72' : '#b2bec3'; ctx.fillRect(0, 0, W, Hc); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.13}px Arial`; ctx.textAlign = 'center'; ctx.fillText('LI-001', W / 2, Hc * 0.3); ctx.font = `${W * 0.1}px Arial`; ctx.fillText(L.kkOffen ? 'offen' : '24 V DC', W / 2, Hc * 0.55); },
    detail: (ctx, W, Hc) => { const L = P().lm; senses(ctx, W, Hc, 'Klemmenkasten LI-001', L.kkOffen ? ['Klemmleiste X1: 1 (+) / 2 (–) Sonde, 3 / 4 Feldkabel, Trennklemmen mit Prüfbuchse.', 'Kabelfahne Sonde: hydrostatisch 0–0,5 bar rel. ≙ 0–5 mWS,', '4–20 mA Zweileiter, Einbau 0,10 m über Sohle.'] : ['Gehäuse geschlossen, vier Schrauben.', 'Prüfbuchse der Trennklemme von außen zugänglich.'], true); },
    actions: () => { const L = P().lm; return [
      { label: L.kkOffen ? 'Klemmenkasten schließen' : 'Klemmenkasten öffnen', fn: () => kkOeffnen(P(), !L.kkOffen, logA) },
      { label: 'Sichtprüfung innen', fn: () => toast(kkSicht(P(), logA)) },
      { typ: 'titel', label: 'Messen' },
      { label: 'Schleifenstrom an der Prüfbuchse messen', fn: () => toast(kkMessen(P(), 'loop', logA)) },
      { label: 'Strom in der Sondenader messen (Multimeter in Reihe)', fn: () => toast(kkMessen(P(), 'sonde', logA)) },
      { label: 'Spannung an den Sondenklemmen messen', fn: () => toast(kkMessen(P(), 'u', logA)) },
      { typ: 'titel', label: 'Instandsetzen' },
      { label: 'Ader neu auflegen (abisolieren, Aderendhülse)', fn: () => toast(aderAuflegen(P(), logA)) },
      { label: 'Trocknen, Dichtung und Kabelverschraubung erneuern', fn: () => toast(kkTrocknen(P(), logA)) },
    ]; } });
  makeInst('pw_lis', { name: 'Pegelsonde LI-001 (Kabelabfangung an der Luke)', tag: 'Pegelsonde LI-001', pos: [-201.9, 0.78, 67.58], rotY: Math.PI, size: 0.16, aspect: 0.7, res: 128,
    info: 'Hydrostatische Pegelsonde: misst den Wasserdruck über der Membran (1 m Wassersäule ≈ 0,1 bar). Das Kabel enthält eine Kapillare zum Ausgleich des Luftdrucks. Einbauhöhe über Sohle durch eine Markierung am Kabel an der Halteklemme festgelegt.',
    draw: plate('LI-001', '#d6e4f0'),
    actions: () => { const L = P().lm; return [
      { label: L.sondeOut ? 'Sonde einhängen (Markierung an die Halteklemme)' : 'Sonde ziehen', fn: () => sondeZiehen(P(), !L.sondeOut, logA) },
      { label: 'Sonde und Kabel begutachten', fn: () => toast(sondeBegutachten(P(), logA)) },
      { label: 'Sonde reinigen', fn: () => toast(sondeReinigen(P(), logA)) },
      { label: 'Gegen Ersatzsonde aus dem Lager tauschen', fn: () => toast(sondeTauschen(P(), logA)) },
    ]; } });

  reg('talstr', g, { name: 'Abwasserpumpwerk Talstraße', kks: 'P-001 / P-002 · LI-001 · FI-001',
    text: 'Außenpumpwerk im Kanalnetz: Hebt das Abwasser des Ortsteils Talstraße über eine Druckleitung zur Kläranlage. Zwei baugleiche, trocken aufgestellte Kreiselpumpen (eine in Betrieb, eine in Reserve) im Pumpenraum neben dem Pumpensumpf.',
    rows: [['Pumpen', '2 × KSB Sewatec E 100-317, ø 286 mm, 1450 1/min, 15 kW'], ['Auslegung', '≈ 85 m³/h bei 26 m; im Betrieb ≈ 105–110 m³/h'], ['Wellendichtung', 'Tandem-Gleitringdichtung mit Vorlagebehälter'], ['Lagerung', 'Wälzlager, fettgeschmiert'], ['Steuerung', 'Niveau LI-001: Ein 1,60 m / Aus 0,80 m']], walk: 'talstr' });

  function update(dt) {
    const pw = P();
    anim.kupplung.forEach((k, i) => { if (pw.p[i].run) k.rotation.x += dt * 25; });
    anim.einschub.forEach((e, i) => { e.visible = !pw.p[i].ausgebaut; });
    anim.pfuetze.forEach((pf, i) => { const v = pw.p[i].puddle + (i === 0 ? Math.min(3, pw.flut / 3) : 0); pf.visible = v > 0.05; const r = Math.min(1.5, 0.25 + Math.sqrt(v) * 0.5); pf.scale.set(r, 1, r * 0.8); });
  }
  return { update };
}
