from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
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

OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations"
OPENAI_IMAGE_MODEL = "gpt-image-1"
MOCK_IMAGE_FILENAME = "mock-placeholder.png"

TOGETHER_CHAT_URL = "https://api.together.xyz/v1/chat/completions"
TOGETHER_IMAGE_URL = "https://api.together.xyz/v1/images/generations"
TOGETHER_DEFAULT_CHAT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
TOGETHER_DEFAULT_IMAGE_MODEL = "black-forest-labs/FLUX.2-dev"  # ~$0.0154/MP - da xac minh qua docs Together.ai, khong phai free
MOCK_AUDIO_FILENAME = "mock-placeholder.wav"

# provider="mock" — không gọi provider trả phí nào; dùng để kiểm chứng luồng UI
# (nút bấm -> /api/video -> poll -> hiển thị output) miễn phí trước khi chạy job thật.
MOCK_VIDEO_FILENAME = "kling-test-paper-boat-20260928.mp4"
MOCK_TASKS: dict[str, float] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def media_url(filename: str) -> str:
    # Web (nginx) CHI proxy duong dan bat dau bang "/api-proxy/" sang API (xem nginx.conf) - moi
    # URL tra ve de trinh duyet dung truc tiep (img/video src, link tai xuong...) PHAI co tien to
    # nay, neu khong se roi vao route React "/" va tra ve index.html thay vi file that (anh/video
    # vo hinh, naturalWidth=0). Dung ham nay o MOI noi tra url media thay vi tu ghep chuoi, tranh
    # lap lai loi da gap 3 lan (upload, anh mock, anh OpenAI - sua 2026-09-29).
    return f"/api-proxy/api/media/{filename}"


@contextmanager
def db():
    # sqlite3.Connection.__exit__ chi commit/rollback, KHONG dong connection - dung "with db()"
    # xuyen suot file ma khong tu close() se ro ri file handle (ro nhat tren Windows: file .db
    # bi giu, khong xoa/doi ten duoc). Boc lai bang contextmanager rieng de moi noi goi
    # "with db() as connection:" nhu cu van dung, nhung connection luon duoc close() that.
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


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
            CREATE TABLE IF NOT EXISTS workflow_versions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                note TEXT NOT NULL,
                snapshot TEXT NOT NULL,
                created_at TEXT NOT NULL
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


class ImageCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    provider: str = "mock"
    model: str = OPENAI_IMAGE_MODEL
    width: int = Field(default=1024, ge=256, le=4096)
    height: int = Field(default=1024, ge=256, le=4096)
    num_images: int = Field(default=1, ge=1, le=4)
    # image_url/image_urls (anh tham chieu de chinh sua/giu nhan vat) va face_id: frontend co gui
    # nhung provider hien co (mock/together/openai text-to-image) CHUA ho tro anh tham chieu that -
    # nhan roi bao loi ro rang thay vi lang le bo qua, xem create_image().
    image_url: str | None = None
    image_urls: list[str] | None = None
    generation_mode: str = "standard"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatDirectRequest(BaseModel):
    messages: list[ChatMessage]
    provider: str = "together"
    model: str | None = None


class UnifiedChatRequest(BaseModel):
    message: str = ""
    chat_id: str = ""
    messages: list[ChatMessage] = Field(default_factory=list)
    provider: str | None = None
    model: str | None = None
    skill: str = "general"
    connections: list[str] = Field(default_factory=list)
    enabled_skills: list[str] = Field(default_factory=list)
    force_agent: bool = False
    auto_model: bool = False


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


MAX_WORKFLOW_VERSIONS = 30


def save_workflow_version(connection: sqlite3.Connection, workflow: dict[str, Any], note: str) -> None:
    # Giu ban truoc khi ghi de de khoi phuc duoc; chi giu MAX_WORKFLOW_VERSIONS ban moi nhat.
    connection.execute(
        "INSERT INTO workflow_versions(id, workflow_id, note, snapshot, created_at) VALUES (?, ?, ?, ?, ?)",
        (secrets.token_hex(8), workflow["id"], note, json.dumps(workflow), now_iso()),
    )
    connection.execute(
        "DELETE FROM workflow_versions WHERE workflow_id = ? AND id NOT IN "
        "(SELECT id FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)",
        (workflow["id"], workflow["id"], MAX_WORKFLOW_VERSIONS),
    )


def workflow_version_from_row(row: sqlite3.Row) -> dict[str, Any]:
    snapshot = json.loads(row["snapshot"])
    return {
        "id": row["id"],
        "workflowId": row["workflow_id"],
        "workflowName": snapshot.get("name", ""),
        "component": bool(snapshot.get("component", False)),
        "componentName": snapshot.get("componentName", ""),
        "createdAt": row["created_at"],
        "note": row["note"],
        "snapshot": snapshot,
    }


@app.get("/api/workflows/{workflow_id}/versions")
def list_workflow_versions(workflow_id: str) -> dict[str, Any]:
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY created_at DESC, rowid DESC",
            (workflow_id,),
        ).fetchall()
    return {"versions": [workflow_version_from_row(row) for row in rows]}


class WorkflowVersionRestore(BaseModel):
    versionId: str = Field(min_length=1, max_length=80)


@app.post("/api/workflows/{workflow_id}/versions/restore")
def restore_workflow_version(workflow_id: str, body: WorkflowVersionRestore) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        version = connection.execute(
            "SELECT * FROM workflow_versions WHERE id = ? AND workflow_id = ?", (body.versionId, workflow_id)
        ).fetchone()
        if row is None or version is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên bản workflow")
        current = workflow_from_row(row)
        save_workflow_version(connection, current, "Trước khi khôi phục phiên bản cũ")
        snapshot = json.loads(version["snapshot"])
        payload = {
            key: snapshot.get(key, current[key])
            for key in (
                "description", "tags", "nodes", "edges", "category", "media",
                "published", "component", "componentName",
                "componentInputSchemaJson", "componentOutputSchemaJson",
                "metadataJson", "sourceTemplateId",
            )
        }
        connection.execute(
            "UPDATE workflows SET name = ?, payload = ?, updated_at = ? WHERE id = ?",
            (snapshot.get("name", current["name"]), json.dumps(payload), now_iso(), workflow_id),
        )
        restored = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    return workflow_from_row(restored)


@app.patch("/api/workflows/{workflow_id}")
def update_workflow(workflow_id: str, body: dict[str, Any]) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy workflow")
        current = workflow_from_row(row)
        before = dict(current)
        allowed = {
            "name", "description", "folderId", "tags", "nodes", "edges",
            "media", "published", "component", "componentName",
            "componentInputSchemaJson", "componentOutputSchemaJson",
            "metadataJson", "sourceTemplateId",
        }
        current.update({key: value for key, value in body.items() if key in allowed})
        if any(current[key] != before[key] for key in ("name", "nodes", "edges")):
            save_workflow_version(connection, before, "Tự động lưu trước khi sửa")
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
        connection.execute("DELETE FROM workflow_versions WHERE workflow_id = ?", (workflow_id,))
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
SUPPORTED_RUN_NODE_TYPES = {"input", "prompt", "video", "image", "tts", "lipsync", "output"}


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
            elif node_type == "image":
                # Rieng bien "image_provider" - KHONG dung chung "provider" voi node video, vi
                # 1 workflow co the co ca 2 node va can chon nha cung cap doc lap cho tung loai.
                image_provider = str(state.get("image_provider") or "mock").strip().lower()
                image_result = create_image(ImageCreate(
                    prompt=str(state.get("prompt") or initial_state.get("prompt") or ""),
                    provider=image_provider,
                ))
                image_url = str(image_result.get("url") or "")
                if not image_url:
                    raise RuntimeError("Provider không trả về ảnh")
                state["image_url"] = image_url
                if image_url not in asset_urls:
                    asset_urls.append(image_url)
                entry["output"] = {"imageUrl": image_url}
            elif node_type == "tts":
                # Chua co provider TTS that nao duoc cau hinh tren may nay (can them ElevenLabs
                # hoac tuong duong - dich vu tra phi moi, chua co key). CHI ho tro mock: sinh file
                # WAV cau lang bang stdlib de workflow co node TTS van chay het duoc, khong bao
                # loi oan. Bao ro rang neu chon provider khac mock thay vi gia vo tao giong that.
                tts_provider = str(state.get("tts_provider") or "mock").strip().lower()
                if tts_provider != "mock":
                    raise RuntimeError(
                        f"Provider TTS '{tts_provider}' chưa được cấu hình — cần thêm API key dịch vụ giọng nói (vd ElevenLabs) vào .env trước."
                    )
                audio_url = ensure_mock_audio()
                state["audio_url"] = audio_url
                if audio_url not in asset_urls:
                    asset_urls.append(audio_url)
                entry["output"] = {"audioUrl": audio_url}
            elif node_type == "lipsync":
                # Tuong tu TTS: chua co provider lipsync that (vd HeyGen) duoc cau hinh. Mock tra
                # lai chinh video mau da co san de workflow chay het duoc va nguoi dung thay dung
                # hinh dang ket qua cuoi, khong phai video da ghep khau hinh that.
                lipsync_provider = str(state.get("lipsync_provider") or "mock").strip().lower()
                if lipsync_provider != "mock":
                    raise RuntimeError(
                        f"Provider lipsync '{lipsync_provider}' chưa được cấu hình — cần thêm API key dịch vụ ghép khẩu hình (vd HeyGen) vào .env trước."
                    )
                sample = UPLOAD_DIR / MOCK_VIDEO_FILENAME
                if not sample.is_file():
                    raise RuntimeError(f"Thiếu file mock mẫu: {MOCK_VIDEO_FILENAME} trong {UPLOAD_DIR}")
                lipsync_url = media_url(MOCK_VIDEO_FILENAME)
                state["video_url"] = lipsync_url
                if lipsync_url not in asset_urls:
                    asset_urls.append(lipsync_url)
                entry["output"] = {"videoUrl": lipsync_url, "note": "mock — chưa ghép khẩu hình thật"}
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


# Frontend (lib/api.ts uploadMedia()) goi "/api/upload" (so it), khong phai "/api/uploads" (so
# nhieu) - lech duong dan nay khien MOI lan tai anh/video tham chieu len (AiVideoStudio, Workflow
# Hub run panel) deu 404 tu truoc gio. Dang ky ca 2 duong dan tro chung 1 ham de an toan nguoc.
@app.post("/api/upload", status_code=201)
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
    return {"ok": True, "fileName": file.filename, "url": media_url(filename), "size": size}


@app.get("/api/media/{filename}")
def media(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    target = UPLOAD_DIR / safe_name
    if safe_name != filename or not target.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp")
    return FileResponse(target)


@app.get("/api/download")
def download(url: str, filename: str = "notiagent-download") -> Any:
    # "Tai san pham ve" - frontend goi endpoint nay (studioMediaDownloadUrl) de ep trinh duyet
    # tai xuong dung ten file, ke ca khi asset that su nam o CDN provider ngoai (tranh CORS/loi
    # thieu Content-Disposition tu server ngoai). Truoc day endpoint nay khong ton tai -> nut
    # Tai xuong tren UI se loi.
    safe_name = Path(filename).name.replace("/", "_").replace("\\", "_") or "notiagent-download"

    if url.startswith("/api/media/") or url.startswith("/api-proxy/api/media/"):
        target = UPLOAD_DIR / Path(url).name
        if not target.is_file():
            raise HTTPException(status_code=404, detail="Không tìm thấy tệp")
        return FileResponse(target, filename=safe_name)

    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL không hợp lệ")

    try:
        with httpx.stream("GET", url, timeout=60, follow_redirects=True) as upstream:
            upstream.raise_for_status()
            content_type = upstream.headers.get("content-type", "application/octet-stream")
            chunks: list[bytes] = []
            size = 0
            for chunk in upstream.iter_bytes():
                size += len(chunk)
                if size > 500 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Tệp vượt giới hạn 500 MB")
                chunks.append(chunk)
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("Không tải được tệp gốc", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được nguồn tệp: {error}") from error

    from fastapi.responses import Response as RawResponse
    return RawResponse(
        content=b"".join(chunks),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@app.get("/api/providers")
def providers() -> dict[str, Any]:
    atlas_configured = bool(os.getenv("ATLASCLOUD_API_KEY", "").strip())
    crazy_configured = bool(os.getenv("CRAZYROUTER_API_KEY", "").strip())
    together_configured = bool(os.getenv("TOGETHER_API_KEY", "").strip())
    return {
        "providers": [
            {"id": "atlascloud", "configured": atlas_configured},
            {"id": "crazyrouter", "configured": crazy_configured},
            {"id": "openai", "configured": bool(os.getenv("OPENAI_API_KEY"))},
            {"id": "replicate", "configured": bool(os.getenv("REPLICATE_API_TOKEN"))},
            {"id": "together", "configured": together_configured},
        ],
        "paidGenerationEnabled": atlas_configured or crazy_configured,
        # ChatWorkspace.tsx doc providers.chat.configured de biet model nao bam duoc (isModelAvailable
        # trong lib/models.ts) - openrouter/novita/gemini chua co key that nao o may nay nen bao false
        # ro rang, thay vi de trong (truoc day khong co key "chat" nen moi model hien "bam duoc" du
        # khong that su goi noi).
        "chat": {
            "configured": {
                "together": together_configured,
                "openrouter": False,
                "novita": False,
                "gemini": False,
            }
        },
    }


def atlas_headers() -> dict[str, str]:
    token = os.getenv("ATLASCLOUD_API_KEY", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Chưa cấu hình ATLASCLOUD_API_KEY trong .env")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def atlas_video_payload(body: VideoCreate) -> dict[str, Any]:
    if body.provider != "atlascloud":
        raise HTTPException(status_code=400, detail="MVP cục bộ hiện chỉ hỗ trợ provider atlascloud")
    # Truoc day chi cung nhan dung 1 model MVP (Seedance v1 Pro Fast) - da noi long de catalog
    # video moi (Seedance 2.5, Veo 3.1 Atlas Cloud...) dung duoc that khi nguoi dung them
    # ATLASCLOUD_API_KEY, thay vi luon bao loi "chi ho tro Seedance v1 Pro Fast" cho moi model
    # khac. Van chi nhan model dang dung dinh dang "<hang>/<model>/text-to-video" (khop convention
    # Atlas Cloud that, xem videoModels.ts).
    if not body.model or "/" not in body.model:
        raise HTTPException(status_code=400, detail=f"Model Atlas Cloud không hợp lệ: '{body.model}'")
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


# Retry co gioi han cho loi mang tam thoi voi provider (khong retry loi HTTP 4xx/5xx that -
# vd quota_not_enough se khong tu het bang cach goi lai). POST tao video CHI retry khi ket noi
# chua he thanh lap (ConnectError/ConnectTimeout) - luc do provider chac chan chua nhan duoc
# request nen goi lai an toan, khong tao trung job tinh phi. ReadTimeout (da gui request, chi la
# cho phan hoi lau) KHONG retry cho POST vi khong biet provider da xu ly hay chua.
def post_with_retry(url: str, *, headers: dict[str, str], json_body: dict[str, Any], timeout: float = 30, retries: int = 2) -> httpx.Response:
    last_error: httpx.HTTPError | None = None
    for attempt in range(retries + 1):
        try:
            return httpx.post(url, headers=headers, json=json_body, timeout=timeout)
        except (httpx.ConnectError, httpx.ConnectTimeout) as error:
            last_error = error
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


# GET trang thai la read-only (idempotent) - an toan retry moi loai loi mang tam thoi.
def get_with_retry(url: str, *, headers: dict[str, str], params: dict[str, str] | None = None, timeout: float = 30, retries: int = 2) -> httpx.Response:
    last_error: httpx.HTTPError | None = None
    for attempt in range(retries + 1):
        try:
            return httpx.get(url, headers=headers, params=params, timeout=timeout)
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as error:
            last_error = error
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


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


# --- Tao anh -----------------------------------------------------------------
# Cung mo hinh nhu video: provider="mock" (mac dinh, mien phi, dung de kiem chung workflow
# node "image" chay dung ma khong tra tien) + provider="openai" (that, can OPENAI_API_KEY
# trong .env - hien CHUA co key nao duoc cau hinh tren may nay, xem HANDOFF-CLAUDE-CODE.md).
def make_placeholder_png(width: int = 768, height: int = 768, color: tuple[int, int, int] = (99, 102, 241)) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        import struct
        import zlib
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    import struct
    import zlib

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = bytes([0]) + bytes(color) * width
    raw = row * height
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def ensure_mock_image() -> str:
    target = UPLOAD_DIR / MOCK_IMAGE_FILENAME
    if not target.is_file():
        target.write_bytes(make_placeholder_png())
    return media_url(MOCK_IMAGE_FILENAME)


def make_placeholder_wav(seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    import io
    import wave

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * int(sample_rate * seconds))
    return buffer.getvalue()


def ensure_mock_audio() -> str:
    target = UPLOAD_DIR / MOCK_AUDIO_FILENAME
    if not target.is_file():
        target.write_bytes(make_placeholder_wav())
    return media_url(MOCK_AUDIO_FILENAME)


def openai_headers() -> dict[str, str]:
    token = os.getenv("OPENAI_API_KEY", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Chưa cấu hình OPENAI_API_KEY trong .env")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def together_headers() -> dict[str, str]:
    token = os.getenv("TOGETHER_API_KEY", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Chưa cấu hình TOGETHER_API_KEY trong .env")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def save_image_bytes(data: bytes) -> str:
    extension = "jpg" if data[:3] == bytes([0xFF, 0xD8, 0xFF]) else "png"
    filename = f"{secrets.token_hex(12)}.{extension}"
    (UPLOAD_DIR / filename).write_bytes(data)
    return media_url(filename)


def save_b64_image(b64_data: str) -> str:
    import base64
    return save_image_bytes(base64.b64decode(b64_data))


def extract_image_urls(items: list[dict[str, Any]], localize: bool = False) -> list[str]:
    # localize=True: link anh cua provider (vd Together `shrt`) la link tam, se het han - tai ve
    # luu vao UPLOAD_DIR de giu lau dai; loi tai ve thi van tra link goc (khong mat ket qua).
    urls: list[str] = []
    for item in items:
        b64 = item.get("b64_json")
        if b64:
            urls.append(save_b64_image(b64))
        elif item.get("url"):
            remote = str(item["url"])
            if localize:
                try:
                    downloaded = httpx.get(remote, timeout=60, follow_redirects=True)
                    downloaded.raise_for_status()
                    remote = save_image_bytes(downloaded.content)
                except httpx.HTTPError:
                    pass
            urls.append(remote)
    return urls


TOGETHER_MAX_PIXELS = 4_194_304  # FLUX.2: toi da ~4MP, canh la boi so cua 16


def fit_together_dimensions(width: int, height: int) -> tuple[int, int]:
    scale = min(1.0, (TOGETHER_MAX_PIXELS / (width * height)) ** 0.5)
    return tuple(max(256, int(round(side * scale / 16)) * 16) for side in (width, height))  # type: ignore[return-value]


def create_image(body: ImageCreate) -> dict[str, Any]:
    if body.image_url or body.image_urls:
        raise HTTPException(status_code=400, detail="Ảnh tham chiếu (chỉnh sửa/giữ nhân vật) chưa được hỗ trợ ở backend rút gọn này — chỉ tạo ảnh mới từ prompt.")
    if body.generation_mode == "face_id":
        raise HTTPException(status_code=400, detail="FaceID chưa được hỗ trợ ở backend rút gọn này.")

    if body.provider == "mock":
        url = ensure_mock_image()
        urls = [url] * body.num_images
        return {"ok": True, "url": url, "imageUrl": url, "imageUrls": urls, "provider": "mock"}

    if body.provider == "together":
        together_width, together_height = fit_together_dimensions(body.width, body.height)
        payload = {
            "model": body.model if body.model and body.model != OPENAI_IMAGE_MODEL else TOGETHER_DEFAULT_IMAGE_MODEL,
            "prompt": body.prompt.strip(),
            "width": together_width,
            "height": together_height,
            "steps": 4,
            "n": body.num_images,
            "response_format": "base64",
        }
        try:
            response = post_with_retry(TOGETHER_IMAGE_URL, headers=together_headers(), json_body=payload, timeout=60)
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise HTTPException(status_code=502, detail=provider_error_detail("Together.ai từ chối yêu cầu", error)) from error
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Không kết nối được Together.ai: {error}") from error
        urls = extract_image_urls(response.json().get("data") or [], localize=True)
        if not urls:
            raise HTTPException(status_code=502, detail="Together.ai không trả về ảnh hợp lệ")
        return {"ok": True, "url": urls[0], "imageUrl": urls[0], "imageUrls": urls, "provider": "together"}

    if body.provider != "openai":
        raise HTTPException(status_code=400, detail=f"Provider ảnh '{body.provider}' chưa được hỗ trợ")

    payload = {
        "model": body.model or OPENAI_IMAGE_MODEL,
        "prompt": body.prompt.strip(),
        "size": f"{body.width}x{body.height}",
        "n": body.num_images,
    }
    try:
        response = post_with_retry(OPENAI_IMAGE_URL, headers=openai_headers(), json_body=payload, timeout=60)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("OpenAI từ chối yêu cầu", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được OpenAI: {error}") from error

    urls = extract_image_urls(response.json().get("data") or [])
    if not urls:
        raise HTTPException(status_code=502, detail="OpenAI không trả về ảnh hợp lệ")
    return {"ok": True, "url": urls[0], "imageUrl": urls[0], "imageUrls": urls, "provider": "openai"}


@app.post("/api/image", status_code=201)
def create_image_endpoint(body: ImageCreate) -> dict[str, Any]:
    return create_image(body)


def together_chat_completion(messages: list[dict[str, str]], model: str | None = None) -> str:
    payload = {
        "model": model or TOGETHER_DEFAULT_CHAT_MODEL,
        "messages": messages,
        "max_tokens": 2048,
    }
    try:
        response = post_with_retry(TOGETHER_CHAT_URL, headers=together_headers(), json_body=payload, timeout=90)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("Together.ai từ chối yêu cầu", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được Together.ai: {error}") from error
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="Together.ai không trả về nội dung")
    content = choices[0].get("message", {}).get("content")
    if not content:
        raise HTTPException(status_code=502, detail="Together.ai trả về nội dung rỗng")
    return str(content)


@app.post("/api/chat")
def chat_direct(body: ChatDirectRequest) -> dict[str, Any]:
    # provider trong body chi la nhan hien thi cua frontend (novita/openrouter/gemini...) - backend
    # rut gon nay CHI co Together.ai that su noi day, nen luon dung Together bat ke gia tri provider
    # gui len, thay vi bao loi "chua ho tro" cho moi request (Together la provider duy nhat duoc cau
    # hinh o may nay - xem HANDOFF-CLAUDE-CODE.md).
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    content = together_chat_completion(messages, body.model)
    return {"content": content, "provider": "together", "model": body.model or TOGETHER_DEFAULT_CHAT_MODEL}


@app.post("/api/chat/unified")
def chat_unified(body: UnifiedChatRequest) -> dict[str, Any]:
    history = [{"role": m.role, "content": m.content} for m in body.messages]
    history.append({"role": "user", "content": body.message})
    model = body.model or TOGETHER_DEFAULT_CHAT_MODEL
    reply = together_chat_completion(history, model)
    if body.force_agent:
        # Chua noi tool that nao (n8n/browser/search) - VPS cu lam nhung viec nay da het han, chua
        # xay lai. Van tra loi that qua LLM nhung gan co "fallback" dung dinh dang UI da thiet ke
        # san cho truong hop nay (xem ChatWorkspace.tsx: fallback=true -> hien "Agent fallback...").
        return {
            "reply": reply,
            "mode": "agent",
            "tools": False,
            "fallback": True,
            "provider": "together",
            "model": model,
            "resolved_label": "Together.ai (chưa nối công cụ tự động)",
        }
    return {
        "reply": reply,
        "mode": "chat",
        "tools": False,
        "provider": "together",
        "model": model,
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
            response = post_with_retry(CRAZY_VIDEO_URL, headers=crazy_headers(), json_body=crazy_video_payload(body))
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
        response = post_with_retry(ATLAS_VIDEO_URL, headers=atlas_headers(), json_body=atlas_video_payload(body))
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
            response = get_with_retry(CRAZY_STATUS_URL, headers=crazy_headers(), params={"task_id": raw_task_id})
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise HTTPException(status_code=502, detail=provider_error_detail("Không đọc được trạng thái CrazyRouter", error)) from error
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Không kết nối được CrazyRouter: {error}") from error
        return crazy_status_response(raw_task_id, response.json())

    try:
        response = get_with_retry(f"{ATLAS_PREDICTION_URL}/{taskId}", headers=atlas_headers())
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=provider_error_detail("Không đọc được trạng thái Atlas Cloud", error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Không kết nối được Atlas Cloud: {error}") from error
    return atlas_status_response(taskId, response.json())
