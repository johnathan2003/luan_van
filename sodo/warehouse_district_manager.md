# Quy trình: Quản lý Kho Quận (Cấp 2)

## Tóm tắt
Nhận lô hàng từ kho tổng, chia nhỏ ra và phân phối xuống từng kho phường phụ trách.

## Mô tả
Quản lý kho quận đăng nhập vào hệ thống và truy cập trang tổng quan kho quận, hệ thống hiển thị số vận đơn đang chờ phân phối, số kho phường và số shipper đang hoạt động. Nếu quản lý muốn xem và phân phối vận đơn thì hệ thống hiển thị danh sách vận đơn nhận từ kho tổng đang chờ phân phối xuống kho phường. Nếu muốn phân phối thì chọn vận đơn và chỉ định kho phường phụ trách, hệ thống cập nhật trạng thái vận đơn và thông báo cho quản lý kho phường, còn nếu không thì xem chi tiết vận đơn. Nếu quản lý muốn xem danh sách kho phường trực thuộc thì hệ thống hiển thị tên, người quản lý và số đơn đang xử lý tại từng kho phường. Trường hợp không thực hiện thao tác nào thì ở lại trang tổng quan và kết thúc.

## Sơ đồ

```plantuml
@startuml
skinparam shadowing false

start
:Quản lý kho quận đăng nhập vào hệ thống;
:Truy cập Dashboard kho quận;
:Hệ thống hiển thị tổng quan\n(số vận đơn chờ phân phối, số kho phường, số shipper);

:Quản lý chọn chức năng cần thực hiện;

if (Xem và phân phối vận đơn?) then (đúng)
  :Hệ thống hiển thị vận đơn nhận từ kho tổng\n(đang chờ phân phối xuống kho phường);
  if (Phân phối xuống kho phường?) then (đúng)
    :Chọn vận đơn và chỉ định kho phường phụ trách;
    :Hệ thống cập nhật trạng thái vận đơn;
    :Thông báo cho quản lý kho phường;
  else (sai)
    :Xem chi tiết vận đơn;
  endif
else (sai)
  :Quản lý chọn chức năng khác;
  if (Quản lý kho phường trực thuộc?) then (đúng)
    :Hệ thống hiển thị danh sách kho phường\n(tên, quản lý, số đơn đang xử lý);
    :Quản lý xem chi tiết kho phường;
  else (sai)
    :Ở lại Dashboard xem tổng quan;
  endif
endif

stop
@enduml
```
