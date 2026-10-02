import unittest
from unittest import mock

from app import mcp_server as m


class McpServerTests(unittest.TestCase):
    def test_video_estimates_use_verified_prices(self):
        self.assertAlmostEqual(m.estimate_video_usd("ByteDance/Seedance-2.0", 10, "720p"), 1.6)
        self.assertAlmostEqual(m.estimate_video_usd("ByteDance/Seedance-2.5", 4, "480p"), 0.46)
        self.assertEqual(m.usd_to_credits(1.6), 160)
        with self.assertRaises(ValueError):
            m.estimate_video_usd("ByteDance/Seedance-2.0", 30, "720p")  # vuot 15s
        with self.assertRaises(ValueError):
            m.estimate_video_usd("model/khong-co-gia", 5, "720p")

    def test_image_dimensions_and_estimate(self):
        self.assertEqual(m.image_dimensions("1:1", "1K"), (1024, 1024))
        w, h = m.image_dimensions("21:9", "1K")
        self.assertEqual((w, h % 16), (1024, 0))
        self.assertEqual(m.image_dimensions("9:16", "1K")[1], 1024)
        self.assertAlmostEqual(m.estimate_image_usd("black-forest-labs/FLUX.2-dev", 1024, 1024), 0.0154 * 1.048576, places=4)

    def test_image_estimate_ignores_video_default_resolution(self):
        self.assertIn("0.016", m.estimate_cost("image", ratio="1:1"))

    def test_approval_guard_blocks_without_confirmation(self):
        self.assertIn("CHUA TRA TIEN", m.check_approval(1.6, None))
        self.assertIn("CHUA TRA TIEN", m.check_approval(1.6, 0.5))
        self.assertIsNone(m.check_approval(1.6, 1.6))

    def test_paid_tools_never_call_provider_without_approval(self):
        with mock.patch.object(m, "_api", side_effect=AssertionError("khong duoc goi API khi chua duyet chi phi")):
            text = m.create_video("dj tren san khau", duration_seconds=10)
            self.assertIn("CHUA TRA TIEN", text)
            self.assertIn("approved_cost_usd=1.6", text)
            blocked = m.create_image("canh dep")
            self.assertIn("CHUA TRA TIEN", blocked[0].text)

    def test_test_mode_uses_mock_provider_for_video(self):
        sent = {}

        def fake_api(method, path, **kwargs):
            sent.update(kwargs.get("json") or {})
            return {"taskId": "mock:abc", "status": "processing"}

        with mock.patch.object(m, "_api", side_effect=fake_api):
            out = m.create_video("thu", test_mode=True)
        self.assertEqual((sent["provider"], sent["model"]), ("mock", "mock"))
        self.assertIn("mock:abc", out)


if __name__ == "__main__":
    unittest.main()


class StudioCliTests(unittest.TestCase):
    def test_cli_blocks_paid_calls_without_approval_and_logs_ledger(self):
        import io
        import tempfile
        from contextlib import redirect_stdout
        from pathlib import Path

        from app import studio_cli as cli

        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(m, "LEDGER", Path(tmp) / "ledger.jsonl"), \
                mock.patch.object(m, "_api", side_effect=AssertionError("khong duoc goi API")):
            out = io.StringIO()
            with redirect_stdout(out):
                cli.main(["video", "--prompt", "dj", "--seconds", "10"])
            self.assertIn("CHUA TRA TIEN", out.getvalue())
            self.assertIn("--approved 1.6", out.getvalue())
            self.assertEqual(m.ledger_total(), (0.0, 0))
            m.log_spend("video", "x", 1.6, "t1")
            m.log_spend("image", "y", 0.02, "t2")
            self.assertEqual(m.ledger_total(), (1.62, 2))
