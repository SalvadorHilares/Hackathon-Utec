const { scan, query } = require('../../shared/dynamodb');
const { createResponse } = require('../../shared/validations');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_REPORTES = process.env.TABLA_REPORTES;

async function handler(event) {
  try {
    // Verificar autenticación JWT (opcional pero recomendado)
    const auth = verifyJwtFromEvent(event);
    
    const queryParams = event.queryStringParameters || {};
    // Si está autenticado y no especifica usuario_id, usar el del token
    const usuario_id = queryParams.usuario_id || (auth ? auth.usuario_id : null);
    const estado = queryParams.estado;
    const tipo = queryParams.tipo;
    const nivel_urgencia = queryParams.nivel_urgencia;
    const limit = parseInt(queryParams.limit || '50');
    const lastKey = queryParams.lastKey;
    
    let reportes = [];
    
    // Si hay usuario_id, usar GSI
    if (usuario_id) {
      reportes = await query(
        TABLA_REPORTES,
        'usuario_id = :usuario_id',
        { ':usuario_id': usuario_id },
        'usuario_id-index'
      );
    } else {
      // Scan completo con filtros
      let filterExpression = null;
      let expressionAttributeValues = {};
      let expressionAttributeNames = {};
      
      const filters = [];
      
      if (estado) {
        filters.push('#estado = :estado');
        expressionAttributeNames['#estado'] = 'estado';
        expressionAttributeValues[':estado'] = estado;
      }
      
      if (tipo) {
        filters.push('#tipo = :tipo');
        expressionAttributeNames['#tipo'] = 'tipo';
        expressionAttributeValues[':tipo'] = tipo;
      }
      
      if (nivel_urgencia) {
        filters.push('#nivel_urgencia = :nivel_urgencia');
        expressionAttributeNames['#nivel_urgencia'] = 'nivel_urgencia';
        expressionAttributeValues[':nivel_urgencia'] = nivel_urgencia;
      }
      
      if (filters.length > 0) {
        filterExpression = filters.join(' AND ');
      }
      
      reportes = await scan(
        TABLA_REPORTES,
        filterExpression,
        Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : null,
        Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : null
      );
    }
    
    // Ordenar reportes según prioridad
    const orderBy = queryParams.orderBy || 'urgencia'; // 'urgencia' o 'fecha'
    
    if (orderBy === 'urgencia') {
      // Ordenar por urgencia primero (critica > alta > media > baja), luego por fecha
      const ordenUrgencia = { 'critica': 4, 'alta': 3, 'media': 2, 'baja': 1 };
      
      reportes.sort((a, b) => {
        const urgenciaA = ordenUrgencia[a.nivel_urgencia] || 0;
        const urgenciaB = ordenUrgencia[b.nivel_urgencia] || 0;
        
        // Si tienen diferente urgencia, ordenar por urgencia (mayor primero)
        if (urgenciaA !== urgenciaB) {
          return urgenciaB - urgenciaA;
        }
        
        // Si tienen la misma urgencia, ordenar por fecha (más reciente primero)
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      });
    } else {
      // Ordenar solo por fecha_creacion descendente
      reportes.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
    }
    
    // Aplicar paginación simple
    const startIndex = lastKey ? parseInt(lastKey) : 0;
    const endIndex = startIndex + limit;
    const paginatedReportes = reportes.slice(startIndex, endIndex);
    
    const hasMore = endIndex < reportes.length;
    const nextLastKey = hasMore ? endIndex.toString() : null;
    
    return createResponse(200, {
      total: reportes.length,
      limit,
      has_more: hasMore,
      last_key: nextLastKey,
      reportes: paginatedReportes
    });
    
  } catch (error) {
    console.error('Error al listar reportes:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

