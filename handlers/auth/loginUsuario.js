// handlers/auth/loginUsuario.js
const { query } = require('../../shared/dynamodb');
const { createResponse, unauthorized, badRequest, internalError } = require('../../shared/response');
const crypto = require('crypto');

const TABLE = process.env.TABLA_USUARIOS;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'alerta-utec-123';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i; // Acepta cualquier email válido

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(usuario_id, email, rol, expSeconds = 4 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: usuario_id,
    email,
    rol,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(signingInput)
    .digest();

  const signatureB64 = base64url(signature);
  return `${signingInput}.${signatureB64}`;
}

exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return badRequest('Body JSON inválido');
    }

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return badRequest('email y password son requeridos');
    }
    if (!EMAIL_REGEX.test(email)) {
      return badRequest('email inválido');
    }

    if (!TABLE) {
      return internalError('Error de configuración: tabla no definida');
    }

    let user;
    try {
      const items = await query(
        TABLE,
        'email = :email',
        { ':email': email },
        'email-index'
      );

      if (!items || items.length === 0) {
        return unauthorized('Credenciales inválidas');
      }
      user = items[0];
    } catch (err) {
      console.error('Error consultando usuario:', err);
      return internalError(`Error consultando usuario: ${err.message}`);
    }

    const stored_hash = user.password_hash;
    if (!stored_hash || stored_hash !== hashPassword(password)) {
      return unauthorized('Credenciales inválidas');
    }

    const usuario_id = user.usuario_id;
    const rol = user.rol;

    const token = createJwt(usuario_id, email, rol);

    return createResponse(200, {
      token,
      usuario: {
        usuario_id,
        email,
        rol,
      },
    });
  } catch (error) {
    console.error('Error inesperado en handler:', error);
    return internalError(`Error interno del servidor: ${error.message}`);
  }
};