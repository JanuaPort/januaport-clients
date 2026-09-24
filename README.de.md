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
| [`claude-code-desktop/`](claude-code-desktop/) | Claude Code per Streamable HTTP mit eigenem Token an JanuaPort anbinden, über `claude mcp add` oder `.mcp.json`. Dazu die Grenzen für Claude Desktop und ein Skill zum Bauen von Use Cases. | **Gebaut.** Claude Code mit Bearer-Token ist auf beiden Wegen gegen eine echte Anlage belegt (23.09.2026). Der Skill ist nicht belegt; Claude Desktop verbindet sich wie claude.ai (siehe `claude-ai/`). |
| [`claude-ai/`](claude-ai/) | claude.ai (und Claude Desktop, Mobil-Apps) als eigenen Konnektor mit eigenem OAuth-Client über Microsoft Entra anbinden. | **Gebaut.** Gegen einen echten Mandanten belegt am 24.09.2026: Werkzeugaufruf 2 h 49 min nach der Anmeldung, ohne neu zu verbinden (stille Token-Erneuerung). Das Entra-Anmeldeprotokoll selbst ist nicht eingesehen. |
| [`sso-broker/entra/`](sso-broker/entra/) | Einrichtungsskript für Microsoft Entra ID mit zwei App-Registrierungen, für ChatGPT und claude.ai. | **Gebaut.** Mit ChatGPT und mit claude.ai gegen einen echten Mandanten belegt; das Skript ist am Stück gelaufen (die Anmeldezeile selbst lief dabei nicht mit). |
| weitere Broker-Rezepte (z. B. Keycloak, Dex, ADFS) | OpenID-Connect-Anbieter außer Entra, vor JanuaPort. | **Geplant.** |
| Tunnel-Profile, Zeitplan-Läufer | Client-seitige Profile für die Anbindung ohne offenen Port und Läufer, die JanuaPort nach Zeitplan aufrufen. | **Geplant.** |
