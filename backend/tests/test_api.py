from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from rq import SimpleWorker

import main
from tests import jobs

client = TestClient(main.app)


def run_worker():
    SimpleWorker([main.q], connection=main.redis_conn).work(burst=True)


def test_chat_enqueues_animations(monkeypatch):
    plan = {
        "tutor_text_markdown": "Hello $x$",
        "animations": [{"title": "T", "scene_spec": "a circle", "duration_seconds": 12}],
        "questions_to_ask_user": ["why?"],
    }
    monkeypatch.setattr(main, "plan_tutor_response", AsyncMock(return_value=plan))
    res = client.post("/chat", json={"message": "hi", "quality": "high"})
    assert res.status_code == 200
    body = res.json()
    assert body["reply"] == "Hello $x$"
    assert body["questions"] == ["why?"]
    anim = body["animations"][0]
    assert anim["status"] == "queued" and anim["scene_spec"] == "a circle"
    job = main.q.fetch_job(anim["id"])
    assert job.kwargs["quality"] == "high"
    assert job.timeout >= 600


def test_chat_returns_502_when_llm_is_down(monkeypatch):
    monkeypatch.setattr(main, "plan_tutor_response", AsyncMock(side_effect=ConnectionError("no llm")))
    res = client.post("/chat", json={"message": "hi"})
    assert res.status_code == 502
    assert "no llm" in res.json()["detail"]


def test_status_queued_then_completed():
    job = main.q.enqueue(jobs.ok)
    assert client.get(f"/render/status/{job.id}").json() == {"status": "queued"}
    run_worker()
    assert client.get(f"/render/status/{job.id}").json() == {
        "status": "completed",
        "video_url": "/static/x.mp4",
    }


def test_status_failed_result_is_reported_as_failed():
    job = main.q.enqueue(jobs.fail_result)
    run_worker()
    assert client.get(f"/render/status/{job.id}").json() == {"status": "failed", "error": "boom"}


def test_status_job_exception_is_reported_as_failed():
    job = main.q.enqueue(jobs.raises)
    run_worker()
    body = client.get(f"/render/status/{job.id}").json()
    assert body["status"] == "failed"
    assert "kaboom" in body["error"]


def test_status_unknown_job():
    assert client.get("/render/status/nope").json() == {"status": "not_found"}


def test_manual_render_enqueues():
    res = client.post("/render", json={"scene_spec": "x", "duration": 10, "quality": "low"})
    assert res.status_code == 200
    assert main.q.fetch_job(res.json()["job_id"]) is not None
