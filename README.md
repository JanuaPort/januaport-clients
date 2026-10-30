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

## AI clients at a glance

How common AI clients sign in to `/mcp` and what of it is verified. “Verified” means: a real tool call with
an audit entry, with date and client version. Everything else is **untested**.

| Client | Guide | Bearer token | OAuth/SSO | Status |
|---|---|---|---|---|
| Claude Code | [`claude-code-desktop/`](claude-code-desktop/) | verified | untested | bearer verified on 23 September 2026 |
| claude.ai, Claude Desktop | [`claude-ai/`](claude-ai/) | – | verified (Entra) | SSO verified on 24 September 2026 |
| ChatGPT | [`sso-broker/entra/`](sso-broker/entra/) | – | verified (Entra) | SSO verified on 21 September 2026 |
| Codex | [`codex/`](codex/) | verified | untested | bearer verified on 30 October 2026 with Codex CLI 0.162.1 against JanuaPort 0.89.0 |
| Cursor | [`cursor/`](cursor/) | untested | untested | untested |
| Gemini CLI | [`gemini-cli/`](gemini-cli/) | untested | untested | untested |

## Contents

Status labels: **Built** · **In progress** · **Planned**. Each entry says what exactly has been verified.

| Folder | What it covers | Status |
|---|---|---|
| [`claude-code-desktop/`](claude-code-desktop/) | Connecting Claude Code to JanuaPort over Streamable HTTP with a personal token, via `claude mcp add` or `.mcp.json`. Plus the limits for Claude Desktop and a skill for building use cases. | **Built.** Claude Code with a bearer token is verified against a real installation on both ways (23 September 2026). The skill is not verified; Claude Desktop connects like claude.ai (see `claude-ai/`). |
| [`claude-ai/`](claude-ai/) | Connecting claude.ai (and Claude Desktop, mobile apps) as a custom connector with your own OAuth client, via Microsoft Entra. | **Built.** Verified against a real tenant on 24 September 2026: a tool call 2 h 49 min after sign-in, without reconnecting (silent token renewal). The Entra sign-in log itself was not inspected. |
| [`claude-desktop-admin/`](claude-desktop-admin/) | MCP bundle “JanuaPort Admin” for Claude Desktop (Windows, macOS): administer an installation over its admin MCP with a dedicated, expiring admin token, in the local network only. | **Built.** The packed bundle is verified against a throwaway installation in Docker behind Caddy with an internal CA (25 September 2026), without Claude Desktop. The one-click install in Claude Desktop is not verified yet, on neither Windows nor macOS. |
| [`codex/`](codex/) | Connecting the Codex CLI over Streamable HTTP with a personal token (`~/.codex/config.toml`, token only in an environment variable). | **Built.** Bearer token verified on 30 October 2026 with Codex CLI 0.162.1 against JanuaPort 0.89.0; OAuth/SSO untested. |
| [`cursor/`](cursor/) | Connecting Cursor via `mcp.json` with a personal token. | **Built**, untested: written from the Cursor documentation, verification pending. |
| [`gemini-cli/`](gemini-cli/) | Connecting the Gemini CLI over Streamable HTTP (`httpUrl`) with a personal token. | **Built**, untested: written from the Gemini CLI documentation, verification pending. |
| [`sso-broker/entra/`](sso-broker/entra/) | Setup script for Microsoft Entra ID with two app registrations, for ChatGPT and claude.ai. | **Built.** Verified with ChatGPT (21 September 2026) and with claude.ai (24 September 2026) against a real tenant; the script ran end to end (the sign-in line itself was not part of that run). |
| further broker recipes (e.g. Keycloak, Dex, ADFS) | OpenID Connect providers other than Entra, in front of JanuaPort. | **Planned.** |
| tunnel profiles, scheduled runners | Client-side profiles for connecting without an open port, and runners that call JanuaPort on a schedule. | **Planned.** |
