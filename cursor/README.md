# Cursor an JanuaPort anbinden

Cursor verbindet sich **von Ihrem Rechner aus** mit JanuaPort: per HTTP auf
`/mcp`, mit einem eigenen `jnpt_…`-Token im `Authorization`-Header.

**Stand: ungetestet.** Diese Anleitung folgt der Cursor-Dokumentation (Stand
30.10.2026), ein Beleg gegen JanuaPort steht noch aus. Sobald er vorliegt,
steht hier Datum und Cursor-Version.

## Voraussetzungen

- Cursor (IDE).
- Die MCP-Adresse der Anlage, z. B. `https://<ihre-anlage>/mcp`, oder eine
  Sicht: `https://<ihre-anlage>/mcp/v/<name>`.
- Ein **eigener Tool-Token** für diesen Zugang, ausgestellt vom Admin
  (Admin-GUI → Tokens, `jnpt token create` oder Admin-MCP). Er zählt als
  eigene Lizenz-Einheit. Ein sprechendes Label (`cursor-<name>`) macht ihn im
  Audit erkennbar; ein Ablaufdatum gehört dazu.
- Werkzeug-Freigaben für den Token. Deny-by-default: Ein Werkzeug ohne Scope
  ist unsichtbar.

## 1. Konfiguration

Der Token steht nicht in der Datei, sondern in einer Umgebungsvariable, die
Cursor beim Start sieht:

```bash
export JANUAPORT_TOKEN="jnpt_<id>_<secret>"
```

```powershell
[Environment]::SetEnvironmentVariable("JANUAPORT_TOKEN", "jnpt_<id>_<secret>", "User")
```

Nur für Sie: `~/.cursor/mcp.json`. Für ein Projekt: `.cursor/mcp.json` im
Projektordner (die Datei enthält dann keinen Token und darf ins Repo).

```json
{
  "mcpServers": {
    "januaport": {
      "url": "https://<ihre-anlage>/mcp",
      "headers": {
        "Authorization": "Bearer ${env:JANUAPORT_TOKEN}"
      }
    }
  }
}
```

Cursor setzt `${env:NAME}` in `url` und `headers` ein.

## 2. Anmeldung

| Weg | Stand | Hinweis |
|---|---|---|
| Bearer-Token | **ungetestet** | laut Cursor-Doku über `headers`, siehe oben. |
| OAuth/SSO | **ungetestet** | Cursor unterstützt OAuth für entfernte Server. Gegen eine Anlage mit SSO ist das nicht belegt. |

## 3. Belegaufruf

Im Agent-Chat von Cursor: „Rufe das JanuaPort-Werkzeug `ping` auf.“ Cursor
fragt vor dem Werkzeugaufruf nach einer Freigabe.

Der Aufruf erscheint im Audit mit dem Token-Label als Aufrufer, in der
Admin-GUI auf der Audit-Seite oder per `jnpt audit list`
(`TOOL ping`, `KIND read`, `STATUS ok`).

## Stand

- **Ungetestet** (30.10.2026): Bearer-Token und OAuth/SSO.
