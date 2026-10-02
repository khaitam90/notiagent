"""Dong lenh cho Claude Code (khung chat Code) tao anh/video tu A-Z bang NotiAgent.

Chay:  docker exec -i notiagent-local-api-1 python -m app.studio_cli <lenh> ...
Dung lai logic cua mcp_server.py (cung bang gia, cung hang rao chi phi). Moi lenh tra tien PHAI co --approved <USD>
= so tien nguoi dung da dong y trong chat; thieu thi chi in uoc tinh va KHONG goi nha cung cap. --test = mien phi (mock).
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

from . import mcp_server as core

LEDGER = core.LEDGER
log_spend = core.log_spend
ledger_total = core.ledger_total


def _prompt(args: argparse.Namespace) -> str:
    text = sys.stdin.read() if args.prompt_stdin else (args.prompt or "")
    if not text.strip():
        raise SystemExit("Thieu prompt (--prompt '...' hoac --prompt-stdin)")
    return text.strip()


def cmd_status(_: argparse.Namespace) -> None:
    print(core.notiagent_status())
    total, count = ledger_total()
    print(f"Da chi (so sach NotiAgent): ${total:.3f} qua {count} lan tao.")


def cmd_estimate(args: argparse.Namespace) -> None:
    print(core.estimate_cost(args.kind, args.model, args.seconds, args.resolution, args.ratio, args.n))


def cmd_inbox(_: argparse.Namespace) -> None:
    print(core.list_inbox())


def cmd_import_ref(args: argparse.Namespace) -> None:
    print(core.import_reference_from_url(args.url))


def cmd_ledger(_: argparse.Namespace) -> None:
    total, count = ledger_total()
    print(f"Tong da chi: ${total:.3f} ({count} lan). So sach: {core._host_path(LEDGER)}")
    if LEDGER.is_file():
        for line in LEDGER.read_text(encoding="utf-8").splitlines()[-10:]:
            print(" ", line)


def cmd_image(args: argparse.Namespace) -> None:
    width, height = core.image_dimensions(args.ratio, args.resolution)
    model = args.model or core.DEFAULT_IMAGE_MODEL
    estimate = 0.0 if args.test else core.estimate_image_usd(model, width, height, args.n)
    if not args.test:
        blocked = core.check_approval(estimate, args.approved)
        if blocked:
            print(blocked.replace("approved_cost_usd=", "--approved "))
            return
    result = core._api(
        "POST", "/api/image", timeout=180,
        json={"prompt": _prompt(args), "provider": "mock" if args.test else "together", "model": model,
              "width": width, "height": height, "num_images": args.n},
    )
    paths = [core._media_path(u) for u in (result.get("imageUrls") or [result.get("imageUrl")]) if u]
    if not args.test:
        log_spend("image", model, estimate, ",".join(p.name for p in paths))
    print(f"Xong {len(paths)} anh ({'TEST mien phi' if args.test else f'${estimate:.3f}'}). Mo bang Read de xem:")
    for path in paths:
        print(f"  {core._host_path(path)}")


def cmd_video(args: argparse.Namespace) -> None:
    model = args.model or core.DEFAULT_VIDEO_MODEL
    estimate = 0.0 if args.test else core.estimate_video_usd(model, args.seconds, args.resolution)
    if not args.test:
        blocked = core.check_approval(estimate, args.approved)
        if blocked:
            print(blocked.replace("approved_cost_usd=", "--approved "))
            return
    body: dict[str, Any] = {
        "prompt": _prompt(args),
        "provider": "mock" if args.test else "together",
        "model": "mock" if args.test else model,
        "aspect_ratio": args.ratio,
        "duration": args.seconds,
        "quality": args.resolution,
        "generate_audio": not args.silent,
    }
    if args.ref:
        body["image_url"] = core._resolve_reference(args.ref)
    task_id = core._api("POST", "/api/video", json=body, timeout=180)["taskId"]
    if not args.test:
        log_spend("video", model, estimate, task_id)
    print(f"Da gui ({'TEST mien phi' if args.test else f'${estimate:.3f}'}). task_id={task_id}")
    print("Cho ket qua: lenh 'wait <task_id>' (chay nen, mat vai phut).")


def cmd_wait(args: argparse.Namespace) -> None:
    deadline = time.time() + args.timeout
    state = "waiting"
    status: dict[str, Any] = {}
    while time.time() < deadline:
        status = core._api("GET", "/api/video/status", params={"taskId": args.task_id}, timeout=60)["data"]
        state = status.get("state", "waiting")
        if state in ("success", "fail"):
            break
        print(f"  ...{state}", flush=True)
        time.sleep(10)
    if state == "fail":
        print(f"THAT BAI: {status.get('failMsg') or 'khong ro ly do'}")
        raise SystemExit(1)
    if state != "success":
        print(f"Het thoi gian cho ({args.timeout}s), trang thai: {state}. Chay lai 'wait'.")
        raise SystemExit(2)
    result = json.loads(status.get("resultJson") or "{}")
    video_url = result.get("videoUrl") or (result.get("resultUrls") or [""])[0]
    _qc(core._media_path(video_url))


def _qc(path: Path) -> None:
    info = core.probe_video(path)
    sheet = core.MEDIA_DIR / f"qc-{path.stem}.jpg"
    sheet.write_bytes(core.contact_sheet(path))
    audio = "co am thanh" if info["has_audio"] else "KHONG co am thanh"
    if info.get("mean_volume_db") is not None:
        audio += f" (to TB {info['mean_volume_db']} dB, dinh {info['peak_volume_db']} dB)"
    print(f"Video xong: {core._host_path(path)}")
    print(f"Xem trong trinh duyet: {core._web_url(path.name)}")
    print(f"Thong so: {info['video']}, dai {info['duration_s']}s, {audio}.")
    print(f"Luoi 6 khung hinh de QC (mo bang Read): {core._host_path(sheet)}")
    print("Chi nhan xet dieu NHIN THAY trong khung hinh; khong nghe duoc am thanh, chi bao thong so.")


def cmd_qc(args: argparse.Namespace) -> None:
    _qc(core._media_path(args.filename))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="studio_cli", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status").set_defaults(func=cmd_status)
    sub.add_parser("inbox").set_defaults(func=cmd_inbox)
    sub.add_parser("ledger").set_defaults(func=cmd_ledger)

    est = sub.add_parser("estimate")
    est.add_argument("--kind", choices=["video", "image"], required=True)
    est.add_argument("--model", default="")
    est.add_argument("--seconds", type=int, default=10)
    est.add_argument("--resolution", default="720p")
    est.add_argument("--ratio", default="1:1")
    est.add_argument("--n", type=int, default=1)
    est.set_defaults(func=cmd_estimate)

    imp = sub.add_parser("import-ref")
    imp.add_argument("url")
    imp.set_defaults(func=cmd_import_ref)

    img = sub.add_parser("image")
    img.add_argument("--prompt")
    img.add_argument("--prompt-stdin", action="store_true")
    img.add_argument("--ratio", default="1:1")
    img.add_argument("--resolution", default="1K")
    img.add_argument("--n", type=int, default=1)
    img.add_argument("--model", default="")
    img.add_argument("--approved", type=float)
    img.add_argument("--test", action="store_true")
    img.set_defaults(func=cmd_image)

    vid = sub.add_parser("video")
    vid.add_argument("--prompt")
    vid.add_argument("--prompt-stdin", action="store_true")
    vid.add_argument("--seconds", type=int, default=10)
    vid.add_argument("--resolution", default="720p")
    vid.add_argument("--ratio", default="16:9")
    vid.add_argument("--ref", default="")
    vid.add_argument("--model", default="")
    vid.add_argument("--silent", action="store_true", help="khong sinh am thanh")
    vid.add_argument("--approved", type=float)
    vid.add_argument("--test", action="store_true")
    vid.set_defaults(func=cmd_video)

    wait = sub.add_parser("wait")
    wait.add_argument("task_id")
    wait.add_argument("--timeout", type=int, default=540)
    wait.set_defaults(func=cmd_wait)

    qc = sub.add_parser("qc")
    qc.add_argument("filename")
    qc.set_defaults(func=cmd_qc)
    return parser


def main(argv: list[str] | None = None) -> None:
    logging.getLogger("httpx").setLevel(logging.WARNING)
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
    except (ValueError, FileNotFoundError, RuntimeError) as error:
        print(f"LOI: {error}")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
