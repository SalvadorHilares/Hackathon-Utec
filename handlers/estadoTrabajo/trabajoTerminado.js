const { getItem, putItem, getTimestamp } = require('../../shared/dynamodb');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const S3_BUCKET = process.env.S3_BUCKET;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN;
const TENANT_ID = process.env.TENANT_ID || 'utec';

const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });

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
    const fecha_terminacion = getTimestamp();
    estadoTrabajo.estado_trabajo = 'terminado';
    estadoTrabajo.fecha_terminacion = fecha_terminacion;
    estadoTrabajo.comentarios = body.comentarios || '';
    estadoTrabajo.task_token = task_token;
    
    await putItem(TABLA_ESTADO_TRABAJO, estadoTrabajo);
    
    // Guardar información final en S3
    const informacionFinal = {
      reporte_id,
      trabajador_id,
      fecha_terminacion,
      comentarios: body.comentarios || '',
      estado_trabajo: estadoTrabajo,
      timestamp: fecha_terminacion
    };
    
    const s3Key = `reportes/${reporte_id}/final/${fecha_terminacion}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(informacionFinal),
      ContentType: 'application/json'
    }));
    
    // Actualizar Tabla Estados
    const estado = {
      reporte_id,
      timestamp: fecha_terminacion,
      tenant_id: TENANT_ID,
      user_id: trabajador_id,
      estado: 'resuelto',
      detalles_estado: [{
        message: 'Trabajo terminado por trabajador',
        actualizado_por: trabajador_id,
        start_time: fecha_terminacion,
        end_time: '',
        notes: body.comentarios || 'Trabajo completado'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estado);
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_terminacion,
      accion: 'trabajo_terminado',
      usuario_id: trabajador_id,
      rol: 'trabajador',
      entidad_afectada: 'trabajo',
      detalles_antes: { estado_trabajo: 'llegó' },
      detalles_despues: { estado_trabajo: 'terminado', fecha_terminacion },
      notas: body.comentarios || 'Trabajo terminado',
      ip_address: '',
      user_agent: ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Enviar TaskToken a Step Functions
    await sendTaskSuccess(task_token, {
      reporte_id,
      trabajador_id,
      estado: 'terminado',
      fecha_terminacion,
      s3_key: s3Key
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Trabajo terminado exitosamente',
        estado_trabajo: estadoTrabajo,
        s3_key: s3Key
      })
    };
    
  } catch (error) {
    console.error('Error al terminar trabajo:', error);
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

