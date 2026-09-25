// Plan §3 Nr. 2 und 3, SEC-Auflagen K1, K2, K3: die Brücke als echter
// Kindprozess gegen einen lokalen HTTPS-Testserver mit Laufzeit-Test-CA.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createTestPki } from './support/pki.js';
import { startFakeGateway } from './support/fake-gateway.js';
import { runBridge, spawnNode, initialize, initialized, toolsList } from './support/run-bridge.js';

const token = 'jnpt_bridgetest_' + 'k'.repeat(43);
const wrongToken = 'jnpt_bridgetest_' + 'w'.repeat(43);
let pki;

before(() => { pki = createTestPki(); });
after(() => pki?.cleanup());

// K3: Der Token taucht in keiner stderr-Zeile und in keiner stdout-Nachricht
// auf; stdout trägt ausschließlich JSON-RPC.
function assertNoLeak(run, ...secrets) {
  for (const s of secrets) {
    assert.ok(!run.stderr.includes(s), 'Token auf stderr');
    for (const line of run.stdoutLines) assert.ok(!line.includes(s), 'Token auf stdout');
  }
  for (const line of run.stdoutLines) {
    const msg = JSON.parse(line);
    assert.equal(msg.jsonrpc, '2.0');
  }
}

function errorOf(run, id) {
  const r = run.responses.get(id);
  assert.ok(r, `keine Antwort auf id ${id}; stderr: ${run.stderr}`);
  assert.ok(r.error, `Fehler erwartet, bekommen: ${JSON.stringify(r)}`);
  return r.error.message;
}

async function withGateway(opts, fn) {
  const gw = await startFakeGateway({ key: pki.key, cert: pki.cert, token, ...opts });
  try {
    return await fn(gw);
  } finally {
    await gw.close();
  }
}

test('passende CA: initialize und tools/list laufen durch, Bearer kommt an', async () => {
  await withGateway({}, async (gw) => {
    const run = await runBridge(
      { JNPT_ADMIN_ADDRESS: gw.origin, JNPT_ADMIN_TOKEN: token, NODE_EXTRA_CA_CERTS: pki.caFile },
      [initialize, initialized, toolsList],
    );
    const init = run.responses.get(1);
    assert.ok(init?.result, `initialize ohne Ergebnis; stderr: ${run.stderr}`);
    assert.equal(init.result.serverInfo.name, 'fake-jnpt-admin');
    const tools = run.responses.get(2)?.result?.tools ?? [];
    assert.deepEqual(tools.map((t) => t.name), ['admin_list_catalog']);
    const posts = gw.requests.filter((r) => r.method === 'POST');
    assert.ok(posts.length >= 3);
    for (const r of gw.requests) {
      assert.equal(r.url, '/admin/mcp');
      assert.equal(r.authorization, `Bearer ${token}`);
    }
    assertNoLeak(run, token);
  });
});

const certCases = [
  { name: 'ohne CA-Datei', ca: () => undefined, want: [/Zertifikat/, /CA-Datei/] },
  { name: 'falsche CA-Datei', ca: () => pki.wrongCaFile, want: [/passt nicht zur hinterlegten CA-Datei/, () => pki.wrongCaFile] },
  { name: 'fehlende CA-Datei (fail closed)', ca: () => join(pki.dir, 'gibt-es-nicht.crt'), want: [/nicht lesbar/, () => join(pki.dir, 'gibt-es-nicht.crt')] },
];

for (const c of certCases) {
  test(`Zertifikatsfehler ${c.name}: initialize scheitert mit Zertifikatsmeldung`, async () => {
    await withGateway({}, async (gw) => {
      const env = { JNPT_ADMIN_ADDRESS: gw.origin, JNPT_ADMIN_TOKEN: token };
      const ca = c.ca();
      if (ca) env.NODE_EXTRA_CA_CERTS = ca;
      const run = await runBridge(env, [initialize]);
      const msg = errorOf(run, 1);
      for (const w of c.want) {
        if (typeof w === 'function') assert.ok(msg.includes(w()), `Datei fehlt in: ${msg}`);
        else assert.match(msg, w);
      }
      assert.doesNotMatch(msg, /abschalten|disable/i);
      assert.equal(gw.requests.length, 0, 'keine Anfrage darf den Server erreichen');
      assertNoLeak(run, token);
    });
  });
}

test('401: falscher Token ergibt die Token-Meldung', async () => {
  await withGateway({}, async (gw) => {
    const run = await runBridge(
      { JNPT_ADMIN_ADDRESS: gw.origin, JNPT_ADMIN_TOKEN: wrongToken, NODE_EXTRA_CA_CERTS: pki.caFile },
      [initialize],
    );
    const msg = errorOf(run, 1);
    assert.match(msg, /Admin-Token falsch oder abgelaufen/);
    assert.match(msg, /jnpt admin-token create --expires/);
    assertNoLeak(run, token, wrongToken);
  });
});

test('404: unter dieser Adresse gibt es keinen Admin-MCP', async () => {
  await withGateway({ mode: 'status404' }, async (gw) => {
    const run = await runBridge(
      { JNPT_ADMIN_ADDRESS: gw.origin, JNPT_ADMIN_TOKEN: token, NODE_EXTRA_CA_CERTS: pki.caFile },
      [initialize],
    );
    assert.match(errorOf(run, 1), /keinen Admin-MCP/);
    assertNoLeak(run, token);
  });
});

// K1: 307 auf eine andere Origin → Fehler, die zweite Adresse sieht nichts.
test('Umleitung 307 auf andere Origin: die Brücke folgt nicht', async () => {
  await withGateway({}, async (target) => {
    await withGateway({ mode: 'redirect', redirectTo: `${target.origin}/admin/mcp` }, async (gw) => {
      const run = await runBridge(
        { JNPT_ADMIN_ADDRESS: gw.origin, JNPT_ADMIN_TOKEN: token, NODE_EXTRA_CA_CERTS: pki.caFile },
        [initialize],
      );
      assert.match(errorOf(run, 1), /Umleitung/);
      assert.equal(gw.requests.length, 1);
      assert.equal(target.requests.length, 0, 'Ziel der Umleitung wurde erreicht');
      assertNoLeak(run, token);
    });
  });
});

// Gegenprobe zu K1: Mit redirect: "follow" erreicht dieselbe Umgebung das Ziel;
// die Prüfung oben würde ein Folgen also erkennen.
test('Gegenprobe Umleitung: redirect follow erreicht das Ziel', async () => {
  await withGateway({}, async (target) => {
    await withGateway({ mode: 'redirect', redirectTo: `${target.origin}/admin/mcp` }, async (gw) => {
      const script = `fetch(${JSON.stringify(`${gw.origin}/admin/mcp`)}, { method: 'POST', redirect: 'follow', body: '{}' })` +
        '.then(() => process.exit(0), () => process.exit(0));';
      const child = spawnNode(['-e', script], { NODE_EXTRA_CA_CERTS: pki.caFile });
      await new Promise((resolve) => child.on('exit', resolve));
      assert.ok(target.requests.length >= 1, 'Gegenprobe hat das Ziel nicht erreicht');
    });
  });
});

const startRejects = [
  { name: 'http-Adresse', env: { JNPT_ADMIN_ADDRESS: 'http://localhost:1', JNPT_ADMIN_TOKEN: token }, want: /https/ },
  { name: 'Adresse mit Pfad', env: { JNPT_ADMIN_ADDRESS: 'https://localhost:1/mcp', JNPT_ADMIN_TOKEN: token }, want: /Pfad/ },
  { name: 'ohne Token', env: { JNPT_ADMIN_ADDRESS: 'https://localhost:1' }, want: /Admin-Token/ },
];

for (const c of startRejects) {
  test(`Abweisung beim Start: ${c.name}`, async () => {
    const run = await runBridge(c.env, [initialize]);
    assert.notEqual(run.exitCode, 0);
    assert.match(run.stderr, c.want);
    assertNoLeak(run, token);
  });
}
