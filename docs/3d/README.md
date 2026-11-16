# 3D-Ansicht Kläranlage Schwierbach

Erreichbar unter `…/Klaeranlage_PLS/3d/` (Link aus dem PLS). Läuft ohne Build-Schritt direkt
von GitHub Pages. three.js liegt lokal in `vendor/`; die Seite braucht kein CDN und funktioniert offline,
wenn der Ordner `docs/` z. B. von einem Schulrechner ausgeliefert wird.

## Ansichten

- **Luftbild** (Standard): Orbit-Kamera, Rundgang, Beschriftungen, Fließwege, Innenansicht RS-Pumpwerk.
- **Begehung** (Button „🚶 Begehen“ oder „Hier begehen“ im Infofenster): Ich-Perspektive auf Augenhöhe.
  Desktop: W A S D gehen, Maus ziehen = umsehen, Shift = schneller, E oder Klick = Instrument ansehen,
  Tab = Leitwarte. Tablet/Handy: links unten ziehen = gehen, rechts ziehen = umsehen, Instrument antippen.

## Simulation und Missionen

Faulung/Gas und Belüftung laufen als eigene, vereinfachte Prozessmodelle im Zeitraffer; die Gebläseleistung
geht in den Eigenbedarf der Energiebilanz ein. Vor-Ort-Instrumente zeigen live die Modellwerte, einige sind
bedienbar. Die Leitwarte (Reiter Faulung/Gas und Belüftung) zeigt bewusst nur Sammelmeldungen; die
O₂-Regler QIC 301/311 lassen sich dort bedienen (AUTO/HAND, Sollwert, Kp, Tn, Hand-Stellwert).

Über „🎯 Missionen“ startet eine vorbereitete Betriebssituation: Auftrag (Briefing) → Start an der Leitwarte →
Kontrollgang → „Beenden“ zeigt eine Auswertung (erfüllte Schritte, Energiekennzahl) und das Protokoll.

| Mission | Inhalt (für Lehrkräfte) |
|---------|-------------------------|
| Freies Üben | Normalbetrieb |
| BHKW steht | HA 611 nach Wartung geschlossen → BHKW-Störung „Gasdruck min“, Speicher läuft voll, Fackel zündet |
| Faulturm kühlt aus | Motorschutz Heizwasserpumpe P11.1 ausgelöst → Faulturm kühlt aus, CH4 sinkt, BHKW schaltet ab |
| Stromfresser Gebläsestation | Belag auf O₂-Sonde QI 301 → Sonde zeigt zu wenig, Regler bläst zu viel Luft ein; fachgerecht: HAND, Sonde ziehen, reinigen, kalibrieren, AUTO |

Die vollständigen Lösungshinweise stehen im Missionsmenü (aufklappbar) und in `js/missionen.js`.
Neue Missionen: Eintrag in `MISSIONEN` mit Szenario-Codes (`faul`, `bel`), Startstation, Auftrag und Prüfschritten.
Im Prüfungsmodus sind Beschriftungen, Schnellwahl und Erklärtexte ausgeblendet.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `index.html` | Gesamte Anlage (Geometrie, Rundgang, Infotexte, Fließwege, RS-Innenansicht), Oberfläche, Hauptschleife |
| `js/faulung-modell.js` | Prozessmodell Faulung/Gas, Szenarien S0–S2 (reine Rechenlogik) |
| `js/belueftung-modell.js` | Prozessmodell Belüftung: 2 Straßen, PI-Regler, Drehkolbengebläse, Sondenzustand, Szenarien B0/B1 |
| `js/anlage-sim.js` | gemeinsamer Zustand, Zeitraffer, Kopplung der Modelle, Protokoll |
| `js/instrumente.js` | Zeichenfunktionen und Registry der Vor-Ort-Instrumente |
| `js/faulung-szene.js` | 3D der Faulung inkl. Instrumente und Animationen |
| `js/belueftung-szene.js` | 3D der Gebläsestation, Luftverteilung, Sondenausleger; Blasenbild je Straße |
| `js/anlage-ui.js` | Leitwarte mit Reglerbedienung, Detailansicht, Protokoll, Meldung |
| `js/missionen.js` | Missionen: Auftrag, Start, Auswertung |
| `js/begehung.js` | Ich-Perspektive: Steuerung, Kollision, Stationen, Instrument-Hinweis |
| `vendor/` | three.js r160 (MIT) mit OrbitControls |

Neue Instrumente entstehen in den `*-szene.js`-Dateien mit `makeInst(id, { name, tag, pos, rotY, size, draw, info, actions })`.
Kollision: Alle sichtbaren Meshes zwischen 0,3 m und 1,6 m Höhe wirken als Hindernis (Bounding Box);
dünne Teile wie Rohrleitungen werden mit `userData.noCol = true` ausgenommen.
