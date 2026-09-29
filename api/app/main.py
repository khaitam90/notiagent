from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


DATA_DIR = Path(os.getenv("NOTIAGENT_DATA_DIR", "data")).resolve()
UPLOAD_DIR = DATA_DIR / "media"
DB_PATH = DATA_DIR / "db" / "notiagent.db"
for directory in (UPLOAD_DIR, DB_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="NotiAgent API", version="0.1.0")

ATLAS_VIDEO_URL = "https://api.atlascloud.ai/api/v1/model/generateVideo"
ATLAS_PREDICTION_URL = "https://api.atlascloud.ai/api/v1/model/prediction"
ATLAS_MVP_MODEL = "bytedance/seedance-v1-pro-fast/text-to-video"
ATLAS_RATIOS = {"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"}
CRAZY_VIDEO_URL = "https://crazyrouter.com/v1/video/create"
CRAZY_STATUS_URL = "https://crazyrouter.com/v1/video/query"
CRAZY_MVP_MODEL = "aigc-video-kling-2.5-turbo"

# provider="mock" — không gọi provider trả phí nào; dùng để kiểm chứng luồng UI
# (nút bấm -> /api/video -> poll -> hiển thị output) miễn phí trước khi chạy job thật.
MOCK_VIDEO_FILENAME = "kling-test-paper-boat-20260928.mp4"
MOCK_TASKS: dict[str, float] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )


def recover_interrupted_runs() -> None:
    # Thread nen thuc thi workflow (execute_workflow_graph) chet theo tien trinh khi container
    # restart - run dang "running"/"queued" se ket qua treo mai mai tren UI (frontend cu poll
    # 5s cho toi khi status doi thanh succeeded/failed). Danh dau that bai ro rang ngay khi API
    # khoi dong lai, thay vi de nguoi dung thay "dang chay" vinh vien khong co ket qua.
    timestamp = now_iso()
    with db() as connection:
        stuck = connection.execute(
            "SELECT id, payload FROM runs WHERE status IN ('running', 'queued')"
        ).fetchall()
        for row in stuck:
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                continue
            payload["status"] = "failed"
            payload["error"] = "Bị gián đoạn do server khởi động lại — chạy lại workflow."
            payload["message"] = payload["error"]
            payload["updatedAt"] = timestamp
            payload["finishedAt"] = timestamp
            connection.execute(
                "UPDATE runs SET status = 'failed', payload = ? WHERE id = ?",
                (json.dumps(payload), row["id"]),
            )


init_db()
recover_interrupted_runs()


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    folderId: str = Field(default="personal", min_length=1, max_length=80)


class VideoCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    provider: str = "crazyrouter"
    model: str = CRAZY_MVP_MODEL
    aspect_ratio: str = "16:9"
    duration: int = Field(default=5, ge=2, le=12)
    quality: str = "480p"
    image_url: str | None = None
    video_url: str | None = None


class WorkflowRunCreate(BaseModel):
    prompt: str = ""
    image_url: str | None = None
    video_url: str | None = None
    audio_url: str | None = None
    aspect_ratio: str = "16:9"
    duration: int = 5
    tool_id: str | None = None
    output_mode: str | None = None
    target_node_id: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)


def workflow_from_row(row: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(row["payload"])
    return {
        "id": row["id"],
        "name": row["name"],
        "description": payload.get("description", ""),
        "folderId": row["folder_id"],
        # Moi workflow luu trong DB nay deu la workflow tuy chinh cua nguoi dung (template mau
        # khong nam trong bang workflows) - category PHAI la "custom" thi frontend moi cho phep
        # sua node/edge/luu (moi ham updateDraftNode/saveWorkflowDraft/... trong
        # useWorkflowHubEditorMutations.ts va useWorkflowHubCrudActions.ts deu tu chan khi
        # workflow.category !== "custom"). Truoc ban vá nay endpoint khong tra field nay nen UI
        # canvas khong sua duoc gi ca - da xac minh bang doc code + test tren browser that.
        "category": payload.get("category", "custom"),
        "media": payload.get("media", "automation"),
        "published": bool(payload.get("published", False)),
        "component": bool(payload.get("component", False)),
        "componentName": payload.get("componentName", ""),
        "componentInputSchemaJson": payload.get("componentInputSchemaJson", ""),
        "componentOutputSchemaJson": payload.get("componentOutputSchemaJson", ""),
        "metadataJson": payload.get("metadataJson", ""),
        "sourceTemplateId": payload.get("sourceTemplateId", ""),
        "tags": payload.get("tags", []),
        "nodes": payload.get("nodes", []),
        "edges": payload.get("edges", []),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "notiagent-api", "database": "sqlite"}


SYSTEM_FOLDER_IDS = {"templates", "personal", "sandbox"}


def system_folders(timestamp: str) -> list[dict[str, Any]]:
    return [
        {"id": "templates", "name": "Templates", "kind": "template", "system": True, "updatedAt": timestamp},
        {"id": "personal", "name": "Workflow của tôi", "kind": "personal", "system": True, "updatedAt": timestamp},
        {"id": "sandbox", "name": "Phòng thử nghiệm", "kind": "sandbox", "system": True, "updatedAt": timestamp},
    ]


def folder_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "system": False, "updatedAt": row["updated_at"]}


@app.get("/api/workflows/bootstrap")
def workflow_bootstrap() -> dict[str, Any]:
    with db() as connection:
        workflows = [workflow_from_row(row) for row in connection.execute("SELECT * FROM workflows ORDER BY updated_at DESC")]
        runs = [json.loads(row["payload"]) for row in connection.execute("SELECT payload FROM runs ORDER BY created_at DESC LIMIT 50")]
        custom_folders = [folder_from_row(row) for row in connection.execute("SELECT * FROM folders ORDER BY created_at ASC")]
    return {
        "folders": system_folders(now_iso()) + custom_folders,
        "workflows": workflows,
        "runs": runs,
    }


class WorkflowFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@app.post("/api/workflow-folders", status_code=201)
def create_workflow_folder(body: WorkflowFolderCreate) -> dict[str, Any]:
    folder_id = secrets.token_hex(8)
    timestamp = now_iso()
    with db() as connection:
        connection.execute(
            "INSERT INTO folders(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (folder_id, body.name.strip(), timestamp, timestamp),
        )
        row = connection.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    return folder_from_row(row)


@app.patch("/api/workflow-folders/{folder_id}")
def rename_workflow_folder(folder_id: str, body: WorkflowFolderCreate) -> dict[str, Any]:
    if folder_id in SYSTEM_FOLDER_IDS:
        raise HTTPException(status_code=400, detail="Không thể đổi tên thư mục hệ thống")
    timestamp = now_iso()
    with db() as connection:
        updated = connection.execute(
            "UPDATE folders SET name = ?, updated_at = ? WHERE id = ?",
            (body.name.strip(), timestamp, folder_id),
        ).rowcount
        if not updated:
            raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")
        row = connection.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    return folder_from_row(row)


@app.delete("/api/workflow-folders/{folder_id}")
def delete_workflow_folder(folder_id: str) -> dict[str, bool]:
    if folder_id in SYSTEM_FOLDER_IDS:
        raise HTTPException(status_code=400, detail="Không thể xoá thư mục hệ thống")
    timestamp = now_iso()
    with db() as connection:
        deleted = connection.execute("DELETE FROM folders WHERE id = ?", (folder_id,)).rowcount
        if not deleted:
            raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")
        # Workflow trong thu muc bi xoa chuyen ve "Workflow cua toi" (personal), khong mat workflow.
        connection.execute(
            "UPDATE workflows SET folder_id = 'personal', updated_at = ? WHERE folder_id = ?",
            (timestamp, folder_id),
        )
    return {"ok": True}


@app.post("/api/workflows", status_code=201)
def create_workflow(body: WorkflowCreate) -> dict[str, Any]:
    workflow_id = secrets.token_hex(12)
    timestamp = now_iso()
    payload = {
        "description": "",
        "tags": [],
        "nodes": [],
        "edges": [],
        "category": "custom",
        "media": "automation",
        "published": False,
    }
    with db() as connection:
        connection.execute(
            "INSERT INTO workflows(id, name, folder_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (workflow_id, body.name.strip(), body.folderId, json.dumps(payload), timestamp, timestamp),
        )
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    return workflow_from_row(row)


@app.patch("/api/workflows/{workflow_id}")
def update_workflow(workflow_id: str, body: dict[str, Any]) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy workflow")
        current = workflow_from_row(row)
        allowed = {
            "name", "description", "folderId", "tags", "nodes", "edges",
            "media", "published", "component", "componentName",
            "componentInputSchemaJson", "componentOutputSchemaJson",
            "metadataJson", "sourceTemplateId",
        }
        current.update({key: value for key, value in body.items() if key in allowed})
        timestamp = now_iso()
        payload = {
            key: current[key]
            for key in (
                "description", "tags", "nodes", "edges", "category", "media",
                "published", "component", "componentName",
                "componentInputSchemaJson", "componentOutputSchemaJson",
                "metadataJson", "sourceTemplateId",
            )
        }
        connection.execute(
            "UPDATE workflows SET name = ?, folder_id = ?, payload = ?, updated_at = ? WHERE id = ?",
            (current["name"], current["folderId"], json.dumps(payload), timestamp, workflow_id),
        )
        updated = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    return workflow_from_row(updated)


class WorkflowCloneRequest(BaseModel):
    folderId: str = Field(default="personal", min_length=1, max_length=80)


@app.post("/api/workflows/{workflow_id}/clone", status_code=201)
def clone_workflow(workflow_id: str, body: WorkflowCloneRequest) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy workflow")
        source = workflow_from_row(row)
        new_id = secrets.token_hex(12)
        timestamp = now_iso()
        payload = {
            "description": source["description"],
            "tags": source["tags"],
            "nodes": source["nodes"],
            "edges": source["edges"],
            "category": "custom",
            "media": source["media"],
            "published": False,
            "sourceTemplateId": source["id"] if source["category"] == "template" else source.get("sourceTemplateId", ""),
        }
        connection.execute(
            "INSERT INTO workflows(id, name, folder_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (new_id, f"{source['name']} (bản sao)", body.folderId, json.dumps(payload), timestamp, timestamp),
        )
        created = connection.execute("SELECT * FROM workflows WHERE id = ?", (new_id,)).fetchone()
    return workflow_from_row(created)


@app.delete("/api/workflows/{workflow_id}")
def delete_workflow(workflow_id: str) -> dict[str, bool]:
    with db() as connection:
        deleted = connection.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,)).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy workflow")
    return {"ok": True}


@app.post("/api/workflows/preflight")
def preflight_workflow(body: dict[str, Any]) -> dict[str, Any]:
    workflow = body.get("workflow") or {}
    has_output = any(node.get("type") == "output" for node in workflow.get("nodes", []))
    errors = [] if has_output else ["Workflow cần ít nhất một node output"]
    return {
        "ready": not errors,
        "publishReady": False,
        "environment": "sandbox",
        "errors": errors,
        "warnings": ["Chưa kết nối provider AI thật"],
        "checks": [{"id": "output", "label": "Output node", "status": "passed" if has_output else "failed"}],
    }


@app.get("/api/workflow-runs")
def workflow_runs(workflowId: str | None = None) -> dict[str, Any]:
    query = "SELECT payload FROM runs"
    params: tuple[Any, ...] = ()
    if workflowId:
        query += " WHERE workflow_id = ?"
        params = (workflowId,)
    query += " ORDER BY created_at DESC LIMIT 50"
    with db() as connection:
        runs = [json.loads(row["payload"]) for row in connection.execute(query, params)]
    return {"runs": runs}


# --- Thuc thi workflow that -------------------------------------------------
# MVP co chu dich: chi ho tro chuoi node input -> prompt -> video -> output (duong duy nhat da
# VERIFIED that qua CrazyRouter/Kling - xem HANDOFF-CLAUDE-CODE.md). Cac loai node khac (set/json/
# template/array/map/merge/for_each/image/tts/lipsync/http/browser/condition/subflow) bao loi ro
# rang thay vi gia vo chay duoc - khong co provider anh/automation nao duoc noi day that ca.

TEMPLATE_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
SUPPORTED_RUN_NODE_TYPES = {"input", "prompt", "video", "output"}


def render_run_template(template: str, state: dict[str, Any]) -> str:
    def replace(match: "re.Match[str]") -> str:
        value = state.get(match.group(1))
        return "" if value is None else str(value)
    return TEMPLATE_VAR_RE.sub(replace, template)


def topological_node_order(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node_by_id = {str(n.get("id")): n for n in nodes}
    indegree = {node_id: 0 for node_id in node_by_id}
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_by_id}
    for edge in edges:
        source, target = str(edge.get("source", "")), str(edge.get("target", ""))
        if source in node_by_id and target in node_by_id:
            adjacency[source].append(target)
            indegree[target] += 1
    queue = [node_id for node_id, deg in indegree.items() if deg == 0]
    visited: set[str] = set()
    order: list[dict[str, Any]] = []
    while queue:
        node_id = queue.pop(0)
        if node_id in visited:
            continue
        visited.add(node_id)
        order.append(node_by_id[node_id])
        for target in adjacency.get(node_id, []):
            indegree[target] -= 1
            if indegree[target] <= 0 and target not in visited:
                queue.append(target)
    for node_id, node in node_by_id.items():
        if node_id not in visited:
            order.append(node)
    return order


def save_run(run_id: str, workflow_id: str, workflow_name: str, media: str, status: str,
             message: str, inputs: dict[str, Any], trace: list[dict[str, Any]], state: dict[str, Any],
             asset_urls: list[str], created_at: str, error: str | None = None) -> None:
    finished = status in {"succeeded", "failed"}
    payload = {
        "id": run_id,
        "workflowId": workflow_id,
        "workflowName": workflow_name,
        "media": media,
        "status": status,
        "message": message,
        "inputs": inputs,
        "outputs": {"trace": trace, "state": state},
        "assetUrls": asset_urls,
        "error": error,
        "createdAt": created_at,
        "updatedAt": now_iso(),
        "finishedAt": now_iso() if finished else None,
    }
    with db() as connection:
        connection.execute(
            "UPDATE runs SET status = ?, payload = ? WHERE id = ?",
            (status, json.dumps(payload), run_id),
        )


def execute_workflow_graph(
    workflow: dict[str, Any], run_id: str, initial_state: dict[str, Any], created_at: str, media: str,
) -> None:
    state = dict(initial_state)
    trace: list[dict[str, Any]] = []
    asset_urls: list[str] = []
    order = topological_node_order(workflow.get("nodes", []), workflow.get("edges", []))

    def persist(status: str, message: str, error: str | None = None) -> None:
        save_run(run_id, workflow["id"], workflow.get("name", ""), media, status, message,
                  initial_state, trace, state, asset_urls, created_at, error)

    for node in order:
        node_id = str(node.get("id", ""))
        node_type = str(node.get("type", ""))
        label = str(node.get("label") or node_type)
        config = node.get("config") or {}
        entry: dict[str, Any] = {"nodeId": node_id, "type": node_type, "label": label, "status": "running", "startedAt": now_iso()}
        trace.append(entry)
        persist("running", f"Đang chạy node {label}…")
        try:
            if node_type == "input":
                entry["output"] = {key: state.get(key) for key in state}
            elif node_type == "prompt":
                template = str(config.get("template") or "{{prompt}}")
                rendered = render_run_template(template, state)
                state["prompt"] = rendered
                entry["output"] = {"prompt": rendered}
            elif node_type == "video":
                provider = str(state.get("provider") or "mock").strip().lower()
                if provider == "crazyrouter":
                    model, quality = CRAZY_MVP_MODEL, "720p"
                elif provider == "atlascloud":
                    model, quality = ATLAS_MVP_MODEL, "480p"
                else:
                    provider, model, quality = "mock", "mock", "720p"
                video_body = VideoCreate(
                    prompt=str(state.get("prompt") or initial_state.get("prompt") or ""),
                    provider=provider,
                    model=model,
                    aspect_ratio=str(state.get("aspect_ratio") or "16:9"),
                    duration=int(state.get("duration") or 5),
                    quality=quality,
                    image_url=state.get("image_url"),
                )
                created = create_video(video_body)
                task_id = str(created.get("taskId") or "")
                if not task_id:
                    raise RuntimeError("Provider không trả về task ID")
                video_url = ""
                deadline = time.time() + 600
                while time.time() < deadline:
                    status_payload = video_status(task_id)
                    data = status_payload.get("data", {}) if isinstance(status_payload.get("data"), dict) else {}
                    task_state = str(data.get("state") or "")
                    if task_state == "success":
                        try:
                            result = json.loads(data.get("resultJson") or "{}")
                        except json.JSONDecodeError:
                            result = {}
                        urls = result.get("resultUrls") or []
                        video_url = str(result.get("videoUrl") or (urls[0] if urls else ""))
                        break
                    if task_state == "fail":
                        raise RuntimeError(str(data.get("failMsg") or "Provider báo lỗi khi tạo video"))
                    time.sleep(3)
                if not video_url:
                    raise RuntimeError("Hết thời gian chờ provider trả video (10 phút)")
                state["video_url"] = video_url
                if video_url not in asset_urls:
                    asset_urls.append(video_url)
                entry["output"] = {"taskId": task_id, "videoUrl": video_url}
            elif node_type == "output":
                value_path = str(config.get("value_path") or "").strip()
                key = value_path.removeprefix("state.")
                value = state.get(key) if key else None
                entry["output"] = {"value": value}
                if isinstance(value, str) and (value.startswith("http") or value.startswith("/")) and value not in asset_urls:
                    asset_urls.append(value)
            else:
                raise RuntimeError(f"Node loại '{node_type}' chưa được hỗ trợ trong backend rút gọn hiện tại.")
        except HTTPException as exc:
            entry["status"] = "failed"
            entry["error"] = str(exc.detail)
            entry["finishedAt"] = now_iso()
            persist("failed", f"Node {label} thất bại: {exc.detail}", error=str(exc.detail))
            return
        except Exception as exc:  # noqa: BLE001 - ghi loi that ve run, khong de crash thread nen
            entry["status"] = "failed"
            entry["error"] = str(exc)
            entry["finishedAt"] = now_iso()
            persist("failed", f"Node {label} thất bại: {exc}", error=str(exc))
            return
        entry["status"] = "succeeded"
        entry["finishedAt"] = now_iso()
        persist("running", f"Đã xong node {label}")

    persist("succeeded", "Hoàn tất workflow")


@app.post("/api/workflows/{workflow_id}/run")
def run_workflow_endpoint(workflow_id: str, body: WorkflowRunCreate) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy workflow")
    workflow = workflow_from_row(row)

    media = str(workflow.get("media") or "automation")
    if media == "hybrid" and body.output_mode:
        media = body.output_mode

    initial_state: dict[str, Any] = dict(body.variables or {})
    if body.prompt:
        initial_state["prompt"] = body.prompt
    if body.image_url:
        initial_state["image_url"] = body.image_url
    if body.video_url:
        initial_state["video_url"] = body.video_url
    if body.audio_url:
        initial_state["audio_url"] = body.audio_url
    initial_state["aspect_ratio"] = body.aspect_ratio
    initial_state["duration"] = body.duration
    if body.tool_id:
        initial_state["tool_id"] = body.tool_id

    run_id = secrets.token_hex(12)
    timestamp = now_iso()
    run_payload = {
        "id": run_id,
        "workflowId": workflow_id,
        "workflowName": workflow.get("name", ""),
        "media": media,
        "status": "running",
        "message": "Đang khởi động workflow…",
        "inputs": initial_state,
        "outputs": {"trace": [], "state": initial_state},
        "assetUrls": [],
        "error": None,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "finishedAt": None,
    }
    with db() as connection:
        connection.execute(
            "INSERT INTO runs(id, workflow_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)",
            (run_id, workflow_id, "running", json.dumps(run_payload), timestamp),
        )

    threading.Thread(
        target=execute_workflow_graph,
        args=(workflow, run_id, initial_state, timestamp, media),
        daemon=True,
    ).start()

    return {"run": run_payload, "mode": media}


@app.post("/api/uploads", status_code=201)
def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    suffix = Path(file.filename or "upload.bin").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".wav", ".mp3"}:
        raise HTTPException(status_code=400, detail="Định dạng tệp không được hỗ trợ")
    filename = f"{secrets.token_hex(12)}{suffix}"
    target = UPLOAD_DIR / filename
    size = 0
    with target.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > 500 * 1024 * 1024:
                output.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Tệp vượt giới hạn 500 MB")
            output.write(chunk)
    return {"ok": True, "fileName": file.filename, "url": f"/api/media/{filename}", "size": size}


@app.get("/api/media/{filename}")
def media(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    target = UPLOAD_DIR / safe_name
    if safe_name != filename or not target.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp")
    return FileResponse(target)


@app.get("/api/providers")
def providers() -> dict[str, Any]:
    atlas_configured = bool(os.getenv("ATLASCLOUD_API_KEY", "").strip())
    crazy_configured = bool(os.getenv("CRAZYROUTER_API_KEY", "").strip())
    return {
        "providers": [
            {"id": "atlascloud", "configured": atlas_configured},
            {"id": "crazyrouter", "configured": crazy_configured},
            {"id": "openai", "configured": bool(os.getenv("OPENAI_API_KEY"))},
            {"id": "replicate", "configured": bool(os.getenv("REPLICATE_API_TOKEN"))},
        ],
        "paidGenerationEnabled": atlas_configured or crazy_configured,
    }


def atlas_headers() -> dict[str, str]:
    token = os.getenv("ATLASCLOUD_API_KEY", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Chưa cấu hình ATLASCLOUD_API_KEY trong .env")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def atlas_video_payload(body: VideoCreate) -> dict[str, Any]:
    if body.provider != "atlascloud":
        raise HTTPException(status_code=400, detail="MVP cục bộ hiện chỉ hỗ trợ provider atlascloud")
    if body.model != ATLAS_MVP_MODEL:
        raise HTTPException(status_code=400, detail="MVP cục bộ hiện chỉ hỗ trợ Seedance v1 Pro Fast")
    if body.image_url or body.video_url:
        raise HTTPException(status_code=400, detail="Lần thử đầu chỉ hỗ trợ text-to-video")
    if body.aspect_ratio not in ATLAS_RATIOS:
        raise HTTPException(status_code=400, detail="Tỷ lệ video không được hỗ trợ")
    if body.quality not in {"480p", "720p", "1080p"}:
        raise HTTPException(status_code=400, detail="Độ phân giải không được hỗ trợ")
    return {
        "model": body.model,
        "prompt": body.prompt.strip(),
        "resolution": body.quality,
        "duration": body.duration,
        "aspect_ratio": body.aspect_ratio,
        "camera_fixed": False,
        "seed": -1,
    }


def crazy_headers() -> dict[str, str]:
    token = os.getenv("CRAZYROUTER_API_KEY", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Chưa cấu hình CRAZYROUTER_API_KEY trong .env")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def crazy_video_payload(body: VideoCreate) -> dict[str, Any]:
    if body.provider != "crazyrouter":
        raise HTTPException(status_code=400, detail="Provider không được hỗ trợ")
    if body.model != CRAZY_MVP_MODEL:
        raise HTTPException(status_code=400, detail="MVP cục bộ hiện chỉ hỗ trợ Kling 2.5 Turbo")
    if body.image_url or body.video_url:
        raise HTTPException(status_code=400, detail="Lần thử đầu chỉ hỗ trợ text-to-video")
    if body.aspect_ratio not in {"16:9", "9:16"}:
        raise HTTPException(status_code=400, detail="Kling MVP chỉ hỗ trợ tỷ lệ 16:9 hoặc 9:16")
    if body.quality != "720p":
        raise HTTPException(status_code=400, detail="Kling MVP hiện khóa ở 720p để kiểm soát chi phí")
    return {
        "model": body.model,
        "prompt": body.prompt.strip(),
        "duration": body.duration,
        "aspect_ratio": body.aspect_ratio,
        "size": "720P",
    }


def provider_error_detail(prefix: str, error: httpx.HTTPStatusError) -> str:
    try:
        body = error.response.json()
    except ValueError:
        text = error.response.text.strip()
        return f"{prefix}: HTTP {error.response.status_code}" + (f" — {text}" if text else "")
    message = ""
    if isinstance(body, dict):
        message = str(body.get("message") or body.get("error") or body.get("code") or "")
    return f"{prefix}: HTTP {error.response.status_code}" + (f" — {message}" if message else "")


def crazy_status_response(task_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    raw_status = str(data.get("status") or payload.get("status") or "").lower()
    video_url = str(
        data.get("result_url")
        or data.get("artifact_url")
        or data.get("video_url")
        or data.get("videoUrl")
        or payload.get("video_url")
        or ""
    )
    if not video_url:
        try:
            file_infos = data["data"]["Response"]["AigcVideoTask"]["Output"]["FileInfos"]
            if file_infos:
                video_url = str(file_infos[0].get("FileUrl") or "")
        except (KeyError, TypeError, IndexError, AttributeError):
            pass
    if raw_status in {"completed", "complete", "succeeded", "success"}:
        state = "success"
    elif raw_status in {"failed", "error", "canceled", "cancelled"}:
        state = "fail"
    elif raw_status in {"processing", "running", "generating"}:
        state = "generating"
    else:
        state = "waiting"
    result = {"resultUrls": [video_url] if video_url else []}
    if video_url:
        result["videoUrl"] = video_url
    return {
        "data": {
            "taskId": f"crazy:{task_id}",
            "state": state,
            "resultJson": json.dumps(result),
            "failMsg": data.get("error") or data.get("message") if state == "fail" else None,
        }
    }


def atlas_status_response(task_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    raw_status = str(data.get("status") or "").lower()
    outputs = data.get("outputs") if isinstance(data.get("outputs"), list) else []
    urls = [str(url) for url in outputs if isinstance(url, str) and url]
    if raw_status in {"completed", "succeeded", "success"}:
        state = "success"
    elif raw_status in {"failed", "error", "canceled", "cancelled"}:
        state = "fail"
    elif raw_status in {"processing", "running", "generating"}:
        state = "generating"
    else:
        state = "waiting"
    result = {"resultUrls": urls}
    if urls:
        result["videoUrl"] = urls[0]
    return {
        "data": {
            "taskId": task_id,
            "state": state,
            "resultJson": json.dumps(result),
            "failMsg": data.get("error") or data.get("message") if state == "fail" else None,
        }
    }


@app.get("/api/video/models")
def video_models() -> dict[str, Any]:
    return {
        "studio_provider": "crazyrouter",
        "defaults": {
            "video_budget": {"provider": "crazyrouter", "model": CRAZY_MVP_MODEL},
            "video_quality": {"provider": "crazyrouter", "model": CRAZY_MVP_MODEL},
        },
    }


@app.post("/api/video")
def create_video(body: VideoCreate) -> dict[str, Any]:
    if body.provider == "mock":
        task_id = f"mock:{secrets.token_hex(8)}"
        MOCK_TASKS[task_id] = time.time()
        return {"taskId": task_id, "status": "processing"}

    if body.provider == "crazyrouter":
        try:
            response = httpx.post(CRAZY_VIDEO_URL, headers=crazy_headers(), json=crazy_video_payload(body), timeout=30)
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise HTTPException(status_code=502, detail=provider_error_detail("CrazyRouter từ chối yêu cầu", error)) from error
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Không kết nối được CrazyRouter: {error}") from error
        payload = response.json()
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        task_id = str(data.get("task_id") or data.get("taskId") or data.get("id") or payload.get("task_id") or "").strip()
        if not task_id:
            raise HTTPException(status_code=502, detail="CrazyRouter không trả về task ID")
        return {"taskId": f"crazy:{task_id}", "status": str(data.get("status") or "processing")}

    try:
        response = httpx.post(ATLAS_VIDEO_URL, headers=atlas_headers(), json=atlas_video_payload(body), timeout=30)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("Atlas Cloud từ chối yêu cầu", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được Atlas Cloud: {error}") from error
    payload = response.json()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    task_id = str(data.get("id") or "").strip()
    if not task_id:
        raise HTTPException(status_code=502, detail="Atlas Cloud không trả về task ID")
    return {"taskId": task_id, "status": str(data.get("status") or "processing")}


@app.get("/api/video/status")
def video_status(taskId: str) -> dict[str, Any]:
    if not taskId or len(taskId) > 200:
        raise HTTPException(status_code=400, detail="Task ID không hợp lệ")
    if taskId.startswith("mock:"):
        started = MOCK_TASKS.get(taskId)
        if started is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy mock task")
        if time.time() - started < 4:
            return {"data": {"taskId": taskId, "state": "generating", "resultJson": "{}", "failMsg": None}}
        sample = UPLOAD_DIR / MOCK_VIDEO_FILENAME
        if not sample.is_file():
            return {
                "data": {
                    "taskId": taskId,
                    "state": "fail",
                    "resultJson": "{}",
                    "failMsg": f"Thiếu file mock mẫu: {MOCK_VIDEO_FILENAME} trong {UPLOAD_DIR}",
                }
            }
        video_url = f"/api-proxy/api/media/{MOCK_VIDEO_FILENAME}"
        result = {"resultUrls": [video_url], "videoUrl": video_url}
        return {"data": {"taskId": taskId, "state": "success", "resultJson": json.dumps(result), "failMsg": None}}
    if taskId.startswith("crazy:"):
        raw_task_id = taskId.removeprefix("crazy:")
        try:
            response = httpx.get(CRAZY_STATUS_URL, headers=crazy_headers(), params={"task_id": raw_task_id}, timeout=30)
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise HTTPException(status_code=502, detail=provider_error_detail("Không đọc được trạng thái CrazyRouter", error)) from error
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Không kết nối được CrazyRouter: {error}") from error
        return crazy_status_response(raw_task_id, response.json())

    try:
        response = httpx.get(f"{ATLAS_PREDICTION_URL}/{taskId}", headers=atlas_headers(), timeout=30)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("Không đọc được trạng thái Atlas Cloud", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được Atlas Cloud: {error}") from error
    return atlas_status_response(taskId, response.json())
