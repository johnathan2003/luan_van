import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SENDER_EMAIL
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SENDER_EMAIL, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    html = f"""
    <h2>Đặt lại mật khẩu</h2>
    <p>Nhấn vào link bên dưới để đặt lại mật khẩu của bạn:</p>
    <a href="{reset_url}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
        Đặt lại mật khẩu
    </a>
    <p>Link có hiệu lực trong 1 giờ.</p>
    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    """
    return send_email(to_email, "Đặt lại mật khẩu - E-Commerce", html)


def send_welcome_email(to_email: str, full_name: str) -> bool:
    html = f"""
    <h2>Chào mừng {full_name}!</h2>
    <p>Tài khoản của bạn đã được tạo thành công trên E-Commerce Platform.</p>
    <p>Bắt đầu mua sắm ngay tại: <a href="{settings.FRONTEND_URL}">{settings.FRONTEND_URL}</a></p>
    """
    return send_email(to_email, "Chào mừng đến với E-Commerce!", html)


def send_order_confirmation_email(to_email: str, order_id: int, total: str) -> bool:
    html = f"""
    <h2>Xác nhận đơn hàng #{order_id}</h2>
    <p>Đơn hàng của bạn đã được đặt thành công.</p>
    <p>Tổng tiền: <strong>{total}</strong></p>
    <p>Xem chi tiết tại: <a href="{settings.FRONTEND_URL}/orders/{order_id}">Đây</a></p>
    """
    return send_email(to_email, f"Xác nhận đơn hàng #{order_id}", html)
