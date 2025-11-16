const { scan, putItem, getTimestamp } = require('../../shared/dynamodb');
const { isValidUUID, createResponse } = require('../../shared/validations');
const { notifyWorker } = require('../../shared/sns');
const { startExecution } = require('../../shared/stepfunctions');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN;

async function handler(event) {
  try {
    const reporte_id = event.pathParameters?.reporte_id;
    
    if (!reporte_id || !isValidUUID(reporte_id)) {
      return createResponse(400, {
        error: 'reporte_id inválido o faltante'
      });
    }
    
    const body = JSON.parse(event.body || '{}');
    const trabajador_id = body.trabajador_id;
    
    if (!trabajador_id || typeof trabajador_id !== 'string') {
      return createResponse(400, {
        error: 'trabajador_id es requerido'
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
    
    // Actualizar reporte con trabajador asignado
    const fecha_actualizacion = getTimestamp();
    reporte.trabajador_asignado = trabajador_id;
    reporte.fecha_actualizacion = fecha_actualizacion;
    
    await putItem(TABLA_REPORTES, reporte);
    
    // Crear entrada en Tabla Estado Trabajo
    const estadoTrabajo = {
      reporte_id,
      trabajador_id,
      estado_trabajo: 'asignado',
      fecha_aceptacion: '',
      fecha_en_camino: '',
      fecha_llegada: '',
      fecha_terminacion: '',
      task_token: '',
      comentarios: '',
      ubicacion_trabajador: {
        latitud: 0,
        longitud: 0,
        timestamp: ''
      }
    };
    
    await putItem(TABLA_ESTADO_TRABAJO, estadoTrabajo);
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_actualizacion,
      accion: 'asignar',
      usuario_id: body.usuario_id || reporte.usuario_id,
      rol: body.rol || 'administrativo',
      entidad_afectada: 'trabajo',
      detalles_antes: { trabajador_asignado: '' },
      detalles_despues: { trabajador_asignado: trabajador_id },
      notas: `Reporte asignado a trabajador ${trabajador_id}`,
      ip_address: event.requestContext?.identity?.sourceIp || '',
      user_agent: event.requestContext?.identity?.userAgent || ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Enviar notificación SNS al trabajador
    try {
      await notifyWorker(
        SNS_TOPIC_ARN,
        trabajador_id,
        reporte_id,
        'asignacion',
        `Se te ha asignado un nuevo reporte: ${reporte.tipo} - ${reporte.ubicacion}`
      );
    } catch (snsError) {
      console.error('Error al enviar notificación SNS:', snsError);
      // No fallar la operación si falla la notificación
    }
    
    // Iniciar Step Functions workflow
    try {
      await startExecution(STEP_FUNCTIONS_ARN, {
        reporte_id,
        trabajador_id
      });
    } catch (sfnError) {
      console.error('Error al iniciar Step Functions:', sfnError);
      // No fallar la operación si falla Step Functions
    }
    
    return createResponse(200, {
      mensaje: 'Reporte asignado exitosamente',
      reporte,
      estado_trabajo: estadoTrabajo
    });
    
  } catch (error) {
    console.error('Error al asignar reporte:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

