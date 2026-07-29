# Chương 3 — Kiến trúc tổng thể

## 3.1. Kiến trúc tổng thể

**Các đối tượng tham gia khai thác:**

- **Người mua (User):** Người truy cập nền tảng để tìm kiếm sản phẩm, đặt hàng, theo dõi đơn hàng và tương tác với shop.
- **Chủ shop (Shop):** Đối tác bán hàng trên sàn, có thể quản lý sản phẩm, đơn hàng, voucher, nhân viên và xem thống kê doanh thu của cửa hàng.
- **Nhân viên shop (Employee):** Được chủ shop phân quyền để hỗ trợ xử lý đơn hàng, quản lý sản phẩm và trả lời tin nhắn khách hàng.
- **Người giao hàng (Shipper):** Nhận và thực hiện giao đơn hàng đến tay khách, cập nhật trạng thái giao hàng realtime.
- **Quản lý kho (Warehouse Manager):** Gồm 3 cấp — kho tổng, kho quận, kho phường — phụ trách phân loại, phân phối và điều phối vận đơn trong hệ thống logistics.
- **Quản trị viên (Admin / Superadmin):** Quản lý toàn bộ hệ thống bao gồm người dùng, cửa hàng, sản phẩm, đơn hàng, khiếu nại và các cấu hình vận hành.

**Các module chức năng:**

- **Quản lý Tài khoản & Xác thực:** Xử lý đăng ký, đăng nhập, đăng xuất và bảo mật phiên thông qua JWT.
- **Quản lý Cửa hàng:** Đăng ký mở shop, duyệt shop, quản lý thông tin và chương trình BuyZo Mall.
- **Quản lý Sản phẩm:** Đăng bán, cập nhật, kiểm duyệt sản phẩm và quản lý biến thể tồn kho.
- **Quản lý Đơn hàng:** Xử lý toàn bộ vòng đời đơn hàng từ đặt hàng đến giao thành công.
- **Quản lý Thanh toán:** Xử lý giao dịch, ví nội bộ shop, hoàn tiền và rút tiền.
- **Quản lý Vận chuyển:** Điều phối luồng hàng hóa qua hệ thống kho 3 cấp đến tay người mua.
- **Quản lý Voucher & Flash Sale:** Tạo và quản lý chương trình giảm giá, sự kiện bán hàng nhanh.
- **Chat & Thông báo Realtime:** Nhắn tin trực tiếp giữa người mua và shop, gửi thông báo sự kiện tức thời.
- **Quản lý Khiếu nại & Tranh chấp:** Tiếp nhận và xử lý phản ánh từ người mua, phán quyết tranh chấp ba bên.
- **Quản lý Nhân viên Shop:** Phân quyền và quản lý tài khoản nhân viên của cửa hàng.
- **Thống kê & Báo cáo:** Phân tích doanh thu, đơn hàng, người dùng và xuất báo cáo tài chính.
- **Quản lý Danh mục:** Quản lý hệ thống danh mục sản phẩm phân cấp cha - con.
- **Quảng cáo & Đấu thầu Banner:** Tạo chiến dịch quảng cáo và đấu thầu vị trí hiển thị banner trên trang chủ.

**Cơ sở dữ liệu:**

- Thông tin người dùng (người mua, chủ shop, nhân viên, shipper, quản lý kho, admin)
- Thông tin cửa hàng, sản phẩm, biến thể, danh mục
- Thông tin đơn hàng, thanh toán, vận đơn, lô hàng
- Dữ liệu voucher, flash sale, chiến dịch quảng cáo
- Dữ liệu đánh giá, tin nhắn, thông báo, khiếu nại

---

## 3.1.1. Module Quản lý Tài khoản & Xác thực

**Công dụng:** Quản lý toàn bộ vòng đời tài khoản người dùng, bao gồm đăng ký, đăng nhập, đăng xuất, cập nhật thông tin cá nhân và đổi mật khẩu. Xác thực danh tính thông qua JWT (JSON Web Token) gồm Access Token (ngắn hạn) và Refresh Token (tự động gia hạn phiên).

**Dữ liệu vào:** Họ tên, email, số điện thoại, mật khẩu, ảnh đại diện, địa chỉ.

**Dữ liệu ra:** Thông tin tài khoản, Access Token, Refresh Token, vai trò người dùng (role).

**User sử dụng:** Người mua, Chủ shop, Nhân viên shop, Shipper, Quản lý kho, Admin, Superadmin.

---

## 3.1.2. Module Quản lý Cửa hàng (Shop)

**Công dụng:** Cho phép người dùng đăng ký mở cửa hàng trên nền tảng và quản lý toàn bộ thông tin cửa hàng. Admin duyệt hoặc từ chối đơn mở shop. Hỗ trợ chương trình BuyZo Mall dành cho shop đạt tiêu chuẩn chất lượng cao.

**Dữ liệu vào:** Tên shop, danh mục kinh doanh, địa chỉ, logo, số điện thoại, mô tả, giấy phép kinh doanh (đối với Mall).

**Dữ liệu ra:** Thông tin cửa hàng, trạng thái hoạt động, nhãn BuyZo Mall (nếu được duyệt).

**User sử dụng:** Người mua (đăng ký mở shop), Chủ shop, Admin.

---

## 3.1.3. Module Quản lý Sản phẩm

**Công dụng:** Cho phép chủ shop và nhân viên đăng bán, cập nhật và quản lý sản phẩm. Mỗi sản phẩm có thể có nhiều biến thể (màu sắc, kích cỡ). Admin kiểm duyệt sản phẩm trước khi hiển thị trên sàn, có hỗ trợ kiểm tra tự động kết hợp kiểm tra thủ công.

**Dữ liệu vào:** Tên sản phẩm, mô tả, hình ảnh, danh mục, giá, số lượng tồn kho, thuộc tính biến thể.

**Dữ liệu ra:** Danh sách sản phẩm, thông tin chi tiết sản phẩm, trạng thái duyệt.

**User sử dụng:** Chủ shop, Nhân viên shop, Admin.

---

## 3.1.4. Module Quản lý Đơn hàng

**Công dụng:** Xử lý toàn bộ vòng đời đơn hàng từ lúc người mua đặt hàng đến khi giao thành công. Shop xác nhận và chuẩn bị hàng, shipper nhận và giao hàng, người mua xác nhận đã nhận. Hỗ trợ hủy đơn, hoàn đơn và theo dõi trạng thái realtime.

**Dữ liệu vào:** Thông tin sản phẩm, số lượng, địa chỉ giao hàng, phương thức thanh toán, mã voucher, ghi chú.

**Dữ liệu ra:** Thông tin đơn hàng, mã vận đơn, trạng thái từng bước, thông báo cho các bên liên quan.

**User sử dụng:** Người mua, Chủ shop, Nhân viên shop, Shipper, Admin.

---

## 3.1.5. Module Quản lý Thanh toán

**Công dụng:** Xử lý các giao dịch thanh toán đơn hàng qua nhiều phương thức. Quản lý ví nội bộ của shop, lịch sử giao dịch, yêu cầu rút tiền và hoàn tiền khi đơn hàng bị hủy hoặc khiếu nại thành công.

**Dữ liệu vào:** Thông tin đơn hàng, phương thức thanh toán (COD / chuyển khoản / ví điện tử), số tiền, thông tin tài khoản ngân hàng.

**Dữ liệu ra:** Trạng thái thanh toán, mã giao dịch, số dư ví shop, lịch sử giao dịch.

**User sử dụng:** Người mua, Chủ shop, Admin.

---

## 3.1.6. Module Quản lý Vận chuyển

**Công dụng:** Quản lý toàn bộ luồng vận chuyển theo mô hình kho 3 cấp: kho tổng → kho quận → kho phường → shipper → khách hàng. Kho tổng phân loại và gộp lô hàng, kho quận phân phối xuống kho phường, kho phường phân công shipper giao hàng. Shipper nhận đơn, cập nhật trạng thái giao hàng realtime.

**Dữ liệu vào:** Vận đơn, thông tin lô hàng, xác nhận bàn giao, ảnh xác nhận giao hàng, lý do giao thất bại.

**Dữ liệu ra:** Trạng thái vận đơn, thông tin shipper, lịch sử vận chuyển, thông báo cho khách hàng.

**User sử dụng:** Quản lý kho tổng, Quản lý kho quận, Quản lý kho phường, Shipper, Admin.

---

## 3.1.7. Module Quản lý Voucher & Flash Sale

**Công dụng:** Cho phép chủ shop tạo và quản lý voucher giảm giá. Người mua có thể thu thập voucher tại trung tâm voucher và áp dụng khi thanh toán. Flash sale cho phép shop đăng ký sản phẩm bán với giá ưu đãi trong khung giờ nhất định, cần Admin duyệt trước khi kích hoạt.

**Dữ liệu vào:** Loại giảm giá, mức giảm, điều kiện đơn tối thiểu, số lượng, thời hạn, sản phẩm tham gia flash sale, giá sale.

**Dữ liệu ra:** Danh sách voucher, trạng thái voucher, thông tin flash sale, đồng hồ đếm ngược.

**User sử dụng:** Chủ shop, Người mua, Admin.

---

## 3.1.8. Module Chat & Thông báo Realtime

**Công dụng:** Cung cấp kênh nhắn tin trực tiếp giữa người mua và shop (hoặc nhân viên shop). Hệ thống gửi thông báo realtime cho các sự kiện quan trọng như xác nhận đơn hàng, cập nhật trạng thái giao hàng, phản hồi khiếu nại. Sử dụng Socket.io để đảm bảo kết nối hai chiều tức thời.

**Dữ liệu vào:** Nội dung tin nhắn (văn bản / hình ảnh), loại sự kiện kích hoạt thông báo.

**Dữ liệu ra:** Tin nhắn realtime, thông báo đẩy, số lượng tin chưa đọc.

**User sử dụng:** Người mua, Chủ shop, Nhân viên shop, Shipper.

---

## 3.1.9. Module Quản lý Khiếu nại & Tranh chấp

**Công dụng:** Cho phép người mua gửi khiếu nại khi có vấn đề với đơn hàng như hàng sai mô tả, không nhận được hàng hoặc hàng lỗi. Shop có thể chấp nhận giải quyết trực tiếp. Nếu không đạt được thỏa thuận, Admin đứng ra xử lý tranh chấp ba bên và đưa ra phán quyết.

**Dữ liệu vào:** Loại khiếu nại, lý do chi tiết, bằng chứng (ảnh / video), quyết định của Shop / Admin.

**Dữ liệu ra:** Trạng thái khiếu nại, kết quả xử lý, thông báo hoàn tiền hoặc bồi thường.

**User sử dụng:** Người mua, Chủ shop, Admin.

---

## 3.1.10. Module Quản lý Nhân viên Shop

**Công dụng:** Cho phép chủ shop tạo tài khoản nhân viên và phân quyền xử lý một số công việc như quản lý đơn hàng, quản lý sản phẩm và trả lời tin nhắn khách hàng thay cho chủ shop.

**Dữ liệu vào:** Thông tin tài khoản nhân viên, quyền được phân công.

**Dữ liệu ra:** Tài khoản nhân viên, danh sách quyền hạn, log hoạt động.

**User sử dụng:** Chủ shop, Nhân viên shop.

---

## 3.1.11. Module Thống kê & Báo cáo

**Công dụng:** Cung cấp dữ liệu phân tích cho chủ shop và Admin. Chủ shop xem doanh thu, top sản phẩm bán chạy, tỷ lệ chuyển đổi theo khoảng thời gian tùy chọn. Admin xem báo cáo toàn hệ thống gồm người dùng, sản phẩm, đơn hàng, doanh thu và có thể xuất báo cáo tài chính.

**Dữ liệu vào:** Khoảng thời gian, loại báo cáo cần xem hoặc xuất.

**Dữ liệu ra:** Biểu đồ doanh thu, danh sách giao dịch, báo cáo xuất file.

**User sử dụng:** Chủ shop, Admin, Superadmin.

---

## 3.1.12. Module Quản lý Danh mục

**Công dụng:** Quản lý hệ thống danh mục sản phẩm theo cấu trúc phân cấp cha - con. Admin tạo, sửa và xóa danh mục. Danh mục được dùng để phân loại sản phẩm và lọc kết quả tìm kiếm.

**Dữ liệu vào:** Tên danh mục, danh mục cha, hình ảnh đại diện.

**Dữ liệu ra:** Cây danh mục, danh sách sản phẩm theo danh mục.

**User sử dụng:** Admin, Người mua (duyệt danh mục).

---

## 3.1.13. Module Quảng cáo & Đấu thầu Banner

**Công dụng:** Cho phép shop tạo chiến dịch quảng cáo và tham gia đấu thầu vị trí hiển thị banner trên trang chủ. Shop nạp tiền vào tài khoản quảng cáo, thiết lập ngân sách, từ khóa và gửi duyệt. Admin phê duyệt và quản lý các phiên đấu thầu.

**Dữ liệu vào:** Thông tin chiến dịch, sản phẩm quảng cáo, ngân sách, từ khóa, mức giá đấu thầu.

**Dữ liệu ra:** Trạng thái chiến dịch, vị trí hiển thị banner, báo cáo hiệu quả quảng cáo.

**User sử dụng:** Chủ shop, Admin.
