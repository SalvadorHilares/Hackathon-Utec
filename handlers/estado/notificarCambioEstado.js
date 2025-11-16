const { sendMessage, getWebSocketEndpoint } = require('../../shared/websocket');

const WEBSOCKET_API_ID = process.env.WEBSOCKET_API_ID;
const REGION = process.env.REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

async function handler(event) {
  try {
    // Procesar eventos de DynamoDB Stream
    for (const record of event.Records) {
      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        const nuevoEstado = record.dynamodb.NewImage;
        const reporte_id = nuevoEstado.reporte_id?.S;
        
        if (!reporte_id) continue;
        
        // Aquí deberías obtener las conexiones activas asociadas a este reporte
        // Por simplicidad, asumimos que hay una tabla de conexiones o que todos los clientes
        // están suscritos a todos los cambios
        
        // Nota: En producción, necesitarías mantener un registro de conexiones activas
        // asociadas a cada reporte_id o usuario_id
        
        console.log('Cambio de estado detectado:', {
          reporte_id,
          estado: nuevoEstado.estado?.S,
          timestamp: nuevoEstado.timestamp?.S
        });
        
        // TODO: Implementar lógica para obtener conexiones activas y enviar notificaciones
        // Por ahora, solo logueamos el cambio
      }
    }
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al notificar cambio de estado:', error);
    return { statusCode: 500 };
  }
}

module.exports = { handler };

