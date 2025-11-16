const { getTimestamp } = require('../../shared/dynamodb');

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    const trabajador_id = event.queryStringParameters?.trabajador_id || '';
    
    console.log('Trabajador conectado:', {
      connectionId,
      trabajador_id,
      timestamp: getTimestamp()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Trabajador conectado exitosamente',
        connectionId
      })
    };
    
  } catch (error) {
    console.error('Error al conectar trabajador:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error al conectar trabajador',
        mensaje: error.message
      })
    };
  }
}

module.exports = { handler };

