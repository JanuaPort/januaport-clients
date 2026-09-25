// Plan §3 Nr. 1: Die Adresse der Anlage ist nur https, ohne Pfad, Query,
// Fragment oder Zugangsdaten; der Zielpfad ist immer /admin/mcp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress } from '../server/bridge.js';

const accepted = [
  { name: 'https ohne Schlussschrägstrich', raw: 'https://box.example.com', want: 'https://box.example.com/admin/mcp' },
  { name: 'Schlussschrägstrich normalisiert', raw: 'https://box.example.com/', want: 'https://box.example.com/admin/mcp' },
  { name: 'mit Port', raw: 'https://box.example.com:8443', want: 'https://box.example.com:8443/admin/mcp' },
  { name: 'Leerraum außen', raw: '  https://box.local  ', want: 'https://box.local/admin/mcp' },
  { name: 'IP-Adresse', raw: 'https://192.0.2.10', want: 'https://192.0.2.10/admin/mcp' },
];

for (const c of accepted) {
  test(`parseAddress nimmt an: ${c.name}`, () => {
    assert.equal(parseAddress(c.raw), c.want);
  });
}

const rejected = [
  { name: 'http', raw: 'http://box.local', hint: /https/ },
  { name: 'Pfad', raw: 'https://box.local/mcp', hint: /Pfad/ },
  { name: 'Pfad /admin/mcp selbst', raw: 'https://box.local/admin/mcp', hint: /Pfad/ },
  { name: 'Query', raw: 'https://box.local/?x=1', hint: /Pfad|Query/ },
  { name: 'Fragment', raw: 'https://box.local/#a', hint: /Pfad|Query/ },
  { name: 'Zugangsdaten in der Adresse', raw: 'https://user:pw@box.example.com', hint: /Zugangsdaten/ },
  { name: 'leer', raw: '', hint: /Adresse/ },
  { name: 'ohne Schema', raw: 'box.local', hint: /https/ },
  { name: 'fremdes Schema', raw: 'ftp://box.local', hint: /https/ },
];

for (const c of rejected) {
  test(`parseAddress weist ab: ${c.name}`, () => {
    assert.throws(() => parseAddress(c.raw), c.hint);
  });
}

test('parseAddress weist fehlende Adresse ab', () => {
  assert.throws(() => parseAddress(undefined), /Adresse/);
});
