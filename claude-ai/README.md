# claude.ai (und Claude Desktop) an JanuaPort anbinden

claude.ai verbindet sich mit JanuaPort als **eigener Konnektor** mit OAuth: Jede
Person meldet sich mit ihrem Firmenkonto beim Anmeldedienst des Betreibers an,
JanuaPort prüft nur das ausgestellte Token (Resource Server). Die Verbindung
baut **Anthropic aus seiner Cloud** auf. Das gilt für claude.ai, Claude Desktop
und die Mobil-Apps gleichermaßen; Claude Desktop hat also keinen eigenen Weg,
sondern nutzt diesen.

**Status:** siehe [unten](#status). Kurz: claude.ai mit eigenem OAuth-Client ist gegen
einen echten Mandanten belegt, die stille Erneuerung nach mehr als 90 Minuten inklusive.

## Voraussetzungen

- Die Anlage ist **öffentlich** unter `https://<host>/mcp` erreichbar, mit
  gültigem TLS-Zertifikat. Ein Konnektor aus der Anthropic-Cloud erreicht
  weder ein Intranet noch ein Tailnet.
- SSO ist an der Anlage eingerichtet, mit **zwei** App-Registrierungen:
  Ressource und getrennter Client. Einrichtung, Skript und Begründung:
  [`../sso-broker/entra/`](../sso-broker/entra/README.md). Mit nur einer
  Registrierung bricht die Verbindung nach 60–90 Minuten ab (`AADSTS90009`).
- Die Anwendungs-ID der **Client**-Registrierung (nicht der Ressource). Der
  Admin findet sie in der Oberfläche der Anlage unter „Werte für den
  Client-Dialog".

## Schritte

1. In claude.ai unter **Einstellungen → Konnektoren** einen eigenen Konnektor
   hinzufügen. URL: `https://<host>/mcp` (oder `/mcp/v/<sicht>` für eine
   Sicht), ohne Schrägstrich am Ende.
2. In den erweiterten Einstellungen **„Eigenen OAuth-Client verwenden"** und als
   **OAuth Client ID** die Anwendungs-ID der Client-Registrierung eintragen.
   **Kein Client Secret**, es ist ein öffentlicher Client.
3. Verbinden und mit dem Firmenkonto anmelden. Issuer, Endpunkte und Scopes
   liest claude.ai selbst aus der Discovery der Anlage.
4. Hat eine Person schon einen alten Konnektor auf dieselbe Adresse: den alten
   löschen, damit nur eine Verbindung übrig bleibt.

## Prüfen

1. In einem Chat: „Rufe das JanuaPort-Werkzeug `ping` auf." Die Antwort kommt
   von der Anlage, im Audit steht der Aufruf mit der Identität der Person.
2. **Der eigentliche Test:** den Konnektor mindestens 95 Minuten liegen lassen
   und dann erneut ein Werkzeug aufrufen. Er muss **ohne** „Erneut verbinden"
   durchgehen. Im Anmeldeprotokoll des Anbieters steht dann eine erfolgreiche
   nicht interaktive Anmeldung für die Client-Registrierung, kein
   `AADSTS90009`.

## Grenzen

- **Öffentlicher Endpunkt nötig.** Für Anlagen ohne offene Web-Ports ist dieser
  Weg nicht nutzbar; dort ist Claude Code der passende Client
  ([`../claude-code-desktop/`](../claude-code-desktop/README.md)).
- **Nur Microsoft Entra belegt.** Andere Anbieter folgen mit den
  Broker-Rezepten.
- Der Konnektor-Dialog von claude.ai bietet weitere Optionen (z. B. „Bei Bedarf
  anmelden", eigene Request-Header). Sie sind hier nicht geprüft.

## Status

| Was | Stand |
|---|---|
| claude.ai, eigener OAuth-Client (Entra, zwei Registrierungen) | **belegt am 24.09.2026** gegen einen echten Mandanten: Werkzeugaufruf 2 h 49 min nach der Anmeldung, über einen Neustart der Anlage hinweg, ohne neu zu verbinden und ohne dass claude.ai eine Anmeldung verlangte. Kein 401 und kein `invalid_token` im Zugriffsprotokoll der Anlage. Der Mandant hat keine eigene Token-Lebensdauer (Zugangs-Token 60–90 Minuten), die Verbindung wurde also still erneuert. Das nicht interaktive Anmeldeprotokoll von Entra ist dabei **nicht eingesehen** |
| Claude Desktop | derselbe Weg wie claude.ai (Verbindung aus der Anthropic-Cloud), nicht eigens geprüft |
| Mobil-Apps | derselbe Weg, nicht eigens geprüft |
