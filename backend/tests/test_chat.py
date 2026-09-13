import os
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

import backend.audit as audit_module
import backend.quota as quota_module
import backend.routers.admin as admin_module
import backend.routers.chat as chat_module
import backend.routers.datasets as datasets_module
import backend.tenancy as tenancy_module
from backend.auth import get_current_user
from backend.main import app
from backend.schemas.user import CurrentUser, Quota
from backend.tests.fake_firestore import FakeFirestoreClient


class FakeChatModel:
    """Deterministic stand-in for a real LLM, mirroring tests/test_qa_comprehensive.py's pattern."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.call_count = 0

    def invoke(self, messages, **kwargs):
        resp = self.responses[min(self.call_count, len(self.responses) - 1)]
        self.call_count += 1
        return AIMessage(content=resp)


def _make_user(uid="test-uid", role="user", used=0, limit=50, reset_at=None) -> CurrentUser:
    return CurrentUser(
        uid=uid,
        email=f"{uid}@example.com",
        display_name="Test User",
        role=role,
        plan="free",
        quota=Quota(dailyLimit=limit, used=used, resetAt=reset_at),
    )


class BackendAPITestCase(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeFirestoreClient()
        self.tmp_data_dir = tempfile.mkdtemp(prefix="nexus_bi_test_")
        tenancy_module._managers.clear()

        # Simulates the Cloud Storage bucket as a plain in-memory dict, so the
        # durability-sync logic in tenancy.py can be exercised without a real
        # GCS bucket: uid -> raw bytes of that user's synced .db file.
        self.fake_cloud: dict[str, bytes] = {}

        def _fake_download(uid: str, local_path: str) -> bool:
            if uid not in self.fake_cloud:
                return False
            with open(local_path, "wb") as f:
                f.write(self.fake_cloud[uid])
            return True

        def _fake_upload(uid: str, local_path: str) -> None:
            with open(local_path, "rb") as f:
                self.fake_cloud[uid] = f.read()

        self.patches = [
            patch.object(chat_module, "get_firestore_client", return_value=self.fake_db),
            patch.object(datasets_module, "get_firestore_client", return_value=self.fake_db),
            patch.object(admin_module, "get_firestore_client", return_value=self.fake_db),
            patch.object(quota_module, "get_firestore_client", return_value=self.fake_db),
            patch.object(audit_module, "get_firestore_client", return_value=self.fake_db),
            patch.object(tenancy_module, "get_settings", return_value=type(
                "S", (), {"data_store_dir": self.tmp_data_dir}
            )()),
            patch.object(tenancy_module, "download_user_db", side_effect=_fake_download),
            patch.object(tenancy_module, "upload_user_db", side_effect=_fake_upload),
        ]
        for p in self.patches:
            p.start()

        self.client = TestClient(app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.dependency_overrides.pop(get_current_user, None)
        shutil.rmtree(self.tmp_data_dir, ignore_errors=True)

    def _override_user(self, user: CurrentUser):
        app.dependency_overrides[get_current_user] = lambda: user

    def test_chat_end_to_end_with_mocked_llm(self):
        """Full POST /api/chat flow against the real, unmodified run_bi_workflow + Sales_Agent dataset."""
        self._override_user(_make_user())

        fake_llm = FakeChatModel([
            "SELECT profit FROM Sales_Agent WHERE month = 'July';",
            "Executive Summary: Profit in July was $80,000.\nKey Findings: Strong month.\nStrategic Recommendation: Sustain momentum.",
            "fig = px.bar(df, x=df.columns[0], y=df.columns[0], title='Profit')",
        ])
        with patch.object(chat_module, "_resolve_server_llm", return_value=fake_llm):
            resp = self.client.post("/api/chat", json={"message": "What was the profit in July 2024?"})

        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertIn("80,000", body["final_insights"])
        self.assertIsNotNone(body["session_id"])
        self.assertIn("profit", body["sql_query"].lower())
        self.assertEqual(body["guardrail_message"], "Query verified safe and read-only.")

        # Session + messages were actually persisted.
        sessions = self.client.get("/api/sessions").json()
        self.assertEqual(len(sessions), 1)
        messages = self.client.get(f"/api/sessions/{body['session_id']}/messages").json()
        self.assertEqual(len(messages), 2)  # user + assistant

    def test_quota_blocks_after_limit_reached(self):
        still_active_window = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        self._override_user(_make_user(used=5, limit=5, reset_at=still_active_window))

        with patch.object(chat_module, "_resolve_server_llm", return_value=FakeChatModel(["SELECT 1;"])):
            resp = self.client.post("/api/chat", json={"message": "anything"})

        self.assertEqual(resp.status_code, 429)

    def test_guardrail_block_is_logged_to_audit_trail(self):
        self._override_user(_make_user(uid="attacker-uid"))

        malicious_llm = FakeChatModel(["DROP TABLE Sales_Agent;"])
        with patch.object(chat_module, "_resolve_server_llm", return_value=malicious_llm):
            resp = self.client.post("/api/chat", json={"message": "delete everything"})

        self.assertEqual(resp.status_code, 200)  # blocked gracefully, not a server error
        self.assertIn("Could not retrieve data", resp.json()["final_insights"])

        self._override_user(_make_user(uid="admin-uid", role="admin"))
        audit_entries = self.client.get("/api/admin/audit-log?blocked_only=true").json()
        self.assertEqual(len(audit_entries), 1)
        self.assertTrue(audit_entries[0]["blocked"])
        self.assertEqual(audit_entries[0]["uid"], "attacker-uid")

    def test_non_admin_cannot_access_admin_routes(self):
        self._override_user(_make_user(role="user"))
        resp = self.client.get("/api/admin/overview")
        self.assertEqual(resp.status_code, 403)

    def test_chat_handles_unaliased_numeric_column(self):
        """Regression: `SELECT 1` produces a column literally named '1', which pandas'
        JSON round-trip can coerce to an int and previously broke the response schema."""
        self._override_user(_make_user(uid="numeric-col-uid"))
        with patch.object(chat_module, "_resolve_server_llm", return_value=FakeChatModel(["SELECT 1;"])):
            resp = self.client.post("/api/chat", json={"message": "sanity check"})

        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertEqual(body["columns"], ["1"])
        self.assertEqual(body["rows"], [{"1": 1}])

    def test_dataset_isolation_between_two_users(self):
        self._override_user(_make_user(uid="user-a"))
        csv_bytes = b"region,revenue\nNorth,1000\nSouth,2000\n"
        upload = self.client.post(
            "/api/datasets",
            files={"file": ("regions.csv", csv_bytes, "text/csv")},
        )
        self.assertEqual(upload.status_code, 200, upload.text)

        user_a_datasets = self.client.get("/api/datasets").json()
        self.assertEqual(len(user_a_datasets), 1)
        self.assertEqual(user_a_datasets[0]["tableName"], "regions")

        self._override_user(_make_user(uid="user-b"))
        user_b_datasets = self.client.get("/api/datasets").json()
        self.assertEqual(user_b_datasets, [])  # user B sees none of user A's uploads

    def test_dataset_survives_ephemeral_disk_via_cloud_storage_sync(self):
        """Regression for deploying to a host (e.g. Render) with an ephemeral disk:
        an uploaded dataset must still be queryable after the local cache file and
        the in-process DatabaseManager are both gone, as they would be after a redeploy."""
        uid = "durable-uid"
        self._override_user(_make_user(uid=uid))

        csv_bytes = b"region,revenue\nEast,1000\nWest,2000\n"
        upload = self.client.post(
            "/api/datasets",
            files={"file": ("regions.csv", csv_bytes, "text/csv")},
        )
        self.assertEqual(upload.status_code, 200, upload.text)
        self.assertIn(uid, self.fake_cloud, "upload should sync the .db file to Cloud Storage")

        # Simulate a fresh process on an ephemeral disk: no local cache file,
        # no in-memory DatabaseManager for this user.
        local_path = tenancy_module._local_db_path(uid)
        tenancy_module._managers.pop(uid, None)
        os.remove(local_path)

        schema = self.client.get("/api/datasets/schema")
        self.assertEqual(schema.status_code, 200)
        self.assertIn("regions", schema.json()["schema_text"])

    def test_dataset_delete_also_syncs_to_cloud_storage(self):
        uid = "delete-sync-uid"
        self._override_user(_make_user(uid=uid))

        csv_bytes = b"region,revenue\nEast,1000\n"
        upload = self.client.post(
            "/api/datasets",
            files={"file": ("regions.csv", csv_bytes, "text/csv")},
        ).json()
        before = self.fake_cloud[uid]

        self.client.delete(f"/api/datasets/{upload['id']}")

        self.assertNotEqual(
            self.fake_cloud[uid], before, "delete should re-sync the .db file after dropping the table"
        )


if __name__ == "__main__":
    unittest.main()
