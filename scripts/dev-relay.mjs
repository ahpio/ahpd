#!/usr/bin/env node
/**
 * A throwaway Web Push relay, for trying the push plugin's relay path.
 *
 * It does what a native app and its relay do together, with no FCM or APNs
 * behind it: it makes a device's keys, registers the device on a daemon with
 * `x-ahpd/push/put`, and serves the endpoint that device was given. Each
 * request to that endpoint is checked as a relay checks it - the VAPID key is
 * the host's, the signature verifies, `aud` is this relay and `exp` is still to
 * come - then opened with the device's keys and printed.
 *
 * Make a certificate for loopback, run the daemon trusting it with the relay's
 * host allowed, and run the relay:
 *
 *   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 7 \
 *     -subj /CN=localhost -addext subjectAltName=DNS:localhost \
 *     -keyout relay-key.pem -out relay-cert.pem
 *   NODE_EXTRA_CA_CERTS=relay-cert.pem ahpd   # with "relayHosts": ["localhost"] in @ahpd/push's options
 *   node scripts/dev-relay.mjs --cert relay-cert.pem --key relay-key.pem
 *
 * Flags:
 *
 *   --daemon <url>      the daemon's websocket, ws://127.0.0.1:9187 by default
 *   --token <secret>    the connection token, sent as Authorization: Bearer
 *   --port <n>          the relay's HTTPS port, 9443 by default
 *   --cert <file>       the relay's certificate, PEM
 *   --key <file>        the relay's private key, PEM
 *   --id <id>           the device id, dev-relay by default
 *   --platform <name>   android, ios or web; android by default
 *   --answer <status>   what every request is answered: 201 by default, or 410, 500 or any status
 *
 * The device is removed when the relay stops, unless the relay answered 410 and
 * the host removed it already. Nothing here is a relay to run for real: it
 * forwards nothing and keeps nothing.
 */
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { parseArgs } from 'node:util';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@microsoft/agent-host-protocol';
import WebSocket from 'ws';

const { values } = parseArgs({
  options: {
    daemon: { type: 'string', default: 'ws://127.0.0.1:9187' },
    token: { type: 'string' },
    port: { type: 'string', default: '9443' },
    cert: { type: 'string' },
    key: { type: 'string' },
    id: { type: 'string', default: 'dev-relay' },
    platform: { type: 'string', default: 'android' },
    answer: { type: 'string', default: '201' },
  },
});

if (values.cert === undefined || values.key === undefined) {
  console.error('dev-relay: --cert and --key are required; the usage at the top of this file makes a pair');
  process.exit(2);
}
const port = Number(values.port);
const answer = Number(values.answer);
const origin = `https://localhost:${port}`;
const path = `/d/${encodeURIComponent(values.id)}`;

/** The device's own keys, as an app makes them when it subscribes: a P-256 pair and a 16-byte secret. */
const device = createECDH('prime256v1');
device.generateKeys();
const auth = randomBytes(16);
const keys = { p256dh: device.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };

/** One JSON-RPC connection to the daemon, with a request that answers its result or throws its error. */
const connect = async () => {
  const socket = new WebSocket(values.daemon, values.token === undefined ? {} : { headers: { authorization: `Bearer ${values.token}` } });
  await new Promise((done, fail) => { socket.once('open', done); socket.once('error', fail); });
  let next = 0;
  const waiting = new Map();
  socket.on('message', (raw) => {
    const said = JSON.parse(String(raw));
    if (said.id === undefined || !waiting.has(said.id)) return;
    const { done, fail } = waiting.get(said.id);
    waiting.delete(said.id);
    if (said.error !== undefined) fail(new Error(`${said.error.code}: ${said.error.message}`));
    else done(said.result);
  });
  const request = (method, params) => new Promise((done, fail) => {
    next += 1;
    waiting.set(next, { done, fail });
    socket.send(JSON.stringify({ jsonrpc: '2.0', id: next, method, params }));
  });
  return { request, close: () => { socket.close(); } };
};

/** The channel a command that names no session is sent on. */
const ROOT = 'ahp-root://';

const daemon = await connect();
await daemon.request('initialize', { clientId: 'dev-relay', protocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] });
const vapid = JSON.parse((await daemon.request('resourceRead', { channel: ROOT, uri: 'push://vapid' })).data);
const hostKey = Buffer.from(vapid.publicKey, 'base64url');
await daemon.request('x-ahpd/push/put', {
  channel: ROOT,
  id: values.id,
  record: { transport: 'webpush', platform: values.platform, endpoint: `${origin}${path}`, keys },
});
console.log(`dev-relay: registered ${values.id} at ${origin}${path}, for the host key ${vapid.publicKey}`);

/** The host's key as a verifying key: the uncompressed point's two halves as a JWK. */
const verifying = createPublicKey({
  key: { kty: 'EC', crv: 'P-256', x: hostKey.subarray(1, 33).toString('base64url'), y: hostKey.subarray(33, 65).toString('base64url') },
  format: 'jwk',
});

/** What is wrong with a request's VAPID header, or nothing when a relay would take it. */
const vapidProblem = (header) => {
  const token = /t=([^,\s]+)/u.exec(header ?? '')?.[1];
  const key = /k=([^,\s]+)/u.exec(header ?? '')?.[1];
  if (token === undefined || key === undefined) return 'the Authorization header is not vapid t=..., k=...';
  if (key !== vapid.publicKey) return `the header's key ${key} is not the host's ${vapid.publicKey}`;
  const [head, claims, signature] = token.split('.');
  if (head === undefined || claims === undefined || signature === undefined) return 'the token is not a JWT';
  const signed = verify('sha256', Buffer.from(`${head}.${claims}`, 'utf8'), { key: verifying, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
  if (!signed) return 'the signature does not verify with the host key';
  const said = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
  if (said.aud !== origin) return `aud is ${said.aud}, not ${origin}`;
  if (typeof said.exp !== 'number' || said.exp <= Date.now() / 1000) return 'exp has passed';
  return undefined;
};

/**
 * One `aes128gcm` body opened with the device's keys: RFC 8188's header, then
 * RFC 8291's key and nonce from the ECDH secret, the auth secret and the salt.
 */
const opened = (body) => {
  const salt = body.subarray(0, 16);
  const idLength = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLength);
  const record = body.subarray(21 + idLength);
  const shared = device.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), device.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, info, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(record.subarray(record.length - 16));
  const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
  // The last record ends with the delimiter 2, then any padding of zeros.
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end -= 1;
  return JSON.parse(plain.subarray(0, end).toString('utf8'));
};

let removed = false;

const server = createServer({ cert: readFileSync(values.cert), key: readFileSync(values.key) }, (request, response) => {
  const chunks = [];
  request.on('data', (chunk) => { chunks.push(chunk); });
  request.on('end', () => {
    const at = new Date().toISOString();
    if (request.method !== 'POST' || request.url !== path) {
      console.log(`${at} ${request.method} ${request.url}: no device here, answered 404`);
      response.writeHead(404).end();
      return;
    }
    const problem = vapidProblem(request.headers.authorization);
    if (problem !== undefined) {
      console.log(`${at} refused, answered 401: ${problem}`);
      response.writeHead(401).end();
      return;
    }
    let notice;
    try {
      notice = opened(Buffer.concat(chunks));
    }
    catch (error) {
      console.log(`${at} could not open the message, answered 400: ${error.message}`);
      response.writeHead(400).end();
      return;
    }
    const { ttl, urgency, topic } = request.headers;
    console.log(`${at} TTL ${ttl} Urgency ${urgency} Topic ${topic}`);
    console.log(JSON.stringify(notice, null, 2));
    if (answer === 410) removed = true;
    console.log(`${at} answered ${answer}`);
    response.writeHead(answer).end();
  });
});
server.listen(port, () => { console.log(`dev-relay: listening on ${origin}`); });

const stop = async () => {
  server.close();
  if (!removed) {
    try {
      await daemon.request('x-ahpd/push/remove', { channel: ROOT, id: values.id });
      console.log(`dev-relay: removed ${values.id}`);
    }
    catch (error) {
      console.log(`dev-relay: could not remove ${values.id}: ${error.message}`);
    }
  }
  daemon.close();
  process.exit(0);
};
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
