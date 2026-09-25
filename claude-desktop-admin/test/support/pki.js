// Test-PKI, zur Laufzeit mit dem openssl-CLI erzeugt: zwei Wurzel-CAs und ein
// Serverzertifikat für localhost/127.0.0.1, signiert von der ersten. Kein
// Schlüsselmaterial liegt im Repository; alles lebt in einem Temp-Ordner.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Eine eigene Minimal-Konfiguration, damit eine fremde OPENSSL_CONF auf dem
// Rechner (z. B. von einem anderen Programm gesetzt) den Test nicht stört.
function openssl(args, cwd) {
  try {
    const env = { ...process.env, OPENSSL_CONF: join(cwd, 'openssl.cnf') };
    execFileSync('openssl', args, { cwd, env, stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    throw new Error(`openssl ${args[0]} fehlgeschlagen (openssl im PATH?): ${err.stderr ?? err.message}`);
  }
}

const ecKey = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes'];

function makeCA(dir, name) {
  openssl(['req', '-x509', ...ecKey, '-keyout', `${name}.key`, '-out', `${name}.crt`, '-days', '1',
    '-subj', `/CN=JanuaPort Test ${name}`,
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign'], dir);
  return join(dir, `${name}.crt`);
}

export function createTestPki() {
  const dir = mkdtempSync(join(tmpdir(), 'jnpt-pki-'));
  writeFileSync(join(dir, 'openssl.cnf'), '[req]\ndistinguished_name = dn\n[dn]\n');
  const caFile = makeCA(dir, 'ca');
  const wrongCaFile = makeCA(dir, 'wrongca');
  writeFileSync(join(dir, 'ext.cnf'),
    'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
  openssl(['req', ...ecKey, '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost'], dir);
  openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial',
    '-out', 'server.crt', '-days', '1', '-extfile', 'ext.cnf'], dir);
  return {
    dir,
    caFile,
    wrongCaFile,
    key: readFileSync(join(dir, 'server.key')),
    cert: readFileSync(join(dir, 'server.crt')),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
