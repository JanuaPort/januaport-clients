# Gemini CLI an JanuaPort anbinden

Gemini CLI (Google) verbindet sich **von Ihrem Rechner aus** mit JanuaPort:
per Streamable HTTP auf `/mcp`, mit einem eigenen `jnpt_…`-Token im
`Authorization`-Header.

**Stand: ungetestet.** Diese Anleitung folgt der Gemini-CLI-Dokumentation
(Stand 30.10.2026), ein Beleg gegen JanuaPort steht noch aus. Sobald er
vorliegt, steht hier Datum und Version.

## Voraussetzungen

- Gemini CLI.
- Die MCP-Adresse der Anlage, z. B. `https://<ihre-anlage>/mcp`, oder eine
  Sicht: `https://<ihre-anlage>/mcp/v/<name>` (mit diesem Client ungetestet).
- Ein **eigener Tool-Token** für diesen Zugang, ausgestellt vom Admin
  (Admin-GUI → Tokens, `jnpt token create` oder Admin-MCP). Er zählt als
  eigene Lizenz-Einheit. Ein sprechendes Label (`gemini-<name>`) macht ihn im
  Audit erkennbar; ein Ablaufdatum gehört dazu.
- Werkzeug-Freigaben für den Token. Deny-by-default: Ein Werkzeug ohne Scope
  ist unsichtbar.

## 1. Konfiguration

Wichtig: `httpUrl` ist Streamable HTTP, `url` meint bei Gemini CLI SSE.
JanuaPort spricht Streamable HTTP, also `httpUrl`. Den Servernamen ohne
Unterstrich wählen.

Per Kommando (Scope `user` = nur für Sie):

```bash
gemini mcp add --scope user --transport http \
  --header "Authorization: Bearer $JANUAPORT_TOKEN" \
  januaport https://<ihre-anlage>/mcp
```

Hier setzt die Shell den Wert ein, und Gemini CLI legt den Token im Klartext
in `~/.gemini/settings.json` ab. Diese Datei gehört nie in ein Repo. Ob Gemini
CLI Umgebungsvariablen auch in `headers` einsetzt, sagt die Doku nicht; bis zum
Beleg steht deshalb hier kein `$VAR` in der Datei.

Der Eintrag in `~/.gemini/settings.json` sieht dann so aus:

```json
{
  "mcpServers": {
    "januaport": {
      "httpUrl": "https://<ihre-anlage>/mcp",
      "headers": {
        "Authorization": "Bearer jnpt_<id>_<secret>"
      }
    }
  }
}
```

## 2. Anmeldung

| Weg | Stand | Hinweis |
|---|---|---|
| Bearer-Token | **ungetestet** | laut Doku über `headers`, siehe oben. |
| OAuth/SSO | **ungetestet** | Gemini CLI unterstützt OAuth für HTTP-Server (`/mcp auth januaport`, braucht einen lokalen Browser). Gegen eine Anlage mit SSO ist das nicht belegt. |

## 3. Belegaufruf

In Gemini CLI heißen die Werkzeuge `mcp_<server>_<werkzeug>`, hier also
`mcp_januaport_ping`. Fragen Sie: „Rufe das Werkzeug ping von januaport auf.“
Ohne `"trust": true` fragt Gemini CLI vor dem Aufruf nach einer Freigabe; das
ist für schreibende Werkzeuge die richtige Einstellung.

Der Aufruf erscheint im Audit mit dem Token-Label als Aufrufer, in der
Admin-GUI auf der Audit-Seite oder per `jnpt audit list`
(`TOOL ping`, `KIND read`, `STATUS ok`).

## Stand

- **Ungetestet** (30.10.2026): Bearer-Token und OAuth/SSO.
