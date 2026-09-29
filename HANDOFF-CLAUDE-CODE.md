# Bàn giao NotiAgent cho Claude Code

Ngày chốt: 2026-09-29, Asia/Saigon.

## 1. Mục tiêu sản phẩm

NotiAgent là ứng dụng cá nhân gồm Chat/Agent/Studio và Workflow Hub. Mục tiêu gần nhất là chạy ổn định một số luồng tạo video tự động bằng API key hoặc MCP. Laptop chỉ điều phối, lưu dữ liệu và hiển thị kết quả; không chạy model AI nặng cục bộ.

## 2. Trạng thái hiện tại

| Thành phần | Trạng thái | Bằng chứng |
|---|---|---|
| Web React/Vite | `VERIFIED` | Build/typecheck pass; container healthy; HTTP 200 tại cổng 8080 |
| API FastAPI/SQLite | `VERIFIED` | Health, workflow CRUD, upload/provider routes và test tự động |
| n8n local | `VERIFIED` ở mức runtime | Container healthy; HTTP 200 tại cổng 5678 |
| Workflow Hub — sửa node/canvas | `VERIFIED` (đã fix bug) | 2026-09-29: backend `workflow_from_row`/`create_workflow`/`update_workflow` trước đây KHÔNG bao giờ trả field `category` — mọi hàm sửa node/edge/lưu ở frontend (`useWorkflowHubEditorMutations.ts`, `useWorkflowHubCrudActions.ts`) tự chặn khi `workflow.category !== 'custom'`, nên UI trông có vẻ chạy nhưng KHÔNG sửa được gì. Đã thêm category/media/published/component*/metadataJson vào payload lưu trong `api/app/main.py`. Test qua browser thật: thêm node Prompt + Video, nối cạnh, "Lưu thay đổi" → PATCH 200 OK, chỉnh sửa giữ nguyên sau reload |
| Workflow Hub — chạy workflow (`POST /api/workflows/{id}/run`) | `VERIFIED` qua mock; `BLOCKED` (quota) qua CrazyRouter thật | 2026-09-29: endpoint này KHÔNG TỒN TẠI TRƯỚC ĐÂY (grep toàn bộ `@app.*` trong main.py xác nhận 0 kết quả) — nút "Chạy workflow" gọi 404 trước bản vá. Đã thêm `execute_workflow_graph` (topological walk, threading nền, poll `runs` qua `GET /api/workflow-runs` mỗi 5s như frontend đã sẵn có). CHỈ hỗ trợ thật node `input`/`prompt`/`video`/`output` (video dùng lại nguyên hàm `create_video()`/`video_status()` đã verified — mặc định `provider=mock` nếu không truyền `variables.provider`, tránh gọi nhầm provider trả phí). Mọi loại node khác (`set/json/template/array/map/merge/for_each/image/tts/lipsync/http/browser/condition/subflow`) trả lỗi rõ ràng "chưa được hỗ trợ" thay vì giả vờ chạy — KHÔNG có provider ảnh/automation nào được nối thật. Test qua browser thật: workflow "Prompt → Video", biến để trống (mặc định mock) → `POST .../run` 200 → run `status=succeeded` → asset thật `/api/media/kling-test-paper-boat-20260928.mp4` hiển thị trong node canvas, `<video>` readyState=4. Sau đó test `variables.provider="crazyrouter"` (người dùng xác nhận chạy thật) → CrazyRouter trả `HTTP 403 {"code":"quota_not_enough"}` — request/luồng đúng, KHÔNG phải lỗi code, chỉ là tài khoản CrazyRouter hết quota. Nhân tiện sửa luôn lỗi phụ: `create_video()`/`video_status()` trước đó nuốt mất message lỗi thật từ provider (chỉ hiện "HTTP 403" trống), đã thêm `provider_error_detail()` để hiện đúng nội dung (`"... — user quota is not enough"`), áp dụng cho cả `/api/video` lẫn workflow run. Đã verify lại qua browser: UI hiện đúng thông báo lỗi mới. **Việc còn lại duy nhất để có video thật qua Workflow Hub: người dùng nạp thêm quota vào tài khoản CrazyRouter, sau đó chạy lại cùng workflow này với `variables: {"provider": "crazyrouter"}`.** |
| Workflow Hub — folders CRUD / clone / versions / copilot-chat | `BLOCKED` (chưa làm) | Frontend gọi `POST/PATCH/DELETE /api/workflow-folders`, `POST /api/workflows/{id}/clone`, `GET .../versions`, `POST .../versions/restore`, `POST /api/workflows/copilot-chat` — không tồn tại ở backend, sẽ 404 nếu bấm các nút tương ứng (Thư mục mới, Nhân bản, xem lịch sử phiên bản, trợ lý AI workflow). Nằm ngoài phạm vi "một workflow video cá nhân" nên chưa làm |
| CrazyRouter/Kling 2.5 Turbo | `VERIFIED` qua API | Video thật 5 giây, 9:16, 720x1280, 24 fps đã tạo và lưu local |
| Tạo video bằng nút UI (test miễn phí/mock) | `VERIFIED` | 2026-09-29: bấm "Gửi render" → hộp xác nhận chi phí → "Test miễn phí trước" → `POST /api-proxy/api/video` (provider=mock, 200) → poll `GET /api-proxy/api/video/status` đến state=success → `<video>` load readyState=4, 720x1280, 5.04s, không lỗi. Chưa test nhánh "Chạy thật" (trả phí) qua nút UI |
| Atlas Cloud | `PLANNED/FALLBACK` | Có adapter, chưa có key/test trả phí hiện hành |
| VPS `vps-noti` | `HISTORICAL/EXPIRED` | Không còn truy cập; tuyệt đối không coi là môi trường hiện hành |

## 3. Kiến trúc đang chạy

```text
Browser
  -> notiagent-web (nginx, 127.0.0.1:8080)
  -> /api-proxy/*
  -> notiagent-api (FastAPI, 127.0.0.1:8780)
  -> SQLite + media tại D:\NotiAgentData
  -> CrazyRouter hoặc provider API khác

n8n (127.0.0.1:5678)
  -> dữ liệu tại D:\NotiAgentData\n8n
```

Repository: `D:\Projects\NotiAgent`.

Không chuyển source chạy thật vào OneDrive/Google Drive. Gói bàn giao chỉ là snapshot sạch để phục hồi/đọc.

Trên máy khác, dùng thư mục `SOURCE-NOTIAGENT` trong gói làm baseline và copy ra một thư mục làm việc ngoài thư mục đồng bộ. Trên máy hiện tại, working tree ở ổ D là bản đang chạy.

## 4. Công việc đã làm

- Ghép frontend Workflow Hub mới nhất còn phục hồi được với lockfile/Vite/Nginx/Docker từ bản legacy.
- Dựng backend tối thiểu thay cho backend production đã mất: health, workflow CRUD, upload/media, provider state và video create/status.
- Dựng Docker Compose cho web/API/n8n; bind toàn bộ cổng vào localhost.
- Lưu runtime data ngoài repository tại `D:\NotiAgentData`.
- Khôi phục nhiều sửa lỗi frontend lịch sử: UUID fallback, canvas/panel Workflow Hub, portal popover, zoom/toạ độ, inline rename, Studio render throttling và các chỉnh sửa UI.
- Nối CrazyRouter/Kling 2.5 Turbo làm MVP text-to-video 720p.
- Chạy một job trả phí chi phí thấp qua API và tải file kết quả về máy.

## 5. Artifact video đã kiểm chứng

- File runtime, không nằm trong gói source: `D:\NotiAgentData\media\kling-test-paper-boat-20260928.mp4`.
- Kích thước: 6,386,021 byte.
- SHA-256: `4F8E38044DA9BB1CE25EF8B425C9D8FD16426F1B0AC965BEFBA6868EE374D6E0`.
- Metadata đã ghi nhận: 5 giây, 720x1280, 24 fps, không có track âm thanh.
- QC hình ảnh ba mốc đầu/giữa/cuối đạt cho prompt thuyền giấy trên mặt nước.
- Giá API khi chạy chỉ là ước tính; chưa đối chiếu được khoản trừ thực tế trong hóa đơn provider.

## 6. Thất bại và giới hạn phải nhớ

- VPS cũ hết hạn nên mất repository/Git history và backend production đầy đủ.
- Backend Atlas cũ chỉ còn hai file, thiếu module/dependency nên không thể dùng nguyên trạng.
- Không tìm thấy backup Dify đầy đủ.
- Workflow n8n cũ từng dùng `Execute Command` không tương thích; credential không đi theo export.
- Build Vite đơn lẻ không chứng minh TypeScript đúng; luôn chạy `npm run build` hiện tại vì script đã kèm typecheck.
- Test API/provider mock không chứng minh provider trả phí hoạt động; chỉ artifact thật mới là bằng chứng execution.
- Video MVP hiện không có âm thanh.
- Repository và Project Hub đều chưa có commit/remote; không tự commit, push hoặc tạo remote nếu người dùng chưa yêu cầu.

## 7. Secret và dữ liệu không có trong gói

- `.env` thật và mọi API key/token.
- `D:\NotiAgentData\db`, dữ liệu n8n và media runtime.
- `node_modules`, `dist`, `.venv`, cache và Git metadata.
- Tài liệu lịch sử có mật khẩu VPS hoặc thông tin định danh cá nhân.

Claude Code phải yêu cầu người dùng tự cấu hình secret vào `.env`; không yêu cầu họ dán key vào chat.

## 8. Cách khởi động

```powershell
cd D:\Projects\NotiAgent
Copy-Item .env.example .env   # chỉ khi chưa có .env
# Người dùng tự điền key cần dùng vào .env
docker compose up -d --build
docker compose ps
```

Kiểm tra ba URL trong `CLAUDE.md`. Không chạy provider trả phí chỉ để smoke test.

## 9. Việc tiếp theo có giá trị nhất

### P0 - Hoàn tất UI end-to-end

- [x] Trước tiên dùng mock/test route để kiểm tra UI mà không phát sinh phí — verified 2026-09-29 qua browser thật (xem bảng trạng thái mục 2).
- [x] Bắt request từ nút Tạo video đến `/api-proxy/api/video` — verified.
- [x] Hiển thị model, tỷ lệ, thời lượng, độ phân giải trước khi gửi (hộp xác nhận) — verified. Chi phí ước tính bằng số tiền cụ thể vẫn CHƯA có (hộp xác nhận nói rõ "chưa có dữ liệu giá chính xác").
- [ ] Chỉ chạy một live job chi phí thấp sau xác nhận rõ của người dùng — nhánh "Chạy thật" chưa test qua UI thật, cần người dùng xác nhận trước khi chạy.
- [x] Poll trạng thái, lưu hoặc proxy output và mở video thật trong UI — verified cho nhánh mock.
- [ ] Kiểm tra lỗi provider, timeout, refresh trình duyệt và job đang chạy — chưa test.

### P0b - Workflow Hub (2026-09-29, mới xong)

- [x] Fix bug `category` chặn sửa canvas — verified.
- [x] Thêm `POST /api/workflows/{id}/run` thực thi thật chuỗi `input → prompt → video → output`, mặc định `provider=mock` an toàn — verified qua browser (xem mục 2).
- [x] Chạy thật một job trả phí (`variables.provider = "crazyrouter"`) qua chính Workflow Hub — người dùng đã xác nhận, đã chạy. Luồng code đúng (request gửi đúng payload, nhận và hiển thị lỗi đúng), nhưng CrazyRouter trả `403 quota_not_enough` — tài khoản hết quota, không phải lỗi code. Nạp thêm quota rồi chạy lại là xong việc này.
- [ ] Node `image` trong workflow — chưa có provider ảnh nào nối thật ở backend rút gọn này; sẽ báo lỗi rõ ràng nếu chạy.
- [ ] Node `set/json/template/array/map/merge/for_each/tts/lipsync/http/browser/condition/subflow` — chưa hỗ trợ, báo lỗi rõ ràng thay vì giả vờ chạy được (xem mục 2).
- [ ] Thư mục mới / Nhân bản / Lịch sử phiên bản / Trợ lý AI workflow trên UI Workflow Hub — nút bấm sẽ 404 vì backend chưa có các endpoint này.

### P1 - Độ bền API

- Thêm timeout/retry có giới hạn và idempotency cho create job.
- Không retry mù request tạo video có thể tính phí.
- Lưu task/job tối thiểu để khôi phục sau restart.
- Bổ sung test cho response thiếu trường, trạng thái lạ và lỗi HTTP provider.

### P2 - Bảo toàn dự án

- Tạo Git remote private sau khi người dùng xác nhận.
- Commit baseline sạch, không chứa secret/runtime data.
- Xuất workflow n8n/preset không credential và thiết lập backup có thử phục hồi.

## 10. Tiêu chí hoàn thành mốc tiếp theo

Một lần thao tác từ giao diện tạo được video, người dùng xác nhận chi phí trước khi gửi, UI theo dõi được job và output mở được. QC phải kiểm tra cả hình lẫn audio track; với model không sinh âm thanh, UI phải cảnh báo trước và kết quả QC phải xác nhận đúng là không có audio thay vì coi đó là lỗi ngoài dự kiến.
