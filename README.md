# Hackathon UTEC - Sistema de Gestión de Incidentes

Sistema serverless para la gestión de incidentes desarrollado con Serverless Framework y AWS.

## Arquitectura

El sistema está compuesto por:

- **Microservicio de Reportes**: API REST para crear, actualizar, asignar, visualizar y cerrar reportes
- **Microservicio de Estado**: WebSocket para actualizaciones en tiempo real del estado de los reportes
- **Microservicio de Estado Trabajo**: WebSocket para que los trabajadores actualicen su estado (en camino, llegó, terminado)
- **AWS Step Functions**: Orquesta el flujo de trabajo del trabajador
- **DynamoDB**: Almacenamiento de reportes, estados, historial y estado de trabajo
- **S3**: Almacenamiento de imágenes, videos e información final de reportes
- **SNS**: Notificaciones asíncronas a trabajadores y administradores

## Estructura del Proyecto

```
/
├── serverless.yml          # Configuración principal de Serverless Framework
├── package.json            # Dependencias del proyecto
├── handlers/               # Handlers de las funciones Lambda
│   ├── reportes/          # Handlers del microservicio de reportes
│   ├── estado/            # Handlers del microservicio de estado (WebSocket cliente)
│   ├── estadoTrabajo/     # Handlers del microservicio de estado trabajo (WebSocket trabajador)
│   └── soporte/           # Handlers de soporte (actualizar estado, S3, SNS)
├── shared/                # Módulos compartidos
│   ├── dynamodb.js        # Helpers para DynamoDB
│   ├── websocket.js       # Helpers para WebSocket
│   ├── sns.js             # Helpers para SNS
│   ├── stepfunctions.js   # Helpers para Step Functions
│   └── validations.js      # Validaciones y utilidades
└── README.md
```

## Configuración

### Variables de Entorno

El archivo `serverless.yml` incluye las siguientes variables de entorno:

- `TENANT_ID`: Valor fijo "utec"
- `STAGE`: Stage del deployment (dev, prod, etc.)
- `REGION`: Región de AWS (us-east-1 por defecto)

### IAM Role

**IMPORTANTE**: Debes actualizar el ARN del IAM Role en `serverless.yml`:

```yaml
iam:
  role: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
```

Reemplaza `ACCOUNT_ID` y `ROLE_NAME` con tus valores reales.

## Instalación

1. Instalar dependencias:

```bash
npm install
```

2. Instalar Serverless Framework globalmente (si no lo tienes):

```bash
npm install -g serverless
```

3. Configurar credenciales de AWS:

```bash
serverless config credentials --provider aws --key YOUR_ACCESS_KEY --secret YOUR_SECRET_KEY
```

## Despliegue

```bash
serverless deploy
```

Para desplegar a un stage específico:

```bash
serverless deploy --stage dev
```

## Endpoints

### REST API (Reportes)

- `POST /reportes` - Crear reporte
- `GET /reportes` - Listar reportes (con filtros opcionales)
- `GET /reportes/{reporte_id}` - Visualizar reporte
- `PUT /reportes/{reporte_id}` - Actualizar reporte
- `POST /reportes/{reporte_id}/asignar` - Asignar reporte a trabajador
- `POST /reportes/{reporte_id}/cerrar` - Cerrar reporte
- `GET /reportes/{reporte_id}/historial` - Obtener historial del reporte

### WebSocket (Estado Cliente)

- `wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
  - `$connect` - Conectar cliente
  - `$disconnect` - Desconectar cliente
  - `$default` - Obtener estados (envía `{"action": "obtenerEstados", "reporte_id": "..."}`)

### WebSocket (Estado Trabajador)

- `wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
  - `$connect` - Conectar trabajador
  - `$disconnect` - Desconectar trabajador
  - `enCamino` - Trabajador en camino
  - `trabajadorLlego` - Trabajador llegó
  - `trabajoTerminado` - Trabajo terminado

## Tablas DynamoDB

### Tabla Reportes
- **PK**: `reporte_id` (String, UUID)
- **SK**: `fecha_creacion` (String, ISO 8601)
- **GSI**: `usuario_id-index` (PK: `usuario_id`, SK: `fecha_creacion`)

### Tabla Estados
- **PK**: `reporte_id` (String, UUID)
- **SK**: `timestamp` (String, ISO 8601)

### Tabla Historial
- **PK**: `reporte_id` (String, UUID)
- **SK**: `timestamp_accion` (String, ISO 8601)

### Tabla Estado Trabajo
- **PK**: `reporte_id` (String, UUID)
- **SK**: `trabajador_id` (String)

## Flujo de Trabajo

1. **Crear Reporte**: Un usuario crea un reporte → se guarda en Tabla Reportes → se crea estado inicial → se inicia Step Functions workflow
2. **Asignar Trabajador**: Un administrador asigna un trabajador → se actualiza Tabla Reportes → se crea entrada en Tabla Estado Trabajo → se envía notificación SNS
3. **Trabajador en Camino**: Trabajador actualiza estado vía WebSocket → se actualiza Tabla Estado Trabajo → se envía TaskToken a Step Functions
4. **Trabajador Llegó**: Similar al paso anterior
5. **Trabajo Terminado**: Trabajador marca trabajo como terminado → se guarda información en S3 → se actualiza Tabla Estados → se envía TaskToken a Step Functions
6. **Cerrar Reporte**: Administrador cierra el reporte → se actualiza estado a "resuelto"

## Notas Importantes

- El sistema no incluye el flujo de validación de seguridad (autenticación/autorización) por ahora
- Todas las tablas usan `PAY_PER_REQUEST` (on-demand billing)
- Los WebSocket APIs requieren configuración adicional para manejar conexiones persistentes
- Step Functions usa TaskTokens para esperar callbacks de las funciones Lambda

## Desarrollo

Para desarrollo local con Serverless Offline:

```bash
npm install -D serverless-offline
serverless offline
```

## Licencia

ISC
