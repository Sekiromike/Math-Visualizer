import os
from unittest.mock import AsyncMock

import pytest

import worker_task

GOOD = "from manim import *\nclass GeneratedScene(Scene):\n    def construct(self): pass\n"


@pytest.fixture(autouse=True)
def llm(monkeypatch):
    gen = AsyncMock(return_value=GOOD)
    rep = AsyncMock(return_value=GOOD)
    monkeypatch.setattr(worker_task, "generate_manim_code", gen)
    monkeypatch.setattr(worker_task, "repair_manim_code", rep)
    return gen, rep


def test_render_success_returns_servable_url(fake_manim, static_dir):
    result = worker_task.run_manim_job("a circle", 10, "low")
    assert result["status"] == "completed"
    assert result["video_url"].startswith("/static/")
    assert os.path.isfile(static_dir / result["video_url"][len("/static/"):])


def test_render_high_quality_finds_1080p_output(fake_manim, static_dir):
    result = worker_task.run_manim_job("a circle", 10, "high")
    assert result["status"] == "completed"
    assert "1080p60" in result["video_url"]


def test_render_repairs_broken_code(fake_manim, static_dir, monkeypatch, llm):
    gen, rep = llm
    gen.return_value = "BROKEN"
    monkeypatch.setenv("FAKE_MANIM_MODE", "fail_if_broken")
    result = worker_task.run_manim_job("x", 10, "low")
    assert result["status"] == "completed"
    assert rep.await_count == 1
    assert "BROKEN is not defined" in rep.await_args.args[1]


def test_render_failure_is_reported_not_raised(fake_manim, static_dir, monkeypatch):
    monkeypatch.setenv("FAKE_MANIM_MODE", "fail")
    result = worker_task.run_manim_job("x", 10, "low")
    assert result["status"] == "failed"
    assert "NameError" in result["error"]


def test_render_without_output_file_is_failure(fake_manim, static_dir, monkeypatch):
    monkeypatch.setenv("FAKE_MANIM_MODE", "no_output")
    result = worker_task.run_manim_job("x", 10, "low")
    assert result["status"] == "failed"


def test_llm_error_is_reported_not_raised(fake_manim, static_dir, llm):
    gen, _ = llm
    gen.side_effect = ConnectionError("llm down")
    result = worker_task.run_manim_job("x", 10, "low")
    assert result["status"] == "failed"
    assert "llm down" in result["error"]
