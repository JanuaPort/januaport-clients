#!/usr/bin/env node
// JanuaPort Admin für Claude Desktop: reicht MCP-Nachrichten 1:1 von stdio an
// <Adresse>/admin/mcp (Streamable HTTP, Bearer-Admin-Token) durch und zurück.
// stdout gehört allein dem JSON-RPC-Strom; Logs gehen auf stderr, nie mit Token.
import { accessSync, constants } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseAddress, authHeaders, caFileFromEnv, describeError, noRedirectFetch, redact } from './bridge.js';

const token = process.env.JNPT_ADMIN_TOKEN?.trim();

function log(line) {
  process.stderr.write(`[januaport-admin] ${redact(line, token)}\n`);
}

function readable(file) {
  try {
    accessSync(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function configure() {
  try {
    const endpoint = parseAddress(process.env.JNPT_ADMIN_ADDRESS);
    const headers = authHeaders(token);
    const caFile = caFileFromEnv(process.env.NODE_EXTRA_CA_CERTS);
    // K2 fail closed: Node würde eine unlesbare Datei nur mit einer Warnung
    // übergehen und mit den System-CAs weiterlaufen.
    if (caFile && !readable(caFile)) {
      throw new Error(`CA-Datei ${caFile} ist nicht lesbar — Datei in den Einstellungen der Erweiterung neu auswählen. / CA file ${caFile} is not readable.`);
    }
    return { endpoint, headers, ctx: { caFile, token } };
  } catch (err) {
    log(err.message);
    process.exit(2);
  }
}

const { endpoint, headers, ctx } = configure();

// Kein authProvider: ein 401 bleibt ein 401 und kippt nie in einen OAuth-Fluss (K1).
const upstream = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers },
  fetch: (url, init) => noRedirectFetch(url, init),
});
const local = new StdioServerTransport();

function isRequest(msg) {
  return msg && typeof msg.method === 'string' && msg.id !== undefined;
}

local.onmessage = (msg) => {
  upstream.send(msg).catch((err) => {
    if (isRequest(msg)) {
      local.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: describeError(err, ctx) } })
        .catch(() => {});
    }
  });
};

// Das Protokoll-Datum der Sitzung merkt sich sonst der SDK-Client; die Brücke
// ist keiner und setzt es deshalb selbst aus der initialize-Antwort.
upstream.onmessage = (msg) => {
  const version = msg?.result?.protocolVersion;
  if (typeof version === 'string' && msg?.result?.serverInfo) upstream.setProtocolVersion(version);
  local.send(msg).catch((err) => log(`stdout: ${err.message}`));
};

upstream.onerror = (err) => log(describeError(err, ctx));
local.onerror = (err) => log(`stdio: ${err.message}`);

async function shutdown() {
  await upstream.close().catch(() => {});
  process.exit(0);
}

process.stdin.on('end', shutdown);
process.on('SIGTERM', shutdown);

await upstream.start();
await local.start();
log(`bereit für ${endpoint}${ctx.caFile ? ` (CA-Datei ${ctx.caFile})` : ''}`);
