"""
app/models/ai_incident.py
------------------------------
Nhật ký "sự cố hệ thống" do AI phát hiện + tự xử lý — phần trình bày AI như
một người bảo vệ luôn túc trực. Admin biên soạn qua template (điền số liệu
thật vào chỗ trống), hoặc (tương lai) tự động ghi khi bộ phát hiện traffic
bất thường thật sự chặn 1 IP.

detected_at tách riêng khỏi created_at để có thể lùi thời gian (vd "tối qua
23:47") — created_at vẫn giữ nguyên thời điểm admin thực sự tạo bản ghi
trong hệ thống, để có dấu vết thật nếu cần tra soát sau này.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AIIncident(Base):
    __tablename__ = "ai_incidents"

    incident_id  = Column(Integer, primary_key=True, autoincrement=True)
    category     = Column(String(50), nullable=False)    # traffic_spike | brute_force | db_overload | high_latency | auto_scale | custom
    severity     = Column(String(20), nullable=False, default="warning")  # info | warning | critical
    title        = Column(String(255), nullable=False)
    root_cause   = Column(Text, nullable=False)
    actions_taken = Column(JSON, nullable=False, default=list)   # list[str] — từng bước xử lý, hiển thị dạng log console
    metrics      = Column(JSON, nullable=True)   # số liệu thật đã điền vào template (để sửa lại sau nếu cần)

    detected_at  = Column(DateTime, nullable=False)   # có thể lùi ngày ("tối qua")
    resolved_at  = Column(DateTime, nullable=True)
    status       = Column(String(20), nullable=False, default="resolved")  # detected | mitigating | resolved

    is_seed      = Column(Boolean, nullable=False, default=True)  # nội bộ — KHÔNG hiển thị ở UI, chỉ để tác giả tự phân biệt sau này
    created_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_ai_incidents_detected", "detected_at"),
        Index("idx_ai_incidents_category", "category"),
    )

    creator = relationship("User", foreign_keys=[created_by])
