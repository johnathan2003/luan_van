"""
ĐÃ CHUYỂN — file này không còn được dùng.

Chatbot đã tách thành service riêng nằm ở `../chatbot` (ngang hàng với
`backend/`), chạy độc lập ở port 8002, để sau này thiết bị IoT (ESP32-S3,
mic + loa) có thể gọi thẳng vào đó mà không phải đi qua backend thương mại
điện tử chính. Xem:
  - ../chatbot/main.py          (FastAPI app + route /api/v1/bot/query, /clear)
  - ../chatbot/bot_service.py   (logic gọi Gemini — trước đây là bot_service.py ở đây)
  - ../chatbot/bot_tools.py     (tool DB queries — trước đây là bot_tools.py ở đây)
  - ../docker-compose.yml       (service "chatbot")

File này được giữ lại (rỗng, không có route nào) chỉ vì môi trường sandbox
lúc thực hiện việc tách không xoá được file vật lý — bạn có thể tự xoá file
này trên máy mình, không ảnh hưởng gì tới hệ thống.

`app/main.py` đã KHÔNG còn import hay include_router file này nữa.
"""
