// Plan §3 Nr. 2 (Einheitsteil): Bearer-Kopf, Schwärzen, CA-Pfad aus der
// Umgebung, Fehlermeldungen für Menschen. Dass der Token in keiner Zeile von
// stdout oder stderr auftaucht, prüft bridge.test.js am echten Kindprozess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, caFileFromEnv, describeError, redact, noRedirectFetch } from '../server/bridge.js';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const token = 'jnpt_testid_' + 'x'.repeat(43);

test('authHeaders setzt Bearer', () => {
  assert.deepEqual(authHeaders(token), { Authorization: `Bearer ${token}` });
});

for (const bad of ['', '   ', undefined]) {
  test(`authHeaders weist leeren Token ab (${JSON.stringify(bad)})`, () => {
    assert.throws(() => authHeaders(bad), /Admin-Token/);
  });
}

test('authHeaders weist Token mit Zeilenumbruch ab', () => {
  assert.throws(() => authHeaders('jnpt_a\r\nX-Evil: 1'), /Admin-Token/);
});

test('redact ersetzt jeden Vorkommen des Tokens', () => {
  const out = redact(`a ${token} b ${token}`, token);
  assert.ok(!out.includes(token));
  assert.match(out, /a \*\*\* b \*\*\*/);
});

test('redact ohne Geheimnis lässt den Text stehen', () => {
  assert.equal(redact('abc', ''), 'abc');
});

const caCases = [
  { name: 'nicht gesetzt', value: undefined, want: undefined },
  { name: 'leer', value: '', want: undefined },
  { name: 'nicht ersetzter Platzhalter', value: '${user_config.ca_certificate}', want: undefined },
  { name: 'Pfad', value: '/home/admin/root.crt', want: '/home/admin/root.crt' },
];

for (const c of caCases) {
  test(`caFileFromEnv: ${c.name}`, () => {
    assert.equal(caFileFromEnv(c.value), c.want);
  });
}

function tlsError(code) {
  const cause = Object.assign(new Error(`tls ${code}`), { code });
  return new TypeError('fetch failed', { cause });
}

const errorCases = [
  {
    name: '401 → Token-Meldung',
    err: new StreamableHTTPError(401, 'Error POSTing to endpoint: unauthorized'),
    ctx: {},
    want: [/Admin-Token falsch oder abgelaufen/, /jnpt admin-token create --expires/],
  },
  {
    name: '404 → kein Admin-MCP unter dieser Adresse',
    err: new StreamableHTTPError(404, 'Error POSTing to endpoint: not found'),
    ctx: {},
    want: [/keinen Admin-MCP/],
  },
  {
    name: 'Zertifikat ohne CA-Datei → Hinweis auf die CA-Datei',
    err: tlsError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'),
    ctx: {},
    want: [/Zertifikat/, /CA-Datei/],
  },
  {
    name: 'Zertifikat mit CA-Datei → nennt die Datei',
    err: tlsError('SELF_SIGNED_CERT_IN_CHAIN'),
    ctx: { caFile: '/pfad/root.crt' },
    want: [/passt nicht zur hinterlegten CA-Datei/, /\/pfad\/root\.crt/],
  },
  {
    name: 'Hostname passt nicht zum Zertifikat',
    err: tlsError('ERR_TLS_CERT_ALTNAME_INVALID'),
    ctx: {},
    want: [/Zertifikat/],
  },
  {
    name: 'Umleitung → keine Umleitung gefolgt',
    err: new TypeError('fetch failed', { cause: new Error('unexpected redirect') }),
    ctx: {},
    want: [/Umleitung/],
  },
];

for (const c of errorCases) {
  test(`describeError: ${c.name}`, () => {
    const msg = describeError(c.err, c.ctx);
    for (const re of c.want) assert.match(msg, re);
    assert.doesNotMatch(msg, /abschalten|disable/i);
  });
}

test('describeError schwärzt den Token in unbekannten Fehlern', () => {
  const msg = describeError(new Error(`kaputt: Bearer ${token}`), { token });
  assert.ok(!msg.includes(token));
});

test('noRedirectFetch erzwingt redirect: error, auch gegen requestInit', async () => {
  let seen;
  const fake = async (_url, init) => {
    seen = init;
    return new Response('ok');
  };
  await noRedirectFetch('https://box.local/admin/mcp', { redirect: 'follow', method: 'POST' }, fake);
  assert.equal(seen.redirect, 'error');
  assert.equal(seen.method, 'POST');
});
