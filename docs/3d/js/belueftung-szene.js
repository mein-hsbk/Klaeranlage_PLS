// Belüftung im Detail: Gebläsestation (begehbar) mit G1.1/G1.2, FU-Schrank und Vor-Ort-Messungen,
// Luftverteilung mit Regelklappen FV 301 / FV 311, Sondenausleger QI 301 (Straße 1) / QI 311 (Straße 2).
import * as THREE from 'three';
import { PB, STR, GEB, MODI, sondeZiehen, sondeReinigen, sondeKalibrieren, handmessung, gebMode, gebHz, fvOrt, fvPos } from './belueftung-modell.js';
import { sim, logA } from './anlage-sim.js';
import { f1, f0, noise, gauge, lcd, lamp, plate, senses, makeInstFactory, pipeFactory } from './instrumente.js';

export function buildBelueftung(scene, h, hooks = {}) {
  const { box, cyl, reg, M, std } = h;
  const toast = hooks.toast || (() => {});
  const makeInst = makeInstFactory(scene, M);
  const pipe = pipeFactory();
  const noCol = (o) => { o.traverse((m) => { m.userData.noCol = true; }); return o; };
  const anim = { probes: [] };
  const luftM = std(0x9aa3ab, { r: 0.4, m: 0.6 });

  // ================================================================ Gebläsestation (begehbar, Tür Süd)
  {
    const g = new THREE.Group(), x0 = 20, x1 = 36, z0 = -8.5, z1 = 0.5, hh = 5, t = 0.3, d0 = 22.5, d1 = 25.5;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.concreteDark); fl.rotation.x = -Math.PI / 2; fl.position.set(28, 0.02, -4); fl.receiveShadow = true; g.add(fl);
    box(g, x1 - x0, hh, t, M.sheet, 28, 0, z0);
    box(g, t, hh, z1 - z0, M.sheet, x0, 0, -4); box(g, t, hh, z1 - z0, M.sheet, x1, 0, -4);
    box(g, d0 - x0, hh, t, M.sheet, (x0 + d0) / 2, 0, z1); box(g, x1 - d1, hh, t, M.sheet, (d1 + x1) / 2, 0, z1);
    box(g, d1 - d0, hh - 3.2, t, M.sheet, (d0 + d1) / 2, 3.2, z1);
    box(g, x1 - x0 + 0.3, 0.45, z1 - z0 + 0.3, M.roof, 28, hh, -4);
    for (let x = 22; x <= 34; x += 3) noCol(box(g, 2.2, 1.2, 0.1, M.steelDark, x, 3.2, -8.7, 0, false));   // Zuluftjalousien
    noCol(box(g, 1.2, 2.2, 0.08, M.door, 32, 0, 0.7, 0, false));
    const l1 = new THREE.PointLight(0xfff2d6, 18, 14, 1.6); l1.position.set(25, 4.4, -4); g.add(l1);
    const l2 = new THREE.PointLight(0xfff2d6, 14, 14, 1.6); l2.position.set(31, 4.4, -4); g.add(l2);

    // Gebläseaggregate in Schallhauben
    const aggregat = (x, id, nr, gi) => {
      box(g, 2.8, 0.15, 2.2, M.steelDark, x, 0, -4.5);
      box(g, 2.6, 1.8, 2.0, std(0x3e6d8e, { r: 0.6, m: 0.2 }), x, 0.15, -4.5);
      for (let k = 0; k < 4; k++) noCol(box(g, 0.5, 0.06, 0.02, M.steelDark, x - 0.9 + k * 0.6, 1.4, -3.49, 0, false));       // Lüftungsschlitze
      noCol(box(g, 0.8, 0.5, 0.8, M.steelDark, x - 0.6, 1.95, -4.1, 0, false));                                             // Ansaugfilter
      pipe(g, [[x + 0.4, 1.2, -5.5], [x + 0.4, 1.2, -6.8], [x + 0.4, 3.6, -6.8], [x + 0.4, 3.6, -7.6]], 0.16, luftM);        // Druckleitung
      noCol(box(g, 0.36, 0.3, 0.36, M.steelDark, x + 0.4, 2.7, -6.8, 0, false));                                              // Rückschlagklappe
      makeInst(id, { name: `Drehkolbengebläse ${nr} (Schallhaube)`, tag: nr, pos: [x + 0.7, 1.05, -3.49], size: 0.36, aspect: 0.35, res: 128,
        info: 'Drehkolbengebläse mit Riemenantrieb und FU-geregeltem Motor in einer Schallhaube. Die Fördermenge ist nahezu proportional zur Drehzahl.',
        draw: plate(nr, '#ecf0f1'),
        detail: (ctx, W, Hc) => {
          const x = sim.B.g[gi];
          senses(ctx, W, Hc, `Gebläse ${nr}`, x.run ? [`Läuft, ${x.hz > 44 ? 'sehr laut, hohe Drehzahl' : x.hz > 36 ? 'deutlich lauter als üblich' : 'gleichmäßiges Pumpgeräusch'},`, 'Haube warm, Luftzug an den Schlitzen.', `Betriebsart am FU: ${MODI[x.mode]}`] : ['Steht. Kein Geräusch, Haube kalt.', `Betriebsart am FU: ${MODI[x.mode]}`], x.run);
        },
        actions: () => [
          { label: 'Ansaugfilter prüfen', fn: () => { logA(`${nr} Ansaugfilter geprüft: Filtermatte leicht grau, in Ordnung`, 'messung'); toast('Filtermatte leicht grau verfärbt – noch in Ordnung, kein Wechsel nötig.'); } },
          { label: 'Riementrieb prüfen', fn: () => { logA(`${nr} Riementrieb geprüft: Spannung und Zustand in Ordnung`, 'messung'); toast(sim.B.g[gi].run ? 'Nur im Stillstand prüfen! Sichtprüfung: Riemen läuft ruhig.' : 'Riemenspannung und Riemenzustand in Ordnung.'); } },
        ] });
    };
    aggregat(25.5, 'g11', 'G1.1', 0); aggregat(31, 'g12', 'G1.2', 1);
    makeInst('pdi201', { name: 'Differenzdruck Ansaugfilter G1.1', tag: 'PDI 201', pos: [24.5, 1.05, -3.49], size: 0.22, round: true,
      info: 'Differenzdruckanzeige über dem Ansaugfilter von G1.1. Ein steigender Wert zeigt einen verschmutzten Filter an.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 50, ticks: 5, unit: 'mbar', tag: 'PDI 201', val: sim.B.pdi + noise(0.3, 7), red: [35, 50] }) });
    makeInst('pi201', { name: 'Manometer Druckleitung G1.1', tag: 'PI 201', pos: [25.9, 1.75, -6.62], size: 0.26, round: true,
      info: 'Manometer auf der Druckseite von G1.1 vor der Rückschlagklappe. Der Druck ergibt sich aus Wassertiefe über den Belüftern und den Leitungsverlusten.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 1000, ticks: 5, unit: 'mbar', tag: 'PI 201', val: sim.B.g[0].pD + (sim.B.g[0].run ? noise(4, 8) : 0) }) });
    makeInst('ti201', { name: 'Thermometer Druckstutzen G1.1', tag: 'TI 201', pos: [25.9, 2.2, -6.62], size: 0.22, round: true,
      info: 'Temperatur der verdichteten Luft am Druckstutzen von G1.1.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 150, ticks: 6, unit: '°C', tag: 'TI 201', val: sim.B.tD }) });
    // Sammelleitung → Nordwand → Luftverteilung
    pipe(g, [[25.9, 3.6, -7.6], [31.4, 3.6, -7.6]], 0.2, luftM);
    pipe(g, [[25.9, 3.6, -7.6], [22.4, 3.6, -7.6], [22.4, 1.6, -7.6], [22.4, 1.6, -15.2]], 0.24, luftM);
    noCol(box(g, 0.3, 0.3, 0.2, std(0x2c3e50), 22.4, 2.05, -7.32, 0, false));
    makeInst('fi201', { name: 'Luftmengenmessung gesamt', tag: 'FI 201', pos: [22.4, 2.2, -7.21], size: 0.34, aspect: 0.6,
      info: 'Thermische Durchflussmessung in der Sammelleitung: gesamte Luftmenge zur Belebung (Normkubikmeter je Stunde).',
      draw: (ctx, W, Hc) => lcd(ctx, W, Hc, 'FI 201', [`${f0(sim.B.Ltot + noise(15, 9))} Nm³/h`], { lcdH: 0.5, fs: 0.13 }) });
    // FU-Schrank an der Westwand
    box(g, 0.5, 2.0, 1.6, std(0xd5d8db, { r: 0.6, m: 0.2 }), 20.4, 0, -4.0);
    makeInst('fu201', { name: 'Frequenzumrichter Gebläse', tag: 'FU G1.1/G1.2', pos: [20.66, 1.45, -4.0], rotY: Math.PI / 2, size: 0.9, aspect: 0.95,
      info: 'Frequenzumrichter der beiden Gebläse mit Betriebsartenwahl. AUTO: Drehzahl folgt der Luftanforderung der Sauerstoffregler (Führungsgebläse). RESERVE: startet nur, wenn kein anderes Gebläse läuft. HAND: feste Frequenz. AUS: Gebläse gesperrt.',
      draw: (ctx, W, Hc) => {
        const B = sim.B, z = (i) => { const x = B.g[i]; return [`${GEB[i]}  ${MODI[x.mode].padEnd(8)} ${x.run ? 'läuft' : 'steht'}`, `  ${f1(x.hz)} Hz  ${f0(x.amp)} A  ${f0(x.pkw)} kW`]; };
        lcd(ctx, W, Hc, 'FU Gebläsestation', [...z(0), '', ...z(1), '', `Sammelleitung ${f0(B.pD)} mbar`], { lcdH: 0.62, fs: 0.056 });
        lamp(ctx, W * 0.2, Hc * 0.86, W * 0.04, '#00b894', B.g[0].run, 'G1.1', W);
        lamp(ctx, W * 0.45, Hc * 0.86, W * 0.04, '#f1c40f', B.alarme.gmax?.aktiv, 'Grenze', W);
        lamp(ctx, W * 0.7, Hc * 0.86, W * 0.04, '#00b894', B.g[1].run, 'G1.2', W);
      },
      actions: () => GEB.flatMap((nr, i) => [
        { typ: 'titel', label: `Gebläse ${nr}` },
        { typ: 'wahl', label: 'Betriebsart', wert: sim.B.g[i].mode, optionen: Object.entries(MODI), fn: (v) => gebMode(sim.B, i, v, logA) },
        { typ: 'zahl', label: 'Hand-Frequenz', wert: sim.B.g[i].hzHand, min: 12.5, max: 50, einheit: 'Hz', fn: (v) => gebHz(sim.B, i, v, logA) },
      ]) });

    reg('geblaese', g, { name: 'Gebläsestation', kks: 'G1.1 / G1.2 · FIC 201 · FU',
      text: 'Erzeugung der Prozessluft für die Nitrifikation. Die Sauerstoffregler der beiden Straßen geben die Luftmengen vor; das Gebläse liefert die Summe über die Drehzahl, die Regelklappen FV 301 / FV 311 verteilen sie (die am weitesten geöffnete Klappe steht bei ca. 88 %).',
      rows: [['Aggregate', '2 × Drehkolbengebläse in Schallhaube, 1 Betrieb + 1 Reserve'], ['Antrieb', 'FU-geregelt, max. 5.200 Nm³/h bei 50 Hz'], ['Energie', '≈ 25 Wh/Nm³ (Δp ≈ 0,5 bar)'], ['Vor Ort', 'FU-Anzeige, PI 201, TI 201, PDI 201, FI 201']], walk: 'geblaese' });
  }

  // ================================================================ Luftverteilung mit Regelklappen (vor Straße 2)
  {
    const g = new THREE.Group();
    pipe(g, [[21.4, 1.6, -15.2], [23.4, 1.6, -15.2]], 0.24, luftM);
    noCol(box(g, 0.12, 1.5, 0.12, M.steelDark, 22.4, 0, -15.2, 0, false));
    noCol(box(g, 0.05, 0.3, 0.05, M.steelDark, 22.4, 1.6, -14.98, 0, false));
    makeInst('pi202', { name: 'Manometer Sammelleitung', tag: 'PI 202', pos: [22.4, 2.05, -14.95], size: 0.26, round: true,
      info: 'Druck in der Luftsammelleitung vor den Regelklappen. Er steigt, wenn Klappen schließen oder Belüfter verstopfen, und fällt, wenn Klappen weit öffnen.',
      draw: (ctx, W) => gauge(ctx, W, { min: 0, max: 1000, ticks: 5, unit: 'mbar', tag: 'PI 202', val: sim.B.pD + noise(3, 11), red: [650, 1000] }) });
    STR.forEach((st, i) => {
      const x = i === 0 ? 21.6 : 23.2;
      pipe(g, [[x, 1.6, -15.2], [x, 1.6, -17.6], [x, 1.25, -18.2]], 0.16, luftM);
      { const m = cyl(g, 0.22, 0.22, 0.12, M.steelDark, x, 1.6, -16.4, 20); m.rotation.x = Math.PI / 2; m.position.y = 1.6; m.userData.noCol = true; }
      noCol(box(g, 0.28, 0.32, 0.24, std(0x2f6fa8, { r: 0.6, m: 0.3 }), x, 1.82, -16.4, 0, false));
      makeInst(`fv${i}`, { name: `Luftregelklappe ${st.name}`, tag: st.fv, pos: [x, 2.16, -16.27], size: 0.26, aspect: 0.9,
        info: `Motorisch verstellte Absperrklappe in der Luftleitung zur ${st.name}. FERN: Die Stellung ergibt sich aus der Sauerstoffregelung. ORT: Die Klappe bleibt in der vor Ort eingestellten Handstellung, der O₂-Regler hat dann keinen Einfluss.`,
        actions: () => [
          { typ: 'wahl', label: 'Steuerung', wert: sim.B.s[i].fv.ort ? 'ort' : 'fern', optionen: [['fern', 'FERN'], ['ort', 'ORT']], fn: (v) => fvOrt(sim.B, i, v === 'ort', logA) },
          { typ: 'zahl', label: 'Handstellung (nur ORT)', wert: Math.round(sim.B.s[i].fv.pos), min: 0, max: 100, einheit: '%', fn: (v) => { fvPos(sim.B, i, v, logA); if (!sim.B.s[i].fv.ort) toast('Handstellung gespeichert – wirkt erst im ORT-Betrieb.'); } },
        ],
        draw: (ctx, W, Hc) => {
          const k = sim.B.s[i].klappe;
          ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0, 0, W, Hc);
          ctx.fillStyle = '#2d3436'; ctx.font = `bold ${W * 0.12}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(st.fv, W / 2, Hc * 0.04);
          const cx = W / 2, cy = Hc * 0.66, R = W * 0.36;
          ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke();
          ctx.font = `${W * 0.08}px Arial`; ctx.fillText('ZU', cx - R, cy + 4); ctx.fillText('AUF', cx + R, cy + 4);
          const a = Math.PI + Math.PI * k / 100;
          ctx.strokeStyle = '#d63031'; ctx.lineWidth = W * 0.04; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke();
          const ort = sim.B.s[i].fv.ort; ctx.fillStyle = ort ? '#e67e22' : '#00b894'; ctx.fillRect(W * 0.3, Hc * 0.8, W * 0.4, Hc * 0.16);
          ctx.fillStyle = '#fff'; ctx.font = `bold ${W * 0.09}px Arial`; ctx.textBaseline = 'middle'; ctx.fillText(ort ? 'ORT' : 'FERN', W / 2, Hc * 0.88);
        } });
    });
    scene.add(g);
  }

  // ================================================================ Sondenausleger QI 301 (Nordseite Straße 1) / QI 311 (Südseite Straße 2)
  {
    const g = new THREE.Group(), wl = 0.75;
    STR.forEach((st, i) => {
      const x = 46, sgn = i === 0 ? -1 : 1, zw = i === 0 ? -62 : -18, zp = zw + sgn * 0.75, zr = zw - sgn * 1.4;
      noCol(box(g, 0.1, 2.3, 0.1, M.galv, x, 0, zp, 0, false));
      noCol(box(g, 0.08, 0.08, Math.abs(zr - zp) + 0.1, M.galv, x, 2.2, (zp + zr) / 2, 0, false));
      noCol(box(g, 0.36, 0.42, 0.18, std(0xd9c27a), x, 1.1, zp + sgn * 0.12, 0, false));
      const pr = new THREE.Group(); pr.position.set(x, wl, zr); g.add(pr);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 12), std(0x2c3e50)); body.position.y = 0.1; pr.add(body);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 6), std(0x111111)); cable.position.y = 0.95; pr.add(cable);
      noCol(pr); anim.probes.push({ pr, inW: new THREE.Vector3(x, wl, zr), outW: new THREE.Vector3(x + 0.35, 0.55, zp + sgn * 0.3) });
      makeInst(`qi${i}`, { name: `O₂-Messung ${st.name} (Messumformer am Ausleger)`, tag: st.qi, pos: [x, 1.4, zp + sgn * 0.215], rotY: i === 0 ? Math.PI : 0, size: 0.32, aspect: 0.9,
        info: `Optische bzw. membranbedeckte O₂-Sonde in der Nitrifikationszone der ${st.name}. Der Messwert ist Istwert des Sauerstoffreglers ${st.qic}. Belag auf der Membran verlangsamt die Diffusion – die Sonde zeigt dann zu niedrig an.`,
        draw: (ctx, W, Hc) => {
          const s = sim.B.s[i];
          lcd(ctx, W, Hc, st.qi, [`O2 ${f1(Math.max(0, s.meas))} mg/L`, `T  ${f1(PB.T)} °C`], { lcdH: 0.62, fs: 0.12 });
        },
        detail: (ctx, W, Hc) => {
          const s = sim.B.s[i];
          ctx.fillStyle = '#1e272e'; ctx.fillRect(0, 0, W, Hc);
          ctx.fillStyle = '#0d2310'; ctx.fillRect(W * 0.05, Hc * 0.06, W * 0.42, Hc * 0.3);
          ctx.fillStyle = '#7CFC9a'; ctx.font = `${W * 0.06}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(st.qi, W * 0.08, Hc * 0.09); ctx.font = `bold ${W * 0.075}px monospace`; ctx.fillText(`${f1(Math.max(0, s.meas))} mg/L`, W * 0.08, Hc * 0.2);
          ctx.fillStyle = '#dfe6e9'; ctx.font = `${W * 0.042}px Arial`;
          ctx.fillText(`Sonde: ${s.out ? 'gezogen (an Luft)' : 'im Becken'}`, W * 0.05, Hc * 0.42);
          ctx.fillText(`Regler ${st.qic}: ${s.ctrl.auto ? 'AUTO' : 'HAND'}`, W * 0.05, Hc * 0.5);
          ctx.fillText(`Letzte Kalibrierung: bei ${Math.round(s.kalP)} hPa`, W * 0.05, Hc * 0.58);
          if (s.hand && sim.B.t - s.hand.t < 1800) {
            ctx.fillStyle = '#ffeaa7'; ctx.fillRect(W * 0.53, Hc * 0.06, W * 0.42, Hc * 0.3);
            ctx.fillStyle = '#2d3436'; ctx.font = `${W * 0.045}px Arial`; ctx.fillText('Handmessgerät', W * 0.56, Hc * 0.09);
            ctx.font = `bold ${W * 0.075}px monospace`; ctx.fillText(`${f1(s.hand.v)} mg/L`, W * 0.56, Hc * 0.2);
          }
          if (s.out) {  // Sondenkopf mit Membran
            const cx = W * 0.5, cy = Hc * 0.78;
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx - W * 0.25, cy - Hc * 0.1, W * 0.4, Hc * 0.2);
            ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.ellipse(cx + W * 0.17, cy, W * 0.05, Hc * 0.1, 0, 0, 7); ctx.fill();
            ctx.font = `${W * 0.042}px Arial`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
            if (s.f < 0.8) { ctx.fillStyle = 'rgba(96,78,30,0.85)'; for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc(cx + W * 0.17 + Math.sin(k * 2.1) * W * 0.035, cy + Math.cos(k * 1.7) * Hc * 0.07, W * 0.018, 0, 7); ctx.fill(); }
              ctx.fillStyle = '#dfe6e9'; ctx.fillText('Membran mit braunem, schleimigem Belag', W * 0.05, Hc * 0.93); }
            else { ctx.fillStyle = '#dfe6e9'; ctx.fillText('Membran sauber', W * 0.05, Hc * 0.93); }
          }
        },
        actions: () => {
          const s = sim.B.s[i], log = (t, a) => logA(t, a);
          const a = [];
          if (!s.out) a.push({ label: 'Vergleichsmessung (Handmessgerät)', fn: () => { const m = handmessung(sim.B, i, log); if (m) toast(m); } });
          a.push({ label: s.out ? 'Sonde wieder einsetzen' : 'Sonde aus dem Becken ziehen', fn: () => sondeZiehen(sim.B, i, log) });
          if (s.out) {
            a.push({ label: 'Membran reinigen', fn: () => toast(sondeReinigen(sim.B, i, log)) });
            a.push({ typ: 'zahl', label: 'Luftkalibrierung bei Luftdruck', wert: 1013, min: 850, max: 1100, einheit: 'hPa', knopf: 'Kalibrieren', fn: (v) => toast(sondeKalibrieren(sim.B, i, v, log)) });
          }
          return a;
        } });
    });
    scene.add(g);
  }

  // Blasenbild je Straße (Faktor für die Blaseninstanzen in index.html)
  const bubble = (z) => { const L = sim.B.s[z < -40 ? 0 : 1].L; return Math.max(0.15, Math.min(2.2, (L / PB.L0) ** 1.3)); };
  function update(dt) {
    sim.B.s.forEach((s, i) => { const p = anim.probes[i]; p.pr.position.lerp(s.out ? p.outW : p.inW, Math.min(1, dt * 4)); });
  }
  return { update, bubble };
}
