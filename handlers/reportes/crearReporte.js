const { getItem, putItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { validateCrearReporte, createResponse } = require('../../shared/validations');
const { startExecution } = require('../../shared/stepfunctions');

const TABLA_REPORTES = process.env.TABLA_REPORTES;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_HISTORIAL = process.env.TABLA_HISTORIAL;
const STEP_FUNCTIONS_NAME = process.env.STEP_FUNCTIONS_NAME;
const TENANT_ID = process.env.TENANT_ID || 'utec';

async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validar datos
    const validation = validateCrearReporte(body);
    if (!validation.isValid) {
      return createResponse(400, {
        error: 'Datos inválidos',
        detalles: validation.errors
      });
    }
    
    // Generar IDs y timestamps
    const reporte_id = generateUUID();
    const fecha_creacion = getTimestamp();
    const fecha_actualizacion = fecha_creacion;
    
    // Crear reporte
    const reporte = {
      reporte_id,
      fecha_creacion,
      usuario_id: body.usuario_id,
      tipo: body.tipo,
      ubicacion: body.ubicacion,
      descripcion: body.descripcion,
      nivel_urgencia: body.nivel_urgencia,
      estado: 'pendiente',
      trabajador_asignado: '',
      fecha_actualizacion,
      imagenes: body.imagenes || [],
      videos: body.videos || []
    };
    
    await putItem(TABLA_REPORTES, reporte);
    
    // Crear estado inicial
    const estado = {
      reporte_id,
      timestamp: fecha_creacion,
      tenant_id: TENANT_ID,
      user_id: body.usuario_id,
      estado: 'pendiente',
      detalles_estado: [{
        message: 'Reporte creado',
        actualizado_por: body.usuario_id,
        start_time: fecha_creacion,
        end_time: '',
        notes: 'Estado inicial del reporte'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estado);
    
    // Registrar en historial
    const historial = {
      reporte_id,
      timestamp_accion: fecha_creacion,
      accion: 'crear',
      usuario_id: body.usuario_id,
      rol: body.rol || 'estudiante',
      entidad_afectada: 'reporte',
      detalles_antes: {},
      detalles_despues: reporte,
      notas: 'Reporte creado inicialmente',
      ip_address: event.requestContext?.identity?.sourceIp || '',
      user_agent: event.requestContext?.identity?.userAgent || ''
    };
    
    await putItem(TABLA_HISTORIAL, historial);
    
    // Actualizar estado a "en_atencion" e iniciar Step Functions
    const estadoEnAtencion = {
      ...estado,
      timestamp: getTimestamp(),
      estado: 'en_atencion',
      detalles_estado: [{
        message: 'Reporte en atención',
        actualizado_por: body.usuario_id,
        start_time: getTimestamp(),
        end_time: '',
        notes: 'Reporte movido a estado en atención'
      }]
    };
    
    await putItem(TABLA_ESTADOS, estadoEnAtencion);
    
    // Actualizar reporte con estado
    reporte.estado = 'en_atencion';
    reporte.fecha_actualizacion = getTimestamp();
    await putItem(TABLA_REPORTES, reporte);
    
    // Iniciar Step Functions workflow (si hay trabajador asignado)
    if (body.trabajador_asignado) {
      await startExecution(STEP_FUNCTIONS_NAME, {
        reporte_id,
        trabajador_id: body.trabajador_asignado
      });
    }
    
    return createResponse(201, {
      mensaje: 'Reporte creado exitosamente',
      reporte
    });
    
  } catch (error) {
    console.error('Error al crear reporte:', error);
    return createResponse(500, {
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

module.exports = { handler };

