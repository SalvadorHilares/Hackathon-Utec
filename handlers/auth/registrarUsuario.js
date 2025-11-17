// handlers/auth/registrarUsuario.js
const { query, putItem, generateUUID } = require('../../shared/dynamodb');
const { created, badRequest, internalError } = require('../../shared/response');
const crypto = require('crypto');

const TABLE = process.env.TABLA_USUARIOS;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i; // Acepta cualquier email válido
const ROLES_PERMITIDOS = new Set(['estudiante', 'administrativo', 'trabajador']);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
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
    const rol = (body.rol || '').trim().toLowerCase();

    if (!email || !password || !rol) {
      return badRequest('email, password y rol son requeridos');
    }
    if (!EMAIL_REGEX.test(email)) {
      return badRequest('email inválido');
    }
    if (!ROLES_PERMITIDOS.has(rol)) {
      return badRequest('rol inválido');
    }

    if (!TABLE) {
      return internalError('Error de configuración: tabla no definida');
    }

    // Verificar si ya existe usuario con ese email
    try {
      const items = await query(
        TABLE,
        'email = :email',
        { ':email': email },
        'email-index'
      );

      if (items && items.length > 0) {
        return badRequest('Usuario ya registrado');
      }
    } catch (err) {
      console.error('Error consultando usuarios:', err);
      return internalError(`Error consultando usuarios: ${err.message}`);
    }

    const usuario_id = generateUUID();
    const created_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const password_hash = hashPassword(password);

    const item = {
      usuario_id,
      email,
      password_hash,
      rol,
      created_at,
    };

    try {
      await putItem(TABLE, item);
    } catch (err) {
      console.error('Error guardando usuario:', err);
      return internalError(`Error guardando usuario: ${err.message}`);
    }

    return created({
      usuario_id,
      email,
      rol,
      created_at,
    });
  } catch (error) {
    console.error('Error inesperado en handler:', error);
    return internalError(`Error interno del servidor: ${error.message}`);
  }
};