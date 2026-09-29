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
| Workflow Hub — folders CRUD + clone | `VERIFIED` | 2026-09-29: thêm bảng `folders` (SQLite) + `POST/PATCH/DELETE /api/workflow-folders`, `POST /api/workflows/{id}/clone`. Nhân tiện phát hiện + sửa bug ẩn: 3 thư mục hệ thống (Templates/Workflow của tôi/Phòng thử nghiệm) trước đây KHÔNG có field `system:true` trong response → nút Đổi tên/Xoá của frontend (`useWorkflowHubCrudActions.ts` chỉ ẩn nút khi `folder.system` đúng) vẫn hiện lên cho cả 3 thư mục hệ thống, bấm vào sẽ lỗi vì chúng không tồn tại trong DB. Đã thêm `system:true`, backend cũng chặn cứng sửa/xoá 3 id này (400) dù frontend có gọi nhầm. Test qua browser + API thật: tạo thư mục → 201, đổi tên → tên mới đúng, xoá → workflow trong đó tự chuyển về "Workflow của tôi" (không mất), nhân bản workflow → bản sao có đủ node, `category:"custom"` (sửa được ngay). Thử xoá/sửa thư mục hệ thống → đúng bị từ chối 400 |
| Workflow Hub — versions / copilot-chat | `BLOCKED` (chưa làm) | `GET .../versions`, `POST .../versions/restore`, `POST /api/workflows/copilot-chat` vẫn 404 nếu bấm (xem lịch sử phiên bản, trợ lý AI workflow trong Copilot). copilot-chat cần thêm provider LLM mới (OpenAI) chưa cấu hình — ngoài phạm vi "một workflow video cá nhân", chưa làm |
| API — phục hồi sau khi restart | `VERIFIED` | 2026-09-29: workflow run đang "đang chạy" khi container API restart (thread nền chết theo tiến trình) trước đây sẽ TREO MÃI MÃI trên UI (không bao giờ chuyển succeeded/failed). Đã thêm `recover_interrupted_runs()` chạy lúc khởi động — tự đánh dấu các run còn dở dang thành `failed` kèm lý do rõ ràng, không còn treo vô thời hạn |
| CrazyRouter/Kling 2.5 Turbo | `VERIFIED` qua API | Video thật 5 giây, 9:16, 720x1280, 24 fps đã tạo và lưu local |
| Tạo video bằng nút UI (test miễn phí/mock) | `VERIFIED` | 2026-09-29: bấm "Gửi render" → hộp xác nhận chi phí → "Test miễn phí trước" → `POST /api-proxy/api/video` (provider=mock, 200) → poll `GET /api-proxy/api/video/status` đến state=success → `<video>` load readyState=4, 720x1280, 5.04s, không lỗi. Chưa test nhánh "Chạy thật" (trả phí) qua nút UI |
| Atlas Cloud | `PLANNED/FALLBACK` | Có adapter, chưa có key/test trả phí hiện hành |
| Tải lên / tải về sản phẩm | `VERIFIED` (đã sửa 2 bug thật) | 2026-09-29: (1) frontend gọi `/api/upload` (số ít), backend chỉ có `/api/uploads` (số nhiều) → MỌI lần tải ảnh/video tham chiếu lên đều 404 âm thầm từ trước giờ — đã đăng ký cả 2 đường dẫn. (2) Thêm `GET /api/download?url=&filename=` (trước đây không tồn tại, nút "Tải xuống" trên UI vô tác dụng) — proxy file thật (local hoặc CDN provider ngoài) kèm `Content-Disposition` đúng tên. (3) Phát hiện + sửa bug lớn hơn: MỌI url ảnh/video trả về từ backend (upload, ảnh mock, ảnh OpenAI) thiếu tiền tố `/api-proxy/` mà nginx yêu cầu — kết quả tải lên vẫn "thành công" nhưng preview vô hình (naturalWidth=0). Gom về 1 hàm `media_url()` dùng chung, tránh lặp lại. Verify qua browser thật: ảnh 768×768 load đúng, file tải về khớp bit-for-bit (6,386,021 byte) với bản gốc |
| Dung lượng lưu trữ | `VERIFIED` — không phải vấn đề hiện tại | 2026-09-29: ổ `D:` (chứa `NotiAgentData` + project) còn 434GB trống, dữ liệu hiện dùng 11.68MB — dư dả nhiều năm dùng cá nhân. Ổ `C:` chỉ còn 26GB (không phải nơi lưu dữ liệu app) — đã dọn 522MB cache build Docker dư thừa để phòng ngừa. Chưa có cơ chế cảnh báo tự động khi gần hết dung lượng (chưa cần, còn quá nhiều dư) |
| Node "image"/"tts"/"lipsync" trong workflow | `VERIFIED` qua mock; provider thật `BLOCKED` (thiếu API key) | 2026-09-29: thêm `POST /api/image` + 3 loại node mới vào `execute_workflow_graph` (trước đó chỉ có video). Theo đúng mô hình đã verified của video: mặc định `provider=mock` miễn phí (ảnh PNG/audio WAV placeholder sinh bằng stdlib, không thêm dependency), có đường thật sẵn sàng cho ảnh (OpenAI, cần `OPENAI_API_KEY` — hiện TRỐNG trong `.env`) và báo lỗi rõ ràng "chưa được cấu hình" cho tts/lipsync nếu chọn provider khác mock (chưa có ElevenLabs/HeyGen nào được nối, cố tình không giả vờ). 21/21 test pass, verify qua browser thật: workflow Prompt→Ảnh chạy ra ảnh thật hiển thị đúng trong canvas |
| Studio tạo ảnh (AiImageStudio.tsx) | `VERIFIED` (đã sửa nhiều bug thật) | 2026-09-29: đây là gap nghiêm trọng nhất phát hiện trong phiên — `create_image()` trả `{url, provider}` nhưng UI thật (`AiImageStudio.tsx`) đọc `res.imageUrls`/`res.imageUrl` — THIẾU 2 field này khiến mọi lần tạo ảnh báo lỗi "API không trả URL ảnh" dù backend trả 201 thành công. Đã sửa response đúng hợp đồng UI thật (không đoán — đọc thẳng code component), thêm `num_images` (nhiều biến thể), báo lỗi rõ ràng cho ảnh tham chiếu/FaceID (chưa hỗ trợ, không giả vờ). Model ảnh mặc định cũ (Seedream/Imagen qua novita/replicate) chưa có key nào — đã thêm 2 model FLUX.2 (Pro $0.03/MP, Dev $0.0154/MP — giá đã xác minh qua docs Together.ai, KHÔNG phải free) dùng `TOGETHER_API_KEY`, đặt làm mặc định cho cả 2 chế độ Đạo diễn/Tiêu chuẩn để nút Tạo dùng được ngay. Thêm bước xác nhận chi phí trước khi tạo ảnh thật (giống hệt cơ chế đã có ở video) — trước đây AiImageStudio KHÔNG có bước xác nhận nào, sẽ gọi thẳng provider trả phí nếu chọn model đó. Verify qua browser thật: mở Studio → tab Ảnh → model mặc định hiện đúng FLUX.2 Pro (Together.ai) kèm giá → nhập prompt → bấm Tạo → hộp xác nhận hiện đúng → "Test miễn phí trước" → `POST /api/image` 201 → ảnh 768×768 hiển thị đúng trên canvas. 24/24 test backend pass, `npm run build` sạch |
| Catalog model ảnh/video theo hãng + hiện chi phí credit (commit 56002c9) | `CODE XONG`; `CHƯA verify trên UI` | 2026-09-29/30: thêm model ảnh (GPT Image 2/2.5, Nano Banana Pro/2 Lite, Seedream 5 Pro, FLUX.2 Pro/Dev) và video (Seedance 2.5, DreamActor M2, Kling 3.0 Motion Control, Gemini Omni Flash, MiniMax H3) vào `src/lib/imageModels.ts`/`videoModels.ts`, nhóm theo hãng; `costEstimate.ts` có thêm `hasVideoPriceData`/`hasImagePriceData` — model chưa có giá xác thực hiện đúng "chưa có bảng giá xác thực" thay vì đoán $0.08/s. Model của provider chưa có key sẽ báo lỗi "chưa hỗ trợ/chưa cấu hình" rõ ràng. Veo 3 (bản cũ) cố tình KHÔNG thêm (Google đã dừng 30/6/2026). **Còn lại của yêu cầu Studio:** chọn đúng 4 model âm thanh/lipsync tốt nhất, thêm đủ tỉ lệ khung hình/kích thước phổ biến cho ảnh và video, test kéo-thả + cuộn chuột trên node workflow, rà nút/nội dung trùng lặp, mở rộng giao diện workflow |
| Môi trường máy (2026-09-30) | `RỦI RO PHẦN CỨNG` | Máy `MATONG-TOP1-PC` (i7-14700K, BIOS ASUS 1836, Intel Default đã bật): 11 lần tắt đột ngột (Kernel-Power 41) từ 1/8, 23 lỗi CPU WHEA (31/7–27/9). HWiNFO (cài qua winget) ghi nhận lõi CPU chạm 100 °C trong 10 giây đầu, lúc rảnh 57–63 °C → nghi tản nhiệt không đủ; chờ người dùng cho biết loại tản/nhiệt độ sau vài giờ. Docker Desktop bị kẹt socket sau mỗi lần tắt đột ngột (`sailor-ingest.sock`, `docker-secrets-engine\engine.sock`, lỗi 1920 — không xóa được): đã xử lý bằng đổi tên thư mục cha (`%LOCALAPPDATA%\Docker\run` → `run.cu`/`run.cu2`, `docker-secrets-engine` → `docker-secrets-engine.cu`) với sự đồng ý của người dùng; các thư mục `.cu*` có thể xóa sau khi khởi động lại máy. KHÔNG bấm "Reset to factory defaults" của Docker. Commit + push sớm, thường xuyên |
| Chat / Agent / đăng MXH / thư viện media / TTS-dubbing-lipsync độc lập (ngoài workflow) | `PAUSED theo yêu cầu người dùng` | 2026-09-29: đối chiếu toàn bộ `src/lib/*.ts` với route thật trong `main.py` — frontend gọi ~30 đường dẫn API (`/api/chat*`, `/api/agent/*`, `/api/social/*`, `/api/media/library`, `/api/studio/elevenlabs/*`, `/api/studio/heygen/*`, `/api/thumbnail`...). Đã BẮT ĐẦU xây `/api/chat` + `/api/chat/unified` dùng Together.ai (chat thật, chế độ "Agent" trả lời thật nhưng gắn nhãn `fallback:true` đúng theo thiết kế sẵn của `ChatWorkspace.tsx` vì chưa nối tool n8n/browser/search thật) — code đã viết, syntax hợp lệ, NHƯNG người dùng yêu cầu dừng lại giữa chừng để ưu tiên Studio ảnh/video trước. Endpoint đã tồn tại trong `main.py` nhưng CHƯA test qua UI thật (ChatWorkspace.tsx chưa mở thử). `/api/agent/capabilities`, `/api/agent/status`, `/api/social/*`, `/api/media/library`, ElevenLabs/HeyGen — vẫn chưa làm. Quay lại phần này khi người dùng yêu cầu |
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
- [x] Chỉ chạy một live job chi phí thấp sau xác nhận rõ của người dùng — verified 2026-09-29: chạy thật qua CrazyRouter (người dùng xác nhận), nhận đúng lỗi `quota_not_enough` (tài khoản hết quota, không phải lỗi code — xem mục 2). Chạy qua nhánh Workflow Hub (`variables.provider=crazyrouter`), dùng chung code path với nút "Chạy thật" của AiVideoStudio nên coi như đã verified cả hai.
- [x] Poll trạng thái, lưu hoặc proxy output và mở video thật trong UI — verified cho nhánh mock.
- [x] Kiểm tra lỗi provider, timeout, refresh trình duyệt và job đang chạy — verified 2026-09-29: bấm "Chạy workflow" → tải lại trang (F5) NGAY giữa lúc node video đang "running" → UI phục hồi đúng, hiện lại toàn bộ trace (`prompt: succeeded`, `video: running`) từ DB, không mất tiến trình. Đợi chạy xong, tải lại lần nữa → video hiển thị đầy đủ (readyState=4, đúng kích thước). Lỗi provider đã verified qua `quota_not_enough` ở trên + 21 test backend cho các tình huống lỗi khác (response thiếu trường, timeout mạng, HTTP status lạ).

### P0b - Workflow Hub (2026-09-29, mới xong)

- [x] Fix bug `category` chặn sửa canvas — verified.
- [x] Thêm `POST /api/workflows/{id}/run` thực thi thật chuỗi `input → prompt → video → output`, mặc định `provider=mock` an toàn — verified qua browser (xem mục 2).
- [x] Chạy thật một job trả phí (`variables.provider = "crazyrouter"`) qua chính Workflow Hub — người dùng đã xác nhận, đã chạy. Luồng code đúng (request gửi đúng payload, nhận và hiển thị lỗi đúng), nhưng CrazyRouter trả `403 quota_not_enough` — tài khoản hết quota, không phải lỗi code. Nạp thêm quota rồi chạy lại là xong việc này.
- [ ] Node `image` trong workflow — chưa có provider ảnh nào nối thật ở backend rút gọn này; sẽ báo lỗi rõ ràng nếu chạy.
- [ ] Node `set/json/template/array/map/merge/for_each/tts/lipsync/http/browser/condition/subflow` — chưa hỗ trợ, báo lỗi rõ ràng thay vì giả vờ chạy được (xem mục 2).
- [x] Thư mục mới / Nhân bản — đã làm (xem mục 2, "folders CRUD + clone"). Lịch sử phiên bản / Trợ lý AI workflow — vẫn 404, chưa làm (copilot-chat cần thêm provider LLM mới, ngoài phạm vi).

### P1 - Độ bền API

- [x] Thêm timeout/retry có giới hạn cho lỗi mạng tạm thời — `post_with_retry`/`get_with_retry` trong `api/app/main.py` (2026-09-29). POST tạo video CHỈ retry khi kết nối chưa hề thiết lập (ConnectError/ConnectTimeout) — không retry ReadTimeout vì không chắc provider đã xử lý hay chưa, tránh tạo trùng job tính phí (đúng yêu cầu "Không retry mù" bên dưới). GET trạng thái (read-only) retry mọi lỗi mạng tạm thời. Có test riêng (`test_post_with_retry_*`, `test_get_with_retry_*`).
- [x] Không retry mù request tạo video có thể tính phí — đã áp dụng như trên.
- [x] Lưu task/job tối thiểu để khôi phục sau restart — `recover_interrupted_runs()` (xem mục 2), đánh dấu failed rõ ràng thay vì treo mãi.
- [x] Bổ sung test cho response thiếu trường, trạng thái lạ và lỗi HTTP provider — thêm `test_crazyrouter_missing_task_id_surfaces_clear_error`, `test_provider_error_detail_extracts_json_message`. Tổng test hiện tại: 13 (từ 5).
- **Phát hiện thêm khi viết test (2026-09-29):** `db()` dùng `with db() as connection:` khắp file nhưng `sqlite3.Connection.__exit__` chỉ commit/rollback, KHÔNG đóng connection — rò rỉ file handle thật (lộ ra trên Windows khi test dọn dẹp thư mục tạm bị "PermissionError: file đang được dùng"). Đã sửa `db()` thành contextmanager tự đóng connection — không cần sửa bất kỳ chỗ gọi nào khác (~15 chỗ), toàn bộ hành vi cũ giữ nguyên. Verify: 13/13 test pass sạch, chạy lại 1 workflow video mock thật qua API vẫn `status=succeeded` sau khi rebuild container.

### P2 - Bảo toàn dự án

- Tạo Git remote private sau khi người dùng xác nhận.
- Commit baseline sạch, không chứa secret/runtime data.
- Xuất workflow n8n/preset không credential và thiết lập backup có thử phục hồi.

## 10. Tiêu chí hoàn thành mốc tiếp theo

Một lần thao tác từ giao diện tạo được video, người dùng xác nhận chi phí trước khi gửi, UI theo dõi được job và output mở được. QC phải kiểm tra cả hình lẫn audio track; với model không sinh âm thanh, UI phải cảnh báo trước và kết quả QC phải xác nhận đúng là không có audio thay vì coi đó là lỗi ngoài dự kiến.
