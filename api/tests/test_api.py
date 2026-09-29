import os
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
