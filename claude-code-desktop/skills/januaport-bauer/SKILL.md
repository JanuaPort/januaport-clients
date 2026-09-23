---
name: januaport-bauer
description: Mit JanuaPort im Bau-Modus einen wiederkehrenden Vorgang automatisieren, gemeinsam mit dem Menschen. Verwenden, wenn ein Use Case entworfen, eine Kartei oder Ablage angelegt oder ein Steckbrief gepflegt werden soll. Nicht für Verwaltung (Tokens, Integrationen, Rechte), das macht der Admin.
---

# Bauen mit JanuaPort

Du arbeitest über den MCP-Server `januaport` auf der normalen Fläche `/mcp`,
mit dem Zugang des Menschen vor dir. Du **baust** mit ihm, du **verwaltest**
nichts.

## Zuerst lesen

1. `wissen_get` mit `vorgehensmodell`, ohne `abschnitt`: Das liefert das
   Inhaltsverzeichnis. Danach die Abschnitte, die zum Schritt passen. Das
   Vorgehensmodell der Anlage geht dieser Datei vor.
2. `wissen_get` mit `muster/uebersicht`: Vielleicht gibt es den Vorgang schon
   als Muster.
3. `usecase_list`: Vielleicht gibt es den Use Case schon als Eintrag.

## Regeln

- **Was du nicht siehst, darfst du nicht.** Fehlt ein Werkzeug, fehlt dem
  Zugang der Scope. Sag dem Menschen, welches Recht fehlt, und dass der Admin
  es vergibt. Suche keinen Umweg.
- **Geld-relevantes bestätigt der Mensch.** Bevor du ein schreibendes Werkzeug
  aufrufst, das Außenwirkung hat (Buchung, Versand, Zahlung), fragst du
  ausdrücklich nach. Die Anlage fragt nicht noch einmal.
- **Kein Auto-Retry bei Writes.** Scheitert ein schreibender Aufruf, prüfst du
  zuerst mit einem lesenden, ob er doch angekommen ist.
- **Keine Kundendaten in den Steckbrief.** Der Use-Case-Eintrag beschreibt
  Struktur, Rollen, Datenvertrag und Entscheidungen, keine Inhalte.
- **Entscheidungen festhalten**, sobald sie fallen (`usecase_add_entscheidung`),
  nicht am Ende.

## Wenn etwas im Produkt fehlt

`report_problem` mit einer knappen Beschreibung: was du versucht hast, was
fehlte, welcher Use Case. Nicht im Vorgang umgehen.
