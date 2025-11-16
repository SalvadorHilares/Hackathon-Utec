const { putItem, getTimestamp } = require('../../shared/dynamodb');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TENANT_ID = process.env.TENANT_ID || 'utec';

async function handler(event) {
  try {
    const { reporte_id, trabajador_id } = event;
    
    if (!reporte_id || !trabajador_id) {
      throw new Error('reporte_id y trabajador_id son requeridos');
    }
    
    // Actualizar estado a "en_atencion"
    const timestamp = getTimestamp();
    const estado = {
      reporte_id,
      timestamp,
      tenant_id: TENANT_ID,
      user_id: trabajador_id,
      estado: 'en_atencion',
      detalles_estado: [{
        message: 'Reporte en atención - trabajador asignado',
        actualizado_por: trabajador_id,
        start_time: timestamp,
        end_time: '',
        notes: 'Estado actualizado al asignar trabajador'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estado);
    
    // Nota: Esta función es llamada POR Step Functions, no inicia Step Functions
    // El inicio de Step Functions se hace desde crearReporte o asignarReporte
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Estado actualizado',
        estado
      })
    };
    
  } catch (error) {
    console.error('Error al actualizar estado inicial:', error);
    throw error;
  }
}

module.exports = { handler };

