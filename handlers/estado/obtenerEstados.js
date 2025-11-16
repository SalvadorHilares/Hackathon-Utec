const { query } = require('../../shared/dynamodb');
const { sendMessage, getWebSocketEndpoint } = require('../../shared/websocket');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const WEBSOCKET_API_ID = process.env.WEBSOCKET_API_ID;
const REGION = process.env.REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || '{}');
    const reporte_id = body.reporte_id;
    
    if (!reporte_id) {
      await sendMessage(
        getWebSocketEndpoint(WEBSOCKET_API_ID, REGION, STAGE),
        connectionId,
        {
          error: 'reporte_id es requerido'
        }
      );
      return { statusCode: 200 };
    }
    
    // Consultar estados del reporte
    const estados = await query(
      TABLA_ESTADOS,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    // Ordenar por timestamp descendente
    estados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Enviar respuesta al cliente
    await sendMessage(
      getWebSocketEndpoint(WEBSOCKET_API_ID, REGION, STAGE),
      connectionId,
      {
        reporte_id,
        estados,
        estado_actual: estados[0] || null
      }
    );
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al obtener estados:', error);
    
    try {
      await sendMessage(
        getWebSocketEndpoint(WEBSOCKET_API_ID, REGION, STAGE),
        event.requestContext.connectionId,
        {
          error: 'Error al obtener estados',
          mensaje: error.message
        }
      );
    } catch (sendError) {
      console.error('Error al enviar mensaje de error:', sendError);
    }
    
    return { statusCode: 500 };
  }
}

module.exports = { handler };

