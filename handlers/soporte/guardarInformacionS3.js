const { getItem, scan } = require('../../shared/dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getTimestamp } = require('../../shared/dynamodb');

const S3_BUCKET = process.env.S3_BUCKET;
const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADO_TRABAJO = process.env.TABLA_ESTADO_TRABAJO;

const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });

async function handler(event) {
  try {
    const { reporte_id, trabajador_id } = event;
    
    if (!reporte_id || !trabajador_id) {
      throw new Error('reporte_id y trabajador_id son requeridos');
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
    
    // Obtener estado trabajo
    const estadoTrabajo = await getItem(TABLA_ESTADO_TRABAJO, {
      reporte_id,
      trabajador_id
    });
    
    // Crear objeto de información final
    const informacionFinal = {
      reporte_id,
      trabajador_id,
      reporte,
      estado_trabajo: estadoTrabajo,
      timestamp: getTimestamp()
    };
    
    // Guardar en S3
    const s3Key = `reportes/${reporte_id}/final/${getTimestamp()}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(informacionFinal, null, 2),
      ContentType: 'application/json'
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Información guardada en S3',
        s3_key: s3Key
      })
    };
    
  } catch (error) {
    console.error('Error al guardar información en S3:', error);
    throw error;
  }
}

module.exports = { handler };

