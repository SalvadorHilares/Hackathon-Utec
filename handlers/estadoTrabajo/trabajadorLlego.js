const { getItem, putItem, getTimestamp } = require('../../shared/dynamodb');
const { sendTaskSuccess } = require('../../shared/stepfunctions');

const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || '{}');
    const reporte_id = body.reporte_id;
    const trabajador_id = body.trabajador_id;
    const task_token = body.task_token;
    
    if (!reporte_id || !trabajador_id || !task_token) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'reporte_id, trabajador_id y task_token son requeridos'
        })
      };
    }
    
    // Obtener estado trabajo actual
    const estadoTrabajo = await getItem(TABLA_ESTADO_TRABAJO, {
      reporte_id,
      trabajador_id
    });
    
    if (!estadoTrabajo) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Estado trabajo no encontrado'
        })
      };
    }
    
    // Actualizar estado trabajo
    const fecha_llegada = getTimestamp();
    estadoTrabajo.estado_trabajo = 'llegó';
    estadoTrabajo.fecha_llegada = fecha_llegada;
    estadoTrabajo.task_token = task_token;
    
    if (body.ubicacion_trabajador) {
      estadoTrabajo.ubicacion_trabajador = {
        latitud: body.ubicacion_trabajador.latitud || 0,
        longitud: body.ubicacion_trabajador.longitud || 0,
        timestamp: fecha_llegada
      };
    }
    
    await putItem(TABLA_ESTADO_TRABAJO, estadoTrabajo);
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_llegada,
      accion: 'trabajador_llego',
      usuario_id: trabajador_id,
      rol: 'trabajador',
      entidad_afectada: 'trabajo',
      detalles_antes: { estado_trabajo: 'en_camino' },
      detalles_despues: { estado_trabajo: 'llegó', fecha_llegada },
      notas: body.comentarios || 'Trabajador llegó al lugar',
      ip_address: '',
      user_agent: ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Enviar TaskToken a Step Functions
    await sendTaskSuccess(task_token, {
      reporte_id,
      trabajador_id,
      estado: 'llegó',
      fecha_llegada
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Estado actualizado: Trabajador llegó',
        estado_trabajo: estadoTrabajo
      })
    };
    
  } catch (error) {
    console.error('Error al actualizar estado llegada:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        mensaje: error.message
      })
    };
  }
}

module.exports = { handler };

