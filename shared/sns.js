const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const client = new SNSClient({ region: process.env.REGION || 'us-east-1' });

/**
 * Enviar notificación SNS
 */
async function sendNotification(topicArn, subject, message, attributes = {}) {
  try {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
      MessageAttributes: attributes
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    console.error('Error sending SNS notification:', error);
    throw error;
  }
}

/**
 * Enviar notificación a trabajador
 */
async function notifyWorker(topicArn, trabajadorId, reporteId, tipoNotificacion, mensaje) {
  const subject = `Notificación de Reporte - ${tipoNotificacion}`;
  const message = JSON.stringify({
    trabajador_id: trabajadorId,
    reporte_id: reporteId,
    tipo: tipoNotificacion,
    mensaje: mensaje,
    timestamp: new Date().toISOString()
  });
  
  const attributes = {
    trabajador_id: {
      DataType: 'String',
      StringValue: trabajadorId
    },
    reporte_id: {
      DataType: 'String',
      StringValue: reporteId
    },
    tipo_notificacion: {
      DataType: 'String',
      StringValue: tipoNotificacion
    }
  };
  
  return await sendNotification(topicArn, subject, message, attributes);
}

module.exports = {
  sendNotification,
  notifyWorker
};

