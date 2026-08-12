import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const C = {
  navy: '#1E3A8A', primary: '#1D4ED8',
  gray: '#64748B', light: '#F8FAFC',
  border: '#E2E8F0',
}

const tabs = [
  { key: 'general', label: '📋 Quy định chung' },
  { key: 'buyer',   label: '👤 Người mua' },
  { key: 'seller',  label: '🏪 Người bán' },
  { key: 'shipper', label: '🚚 Shipper' },
  { key: 'privacy', label: '🔒 Bảo mật & Dữ liệu' },
]

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <h3 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${C.primary}`, display: 'inline-block' }}>
      {title}
    </h3>
    <div style={{ fontSize: 14, lineHeight: 1.85, color: '#374151' }}>
      {children}
    </div>
  </div>
)

const Item: React.FC<{ no: number; children: React.ReactNode }> = ({ no, children }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
    <span style={{
      flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
      background: C.primary, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, marginTop: 2,
    }}>{no}</span>
    <span>{children}</span>
  </div>
)

const TabContent: React.FC<{ tab: string }> = ({ tab }) => {
  if (tab === 'general') return (
    <>
      <Section title="1. Giới thiệu về BuyZo">
        <p style={{ marginBottom: 12 }}>
          BuyZo là nền tảng thương mại điện tử kết nối người mua, người bán (shop), nhân viên shop và đơn vị vận chuyển (shipper) trên một hệ thống thống nhất. Bằng cách truy cập hoặc sử dụng dịch vụ BuyZo, bạn đồng ý bị ràng buộc bởi các điều khoản và điều kiện này.
        </p>
        <p>
          BuyZo có quyền cập nhật, sửa đổi các điều khoản này bất cứ lúc nào. Phiên bản mới nhất luôn được công bố tại trang này. Việc tiếp tục sử dụng dịch vụ sau khi cập nhật đồng nghĩa với việc bạn chấp nhận điều khoản mới.
        </p>
      </Section>
      <Section title="2. Điều kiện tham gia">
        <Item no={1}>Người dùng phải từ đủ 16 tuổi trở lên để đăng ký tài khoản.</Item>
        <Item no={2}>Mỗi cá nhân chỉ được đăng ký một tài khoản. Nghiêm cấm tạo tài khoản giả mạo hoặc mạo danh người khác.</Item>
        <Item no={3}>Thông tin đăng ký (họ tên, email, số điện thoại) phải trung thực, chính xác và được cập nhật khi thay đổi.</Item>
        <Item no={4}>Bạn có trách nhiệm bảo mật mật khẩu và chịu trách nhiệm với mọi hoạt động diễn ra dưới tài khoản của mình.</Item>
      </Section>
      <Section title="3. Hành vi bị cấm">
        <Item no={1}>Đăng tải nội dung sai lệch, gian lận, lừa đảo hoặc vi phạm pháp luật.</Item>
        <Item no={2}>Sử dụng hệ thống để rửa tiền, tài trợ khủng bố hoặc các hoạt động bất hợp pháp.</Item>
        <Item no={3}>Can thiệp, phá hoại hệ thống kỹ thuật của BuyZo.</Item>
        <Item no={4}>Thu thập thông tin người dùng khác mà không có sự đồng ý.</Item>
        <Item no={5}>Đánh giá giả mạo, thao túng xếp hạng sản phẩm hoặc shop.</Item>
      </Section>
      <Section title="4. Giải quyết tranh chấp">
        <p style={{ marginBottom: 10 }}>
          BuyZo cung cấp hệ thống khiếu nại nội bộ. Khi phát sinh tranh chấp, các bên nên ưu tiên tự giải quyết thông qua hệ thống tin nhắn trong vòng 3 ngày.
        </p>
        <p>
          Nếu không thỏa thuận được, BuyZo Admin sẽ can thiệp và ra quyết định cuối cùng dựa trên bằng chứng cung cấp. Quyết định của BuyZo Admin là quyết định cuối cùng và có hiệu lực ràng buộc với cả hai bên.
        </p>
      </Section>
    </>
  )

  if (tab === 'buyer') return (
    <>
      <Section title="1. Quyền lợi người mua">
        <Item no={1}>Được mua hàng từ các shop đã được BuyZo xét duyệt và kiểm tra.</Item>
        <Item no={2}>Được bảo vệ bởi chính sách hoàn tiền khi hàng không đúng mô tả hoặc không nhận được hàng.</Item>
        <Item no={3}>Được đánh giá sản phẩm và shop sau mỗi đơn hàng hoàn thành.</Item>
        <Item no={4}>Được sử dụng voucher, chương trình khuyến mãi áp dụng trong hệ thống.</Item>
        <Item no={5}>Được hỗ trợ khiếu nại và giải quyết tranh chấp với shop.</Item>
      </Section>
      <Section title="2. Trách nhiệm người mua">
        <Item no={1}>Cung cấp địa chỉ giao hàng chính xác và liên hệ được. BuyZo không chịu trách nhiệm nếu hàng không giao được do thông tin sai.</Item>
        <Item no={2}>Xác nhận đơn hàng đã nhận trong vòng 3 ngày kể từ khi shipper báo đã giao. Sau thời hạn này, đơn hàng tự động hoàn tất.</Item>
        <Item no={3}>Không đặt hàng với mục đích gian lận (đặt rồi từ chối nhận, cố tình báo không nhận khi đã nhận).</Item>
        <Item no={4}>Chỉ được khiếu nại trong vòng 7 ngày kể từ ngày nhận hàng.</Item>
      </Section>
      <Section title="3. Chính sách hoàn tiền">
        <p style={{ marginBottom: 10 }}>
          Hoàn tiền áp dụng trong các trường hợp: hàng không đúng mô tả, hàng bị hỏng khi nhận, đơn hàng không được giao trong thời gian cam kết mà không có lý do chính đáng.
        </p>
        <p>Thời gian hoàn tiền: 5–10 ngày làm việc tùy phương thức thanh toán ban đầu.</p>
      </Section>
    </>
  )

  if (tab === 'seller') return (
    <>
      <Section title="1. Điều kiện mở shop">
        <Item no={1}>Người bán phải đã đăng ký tài khoản BuyZo và hoàn tất xác minh thông tin.</Item>
        <Item no={2}>Đăng ký mở shop phải kèm theo thông tin pháp lý hợp lệ (tên shop, địa chỉ kinh doanh).</Item>
        <Item no={3}>Shop cần được Admin BuyZo duyệt trước khi có thể đăng bán sản phẩm.</Item>
        <Item no={4}>Mỗi tài khoản chỉ được sở hữu tối đa 1 shop.</Item>
      </Section>
      <Section title="2. Quy định đăng sản phẩm">
        <Item no={1}>Sản phẩm phải có mô tả rõ ràng, ảnh thực tế, giá bán hợp lý và thông tin tồn kho chính xác.</Item>
        <Item no={2}>Nghiêm cấm đăng bán hàng giả, hàng kém chất lượng, hàng cấm theo quy định pháp luật.</Item>
        <Item no={3}>Mỗi sản phẩm mới cần được Admin duyệt trước khi hiển thị công khai.</Item>
        <Item no={4}>Giá sản phẩm phải bao gồm thuế VAT (nếu có) và không được thay đổi bất ngờ khi đơn hàng đang xử lý.</Item>
      </Section>
      <Section title="3. Phí nền tảng & Thanh toán">
        <p style={{ marginBottom: 10 }}>
          BuyZo thu phí hoa hồng trên mỗi đơn hàng hoàn thành. Tỷ lệ phí được thông báo riêng và có thể thay đổi theo thông báo trước 15 ngày.
        </p>
        <p style={{ marginBottom: 10 }}>
          Doanh thu từ đơn hàng sẽ được cộng vào ví BuyZo sau khi đơn hàng hoàn tất và qua thời gian khiếu nại. Shop có thể yêu cầu rút tiền về tài khoản ngân hàng.
        </p>
      </Section>
      <Section title="4. Quản lý nhân viên">
        <Item no={1}>Shop có thể tạo tài khoản nhân viên và phân quyền cụ thể (xem đơn hàng, nhắn tin, quản lý sản phẩm).</Item>
        <Item no={2}>Shop chủ chịu hoàn toàn trách nhiệm về hành vi của nhân viên trên hệ thống.</Item>
        <Item no={3}>Khi nhân viên nghỉ việc, shop phải thu hồi quyền truy cập ngay lập tức.</Item>
      </Section>
      <Section title="5. Vi phạm và xử lý">
        <Item no={1}>Vi phạm lần 1: Cảnh cáo + ẩn sản phẩm vi phạm.</Item>
        <Item no={2}>Vi phạm lần 2: Tạm khóa shop 7 ngày.</Item>
        <Item no={3}>Vi phạm nghiêm trọng hoặc lặp lại: Khóa shop vĩnh viễn và không hoàn lại phí đã nộp.</Item>
      </Section>
    </>
  )

  if (tab === 'shipper') return (
    <>
      <Section title="1. Điều kiện đăng ký Shipper">
        <Item no={1}>Shipper phải từ đủ 18 tuổi, có phương tiện vận chuyển hợp lệ và bằng lái xe (nếu cần).</Item>
        <Item no={2}>Cung cấp CMND/CCCD, ảnh chân dung và thông tin phương tiện để hoàn tất đăng ký.</Item>
        <Item no={3}>Hồ sơ cần được Admin BuyZo phê duyệt trước khi nhận đơn.</Item>
      </Section>
      <Section title="2. Trách nhiệm giao hàng">
        <Item no={1}>Giao hàng đúng địa chỉ, đúng thời gian cam kết, đảm bảo hàng hóa nguyên vẹn khi giao.</Item>
        <Item no={2}>Xác nhận trạng thái đơn hàng (lấy hàng, đang giao, đã giao) qua hệ thống ngay sau mỗi bước.</Item>
        <Item no={3}>Khi giao thất bại, phải ghi rõ lý do và liên hệ BuyZo trong 24 giờ để xử lý.</Item>
        <Item no={4}>Không được mở gói hàng, kiểm tra nội dung hoặc thay đổi thông tin đơn hàng khi chưa được phép.</Item>
      </Section>
      <Section title="3. Thu nhập & Thanh toán">
        <p style={{ marginBottom: 10 }}>
          Phí giao hàng được tính theo khoảng cách và loại hàng, theo biểu giá BuyZo. Shipper nhận được phần phí shipper theo tỷ lệ đã thỏa thuận.
        </p>
        <p>Thu nhập được cộng vào ví sau khi đơn hàng hoàn tất, có thể rút về tài khoản ngân hàng định kỳ.</p>
      </Section>
      <Section title="4. Đánh giá & Hiệu suất">
        <Item no={1}>Rating shipper được tính trung bình từ đánh giá của người mua sau mỗi đơn hàng.</Item>
        <Item no={2}>Shipper có rating dưới 3.0 sao trong 30 ngày liên tiếp sẽ bị tạm ngừng hoạt động để cải thiện.</Item>
        <Item no={3}>Tỷ lệ giao thành công cần duy trì trên 90% để giữ trạng thái hoạt động bình thường.</Item>
      </Section>
    </>
  )

  if (tab === 'privacy') return (
    <>
      <Section title="1. Dữ liệu chúng tôi thu thập">
        <Item no={1}><strong>Thông tin tài khoản:</strong> họ tên, email, số điện thoại, địa chỉ — để cung cấp dịch vụ cốt lõi.</Item>
        <Item no={2}><strong>Dữ liệu hành vi:</strong> sản phẩm đã xem, tìm kiếm, lịch sử mua hàng — chỉ thu thập khi bạn đồng ý tại đăng ký, để cá nhân hóa gợi ý sản phẩm.</Item>
        <Item no={3}><strong>Dữ liệu thiết bị:</strong> loại trình duyệt, địa chỉ IP — để bảo mật tài khoản và phân tích lỗi hệ thống.</Item>
        <Item no={4}><strong>Nội dung giao tiếp:</strong> tin nhắn giữa người mua và shop được lưu để hỗ trợ giải quyết tranh chấp.</Item>
      </Section>
      <Section title="2. Mục đích sử dụng dữ liệu">
        <Item no={1}>Vận hành dịch vụ: xử lý đơn hàng, thanh toán, giao hàng.</Item>
        <Item no={2}>Cá nhân hóa trải nghiệm: gợi ý sản phẩm phù hợp sở thích (chỉ khi đã đồng ý).</Item>
        <Item no={3}>Bảo mật: phát hiện và ngăn chặn gian lận, truy cập trái phép.</Item>
        <Item no={4}>Cải thiện dịch vụ: phân tích ẩn danh để tối ưu trải nghiệm người dùng.</Item>
      </Section>
      <Section title="3. Quyền của bạn">
        <Item no={1}><strong>Truy cập:</strong> yêu cầu xem dữ liệu cá nhân BuyZo đang lưu về bạn.</Item>
        <Item no={2}><strong>Chỉnh sửa:</strong> cập nhật thông tin cá nhân bất kỳ lúc nào trong phần Hồ sơ.</Item>
        <Item no={3}><strong>Xóa:</strong> yêu cầu xóa tài khoản và toàn bộ dữ liệu cá nhân (trừ dữ liệu bắt buộc lưu theo pháp luật).</Item>
        <Item no={4}><strong>Rút đồng ý:</strong> hủy đồng ý thu thập dữ liệu hành vi bất kỳ lúc nào; việc này không ảnh hưởng đến dịch vụ cốt lõi.</Item>
      </Section>
      <Section title="4. Bảo mật dữ liệu">
        <p style={{ marginBottom: 10 }}>
          Dữ liệu được mã hóa khi truyền tải (HTTPS/TLS) và khi lưu trữ. Mật khẩu được hash bằng bcrypt và không bao giờ được lưu dưới dạng văn bản thuần.
        </p>
        <p>
          BuyZo không bán dữ liệu cá nhân của bạn cho bên thứ ba. Dữ liệu chỉ được chia sẻ với các đối tác vận hành dịch vụ (thanh toán, vận chuyển) và chỉ ở mức tối thiểu cần thiết.
        </p>
      </Section>
      <Section title="5. Cookie & Tracking">
        <p>BuyZo sử dụng cookie thiết yếu để duy trì phiên đăng nhập. Chúng tôi không sử dụng cookie quảng cáo bên thứ ba hay theo dõi hành vi ngoài nền tảng BuyZo.</p>
      </Section>
    </>
  )

  return null
}

const PoliciesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general')

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📜</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.navy, marginBottom: 8 }}>
            Chính sách & Điều khoản BuyZo
          </h1>
          <p style={{ color: C.gray, fontSize: 14 }}>
            Cập nhật lần cuối: tháng 7 năm 2025 · Hiệu lực với tất cả thành viên tham gia hệ thống
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28, alignItems: 'start' }}>

          {/* Sidebar tabs */}
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
            padding: 8, position: 'sticky', top: 80,
          }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', borderRadius: 9, border: 'none',
                  background: activeTab === t.key ? '#EFF6FF' : 'transparent',
                  color: activeTab === t.key ? C.primary : C.gray,
                  fontWeight: activeTab === t.key ? 700 : 500,
                  fontSize: 13, cursor: 'pointer', marginBottom: 2,
                  borderLeft: activeTab === t.key ? `3px solid ${C.primary}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{
            background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '28px 32px',
          }}>
            <TabContent tab={activeTab} />

            {/* Agreement note */}
            <div style={{
              marginTop: 24, padding: '14px 18px',
              background: '#F0FDF4', borderRadius: 10,
              border: '1px solid #BBF7D0', fontSize: 13, color: '#15803D',
            }}>
              ✅ Khi tạo tài khoản BuyZo, bạn đã đọc, hiểu và đồng ý với toàn bộ các điều khoản trên.
              Mọi thắc mắc vui lòng liên hệ <strong>support@buyzo.com</strong>.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link to="/" style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>
            ← Quay về Trang chủ
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PoliciesPage
