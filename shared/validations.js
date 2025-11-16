/**
 * Validar datos de creación de reporte
 */
function validateCrearReporte(data) {
  const errors = [];
  
  if (!data.usuario_id || typeof data.usuario_id !== 'string') {
    errors.push('usuario_id es requerido y debe ser string');
  }
  
  if (!data.tipo || typeof data.tipo !== 'string') {
    errors.push('tipo es requerido y debe ser string');
  }
  
  if (!data.ubicacion || typeof data.ubicacion !== 'string') {
    errors.push('ubicacion es requerida y debe ser string');
  }
  
  if (!data.descripcion || typeof data.descripcion !== 'string') {
    errors.push('descripcion es requerida y debe ser string');
  }
  
  const nivelesUrgencia = ['baja', 'media', 'alta', 'critica'];
  if (!data.nivel_urgencia || !nivelesUrgencia.includes(data.nivel_urgencia)) {
    errors.push(`nivel_urgencia es requerido y debe ser uno de: ${nivelesUrgencia.join(', ')}`);
  }
  
  if (data.imagenes && !Array.isArray(data.imagenes)) {
    errors.push('imagenes debe ser un array');
  }
  
  if (data.videos && !Array.isArray(data.videos)) {
    errors.push('videos debe ser un array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validar datos de actualización de reporte
 */
function validateActualizarReporte(data) {
  const errors = [];
  
  const nivelesUrgencia = ['baja', 'media', 'alta', 'critica'];
  if (data.nivel_urgencia && !nivelesUrgencia.includes(data.nivel_urgencia)) {
    errors.push(`nivel_urgencia debe ser uno de: ${nivelesUrgencia.join(', ')}`);
  }
  
  const estados = ['pendiente', 'en_atencion', 'resuelto'];
  if (data.estado && !estados.includes(data.estado)) {
    errors.push(`estado debe ser uno de: ${estados.join(', ')}`);
  }
  
  if (data.imagenes && !Array.isArray(data.imagenes)) {
    errors.push('imagenes debe ser un array');
  }
  
  if (data.videos && !Array.isArray(data.videos)) {
    errors.push('videos debe ser un array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validar UUID
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Crear respuesta HTTP estándar
 */
function createResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers
    },
    body: JSON.stringify(body)
  };
}

module.exports = {
  validateCrearReporte,
  validateActualizarReporte,
  isValidUUID,
  createResponse
};

