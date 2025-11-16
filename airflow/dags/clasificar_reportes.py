"""
DAG para clasificación automática de reportes y notificación a áreas responsables
Se ejecuta cada 5 minutos para procesar reportes pendientes sin clasificar
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import boto3
import json
import os

default_args = {
    'owner': 'hackathon-utec',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# Mapeo de tipos de reporte a áreas responsables
AREAS_RESPONSABLES = {
    'seguridad': 'area-seguridad@utec.edu.pe',
    'mantenimiento': 'area-mantenimiento@utec.edu.pe',
    'limpieza': 'area-limpieza@utec.edu.pe',
    'otro': 'area-general@utec.edu.pe'
}

def clasificar_y_notificar(**context):
    """
    Clasifica reportes nuevos y envía notificaciones a áreas responsables
    Se ejecuta cuando DynamoDB Stream detecta un nuevo reporte
    """
    region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    tabla_reportes = os.getenv('DYNAMODB_TABLA_REPORTES', 'TablaReportes-dev')
    sns_topic_arn = os.getenv('SNS_TOPIC_ARN', 'arn:aws:sns:us-east-1:755311132141:hackathon-utec-notificaciones-dev')
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    sns = boto3.client('sns', region_name=region)
    
    tabla = dynamodb.Table(tabla_reportes)
    
    # Obtener reportes pendientes sin clasificación automática
    # Usar scan con filtro para encontrar reportes sin el campo clasificado_automaticamente
    response = tabla.scan(
        FilterExpression='estado = :estado',
        ExpressionAttributeValues={':estado': 'pendiente'}
    )
    
    reportes = response.get('Items', [])
    
    # Filtrar reportes que no tienen clasificado_automaticamente
    reportes_sin_clasificar = [
        r for r in reportes 
        if 'clasificado_automaticamente' not in r or not r.get('clasificado_automaticamente')
    ]
    
    procesados = 0
    
    for reporte in reportes_sin_clasificar:
        try:
            tipo = reporte.get('tipo', 'otro')
            nivel_urgencia = reporte.get('nivel_urgencia', 'media')
            reporte_id = reporte.get('reporte_id')
            fecha_creacion = reporte.get('fecha_creacion')
            
            if not reporte_id or not fecha_creacion:
                continue
            
            # Determinar área responsable
            area_responsable = AREAS_RESPONSABLES.get(tipo, AREAS_RESPONSABLES['otro'])
            
            # Marcar como clasificado (usar ambas claves: reporte_id + fecha_creacion)
            tabla.update_item(
                Key={
                    'reporte_id': reporte_id,
                    'fecha_creacion': fecha_creacion
                },
                UpdateExpression='SET clasificado_automaticamente = :true, area_responsable = :area',
                ExpressionAttributeValues={
                    ':true': True,
                    ':area': area_responsable
                }
            )
            
            # Enviar notificación SNS al área responsable
            mensaje = {
                'reporte_id': reporte_id,
                'tipo': tipo,
                'nivel_urgencia': nivel_urgencia,
                'ubicacion': reporte.get('ubicacion', ''),
                'descripcion': reporte.get('descripcion', ''),
                'area_responsable': area_responsable,
                'tipo_notificacion': 'clasificacion_automatica',
                'timestamp': datetime.now().isoformat()
            }
            
            sns.publish(
                TopicArn=sns_topic_arn,
                Subject=f'Nuevo Reporte {tipo.upper()} - {nivel_urgencia.upper()}',
                Message=json.dumps(mensaje, indent=2),
                MessageAttributes={
                    'tipo': {'DataType': 'String', 'StringValue': tipo},
                    'nivel_urgencia': {'DataType': 'String', 'StringValue': nivel_urgencia},
                    'tipo_notificacion': {'DataType': 'String', 'StringValue': 'clasificacion_automatica'}
                }
            )
            
            print(f"Reporte {reporte_id} clasificado y notificado a {area_responsable}")
            procesados += 1
            
        except Exception as e:
            print(f"Error procesando reporte {reporte.get('reporte_id', 'unknown')}: {str(e)}")
            continue
    
    return f"Procesados {procesados} reportes de {len(reportes_sin_clasificar)} sin clasificar"

with DAG(
    'clasificar_reportes_automatico',
    default_args=default_args,
    description='Clasifica reportes automáticamente y notifica a áreas responsables',
    schedule_interval='*/5 * * * *',  # Cada 5 minutos
    catchup=False,
    tags=['clasificacion', 'notificaciones', 'dynamodb']
) as dag:
    
    clasificar_task = PythonOperator(
        task_id='clasificar_y_notificar',
        python_callable=clasificar_y_notificar,
        provide_context=True
    )
    
    clasificar_task

