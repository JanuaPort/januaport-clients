// Bausteine der Brücke: Adresse prüfen, Kopfzeile bauen, Fehler für Menschen
// übersetzen. Kein Zustand, keine Ein- und Ausgabe; die Verdrahtung macht
// index.js.

const ADMIN_PATH = '/admin/mcp';

export function parseAddress(raw) {
  const text = (raw ?? '').trim();
  if (text === '') {
    throw new Error('Adresse der Anlage fehlt. / Address of the installation is missing.');
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`Adresse muss mit https:// beginnen, z. B. https://box.local. / Address must start with https://.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error('Nur https:// ist erlaubt, z. B. https://box.local. / Only https:// is allowed.');
  }
  if (url.username || url.password) {
    throw new Error('Keine Zugangsdaten in der Adresse; der Admin-Token gehört in sein eigenes Feld. / No credentials in the address.');
  }
  if (url.pathname !== '/' || url.search || url.hash || /[?#]/.test(text)) {
    throw new Error(`Nur die Basisadresse ohne Pfad oder Query angeben, z. B. https://box.local; ${ADMIN_PATH} hängt die Brücke selbst an. / Base address only, no path or query.`);
  }
  return `${url.origin}${ADMIN_PATH}`;
}

export function authHeaders(token) {
  if (typeof token !== 'string' || token.trim() === '' || /[\r\n]/.test(token)) {
    throw new Error('Admin-Token fehlt oder ist ungültig. / Admin token missing or invalid.');
  }
  return { Authorization: `Bearer ${token.trim()}` };
}

// Claude Desktop ersetzt ein leer gelassenes optionales Feld nicht, sondern
// lässt den Platzhalter stehen (Referenz-Implementierung in mcpb, Stand 09/2026).
export function caFileFromEnv(value) {
  if (!value || value.trim() === '' || /^\$\{user_config\.[^}]*\}$/.test(value.trim())) return undefined;
  return value;
}

export function redact(text, secret) {
  if (!secret) return text;
  return String(text).split(secret).join('***');
}

// K1: Die Brücke folgt keiner Umleitung; sonst ginge der Admin-Token an eine
// Adresse, die der Admin nicht eingetragen hat.
export function noRedirectFetch(url, init, baseFetch = fetch) {
  return baseFetch(url, { ...init, redirect: 'error' });
}

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'CERT_SIGNATURE_FAILURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function causes(err) {
  const chain = [];
  for (let e = err; e && chain.length < 10; e = e.cause) chain.push(e);
  return chain;
}

function certMessage(code, { caFile }) {
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return 'Das Zertifikat der Anlage gilt nicht für diesen Hostnamen. Tragen Sie die Adresse so ein, wie sie im Zertifikat steht. / Certificate does not match the host name.';
  }
  if (caFile) {
    return `Das Zertifikat der Anlage passt nicht zur hinterlegten CA-Datei ${caFile}. Hinterlegen Sie die Wurzel-CA dieser Anlage (bei Caddy mit tls internal: root.crt der lokalen CA). / Certificate does not match the configured CA file.`;
  }
  return 'Das Zertifikat der Anlage stammt nicht von einer bekannten CA. Hinterlegen Sie die Wurzel-CA der Anlage als CA-Datei (bei Caddy mit tls internal: root.crt der lokalen CA). / Certificate not trusted; configure the CA file.';
}

export function describeError(err, ctx = {}) {
  const chain = causes(err);
  const status = chain.find((e) => typeof e.code === 'number')?.code;
  if (status === 401) {
    return 'Admin-Token falsch oder abgelaufen (Admin-Tokens haben ein Ablaufdatum). Neuen Token ausstellen: jnpt admin-token create --expires 720h --label <name>. / Admin token wrong or expired.';
  }
  if (status === 404) {
    return 'Unter dieser Adresse gibt es keinen Admin-MCP. Ist das die öffentliche Adresse? Dort ist der Admin-MCP absichtlich nicht erreichbar; nehmen Sie die Adresse im lokalen Netz. / No admin MCP at this address.';
  }
  const tls = chain.find((e) => TLS_CODES.has(e.code));
  if (tls) return certMessage(tls.code, ctx);
  if (chain.some((e) => /redirect/i.test(e.message ?? ''))) {
    return 'Die Anlage antwortet mit einer Umleitung; die Brücke folgt keiner Umleitung. Tragen Sie die Adresse ein, unter der die Anlage direkt antwortet. / The bridge does not follow redirects.';
  }
  const detail = chain.map((e) => e.code ?? e.message).filter(Boolean).join(' / ');
  return redact(`Verbindung zur Anlage fehlgeschlagen: ${detail} / Connection to the installation failed.`, ctx.token);
}
