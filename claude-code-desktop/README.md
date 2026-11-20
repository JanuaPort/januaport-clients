# Claude Code und Claude Desktop an JanuaPort anbinden

Claude Code verbindet sich **von Ihrem Rechner aus** mit JanuaPort: per
Streamable HTTP auf `/mcp`, mit einem eigenen `jnpt_…`-Token im
`Authorization`-Header. Die Anlage muss dafür nur von diesem Rechner aus
erreichbar sein (LAN, VPN, Tailnet). Offene Web-Ports braucht sie nicht, einen
Tunnel auch nicht.

Claude Desktop ist ein anderer Fall, siehe [Grenzen](#grenzen).

**Status:** siehe [unten](#status). Kurz: Claude Code mit Bearer-Token ist
gegen eine echte Anlage belegt, auf beiden Wegen (`claude mcp add` und
`.mcp.json`). Der Skill und Claude Desktop sind es nicht.

## Voraussetzungen

- Claude Code (CLI, Desktop-App oder IDE-Erweiterung).
- Die MCP-Adresse der Anlage, z. B. `https://<ihr-gateway>/mcp`: ein exakter
  Pfad, kein Schrägstrich am Ende. Sie steht in `JNPT_PUBLIC_URL`, wenn die
  Anlage unter genau dieser Adresse auch aus Ihrem Netz erreichbar ist.
  Andernfalls nehmen Sie den Host, unter dem Sie die Anlage erreichen, und
  hängen `/mcp` an.
- Ein **eigener Tool-Token** für diesen Zugang. Den stellt der Admin aus
  (Admin-GUI → Tokens, `jnpt token create` oder Admin-MCP). Er ist **ein
  eigener Zugang und zählt als Lizenz-Einheit**. Geben Sie ihm ein sprechendes
  Label (`claude-code-<name>`), denn das Label ist im Audit die Identität des
  Aufrufers, und ein Ablaufdatum.
- Die Werkzeug-Freigaben des Tokens. Deny-by-default gilt: Ein Werkzeug ohne
  Scope ist unsichtbar, das ist kein Fehler.

## Schritte

### 1. Token in eine Umgebungsvariable

Lesen Sie den Token verdeckt in die aktuelle Shell ein. Die Variable gilt nur
für diese Sitzung und die daraus gestarteten Prozesse.

```bash
export JNPT_MCP_URL="https://<ihr-gateway>/mcp"
read -r -s -p 'JanuaPort-Token: ' JNPT_TOKEN; printf '\n'
export JNPT_TOKEN
```

PowerShell 7.1 oder neuer:

```powershell
$env:JNPT_MCP_URL = "https://<ihr-gateway>/mcp"
$env:JNPT_TOKEN = Read-Host 'JanuaPort-Token' -MaskInput
```

### 2. Konfiguration mit Platzhaltern: `.mcp.json`

[`mcp.json.beispiel`](mcp.json.beispiel) als `.mcp.json` ins Projekt legen.
Die Datei enthält **nur Platzhalter**, Claude Code setzt `${JNPT_MCP_URL}` und
`${JNPT_TOKEN}` beim Start aus der Umgebung ein. So kann die Datei eingecheckt
werden, und jede Person bringt ihren eigenen Token mit.

```json
{
  "mcpServers": {
    "januaport": {
      "type": "http",
      "url": "${JNPT_MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${JNPT_TOKEN}"
      }
    }
  }
}
```

Claude Code aus derselben Shell mit `claude` starten. Nach dem Beenden mit
`unset JNPT_TOKEN` (Bash) bzw. `Remove-Item Env:JNPT_TOKEN` (PowerShell) die
Variable entfernen. Umgebungsvariablen sind kein Geheimnisspeicher; andere
Prozesse mit ausreichenden Rechten können sie lesen.

Die [Claude-Code-Dokumentation](https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcp-json)
beschreibt die Auflösung in `url` und `headers`. Der frühere Weg über
`claude mcp add --header` setzt den Token in die Prozessargumente und speichert
ihn im Klartext in `~/.claude.json`; deshalb verwendet diese Anleitung die
Platzhalter-Datei. Die verdeckte Eingabe oben schreibt den Token weder als
eingegebenen Wert in die Shell-Historie noch in die Prozessargumente.

### 3. Für den Bauer: der Skill

Wer mit Claude Code im **Bau-Modus** arbeitet, also mit Mensch und KI einen
wiederkehrenden Vorgang auf der normalen Fläche `/mcp` baut (Karteien anlegen,
Use Cases pflegen, Wissen lesen), legt
[`skills/januaport-bauer/`](skills/januaport-bauer/SKILL.md) nach
`.claude/skills/` ins Projekt. Der Skill ruft zuerst das Vorgehensmodell der
Anlage ab und hält die Regeln fest, die ein Bauer kennen muss. Rechte gibt er
**keine**: Was der Token nicht darf, bleibt unsichtbar.

Der Bau-Zugang braucht die Freigaben für den Use-Case-Katalog, lesend
`usecase`, dazu jedes schreibende Werkzeug einzeln (`usecase:usecase_create`
usw.). Hinzu kommen die Werkzeuge für den Vorgang selbst.

## Prüfen

1. In Claude Code `/mcp` aufrufen. `januaport` muss als **connected** erscheinen,
   mit der Zahl der Werkzeuge, die der Token sieht.
2. Einen Durchstich machen: „Rufe das JanuaPort-Werkzeug `ping` auf." Die Antwort
   kommt von der Anlage, und im Audit steht ein Eintrag mit dem Label Ihres
   Tokens.
3. Ein Werkzeug fehlt? Dann fehlt ihm der Scope, es ist deny-by-default. Den
   Scope ergänzt der Admin, Neu-Verbinden ist nicht nötig. Die Freigabe wirkt
   beim nächsten Aufruf, Claude Code liest `tools/list` beim nächsten Start
   bzw. über `/mcp` neu.

Fehlerbilder (HTTP-Antworten laut Gateway-Code aus JanuaPort/januaport#1493;
die Darstellung von 404/405 in Claude Code ist **ungetestet**):

| Bild | Ursache |
|---|---|
| `401`, Kopfzeile `WWW-Authenticate: Bearer error="invalid_token"` | Token falsch, abgelaufen oder widerrufen. Den Grund nennt die Anlage bewusst nicht |
| `401` ohne `error=` | kein Token angekommen: Variable leer, Header-Name falsch oder `Bearer ` fehlt |
| Claude Code bietet einen Browser-Login an | kein `Authorization`-Header konfiguriert. Claude Code folgt dann der OAuth-Discovery der Anlage (bei aktivem SSO) |
| Verbindung hängt oder läuft in einen Timeout | Anlage von diesem Rechner aus nicht erreichbar (Netz, VPN, Tailnet) |
| `404` | Adresse endet auf `/mcp/` oder falscher Pfad; über die öffentliche Adresse auch jeder nicht freigegebene Pfad |
| `405` | andere Methode als `POST` auf dem richtigen Pfad, etwa ein Client im alten SSE-Modus; erst nach bestandener Anmeldung, sonst `401` |

## Grenzen

- **Claude Desktop, eigener Konnektor (Einstellungen → Konnektoren):** Diese
  Verbindung baut **Anthropic aus seiner Cloud** auf, nicht Ihr Rechner. Das
  gilt für claude.ai, Claude Desktop und die Mobil-Apps gleichermaßen. Die
  Anlage braucht dafür einen öffentlichen Endpunkt mit gültigem TLS, und die
  Anmeldung läuft über OAuth, siehe [`../sso-broker/entra/`](../sso-broker/entra/README.md).
  Das ist der claude.ai-Weg, nicht dieser.
- **Claude Desktop, lokal (`claude_desktop_config.json`):** Dort lassen sich nur
  lokale stdio-Server eintragen, keine entfernten HTTP-Server. Eine
  stdio-Brücke (z. B. `mcp-remote`) wäre ein Drittprogramm auf Ihrem Rechner, das
  Ihren Token hält. Sie ist hier nicht belegt und wird nicht empfohlen.
- **Jeder Token zählt als Zugang.** Ein Token pro Person oder Automatisierung;
  einen Token zu teilen verwischt die Audit-Identität.
- **Es bestätigt niemand.** Schreibende Werkzeuge führt Claude Code nach der
  Freigabe der Werkzeug-Nutzung aus, eine zweite Bestätigung durch die Anlage
  gibt es nicht. Schreibrechte deshalb werkzeug-genau vergeben.
- **SSO statt Token:** Claude Code kennt eine vorab registrierte OAuth-Client-ID
  (`--client-id`, `--callback-port`). Mit der Entra-Client-Registrierung wäre
  das eine zusätzliche Rückruf-URI `http://localhost:<port>/callback`. Dieser
  Weg ist **nicht belegt** und nicht Teil dieser Anleitung.

## Status

| Weg | Stand |
|---|---|
| Claude Code, Bearer-Token, früherer Weg mit `claude mcp add` | **belegt am 23.09.2026**: `claude mcp get` meldet „Connected" |
| Claude Code, `.mcp.json` mit Umgebungsvariablen | **belegt am 23.09.2026**: `tools/list`, `ping` und ein Lesewerkzeug einer Integration |
| Skill `januaport-bauer` | **ungetestet** |
| Claude Desktop, eigener Konnektor | siehe claude.ai-Weg |
| Claude Desktop, stdio-Brücke | nicht belegt, nicht empfohlen |
| Claude Code, SSO mit Client-ID | nicht belegt |

Der Beleg lief mit Claude Code 2.1.280 gegen eine JanuaPort-Anlage 0.62.0 über
ein privates Tailnet, also ohne offenen Web-Port, mit einem befristeten Token,
der danach widerrufen wurde. Im Fehlerbild „Browser-Login" steht, was die Doku
von Claude Code beschreibt; beobachtet ist es hier nicht.
