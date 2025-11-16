const { scan } = require('../../shared/dynamodb');

const TABLA_REPORTES = process.env.TABLA_REPORTES;

/**
 * Procesar notificación cuando se invoca directamente (para testing)
 */
async function procesarNotificacionDirecta(event) {
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
  
  console.log('Procesando notificación para reporte:', {
    reporte_id,
    tipo: reporte.tipo,
    nivel_urgencia: reporte.nivel_urgencia,
    tipo_notificacion
  });
  
  // Aquí podrías enviar a otro servicio, guardar en base de datos, etc.
  // Por ahora solo logueamos
  return {
    statusCode: 200,
    body: JSON.stringify({
      mensaje: 'Notificación procesada exitosamente',
      reporte_id,
      tipo_notificacion
    })
  };
}

/**
 * Procesar evento SNS
 */
async function procesarEventoSNS(record) {
  try {
    // Parsear mensaje SNS
    const snsMessage = JSON.parse(record.Sns.Message);
    const messageAttributes = record.Sns.MessageAttributes || {};
    
    const reporte_id = snsMessage.reporte_id;
    const tipo_notificacion = snsMessage.tipo_notificacion || 
                              messageAttributes.tipo_notificacion?.Value || 
                              'actualizacion';
    const nivel_urgencia = snsMessage.nivel_urgencia || 
                           messageAttributes.nivel_urgencia?.Value;
    
    console.log('Procesando notificación SNS:', {
      reporte_id,
      tipo_notificacion,
      nivel_urgencia,
      subject: record.Sns.Subject
    });
    
    // Obtener reporte
    const reportes = await scan(
      TABLA_REPORTES,
      'reporte_id = :reporte_id',
      { ':reporte_id': reporte_id }
    );
    
    if (!reportes || reportes.length === 0) {
      console.error('Reporte no encontrado:', reporte_id);
      return;
    }
    
    const reporte = reportes[0];
    
    // Aquí puedes procesar la notificación según el tipo
    // Por ejemplo: enviar email, SMS, push notification, etc.
    console.log('Notificación procesada:', {
      reporte_id,
      tipo: reporte.tipo,
      ubicacion: reporte.ubicacion,
      nivel_urgencia: reporte.nivel_urgencia,
      tipo_notificacion
    });
    
    // Ejemplo: Si es nuevo reporte, podrías notificar a todos los admins
    // Si es asignación, el trabajador ya fue notificado en asignarReporte
    
  } catch (error) {
    console.error('Error procesando evento SNS:', error);
    throw error;
  }
}

async function handler(event) {
  try {
    // SNS puede enviar múltiples records
    if (event.Records && event.Records.length > 0) {
      for (const record of event.Records) {
        // Si viene de SNS directamente
        if (record.Sns) {
          await procesarEventoSNS(record);
        }
      }
    } 
    // Si se invoca directamente (para testing o desde otra Lambda)
    else if (event.reporte_id) {
      return await procesarNotificacionDirecta(event);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Notificaciones procesadas exitosamente'
      })
    };
    
  } catch (error) {
    console.error('Error al procesar notificación SNS:', error);
    throw error;
  }
}

module.exports = { handler };

