// utils/auth.js
const crypto = require('crypto');

const DEFAULT_SECRET = 'alerta-utec-123';

function base64urlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (str.length % 4);
  if (padding !== 4) str += '='.repeat(padding);
  return Buffer.from(str, 'base64').toString('utf8');
}

function getSecret(override) {
  return override || process.env.TOKEN_SECRET || DEFAULT_SECRET;
}

function verifyJwt(token, secretOverride) {
  const secret = getSecret(secretOverride);

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest();

    const expectedSigB64 = base64urlEncode(expectedSig);

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedSigB64),
        Buffer.from(signatureB64)
      )
    ) {
      return null;
    }

    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);

    const exp = payload.exp;
    if (!exp || Math.floor(Date.now() / 1000) > exp) {
      return null;
    }

    const usuario_id = payload.sub;
    const email = payload.email;
    const rol = payload.rol;

    if (!usuario_id || !rol) return null;

    return { usuario_id, email, rol };
  } catch {
    return null;
  }
}

function verifyJwtFromEvent(event, secretOverride) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring('Bearer '.length).trim();
  return verifyJwt(token, secretOverride);
}

module.exports = {
  verifyJwt,
  verifyJwtFromEvent,
};