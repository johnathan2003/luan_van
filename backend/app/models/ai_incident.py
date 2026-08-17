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

Quy trình xử lý (vẫn là "fake" — không có tự động hoá thật, admin tự mô
phỏng qua UI):
  - Lỗi nhỏ (severity info/warning): coi như AI đã tự vá ngay, nhưng gộp lại
    chờ 1 bản cập nhật chung phát hành vào cuối tuần (status='scheduled',
    release_batch_date). Admin bấm "phát hành" để đóng hàng loạt.
  - Lỗi nghiêm trọng (severity critical): AI chỉ đề xuất giải pháp
    (proposed_solution), CHỜ admin đọc và bấm duyệt (status='pending_approval'
    → 'resolved') rồi mới coi như đã đưa lên hệ thống chính thức.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, JSON, Boolean, ForeignKey, Index
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
    # status: detected | mitigating | pending_approval | scheduled | resolved
    #   - pending_approval: lỗi severity=critical — AI đã đề xuất giải pháp
    #     (proposed_solution), CHỜ admin duyệt (POST .../approve) rồi mới coi
    #     là resolved và "đưa lên hệ thống".
    #   - scheduled: lỗi nhỏ (info/warning) — coi như đã tự vá tạm thời, gộp
    #     chờ vào 1 bản cập nhật cuối tuần (release_batch_date). Admin bấm
    #     "phát hành" (POST .../release-batch) để đóng hàng loạt cùng lúc.
    status       = Column(String(20), nullable=False, default="resolved")

    # Giải pháp AI đề xuất cho lỗi critical — admin đọc trước khi bấm duyệt.
    # Chỉ có ý nghĩa khi status='pending_approval' (hoặc đã từng ở trạng thái
    # đó trước khi được duyệt).
    proposed_solution   = Column(Text, nullable=True)
    # Ngày (thường là thứ 7) mà lỗi nhỏ này dự kiến được gộp vào bản cập nhật
    # chung — chỉ có ý nghĩa khi status='scheduled' (hoặc đã từng).
    release_batch_date  = Column(Date, nullable=True)
    approved_by  = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    approved_at  = Column(DateTime, nullable=True)

    is_seed      = Column(Boolean, nullable=False, default=True)  # nội bộ — KHÔNG hiển thị ở UI, chỉ để tác giả tự phân biệt sau này
    created_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_ai_incidents_detected", "detected_at"),
        Index("idx_ai_incidents_category", "category"),
    )

    creator  = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
