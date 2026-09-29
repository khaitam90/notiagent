import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient


class ApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        os.environ["NOTIAGENT_DATA_DIR"] = cls.temp_dir.name
        from app.main import app

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_workflow_round_trip(self):
        created = self.client.post("/api/workflows", json={"name": "Smoke", "folderId": "personal"})
        self.assertEqual(created.status_code, 201)
        workflow_id = created.json()["id"]

        updated = self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={"nodes": [{"id": "out", "type": "output"}]},
        )
        self.assertEqual(updated.status_code, 200)

        bootstrap = self.client.get("/api/workflows/bootstrap").json()
        self.assertIn(workflow_id, {workflow["id"] for workflow in bootstrap["workflows"]})

        deleted = self.client.delete(f"/api/workflows/{workflow_id}")
        self.assertEqual(deleted.status_code, 200)

    def test_atlas_mvp_payload_and_status_mapping(self):
        from app.main import VideoCreate, atlas_status_response, atlas_video_payload

        body = VideoCreate(
            prompt="A paper boat on a calm lake",
            provider="atlascloud",
            model="bytedance/seedance-v1-pro-fast/text-to-video",
            aspect_ratio="9:16",
            duration=5,
            quality="480p",
        )
        payload = atlas_video_payload(body)
        self.assertEqual(payload["model"], "bytedance/seedance-v1-pro-fast/text-to-video")
        self.assertEqual(payload["aspect_ratio"], "9:16")
        self.assertEqual(payload["resolution"], "480p")

        status = atlas_status_response(
            "task-1",
            {"data": {"status": "completed", "outputs": ["https://example.com/video.mp4"]}},
        )
        self.assertEqual(status["data"]["state"], "success")
        self.assertIn("video.mp4", status["data"]["resultJson"])

    def test_crazyrouter_mvp_payload_and_status_mapping(self):
        from app.main import VideoCreate, crazy_status_response, crazy_video_payload

        body = VideoCreate(
            prompt="A paper boat on a calm lake",
            provider="crazyrouter",
            model="aigc-video-kling-2.5-turbo",
            aspect_ratio="9:16",
            duration=5,
            quality="720p",
        )
        payload = crazy_video_payload(body)
        self.assertEqual(payload["model"], "aigc-video-kling-2.5-turbo")
        self.assertEqual(payload["size"], "720P")

        status = crazy_status_response("task-2", {"status": "completed", "video_url": "https://example.com/kling.mp4"})
        self.assertEqual(status["data"]["state"], "success")
        self.assertIn("kling.mp4", status["data"]["resultJson"])

        current_status = crazy_status_response(
            "task-3",
            {"data": {"status": "SUCCESS", "result_url": "https://example.com/current.mp4"}},
        )
        self.assertIn("current.mp4", current_status["data"]["resultJson"])

    def test_mock_provider_no_cost_flow(self):
        """provider=mock phải hoạt động không cần API key thật (test UI free trước khi chạy job trả phí)."""
        from app.main import MOCK_TASKS, MOCK_VIDEO_FILENAME, UPLOAD_DIR

        created = self.client.post("/api/video", json={"prompt": "thuyen giay", "provider": "mock"})
        self.assertEqual(created.status_code, 200)
        task_id = created.json()["taskId"]
        self.assertTrue(task_id.startswith("mock:"))

        # ngay sau khi tao: van dang "generating"
        pending = self.client.get(f"/api/video/status?taskId={task_id}")
        self.assertEqual(pending.json()["data"]["state"], "generating")

        # gia lap da qua thoi gian cho, khong sleep trong test
        MOCK_TASKS[task_id] -= 10
        (UPLOAD_DIR / MOCK_VIDEO_FILENAME).write_bytes(b"fake-mp4")
        done = self.client.get(f"/api/video/status?taskId={task_id}")
        self.assertEqual(done.json()["data"]["state"], "success")
        self.assertIn(MOCK_VIDEO_FILENAME, done.json()["data"]["resultJson"])

        missing = self.client.get("/api/video/status?taskId=mock:doesnotexist")
        self.assertEqual(missing.status_code, 404)

    def test_workflow_folders_crud_and_system_protection(self):
        created = self.client.post("/api/workflow-folders", json={"name": "Chien dich A"})
        self.assertEqual(created.status_code, 201)
        folder = created.json()
        self.assertFalse(folder["system"])

        renamed = self.client.patch(f"/api/workflow-folders/{folder['id']}", json={"name": "Chien dich B"})
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json()["name"], "Chien dich B")

        bootstrap = self.client.get("/api/workflows/bootstrap").json()
        system_ids = {f["id"] for f in bootstrap["folders"] if f["system"]}
        self.assertEqual(system_ids, {"templates", "personal", "sandbox"})

        # khong the sua/xoa thu muc he thong, du goi truc tiep API
        self.assertEqual(self.client.patch("/api/workflow-folders/personal", json={"name": "hack"}).status_code, 400)
        self.assertEqual(self.client.delete("/api/workflow-folders/templates").status_code, 400)

        deleted = self.client.delete(f"/api/workflow-folders/{folder['id']}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.delete(f"/api/workflow-folders/{folder['id']}").status_code, 404)

    def test_clone_workflow_creates_editable_copy(self):
        created = self.client.post("/api/workflows", json={"name": "Goc", "folderId": "personal"})
        workflow_id = created.json()["id"]
        self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={"nodes": [{"id": "p1", "type": "prompt", "config": {}}], "edges": []},
        )

        cloned = self.client.post(f"/api/workflows/{workflow_id}/clone", json={"folderId": "personal"})
        self.assertEqual(cloned.status_code, 201)
        clone = cloned.json()
        self.assertNotEqual(clone["id"], workflow_id)
        self.assertEqual(clone["category"], "custom")
        self.assertEqual(len(clone["nodes"]), 1)

        missing = self.client.post("/api/workflows/khong-ton-tai/clone", json={"folderId": "personal"})
        self.assertEqual(missing.status_code, 404)

    def test_recover_interrupted_runs_marks_stuck_as_failed(self):
        from app.main import db, recover_interrupted_runs

        stuck_payload = {
            "id": "stuck-run-1", "workflowId": "wf-1", "workflowName": "Test", "media": "video",
            "status": "running", "message": "Đang chạy...", "inputs": {}, "outputs": {"trace": [], "state": {}},
            "assetUrls": [], "error": None, "createdAt": "2020-01-01T00:00:00+00:00",
            "updatedAt": "2020-01-01T00:00:00+00:00", "finishedAt": None,
        }
        with db() as connection:
            connection.execute(
                "INSERT INTO runs(id, workflow_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)",
                ("stuck-run-1", "wf-1", "running", json.dumps(stuck_payload), "2020-01-01T00:00:00+00:00"),
            )

        recover_interrupted_runs()

        result = self.client.get("/api/workflow-runs?workflowId=wf-1").json()["runs"][0]
        self.assertEqual(result["status"], "failed")
        self.assertIn("khởi động lại", result["error"])

    def test_post_with_retry_recovers_from_connect_error_then_succeeds(self):
        from app.main import post_with_retry

        ok_response = httpx.Response(200, json={"ok": True})
        with patch("app.main.time.sleep"), patch(
            "app.main.httpx.post",
            side_effect=[httpx.ConnectError("boom"), httpx.ConnectError("boom"), ok_response],
        ) as mocked:
            response = post_with_retry("https://example.com", headers={}, json_body={})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(mocked.call_count, 3)

    def test_post_with_retry_does_not_retry_read_timeout(self):
        """ReadTimeout tren POST tao video khong duoc retry mu - co the provider da xu ly roi (tranh tao trung job tinh phi)."""
        from app.main import post_with_retry

        with patch("app.main.httpx.post", side_effect=httpx.ReadTimeout("slow")) as mocked:
            with self.assertRaises(httpx.ReadTimeout):
                post_with_retry("https://example.com", headers={}, json_body={})
            self.assertEqual(mocked.call_count, 1)

    def test_get_with_retry_recovers_from_read_timeout(self):
        from app.main import get_with_retry

        ok_response = httpx.Response(200, json={"ok": True})
        with patch("app.main.time.sleep"), patch(
            "app.main.httpx.get", side_effect=[httpx.ReadTimeout("slow"), ok_response]
        ) as mocked:
            response = get_with_retry("https://example.com", headers={})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(mocked.call_count, 2)

    def test_crazyrouter_missing_task_id_surfaces_clear_error(self):
        """Response thieu truong task_id (trang thai la) -> loi ro rang, khong crash mo ho."""
        os.environ["CRAZYROUTER_API_KEY"] = "test-key"
        try:
            malformed = httpx.Response(
                200, json={"data": {"status": "processing"}},
                request=httpx.Request("POST", "https://crazyrouter.com/v1/video/create"),
            )
            with patch("app.main.httpx.post", return_value=malformed):
                response = self.client.post(
                    "/api/video",
                    json={"prompt": "test", "provider": "crazyrouter", "model": "aigc-video-kling-2.5-turbo",
                          "aspect_ratio": "16:9", "duration": 5, "quality": "720p"},
                )
            self.assertEqual(response.status_code, 502)
            self.assertIn("task ID", response.json()["detail"])
        finally:
            del os.environ["CRAZYROUTER_API_KEY"]

    def test_download_local_media_forces_attachment_filename(self):
        from app.main import UPLOAD_DIR

        (UPLOAD_DIR / "sample-download.mp4").write_bytes(b"fake-video-bytes")
        response = self.client.get(
            "/api/download", params={"url": "/api/media/sample-download.mp4", "filename": "video-cua-toi.mp4"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('filename="video-cua-toi.mp4"', response.headers["content-disposition"])
        self.assertEqual(response.content, b"fake-video-bytes")

    def test_download_rejects_non_http_url(self):
        response = self.client.get("/api/download", params={"url": "file:///etc/passwd", "filename": "x"})
        self.assertEqual(response.status_code, 400)

    def test_create_image_mock_no_cost_flow(self):
        """provider=mock cho anh cung phai mien phi, giong video."""
        response = self.client.post("/api/image", json={"prompt": "hoa hong do", "provider": "mock"})
        self.assertEqual(response.status_code, 201)
        body = response.json()
        # Web (nginx) chi proxy "/api-proxy/" sang API - url phai co tien to nay de trinh duyet
        # hien thi duoc that (bug da gap: thieu tien to -> anh vo hinh, xem media_url() trong main.py)
        self.assertTrue(body["url"].startswith("/api-proxy/api/media/"))

        # Anh mock phai la PNG that (kiem tra bang magic bytes), khong phai file rong/gia
        # TestClient goi thang vao app, khong qua nginx, nen bo tien to "/api-proxy" truoc khi goi.
        image_response = self.client.get(body["url"].removeprefix("/api-proxy"))
        self.assertEqual(image_response.status_code, 200)
        self.assertTrue(image_response.content.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_create_image_unsupported_provider_rejected(self):
        response = self.client.post("/api/image", json={"prompt": "x", "provider": "replicate"})
        self.assertEqual(response.status_code, 400)

    def test_workflow_prompt_to_image_run_succeeds_via_mock(self):
        created = self.client.post("/api/workflows", json={"name": "Anh workflow", "folderId": "personal"})
        workflow_id = created.json()["id"]
        self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={
                "nodes": [
                    {"id": "prompt_1", "type": "prompt", "config": {"template": "{{prompt}}"}},
                    {"id": "image_1", "type": "image", "config": {}},
                ],
                "edges": [{"id": "e1", "source": "prompt_1", "target": "image_1"}],
            },
        )
        run_response = self.client.post(
            f"/api/workflows/{workflow_id}/run",
            json={"prompt": "chan dung mua thu", "variables": {}},
        )
        self.assertEqual(run_response.status_code, 200)

        for _ in range(20):
            runs = self.client.get(f"/api/workflow-runs?workflowId={workflow_id}").json()["runs"]
            if runs[0]["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
        self.assertEqual(runs[0]["status"], "succeeded")
        self.assertTrue(any(url.startswith("/api-proxy/api/media/") for url in runs[0]["assetUrls"]))

    def test_workflow_tts_node_mock_produces_audio(self):
        created = self.client.post("/api/workflows", json={"name": "TTS test", "folderId": "personal"})
        workflow_id = created.json()["id"]
        self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={"nodes": [{"id": "tts_1", "type": "tts", "config": {}}], "edges": []},
        )
        self.client.post(f"/api/workflows/{workflow_id}/run", json={"prompt": "xin chao", "variables": {}})
        for _ in range(20):
            runs = self.client.get(f"/api/workflow-runs?workflowId={workflow_id}").json()["runs"]
            if runs[0]["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
        self.assertEqual(runs[0]["status"], "succeeded")
        self.assertTrue(any(".wav" in url for url in runs[0]["assetUrls"]))

    def test_workflow_tts_node_real_provider_fails_clearly_without_key(self):
        created = self.client.post("/api/workflows", json={"name": "TTS that", "folderId": "personal"})
        workflow_id = created.json()["id"]
        self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={"nodes": [{"id": "tts_1", "type": "tts", "config": {}}], "edges": []},
        )
        self.client.post(
            f"/api/workflows/{workflow_id}/run",
            json={"prompt": "xin chao", "variables": {"tts_provider": "elevenlabs"}},
        )
        for _ in range(20):
            runs = self.client.get(f"/api/workflow-runs?workflowId={workflow_id}").json()["runs"]
            if runs[0]["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
        self.assertEqual(runs[0]["status"], "failed")
        self.assertIn("chưa được cấu hình", runs[0]["error"])

    def test_workflow_lipsync_node_mock_produces_video(self):
        from app.main import MOCK_VIDEO_FILENAME, UPLOAD_DIR

        # Doc lap voi test khac - tu tao san file mock thay vi phu thuoc thu tu chay test.
        (UPLOAD_DIR / MOCK_VIDEO_FILENAME).write_bytes(b"fake-mp4")

        created = self.client.post("/api/workflows", json={"name": "Lipsync test", "folderId": "personal"})
        workflow_id = created.json()["id"]
        self.client.patch(
            f"/api/workflows/{workflow_id}",
            json={"nodes": [{"id": "lip_1", "type": "lipsync", "config": {}}], "edges": []},
        )
        self.client.post(f"/api/workflows/{workflow_id}/run", json={"prompt": "x", "variables": {}})
        for _ in range(20):
            runs = self.client.get(f"/api/workflow-runs?workflowId={workflow_id}").json()["runs"]
            if runs[0]["status"] in ("succeeded", "failed"):
                break
            time.sleep(0.1)
        self.assertEqual(runs[0]["status"], "succeeded")
        self.assertTrue(any(".mp4" in url for url in runs[0]["assetUrls"]))

    def test_provider_error_detail_extracts_json_message(self):
        from app.main import provider_error_detail

        response = httpx.Response(403, json={"code": "quota_not_enough", "message": "user quota is not enough"})
        error = httpx.HTTPStatusError("403", request=httpx.Request("POST", "https://example.com"), response=response)
        detail = provider_error_detail("CrazyRouter từ chối yêu cầu", error)
        self.assertIn("user quota is not enough", detail)
        self.assertIn("403", detail)


if __name__ == "__main__":
    unittest.main()
