// GATE-Auflage zu JanuaPort/januaport#888: Im Release-Workflow ist jede
// Action auf einen vollen Commit-SHA gepinnt, mit Versionskommentar dahinter.
// Ein Tag ließe sich umhängen; der Release baut das ausgelieferte Bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const workflow = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.github', 'workflows',
  'claude-desktop-admin-release.yml');

const pinned = /^\s*-?\s*uses:\s*[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+\s*$/;

function unpinned(text) {
  return text.split(/\r?\n/).filter((l) => /^\s*-?\s*uses:/.test(l) && !pinned.test(l));
}

test('Release-Workflow: jede Action auf vollen SHA gepinnt', () => {
  const text = readFileSync(workflow, 'utf8');
  assert.ok(text.split(/\r?\n/).some((l) => /^\s*-?\s*uses:/.test(l)), 'keine uses:-Zeile gefunden');
  assert.deepEqual(unpinned(text), []);
});

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
