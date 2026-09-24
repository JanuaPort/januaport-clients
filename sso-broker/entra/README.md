# Microsoft Entra: Anmeldung für ChatGPT und claude.ai

Ein Skript legt im Entra-Mandanten die beiden App-Registrierungen an, über die
sich Nutzer mit ihrem Firmenkonto an JanuaPort anmelden — aus ChatGPT, aus
claude.ai und (optional) in der Oberfläche der Anlage. JanuaPort selbst ist
dabei nur **Resource Server**: Es prüft das Entra-Token, die Anmeldung läuft
zwischen KI-Client und Entra.

**Status:** siehe [unten](#status). Kurz: der Aufbau ist mit ChatGPT gegen
einen echten Mandanten belegt, ebenso claude.ai mit der Client-Registrierung
(24.09.2026, ohne Blick ins Entra-Protokoll); das Skript ist am Stück gelaufen.

## Warum zwei Registrierungen

ChatGPT und claude.ai erneuern ihr Zugangs-Token still über den
`refresh_token`-Grant — **ohne** `scope`-Parameter (RFC 6749 erlaubt das).
Entra v2 braucht den Scope, um die Ziel-Ressource zu bestimmen; fehlt er, nimmt
es die anfragende Client-App selbst als Ressource. Ist die Client-App dieselbe
Registrierung wie die Ressource, lehnt Entra jede Erneuerung mit
**`AADSTS90009`** ab, und die Verbindung bricht 60–90 Minuten nach der
Anmeldung ab (so lange lebt ein Entra-Zugangs-Token).

Mit einer **getrennten Client-Registrierung** ist die Client-App nie die
Ressource; Entra leitet die Ressource aus der ursprünglichen Zustimmung ab, und
die Erneuerung gelingt — unabhängig davon, in welcher Form der Scope
geschrieben ist.

| Registrierung | Rolle | Trägt |
|---|---|---|
| **„JanuaPort MCP"** (Ressource) | das, wofür das Token ausgestellt wird (`aud`) | den Bereich `access`, Token-Version 2, die Adressen der Anlage als App-ID-URIs; optional die Rückruf-URI der Oberfläche |
| **„JanuaPort KI-Clients"** (Client) | der OAuth-Client, den ChatGPT und claude.ai benutzen | öffentlicher Client (PKCE, kein Geheimnis), die Rückruf-URIs der KI-Clients, Berechtigung auf `access` der Ressource **und** auf Microsoft Graph `openid`, `profile`, `offline_access`, Admin-Einwilligung |

`offline_access` ist Pflicht: ohne ihn stellt Entra kein Refresh-Token aus.

## Voraussetzungen

- PowerShell 7 und das Modul Microsoft Graph PowerShell
  (`Install-Module Microsoft.Graph`).
- Ein Konto mit der Rolle **Anwendungsadministrator** (oder höher) im Mandanten
  — das Skript erteilt die Admin-Einwilligungen selbst.
- Die öffentliche Adresse der Anlage (`<host>`, z. B. `jnpt.beispiel.de`).
  `https://<host>/mcp` wird App-ID-URI; Entra verlangt dafür je nach
  Mandanten-Richtlinie eine **verifizierte Domäne** des Mandanten (siehe
  Grenzen).
- Für ChatGPT die Rückruf-Adresse aus dem Verbindungsdialog
  (`https://chatgpt.com/connector/oauth/<id>`, siehe Schritt 3). Sie lässt sich
  auch später ergänzen.

## Schritte

**1. Skript ausführen**

```powershell
.\entra-sso-app.ps1 -BoxHost jnpt.beispiel.de `
  -ClientRedirectUris "https://claude.ai/api/mcp/auth_callback","https://chatgpt.com/connector/oauth/<id>"
```

Weitere Parameter: `-Views buchhaltung,einkauf` trägt je Team-Sicht
`https://<host>/mcp/v/<sicht>` als App-ID-URI ein; `-UiHost <adresse>` trägt
die Rückruf-URI der Oberfläche (`https://<adresse>/me/callback`) an der
Ressource ein und erteilt deren Einwilligung — leer lassen, wenn sich an der
Anlage niemand im Browser anmeldet. Die Oberflächen-Adresse ist **nicht** die
MCP-Adresse.

**Anmeldung:** Das Skript meldet sich über Microsoft Graph PowerShell an. Unter
Windows öffnet das ein Anmeldefenster des Betriebssystems; aus einem Terminal
ohne sichtbares Fenster (eingebettete Terminals, Remote-Sitzungen) scheitert das
mit „A window handle must be configured". Dann `-UseDeviceCode` anhängen: das
Skript nennt einen Code für `https://login.microsoft.com/device`. Der Code gilt
nur rund **zwei Minuten** — vorher die Seite öffnen. Beim ersten Einsatz im
Mandanten fragt Microsoft Graph PowerShell zusätzlich nach der Zustimmung zu
den eigenen Berechtigungen.

Das Skript gibt am Ende nur öffentliche Bezeichner aus: Verzeichnis-ID, die
beiden Anwendungs-IDs und die Werte für die Anlage.

**2. Werte in die Anlage** (`.env` neben der Compose-Datei, danach Container
neu erzeugen — `docker compose up -d`, ein Reload genügt nicht):

```
JNPT_PUBLIC_URL=https://<host>/mcp
JNPT_SSO_ISSUER=https://login.microsoftonline.com/<verzeichnis-id>/v2.0
JNPT_SSO_AUDIENCE=<anwendungs-id-der-ressource>
JNPT_SSO_AUTH_SCOPE=api://<anwendungs-id-der-ressource>/access offline_access
JNPT_SSO_CLIENT_ID=<anwendungs-id-des-clients>
```

`JNPT_SSO_CLIENT_ID` prüft JanuaPort nicht; die Anlage zeigt den Wert nur an,
damit niemand die Ressourcen-ID in den Client-Dialog einträgt — genau das
reproduziert `AADSTS90009`.

**3. KI-Clients verbinden** — jeder Nutzer selbst, mit den Werten vom Admin:

*claude.ai* (Connector hinzufügen): Connector-URL `https://<host>/mcp` (bzw.
`/mcp/v/<sicht>`), in den erweiterten Einstellungen als **OAuth Client ID** die
Anwendungs-ID des **Clients**, kein Geheimnis. Issuer, Endpunkte und Scopes
liest claude.ai selbst aus der Discovery der Anlage
(`/.well-known/oauth-protected-resource/mcp`). Rückruf-URI:
`https://claude.ai/api/mcp/auth_callback` (fest, im Skript-Aufruf oben
enthalten).

*ChatGPT* (Verbindung über einen Tunnel, *Erweiterte OAuth-Einstellungen →
Benutzerdefinierter OAuth-Client*):

| Feld | Wert |
|---|---|
| OAuth-Client-ID | Anwendungs-ID des **Clients** — nicht die der Ressource |
| OAuth-Client-Geheimnis | leer (öffentlicher Client, PKCE) |
| Authentifizierung am Token-Endpunkt | `none` |
| Basis-URL des Autorisierungsservers | `https://login.microsoftonline.com/<verzeichnis-id>/v2.0` |
| Autorisierungs-Endpunkt | `https://login.microsoftonline.com/<verzeichnis-id>/oauth2/v2.0/authorize` |
| Token-Endpunkt | `https://login.microsoftonline.com/<verzeichnis-id>/oauth2/v2.0/token` |
| Registrierungs-URL | leer (Entra kennt keine dynamische Client-Registrierung) |
| Basis-Scopes | zwei Einträge: `api://<anwendungs-id-der-ressource>/access` und `offline_access` (keine Leerzeichen-Liste) |
| Ressource | die volle Adresse: `https://<host>/mcp` bzw. `https://<host>/mcp/v/<sicht>` |
| OIDC-Erkennung | aus |

Nach dem Anlegen zeigt der Dialog die Rückruf-Adresse
`https://chatgpt.com/connector/oauth/<id>`. Sie gehört an die
**Client**-Registrierung (*Authentifizierung → Mobile Geräte und
Desktopcomputer*), **vor** der ersten Anmeldung — die Liste ergänzen, nie
ersetzen. Der Dialog ist danach nicht mehr editierbar: ein falscher Wert heißt
neue Verbindung anlegen, alte trennen.

**4. Freigabe in JanuaPort:** Nach der ersten Anmeldung erscheint der Nutzer in
der Oberfläche als gesehene Identität und wird dort aktiviert (oder seine Gruppe
am Team freigegeben). Bis dahin meldet der Client „Autorisierung fehlgeschlagen"
— gewollt, kein Fehler.

## Prüfen

**Manifeste gegenlesen** (Entra → App-Registrierung → Manifest → Download;
enthält keine Geheimnisse):

| Feld | Ressource „JanuaPort MCP" | Client „JanuaPort KI-Clients" |
|---|---|---|
| `signInAudience` | `AzureADMyOrg` | `AzureADMyOrg` |
| `isFallbackPublicClient` | `true` | `true` |
| `api.requestedAccessTokenVersion` | **`2`** (Portal-Default `null` = v1 → Login ok, JanuaPort 401) | ohne Belang: die Token-Version bestimmt die Ressource |
| `identifierUris` | `api://<ressource-id>` und `https://<host>/mcp` (+ je Sicht) | leer |
| `api.oauth2PermissionScopes` | ein Bereich `access`, `isEnabled: true` | leer |
| `requiredResourceAccess` | Graph `User.Read` und der eigene Bereich `access` | Ressource `access` **und** Graph `openid`, `profile`, `offline_access` |
| `publicClient.redirectUris` | nur die Oberfläche (`https://<adresse>/me/callback`), sonst leer | die Rückruf-URIs von claude.ai und ChatGPT |
| `spa.redirectUris`, `web.redirectUris` | leer | leer |
| `passwordCredentials`, `keyCredentials` | leer | leer |

Die drei Graph-Berechtigungen haben die festen IDs
`37f7f235-527c-4136-accd-4a02d197296e` (`openid`),
`14dad69e-099b-42c9-810b-d002981feec1` (`profile`),
`7427e0e9-2fba-42fe-b0c0-848c9e6a8182` (`offline_access`).

**Discovery der Anlage:**

```
curl -s https://<host>/.well-known/oauth-protected-resource/mcp
```

muss `resource` = die Adresse, `authorization_servers` = den Issuer und
`scopes_supported` = den Scope zeigen. Stimmt hier etwas nicht, liegt es an der
`.env`, nicht an Entra.

**Der eigentliche Beleg:** ein Werkzeugaufruf **mehr als 90 Minuten** nach der
Anmeldung, ohne neu zu verbinden, muss gelingen — und im Entra-Protokoll
*Anmeldeprotokolle → Nicht interaktive Anmeldungen*, gefiltert auf die
Client-Registrierung, steht ein **Erfolg**. Das Protokoll hinkt 25 Minuten bis
zwei Stunden nach.

| Meldung | Ursache |
|---|---|
| `AADSTS90009`, Verbindung stirbt nach 60–90 min | Client und Ressource sind dieselbe Registrierung — im Client-Dialog steht die Ressourcen-ID |
| `AADSTS50011` | Rückruf-URI fehlt an der Client-Registrierung (bzw. Oberfläche: an der Ressource) |
| `AADSTS7000218` | Rückruf-URI unter „Web" statt „Mobile Geräte und Desktopcomputer" |
| `AADSTS9010010` | Adresse nicht als App-ID-URI der Ressource eingetragen |
| `AADSTS900144` | Client sendet keinen Scope (Basis-Scopes leer) |
| Login gelingt, JanuaPort antwortet 401 | Token-Version 1 an der Ressource, oder Issuer/Audience in der `.env` falsch |

## Grenzen

- **Einmalige Einrichtung je Mandant.** Entra kennt keine dynamische
  Client-Registrierung; „null Setup" gilt je Nutzer, nicht für den Admin.
- **Jede neue Team-Sicht braucht eine App-ID-URI an der Ressource, jeder neue
  KI-Client eine Rückruf-URI am Client.** Beides sind ersetzende Listen:
  ergänzen, nie überschreiben.
- **App-ID-URIs unter `https://`:** Entra nimmt sie je nach
  Mandanten-Richtlinie nur unter einer verifizierten Domäne des Mandanten an.
  Registrierungen mit Token-Version 2 sind von der Standard-Richtlinie
  ausgenommen, deshalb setzt das Skript beides im selben Aufruf
  ([Microsoft: Restrictions on identifier URIs](https://learn.microsoft.com/en-us/entra/identity-platform/identifier-uri-restrictions)).
  Lehnt Entra trotzdem ab, eine Adresse unter einer verifizierten Domäne wählen.
- **Das Skript ist nicht idempotent.** Ein zweiter Lauf legt zwei neue
  Registrierungen an. Nach einem Abbruch die halb angelegten Registrierungen in
  Entra löschen und neu starten.
- **Registrierungen nie neu anlegen, um sie umzubenennen** — neue Client-ID,
  verlorene Zustimmungen, alle Verbindungen neu.
- **Ein Adresswechsel der Anlage** macht alle bestehenden Verbindungen ungültig.
- **Nur Microsoft Entra.** Andere Identitätsanbieter (Keycloak, Dex, ADFS …)
  sind hier noch nicht belegt.

## Status

| Was | Stand |
|---|---|
| Aufbau mit zwei Registrierungen, **ChatGPT** | **belegt am 21.09.2026** gegen einen echten Mandanten: stille Token-Erneuerung (Erfolg im nicht-interaktiven Protokoll) und Werkzeugaufruf 2 h 49 min nach der Anmeldung, ohne neu zu verbinden; vorher mit einer Registrierung reproduzierbar `AADSTS90009` |
| Aufbau mit zwei Registrierungen, **claude.ai** | **belegt am 24.09.2026** gegen einen echten Mandanten: Werkzeugaufruf 2 h 49 min nach der Anmeldung, über einen Neustart der Anlage hinweg, ohne neu zu verbinden und ohne dass claude.ai eine Anmeldung verlangte. Kein 401 und kein `invalid_token` im Zugriffsprotokoll der Anlage. Der Mandant hat keine eigene Token-Lebensdauer (Zugangs-Token 60–90 Minuten), die Verbindung wurde also still erneuert. Das nicht interaktive Anmeldeprotokoll von Entra ist dabei **nicht eingesehen** (Anleitung: [`../../claude-ai/`](../../claude-ai/README.md)) |
| Das Skript | die Graph-Aufrufe entsprechen denen, mit denen die belegte Client-Registrierung angelegt wurde; deren Manifest und Einwilligungen am 23.09.2026 gegen die Prüftabelle oben gelesen: deckungsgleich. **Am Stück gelaufen am 23.09.2026** (PowerShell 7.6, Microsoft Graph PowerShell 2.40, echter Mandant, Wegwerf-Registrierungen mit Sicht und Oberflächen-Adresse): beide Manifeste und alle vier Einwilligungen deckungsgleich mit der Prüftabelle. Die Anmeldezeile lief dabei nicht mit — angemeldet wurde vorab mit einem Token der Azure CLI; `-UseDeviceCode` ist bis zur Code-Anzeige belegt |
