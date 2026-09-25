// Plan §3 Nr. 4 und SEC-Auflage K2: Im ganzen Ordner (auch manifest.json)
// gibt es keinen Weg, die TLS-Prüfung abzuschalten. Diese Datei selbst ist
// ausgenommen, weil sie die Suchmuster enthalten muss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';

const self = fileURLToPath(import.meta.url);
const root = join(dirname(self), '..');

const forbidden = [
  /rejectUnauthorized/,
  /NODE_TLS_REJECT_UNAUTHORIZED/,
  /checkServerIdentity/,
  /NODE_OPTIONS/,
  /--insecure/,
];

const skipDirs = new Set(['node_modules', '.git']);

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skipDirs.has(e.name)) yield* files(p);
    } else if (e.isFile() && !e.name.endsWith('.mcpb')) {
      yield p;
    }
  }
}

function scan(dir, exclude = new Set()) {
  const hits = [];
  for (const f of files(dir)) {
    if (exclude.has(f)) continue;
    const text = readFileSync(f, 'utf8');
    for (const re of forbidden) {
      if (re.test(text)) hits.push(`${f}: ${re.source}`);
    }
  }
  return hits;
}

test('Wächter: kein Schalter gegen die TLS-Prüfung im Ordner', () => {
  const hits = scan(root, new Set([self]));
  assert.deepEqual(hits, []);
});

test('Wächter erfasst manifest.json', () => {
  const all = [...files(root)].map((f) => basename(f));
  assert.ok(all.includes('manifest.json'));
});

const counterSamples = [
  { name: 'rejectUnauthorized in JS', file: 'server/x.js', text: 'https.request({ rejectUnauthorized: false })' },
  { name: 'Umgebungsvariable im Manifest', file: 'manifest.json', text: '{"env":{"NODE_TLS_REJECT_UNAUTHORIZED":"0"}}' },
  { name: 'checkServerIdentity', file: 'server/y.js', text: 'tls.connect({ checkServerIdentity: () => undefined })' },
  { name: 'NODE_OPTIONS', file: 'manifest.json', text: '{"env":{"NODE_OPTIONS":"--use-openssl-ca"}}' },
  { name: '--insecure in der Doku', file: 'README.md', text: 'curl --insecure https://box.local' },
];

for (const c of counterSamples) {
  test(`Gegenprobe: Wächter schlägt an bei ${c.name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'jnpt-guard-'));
    try {
      mkdirSync(join(dir, 'server'), { recursive: true });
      writeFileSync(join(dir, c.file), c.text);
      assert.equal(scan(dir).length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('Gegenprobe: sauberer Ordner ergibt keinen Treffer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-guard-'));
  try {
    writeFileSync(join(dir, 'ok.js'), 'const ca = process.env.NODE_EXTRA_CA_CERTS;');
    assert.deepEqual(scan(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
