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

Claude Desktop startet das Bundle als lokalen Node.js-Prozess. Welche
Node-Laufzeit es dafür tatsächlich verwendet, ist noch nicht belegt; das
Manifest verlangt Node >=20. Eine kleine Brücke reicht jede MCP-Nachricht unverändert an
`<Adresse>/admin/mcp` weiter (Streamable HTTP, `Authorization: Bearer <Token>`)
und die Antwort zurück.

- **Token:** Das Feld ist maskiert (`sensitive`). Laut Anthropic legt Claude
  Desktop solche Werte im Schlüsselbund des Betriebssystems ab, nicht in einer
  Datei. Das steht bisher nur in einem Blogbeitrag, nicht in der Spezifikation,
  und ist für dieses Bundle **noch nicht nachgeprüft** (siehe Status). An die
  Brücke geht der Token nur über eine Umgebungsvariable, nie als
  Kommandozeilen-Argument, denn die stehen in der Prozessliste.
- **TLS:** Die Zertifikatsprüfung ist immer an und lässt sich nicht
  ausschalten (K2: fail closed). Nodes bisherige Standard-CAs gelten; eine interne
  Wurzel-CA (z. B. von Caddy mit `tls internal`) kommt als Datei dazu. Mit
  `NODE_TLS_REJECT_UNAUTHORIZED=0`, einer unlesbaren CA-Datei oder einer Datei
  ohne PEM-Zertifikat startet die Brücke nicht (Exit 2, vor jeder Anfrage).
  Ab Node 22.19 in der 22.x-Reihe und 24.5 in der 24.x-Reihe liest die Brücke
  die Datei selbst und ergänzt die bisherigen Standard-CAs im Code. Auf älteren
  Nodes bleibt die Wirkung von `NODE_EXTRA_CA_CERTS` beim Node-Start abhängig.
- **Direkte Verbindung:** Mit `NODE_USE_ENV_PROXY=1` oder `--use-env-proxy`
  in `NODE_OPTIONS` oder den Node-Startargumenten startet die Brücke nicht
  (Exit 2, vor jeder Anfrage). Diese Einschaltwege entfernen und den Prozess neu
  starten. `HTTPS_PROXY` allein aktiviert Nodes Env-Proxy nicht.
- **Keine Umleitung:** Antwortet die Anlage mit einer Umleitung, bricht die
  Brücke ab, statt den Token an eine andere Adresse zu schicken.
- **Kein OAuth, keine Anmeldung per SSO.** Bei einem abgelehnten Token kommt
  eine klare Meldung, kein Anmeldefenster (K1: ein 401 bleibt ein 401).
- **Logs** gehen nur auf stderr ins MCP-Log von Claude Desktop, nie mit dem
  Token. stdout gehört allein dem JSON-RPC-Strom.

### Node-Laufzeit: Proxy und zusätzliche CAs

Die offiziellen CLI- und TLS-Dokumentationen der beiden Node-Reihen nennen:

| Funktion | Node 22.x ab | Node 24.x ab |
|---|---|---|
| `NODE_USE_ENV_PROXY=1` | 22.21.0 | 24.0.0 |
| `--use-env-proxy` (auch in `NODE_OPTIONS`) | 22.21.0 | 24.5.0 |
| `tls.getCACertificates()` | 22.15.0 | 24.0.0 (eingeführt in 23.10.0, zurückportiert nach 22.15.0) |
| `tls.setDefaultCACertificates()` | 22.19.0 | 24.5.0 |

Quellen: CLI [22.x](https://nodejs.org/docs/latest-v22.x/api/cli.html#node_use_env_proxy1)
und [24.x](https://nodejs.org/docs/latest-v24.x/api/cli.html#node_use_env_proxy1),
CLI-Schalter [22.x](https://nodejs.org/docs/latest-v22.x/api/cli.html#--use-env-proxy)
und [24.x](https://nodejs.org/docs/latest-v24.x/api/cli.html#--use-env-proxy),
TLS [22.x](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlssetdefaultcacertificatescerts)
und [24.x](https://nodejs.org/docs/latest-v24.x/api/tls.html#tlssetdefaultcacertificatescerts),
CA-Abfrage [22.x](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlsgetcacertificatestype)
und [24.x](https://nodejs.org/docs/latest-v24.x/api/tls.html#tlsgetcacertificatestype).

Als Einschaltwert der Umgebungsvariable ist ausschließlich `1` dokumentiert.
Die Brücke prüft genau diesen Wert und das dokumentierte Flag; die laut
[CLI-Optionssyntax](https://nodejs.org/docs/latest-v24.x/api/cli.html#options)
gleichwertige Unterstrich-Schreibweise zählt ebenfalls. `NODE_OPTIONS` wird als
Optionsliste mit doppelten Anführungszeichen gelesen; ein Flag-Text innerhalb
eines Optionswerts zählt nicht als Schalter. Die Behandlung maskierter Zeichen
entspricht Nodes
[`ParseNodeOptionsEnvVar`](https://github.com/nodejs/node/blob/v24.5.0/src/node_options.cc).
Node liest die Proxy-Umgebung laut CLI-Doku **beim Prozessstart**. Deshalb
verweigert die Brücke den Start bei diesen Einschaltwegen, statt die Variablen
nachträglich zu ändern. Auf älteren Nodes wird `NODE_USE_ENV_PROXY=1` ebenfalls
abgewiesen; ein dort unbekanntes CLI-Flag weist Node bereits selbst ab.

Auch [`NODE_EXTRA_CA_CERTS`](https://nodejs.org/docs/latest-v24.x/api/cli.html#node_extra_ca_certsfile)
wird von Node nur beim Start gelesen. Sind beide TLS-APIs verfügbar, ergänzt
die Brücke vor der ersten Verbindung `tls.getCACertificates('default')` um
alle PEM-Zertifikate der Datei und setzt sie mit `tls.setDefaultCACertificates()`.
Die bisherigen Standard-CAs bleiben erhalten. Ohne beide APIs bleibt es beim
bisherigen Startzeit-Weg. Lesbarkeit und mindestens ein vollständiger
PEM-Zertifikatsblock werden auf beiden Wegen geprüft.

Das eingebaute [`fetch`](https://nodejs.org/docs/latest-v24.x/api/globals.html#fetch)
basiert auf undici. Dass es die im Code ergänzten Standard-CAs nutzt, belegt
`test/bridge.test.js` am echten SDK-Adapter gegen ein HTTPS-Fake-Gateway mit
Test-CA: Der Kindprozess startet ohne `NODE_EXTRA_CA_CERTS`, prüft die leere
Extra-CA-Liste und setzt erst danach den CA-Pfad für die Brücke. `initialize`
und `tools/list` gelingen; mit falscher CA scheitert TLS vor jeder HTTP-Anfrage.
Es gibt dafür keine zusätzliche Laufzeit-Abhängigkeit und keinen eigenen
Agent oder Dispatcher.

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
gh attestation verify januaport-admin-<version>.mcpb --repo JanuaPort/januaport-clients --source-ref refs/tags/claude-desktop-admin/v<version>
```

`<version>` durch die gewählte Version ersetzen. Der dokumentierte
[`--source-ref`-Schalter](https://cli.github.com/manual/gh_attestation_verify)
prüft zusätzlich die Quell-Referenz des Release-Tags. Der Workflow prüft, dass
dessen Commit ein Vorfahr von `origin/main` ist. Diese Prüfung steht im Workflow
des getaggten Commits selbst: Sie fängt Versehen ab, aber kein Konto mit
Schreibrecht, das den Workflow ändern kann. Dagegen schützen nur der Schutz der
Tags und der Schutz von `main` in den Repository-Einstellungen; eine Attestation
allein ersetzt beides nicht.

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
| Start verweigert: NODE_TLS_REJECT_UNAUTHORIZED=0 | Die Umgebung schaltet Nodes Zertifikatsprüfung ab; Exit 2 vor jeder Anfrage | Variable entfernen; bei interner CA die Wurzel-CA als Datei hinterlegen |
| Start verweigert: Env-Proxy aktiviert | `NODE_USE_ENV_PROXY=1` oder `--use-env-proxy` in `NODE_OPTIONS` oder den Node-Startargumenten; Exit 2 vor jeder Anfrage | Variable und Flag entfernen, Prozess neu starten und Anlage direkt erreichen |
| Admin-Token enthält Zeichen außerhalb von Latin-1 / Admin-Token ohne „Bearer " eintragen | Kopierfehler oder mitkopiertes Bearer-Präfix; die Brücke startet nicht | Nur den ausgegebenen Token in das Feld kopieren, ohne Präfix |
| Admin-Token falsch oder abgelaufen | Die Anlage antwortet 401 | Neuen Token ausstellen (`jnpt admin-token create --expires …`) und eintragen |
| Unter dieser Adresse gibt es keinen Admin-MCP | Die Anlage antwortet 404, meist die öffentliche Adresse | Die Adresse im lokalen Netz nehmen |
| Das Zertifikat der Anlage stammt nicht von einer bekannten CA | Interne CA, aber keine CA-Datei eingetragen | Wurzel-CA der Anlage als Datei hinterlegen |
| Das Zertifikat der Anlage passt nicht zur hinterlegten CA-Datei | Falsche Datei, z. B. von einer anderen Anlage oder das Serverzertifikat | Die `root.crt` genau dieser Anlage hinterlegen |
| CA-Datei … ist nicht lesbar | Datei verschoben, gelöscht oder ohne Leserecht; die Brücke startet dann nicht (kein Rückfall auf die bisherigen Standard-CAs) | Datei in den Einstellungen der Erweiterung neu auswählen |
| CA-Datei … enthält kein PEM-Zertifikat | Lesbare Datei ohne vollständigen PEM-Zertifikatsblock; Exit 2 vor jeder Anfrage | Die Wurzel-CA als PEM-Datei hinterlegen (`-----BEGIN CERTIFICATE-----` bis `-----END CERTIFICATE-----`) |
| Die Anlage antwortet mit einer Umleitung | Die Adresse leitet weiter (z. B. auf einen anderen Host) | Die Adresse eintragen, unter der die Anlage direkt antwortet |
| Verbindung zur Anlage fehlgeschlagen: 502: … | Zum Beispiel ein Proxyfehler; die Antwort der Anlage wird mit geschwärztem Token ausgegeben | Den Antworttext für die Diagnose verwenden |
| Benachrichtigung fehlgeschlagen | Eine MCP-Benachrichtigung konnte nicht zugestellt werden | Verbindung prüfen; Benachrichtigungen haben keine JSON-RPC-Antwort, die Diagnose steht im MCP-Log |

Einen Rat, die Zertifikatsprüfung abzuschalten, gibt es hier nicht. Die Brücke
kennt keinen solchen Schalter.
Ein sauberes Beenden erzeugt keine Verbindungsfehlermeldung für den dabei
ausgelösten Abbruch.

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
| Brücke, Manifest, Tests | **Gebaut.** Tabellentests mit `node:test`; die Brücke läuft dabei als eigener Prozess gegen einen lokalen HTTPS-Testserver mit zur Laufzeit erzeugter Test-CA: passende, fehlende, falsche, unlesbare und PEM-lose CA, CA-Pfad erst nach Node-Start, Env-Proxy-Einschaltwege und Gegenproben, TLS-Abschaltung in der Umgebung, ungültige Token, 401, 404, 502 mit geschwärztem Antworttext, Umleitung, Benachrichtigungsfehler und sauberes Beenden; Token in keiner Ausgabezeile. |
| Gepacktes Bundle gegen eine Anlage | **Belegt** am 25.09.2026 unter Windows gegen eine Wegwerf-Anlage in Docker (jnpt hinter Caddy mit `tls internal`), ohne Claude Desktop: `initialize`, `tools/list` und `admin_list_catalog` liefen durch, der Aufruf stand im Audit unter dem Label des Admin-Tokens. Mit falscher und ohne CA-Datei scheiterte die Verbindung mit der Zertifikatsmeldung. |
| Ein-Klick in Claude Desktop, Windows | **Nicht belegt.** |
| Ein-Klick in Claude Desktop, macOS | **Nicht belegt.** |
| Umgang von Claude Desktop mit dem unsignierten Bundle | **Nicht beobachtet.** |
| Token im Schlüsselbund statt in einer Datei | **Nicht nachgeprüft.** |

## Entwickeln und bauen

Die Tests brauchen Git, Bash und OpenSSL im PATH sowie Zugriff auf die
npm-Registry für die echten Installations- und Pack-Gegenproben. Unter Windows
kann Bash aus Git für Windows verwendet werden.

```bash
npm ci --ignore-scripts
npm test                                  # braucht openssl im PATH (Test-CA)
staging="$(mktemp -d)"
cp manifest.json package.json package-lock.json .mcpbignore "$staging/"
cp -R server "$staging/server"
npm ci --prefix "$staging" --omit=dev --ignore-scripts
npm audit --omit=dev --audit-level=moderate
node_modules/.bin/mcpb validate "$staging/manifest.json"
node_modules/.bin/mcpb pack "$staging" januaport-admin-dev.mcpb
```

Die Pack-Befehle sind für Bash (unter Windows z. B. Git Bash). Den temporären
Ordner anschließend entfernen.
Einzige Laufzeit-Abhängigkeit ist `@modelcontextprotocol/sdk`, exakt gepinnt.
Das Packwerkzeug `@anthropic-ai/mcpb` ist als devDependency exakt auf 2.1.2 im
Lockfile festgelegt. Es läuft aus `node_modules/.bin`, ohne Nachinstallation.
Gepackt wird ausschließlich die Kopie mit frischen Produktionsabhängigkeiten;
die devDependencies im Arbeitsordner gelangen nicht ins Bundle. Ein Test führt
die Release-Packschritte aus und prüft den ZIP-Inhalt gegen das Lockfile.
Ein Release entsteht über einen annotierten Tag `claude-desktop-admin/vX.Y.Z`;
der Tag-Commit muss ein Vorfahr von `origin/main` sein (Schutz gegen Versehen,
nicht gegen ein Konto mit Schreibrecht, siehe Abschnitt 1) und die Version muss in
`manifest.json`, `package.json` und beiden Wurzeleinträgen von `package-lock.json`
gleich sein. Der
Workflow testet, baut nur mit den Laufzeit-Abhängigkeiten, prüft sie mit
`npm audit --omit=dev --audit-level=moderate` und bricht bereits bei Befunden mit
Schwere `moderate` ab. Danach packt er, nennt den SHA-256 im Log und in der
Release-Notiz und erzeugt die Attestation. Diese Audit-Schwelle gilt auch im
CI-Workflow (JanuaPort/januaport#1494).

Hintergrund: JanuaPort/januaport#888.
