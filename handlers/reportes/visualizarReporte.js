const { scan, query } = require('../../shared/dynamodb');
const { isValidUUID, createResponse } = require('../../shared/validations');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;

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
    
    // Obtener reporte usando scan con filtro (ya que tenemos clave compuesta)
    const reportes = await scan(
      TABLA_REPORTES,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    if (!reportes || reportes.length === 0) {
      return createResponse(404, {
        error: 'Reporte no encontrado'
      });
    }
    
    const reporte = reportes[0];
    
    // Obtener estado actual (último estado)
    const estados = await query(
      TABLA_ESTADOS,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    // Ordenar por timestamp descendente y tomar el más reciente
    const estadoActual = estados
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
    
    return createResponse(200, {
      reporte,
      estado_actual: estadoActual
    });
    
  } catch (error) {
    console.error('Error al visualizar reporte:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

