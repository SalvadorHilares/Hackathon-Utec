// handlers/auth/registrarUsuario.js
const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.TABLA_USUARIOS;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i; // Acepta cualquier email válido
const ROLES_PERMITIDOS = new Set(['estudiante', 'administrativo', 'autoridad']);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body JSON inválido' });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const rol = (body.rol || '').trim().toLowerCase();

  if (!email || !password || !rol) {
    return response(400, { message: 'email, password y rol son requeridos' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return response(400, { message: 'email inválido' });
  }
  if (!ROLES_PERMITIDOS.has(rol)) {
    return response(400, { message: 'rol inválido' });
  }

  // Verificar si ya existe usuario con ese email
  try {
    const result = await dynamodb.query({
      TableName: TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    }).promise();

    if ((result.Items || []).length > 0) {
      return response(400, { message: 'Usuario ya registrado' });
    }
  } catch (err) {
    return response(500, { message: `Error consultando usuarios: ${err.message}` });
  }

  const usuario_id = crypto.randomUUID();
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
    await dynamodb.put({
      TableName: TABLE,
      Item: item,
    }).promise();
  } catch (err) {
    return response(500, { message: `Error guardando usuario: ${err.message}` });
  }

  return response(201, {
    usuario_id,
    email,
    rol,
    created_at,
  });
};