// handlers/usuarios/listarTrabajadores.js
const { scan } = require('../../shared/dynamodb');
const { createResponse, unauthorized, internalError } = require('../../shared/response');
const { verifyJwtFromEvent } = require('../../utils/auth');

const TABLA_USUARIOS = process.env.TABLA_USUARIOS;

async function handler(event) {
  try {
    // Verificar autenticación JWT (obligatorio)
    const auth = verifyJwtFromEvent(event);
    
    if (!auth) {
      return unauthorized('Token JWT requerido');
    }

    // Solo Administrativo puede listar trabajadores
    if (auth.rol !== 'administrativo') {
      return unauthorized('Solo usuarios administrativos pueden listar trabajadores');
    }

    // Obtener todos los usuarios con rol "trabajador"
    const filterExpression = '#rol = :rol';
    const expressionAttributeNames = {
      '#rol': 'rol'
    };
    const expressionAttributeValues = {
      ':rol': 'trabajador'
    };

    const trabajadores = await scan(
      TABLA_USUARIOS,
      filterExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // Formatear respuesta (no incluir password_hash)
    const trabajadoresFormateados = trabajadores.map(trabajador => ({
      usuario_id: trabajador.usuario_id,
      email: trabajador.email,
      rol: trabajador.rol,
      created_at: trabajador.created_at
    }));

    // Ordenar por email alfabéticamente
    trabajadoresFormateados.sort((a, b) => {
      return a.email.localeCompare(b.email);
    });

    return createResponse(200, {
      total: trabajadoresFormateados.length,
      trabajadores: trabajadoresFormateados
    });

  } catch (error) {
    console.error('Error al listar trabajadores:', error);
    return internalError(`Error al listar trabajadores: ${error.message}`);
  }
}

module.exports = { handler };

