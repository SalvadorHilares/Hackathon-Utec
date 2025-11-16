const { getTimestamp } = require('../../shared/dynamodb');

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    
    // Limpiar información de conexión
    console.log('Cliente desconectado:', {
      connectionId,
      timestamp: getTimestamp()
    });
    
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

