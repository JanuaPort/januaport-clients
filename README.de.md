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

## KI-Clients auf einen Blick

Wie sich verbreitete KI-Clients an `/mcp` anmelden und was davon belegt ist. „Belegt“ heißt: ein echter
Werkzeugaufruf mit Audit-Eintrag, mit Datum und Client-Version. Alles andere heißt **ungetestet**.

| Client | Anleitung | Bearer-Token | OAuth/SSO | Stand |
|---|---|---|---|---|
| Claude Code | [`claude-code-desktop/`](claude-code-desktop/) | belegt | ungetestet | Bearer belegt am 23.09.2026 |
| claude.ai, Claude Desktop | [`claude-ai/`](claude-ai/) | – | belegt (Entra) | SSO belegt am 24.09.2026 |
| ChatGPT | [`sso-broker/entra/`](sso-broker/entra/) | – | belegt (Entra) | SSO belegt am 21.09.2026 |
| Codex | [`codex/`](codex/) | belegt | ungetestet | Bearer belegt am 30.10.2026 mit Codex CLI 0.162.1 gegen JanuaPort 0.89.0 |
| Cursor | [`cursor/`](cursor/) | ungetestet | ungetestet | ungetestet |
| Gemini CLI | [`gemini-cli/`](gemini-cli/) | ungetestet | ungetestet | ungetestet |

## Inhalt

Kennzeichnung: **Gebaut** · **Im Bau** · **Geplant**. Jeder Eintrag sagt, was genau belegt ist.

| Ordner | Worum es geht | Stand |
|---|---|---|
| [`claude-code-desktop/`](claude-code-desktop/) | Claude Code per Streamable HTTP mit eigenem Token an JanuaPort anbinden, über `claude mcp add` oder `.mcp.json`. Dazu die Grenzen für Claude Desktop und ein Skill zum Bauen von Use Cases. | **Gebaut.** Claude Code mit Bearer-Token ist auf beiden Wegen gegen eine echte Anlage belegt (23.09.2026). Der Skill ist nicht belegt; Claude Desktop verbindet sich wie claude.ai (siehe `claude-ai/`). |
| [`claude-ai/`](claude-ai/) | claude.ai (und Claude Desktop, Mobil-Apps) als eigenen Konnektor mit eigenem OAuth-Client über Microsoft Entra anbinden. | **Gebaut.** Gegen einen echten Mandanten belegt am 24.09.2026: Werkzeugaufruf 2 h 49 min nach der Anmeldung, ohne neu zu verbinden (stille Token-Erneuerung). Das Entra-Anmeldeprotokoll selbst ist nicht eingesehen. |
| [`claude-desktop-admin/`](claude-desktop-admin/) | MCP-Bundle „JanuaPort Admin“ für Claude Desktop (Windows, macOS): eine Anlage über ihren Admin-MCP verwalten, mit eigenem, ablaufendem Admin-Token, nur im lokalen Netz. | **Gebaut.** Das gepackte Bundle ist gegen eine Wegwerf-Anlage in Docker hinter Caddy mit interner CA belegt (25.09.2026), ohne Claude Desktop. Der Ein-Klick in Claude Desktop ist noch nicht belegt, weder unter Windows noch unter macOS. |
| [`codex/`](codex/) | Codex CLI per Streamable HTTP mit eigenem Token anbinden (`~/.codex/config.toml`, Token nur in einer Umgebungsvariable). | **Gebaut.** Bearer-Token belegt am 30.10.2026 mit Codex CLI 0.162.1 gegen JanuaPort 0.89.0; OAuth/SSO ungetestet. |
| [`cursor/`](cursor/) | Cursor über `mcp.json` mit eigenem Token anbinden. | **Gebaut**, ungetestet: nach der Cursor-Doku geschrieben, Beleg steht aus. |
| [`gemini-cli/`](gemini-cli/) | Gemini CLI per Streamable HTTP (`httpUrl`) mit eigenem Token anbinden. | **Gebaut**, ungetestet: nach der Gemini-CLI-Doku geschrieben, Beleg steht aus. |
| [`sso-broker/entra/`](sso-broker/entra/) | Einrichtungsskript für Microsoft Entra ID mit zwei App-Registrierungen, für ChatGPT und claude.ai. | **Gebaut.** Mit ChatGPT (21.09.2026) und mit claude.ai (24.09.2026) gegen einen echten Mandanten belegt; das Skript ist am Stück gelaufen (die Anmeldezeile selbst lief dabei nicht mit). |
| weitere Broker-Rezepte (z. B. Keycloak, Dex, ADFS) | OpenID-Connect-Anbieter außer Entra, vor JanuaPort. | **Geplant.** |
| Tunnel-Profile, Zeitplan-Läufer | Client-seitige Profile für die Anbindung ohne offenen Port und Läufer, die JanuaPort nach Zeitplan aufrufen. | **Geplant.** |
