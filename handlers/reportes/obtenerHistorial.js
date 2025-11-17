const { query } = require('../../shared/dynamodb');
const { isValidUUID, createResponse } = require('../../shared/validations');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;

async function handler(event) {
  try {
    // Verificar autenticación JWT
    const auth = verifyJwtFromEvent(event);
    if (!auth) {
      return createResponse(401, {
        error: 'No autorizado',
        mensaje: 'Token JWT inválido o faltante. Debe incluir: Authorization: Bearer <token>'
      });
    }

    const reporte_id = event.pathParameters?.reporte_id;
    
    if (!reporte_id || !isValidUUID(reporte_id)) {
      return createResponse(400, {
        error: 'reporte_id inválido o faltante'
      });
    }
    
    // Consultar historial
    const historial = await query(
      TABLA_HISTORIAL,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    // Ordenar por timestamp descendente (más reciente primero)
    historial.sort((a, b) => new Date(b.timestamp_accion) - new Date(a.timestamp_accion));
    
    return createResponse(200, {
      reporte_id,
      total_acciones: historial.length,
      historial
    });
    
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

