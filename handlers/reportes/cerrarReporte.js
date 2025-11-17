const { scan, putItem, getTimestamp } = require('../../shared/dynamodb');
const { isValidUUID, createResponse } = require('../../shared/validations');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const TENANT_ID = process.env.TENANT_ID || 'utec';

// Roles permitidos para cerrar reportes
const ROLES_ADMINISTRATIVOS = new Set(['administrativo']);

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

    // Validar que el usuario tenga rol administrativo
    if (!ROLES_ADMINISTRATIVOS.has(auth.rol)) {
      return createResponse(403, {
        error: 'Acceso denegado',
        mensaje: 'Solo usuarios con rol administrativo pueden cerrar reportes'
      });
    }

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
    
    const reporte = reportes[0];
    
    if (reporte.estado === 'resuelto') {
      return createResponse(400, {
        error: 'El reporte ya está cerrado'
      });
    }
    
    const body = JSON.parse(event.body || '{}');
    const fecha_actualizacion = getTimestamp();
    
    // Actualizar reporte
    reporte.estado = 'resuelto';
    reporte.fecha_actualizacion = fecha_actualizacion;
    
    await putItem(TABLA_REPORTES, reporte);
    
    // Crear nuevo estado "resuelto"
    const estado = {
      reporte_id,
      timestamp: fecha_actualizacion,
      tenant_id: TENANT_ID,
      user_id: auth.usuario_id, // Usar usuario_id del token
      estado: 'resuelto',
      detalles_estado: [{
        message: 'Reporte cerrado/resuelto',
        actualizado_por: auth.usuario_id, // Usar usuario_id del token
        start_time: fecha_actualizacion,
        end_time: '',
        notes: body.notes || 'Reporte cerrado por administrador'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estado);
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_actualizacion,
      accion: 'cerrar',
      usuario_id: auth.usuario_id, // Usar usuario_id del token
      rol: auth.rol, // Usar rol del token
      entidad_afectada: 'reporte',
      detalles_antes: { estado: reporte.estado },
      detalles_despues: { estado: 'resuelto' },
      notas: body.notes || 'Reporte cerrado',
      ip_address: event.requestContext?.identity?.sourceIp || '',
      user_agent: event.requestContext?.identity?.userAgent || ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    return createResponse(200, {
      mensaje: 'Reporte cerrado exitosamente',
      reporte
    });
    
  } catch (error) {
    console.error('Error al cerrar reporte:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

