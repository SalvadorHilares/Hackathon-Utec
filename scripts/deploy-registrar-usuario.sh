#!/bin/bash
# Script para desplegar registrarUsuario usando AWS CLI directamente
# Incluye CORS completo para compatibilidad con AWS Amplify

set -e

# Configuración
FUNCTION_NAME="hackathon-utec-incidentes-dev-registrarUsuario"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::920413422536:role/LabRole"
HANDLER="handlers/auth/registrarUsuario.handler"
RUNTIME="nodejs20.x"
TIMEOUT=29
MEMORY=1024
STAGE="dev"
API_ID="ovgixvti60"  # ID de tu API Gateway REST (ajustar si es diferente)

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}📦 Desplegando registrarUsuario...${NC}"

# Ir al directorio del proyecto
cd "$(dirname "$0")/.."

# Crear directorio temporal
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "📋 Copiando archivos necesarios..."

# Copiar archivos necesarios
mkdir -p handlers/auth shared utils

cp "$OLDPWD/handlers/auth/registrarUsuario.js" handlers/auth/
cp "$OLDPWD/shared/dynamodb.js" shared/
cp "$OLDPWD/shared/response.js" shared/
cp "$OLDPWD/utils/auth.js" utils/

# Copiar package.json e instalar dependencias
if [ -f "$OLDPWD/package.json" ]; then
  cp "$OLDPWD/package.json" .
  echo "📦 Instalando dependencias..."
  npm install --production --silent > /dev/null 2>&1
fi

# Crear ZIP
echo "📦 Creando paquete ZIP..."
zip -r function.zip . -q > /dev/null

echo "📤 Subiendo función a Lambda..."

# Verificar si la función ya existe
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "✅ Función existe, actualizando código..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION" > /dev/null
  
  echo "⚙️ Actualizando configuración..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={TENANT_ID=utec,STAGE=$STAGE,REGION=$REGION,TABLA_USUARIOS=TablaUsuarios-$STAGE}" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --region "$REGION" > /dev/null
else
  echo "🆕 Creando nueva función..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --role "$ROLE_ARN" \
    --handler "$HANDLER" \
    --zip-file fileb://function.zip \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --environment "Variables={TENANT_ID=utec,STAGE=$STAGE,REGION=$REGION,TABLA_USUARIOS=TablaUsuarios-$STAGE}" \
    --region "$REGION" > /dev/null
fi

# Obtener ARN de la función
FUNCTION_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)

echo -e "${GREEN}✅ Función Lambda creada/actualizada: $FUNCTION_ARN${NC}"

echo "🔗 Configurando API Gateway..."

# Obtener Root Resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --query "items[?path=='/'].id" \
  --output text)

# Crear recurso /auth si no existe
AUTH_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --query "items[?path=='/auth'].id" \
  --output text 2>/dev/null || echo "")

if [ -z "$AUTH_RESOURCE_ID" ]; then
  echo "📝 Creando recurso /auth..."
  AUTH_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id "$API_ID" \
    --parent-id "$ROOT_RESOURCE_ID" \
    --path-part "auth" \
    --region "$REGION" \
    --query 'id' \
    --output text)
  echo -e "${GREEN}✅ Recurso /auth creado${NC}"
else
  echo "✅ Recurso /auth ya existe"
fi

# Crear recurso /register
REGISTER_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --query "items[?path=='/auth/register'].id" \
  --output text 2>/dev/null || echo "")

if [ -z "$REGISTER_RESOURCE_ID" ]; then
  echo "📝 Creando recurso /auth/register..."
  REGISTER_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id "$API_ID" \
    --parent-id "$AUTH_RESOURCE_ID" \
    --path-part "register" \
    --region "$REGION" \
    --query 'id' \
    --output text)
  echo -e "${GREEN}✅ Recurso /auth/register creado${NC}"
else
  echo "✅ Recurso /auth/register ya existe"
fi

# Crear método POST
echo "📝 Configurando método POST..."
aws apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method POST \
  --authorization-type NONE \
  --region "$REGION" > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Método POST ya existe${NC}"

# Crear integración Lambda
echo "🔗 Configurando integración Lambda..."
aws apigateway put-integration \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations" \
  --region "$REGION" > /dev/null

# Dar permiso a API Gateway para invocar Lambda
echo "🔐 Configurando permisos Lambda..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "api-gateway-invoke-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:920413422536:$API_ID/*/*" \
  --region "$REGION" > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Permiso ya existe${NC}"

# Configurar CORS completo para Amplify
echo "🌐 Configurando CORS completo para Amplify..."

# Crear método OPTIONS
aws apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region "$REGION" > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Método OPTIONS ya existe${NC}"

# Crear integración MOCK para OPTIONS
aws apigateway put-integration \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region "$REGION" > /dev/null

# Configurar respuesta OPTIONS con CORS completo
aws apigateway put-method-response \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":true,"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Credentials":true}' \
  --region "$REGION" > /dev/null

aws apigateway put-integration-response \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'\''*'\''","method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id'\''","method.response.header.Access-Control-Allow-Methods":"'\''OPTIONS,POST'\''","method.response.header.Access-Control-Allow-Credentials":"'\''false'\''"}' \
  --region "$REGION" > /dev/null

# Configurar CORS en la respuesta del método POST también
echo "🌐 Configurando CORS en respuesta POST..."
aws apigateway put-method-response \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method POST \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":true,"method.response.header.Content-Type":true}' \
  --region "$REGION" > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Response headers ya configurados${NC}"

# Crear integración response para POST con CORS
aws apigateway put-integration-response \
  --rest-api-id "$API_ID" \
  --resource-id "$REGISTER_RESOURCE_ID" \
  --http-method POST \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
  --region "$REGION" > /dev/null 2>&1 || echo -e "${YELLOW}⚠️ Integration response ya configurado${NC}"

# Deploy API
echo "🚀 Desplegando API..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name "$STAGE" \
  --region "$REGION" \
  --query 'id' \
  --output text)

echo -e "${GREEN}✅ API Gateway configurado y desplegado${NC}"
echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo ""
echo "📍 Endpoint: https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE/auth/register"
echo "🔗 Método: POST"
echo "🌐 CORS: Configurado completo para Amplify"
echo ""

# Limpiar
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

