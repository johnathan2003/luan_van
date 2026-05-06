import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
app = Celery("shopee_clone")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # Chạy recommendation mỗi 6 tiếng
    "update-recommendations": {
        "task": "apps.ai_services.tasks.update_recommendations",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # Gửi báo cáo analytics cho seller mỗi ngày 8h sáng
    "daily-seller-analytics": {
        "task": "apps.analytics.tasks.send_daily_seller_report",
        "schedule": crontab(minute=0, hour=8),
    },
    # Cảnh báo tồn kho thấp mỗi 2 tiếng
    "check-low-inventory": {
        "task": "apps.inventory.tasks.check_low_stock",
        "schedule": crontab(minute=0, hour="*/2"),
    },
}