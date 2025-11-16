#!/bin/bash
# Script para completar la instalación de Airflow (Docker ya está instalado)

set -e

echo "=== Completando instalación de Airflow ==="
echo ""

# Verificar que Docker está disponible
if ! command -v docker &> /dev/null; then
    echo "Error: Docker no está instalado"
    exit 1
fi

echo "✅ Docker está instalado: $(docker --version)"
echo ""

# Agregar usuario al grupo docker si no está
if ! groups | grep -q docker; then
    echo "Agregando usuario al grupo docker..."
    sudo usermod -aG docker ubuntu
    newgrp docker || true
fi

# Crear estructura de directorios
echo "1. Creando directorios..."
mkdir -p /home/ubuntu/airflow/dags
mkdir -p /home/ubuntu/airflow/logs
mkdir -p /home/ubuntu/airflow/plugins
mkdir -p /home/ubuntu/airflow/config

# Descargar docker-compose.yaml oficial de Apache Airflow 2.10.3
echo ""
echo "2. Descargando docker-compose.yaml oficial de Apache Airflow 2.10.3..."
cd /home/ubuntu/airflow
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.10.3/docker-compose.yaml'

if [ ! -f "docker-compose.yaml" ]; then
    echo "Error: No se pudo descargar docker-compose.yaml"
    exit 1
fi

echo "✅ docker-compose.yaml descargado"

# Generar archivo .env con AIRFLOW_UID
echo ""
echo "3. Generando archivo .env..."
echo -e "AIRFLOW_UID=$(id -u)" > /home/ubuntu/airflow/.env

# Agregar variables de entorno adicionales
echo ""
echo "4. Configurando variables de entorno..."
cat >> /home/ubuntu/airflow/.env << 'EOF'
AWS_DEFAULT_REGION=us-east-1
DYNAMODB_TABLA_REPORTES=TablaReportes-dev
DYNAMODB_TABLA_ESTADOS=TablaEstados-dev
DYNAMODB_TABLA_HISTORIAL=TablaHistorial-dev
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:755311132141:hackathon-utec-notificaciones-dev
S3_BUCKET_REPORTES=hackathon-utec-reportes-dev
EOF

echo "✅ Archivo .env creado"
cat /home/ubuntu/airflow/.env

# Inicializar Airflow (esto crea las tablas en PostgreSQL)
echo ""
echo "5. Inicializando Airflow (esto puede tardar varios minutos)..."
echo "   Descargando imágenes de Docker por primera vez..."
cd /home/ubuntu/airflow
docker compose up airflow-init

# Iniciar servicios de Airflow en background
echo ""
echo "6. Iniciando servicios de Airflow..."
docker compose up -d

# Esperar un momento para que los servicios inicien
echo ""
echo "7. Esperando a que los servicios inicien..."
sleep 10

# Verificar estado
echo ""
echo "8. Verificando estado de contenedores..."
docker compose ps

# Configurar para que Airflow inicie automáticamente al reiniciar
echo ""
echo "9. Configurando servicio systemd para inicio automático..."
sudo tee /etc/systemd/system/airflow.service > /dev/null << 'EOFSERVICE'
[Unit]
Description=Apache Airflow
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/airflow
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
EOFSERVICE

sudo systemctl daemon-reload
sudo systemctl enable airflow.service

# Log de finalización
echo ""
echo "10. Guardando log..."
echo "Airflow setup completado - $(date)" | sudo tee -a /var/log/airflow-setup.log

echo ""
echo "=== ✅ Instalación completada ==="
echo ""
echo "Airflow está corriendo. Accede a:"
echo "http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo ""
echo "Credenciales:"
echo "  Usuario: airflow"
echo "  Contraseña: airflow"
echo ""
echo "Para ver los contenedores:"
echo "  cd /home/ubuntu/airflow && docker compose ps"

