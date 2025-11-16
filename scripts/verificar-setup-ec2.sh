#!/bin/bash
# Script para verificar y completar el setup de Airflow en EC2

echo "=== Verificando estado del sistema ==="
echo ""

# Verificar si Docker está instalado
echo "1. Verificando Docker..."
if command -v docker &> /dev/null; then
    echo "   ✅ Docker está instalado"
    docker --version
else
    echo "   ❌ Docker NO está instalado"
    echo "   El UserData script no se ejecutó completamente"
    exit 1
fi

# Verificar si docker compose está disponible
echo ""
echo "2. Verificando Docker Compose..."
if docker compose version &> /dev/null; then
    echo "   ✅ Docker Compose está disponible"
    docker compose version
else
    echo "   ❌ Docker Compose NO está disponible"
fi

# Verificar estructura de directorios
echo ""
echo "3. Verificando directorios de Airflow..."
if [ -d "/home/ubuntu/airflow" ]; then
    echo "   ✅ Directorio /home/ubuntu/airflow existe"
    ls -la /home/ubuntu/airflow/
else
    echo "   ❌ Directorio /home/ubuntu/airflow NO existe"
fi

# Verificar si docker-compose.yaml existe
echo ""
echo "4. Verificando docker-compose.yaml..."
if [ -f "/home/ubuntu/airflow/docker-compose.yaml" ]; then
    echo "   ✅ docker-compose.yaml existe"
else
    echo "   ❌ docker-compose.yaml NO existe"
fi

# Verificar archivo .env
echo ""
echo "5. Verificando archivo .env..."
if [ -f "/home/ubuntu/airflow/.env" ]; then
    echo "   ✅ Archivo .env existe"
    cat /home/ubuntu/airflow/.env
else
    echo "   ❌ Archivo .env NO existe"
fi

# Verificar logs de inicialización
echo ""
echo "6. Verificando logs de inicialización..."
if [ -f "/var/log/airflow-setup.log" ]; then
    echo "   ✅ Log existe"
    echo "   Últimas líneas del log:"
    tail -20 /var/log/airflow-setup.log
else
    echo "   ❌ Log NO existe - El UserData script no se ejecutó"
fi

# Verificar contenedores
echo ""
echo "7. Verificando contenedores Docker..."
docker ps -a

echo ""
echo "=== Resumen ==="
echo "Si Docker no está instalado o los directorios no existen,"
echo "el UserData script no se ejecutó. Necesitas ejecutarlo manualmente."

