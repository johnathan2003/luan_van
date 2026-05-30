from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_daily_seller_report():
    """Đã được định nghĩa trong inventory/tasks.py, import lại ở đây để Celery beat gọi"""
    from apps.inventory.tasks import send_daily_seller_report as _task
    _task()
