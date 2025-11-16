const { getTimestamp } = require('../../shared/dynamodb');

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    
    console.log('Trabajador desconectado:', {
      connectionId,
      timestamp: getTimestamp()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Trabajador desconectado exitosamente'
      })
    };
    
  } catch (error) {
    console.error('Error al desconectar trabajador:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error al desconectar trabajador',
        mensaje: error.message
      })
    };
  }
}

module.exports = { handler };

