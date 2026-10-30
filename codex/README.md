# Codex an JanuaPort anbinden

Codex (CLI, OpenAI) verbindet sich **von Ihrem Rechner aus** mit JanuaPort: per
Streamable HTTP auf `/mcp`, mit einem eigenen `jnpt_…`-Token im
`Authorization`-Header.

**Stand:** Bearer-Token **live belegt am 30.10.2026 mit Codex CLI 0.162.1**
gegen JanuaPort 0.89.0. OAuth/SSO ist **ungetestet**. Einzelheiten unter
[Stand](#stand).

## Voraussetzungen

- Codex CLI.
- Die MCP-Adresse der Anlage, z. B. `https://<ihre-anlage>/mcp`, oder eine
  Sicht: `https://<ihre-anlage>/mcp/v/<name>` (mit diesem Client ungetestet).
- Ein **eigener Tool-Token** für diesen Zugang, ausgestellt vom Admin
  (Admin-GUI → Tokens, `jnpt token create` oder Admin-MCP). Er zählt als
  eigene Lizenz-Einheit. Ein sprechendes Label (`codex-<name>`) macht ihn im
  Audit erkennbar; ein Ablaufdatum gehört dazu.
- Werkzeug-Freigaben für den Token. Deny-by-default: Ein Werkzeug ohne Scope
  ist unsichtbar.

## 1. Konfiguration

Der Token steht nie in der Konfigurationsdatei, nur in einer
Umgebungsvariable:

```bash
export JANUAPORT_TOKEN="jnpt_<id>_<secret>"
```

```powershell
$env:JANUAPORT_TOKEN = "jnpt_<id>_<secret>"
```

In `~/.codex/config.toml`:

```toml
[mcp_servers.januaport]
url = "https://<ihre-anlage>/mcp"          # eine Sicht (/mcp/v/<name>) ist mit Codex ungetestet
bearer_token_env_var = "JANUAPORT_TOKEN"   # Codex liest das Token aus dieser Umgebungsvariable
```

Gleichwertig einmalig auf der Kommandozeile:

```bash
codex exec \
  -c 'mcp_servers.januaport.url="https://<ihre-anlage>/mcp"' \
  -c 'mcp_servers.januaport.bearer_token_env_var="JANUAPORT_TOKEN"' \
  "Rufe das Werkzeug ping auf."
```

## 2. Anmeldung

| Weg | Stand | Hinweis |
|---|---|---|
| Bearer-Token | **belegt** | Codex sendet `Authorization: Bearer` aus `bearer_token_env_var`. |
| OAuth/SSO | **ungetestet** | Codex kennt `codex mcp login <server>`. Gegen eine Anlage mit SSO ist das nicht belegt. |

## 3. Belegaufruf

In Codex heißen die Werkzeuge `<servername>/<werkzeug>`, hier also
`januaport/ping` und `januaport/catalog`. Ein lesender Aufruf:

```bash
codex exec "Rufe januaport/ping auf und zeige das Ergebnis."
```

Der Aufruf erscheint im Audit mit dem Token-Label als Aufrufer, in der
Admin-GUI auf der Audit-Seite oder per `jnpt audit list`:

```
ZEIT                  TOKEN           TOOL  KIND  STATUS
2026-10-30T16:31:21Z  codex-<name>    ping  read  ok
```

Lesende Werkzeuge liefen im Beleg mit `approval_policy = "never"` und
`sandbox read-only` ohne Freigabe-Dialog. Für schreibende Werkzeuge sollten
Sie die Freigabe-Rückfrage von Codex eingeschaltet lassen.

## Stand

- **Belegt am 30.10.2026** mit Codex CLI 0.162.1, Bearer-Token, gegen eine
  Wegwerf-Anlage mit JanuaPort 0.89.0: `ping` und `catalog` mit Status `ok`
  im Audit. Token danach widerrufen, Anlage gelöscht.
- **Ungetestet:** OAuth/SSO (`codex mcp login`), schreibende Werkzeuge,
  Sichten unter `/mcp/v/<name>`.
