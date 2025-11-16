const { scan } = require('../../shared/dynamodb');
const { sendNotification } = require('../../shared/sns');

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const TABLA_REPORTES = process.env.TABLA_REPORTES;

async function handler(event) {
  try {
    const { reporte_id, tipo_notificacion, nivel_urgencia } = event;
    
    if (!reporte_id) {
      throw new Error('reporte_id es requerido');
    }
    
    // Obtener reporte usando scan con filtro
    const reportes = await scan(
      TABLA_REPORTES,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    if (!reportes || reportes.length === 0) {
      throw new Error('Reporte no encontrado');
    }
    
    const reporte = reportes[0];
    
    // Determinar si enviar notificación según nivel de urgencia
    const nivelesCriticos = ['alta', 'critica'];
    const debeNotificar = nivelesCriticos.includes(nivel_urgencia || reporte.nivel_urgencia);
    
    if (!debeNotificar) {
      console.log('Notificación no enviada - nivel de urgencia no crítico');
      return {
        statusCode: 200,
        body: JSON.stringify({
          mensaje: 'Notificación no enviada - nivel de urgencia no crítico'
        })
      };
    }
    
    // Preparar mensaje
    const subject = `Alerta: Reporte ${tipo_notificacion || 'actualizado'}`;
    const message = JSON.stringify({
      reporte_id,
      tipo: reporte.tipo,
      ubicacion: reporte.ubicacion,
      nivel_urgencia: reporte.nivel_urgencia,
      estado: reporte.estado,
      tipo_notificacion: tipo_notificacion || 'actualizacion',
      timestamp: new Date().toISOString()
    });
    
    const attributes = {
      nivel_urgencia: {
        DataType: 'String',
        StringValue: reporte.nivel_urgencia
      },
      tipo: {
        DataType: 'String',
        StringValue: reporte.tipo
      }
    };
    
    // Enviar notificación
    await sendNotification(SNS_TOPIC_ARN, subject, message, attributes);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Notificación enviada exitosamente'
      })
    };
    
  } catch (error) {
    console.error('Error al procesar notificación SNS:', error);
    throw error;
  }
}

module.exports = { handler };

