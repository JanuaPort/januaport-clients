// GATE-Auflage zu JanuaPort/januaport#888: Im Release-Workflow ist jede
// Action auf einen vollen Commit-SHA gepinnt, mit Versionskommentar dahinter.
// Ein Tag ließe sich umhängen; der Release baut das ausgelieferte Bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const workflow = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.github', 'workflows',
  'claude-desktop-admin-release.yml');

const pinned = /^\s*-?\s*uses:\s*[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+\s*$/;

function unpinned(text) {
  return text.split(/\r?\n/).filter((l) => /^\s*-?\s*uses:/.test(l) && !pinned.test(l));
}

for (const file of readdirSync(dirname(workflow)).filter((f) => /\.ya?ml$/.test(f))) {
test(`${file}: jede Action auf vollen SHA gepinnt`, () => {
  const text = readFileSync(join(dirname(workflow), file), 'utf8');
  assert.ok(text.split(/\r?\n/).some((l) => /^\s*-?\s*uses:/.test(l)), 'keine uses:-Zeile gefunden');
  assert.deepEqual(unpinned(text), []);
});
}

const samples = [
  { name: 'Tag', line: '      - uses: actions/checkout@v4', ok: false },
  { name: 'kurzer SHA', line: '      - uses: actions/checkout@11d5960 # v4.4.0', ok: false },
  { name: 'SHA ohne Versionskommentar', line: '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262', ok: false },
  { name: 'Branch', line: '        uses: actions/attest-build-provenance@main', ok: false },
  { name: 'voller SHA mit Version', line: '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0', ok: true },
  { name: 'ohne Spiegelstrich', line: '        uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2', ok: true },
];

for (const s of samples) {
  test(`Gegenprobe Pin-Prüfung: ${s.name}`, () => {
    assert.equal(unpinned(s.line).length === 0, s.ok);
  });
}

// SEC-Auflage A1: Der Release-Job hält contents:write und id-token:write; ein
// Install-Skript einer Abhängigkeit könnte das Bundle verändern, und die
// Attestation würde es bezeugen. Deshalb jedes npm ci mit --ignore-scripts.
function npmCiWithoutIgnoreScripts(text) {
  return text.split(/\r?\n/).filter((l) => /\b(?:npm ci|npx)\b/.test(l) && !/--ignore-scripts\b/.test(l));
}

test('Release-Workflow: jedes npm ci mit --ignore-scripts', () => {
  const text = readFileSync(workflow, 'utf8');
  assert.ok(text.split(/\r?\n/).filter((l) => /\bnpm ci\b/.test(l)).length >= 2, 'weniger als zwei npm ci gefunden');
  assert.deepEqual(npmCiWithoutIgnoreScripts(text), []);
});

test('Alle Workflows: Installationen inklusive npx ohne Install-Skripte', () => {
  for (const file of readdirSync(dirname(workflow)).filter((f) => /\.ya?ml$/.test(f))) {
    assert.deepEqual(npmCiWithoutIgnoreScripts(readFileSync(join(dirname(workflow), file), 'utf8')), [], file);
  }
});

test('Echtes npm ci aller Workflows unterdrückt ein Install-Skript', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-install-test-'));
  try {
    const pkg = { name: 'install-test', version: '1.0.0', scripts: {
      install: 'node -e "require(\'node:fs\').writeFileSync(\'install-ran\', \'bad\')"',
    } };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
      name: pkg.name, version: pkg.version, lockfileVersion: 3,
      packages: { '': { name: pkg.name, version: pkg.version, hasInstallScript: true } },
    }));
    for (const file of readdirSync(dirname(workflow)).filter((f) => /\.ya?ml$/.test(f))) {
      const lines = readFileSync(join(dirname(workflow), file), 'utf8').split(/\r?\n/);
      for (const line of lines.filter((l) => /\bnpm ci\b/.test(l))) {
        const command = line.slice(line.indexOf('npm ci')).trim();
        const run = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', command], {
          cwd: dir, encoding: 'utf8', timeout: 30000,
          env: { ...process.env, staging: dir.replace(/\\/g, '/') },
        });
        assert.equal(run.status, 0, run.stderr);
        assert.ok(!existsSync(join(dir, 'install-ran')), `${file}: ${command} führte Install-Skript aus`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Release-Workflow: kein npx --yes, mcpb exakt im Lockfile', () => {
  const text = readFileSync(workflow, 'utf8');
  assert.doesNotMatch(text, /\bnpx\s+--yes\b/);
  const root = join(dirname(workflow), '..', '..', 'claude-desktop-admin');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.devDependencies?.['@anthropic-ai/mcpb'], '2.1.2');
  assert.equal(lock.packages[''].devDependencies?.['@anthropic-ai/mcpb'], '2.1.2');
  assert.equal(lock.packages['node_modules/@anthropic-ai/mcpb']?.version, '2.1.2');
});

function runStep(name) {
  const text = readFileSync(workflow, 'utf8').replace(/\r/g, '');
  const block = text.split(`      - name: ${name}\n`)[1]?.split(/\n      - /)[0];
  assert.ok(block, `Schritt fehlt: ${name}`);
  return block.split('        run: |\n')[1]?.split('\n').map((l) => l.replace(/^          /, '')).join('\n');
}

test('Release-Herkunft: echte Git-Historie akzeptiert main-Vorfahren und verweigert Seitenzweig', () => {
  const script = runStep('Tag-Commit an main binden');
  assert.ok(script);
  assert.match(readFileSync(workflow, 'utf8'), /fetch-depth: 0/);
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-release-test-'));
  const git = (cwd, ...args) => {
    const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.trim();
  };
  try {
    git(dir, 'init', '-b', 'main', 'origin');
    const origin = join(dir, 'origin');
    const commit = () => git(origin, '-c', 'user.name=Test', '-c', 'user.email=test@example.org',
      'commit', '--allow-empty', '-m', 'Test');
    commit();
    const ancestor = git(origin, 'rev-parse', 'HEAD');
    commit();
    const main = git(origin, 'rev-parse', 'HEAD');
    git(origin, 'checkout', '-b', 'side', ancestor);
    commit();
    const side = git(origin, 'rev-parse', 'HEAD');
    git(origin, 'checkout', 'main');
    git(dir, 'clone', origin, 'checkout');
    const checkout = join(dir, 'checkout');
    for (const [sha, ok] of [[ancestor, true], [main, true], [side, false], ['missing-commit', false]]) {
      const run = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
        cwd: checkout, encoding: 'utf8', env: { ...process.env, GITHUB_SHA: sha },
      });
      assert.equal(run.status === 0, ok, `${sha}: ${run.stderr}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Echter Workflow-Pack: Bundle enthält keine devDependencies', async () => {
  const root = join(dirname(workflow), '..', '..', 'claude-desktop-admin');
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/@anthropic-ai/mcpb']?.version, '2.1.2');
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-pack-test-'));
  try {
    const script = runStep('Nur Laufzeit-Abhängigkeiten fürs Bundle') + '\n' +
      runStep('Bundle packen und SHA-256 bilden');
    const run = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
      cwd: root, encoding: 'utf8', timeout: 120000,
      env: { ...process.env, RUNNER_TEMP: dir.replace(/\\/g, '/'), VERSION: 'test',
        GITHUB_ENV: join(dir, 'env').replace(/\\/g, '/') },
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const { unzipSync } = await import('fflate');
    const bundle = join(root, 'januaport-admin-test.mcpb');
    const entries = unzipSync(readFileSync(bundle));
    assert.ok(entries['server/index.js']);
    assert.ok(entries['node_modules/@modelcontextprotocol/sdk/package.json']);
    for (const path of Object.keys(entries)) {
      assert.ok(!path.startsWith('test/'), path);
      for (const [pkg, info] of Object.entries(lock.packages)) {
        if (info.dev) assert.ok(!path.startsWith(`${pkg}/`), `devDependency im Bundle: ${path}`);
      }
    }
    assert.ok(existsSync(join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'package.json')),
      'Packwerkzeug muss außerhalb des Bundle-Ordners bleiben');
  } finally {
    rmSync(join(root, 'januaport-admin-test.mcpb'), { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

const ciSamples = [
  { name: 'npm ci ohne Schalter', line: '          npm ci', ok: false },
  { name: 'npm ci --omit=dev ohne Schalter', line: '          npm ci --omit=dev', ok: false },
  { name: 'npm ci --ignore-scripts', line: '          npm ci --ignore-scripts', ok: true },
  { name: 'npm ci --omit=dev --ignore-scripts', line: '          npm ci --omit=dev --ignore-scripts', ok: true },
  { name: 'npx ohne Schalter', line: '          npx --yes packer', ok: false },
  { name: 'npx mit Schalter', line: '          npx --ignore-scripts packer', ok: true },
];

for (const s of ciSamples) {
  test(`Gegenprobe npm-ci-Prüfung: ${s.name}`, () => {
    assert.equal(npmCiWithoutIgnoreScripts(s.line).length === 0, s.ok);
  });
}
