const { putItem, getTimestamp } = require('../../shared/dynamodb');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TENANT_ID = process.env.TENANT_ID || 'utec';

async function handler(event) {
  try {
    const { reporte_id, estado: nuevoEstado } = event;
    
    if (!reporte_id) {
      throw new Error('reporte_id es requerido');
    }
    
    const estadoFinal = nuevoEstado || 'resuelto';
    const timestamp = getTimestamp();
    
    const estado = {
      reporte_id,
      timestamp,
      tenant_id: TENANT_ID,
      user_id: 'sistema',
      estado: estadoFinal,
      detalles_estado: [{
        message: `Estado final: ${estadoFinal}`,
        actualizado_por: 'sistema',
        start_time: timestamp,
        end_time: '',
        notes: 'Estado final del reporte'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estado);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Estado final actualizado',
        estado
      })
    };
    
  } catch (error) {
    console.error('Error al actualizar estado final:', error);
    throw error;
  }
}

module.exports = { handler };

