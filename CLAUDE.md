# NotiAgent - hướng dẫn cho Claude Code

## Cách làm việc với chủ dự án

- Người dùng không rành kỹ thuật/lập trình. Không hỏi ý kiến về lựa chọn kỹ thuật (kiến trúc, thư viện, cách implement...) — tự quyết định phương án hợp lý nhất rồi làm luôn.
- Chỉ hỏi lại khi việc đó THẬT SỰ cần người dùng quyết định: tốn tiền thật (gọi provider trả phí), hành động phá huỷ/khó hoàn tác, hoặc chưa rõ người dùng MUỐN kết quả gì (không phải hỏi cách làm ra sao). Hỏi bằng câu chuyện hậu quả thực tế, không dùng thuật ngữ kỹ thuật.
- Báo cáo trong chat: ngắn gọn, tập trung KẾT QUẢ (đã sửa được gì, còn thiếu gì, người dùng cần làm gì tiếp — nếu có), không kể lể quá trình đã đọc/đã thử gì. Phần chi tiết kỹ thuật đầy đủ (đã làm, file thay đổi, lệnh kiểm tra...) vẫn ghi vào `HANDOFF-CLAUDE-CODE.md` như "Báo cáo bắt buộc" bên dưới — đó là tài liệu cho các phiên Claude Code sau đọc, không phải để dán nguyên vào chat.

## Kỷ luật (áp dụng cả khi làm trên máy khác)

- Khảo sát thật trước khi làm, không giả định; không nhận "xong" khi chưa kiểm tra lại thật (chạy test, xem log, thử UI/API). Gặp lỗi thì báo trung thực, tìm gốc rễ, không lặp lại cách cũ mù quáng.
- **Không sửa/xoá/thay đổi bất cứ thứ gì không phải do chính mình tạo ra trong phiên** (file/thư mục/cấu hình hệ thống/cache/dữ liệu sẵn có của máy hoặc của ứng dụng khác) nếu việc đó KHÔNG nằm trong phạm vi được giao rõ ràng — kể cả "dọn dẹp cho gọn". Trong phạm vi dự án này thì tự quyết định thoải mái. Nghi ngờ có ngoài phạm vi không thì coi là CÓ và hỏi trước. Nếu buộc phải sửa file có sẵn ngoài phạm vi để hoàn thành việc được yêu cầu: backup trước và báo rõ đã đụng vào gì.
- Sao lưu hoặc dùng Git trước khi sửa thứ quan trọng; không xoá/ghi đè khi chưa chắc.
- Không bao giờ in/sao chép khóa API vào chat, log, tài liệu hay commit.

## Đọc trước khi sửa

1. Đọc `README.md` và `HANDOFF-CLAUDE-CODE.md`.
2. Chạy `git status --short --branch`; repository hiện chưa có commit đầu tiên.
3. Không đọc, in hoặc sao chép giá trị trong `.env` vào chat, log, tài liệu hay commit.
4. Phân biệt rõ `HISTORICAL`, `PLANNED`, `RUNNING`, `VERIFIED`, `BLOCKED`.

## Sự thật hiện tại

- VPS `vps-noti` đã hết hạn. Không SSH, deploy hoặc dựa vào đường dẫn/IP/container VPS cũ.
- Source chạy thật nằm tại `D:\Projects\NotiAgent`; dữ liệu runtime tại `D:\NotiAgentData`.
- NotiAgent phục vụ cá nhân, không thương mại. AI chạy qua API/MCP; không chạy model nặng trên laptop.
- Stack tối thiểu: React/Vite + FastAPI/SQLite + n8n, chạy bằng Docker Compose.
- CrazyRouter/Kling 2.5 Turbo đã tạo thành công một video thật qua API. UI end-to-end vẫn cần kiểm chứng.

Nếu đang đọc từ gói ZIP trên máy khác, thư mục `SOURCE-NOTIAGENT` chính là snapshot source sạch. Giải nén/copy nó đến một thư mục làm việc ngoài OneDrive rồi chạy các lệnh bên dưới; không giả định ổ `D:` tồn tại trên máy khác.

## Quy tắc phạm vi

- Ưu tiên hoàn thiện một workflow video cá nhân trước khi thêm Dify, Redis, multi-tenant hoặc billing.
- Không thay framework, database, API contract hoặc dependency lớn nếu chưa có nhu cầu đã kiểm chứng.
- Không gọi provider trả phí nếu chưa hiển thị chi phí ước tính và nhận xác nhận rõ của người dùng.
- Không thêm secret vào frontend. `.env.example` chỉ chứa tên biến và giá trị trống.
- Không đưa `node_modules`, `dist`, `.venv`, database, n8n data hoặc media vào Git.

## Kiểm tra tối thiểu

```powershell
npm ci
npm run build
Push-Location api
if (-not (Test-Path .venv)) { py -3 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Pop-Location
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Sau khi chạy, xác minh:

- Web: `http://127.0.0.1:8080/app/`
- API: `http://127.0.0.1:8780/health`
- n8n: `http://127.0.0.1:5678/healthz`

`.env` tối thiểu chỉ cần `NOTIAGENT_DATA_ROOT` và các cổng đã có trong `.env.example`; app vẫn boot khi mọi provider key để trống. Chỉ thêm `CRAZYROUTER_API_KEY` khi người dùng chủ động chọn test CrazyRouter. Dữ liệu/credential n8n nằm trong volume runtime, không có trong snapshot.

## Việc ưu tiên tiếp theo

1. Kiểm chứng miễn phí trước bằng mock/route test rằng nút UI gọi đúng `/api-proxy/api/video`, poll job và mở output.
2. Thêm bước xác nhận chi phí; chỉ sau khi người dùng duyệt mới chạy một live test chi phí thấp.
3. Xuất preset/workflow n8n không chứa credential và tạo Git remote private khi người dùng cho phép.

## Quy trình tạo ảnh/video A–Z ngay trong chat Code

Khi người dùng đưa ý tưởng làm video/ảnh AI, toàn bộ quá trình chạy trong khung chat Code này (không chuyển sang app khác). Công cụ: lệnh
`docker exec -i notiagent-local-api-1 python -m app.studio_cli <status|estimate|inbox|import-ref|image|video|wait|qc|ledger>` (prompt dài đưa bằng `--prompt-stdin` + heredoc, nhớ `-i`).

1. Gọi skill `dao-dien-ai-2`: chỉ xuất Phần A (bảng Storyboard); sửa theo góp ý; chỉ khi người dùng nói "Đã duyệt bảng" mới xuất Phần B (prompt tiếng Anh).
2. Ảnh tham chiếu: người dùng thả vào `D:\NotiAgentData\inbox` (xem `inbox`) hoặc gửi link (`import-ref`). Cần Character Sheet/khung đầu thì `image` (FLUX.2, đọc ảnh bằng Read).
3. Báo chi phí bằng `estimate` (credit + USD), hỏi người dùng có đồng ý không, CHỜ trả lời. Lệnh trả tiền (`image`, `video`) bắt buộc kèm `--approved <USD đã duyệt>`; thiếu thì CLI chỉ in ước tính và không gọi nhà cung cấp. Muốn thử miễn phí: `--test`.
4. `video ... --approved <USD>` rồi `wait <task_id>` (chạy nền bằng run_in_background, mất vài phút).
5. QC: dùng Read đọc lưới khung hình `qc-*.jpg` (đường dẫn do `wait`/`qc` in ra). Chỉ nhận xét điều NHÌN THẤY; âm thanh chỉ báo thông số (không nghe được). Có thể giao subagent QC/viết prompt song song cho nhiều clip.
6. Giao: SendUserFile file mp4 + báo chi phí thực tế (`ledger` có tổng đã chi). Lỗi nặng thì sửa prompt, báo chi phí mới, chờ duyệt lại.
7. Chỉ dùng model có giá xác thực trong `api/app/mcp_server.py` (Seedance 2.0/2.5, MiniMax H3 cho video; FLUX.2 cho ảnh). Mặc định Seedance 2.0 (4–15 giây).
8. Khóa Together.ai phải còn hiệu lực (kiểm tra bằng `status`); khóa lỗi 401 thì báo người dùng đổi khóa trong `.env`.

## Báo cáo bắt buộc

Mỗi phiên ghi rõ: đã làm, file thay đổi, lệnh kiểm tra, kết quả, phần chưa kiểm chứng, rủi ro và bước tiếp theo. Không tuyên bố hoàn thành nếu chỉ build pass mà chưa kiểm tra luồng phù hợp.
