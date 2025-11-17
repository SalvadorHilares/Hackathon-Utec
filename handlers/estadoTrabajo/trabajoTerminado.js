const { getItem, putItem, getTimestamp, generateUUID } = require('../../shared/dynamodb');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { verifyJwtFromWebSocket } = require('../../utils/auth');
const { sendMessage } = require('../../shared/websocket');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const S3_BUCKET = process.env.S3_BUCKET;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN;
const TENANT_ID = process.env.TENANT_ID || 'utec';

const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });

async function handler(event) {
  const connectionId = event.requestContext?.connectionId;
  const requestContext = event.requestContext;
  const endpoint = requestContext ? `https://${requestContext.domainName}/${requestContext.stage}` : null;
  
  try {
    // Verificar autenticación JWT
    const auth = verifyJwtFromWebSocket(event);
    if (!auth) {
      if (endpoint && connectionId) {
        await sendMessage(endpoint, connectionId, {
          error: 'No autorizado',
          mensaje: 'Token JWT inválido o faltante. Debe incluir: {"token": "<jwt_token>", ...}'
        });
      }
      return { statusCode: 401 };
    }

    if (!connectionId || !endpoint) {
      console.error('Missing connectionId or endpoint in requestContext');
      return { statusCode: 500 };
    }

    const body = JSON.parse(event.body || '{}');
    const reporte_id = body.reporte_id;
    const trabajador_id = body.trabajador_id;
    const task_token = body.task_token;
    
    if (!reporte_id || !trabajador_id) {
      if (endpoint && connectionId) {
        await sendMessage(endpoint, connectionId, {
          error: 'Datos incompletos',
          mensaje: 'reporte_id y trabajador_id son requeridos'
        });
      }
      return { statusCode: 400 };
    }

    // Validar que el usuario tenga rol trabajador
    if (auth.rol !== 'trabajador') {
      if (endpoint && connectionId) {
        await sendMessage(endpoint, connectionId, {
          error: 'Acceso denegado',
          mensaje: 'Solo usuarios con rol trabajador pueden actualizar estados de trabajo'
        });
      }
      return { statusCode: 403 };
    }

    // Validar que el trabajador_id del body coincida con el usuario_id del token
    if (trabajador_id !== auth.usuario_id) {
      if (endpoint && connectionId) {
        await sendMessage(endpoint, connectionId, {
          error: 'Acceso denegado',
          mensaje: 'El trabajador_id no coincide con el usuario autenticado'
        });
      }
      return { statusCode: 403 };
    }
    
    // Obtener estado trabajo actual
    const estadoTrabajo = await getItem(TABLA_ESTADO_TRABAJO, {
      reporte_id,
      trabajador_id
    });
    
    if (!estadoTrabajo) {
      if (endpoint && connectionId) {
        await sendMessage(endpoint, connectionId, {
          error: 'Estado trabajo no encontrado',
          mensaje: `No se encontró estado de trabajo para reporte_id: ${reporte_id} y trabajador_id: ${trabajador_id}`
        });
      }
      return { statusCode: 404 };
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
      user_id: auth.usuario_id, // Usar usuario_id del token
      estado: 'resuelto',
      detalles_estado: [{
        message: 'Trabajo terminado por trabajador',
        actualizado_por: auth.usuario_id, // Usar usuario_id del token
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
      usuario_id: auth.usuario_id, // Usar usuario_id del token
      rol: auth.rol, // Usar rol del token
      entidad_afectada: 'trabajo',
      detalles_antes: { estado_trabajo: 'llegó' },
      detalles_despues: { estado_trabajo: 'terminado', fecha_terminacion },
      notas: body.comentarios || 'Trabajo terminado',
      ip_address: '',
      user_agent: ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Crear cambio de estado en TablaEstados (esto dispara notificación automática)
    const estadoChange = {
      estado_id: generateUUID(),
      reporte_id,
      estado: 'trabajo_terminado',
      descripcion: `Trabajo terminado por ${trabajador_id}`,
      timestamp: fecha_terminacion,
      actualizado_por: auth.usuario_id,
      rol_actualizador: auth.rol,
      s3_key: s3Key
    };
    
    await putItem(TABLA_ESTADOS, estadoChange);
    
    // Enviar TaskToken a Step Functions (si existe)
    if (task_token && task_token !== 'task-token-placeholder') {
      try {
        await sendTaskSuccess(task_token, {
          reporte_id,
          trabajador_id,
          estado: 'terminado',
          fecha_terminacion,
          s3_key: s3Key
        });
      } catch (taskError) {
        console.error('Error al enviar TaskSuccess a Step Functions:', taskError);
        // Continuar aunque falle Step Functions
      }
    }
    
    // Enviar respuesta al cliente WebSocket
    if (endpoint && connectionId) {
      await sendMessage(endpoint, connectionId, {
        mensaje: 'Trabajo terminado exitosamente',
        estado_trabajo: estadoTrabajo,
        reporte_id,
        trabajador_id,
        fecha_terminacion,
        s3_key: s3Key
      });
    }
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al terminar trabajo:', error);
    
    if (endpoint && connectionId) {
      try {
        await sendMessage(endpoint, connectionId, {
          error: 'Error interno del servidor',
          mensaje: error.message
        });
      } catch (sendError) {
        console.error('Error al enviar mensaje de error:', sendError);
      }
    }
    
    return { statusCode: 500 };
  }
}

module.exports = { handler };

