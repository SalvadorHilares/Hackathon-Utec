const { scan, query } = require('../../shared/dynamodb');
const { isValidUUID, createResponse } = require('../../shared/validations');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
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
    
    // Obtener reporte
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
    
    // Obtener estados
    const estados = await query(
      TABLA_ESTADOS,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    estados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Obtener estado trabajo si hay trabajador asignado
    let estadoTrabajo = null;
    if (reporte.trabajador_asignado) {
      const estadosTrabajo = await query(
        TABLA_ESTADO_TRABAJO,
        'reporte_id = :reporte_id',
        { ':reporte_id': reporte_id }
      );
      estadoTrabajo = estadosTrabajo.find(et => et.trabajador_id === reporte.trabajador_asignado) || null;
    }
    
    // Obtener historial reciente (últimas 10 acciones)
    const historial = await query(
      TABLA_HISTORIAL,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    historial.sort((a, b) => new Date(b.timestamp_accion) - new Date(a.timestamp_accion));
    const historialReciente = historial.slice(0, 10);
    
    return createResponse(200, {
      reporte,
      estado_actual: estados[0] || null,
      estados: estados,
      estado_trabajo: estadoTrabajo,
      historial_reciente: historialReciente,
      total_acciones_historial: historial.length
    });
    
  } catch (error) {
    console.error('Error al obtener reporte completo:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

