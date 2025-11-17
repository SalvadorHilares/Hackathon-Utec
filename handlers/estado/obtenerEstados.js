const { query, scan } = require('../../shared/dynamodb');
const { sendMessage, getWebSocketEndpoint } = require('../../shared/websocket');
const { verifyJwtFromWebSocket } = require('../../utils/auth');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;
const WEBSOCKET_API_ID = process.env.WEBSOCKET_API_ID;
const REGION = process.env.REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

async function handler(event) {
  try {
    // Verificar autenticación JWT (token viene en el body: {"token": "...", ...})
    const auth = verifyJwtFromWebSocket(event);
    if (!auth) {
      const requestContext = event.requestContext;
      const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
      
      await sendMessage(
        endpoint,
        event.requestContext.connectionId,
        {
          error: 'No autorizado',
          mensaje: 'Token JWT inválido o faltante. Debe incluir: {"token": "<jwt_token>", ...}'
        }
      );
      return { statusCode: 401 };
    }

    const connectionId = event.requestContext.connectionId;
    const requestContext = event.requestContext;
    
    // Obtener endpoint desde el requestContext (más confiable)
    const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
    
    const body = JSON.parse(event.body || '{}');
    const reporte_id = body.reporte_id || (body.action === 'obtenerEstados' ? body.reporte_id : null);
    
    if (!reporte_id) {
      await sendMessage(
        endpoint,
        connectionId,
        {
          error: 'reporte_id es requerido',
          mensaje: 'Debes enviar: {"action": "obtenerEstados", "reporte_id": "tu-reporte-id", "token": "<jwt_token>"}'
        }
      );
      return { statusCode: 200 };
    }
    
    // Consultar estados del reporte (reporte_id es PK)
    const estados = await query(
      TABLA_ESTADOS,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    // Ordenar por timestamp descendente
    estados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Obtener reporte completo
    const reportes = await scan(
      TABLA_REPORTES,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    const reporte = reportes && reportes.length > 0 ? reportes[0] : null;
    
    // Obtener estado trabajo si hay trabajador asignado
    let estadoTrabajo = null;
    if (reporte && reporte.trabajador_asignado) {
      const estadosTrabajo = await query(
        TABLA_ESTADO_TRABAJO,
        'reporte_id = :reporte_id',
        { ':reporte_id': reporte_id }
      );
      // Buscar el estado trabajo del trabajador asignado
      estadoTrabajo = estadosTrabajo.find(et => et.trabajador_id === reporte.trabajador_asignado) || null;
    }
    
    // Enviar respuesta completa al cliente
    await sendMessage(
      endpoint,
      connectionId,
      {
        tipo: 'respuesta_estados',
        reporte_id,
        reporte: reporte || null,
        estados: estados || [],
        estado_actual: estados[0] || null,
        estado_trabajo: estadoTrabajo,
        timestamp: new Date().toISOString()
      }
    );
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al obtener estados:', error);
    
    try {
      const requestContext = event.requestContext;
      const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
      
      await sendMessage(
        endpoint,
        event.requestContext.connectionId,
        {
          error: 'Error al obtener estados',
          mensaje: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      );
    } catch (sendError) {
      console.error('Error al enviar mensaje de error:', sendError);
    }
    
    return { statusCode: 500 };
  }
}

module.exports = { handler };

