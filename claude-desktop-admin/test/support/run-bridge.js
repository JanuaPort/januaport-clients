// Startet die Brücke als echten Kindprozess, wie Claude Desktop es tut:
// NODE_EXTRA_CA_CERTS liest Node nur beim Start. lateCaFile setzt den Pfad erst
// danach: Damit muss die Brücke selbst die CA für das eingebaute fetch ergänzen.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const entry = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'index.js');

// Nur das Nötigste aus der Umgebung des Testprozesses, damit nichts
// Unerwartetes (Proxy, CA-Schalter) die Brücke beeinflusst.
function baseEnv() {
  const keep = new Set(['PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']);
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => keep.has(k.toUpperCase())));
}

export function spawnNode(args, env) {
  return spawn(process.execPath, args, { env: { ...baseEnv(), ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
}

// Schickt die Nachrichten nacheinander; auf Anfragen (mit id) wird die
// Antwort abgewartet. Liefert alle stdout-Zeilen, stderr und die Antworten.
export async function runBridge(env, messages, { timeoutMs = 15000, nodeArgs = [], lateCaFile } = {}) {
  const bootstrap = `
    import assert from 'node:assert/strict';
    import { X509Certificate } from 'node:crypto';
    import tls from 'node:tls';
    import { pathToFileURL } from 'node:url';
    assert.equal(process.env.NODE_EXTRA_CA_CERTS, undefined);
    const defaults = tls.getCACertificates?.('default');
    if (defaults) assert.deepEqual(tls.getCACertificates('extra'), []);
    process.env.NODE_EXTRA_CA_CERTS = ${JSON.stringify(lateCaFile)};
    await import(pathToFileURL(${JSON.stringify(entry)}).href);
    if (defaults && tls.setDefaultCACertificates) {
      // OpenSSL normalisiert beim Setzen die PEM-Darstellung (u. a. Newlines).
      // Zertifikatsidentität statt Bytegleichheit der PEM-Strings prüfen.
      const fingerprint = cert => new X509Certificate(cert).fingerprint256;
      const current = new Set(tls.getCACertificates('default').map(fingerprint));
      assert.ok(defaults.every(cert => current.has(fingerprint(cert))), 'bisherige Standard-CAs fehlen');
    }
  `;
  const args = lateCaFile === undefined ? [entry] : ['--input-type=module', '-e', bootstrap];
  const child = spawnNode([...nodeArgs, ...args], env);
  let stdout = '';
  let stderr = '';
  const waiters = new Map();
  const responses = new Map();
  child.stderr.on('data', (c) => { stderr += c; });
  child.stdout.on('data', (c) => {
    stdout += c;
    for (const line of stdout.split('\n').slice(0, -1)) {
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && !responses.has(msg.id)) {
        responses.set(msg.id, msg);
        waiters.get(msg.id)?.();
      }
    }
  });
  // close folgt auf exit und das Leeren beider Ausgabeströme.
  const exited = new Promise((resolve) => child.on('close', (code) => resolve(code)));

  const deadline = setTimeout(() => child.kill(), timeoutMs);
  try {
    for (const m of messages) {
      if (child.exitCode !== null) break;
      child.stdin.write(JSON.stringify(m) + '\n');
      if (m.id === undefined) continue;
      await Promise.race([
        new Promise((resolve) => { waiters.set(m.id, resolve); if (responses.has(m.id)) resolve(); }),
        exited,
      ]);
    }
  } finally {
    child.stdin.end();
    setTimeout(() => child.kill(), 2000).unref();
  }
  const exitCode = await exited;
  clearTimeout(deadline);
  return { stdoutLines: stdout.split('\n').filter((l) => l.trim() !== ''), stderr, responses, exitCode };
}

export const initialize = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
};
export const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };
export const toolsList = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
