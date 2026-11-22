// JanuaPort/januaport#1494: beide Audit-Wege und die ausgelieferten Versionen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const workflows = ['claude-desktop-admin.yml', 'claude-desktop-admin-release.yml'];
const run = promisify(execFile);

function auditCommands(file) {
  const text = readFileSync(join(root, '..', '.github', 'workflows', file), 'utf8');
  return [...text.matchAll(/^\s*run:\s*(npm audit[^\r\n]*)/gm)].map((m) => m[1]);
}

for (const file of workflows) {
  test(`${file}: Audit bricht ab moderate ab`, () => {
    assert.deepEqual(auditCommands(file), ['npm audit --omit=dev --audit-level=moderate']);
  });
}

for (const [name, minimum] of [['hono', '4.13.16'], ['@hono/node-server', '2.1.6']]) {
  test(`Lockfile: ${name} mindestens ${minimum}`, () => {
    const entries = Object.entries(lock.packages)
      .filter(([path]) => path.endsWith(`node_modules/${name}`));
    assert.ok(entries.length > 0, `${name} fehlt im Lockfile`);
    const floor = minimum.split('.').map(Number);
    for (const [path, info] of entries) {
      const actual = info.version.match(/^(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
      assert.ok(actual, `${path}: keine stabile Version: ${info.version}`);
      const different = actual.findIndex((part, i) => part !== floor[i]);
      assert.ok(different === -1 || actual[different] > floor[different],
        `${path}: ${info.version} liegt unter ${minimum}`);
    }
  });
}

test('SDK bleibt in package.json und Lockfile exakt auf 1.32.2', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@modelcontextprotocol/sdk'], '1.32.2');
  assert.equal(lock.packages[''].dependencies['@modelcontextprotocol/sdk'], '1.32.2');
  assert.equal(lock.packages['node_modules/@modelcontextprotocol/sdk'].version, '1.32.2');
});

test('Echtes npm audit beider Workflows weist einen Moderate-Befund ab', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-audit-test-'));
  // Nur diese lokale Registry wird angesprochen; keine externen Netzabfragen.
  let auditRequests = 0;
  const registry = createServer((req, res) => {
    req.resume();
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/-/npm/v1/security/advisories/bulk') {
      auditRequests++;
      res.end(JSON.stringify({ 'audit-fixture': [{
        id: 1494, url: 'https://example.invalid/1494', title: 'Moderate-Testbefund',
        severity: 'moderate', vulnerable_versions: '<2.0.0',
        cwe: ['CWE-200'], cvss: { score: 5, vectorString: null },
      }] }));
    } else if (req.url === '/audit-fixture') {
      res.end(JSON.stringify({ name: 'audit-fixture', 'dist-tags': { latest: '2.0.0' },
        versions: { '1.0.0': { name: 'audit-fixture', version: '1.0.0' },
          '2.0.0': { name: 'audit-fixture', version: '2.0.0' } } }));
    } else {
      res.writeHead(404).end('{}');
    }
  });
  try {
    const pkg = { name: 'audit-test', version: '1.0.0', dependencies: { 'audit-fixture': '1.0.0' } };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
      name: pkg.name, version: pkg.version, lockfileVersion: 3,
      packages: { '': pkg, 'node_modules/audit-fixture': { version: '1.0.0' } },
    }));
    await new Promise((resolve) => registry.listen(0, '127.0.0.1', resolve));
    for (const file of workflows) {
      const commands = auditCommands(file);
      assert.equal(commands.length, 1, `${file}: genau ein Audit erwartet`);
      let result;
      try {
        result = await run('bash', ['--noprofile', '--norc', '-e', '-c', `${commands[0]} --json`], {
          cwd: dir, timeout: 30000,
          env: { ...process.env, npm_config_registry: `http://127.0.0.1:${registry.address().port}`,
            npm_config_cache: join(dir, 'cache'), npm_config_update_notifier: 'false' },
        });
      } catch (error) {
        result = error;
      }
      const report = JSON.parse(result.stdout);
      assert.equal(report.metadata.vulnerabilities.moderate, 1, result.stdout);
      assert.equal(result.code ?? 0, 1, `${file}: Moderate-Befund muss Exit 1 auslösen`);
    }
    assert.equal(auditRequests, workflows.length, 'jeder Workflow muss die Registry prüfen');
  } finally {
    await new Promise((resolve) => registry.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
