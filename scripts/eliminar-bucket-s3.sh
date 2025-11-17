#!/bin/bash
# Script para eliminar el bucket S3 manualmente si está causando conflictos

BUCKET_NAME="hackathon-utec-reportes-dev"
REGION="us-east-1"

echo "🗑️ Eliminando bucket S3: $BUCKET_NAME"

# Verificar si el bucket existe
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
  echo "✅ El bucket no existe. No hay nada que eliminar."
  exit 0
fi

echo "📋 El bucket existe. Eliminando contenido primero..."

# Eliminar todos los objetos del bucket
aws s3 rm "s3://$BUCKET_NAME" --recursive 2>/dev/null || echo "⚠️ No se pudieron eliminar objetos (puede estar vacío)"

# Eliminar el bucket
echo "🗑️ Eliminando bucket..."
aws s3api delete-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Bucket eliminado exitosamente"
else
  echo "⚠️ Error al eliminar bucket. Puede que aún tenga objetos o esté en proceso de eliminación."
  echo "💡 Espera unos minutos y vuelve a intentar el deploy."
fi

