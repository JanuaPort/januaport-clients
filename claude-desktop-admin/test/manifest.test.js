// Plan §3 Nr. 5: Der Token ist maskiert und reist nur über env, nie über args
// (args stehen in der Prozessliste). Dasselbe gilt für den CA-Pfad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const cfg = manifest.server.mcp_config;

test('Manifest-Version 0.3, Name, Typ node, Plattformen', () => {
  assert.equal(manifest.manifest_version, '0.3');
  assert.equal(manifest.name, 'januaport-admin');
  assert.equal(manifest.display_name, 'JanuaPort Admin');
  assert.equal(manifest.server.type, 'node');
  assert.deepEqual([...manifest.compatibility.platforms].sort(), ['darwin', 'win32']);
});

test('Version gleich in manifest.json und package.json', () => {
  assert.equal(manifest.version, pkg.version);
});

test('entry_point existiert und ist das einzige Argument', () => {
  assert.equal(manifest.server.entry_point, 'server/index.js');
  assert.ok(existsSync(join(root, manifest.server.entry_point)));
  assert.equal(cfg.command, 'node');
  assert.deepEqual(cfg.args, ['${__dirname}/server/index.js']);
});

const fields = [
  { key: 'address', type: 'string', required: true, sensitive: false },
  { key: 'admin_token', type: 'string', required: true, sensitive: true },
  { key: 'ca_certificate', type: 'file', required: false, sensitive: false },
];

for (const f of fields) {
  test(`user_config.${f.key}: Typ ${f.type}, Pflicht ${f.required}, maskiert ${f.sensitive}`, () => {
    const u = manifest.user_config[f.key];
    assert.ok(u, `${f.key} fehlt`);
    assert.equal(u.type, f.type);
    assert.equal(u.required === true, f.required);
    assert.equal(u.sensitive === true, f.sensitive);
    assert.ok(u.title && u.description);
  });
}

test('nur die drei erwarteten Felder in user_config', () => {
  assert.deepEqual(Object.keys(manifest.user_config).sort(), ['address', 'admin_token', 'ca_certificate']);
});

const envCases = [
  { name: 'JNPT_ADMIN_TOKEN', value: '${user_config.admin_token}' },
  { name: 'NODE_EXTRA_CA_CERTS', value: '${user_config.ca_certificate}' },
  { name: 'JNPT_ADMIN_ADDRESS', value: '${user_config.address}' },
];

for (const c of envCases) {
  test(`env.${c.name} kommt aus ${c.value}`, () => {
    assert.equal(cfg.env[c.name], c.value);
  });
}

test('Token und CA-Pfad erscheinen nicht in args', () => {
  const args = JSON.stringify(cfg.args);
  assert.doesNotMatch(args, /admin_token|ca_certificate/);
});

test('env enthält nur die drei erwarteten Variablen', () => {
  assert.deepEqual(Object.keys(cfg.env).sort(), ['JNPT_ADMIN_ADDRESS', 'JNPT_ADMIN_TOKEN', 'NODE_EXTRA_CA_CERTS']);
});

test('keine platform_overrides, die Token oder CA anders weitergeben könnten', () => {
  assert.equal(cfg.platform_overrides, undefined);
});

test('package.json: nur das SDK als Laufzeit-Abhängigkeit, exakt gepinnt', () => {
  const deps = pkg.dependencies ?? {};
  assert.deepEqual(Object.keys(deps), ['@modelcontextprotocol/sdk']);
  assert.match(deps['@modelcontextprotocol/sdk'], /^\d+\.\d+\.\d+$/);
});

// Ein Ablaufwert überall: Manifest, README und die 401-Meldung der Brücke.
test('Token-Ablauf: überall --expires 720h', () => {
  const texts = [
    JSON.stringify(manifest),
    readFileSync(join(root, 'README.md'), 'utf8'),
    readFileSync(join(root, 'server', 'bridge.js'), 'utf8'),
  ];
  const values = texts.flatMap((t) => [...t.matchAll(/--expires (\S+)/g)].map((m) => m[1]))
    .filter((v) => v !== '…');
  assert.ok(values.length >= 3, `zu wenige Fundstellen: ${values}`);
  assert.deepEqual([...new Set(values)], ['720h']);
});

test('package-lock.json ist eingecheckt', () => {
  assert.ok(existsSync(join(root, 'package-lock.json')));
});
