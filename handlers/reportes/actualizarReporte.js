const { scan, putItem, getTimestamp } = require('../../shared/dynamodb');
const { validateActualizarReporte, isValidUUID, createResponse } = require('../../shared/validations');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TENANT_ID = process.env.TENANT_ID || 'utec';

async function handler(event) {
  try {
    const reporte_id = event.pathParameters?.reporte_id;
    
    if (!reporte_id || !isValidUUID(reporte_id)) {
      return createResponse(400, {
        error: 'reporte_id inválido o faltante'
      });
    }
    
    // Obtener reporte usando scan con filtro
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
    
    const reporteActual = reportes[0];
    
    const body = JSON.parse(event.body || '{}');
    
    // Validar datos
    const validation = validateActualizarReporte(body);
    if (!validation.isValid) {
      return createResponse(400, {
        error: 'Datos inválidos',
        detalles: validation.errors
      });
    }
    
    // Actualizar reporte
    const fecha_actualizacion = getTimestamp();
    const reporteActualizado = {
      ...reporteActual,
      ...body,
      fecha_actualizacion
    };
    
    // Mantener campos que no deben cambiar
    reporteActualizado.reporte_id = reporteActual.reporte_id;
    reporteActualizado.fecha_creacion = reporteActual.fecha_creacion;
    reporteActualizado.usuario_id = reporteActual.usuario_id;
    
    await putItem(TABLA_REPORTES, reporteActualizado);
    
    // Si cambió el estado, actualizar Tabla Estados
    if (body.estado && body.estado !== reporteActual.estado) {
      const estado = {
        reporte_id,
        timestamp: fecha_actualizacion,
        tenant_id: TENANT_ID,
        user_id: body.user_id || reporteActual.usuario_id,
        estado: body.estado,
        detalles_estado: [{
          message: `Estado cambiado de ${reporteActual.estado} a ${body.estado}`,
          actualizado_por: body.user_id || reporteActual.usuario_id,
          start_time: fecha_actualizacion,
          end_time: '',
          notes: body.notes || ''
        }]
      };
      
      await putItem(TABLA_ESTADOS, estado);
    }
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_actualizacion,
      accion: 'actualizar',
      usuario_id: body.user_id || reporteActual.usuario_id,
      rol: body.rol || 'estudiante',
      entidad_afectada: 'reporte',
      detalles_antes: reporteActual,
      detalles_despues: reporteActualizado,
      notas: body.notes || 'Reporte actualizado',
      ip_address: event.requestContext?.identity?.sourceIp || '',
      user_agent: event.requestContext?.identity?.userAgent || ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    return createResponse(200, {
      mensaje: 'Reporte actualizado exitosamente',
      reporte: reporteActualizado
    });
    
  } catch (error) {
    console.error('Error al actualizar reporte:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

