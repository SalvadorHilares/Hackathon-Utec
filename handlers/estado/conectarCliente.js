const { putItem, getTimestamp } = require('../../shared/dynamodb');
const { verifyJwtFromWebSocket } = require('../../utils/auth');

const TABLA_CONEXIONES = process.env.TABLA_CONEXIONES;

async function handler(event) {
  try {
    // Verificar autenticación JWT (token viene en query string: ?token=...)
    const auth = verifyJwtFromWebSocket(event);
    if (!auth) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'No autorizado',
          mensaje: 'Token JWT inválido o faltante. Debe incluir: ?token=<jwt_token> en la URL de conexión'
        })
      };
    }

    const connectionId = event.requestContext.connectionId;
    const reporte_id = event.queryStringParameters?.reporte_id || 'ALL';
    
    // Usar usuario_id del token autenticado, no del query string
    const usuario_id = auth.usuario_id;
    
    // Guardar conexión en TablaConexiones
    // Si reporte_id está vacío, usar 'ALL' para monitorear todos los reportes
    const conexion = {
      connection_id: connectionId,
      reporte_id: reporte_id || 'ALL',
      usuario_id: usuario_id,
      rol: auth.rol, // Guardar rol también para validaciones futuras
      timestamp: getTimestamp(),
      // TTL: expira en 1 hora (3600 segundos) para limpiar conexiones muertas
      ttl: Math.floor(Date.now() / 1000) + 3600
    };
    
    await putItem(TABLA_CONEXIONES, conexion);
    
    console.log('Cliente conectado y guardado:', {
      connectionId,
      reporte_id: conexion.reporte_id,
      usuario_id,
      rol: auth.rol
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: 'Cliente conectado exitosamente',
        connectionId,
        reporte_id: conexion.reporte_id
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

