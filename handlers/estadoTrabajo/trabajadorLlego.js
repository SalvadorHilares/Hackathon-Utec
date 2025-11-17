const { getItem, putItem, getTimestamp, generateUUID, query } = require('../../shared/dynamodb');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { verifyJwtFromWebSocket } = require('../../utils/auth');
const { sendMessage } = require('../../shared/websocket');

const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const TABLA_CONEXIONES = process.env.TABLA_CONEXIONES;

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
      usuario_id: auth.usuario_id, // Usar usuario_id del token
      rol: auth.rol, // Usar rol del token
      entidad_afectada: 'trabajo',
      detalles_antes: { estado_trabajo: 'en_camino' },
      detalles_despues: { estado_trabajo: 'llegó', fecha_llegada },
      notas: body.comentarios || 'Trabajador llegó al lugar',
      ip_address: '',
      user_agent: ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Crear cambio de estado en TablaEstados (esto dispara notificación automática)
    const estadoChange = {
      estado_id: generateUUID(),
      reporte_id,
      estado: 'trabajador_llego',
      descripcion: `Trabajador ${trabajador_id} llegó al lugar`,
      timestamp: fecha_llegada,
      actualizado_por: auth.usuario_id,
      rol_actualizador: auth.rol
    };
    
    await putItem(TABLA_ESTADOS, estadoChange);
    
    // Enviar TaskToken a Step Functions (si existe)
    if (task_token && task_token !== 'task-token-placeholder') {
      try {
        await sendTaskSuccess(task_token, {
          reporte_id,
          trabajador_id,
          estado: 'llegó',
          fecha_llegada
        });
      } catch (taskError) {
        console.error('Error al enviar TaskSuccess a Step Functions:', taskError);
        // Continuar aunque falle Step Functions
      }
    }
    
    // Enviar respuesta al cliente WebSocket (trabajador)
    if (endpoint && connectionId) {
      await sendMessage(endpoint, connectionId, {
        mensaje: 'Estado actualizado: Trabajador llegó',
        estado_trabajo: estadoTrabajo,
        reporte_id,
        trabajador_id,
        fecha_llegada
      });
    }
    
    // Notificar a TODOS los clientes conectados (estudiante, administrador, etc.)
    try {
      const conexionesReporte = await query(
        TABLA_CONEXIONES,
        'reporte_id = :reporte_id',
        { ':reporte_id': reporte_id },
        'reporte_id-index'
      );
      
      const conexionesAll = await query(
        TABLA_CONEXIONES,
        'reporte_id = :reporte_id',
        { ':reporte_id': 'ALL' },
        'reporte_id-index'
      );
      
      const todasLasConexiones = [...conexionesReporte, ...conexionesAll]
        .filter(con => con.connection_id !== connectionId);
      
      console.log(`Notificando a ${todasLasConexiones.length} clientes conectados sobre cambio de estado`);
      
      for (const conexion of todasLasConexiones) {
        try {
          const mensajeNotificacion = {
            tipo: 'actualizacion_estado',
            reporte_id,
            estado: 'trabajador_llego',
            timestamp: fecha_llegada,
            timestamp_notificacion: new Date().toISOString(),
            trabajador_id,
            descripcion: `Trabajador ${trabajador_id} llegó al lugar`
          };
          
          await sendMessage(endpoint, conexion.connection_id, mensajeNotificacion);
        } catch (error) {
          if (error.name !== 'GoneException' && error.statusCode !== 410) {
            console.error(`Error al notificar a ${conexion.connection_id}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error al notificar a clientes conectados:', error);
    }
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al actualizar estado llegada:', error);
    
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

