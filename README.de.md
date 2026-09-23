# januaport-clients

[English](README.md) · **Deutsch**

Eingang für JanuaPort: wie KI-Clients und Identitätsanbieter an das Gateway andocken.

JanuaPort ist ein self-hosted MCP-Gateway. Es verbindet KI-Assistenten fein berechtigt mit den
bestehenden Systemen eines Unternehmens und protokolliert die Zugriffe in einem append-only Audit-Log. Der
Kern von JanuaPort ist proprietäre Software der JanuaPort GmbH und nicht Teil dieses Repositorys. Dieses
Repository ist einer der offenen Ränder darum herum.

- **Lizenz:** Apache License 2.0 ([`LICENSE`](LICENSE), [`NOTICE`](NOTICE))
- **Links:** [januaport.ai](https://januaport.ai) · [Sicherheitsrichtlinie](SECURITY.md) · [Beiträge](CONTRIBUTING.md)

Keine Kundendaten, keine Schlüssel, keine Betreiberwerte in diesem Repository.

---

## Anmeldung: OpenID Connect

JanuaPort nimmt die Anmeldung seiner Nutzer von einem OpenID-Connect-Anbieter entgegen und prüft nur das
Token; einen eigenen Identitätsanbieter betreibt es nicht. Belegt ist heute Microsoft Entra ID. Rezepte für
weitere Anbieter, die als Broker vor JanuaPort stehen, sind geplant und erscheinen hier, offen.

## Inhalt

Kennzeichnung: **Gebaut** · **Im Bau** · **Geplant**. Jeder Eintrag sagt, was genau belegt ist.

| Ordner | Worum es geht | Stand |
|---|---|---|
| [`claude-code-desktop/`](claude-code-desktop/) | Claude Code per Streamable HTTP mit eigenem Token an JanuaPort anbinden, über `claude mcp add` oder `.mcp.json`. Dazu die Grenzen für Claude Desktop und ein Skill zum Bauen von Use Cases. | **Gebaut.** Claude Code mit Bearer-Token ist auf beiden Wegen gegen eine echte Anlage belegt (23.09.2026). Skill und Claude Desktop sind nicht belegt. |
| [`sso-broker/entra/`](sso-broker/entra/) | Einrichtungsskript für Microsoft Entra ID mit zwei App-Registrierungen, für ChatGPT und claude.ai. | **Gebaut.** Mit ChatGPT gegen einen echten Mandanten belegt; das Skript ist am Stück gelaufen (die Anmeldezeile selbst lief dabei nicht mit). claude.ai ist noch nicht belegt. |
| weitere Broker-Rezepte (z. B. Keycloak, Dex, ADFS) | OpenID-Connect-Anbieter außer Entra, vor JanuaPort. | **Geplant.** |
| Tunnel-Profile, Zeitplan-Läufer | Client-seitige Profile für die Anbindung ohne offenen Port und Läufer, die JanuaPort nach Zeitplan aufrufen. | **Geplant.** |
