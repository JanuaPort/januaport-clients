# Gemini CLI an JanuaPort anbinden

Gemini CLI (Google) verbindet sich **von Ihrem Rechner aus** mit JanuaPort:
per Streamable HTTP auf `/mcp`, mit einem eigenen `jnpt_…`-Token im
`Authorization`-Header.

**Stand: ungetestet.** Diese Anleitung folgt der Gemini-CLI-Dokumentation
(Stand 20.11.2026), ein Beleg gegen JanuaPort steht noch aus. Sobald er
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

Tragen Sie in `~/.gemini/settings.json` einen Platzhalter ein. Gemini CLI
löst Umgebungsvariablen in String-Werten beim Laden der Einstellungen auf,
auch in `headers` ([offizielle Konfigurationsdokumentation](https://github.com/google-gemini/gemini-cli/blob/d4cb1713fd7fc30f1c03f9ca7cbfed341c97dffd/docs/reference/configuration.md#settings-files),
abgeglichen am 20.11.2026). Gegen JanuaPort bleibt dieser Weg **ungetestet**.

```json
{
  "mcpServers": {
    "januaport": {
      "httpUrl": "https://<ihre-anlage>/mcp",
      "headers": {
        "Authorization": "Bearer ${JANUAPORT_TOKEN}"
      }
    }
  }
}
```

Lesen Sie den Token verdeckt ein und starten Sie Gemini aus derselben Shell.
Die Variable gilt nur für diese Sitzung und ihre Kindprozesse. Der Token wird
so weder als Kommandozeilen-Argument noch als eingegebener Wert in der
Shell-Historie abgelegt.

```bash
read -r -s -p 'JanuaPort-Token: ' JANUAPORT_TOKEN; printf '\n'
export JANUAPORT_TOKEN
gemini
unset JANUAPORT_TOKEN
```

PowerShell 7.1 oder neuer:

```powershell
$env:JANUAPORT_TOKEN = Read-Host 'JanuaPort-Token' -MaskInput
try { gemini } finally { Remove-Item Env:JANUAPORT_TOKEN }
```

Die Datei enthält nur den Platzhalter. Umgebungsvariablen können von Prozessen
mit ausreichenden Rechten gelesen werden. Der Weg über `gemini mcp add
--header` würde den Token in Prozessargumente und im Klartext in die
Konfigurationsdatei schreiben.

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

- **Ungetestet** (20.11.2026): Bearer-Token und OAuth/SSO.
