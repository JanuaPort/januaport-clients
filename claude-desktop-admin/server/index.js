#!/usr/bin/env node
// JanuaPort Admin für Claude Desktop: reicht MCP-Nachrichten 1:1 von stdio an
// <Adresse>/admin/mcp (Streamable HTTP, Bearer-Admin-Token) durch und zurück.
// stdout gehört allein dem JSON-RPC-Strom; Logs gehen auf stderr, nie mit Token.
import { readFileSync } from 'node:fs';
import tls from 'node:tls';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseAddress, authHeaders, caFileFromEnv, describeError, noRedirectFetch, redact } from './bridge.js';

const rawToken = process.env.JNPT_ADMIN_TOKEN;
const token = rawToken?.trim();

function log(line) {
  process.stderr.write(`[januaport-admin] ${redact(line, token)}\n`);
}

// NODE_OPTIONS ist laut Node-CLI-Doku eine durch Leerzeichen getrennte Liste
// mit doppelten Quotes. Backslash maskiert innerhalb der Quotes das Folgezeichen
// (Node: src/node_options.cc, ParseNodeOptionsEnvVar). Keine Teilstring-Suche:
// Ein Optionswert wie --title="text --use-env-proxy text" ist kein Proxy-Flag.
function nodeOptions(text = '') {
  const args = [];
  let quoted = false;
  let arg = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && quoted) arg += text[++i] ?? '';
    else if (c === '"') quoted = !quoted;
    else if (c === ' ' && !quoted) {
      if (arg) args.push(arg);
      arg = '';
    } else arg += c;
  }
  if (arg) args.push(arg);
  return args;
}

function isEnvProxyFlag(arg) {
  // Die Node-CLI erlaubt für alle Optionen auch Unterstriche statt Bindestrichen.
  return arg.replaceAll('_', '-') === '--use-env-proxy';
}

function configure() {
  try {
    // Node dokumentiert nur diese Variable zum Abschalten der Zertifikatsprüfung.
    // --use-openssl-ca und --insecure-http-parser in NODE_OPTIONS tun das nicht.
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      throw new Error('Start verweigert: NODE_TLS_REJECT_UNAUTHORIZED=0 schaltet die Zertifikatsprüfung ab. Entfernen Sie die Variable und hinterlegen Sie bei Bedarf die Wurzel-CA. / Startup refused: remove NODE_TLS_REJECT_UNAUTHORIZED=0; configure the root CA instead.');
    }
    // Node wertet den Env-Proxy beim Prozessstart aus. Nachträgliches Löschen
    // der Umgebung würde den bereits konfigurierten Dispatcher nicht abschalten.
    // Belegte Einschaltwerte und Versionsgrenzen: README, „Node-Laufzeit“.
    if (process.env.NODE_USE_ENV_PROXY === '1' ||
        nodeOptions(process.env.NODE_OPTIONS).some(isEnvProxyFlag) ||
        process.execArgv.some(isEnvProxyFlag)) {
      throw new Error('Start verweigert: Env-Proxy aktiviert; die Anlage muss direkt erreichbar sein. Entfernen Sie NODE_USE_ENV_PROXY=1 sowie --use-env-proxy aus NODE_OPTIONS und den Node-Startargumenten. / Startup refused: remove NODE_USE_ENV_PROXY=1 and --use-env-proxy from NODE_OPTIONS and Node startup arguments; connect directly to the installation.');
    }
    const endpoint = parseAddress(process.env.JNPT_ADMIN_ADDRESS);
    const headers = authHeaders(rawToken);
    const caFile = caFileFromEnv(process.env.NODE_EXTRA_CA_CERTS);
    if (caFile) {
      let pem;
      try {
        pem = readFileSync(caFile, 'utf8');
      } catch {
        // K2 fail closed: Node würde eine unlesbare Datei nur mit einer Warnung
        // übergehen und mit den bisherigen Standard-CAs weiterlaufen.
        throw new Error(`CA-Datei ${caFile} ist nicht lesbar — Datei in den Einstellungen der Erweiterung neu auswählen. / CA file ${caFile} is not readable.`);
      }
      const certs = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
      if (certs.length === 0) {
        throw new Error(`CA-Datei ${caFile} enthält kein PEM-Zertifikat. Hinterlegen Sie die Wurzel-CA als PEM-Datei. / CA file ${caFile} contains no PEM certificate; configure the root CA in PEM format.`);
      }
      // Node >=22.19 (22.x), >=24.5 (24.x): vor der ersten TLS-Verbindung
      // ergänzen, nicht ersetzen. Das eingebaute fetch nutzt diese Standard-CAs
      // (Kindprozess-Test mit erst nach Node-Start gesetztem CA-Pfad).
      // Ältere Nodes behalten den Startzeit-Weg über NODE_EXTRA_CA_CERTS.
      if (typeof tls.setDefaultCACertificates === 'function' && typeof tls.getCACertificates === 'function') {
        tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...certs]);
      }
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
let shuttingDown = false;

function shutdownAbort(err) {
  if (!shuttingDown) return false;
  for (let e = err, depth = 0; e && depth < 10; e = e.cause, depth++) {
    // Das SDK verpackt Abbrüche eines bereits offenen SSE-Stroms als Error.
    if (e.name === 'AbortError' || /^SSE stream disconnected: AbortError:/.test(e.message ?? '')) return true;
  }
  return false;
}

function isRequest(msg) {
  return msg && typeof msg.method === 'string' && msg.id !== undefined;
}

local.onmessage = (msg) => {
  upstream.send(msg).catch((err) => {
    if (shutdownAbort(err)) return;
    if (isRequest(msg)) {
      local.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: describeError(err, ctx) } })
        .catch(() => {});
    } else {
      log(`Benachrichtigung fehlgeschlagen / Notification failed: ${describeError(err, ctx)}`);
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

upstream.onerror = (err) => { if (!shutdownAbort(err)) log(describeError(err, ctx)); };
local.onerror = (err) => log(`stdio: ${err.message}`);

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await upstream.close().catch(() => {});
  process.exit(0);
}

process.stdin.on('end', shutdown);
process.on('SIGTERM', shutdown);

await upstream.start();
await local.start();
log(`bereit für ${endpoint}${ctx.caFile ? ` (CA-Datei ${ctx.caFile})` : ''}`);
