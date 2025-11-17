const { query, deleteItem } = require('../../shared/dynamodb');
const { sendMessage, getWebSocketEndpoint } = require('../../shared/websocket');

const TABLA_CONEXIONES = process.env.TABLA_CONEXIONES;
const WEBSOCKET_API_ID = process.env.WEBSOCKET_API_ID;
const REGION = process.env.REGION || 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

async function handler(event) {
  try {
    // Usar el ID real del WebSocket API (hardcodeado porque la referencia CloudFormation no se resuelve)
    // El ID real del WebSocket es: vwomh5is13
    const apiId = WEBSOCKET_API_ID && !WEBSOCKET_API_ID.includes('${') && !WEBSOCKET_API_ID.includes('Ref') 
      ? WEBSOCKET_API_ID 
      : 'vwomh5is13';
    
    const endpoint = getWebSocketEndpoint(apiId, REGION, STAGE);
    console.log('Endpoint WebSocket:', endpoint);
    console.log('API ID usado:', apiId);
    console.log('Event Records:', event.Records?.length || 0);
    
    // Procesar eventos de DynamoDB Stream
    for (const record of event.Records) {
      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        const nuevoEstado = record.dynamodb.NewImage;
        const reporte_id = nuevoEstado.reporte_id?.S;
        const estado = nuevoEstado.estado?.S;
        const timestamp = nuevoEstado.timestamp?.S;
        
        if (!reporte_id) {
          console.log('Cambio de estado sin reporte_id, saltando...');
          continue;
        }
        
        console.log('Cambio de estado detectado:', {
          reporte_id,
          estado,
          timestamp
        });
        
        // Buscar conexiones que monitorean este reporte específico
        const conexionesReporte = await query(
          TABLA_CONEXIONES,
          'reporte_id = :reporte_id',
          { ':reporte_id': reporte_id },
          'reporte_id-index'
        );
        
        // Buscar conexiones que monitorean todos los reportes (reporte_id = 'ALL')
        const conexionesAll = await query(
          TABLA_CONEXIONES,
          'reporte_id = :reporte_id',
          { ':reporte_id': 'ALL' },
          'reporte_id-index'
        );
        
        // Combinar ambas listas
        const todasLasConexiones = [...conexionesReporte, ...conexionesAll];
        
        console.log(`Encontradas ${todasLasConexiones.length} conexiones para notificar (${conexionesReporte.length} específicas + ${conexionesAll.length} generales)`);
        
        if (todasLasConexiones.length === 0) {
          console.log('⚠️ No hay conexiones activas para notificar');
        }
        
        // Enviar notificación a cada conexión
        const notificacionesExitosas = [];
        const notificacionesFallidas = [];
        
        for (const conexion of todasLasConexiones) {
          try {
            const mensaje = {
              tipo: 'actualizacion_estado',
              reporte_id,
              estado,
              timestamp,
              timestamp_notificacion: new Date().toISOString()
            };
            
            console.log(`Enviando notificación a conexión ${conexion.connection_id} (reporte_id: ${conexion.reporte_id})`);
            await sendMessage(endpoint, conexion.connection_id, mensaje);
            console.log(`✅ Notificación enviada exitosamente a ${conexion.connection_id}`);
            notificacionesExitosas.push(conexion.connection_id);
            
          } catch (error) {
            // Si la conexión ya no existe (GoneException), eliminarla de la tabla
            if (error.name === 'GoneException' || error.statusCode === 410) {
              console.log(`Conexión ${conexion.connection_id} ya no existe, eliminando de la tabla...`);
              try {
                await deleteItem(TABLA_CONEXIONES, {
                  connection_id: conexion.connection_id
                });
              } catch (deleteError) {
                console.error(`Error al eliminar conexión muerta ${conexion.connection_id}:`, deleteError);
              }
            } else {
              console.error(`Error al enviar mensaje a ${conexion.connection_id}:`, error);
            }
            notificacionesFallidas.push({
              connection_id: conexion.connection_id,
              error: error.message
            });
          }
        }
        
        console.log(`Notificaciones enviadas: ${notificacionesExitosas.length} exitosas, ${notificacionesFallidas.length} fallidas`);
      }
    }
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('Error al notificar cambio de estado:', error);
    return { statusCode: 500 };
  }
}

module.exports = { handler };

