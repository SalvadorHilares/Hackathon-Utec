// shared/response.js
// Helper para crear respuestas HTTP con headers CORS

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Crea una respuesta HTTP con headers CORS
 * @param {number} statusCode - Código de estado HTTP
 * @param {object} body - Cuerpo de la respuesta
 * @param {object} additionalHeaders - Headers adicionales (opcional)
 * @returns {object} Respuesta HTTP formateada
 */
function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

/**
 * Crea una respuesta de éxito (200)
 */
function success(body, additionalHeaders = {}) {
  return createResponse(200, body, additionalHeaders);
}

/**
 * Crea una respuesta de creación exitosa (201)
 */
function created(body, additionalHeaders = {}) {
  return createResponse(201, body, additionalHeaders);
}

/**
 * Crea una respuesta de error de validación (400)
 */
function badRequest(message, additionalHeaders = {}) {
  return createResponse(400, { error: 'Bad Request', message }, additionalHeaders);
}

/**
 * Crea una respuesta de no autorizado (401)
 */
function unauthorized(message = 'No autorizado', additionalHeaders = {}) {
  return createResponse(401, { error: 'Unauthorized', message }, additionalHeaders);
}

/**
 * Crea una respuesta de prohibido (403)
 */
function forbidden(message = 'Acceso denegado', additionalHeaders = {}) {
  return createResponse(403, { error: 'Forbidden', message }, additionalHeaders);
}

/**
 * Crea una respuesta de no encontrado (404)
 */
function notFound(message = 'Recurso no encontrado', additionalHeaders = {}) {
  return createResponse(404, { error: 'Not Found', message }, additionalHeaders);
}

/**
 * Crea una respuesta de error interno (500)
 */
function internalError(message = 'Error interno del servidor', additionalHeaders = {}) {
  return createResponse(500, { error: 'Internal Server Error', message }, additionalHeaders);
}

module.exports = {
  createResponse,
  success,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalError,
  CORS_HEADERS
};

