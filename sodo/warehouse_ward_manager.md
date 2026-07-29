# Quy trình: Quản lý Kho Phường (Cấp 3)

## Tóm tắt
Nhận đơn từ kho quận, phân công cho shipper đi giao đến tay khách hàng. Nếu giao thất bại thì phân công giao lại.

## Mô tả
Quản lý kho phường đăng nhập vào hệ thống và truy cập trang tổng quan kho phường, hệ thống hiển thị số vận đơn cần giao trong ngày, số shipper và tỷ lệ giao hàng thành công. Nếu quản lý muốn quản lý shipper thì hệ thống hiển thị danh sách shipper theo trạng thái đang hoạt động, nghỉ và số đơn đang giao. Nếu muốn phân công đơn thì chọn shipper và vận đơn cần phân công, hệ thống gán đơn hàng và thông báo cho shipper, còn nếu không thì xem thông tin shipper. Nếu quản lý muốn xem đơn hàng tại kho thì hệ thống hiển thị danh sách theo trạng thái chờ lấy, đang giao, thành công và thất bại. Nếu có đơn giao thất bại thì xem lý do, phân công giao lại cho shipper, hệ thống cập nhật trạng thái "Giao lại" và thông báo cho shipper cùng khách hàng, còn nếu không có đơn thất bại thì tiếp tục theo dõi. Trường hợp không thực hiện thao tác nào thì ở lại trang tổng quan và kết thúc.

## Sơ đồ

```plantuml
@startuml
skinparam shadowing false

start
:Quản lý kho phường đăng nhập vào hệ thống;
:Truy cập Dashboard kho phường;
:Hệ thống hiển thị tổng quan\n(số vận đơn cần giao hôm nay, số shipper, tỷ lệ giao thành công);

:Quản lý chọn chức năng cần thực hiện;

if (Quản lý người giao hàng?) then (đúng)
  :Hệ thống hiển thị danh sách người giao hàng\n(đang hoạt động / nghỉ / số đơn đang giao);
  if (Phân công đơn cho người giao hàng?) then (đúng)
    :Chọn người giao hàng và vận đơn cần phân công;
    :Hệ thống gán đơn hàng cho người giao hàng;
    :Thông báo cho người giao hàng;
  else (sai)
    :Xem thông tin người giao hàng;
  endif
else (sai)
  :Quản lý chọn chức năng khác;
  if (Quản lý đơn hàng tại kho phường?) then (đúng)
    :Hệ thống hiển thị danh sách đơn hàng\n(chờ lấy / đang giao / thành công / thất bại);
    :Quản lý xem trạng thái từng đơn;
    if (Có đơn giao thất bại?) then (đúng)
      :Xem lý do thất bại;
      :Phân công giao lại cho người giao hàng;
      :Hệ thống cập nhật trạng thái "Giao lại";
      :Thông báo cho người giao hàng và khách hàng;
    else (sai)
      :Tiếp tục theo dõi đơn hàng;
    endif
  else (sai)
    :Ở lại Dashboard xem tổng quan;
  endif
endif

stop
@enduml
```
