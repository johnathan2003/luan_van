# Quy trình: Quản lý Kho Tổng (Cấp 1)

## Tóm tắt
Nhận hàng từ tất cả các shop, phân loại rồi gom thành lô hàng theo khu vực, chuyển xuống kho quận.

## Mô tả
Quản lý kho tổng đăng nhập vào hệ thống và truy cập trang tổng quan kho tổng, hệ thống hiển thị số vận đơn đang xử lý và số kho quận trực thuộc. Nếu quản lý muốn xem vận đơn tại kho tổng thì hệ thống hiển thị danh sách vận đơn theo trạng thái đang chờ, đang phân loại hoặc đã chuyển. Nếu muốn phân loại và gộp các vận đơn cùng khu vực thành một lô thì chọn nhóm vận đơn, tạo lô hàng giao xuống kho quận, hệ thống cập nhật trạng thái lô hàng và thông báo cho quản lý kho quận, còn nếu không thì xem chi tiết vận đơn. Nếu quản lý muốn xem danh sách kho quận trực thuộc thì hệ thống hiển thị tên, người quản lý và số vận đơn đang xử lý tại từng kho quận. Trường hợp không thực hiện thao tác nào thì ở lại trang tổng quan và kết thúc.

## Sơ đồ

```plantuml
@startuml
skinparam shadowing false

start
:Quản lý kho tổng đăng nhập vào hệ thống;
:Truy cập Dashboard kho tổng;
:Hệ thống hiển thị tổng quan\n(số vận đơn đang xử lý, số kho quận trực thuộc);

:Quản lý chọn chức năng cần thực hiện;

if (Xem vận đơn tại kho tổng?) then (đúng)
  :Hệ thống hiển thị danh sách vận đơn\n(đang chờ / đang phân loại / đã chuyển);
  if (Phân loại và gộp vận đơn thành lô hàng?) then (đúng)
    :Chọn nhóm vận đơn cùng khu vực;
    :Tạo lô hàng giao xuống kho quận;
    :Hệ thống cập nhật trạng thái lô hàng;
    :Thông báo cho quản lý kho quận;
  else (sai)
    :Xem chi tiết vận đơn;
  endif
else (sai)
  :Quản lý chọn chức năng khác;
  if (Quản lý kho quận trực thuộc?) then (đúng)
    :Hệ thống hiển thị danh sách kho quận\n(tên, quản lý, số vận đơn đang xử lý);
    :Quản lý xem chi tiết từng kho quận;
  else (sai)
    :Quản lý chọn xem lô hàng;
    if (Xem danh sách lô hàng?) then (đúng)
      :Hệ thống hiển thị lô hàng đã gộp\n(trạng thái, đích đến, số lượng đơn);
    else (sai)
      :Ở lại Dashboard xem tổng quan;
    endif
  endif
endif

stop
@enduml
```
