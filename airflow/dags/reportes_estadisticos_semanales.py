"""
DAG para generar reportes estadísticos semanales de incidentes
Se ejecuta todos los lunes a las 9 AM para generar estadísticas de la semana anterior
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

def generar_reporte_semanal(**context):
    """
    Genera reporte estadístico de la semana anterior
    """
    region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
    tabla_reportes = os.getenv('DYNAMODB_TABLA_REPORTES', 'TablaReportes-dev')
    tabla_estados = os.getenv('DYNAMODB_TABLA_ESTADOS', 'TablaEstados-dev')
    s3_bucket = os.getenv('S3_BUCKET_REPORTES', 'hackathon-utec-reportes-dev')
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    s3 = boto3.client('s3', region_name=region)
    
    tabla_reports = dynamodb.Table(tabla_reportes)
    
    # Fecha de inicio y fin de la semana anterior
    hoy = datetime.now()
    # Calcular lunes de la semana anterior
    dias_desde_lunes = hoy.weekday()
    lunes_semana_actual = hoy - timedelta(days=dias_desde_lunes)
    lunes_semana_anterior = lunes_semana_actual - timedelta(days=7)
    domingo_semana_anterior = lunes_semana_anterior + timedelta(days=6)
    
    inicio_semana = lunes_semana_anterior.replace(hour=0, minute=0, second=0, microsecond=0)
    fin_semana = domingo_semana_anterior.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Obtener todos los reportes
    response = tabla_reports.scan()
    reportes = response.get('Items', [])
    
    # Filtrar reportes de la semana anterior
    reportes_semana = []
    for r in reportes:
        fecha_creacion = r.get('fecha_creacion', '')
        if fecha_creacion:
            try:
                # Parsear fecha (formato ISO)
                fecha = datetime.fromisoformat(fecha_creacion.replace('Z', '+00:00'))
                # Convertir a UTC naive para comparación
                if fecha.tzinfo:
                    fecha = fecha.replace(tzinfo=None)
                
                if inicio_semana <= fecha <= fin_semana:
                    reportes_semana.append(r)
            except Exception as e:
                print(f"Error parseando fecha {fecha_creacion}: {e}")
                continue
    
    # Calcular estadísticas
    if len(reportes_semana) == 0:
        estadisticas = {
            'periodo': {
                'inicio': inicio_semana.isoformat(),
                'fin': fin_semana.isoformat()
            },
            'total_reportes': 0,
            'mensaje': 'No hubo reportes esta semana',
            'por_tipo': {},
            'por_urgencia': {},
            'por_estado': {},
            'tendencias': {}
        }
    else:
        # Contadores
        tipos = Counter()
        urgencias = Counter()
        estados = Counter()
        dias_activos = Counter()
        
        for r in reportes_semana:
            tipo = r.get('tipo', 'otro')
            urgencia = r.get('nivel_urgencia', 'media')
            estado = r.get('estado', 'pendiente')
            
            tipos[tipo] += 1
            urgencias[urgencia] += 1
            estados[estado] += 1
            
            # Contar por día
            fecha_creacion = r.get('fecha_creacion', '')
            if fecha_creacion:
                try:
                    fecha = datetime.fromisoformat(fecha_creacion.replace('Z', '+00:00'))
                    if fecha.tzinfo:
                        fecha = fecha.replace(tzinfo=None)
                    dia_semana = fecha.strftime('%Y-%m-%d')
                    dias_activos[dia_semana] += 1
                except:
                    pass
        
        # Determinar día más activo
        dia_mas_activo = dias_activos.most_common(1)[0] if dias_activos else None
        
        estadisticas = {
            'periodo': {
                'inicio': inicio_semana.isoformat(),
                'fin': fin_semana.isoformat()
            },
            'total_reportes': len(reportes_semana),
            'por_tipo': dict(tipos),
            'por_urgencia': dict(urgencias),
            'por_estado': dict(estados),
            'tendencias': {
                'dia_mas_activo': {
                    'fecha': dia_mas_activo[0],
                    'total': dia_mas_activo[1]
                } if dia_mas_activo else None,
                'tipo_mas_comun': tipos.most_common(1)[0][0] if tipos else None,
                'urgencia_mas_comun': urgencias.most_common(1)[0][0] if urgencias else None
            },
            'reportes_criticos': sum(1 for r in reportes_semana if r.get('nivel_urgencia') == 'critica'),
            'timestamp_generacion': datetime.now().isoformat()
        }
    
    # Guardar en S3
    fecha_reporte = inicio_semana.strftime('%Y-%m-%d')
    s3_key = f'reportes-estadisticos/semanales/semana-{fecha_reporte}.json'
    s3.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=json.dumps(estadisticas, indent=2, ensure_ascii=False),
        ContentType='application/json'
    )
    
    print(f"Reporte semanal generado para semana {fecha_reporte}: {estadisticas}")
    return estadisticas

with DAG(
    'reportes_estadisticos_semanales',
    default_args=default_args,
    description='Genera reportes estadísticos semanales de incidentes',
    schedule_interval='0 9 * * 1',  # Todos los lunes a las 9 AM
    catchup=False,
    tags=['reportes', 'estadisticas', 'semanal', 's3']
) as dag:
    
    generar_reporte = PythonOperator(
        task_id='generar_reporte_semanal',
        python_callable=generar_reporte_semanal,
        provide_context=True
    )
    
    generar_reporte

