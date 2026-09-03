// Minimal VAPID push sender using WebCrypto (native in Cloudflare Workers).
//
// Implements just enough of the VAPID spec to sign the HTTP request and
// encrypt the payload for the browser Push API. No bundling, no npm deps.
//
// Reference: https://webpushwg.github.io/webpush-spec/#appendix-vapid-protocol
//
// Inputs (all base64url):
//   PRIVATE_KEY  — raw 32-byte P-256 scalar
//   PUBLIC_KEY   — base64url SPKI SubjectPublicKeyInfo (matches the app's
//                  __VITE_PUSH_PUBLIC_KEY__, used by the browser to derive the
//                  shared secret)
//   SUB          — { endpoint, p256dh, auth } from the browser Push API
//   PAYLOAD      — JSON string shown in the notification

// ---- base64url helpers ---------------------------------------------------
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b) {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// SPKI DER -> raw 65-byte EC point (for the VAPID `key=` header).
// P-256 SPKI layout: 302a300506032b6570032100 + <65-byte point>
function spkiToRawPoint(spkiB64url) {
  const der = b64urlToBytes(spkiB64url);
  return bytesToB64url(der.slice(der.length - 65));
}

// ---- VAPID signing -------------------------------------------------------
async function importKey(b64url, type, usages) {
  return crypto.subtle.importKey('raw', b64urlToBytes(b64url),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, usages)
    .catch(() => crypto.subtle.importKey(type, b64urlToBytes(b64url),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, usages));
}

async function signVapid(authHeaders, privateKeyB64url, contentEncoding) {
  const key = await importKey(privateKeyB64url, 'pkcs8', ['sign']);
  const body = authHeaders.join('\n');
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(body));
  return bytesToB64url(new Uint8Array(sig));
}

// ---- VAPID encryption ----------------------------------------------------
async function deriveSharedSecret(pubKeyB64url, privKeyB64url) {
  const pub = await crypto.subtle.importKey(
    'spki', b64urlToBytes(pubKeyB64url), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const priv = await crypto.subtle.importKey(
    'pkcs8', b64urlToBytes(privKeyB64url), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: pub }, priv, 256);
  return new Uint8Array(shared);
}

async function encryptPayload(payloadBytes, sharedSecret, sub) {
  const auth = b64urlToBytes(sub.auth);
  const keyB64 = bytesToB64url(sharedSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyObj = await crypto.subtle.importKey(
    'raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt']);

  // AEAD-Encrypt: nonce = iv, aad = keyB64 || salt || iv, key = AES-256-GCM
  const aad = new Uint8Array([...new TextEncoder().encode(keyB64), ...salt, ...iv]);
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', nonce: iv, aad, tagLength: 12 }, keyObj, payloadBytes);

  return {
    salt: bytesToB64url(salt),
    iv: bytesToB64url(iv),
    ciphertext: bytesToB64url(new Uint8Array(enc)),
  };
}

// ---- Public API ------------------------------------------------------------
// Returns the full set of headers to send to sub.endpoint.
export async function buildPushHeaders(sub, payloadObj, keys) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const sharedSecret = await deriveSharedSecret(keys.publicKey, keys.privateKey);
  const { salt, iv, ciphertext } = await encryptPayload(payloadBytes, sharedSecret, sub);

  const contentEncoding = 'aesgcm';
  const authSecret = bytesToB64url(b64urlToBytes(sub.auth));
  // The VAPID `key=` header uses the raw 65-byte EC point, not the SPKI DER.
  const rawPoint = spkiToRawPoint(keys.publicKey);

  const authHeaders = [
    `timestamp=${Math.floor(Date.now() / 1000)}`,
    `encryption: salt=${salt}, iv=${iv}`,
    `content-encoding: ${contentEncoding}`,
    `authorization: key=${rawPoint}`,
  ];
  const authSig = await signVapid(authHeaders, keys.privateKey, contentEncoding);

  return {
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(payloadBytes.length),
    'Encryption': `salt=${salt}, iv=${iv}`,
    'Content-Encoding': contentEncoding,
    'Authorization': `key=${rawPoint}, timestamp=${Math.floor(Date.now() / 1000)}, auth=${authSecret}`,
    // VAPID auth header (separate from the browser `Authorization: key=`)
    'Vapid': `key=${rawPoint}, t=${Math.floor(Date.now() / 1000)}, sig=${authSig}`,
  };
}

export async function sendPush(sub, payloadObj, keys) {
  const headers = await buildPushHeaders(sub, payloadObj, keys);
  const res = await fetch(sub.endpoint, { method: 'PUT', headers, body: '' });
  return { status: res.status, ok: res.ok };
}
