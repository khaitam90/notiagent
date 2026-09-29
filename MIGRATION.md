# Chuyển NotiAgent sang máy khác

Tất cả nằm trong Git, riêng **dữ liệu chạy** (ảnh/video, database, n8n) và **khóa API** thì không.

- **Máy cũ:** `powershell -ExecutionPolicy Bypass -File scripts\export-data.ps1` → tạo `D:\NotiAgentTransfer`
  (zip dữ liệu + `NotiAgent-secrets.env` + `setup-new-pc.ps1` + `HUONG-DAN.txt`). Tạm dừng container vài giây để database nhất quán.
- **Máy mới:** chép thư mục đó sang, chạy `setup-new-pc.ps1 -TransferDir <thư mục>`. Script tự cài Git + Docker Desktop
  (winget), clone repo, nạp dữ liệu (không ghi đè nếu thư mục dữ liệu đã có nội dung), sửa `.env` cho đúng đường dẫn, `docker compose up -d --build`, kiểm tra API/Web/n8n.
- Ứng dụng tự dựng trong Docker nên máy mới **không cần** Node/Python.
- `NotiAgent-secrets.env` chứa khóa thật: chỉ chuyển qua USB/mạng nội bộ, không đưa lên GitHub/cloud, xóa sau khi dùng.
- Đã kiểm chứng 2026-09-30 bằng cách chạy chính script trên máy cũ vào thư mục + cổng riêng (`-ProjectDir/-DataRoot/-WebPort/-ApiPort/-N8nPort/-ComposeProject`):
  3 workflow, 7 run, 20 file khớp, video 9.017.602 byte tải đúng qua web, khóa API đã nạp.
- Nếu Docker Desktop kẹt socket sau khi máy tắt đột ngột: `scripts\fix-docker-stale-sockets.ps1`.
