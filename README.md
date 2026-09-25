# januaport-clients

**English** · [Deutsch](README.de.md)

Inbound for JanuaPort: how AI clients and identity providers connect to the gateway.

JanuaPort is a self-hosted MCP gateway. It connects AI assistants to a company's existing systems with
fine-grained permissions and records access in an append-only audit log. The core of JanuaPort is
proprietary software of JanuaPort GmbH and is not part of this repository. This repository is one of the
open edges around it.

- **License:** Apache License 2.0 ([`LICENSE`](LICENSE), [`NOTICE`](NOTICE))
- **Links:** [januaport.ai](https://januaport.ai) · [Security policy](SECURITY.md) · [Contributing](CONTRIBUTING.md)
- **Language:** The guides in the subfolders are currently written in German.

No customer data, no keys, no operator values in this repository.

---

## Sign-in: OpenID Connect

JanuaPort accepts the sign-in of its users from an OpenID Connect provider and only validates the token;
it does not run its own identity provider. Microsoft Entra ID is verified today. Recipes for other
providers, placed in front of JanuaPort as a broker, are planned and will be published here, openly.

## Contents

Status labels: **Built** · **In progress** · **Planned**. Each entry says what exactly has been verified.

| Folder | What it covers | Status |
|---|---|---|
| [`claude-code-desktop/`](claude-code-desktop/) | Connecting Claude Code to JanuaPort over Streamable HTTP with a personal token, via `claude mcp add` or `.mcp.json`. Plus the limits for Claude Desktop and a skill for building use cases. | **Built.** Claude Code with a bearer token is verified against a real installation on both ways (23 September 2026). The skill is not verified; Claude Desktop connects like claude.ai (see `claude-ai/`). |
| [`claude-ai/`](claude-ai/) | Connecting claude.ai (and Claude Desktop, mobile apps) as a custom connector with your own OAuth client, via Microsoft Entra. | **Built.** Verified against a real tenant on 24 September 2026: a tool call 2 h 49 min after sign-in, without reconnecting (silent token renewal). The Entra sign-in log itself was not inspected. |
| [`claude-desktop-admin/`](claude-desktop-admin/) | MCP bundle “JanuaPort Admin” for Claude Desktop (Windows, macOS): administer an installation over its admin MCP with a dedicated, expiring admin token, in the local network only. | **Built.** The packed bundle is verified against a throwaway installation in Docker behind Caddy with an internal CA (25 September 2026), without Claude Desktop. The one-click install in Claude Desktop is not verified yet, on neither Windows nor macOS. |
| [`sso-broker/entra/`](sso-broker/entra/) | Setup script for Microsoft Entra ID with two app registrations, for ChatGPT and claude.ai. | **Built.** Verified with ChatGPT and with claude.ai against a real tenant; the script ran end to end (the sign-in line itself was not part of that run). |
| further broker recipes (e.g. Keycloak, Dex, ADFS) | OpenID Connect providers other than Entra, in front of JanuaPort. | **Planned.** |
| tunnel profiles, scheduled runners | Client-side profiles for connecting without an open port, and runners that call JanuaPort on a schedule. | **Planned.** |
