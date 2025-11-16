const { deleteItem, getTimestamp } = require('../../shared/dynamodb');

const TABLA_CONEXIONES = process.env.TABLA_CONEXIONES;

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    
    // Eliminar conexión de TablaConexiones
    try {
      await deleteItem(TABLA_CONEXIONES, {
        connection_id: connectionId
      });
      
      console.log('Cliente desconectado y eliminado:', {
        connectionId,
        timestamp: getTimestamp()
      });
    } catch (deleteError) {
      // Si no existe, no es crítico, solo logueamos
      console.log('Conexión no encontrada al eliminar (puede haber expirado):', {
        connectionId,
        error: deleteError.message
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Cliente desconectado exitosamente'
      })
    };
    
  } catch (error) {
    console.error('Error al desconectar cliente:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error al desconectar cliente',
        mensaje: error.message
      })
    };
  }
}

module.exports = { handler };

