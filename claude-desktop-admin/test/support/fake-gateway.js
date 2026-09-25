// Ein minimaler Stand-in für /admin/mcp einer Anlage: HTTPS, Bearer-Prüfung,
// zustandslos, beide Protokoll-Ären (initialize → tools/list). Er zeichnet jede
// Anfrage mit Methode, Pfad und Authorization-Kopf auf.
import https from 'node:https';

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => resolve(body));
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function answer(msg) {
  switch (msg.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id: msg.id, result: {
          protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'fake-jnpt-admin', version: '0.0.0' },
        },
      };
    case 'tools/list':
      return {
        jsonrpc: '2.0', id: msg.id, result: {
          tools: [{ name: 'admin_list_catalog', description: 'Katalog lesen', inputSchema: { type: 'object', properties: {} } }],
        },
      };
    default:
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found' } };
  }
}

// mode: 'ok' | 'status404' | 'redirect'
export async function startFakeGateway({ key, cert, token, mode = 'ok', redirectTo }) {
  const requests = [];
  const server = https.createServer({ key, cert }, async (req, res) => {
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
    const body = await readBody(req);
    if (mode === 'redirect') {
      res.writeHead(307, { location: redirectTo });
      return res.end();
    }
    if (mode === 'status404' || req.url !== '/admin/mcp') return json(res, 404, { error: 'not found' });
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' });
      return res.end();
    }
    const msg = JSON.parse(body);
    if (msg.id === undefined) {
      res.writeHead(202);
      return res.end();
    }
    return json(res, 200, answer(msg));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `https://localhost:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
  };
}
