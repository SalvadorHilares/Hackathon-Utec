#!/bin/bash
# Script para verificar el estado de Airflow en la instancia EC2

STACK_NAME="airflow-hackathon-utec"
KEY_FILE="vockey.pem"

echo "Obteniendo IP pública de la instancia..."
INSTANCE_IP=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`InstancePublicIP`].OutputValue' \
  --output text 2>/dev/null)

if [ -z "$INSTANCE_IP" ] || [ "$INSTANCE_IP" == "None" ]; then
  INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
    --output text 2>/dev/null)
  
  INSTANCE_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>/dev/null)
fi

if [ -z "$INSTANCE_IP" ] || [ "$INSTANCE_IP" == "None" ]; then
  echo "Error: No se pudo obtener la IP pública de la instancia."
  exit 1
fi

echo "IP pública: $INSTANCE_IP"
echo ""
echo "Verificando estado de Airflow..."

ssh -i $KEY_FILE \
  -o StrictHostKeyChecking=no \
  ubuntu@$INSTANCE_IP << 'EOF'
  echo "=== Estado de contenedores Docker ==="
  cd /home/ubuntu/airflow
  docker compose ps
  
  echo ""
  echo "=== Verificando DAGs ==="
  ls -la /home/ubuntu/airflow/dags/*.py 2>/dev/null || echo "No se encontraron DAGs"
  
  echo ""
  echo "=== Verificando logs de inicialización ==="
  tail -20 /var/log/airflow-setup.log 2>/dev/null || echo "No se encontró log de inicialización"
  
  echo ""
  echo "=== Verificando servicios de Airflow ==="
  systemctl status airflow.service --no-pager -l 2>/dev/null || echo "Servicio no encontrado"
EOF

echo ""
echo "Accede a Airflow UI en: http://$INSTANCE_IP:8080"

