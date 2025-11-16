#!/bin/bash
# Script para copiar DAGs de Airflow a la instancia EC2

# Obtener IP pública de la instancia desde CloudFormation
STACK_NAME="airflow-hackathon-utec"
KEY_FILE="vockey.pem"

echo "Obteniendo IP pública de la instancia..."
INSTANCE_IP=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`InstancePublicIP`].OutputValue' \
  --output text 2>/dev/null)

if [ -z "$INSTANCE_IP" ] || [ "$INSTANCE_IP" == "None" ]; then
  echo "Error: No se pudo obtener la IP pública. Verificando instancia directamente..."
  INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
    --output text 2>/dev/null)
  
  if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
    echo "Error: No se encontró la instancia. Verifica el nombre del stack."
    exit 1
  fi
  
  INSTANCE_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>/dev/null)
fi

if [ -z "$INSTANCE_IP" ] || [ "$INSTANCE_IP" == "None" ]; then
  echo "Error: No se pudo obtener la IP pública de la instancia."
  exit 1
fi

echo "IP pública encontrada: $INSTANCE_IP"
echo ""
echo "Copiando DAGs a la instancia..."

# Verificar que existe el archivo de clave
if [ ! -f "$KEY_FILE" ]; then
  echo "Error: No se encontró el archivo de clave $KEY_FILE"
  echo "Asegúrate de tener el archivo vockey.pem en el directorio actual"
  exit 1
fi

# Copiar DAGs
scp -i $KEY_FILE \
  -o StrictHostKeyChecking=no \
  airflow/dags/*.py \
  ubuntu@$INSTANCE_IP:/home/ubuntu/airflow/dags/

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ DAGs copiados exitosamente!"
  echo ""
  echo "Accede a Airflow UI en: http://$INSTANCE_IP:8080"
  echo "Credenciales:"
  echo "  Usuario: airflow"
  echo "  Contraseña: airflow"
else
  echo ""
  echo "❌ Error al copiar DAGs. Verifica:"
  echo "  1. Que la instancia esté completamente inicializada (espera 5-10 minutos después del despliegue)"
  echo "  2. Que el Security Group permita conexiones SSH (puerto 22)"
  echo "  3. Que tengas el archivo vockey.pem en el directorio actual"
fi

