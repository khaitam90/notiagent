# Tạo ảnh/video ngay trong khung chat Claude

> **Cách chính (khuyên dùng): khung chat Code.** Claude Code chạy lệnh `docker exec -i notiagent-local-api-1 python -m app.studio_cli ...` (xem mục "Quy trình tạo ảnh/video A–Z" trong `CLAUDE.md`), không cần cài gì vào Claude Desktop. Chat thường không gọi được agent/lệnh nên phần MCP bên dưới chỉ là lựa chọn phụ cho thẻ Chat/Cowork.

NotiAgent có sẵn một MCP server (`api/app/mcp_server.py`) chạy **trong container API** nên máy không cần cài thêm gì ngoài Docker.
Claude Desktop (Chat/Cowork) gọi nó qua `docker exec -i notiagent-local-api-1 python -m app.mcp_server`.

## Công cụ Claude có trong chat
| Công cụ | Việc |
|---|---|
| `notiagent_status` | Kiểm tra khóa API, model + giá, thư mục inbox |
| `estimate_cost` | Ước tính credit/USD trước khi tạo (video theo giây, ảnh theo megapixel) |
| `list_inbox`, `import_reference_from_url` | Ảnh tham chiếu: thả vào `NotiAgentData\inbox` hoặc gửi link |
| `create_image` | Ảnh/Character Sheet (FLUX.2 qua Together.ai), trả ảnh xem ngay trong chat |
| `create_video` | Video Seedance 2.0/2.5 hoặc MiniMax H3 qua Together.ai (âm thanh mô tả trong prompt) |
| `get_video` | Theo dõi tiến độ; khi xong trả thông số + lưới 6 khung hình để QC bằng mắt |
| `qc_video` | QC lại một video đã có |

## An toàn chi phí
Mọi công cụ tốn tiền **bắt buộc** có `approved_cost_usd` ≥ ước tính (người dùng đã đồng ý trong chat). Thiếu thì chỉ trả bảng ước tính, **không gọi nhà cung cấp**.
`test_mode=true` dùng bản mẫu miễn phí. Có unit test chứng minh (`api/tests/test_mcp_server.py`).

## Đăng ký vào Claude Desktop (làm 1 lần trên mỗi máy)
1. Mở NotiAgent (`docker compose up -d`), kiểm tra `http://127.0.0.1:8780/health`.
2. Claude Desktop → Settings → Developer → **Edit Config**, thêm vào `mcpServers`:
```json
"notiagent": {
  "command": "docker",
  "args": ["exec", "-i", "notiagent-local-api-1", "python", "-m", "app.mcp_server"]
}
```
3. Thoát hẳn Claude Desktop (khay hệ thống → Quit) rồi mở lại. Trong chat sẽ thấy công cụ `notiagent`.
4. Skill `dao-dien-ai-2` (đã ở tài khoản Claude) tự dùng các công cụ này sau khi bạn nói "Đã duyệt bảng".

## Giới hạn đã biết
- Chat không phát được file mp4: Claude trả đường dẫn file + link xem `http://127.0.0.1:8080/api-proxy/api/media/<file>` và lưới khung hình.
- Claude **không nghe được** âm thanh: chỉ báo thông số (có/không, độ to).
- Ảnh tham chiếu phải nằm trong inbox hoặc gửi link (Claude không đọc file đính kèm thành dữ liệu để gửi qua công cụ).
- Model/giá: chỉ các model đã có bảng giá xác thực trong `mcp_server.py`.
