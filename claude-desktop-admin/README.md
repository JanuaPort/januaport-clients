# JanuaPort Admin für Claude Desktop (MCP-Bundle)

Ein MCP-Bundle (`.mcpb`), mit dem Sie eine JanuaPort-Anlage **aus Claude
Desktop heraus verwalten**: Integrationen anlegen, Teams und Tokens pflegen, das
Audit lesen, im Dialog. Es verbindet Claude Desktop mit dem Admin-MCP der Anlage
(`/admin/mcp`) und nutzt dafür einen Admin-Token. Die Werkzeugliste kommt von der
Anlage selbst; das Bundle bringt keine eigenen Werkzeuge mit.

**Nur im lokalen Netz.** Der Admin-MCP ist nie öffentlich erreichbar, auch nicht
für dieses Bundle. Ihr Rechner muss die Anlage direkt erreichen (LAN, VPN,
Tailnet). Die öffentliche Adresse der Anlage funktioniert absichtlich nicht.

**Status:** siehe [unten](#status). Kurz: gebaut und gegen eine Wegwerf-Anlage
belegt; der Ein-Klick in Claude Desktop ist noch nicht belegt.

## Wie es funktioniert

Claude Desktop startet das Bundle als lokalen Prozess mit dem Node.js, das es
selbst mitbringt. Eine kleine Brücke reicht jede MCP-Nachricht unverändert an
`<Adresse>/admin/mcp` weiter (Streamable HTTP, `Authorization: Bearer <Token>`)
und die Antwort zurück.

- **Token:** Das Feld ist maskiert (`sensitive`). Laut Anthropic legt Claude
  Desktop solche Werte im Schlüsselbund des Betriebssystems ab, nicht in einer
  Datei. Das steht bisher nur in einem Blogbeitrag, nicht in der Spezifikation,
  und ist für dieses Bundle **noch nicht nachgeprüft** (siehe Status). An die
  Brücke geht der Token nur über eine Umgebungsvariable, nie als
  Kommandozeilen-Argument, denn die stehen in der Prozessliste.
- **TLS:** Die Zertifikatsprüfung ist immer an und lässt sich nicht
  ausschalten. Die System-CAs gelten; eine interne Wurzel-CA (z. B. von Caddy mit
  `tls internal`) kommt als Datei dazu.
- **Keine Umleitung:** Antwortet die Anlage mit einer Umleitung, bricht die
  Brücke ab, statt den Token an eine andere Adresse zu schicken.
- **Kein OAuth, keine Anmeldung per SSO.** Bei einem abgelehnten Token kommt
  eine klare Meldung, kein Anmeldefenster.
- **Logs** landen nur im MCP-Log von Claude Desktop, nie mit dem Token.

## Voraussetzungen

- Claude Desktop für **Windows** oder **macOS**.
- Die **Basisadresse** der Anlage im lokalen Netz, nur `https://`, ohne Pfad,
  z. B. `https://box.local`. Den Pfad `/admin/mcp` hängt die Brücke selbst an.
- Wenn die Anlage ein Zertifikat einer internen CA nutzt: deren **Wurzel-CA als
  PEM-Datei**. Bei Caddy mit `tls internal` liegt sie im Datenverzeichnis von
  Caddy unter `pki/authorities/local/root.crt` (im offiziellen Caddy-Image
  `/data/caddy/pki/authorities/local/root.crt`). Nur die Wurzel-CA, nicht das
  Serverzertifikat: Caddy erneuert Zwischen- und Serverzertifikate regelmäßig,
  die Wurzel bleibt.
- Ein **eigener Admin-Token für genau diese Installation** (Abschnitt unten).

## Admin-Token: einer je Installation, mit Ablauf

Ein Admin-Token ist pauschal privilegiert: Er darf alles, was der Admin-MCP
kann. Deshalb gilt:

- **Ein eigener Token je Installation**, also je Rechner und Person. Nur so lässt
  sich eine einzelne Installation widerrufen, ohne alle anderen mitzutreffen, und
  nur so ist im Audit erkennbar, von wo ein Aufruf kam.
- **Mit Ablaufdatum**, empfohlen 30 Tage (`--expires 720h`). Ein Token ohne Ablauf ist
  für diesen Weg nicht vorgesehen.
- **Nie denselben Token** für Claude Desktop und den ChatGPT-Tunnel („JanuaPort
  Admin" in ChatGPT) oder einen anderen Zugang verwenden.

Auf der Anlage (Zugriff auf das Binary und die Datenbank):

```bash
jnpt admin-token create --label claude-desktop-<name> --expires 720h
```

Der Token erscheint genau einmal. Kopieren Sie ihn direkt in das Feld in Claude
Desktop, nicht in eine Datei oder einen Chat. Widerrufen:

```bash
jnpt admin-token list
jnpt admin-token revoke <id>
```

## Schritte

### 1. Bundle laden und prüfen

Laden Sie `januaport-admin-<version>.mcpb` aus den
[Releases](https://github.com/JanuaPort/januaport-clients/releases) dieses
Repositorys. Das Bundle entsteht ausschließlich im Release-Workflow des
Repositorys, nie von Hand.

Vergleichen Sie den SHA-256 mit dem in der Release-Notiz:

```powershell
Get-FileHash .\januaport-admin-<version>.mcpb -Algorithm SHA256
```

```bash
shasum -a 256 januaport-admin-<version>.mcpb
```

**Der SHA-256 prüft den Transport, nicht die Herkunft:** Wer das Release ändern
kann, ändert auch die Notiz. Die Herkunft belegt die Attestation, die der
Release-Workflow erzeugt (GitHub CLI nötig):

```bash
gh attestation verify januaport-admin-<version>.mcpb --repo JanuaPort/januaport-clients
```

Das Bundle ist **nicht signiert**. Wie Claude Desktop damit umgeht (Warnung,
Sperre oder nichts), ist noch nicht beobachtet und wird hier nachgetragen.

### 2. Installieren

Doppelklick auf die `.mcpb`-Datei, oder in Claude Desktop über die Einstellungen
der Erweiterungen installieren. Claude Desktop fragt drei Felder ab:

| Feld | Wert |
|---|---|
| Address of the installation | Basisadresse, z. B. `https://box.local` (ohne Pfad, also ohne `/admin/mcp`) |
| Admin token | der `jnpt_…`-Wert aus `jnpt admin-token create`, **ohne** „Bearer " |
| Root CA of the installation (PEM) | die `root.crt` der Anlage; leer lassen bei einem öffentlich vertrauten Zertifikat |

### 3. Ausprobieren

Fragen Sie Claude zum Beispiel: „Zeig mir den Katalog der Integrationen meiner
JanuaPort-Anlage." Claude ruft dann `admin_list_catalog` auf. Im Audit der
Anlage erscheint der Aufruf unter dem Label Ihres Admin-Tokens:

```bash
jnpt audit list --limit 5
```

## Fehlermeldungen

Die Brücke antwortet mit einer Meldung auf Deutsch und Englisch. Claude zeigt
sie an, im MCP-Log von Claude Desktop steht sie auch.

| Meldung (Anfang) | Ursache | Was tun |
|---|---|---|
| Nur https:// ist erlaubt / Nur die Basisadresse … | Adresse mit `http://`, mit Pfad oder Query | Nur `https://host[:port]` eintragen; die Brücke startet sonst nicht |
| Admin-Token falsch oder abgelaufen | Die Anlage antwortet 401 | Neuen Token ausstellen (`jnpt admin-token create --expires …`) und eintragen |
| Unter dieser Adresse gibt es keinen Admin-MCP | Die Anlage antwortet 404, meist die öffentliche Adresse | Die Adresse im lokalen Netz nehmen |
| Das Zertifikat der Anlage stammt nicht von einer bekannten CA | Interne CA, aber keine CA-Datei eingetragen | Wurzel-CA der Anlage als Datei hinterlegen |
| Das Zertifikat der Anlage passt nicht zur hinterlegten CA-Datei | Falsche Datei, z. B. von einer anderen Anlage oder das Serverzertifikat | Die `root.crt` genau dieser Anlage hinterlegen |
| CA-Datei … ist nicht lesbar | Datei verschoben, gelöscht oder ohne Leserecht; die Brücke startet dann nicht (kein Rückfall auf die System-CAs) | Datei in den Einstellungen der Erweiterung neu auswählen |
| Die Anlage antwortet mit einer Umleitung | Die Adresse leitet weiter (z. B. auf einen anderen Host) | Die Adresse eintragen, unter der die Anlage direkt antwortet |

Einen Rat, die Zertifikatsprüfung abzuschalten, gibt es hier nicht. Die Brücke
kennt keinen solchen Schalter.

## Grenzen

- Nur der Admin-MCP (`/admin/mcp`). Für die normalen Werkzeuge auf `/mcp` gibt
  es die Wege in [`claude-code-desktop/`](../claude-code-desktop/) und
  [`claude-ai/`](../claude-ai/).
- Kein Fingerabdruck-Pinning: Die Wurzel-CA-Datei ist die Vertrauensgrenze.
- Keine eigene Signatur, kein Eintrag in einem öffentlichen
  Erweiterungsverzeichnis.
- Der Admin-Token liegt auf dem Admin-Rechner und ist (sofern Claude Desktop ihn
  wie beschrieben ablegt, siehe Status) nur durch den
  Schlüsselbund des Betriebssystems geschützt. Wer diesen Rechner als dieser
  Benutzer bedient, kann die Anlage verwalten. Deshalb der kurze Ablauf und ein
  Token je Installation.

## Status

| Was | Stand |
|---|---|
| Brücke, Manifest, Tests | **Gebaut.** Tabellentests mit `node:test`; die Brücke läuft dabei als eigener Prozess gegen einen lokalen HTTPS-Testserver mit zur Laufzeit erzeugter Test-CA: passende, fehlende, falsche und unlesbare CA, 401, 404, Umleitung, Token in keiner Ausgabezeile. |
| Gepacktes Bundle gegen eine Anlage | **Belegt** am 25.09.2026 unter Windows gegen eine Wegwerf-Anlage in Docker (jnpt hinter Caddy mit `tls internal`), ohne Claude Desktop: `initialize`, `tools/list` und `admin_list_catalog` liefen durch, der Aufruf stand im Audit unter dem Label des Admin-Tokens. Mit falscher und ohne CA-Datei scheiterte die Verbindung mit der Zertifikatsmeldung. |
| Ein-Klick in Claude Desktop, Windows | **Nicht belegt.** |
| Ein-Klick in Claude Desktop, macOS | **Nicht belegt.** |
| Umgang von Claude Desktop mit dem unsignierten Bundle | **Nicht beobachtet.** |
| Token im Schlüsselbund statt in einer Datei | **Nicht nachgeprüft.** |

## Entwickeln und bauen

```bash
npm ci
npm test                                  # braucht openssl im PATH (Test-CA)
npx @anthropic-ai/mcpb@2.1.2 pack . januaport-admin-dev.mcpb
```

Einzige Laufzeit-Abhängigkeit ist `@modelcontextprotocol/sdk`, exakt gepinnt.
Ein Release entsteht über einen annotierten Tag `claude-desktop-admin/vX.Y.Z`;
die Version muss in `manifest.json` und `package.json` gleich sein. Der
Workflow testet, baut nur mit den Laufzeit-Abhängigkeiten, prüft sie mit
`npm audit`, packt, nennt den SHA-256 im Log und in der Release-Notiz und
erzeugt die Attestation.

Hintergrund: JanuaPort/januaport#888.
