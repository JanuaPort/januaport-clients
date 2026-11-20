# SSO: Identitätsanbieter vor JanuaPort

JanuaPort nimmt die Anmeldung seiner Nutzer von einem OpenID-Connect-Anbieter
entgegen und prüft nur das Token (Resource Server). Je Anbieter ein Ordner mit
Voraussetzungen, Schritten, Prüfliste, Grenzen und Beleg-Status.

| Ordner | Anbieter | Status |
|---|---|---|
| [`entra/`](entra/) | Microsoft Entra ID — Einrichtungsskript für ChatGPT und claude.ai | ChatGPT belegt am 21.09.2026; Skript am Stück am 23.09.2026 (die Anmeldezeile lief nicht mit); claude.ai am 24.09.2026 (Entras nicht interaktives Anmeldeprotokoll dabei nicht eingesehen). Einzelheiten in der [Status-Tabelle](entra/README.md#status). |

Broker-Rezepte für andere Anbieter (Keycloak, Dex, ADFS vor JanuaPort) folgen;
bis dahin ist nur Microsoft Entra belegt.
