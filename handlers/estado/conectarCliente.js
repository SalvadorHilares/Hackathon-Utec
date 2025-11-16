const { putItem, getTimestamp } = require('../../shared/dynamodb');
const { createResponse } = require('../../shared/validations');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;

async function handler(event) {
  try {
    const connectionId = event.requestContext.connectionId;
    const reporte_id = event.queryStringParameters?.reporte_id || '';
    const usuario_id = event.queryStringParameters?.usuario_id || '';
    
    // Guardar información de conexión (podrías usar una tabla de conexiones separada)
    // Por ahora, solo logueamos la conexión
    console.log('Cliente conectado:', {
      connectionId,
      reporte_id,
      usuario_id,
      timestamp: getTimestamp()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Cliente conectado exitosamente',
        connectionId
      })
    };
    
  } catch (error) {
    console.error('Error al conectar cliente:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error al conectar cliente',
        mensaje: error.message
      })
    };
  }
}

module.exports = { handler };

