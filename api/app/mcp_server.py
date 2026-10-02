"""MCP server cho NotiAgent: cho Claude (chat/Cowork) tao anh/video tu A-Z ngay trong khung chat.

Chay (stdio) trong container API:  docker exec -i notiagent-local-api-1 python -m app.mcp_server
Goi lai chinh API FastAPI o 127.0.0.1:8780 (cung code da kiem chung), nen moi provider/test deu dung chung.

AN TOAN CHI PHI: moi tool tra tien PHAI co approved_cost_usd >= uoc tinh (nguoi dung da xac nhan trong chat);
thieu thi chi tra bang uoc tinh va KHONG goi nha cung cap. test_mode=True dung provider mock (mien phi).
"""
from __future__ import annotations

import io
import json
import math
import os
import re
import secrets
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx
import base64

from mcp.server.fastmcp import FastMCP
from mcp.types import ContentBlock, ImageContent, TextContent

API_URL = os.getenv("NOTIAGENT_API_URL", "http://127.0.0.1:8780").rstrip("/")
DATA_DIR = Path(os.getenv("NOTIAGENT_DATA_DIR", "/data"))
MEDIA_DIR = DATA_DIR / "media"
INBOX_DIR = DATA_DIR / "inbox"
HOST_DATA_ROOT = os.getenv("NOTIAGENT_HOST_DATA_ROOT", "D:/NotiAgentData").rstrip("/\\")
WEB_PORT = os.getenv("NOTIAGENT_WEB_PORT", "8080")
MEDIA_URL_PREFIX = "/api-proxy/api/media/"
USD_PER_CREDIT = 0.01


def _text(value: str) -> TextContent:
    return TextContent(type="text", text=value)


def _jpeg(data: bytes) -> ImageContent:
    return ImageContent(type="image", data=base64.b64encode(data).decode(), mimeType="image/jpeg")

# Gia THAT (GET https://api.together.xyz/v1/models, pricing.video, 2026-09-30). USD / giay video.
VIDEO_PRICES: dict[str, dict[str, float]] = {
    "ByteDance/Seedance-2.0": {"default": 0.16},  # 720p; 480p chua cong bo -> tinh cung muc (uoc tinh cao, an toan)
    "ByteDance/Seedance-2.5": {"480p": 0.115, "720p": 0.249},
    "MiniMaxAI/MiniMax-H3": {"default": 0.1391},
}
VIDEO_LIMITS: dict[str, tuple[int, int]] = {  # (min, max) giay
    "ByteDance/Seedance-2.0": (4, 15),
    "ByteDance/Seedance-2.5": (4, 30),
    "MiniMaxAI/MiniMax-H3": (6, 15),
}
# USD / megapixel (docs Together).
IMAGE_PRICES_PER_MP = {
    "black-forest-labs/FLUX.2-dev": 0.0154,
    "black-forest-labs/FLUX.2-pro": 0.03,
}
DEFAULT_VIDEO_MODEL = "ByteDance/Seedance-2.0"
DEFAULT_IMAGE_MODEL = "black-forest-labs/FLUX.2-dev"

mcp = FastMCP(
    "notiagent",
    instructions=(
        "NotiAgent: tao anh/video AI cua Sep Ma ngay trong chat. QUY TRINH: (1) uoc tinh chi phi bang estimate_cost; "
        "(2) NOI cho nguoi dung chi phi (credit va USD) va CHO ho dong y ro rang trong chat; (3) chi khi do goi create_image/"
        "create_video voi approved_cost_usd = so tien da duoc dong y; (4) video chay nen: goi get_video(task_id) lap lai cho toi khi xong; "
        "(5) xem anh khung hinh QC tra ve va bao cao trung thuc (khong noi da nghe/xem neu khong co bang chung). "
        "Muon thu mien phi thi dung test_mode=true. Khong bao gio tu y tra tien khi chua co xac nhan."
    ),
)


# ---------------------------------------------------------------- tinh toan thuan (co unit test)
def usd_to_credits(usd: float) -> int:
    return 0 if usd <= 0 else max(1, math.ceil(usd / USD_PER_CREDIT - 1e-9))


def estimate_video_usd(model: str, seconds: int, resolution: str = "720p") -> float:
    prices = VIDEO_PRICES.get(model)
    if prices is None:
        raise ValueError(f"Chua co bang gia xac thuc cho model video '{model}'. Model co gia: {', '.join(VIDEO_PRICES)}")
    lo, hi = VIDEO_LIMITS[model]
    if not lo <= seconds <= hi:
        raise ValueError(f"{model} chi nhan {lo}-{hi} giay (da yeu cau {seconds}).")
    per_second = prices.get(resolution.lower(), prices.get("default"))
    if per_second is None:
        raise ValueError(f"{model} chi ho tro do phan giai: {', '.join(k for k in prices if k != 'default')}")
    return round(per_second * seconds, 4)


RATIO_RE = re.compile(r"^(\d+):(\d+)$")
LONG_EDGE = {"1K": 1024, "2K": 2048}


def image_dimensions(ratio: str, resolution: str = "1K") -> tuple[int, int]:
    match = RATIO_RE.match(ratio)
    if not match or resolution.upper() not in LONG_EDGE:
        raise ValueError("ratio dang '16:9', resolution '1K' hoac '2K'")
    rw, rh = int(match.group(1)), int(match.group(2))
    long_edge = LONG_EDGE[resolution.upper()]

    def r16(value: float) -> int:
        return max(256, int(round(value / 16)) * 16)

    return (r16(long_edge), r16(long_edge * rh / rw)) if rw >= rh else (r16(long_edge * rw / rh), r16(long_edge))


def estimate_image_usd(model: str, width: int, height: int, num_images: int = 1) -> float:
    per_mp = IMAGE_PRICES_PER_MP.get(model)
    if per_mp is None:
        raise ValueError(f"Chua co bang gia xac thuc cho model anh '{model}'. Model co gia: {', '.join(IMAGE_PRICES_PER_MP)}")
    return round(per_mp * max(1.0, width * height / 1_000_000) * max(1, num_images), 4)


def check_approval(estimate_usd: float, approved_cost_usd: float | None) -> str | None:
    """None neu duoc phep goi nha cung cap; nguoc lai tra thong bao (khong tra tien)."""
    credits = usd_to_credits(estimate_usd)
    if approved_cost_usd is None or approved_cost_usd + 1e-9 < estimate_usd:
        return (
            f"CHUA TRA TIEN. Uoc tinh: {credits} credit (${estimate_usd:.3f}). Hay hoi nguoi dung co dong y chi phi nay khong; "
            f"neu dong y, goi lai voi approved_cost_usd={estimate_usd}. Hoac dung test_mode=true de thu mien phi."
        )
    return None


# ---------------------------------------------------------------- tien ich
def _host_path(path: Path) -> str:
    return f"{HOST_DATA_ROOT}/{path.relative_to(DATA_DIR).as_posix()}"


def _web_url(filename: str) -> str:
    return f"http://127.0.0.1:{WEB_PORT}{MEDIA_URL_PREFIX}{filename}"


def _api(method: str, path: str, **kwargs: Any) -> Any:
    try:
        response = httpx.request(method, f"{API_URL}{path}", timeout=kwargs.pop("timeout", 120), **kwargs)
    except httpx.HTTPError as error:
        raise RuntimeError(f"Khong goi duoc API NotiAgent ({API_URL}): {error}") from error
    if response.status_code >= 400:
        raise RuntimeError(f"API NotiAgent loi {response.status_code}: {response.text[:400]}")
    return response.json()


def _jpeg_bytes(path: Path, max_width: int = 1024) -> bytes:
    from PIL import Image as PILImage

    with PILImage.open(path) as source:
        picture = source.convert("RGB")
        if picture.width > max_width:
            picture = picture.resize((max_width, round(picture.height * max_width / picture.width)))
        buffer = io.BytesIO()
        picture.save(buffer, "JPEG", quality=85)
        return buffer.getvalue()


def _ffmpeg() -> str:
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _media_path(name: str) -> Path:
    path = MEDIA_DIR / Path(name.replace(MEDIA_URL_PREFIX, "")).name
    if not path.is_file():
        raise FileNotFoundError(f"Khong thay file '{path.name}' trong thu muc media")
    return path


def probe_video(path: Path) -> dict[str, Any]:
    """Thong tin co ban + do to am thanh (khong can ffprobe)."""
    ffmpeg = _ffmpeg()
    info = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    duration = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    seconds = (int(duration.group(1)) * 3600 + int(duration.group(2)) * 60 + float(duration.group(3))) if duration else None
    video = re.search(r"Video: (\w+).*?(\d{3,5})x(\d{3,5}).*?([\d.]+) fps", info)
    has_audio = "Audio:" in info
    result: dict[str, Any] = {
        "duration_s": round(seconds, 2) if seconds else None,
        "video": f"{video.group(1)} {video.group(2)}x{video.group(3)} {video.group(4)}fps" if video else None,
        "has_audio": has_audio,
    }
    if has_audio:
        levels = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", str(path), "-af", "volumedetect", "-vn", "-f", "null", "-"],
            capture_output=True, text=True,
        ).stderr
        mean = re.search(r"mean_volume: (-?[\d.]+) dB", levels)
        peak = re.search(r"max_volume: (-?[\d.]+) dB", levels)
        result["mean_volume_db"] = float(mean.group(1)) if mean else None
        result["peak_volume_db"] = float(peak.group(1)) if peak else None
    return result


def contact_sheet(path: Path, frames: int = 6, columns: int = 3, width: int = 480) -> bytes:
    """Luoi cac khung hinh deu nhau de QC bang mat (Claude nhin duoc anh)."""
    from PIL import Image as PILImage

    seconds = probe_video(path).get("duration_s") or 1.0
    tmp = Path(f"/tmp/qc_{secrets.token_hex(4)}")
    tmp.mkdir(parents=True, exist_ok=True)
    try:
        shots = []
        for index in range(frames):
            moment = min(seconds - 0.05, seconds * (index + 0.5) / frames)
            target = tmp / f"f{index}.jpg"
            subprocess.run(
                [_ffmpeg(), "-v", "error", "-y", "-ss", f"{moment:.2f}", "-i", str(path), "-frames:v", "1",
                 "-vf", f"scale={width}:-2", str(target)],
                check=True, capture_output=True,
            )
            shots.append(PILImage.open(target).convert("RGB"))
        rows = math.ceil(len(shots) / columns)
        cell_h = max(s.height for s in shots)
        sheet = PILImage.new("RGB", (width * columns, cell_h * rows), (16, 16, 16))
        for index, shot in enumerate(shots):
            sheet.paste(shot, ((index % columns) * width, (index // columns) * cell_h))
        buffer = io.BytesIO()
        sheet.save(buffer, "JPEG", quality=80)
        return buffer.getvalue()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _resolve_reference(name: str) -> str:
    """Ten file trong inbox/media -> duong dan media ma backend doc duoc."""
    base = Path(name.replace(MEDIA_URL_PREFIX, "")).name
    if (MEDIA_DIR / base).is_file():
        return f"{MEDIA_URL_PREFIX}{base}"
    source = INBOX_DIR / base
    if source.is_file():
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        target = f"ref-{secrets.token_hex(6)}{source.suffix.lower()}"
        shutil.copyfile(source, MEDIA_DIR / target)
        return f"{MEDIA_URL_PREFIX}{target}"
    raise FileNotFoundError(f"Khong thay anh tham chieu '{base}' trong inbox ({_host_path(INBOX_DIR)}) hoac media")


# ---------------------------------------------------------------- tools
@mcp.tool()
def notiagent_status() -> str:
    """Xem NotiAgent san sang chua: nha cung cap nao co khoa API, model + gia, thu muc de tha anh tham chieu."""
    providers = _api("GET", "/api/providers", timeout=20)
    configured = [p["id"] for p in providers.get("providers", []) if p.get("configured")]
    lines = [
        f"Nha cung cap da co khoa: {', '.join(configured) or 'chua co'}",
        "Video (Together.ai): " + "; ".join(f"{m} (gia/giay: {v})" for m, v in VIDEO_PRICES.items()),
        "Anh (Together.ai): " + "; ".join(f"{m} (${p}/megapixel)" for m, p in IMAGE_PRICES_PER_MP.items()),
        f"Thu muc tha anh tham chieu (inbox): {_host_path(INBOX_DIR)}",
        f"Anh/video tao ra nam o: {_host_path(MEDIA_DIR)}",
        "Thu mien phi: them test_mode=true vao create_image/create_video.",
    ]
    return "\n".join(lines)


@mcp.tool()
def estimate_cost(
    kind: str,
    model: str = "",
    duration_seconds: int = 10,
    resolution: str = "720p",
    ratio: str = "1:1",
    num_images: int = 1,
) -> str:
    """Uoc tinh chi phi TRUOC khi tao. kind='video' (dung duration_seconds, resolution '480p'/'720p') hoac kind='image'
    (dung ratio vd '16:9', resolution '1K'/'2K', num_images). Luon bao nguoi dung ket qua va cho dong y."""
    if kind == "video":
        model = model or DEFAULT_VIDEO_MODEL
        usd = estimate_video_usd(model, duration_seconds, resolution)
        detail = f"{model}, {duration_seconds}s, {resolution}"
    elif kind == "image":
        model = model or DEFAULT_IMAGE_MODEL
        width, height = image_dimensions(ratio, resolution)
        usd = estimate_image_usd(model, width, height, num_images)
        detail = f"{model}, {width}x{height}, {num_images} anh"
    else:
        raise ValueError("kind phai la 'video' hoac 'image'")
    return f"Uoc tinh {kind}: {usd_to_credits(usd)} credit (${usd:.3f}) - {detail}. (1 credit ~ $0.01; day la UOC TINH)"


@mcp.tool()
def list_inbox() -> str:
    """Liet ke anh tham chieu da tha vao thu muc inbox + file moi nhat trong media."""
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    inbox = sorted(p.name for p in INBOX_DIR.iterdir() if p.is_file())
    media = sorted((p for p in MEDIA_DIR.iterdir() if p.is_file()), key=lambda p: p.stat().st_mtime, reverse=True)[:10] if MEDIA_DIR.exists() else []
    return (
        f"Inbox ({_host_path(INBOX_DIR)}): {', '.join(inbox) or 'trong - tha anh nhan vat/boi canh vao day'}\n"
        f"Media moi nhat: {', '.join(p.name for p in media) or 'chua co'}"
    )


@mcp.tool()
def import_reference_from_url(url: str) -> str:
    """Tai anh tham chieu tu mot link (http/https) vao NotiAgent, tra ten file de dung lam reference_image."""
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError("Chi nhan link http/https")
    response = httpx.get(url, timeout=60, follow_redirects=True)
    response.raise_for_status()
    suffix = ".png" if response.content[:4] == b"\x89PNG" else ".jpg"
    name = f"ref-{secrets.token_hex(6)}{suffix}"
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    (MEDIA_DIR / name).write_bytes(response.content)
    return f"Da luu anh tham chieu: {name} ({len(response.content) // 1024} KB). Dung reference_image='{name}'."


@mcp.tool()
def create_image(
    prompt: str,
    ratio: str = "1:1",
    resolution: str = "1K",
    num_images: int = 1,
    model: str = DEFAULT_IMAGE_MODEL,
    approved_cost_usd: float | None = None,
    test_mode: bool = False,
) -> list[ContentBlock]:
    """Tao anh (Character Sheet, khung dau...) bang FLUX.2 qua Together.ai. Tra phi: can approved_cost_usd (nguoi dung da dong y,
    xem estimate_cost). test_mode=true = anh mau mien phi. Tra ve anh de xem ngay trong chat + duong dan file."""
    width, height = image_dimensions(ratio, resolution)
    estimate = estimate_image_usd(model, width, height, num_images) if not test_mode else 0.0
    if not test_mode:
        blocked = check_approval(estimate, approved_cost_usd)
        if blocked:
            return [_text(blocked)]
    result = _api(
        "POST", "/api/image", timeout=180,
        json={"prompt": prompt, "provider": "mock" if test_mode else "together", "model": model,
              "width": width, "height": height, "num_images": num_images},
    )
    urls = result.get("imageUrls") or [result.get("imageUrl")]
    paths = [_media_path(u) for u in urls if u]
    output: list[ContentBlock] = [
        _text(
            f"Xong {len(paths)} anh ({'TEST mien phi' if test_mode else f'${estimate:.3f}'}). File: "
            + "; ".join(f"{_host_path(p)} (ten: {p.name})" for p in paths)
        )
    ]
    output.extend(_jpeg(_jpeg_bytes(p)) for p in paths)
    return output


@mcp.tool()
def create_video(
    prompt: str,
    duration_seconds: int = 10,
    resolution: str = "720p",
    ratio: str = "16:9",
    reference_image: str = "",
    model: str = DEFAULT_VIDEO_MODEL,
    with_audio: bool = True,
    approved_cost_usd: float | None = None,
    test_mode: bool = False,
) -> str:
    """Tao video bang Seedance (Together.ai). Tra phi: BAT BUOC approved_cost_usd (nguoi dung da dong y chi phi trong chat).
    reference_image = ten file trong inbox/media de giu nhan vat. Am thanh (nhac, thoai) mo ta ngay trong prompt.
    Tra ve task_id; goi get_video(task_id) de cho ket qua. test_mode=true = thu mien phi (video mau)."""
    estimate = 0.0 if test_mode else estimate_video_usd(model, duration_seconds, resolution)
    if not test_mode:
        blocked = check_approval(estimate, approved_cost_usd)
        if blocked:
            return blocked
    body: dict[str, Any] = {
        "prompt": prompt,
        "provider": "mock" if test_mode else "together",
        "model": "mock" if test_mode else model,
        "aspect_ratio": ratio,
        "duration": duration_seconds,
        "quality": resolution,
        "generate_audio": with_audio,
    }
    if reference_image:
        body["image_url"] = _resolve_reference(reference_image)
    created = _api("POST", "/api/video", json=body, timeout=180)
    task_id = created["taskId"]
    return (
        f"Da gui yeu cau tao video ({'TEST mien phi' if test_mode else f'${estimate:.3f}'}). task_id={task_id}. "
        "Video can vai phut: goi get_video(task_id) de kiem tra va nhan ket qua."
    )


@mcp.tool()
def get_video(task_id: str, wait_seconds: int = 45) -> list[ContentBlock]:
    """Kiem tra tien do video (cho toi da wait_seconds, mac dinh 45). Khi xong: tra duong dan file + thong tin (do dai,
    co am thanh, do to) + luoi khung hinh de QC. Chua xong thi goi lai."""
    deadline = time.time() + max(0, min(wait_seconds, 55))
    while True:
        status = _api("GET", "/api/video/status", params={"taskId": task_id}, timeout=60)["data"]
        state = status.get("state")
        if state in ("success", "fail") or time.time() >= deadline:
            break
        time.sleep(5)
    if state == "fail":
        return [_text(f"Tao video THAT BAI: {status.get('failMsg') or 'khong ro ly do'}")]
    if state != "success":
        return [_text(f"Dang xu ly (trang thai: {state}). Goi lai get_video('{task_id}') sau it phut.")]
    result = json.loads(status.get("resultJson") or "{}")
    video_url = result.get("videoUrl") or (result.get("resultUrls") or [""])[0]
    path = _media_path(video_url)
    return _qc_report(path)


def _qc_report(path: Path) -> list[ContentBlock]:
    info = probe_video(path)
    audio = "co am thanh" if info["has_audio"] else "KHONG co am thanh"
    if info.get("mean_volume_db") is not None:
        audio += f" (to trung binh {info['mean_volume_db']} dB, dinh {info['peak_volume_db']} dB)"
    text = (
        f"Video xong: {_host_path(path)}\nXem trong trinh duyet: {_web_url(path.name)}\n"
        f"Thong so: {info['video']}, dai {info['duration_s']}s, {audio}.\n"
        "Duoi day la luoi 6 khung hinh deu nhau de QC. Chi nhan xet nhung gi THAY duoc trong cac khung; "
        "khong the nghe am thanh qua cong cu nay - chi bao thong so am thanh o tren."
    )
    return [_text(text), _jpeg(contact_sheet(path))]


@mcp.tool()
def qc_video(filename: str) -> list[ContentBlock]:
    """Kiem tra chat luong mot video da co trong media (ten file): thong so + luoi 6 khung hinh."""
    return _qc_report(_media_path(filename))


if __name__ == "__main__":
    mcp.run()
