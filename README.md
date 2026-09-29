# NotiAgent local recovery

Baseline phục hồi cho mục đích cá nhân, chạy trên Windows + WSL2 + Docker Desktop.

## Thành phần

- Web: React/Vite và Workflow Hub mới nhất còn khôi phục được.
- API: FastAPI tối thiểu cho health, workflow CRUD, upload và tạo video qua provider ngoài.
- Automation: n8n cục bộ.
- Dữ liệu: `D:\NotiAgentData`, nằm ngoài Git và OneDrive.

## Chạy

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

- Web: http://localhost:8080/app/
- API health: http://localhost:8780/health
- n8n: http://localhost:5678/

Các khóa provider chỉ được điền vào `.env`; không đưa `.env` vào Git hoặc gói bàn giao.

## Trạng thái đã kiểm chứng

- `docker compose up -d --build` chạy được web/API/n8n trên Windows + Docker Desktop.
- Web, API health và n8n health trả HTTP 200.
- Frontend qua TypeScript typecheck và Vite production build.
- Backend có smoke test cho health, workflow CRUD và mapping provider video.
- CrazyRouter/Kling 2.5 Turbo đã tạo thành công một video text-to-video 5 giây, 9:16, 720p qua API ngày 2026-09-28.
- Chưa kiểm chứng thao tác tạo video đầu-cuối bằng chính nút trên giao diện.

Đọc `CLAUDE.md` rồi `HANDOFF-CLAUDE-CODE.md` trước khi tiếp tục phát triển.
