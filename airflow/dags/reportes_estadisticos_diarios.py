"""
DAG para generar reportes estadísticos diarios de incidentes
Se ejecuta todos los días a las 8 AM para generar estadísticas del día anterior
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import boto3
import json
import os
from collections import Counter

default_args = {
    'owner': 'hackathon-utec',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def generar_reporte_diario(**context):
    """
    Genera reporte estadístico del día anterior
    """
    region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    tabla_reportes = os.getenv('DYNAMODB_TABLA_REPORTES', 'TablaReportes-dev')
    tabla_estados = os.getenv('DYNAMODB_TABLA_ESTADOS', 'TablaEstados-dev')
    s3_bucket = os.getenv('S3_BUCKET_REPORTES', 'hackathon-utec-reportes-dev')
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    s3 = boto3.client('s3', region_name=region)
    
    tabla_reports = dynamodb.Table(tabla_reportes)
    tabla_states = dynamodb.Table(tabla_estados)
    
    # Fecha de ayer
    fecha_ayer = (datetime.now() - timedelta(days=1)).date()
    fecha_ayer_str = fecha_ayer.strftime('%Y-%m-%d')
    
    # Obtener todos los reportes
    response = tabla_reports.scan()
    reportes = response.get('Items', [])
    
    # Filtrar reportes del día anterior
    reportes_ayer = []
    for r in reportes:
        fecha_creacion = r.get('fecha_creacion', '')
        if fecha_creacion and fecha_creacion.startswith(fecha_ayer_str):
            reportes_ayer.append(r)
    
    # Calcular estadísticas
    if len(reportes_ayer) == 0:
        estadisticas = {
            'fecha': fecha_ayer_str,
            'total_reportes': 0,
            'mensaje': 'No hubo reportes este día',
            'por_tipo': {},
            'por_urgencia': {},
            'por_estado': {}
        }
    else:
        # Contadores
        tipos = Counter()
        urgencias = Counter()
        estados = Counter()
        
        for r in reportes_ayer:
            tipo = r.get('tipo', 'otro')
            urgencia = r.get('nivel_urgencia', 'media')
            estado = r.get('estado', 'pendiente')
            
            tipos[tipo] += 1
            urgencias[urgencia] += 1
            estados[estado] += 1
        
        # Calcular reportes críticos
        reportes_criticos = sum(1 for r in reportes_ayer if r.get('nivel_urgencia') == 'critica')
        
        estadisticas = {
            'fecha': fecha_ayer_str,
            'total_reportes': len(reportes_ayer),
            'por_tipo': dict(tipos),
            'por_urgencia': dict(urgencias),
            'por_estado': dict(estados),
            'reportes_criticos': reportes_criticos,
            'promedio_tiempo_resolucion': None,  # Se puede calcular si hay datos de estados
            'timestamp_generacion': datetime.now().isoformat()
        }
    
    # Guardar en S3
    s3_key = f'reportes-estadisticos/diarios/{fecha_ayer_str}.json'
    s3.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=json.dumps(estadisticas, indent=2, ensure_ascii=False),
        ContentType='application/json'
    )
    
    print(f"Reporte diario generado para {fecha_ayer_str}: {estadisticas}")
    return estadisticas

with DAG(
    'reportes_estadisticos_diarios',
    default_args=default_args,
    description='Genera reportes estadísticos diarios de incidentes',
    schedule_interval='0 8 * * *',  # Todos los días a las 8 AM
    catchup=False,
    tags=['reportes', 'estadisticas', 'diario', 's3']
) as dag:
    
    generar_reporte = PythonOperator(
        task_id='generar_reporte_diario',
        python_callable=generar_reporte_diario,
        provide_context=True
    )
    
    generar_reporte

