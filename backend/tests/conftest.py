import os
import stat
import sys

import fakeredis
import pytest
import redis

# main.py connects to Redis at import time; point it at an in-memory server.
SERVER = fakeredis.FakeServer()
redis.from_url = lambda *a, **k: fakeredis.FakeStrictRedis(server=SERVER)

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

FAKE_MANIM = '''#!{python}
import os, sys
args = sys.argv[1:]
media_dir = args[args.index("--media_dir") + 1]
out_name = args[args.index("-o") + 1]
scene_file = args[-2]
mode = os.environ.get("FAKE_MANIM_MODE", "ok")
with open(scene_file) as f:
    code = f.read()
if mode == "fail" or (mode == "fail_if_broken" and "BROKEN" in code):
    sys.stderr.write("Traceback...\\nNameError: BROKEN is not defined\\n")
    sys.exit(1)
if mode == "no_output":
    sys.exit(0)
stem = os.path.splitext(os.path.basename(scene_file))[0]
res = "480p15" if "-ql" in args else "1080p60"
d = os.path.join(media_dir, "videos", stem, res)
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, out_name), "wb") as f:
    f.write(b"fakevideo")
'''


@pytest.fixture(autouse=True)
def clean_queue():
    # Jobs enqueued by one test must not be executed by another test's worker.
    redis.from_url("").flushall()
    yield


@pytest.fixture
def fake_manim(tmp_path, monkeypatch):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    script = bin_dir / "manim"
    script.write_text(FAKE_MANIM.format(python=sys.executable))
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    return script


@pytest.fixture
def static_dir(tmp_path, monkeypatch):
    import worker_task

    d = tmp_path / "static"
    d.mkdir()
    monkeypatch.setattr(worker_task, "STATIC_DIR", str(d))
    return d
