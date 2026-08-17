/**
 * AuctionRulesPage.tsx — Quy định đấu giá dành cho shop
 * ---------------------------------------------------------------------------
 * Trang tĩnh, tổng hợp luật chơi của 3 hệ thống đấu giá: Banner, Flash Sale
 * slot, Top sản phẩm slot. Không gọi API — chỉ trình bày quy định để shop
 * đọc trước khi tham gia đấu giá.
 */
import React from 'react'
import { Link } from 'react-router-dom'

const C = {
  purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.08)',
  orange: '#EA580C', orangeBg: 'rgba(234,88,12,0.08)',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.08)',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)',
}

const Section: React.FC<{ icon: string; title: string; color: string; bg: string; children: React.ReactNode }> = ({ icon, title, color, bg, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
    <p style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ background: bg, color, borderRadius: 999, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</span>
      {title}
    </p>
    <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{children}</div>
  </div>
)

const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li style={{ marginBottom: 6 }}>{children}</li>
)

const AuctionRulesPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 820 }}>
      <Link to="/shop/slot-auctions" style={{ color: C.gray, fontSize: 12, textDecoration: 'none' }}>← Về danh sách phiên đấu giá</Link>

      <h2 style={{ margin: '10px 0 4px' }}>📋 Quy định đấu giá vị trí quảng bá</h2>
      <p style={{ color: C.gray, fontSize: 13.5, marginBottom: 20 }}>
        Áp dụng cho cả 3 hệ thống: đấu giá Banner, đấu giá vị trí Flash Sale và đấu giá vị trí Top sản phẩm.
        Vui lòng đọc kỹ trước khi tham gia đặt giá.
      </p>

      <Section icon="🏹" title="Cơ chế đặt giá chung" color={C.purple} bg={C.purpleBg}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <Li>Mỗi lượt đặt giá phải cao hơn giá hiện tại; hệ thống gợi ý các mốc +5% / +10% / +20% nhưng bạn có thể nhập số tự do.</Li>
          <Li>Số dư khả dụng trong ví phải đủ để giữ (reserve) mức giá bạn đặt — số tiền này bị tạm giữ cho tới khi có người trả giá cao hơn (được nhả lại) hoặc bạn thắng phiên.</Li>
          <Li>Khi phiên kết thúc, người trả giá cao nhất thắng. Với Flash Sale và Banner, sản phẩm/nội dung quảng bá được chọn ngay từ lượt đặt giá đầu tiên và không thể đổi giữa phiên.</Li>
        </ul>
      </Section>

      <Section icon="🎯" title="Banner (Trang chủ + Mall)" color={C.blue} bg={C.blueBg}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <Li><b>Mọi phiên banner đều có endPrice (giá mua đứt)</b> — đạt tới endPrice sẽ thắng ngay lập tức, không cần chờ hết giờ.</Li>
          <Li>Thắng qua đấu giá thường (không mua đứt): trừ cọc 20% ngay khi thắng, còn 80% phải thanh toán nốt trong <b>30 phút</b> — trễ hạn sẽ bị mất cọc và ghi 1 lần vi phạm.</Li>
          <Li>Thắng qua mua đứt (đạt endPrice): trừ <b>100%</b> ngay lập tức.</Li>
          <Li>🔒 <b>Khoá mua đứt trong 6 tiếng cuối</b> trước khi phiên kết thúc — trong khung giờ này mọi mức giá (kể cả bằng/cao hơn endPrice) chỉ tính là bid thường, tránh bị cắt ngang phiên vào phút chót.</Li>
          <Li>Sau khi thanh toán đủ 100%, có <b>6 tiếng với tối đa 10 lần nộp</b> nội dung lên admin duyệt. Hết giờ hoặc hết lượt nộp mà chưa được duyệt → phiên bị huỷ, tiền đã thanh toán <b>không được hoàn lại</b>.</Li>
          <Li>Nội dung được admin duyệt sẽ <b>lên hệ thống vào 0:00 ngày hôm sau</b> (không lên ngay lập tức).</Li>
          <Li>Nếu thắng nhưng trả trễ 80% còn lại: tiền cọc 20% đã trừ <b>không được hoàn</b>, đồng thời ghi nhận 1 lần vi phạm. Các shop trả giá thua thì không bị ảnh hưởng gì — tiền giữ chỗ được nhả lại bình thường.</Li>
        </ul>
      </Section>

      <Section icon="⚡" title="Flash Sale slot (vị trí sản phẩm)" color={C.orange} bg={C.orangeBg}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <Li>Phải <b>chọn sản phẩm muốn quảng bá ngay từ lượt đặt giá đầu tiên</b> — sản phẩm này được giữ nguyên cho cả phiên, không đổi được.</Li>
          <Li>Có endPrice (giá mua đứt) — đạt tới sẽ trừ tiền và thắng ngay lập tức.</Li>
          <Li>🔒 Khoá mua đứt trong 6 tiếng cuối trước khi kết thúc phiên, giống banner.</Li>
          <Li>Thắng qua đấu giá thường: cọc 20% ngay, thanh toán nốt 80% trong 30 phút, trễ hạn mất cọc + 1 vi phạm.</Li>
          <Li>Thắng qua mua đứt: trừ 100% ngay, có 6 tiếng với tối đa <b>3 lần nộp</b> nội dung lên admin duyệt (khác với banner là 10 lần).</Li>
          <Li>Nội dung được duyệt sẽ lên hệ thống vào 0:00 ngày hôm sau.</Li>
        </ul>
      </Section>

      <Section icon="🚀" title="Top sản phẩm slot (vị trí trong trang danh mục/tìm kiếm)" color={C.green} bg={C.greenBg}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <Li><b>Không có cơ chế mua đứt (endPrice)</b> — chỉ có đấu giá thông thường, ai trả cao nhất khi hết giờ sẽ thắng.</Li>
          <Li>Vẫn phải chọn sản phẩm muốn quảng bá ngay từ lượt đặt giá đầu tiên, giữ nguyên cho cả phiên.</Li>
          <Li>Sau khi đấu giá kết thúc: cọc 20% ngay khi thắng, thanh toán nốt 80% còn lại trong <b>30 phút</b> — trễ hạn mất cọc + 1 vi phạm.</Li>
          <Li>Sau khi thanh toán đủ, nộp nội dung lên admin duyệt (tối đa 3 lần, trong 6 tiếng) rồi lên hệ thống vào 0:00 ngày hôm sau.</Li>
        </ul>
      </Section>

      <Section icon="⚠️" title="Vi phạm & khoá tài khoản đấu giá" color={C.red} bg={C.redBg}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <Li>Vi phạm được ghi nhận khi: trễ hạn thanh toán 80% còn lại (đấu giá thường), hoặc hết hạn/hết lượt nộp nội dung mà chưa được duyệt (thắng qua mua đứt).</Li>
          <Li>Hệ thống ghi nhận vi phạm <b>dùng chung cho cả banner và slot</b> (Flash Sale + Top sản phẩm) — vi phạm ở hệ thống nào cũng cộng dồn vào cùng 1 nơi.</Li>
          <Li>Đủ <b>3 lần vi phạm</b> sẽ bị khoá quyền tham gia đấu giá.</Li>
          <Li>Tiền đã trừ khi vi phạm (cọc 20% hoặc 100% mua đứt) <b>không được hoàn lại</b> — được tính là doanh thu của sàn.</Li>
        </ul>
      </Section>

      <p style={{ color: C.gray, fontSize: 12, marginTop: 8 }}>
        Có thắc mắc về quy định? Liên hệ đội ngũ hỗ trợ shop qua mục <Link to="/shop/chat" style={{ color: C.purple }}>Tin nhắn</Link>.
      </p>
    </div>
  )
}

export default AuctionRulesPage
