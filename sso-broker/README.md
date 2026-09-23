# SSO: Identitätsanbieter vor JanuaPort

JanuaPort nimmt die Anmeldung seiner Nutzer von einem OpenID-Connect-Anbieter
entgegen und prüft nur das Token (Resource Server). Je Anbieter ein Ordner mit
Voraussetzungen, Schritten, Prüfliste, Grenzen und Beleg-Status.

| Ordner | Anbieter | Status |
|---|---|---|
| [`entra/`](entra/) | Microsoft Entra ID — Einrichtungsskript für ChatGPT und claude.ai | Skript am Stück und ChatGPT belegt (die Anmeldezeile selbst lief beim Beleg nicht mit), claude.ai ungeprüft (siehe dort) |

Broker-Rezepte für andere Anbieter (Keycloak, Dex, ADFS vor JanuaPort) folgen;
bis dahin ist nur Microsoft Entra belegt.
