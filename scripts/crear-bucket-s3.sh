#!/bin/bash
# Script para crear el bucket S3 manualmente con la configuración correcta

BUCKET_NAME="hackathon-utec-reportes-dev"
REGION="us-east-1"

echo "📦 Creando bucket S3: $BUCKET_NAME"

# Verificar si el bucket ya existe
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
  echo "📝 El bucket no existe. Creando..."
  
  # Crear bucket
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ Bucket creado exitosamente"
  else
    echo "⚠️ Error al crear bucket. Puede que ya exista o haya un conflicto."
    exit 1
  fi
else
  echo "✅ El bucket ya existe: $BUCKET_NAME"
fi

# Configurar CORS
echo "🌐 Configurando CORS..."
aws s3api put-bucket-cors \
  --bucket "$BUCKET_NAME" \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedHeaders": ["*"],
        "MaxAgeSeconds": 3000
      }
    ]
  }' 2>&1

if [ $? -eq 0 ]; then
  echo "✅ CORS configurado exitosamente"
else
  echo "⚠️ Error al configurar CORS"
fi

# Configurar Public Access Block
echo "🔒 Configurando Public Access Block..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Public Access Block configurado exitosamente"
else
  echo "⚠️ Error al configurar Public Access Block"
fi

echo ""
echo "🎉 Bucket S3 configurado: s3://$BUCKET_NAME"
echo "📍 Región: $REGION"

