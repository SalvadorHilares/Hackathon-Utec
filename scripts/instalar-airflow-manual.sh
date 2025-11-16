#!/bin/bash
# Script para instalar Airflow manualmente en EC2 si el UserData falló

set -e

echo "=== Instalando Apache Airflow en EC2 ==="
echo ""

# Actualizar sistema
echo "1. Actualizando sistema..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Instalar dependencias
echo ""
echo "2. Instalando dependencias..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    python3-pip

# Instalar Docker
echo ""
echo "3. Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    echo "   ✅ Docker instalado"
else
    echo "   ✅ Docker ya está instalado"
fi

# Agregar usuario ubuntu al grupo docker
echo ""
echo "4. Configurando permisos Docker..."
sudo usermod -aG docker ubuntu
newgrp docker || true

# Crear estructura de directorios para Airflow
echo ""
echo "5. Creando estructura de directorios..."
mkdir -p /home/ubuntu/airflow/dags
mkdir -p /home/ubuntu/airflow/logs
mkdir -p /home/ubuntu/airflow/plugins
mkdir -p /home/ubuntu/airflow/config

# Descargar docker-compose.yaml oficial de Apache Airflow 2.10.3
echo ""
echo "6. Descargando docker-compose.yaml oficial..."
cd /home/ubuntu/airflow
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.10.3/docker-compose.yaml'

# Generar archivo .env con AIRFLOW_UID
echo ""
echo "7. Generando archivo .env..."
echo -e "AIRFLOW_UID=$(id -u)" > /home/ubuntu/airflow/.env

# Agregar variables de entorno adicionales
echo ""
echo "8. Configurando variables de entorno..."
cat >> /home/ubuntu/airflow/.env << 'EOF'
AWS_DEFAULT_REGION=us-east-1
DYNAMODB_TABLA_REPORTES=TablaReportes-dev
DYNAMODB_TABLA_ESTADOS=TablaEstados-dev
DYNAMODB_TABLA_HISTORIAL=TablaHistorial-dev
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:755311132141:hackathon-utec-notificaciones-dev
S3_BUCKET_REPORTES=hackathon-utec-reportes-dev
EOF

# Inicializar Airflow (esto crea las tablas en PostgreSQL)
echo ""
echo "9. Inicializando Airflow (esto puede tardar varios minutos)..."
cd /home/ubuntu/airflow
docker compose up airflow-init

# Iniciar servicios de Airflow en background
echo ""
echo "10. Iniciando servicios de Airflow..."
docker compose up -d

# Configurar para que Airflow inicie automáticamente al reiniciar
echo ""
echo "11. Configurando servicio systemd..."
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
echo "12. Guardando log..."
echo "Airflow setup completado - $(date)" | sudo tee -a /var/log/airflow-setup.log

echo ""
echo "=== Instalación completada ==="
echo ""
echo "Verificando estado de contenedores..."
sleep 5
docker compose ps

echo ""
echo "✅ Airflow debería estar corriendo ahora!"
echo "Accede a: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo "Usuario: airflow"
echo "Contraseña: airflow"

