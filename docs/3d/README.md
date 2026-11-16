# 3D-Ansicht Kläranlage Schwierbach

Erreichbar unter `…/Klaeranlage_PLS/3d/` (Link aus dem PLS). Läuft ohne Build-Schritt direkt
von GitHub Pages. three.js liegt lokal in `vendor/`; die Seite braucht kein CDN und funktioniert offline,
wenn der Ordner `docs/` z. B. von einem Schulrechner ausgeliefert wird.

## Ansichten

- **Luftbild** (Standard): Orbit-Kamera, Rundgang, Beschriftungen, Fließwege, Innenansicht RS-Pumpwerk.
- **Begehung** (Button „🚶 Begehen“ oder „Hier begehen“ im Infofenster): Ich-Perspektive auf Augenhöhe.
  Desktop: W A S D gehen, Maus ziehen = umsehen, Shift = schneller, E oder Klick = Instrument ansehen,
  Tab = Leitwarte. Tablet/Handy: links unten ziehen = gehen, rechts ziehen = umsehen, Instrument antippen.

## Faulungssimulation

Die Faulung (Faulturm, Maschinenhaus, Gasspeicher, Gasstrecke, BHKW, Fackel) läuft mit einem eigenen,
vereinfachten Prozessmodell im Zeitraffer. Vor-Ort-Instrumente zeigen live die Modellwerte, einige sind
bedienbar (Kugelhahn HA 611, BHKW quittieren, Motorschutz P11.1). Die Leitwarte zeigt bewusst nur
Sammelstörungen. Über „Szenario“ lassen sich Störungen starten:

| Code | Inhalt (für Lehrkräfte) |
|------|-------------------------|
| S0 | Normalbetrieb |
| S1 | HA 611 nach Wartung geschlossen → BHKW-Störung „Gasdruck min“, Speicher läuft voll, Fackel zündet |
| S2 | Motorschutz Heizwasserpumpe P11.1 ausgelöst → Faulturm kühlt aus, CH4 sinkt, BHKW schaltet ab |

Aktionen, angesehene Instrumente und Alarme landen im Protokoll (kopierbar).

## Dateien

| Datei | Inhalt |
|-------|--------|
| `index.html` | Gesamte Anlage (Geometrie, Rundgang, Infotexte, Fließwege, RS-Innenansicht), Oberfläche, Hauptschleife |
| `js/faulung-modell.js` | Prozessmodell Faulung/Gas, Szenarien (reine Rechenlogik, ohne 3D) |
| `js/faulung-sim.js` | laufender Zustand, Zeitraffer, Protokoll |
| `js/faulung-szene.js` | 3D-Geometrie der Faulung inkl. Instrumente (Canvas-Texturen) und Animationen |
| `js/faulung-ui.js` | Leitwarte, Detailansicht, Protokoll, Meldung, Szenario-Menü |
| `js/begehung.js` | Ich-Perspektive: Steuerung, Kollision, Stationen, Instrument-Hinweis |
| `vendor/` | three.js r160 (MIT) mit OrbitControls |

Neue Instrumente entstehen in `faulung-szene.js` mit `makeInst(id, { name, tag, pos, rotY, size, draw, info, actions })`.
Kollision: Alle sichtbaren Meshes zwischen 0,3 m und 1,6 m Höhe wirken als Hindernis (Bounding Box);
dünne Teile wie Rohrleitungen werden mit `userData.noCol = true` ausgenommen.
