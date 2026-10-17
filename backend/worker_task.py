import asyncio
import glob
import os
import subprocess
import uuid

from services.config import STATIC_DIR
from services.llm_utils import generate_manim_code, repair_manim_code

RENDER_TIMEOUT = int(os.environ.get("RENDER_TIMEOUT", "600"))  # seconds per manim run
MAX_REPAIRS = 2
ERROR_TAIL = 3000  # chars of manim output kept for the LLM and the UI

# The LLM runs here in the worker, not in the API: the chat reply returns fast and the
# video shows up when it is ready.


def _failed(error: str) -> dict:
    return {"status": "failed", "error": error[-ERROR_TAIL:]}


def _render(filepath: str, media_dir: str, out_name: str, quality: str):
    """Run manim once. Returns (ok, error_output)."""
    # -ql: 480p15, -qh: 1080p60. No -p: there is nothing to preview inside a container.
    cmd = [
        "manim",
        "-ql" if quality == "low" else "-qh",
        "--media_dir", media_dir,
        "-o", out_name,
        filepath,
        "GeneratedScene",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=RENDER_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, f"Render timed out after {RENDER_TIMEOUT}s"
    except FileNotFoundError:
        return False, "The 'manim' executable was not found in this environment"
    if proc.returncode != 0:
        # stdout is progress noise, the traceback is at the end of stderr.
        return False, ((proc.stdout or "") + (proc.stderr or ""))[-ERROR_TAIL:]
    return True, ""


def run_manim_job(scene_spec: str, duration: int = 15, quality: str = "low"):
    """
    RQ Task: generates code, renders it (repairing it with the LLM if it fails)
    and returns {"status": "completed", "video_url": ...} or {"status": "failed", "error": ...}.
    """
    job_id = uuid.uuid4().hex
    scenes_dir = os.path.join(os.path.dirname(STATIC_DIR), "scenes")  # not served over HTTP
    media_dir = os.path.join(STATIC_DIR, "media", job_id)
    os.makedirs(scenes_dir, exist_ok=True)

    try:
        code = asyncio.run(generate_manim_code(scene_spec, duration))
    except Exception as e:
        return _failed(f"Code generation failed: {e}")

    filepath = os.path.join(scenes_dir, f"scene_{job_id}.py")
    out_name = f"video_{job_id}.mp4"
    error = ""

    for attempt in range(MAX_REPAIRS + 1):
        with open(filepath, "w") as f:
            f.write(code)

        ok, error = _render(filepath, media_dir, out_name, quality)
        if ok:
            # Manim nests output as <media_dir>/videos/<scene>/<resolution>/<file>.
            found = glob.glob(os.path.join(media_dir, "videos", "*", "*", out_name))
            if found:
                rel = os.path.relpath(found[0], STATIC_DIR).replace(os.sep, "/")
                return {"status": "completed", "video_url": f"/static/{rel}"}
            error = "Manim finished but produced no video file."

        if attempt == MAX_REPAIRS:
            break
        print(f"Render failed (attempt {attempt + 1}), attempting repair:\n{error}")
        try:
            code = asyncio.run(repair_manim_code(code, error))
        except Exception as e:
            return _failed(f"Repair failed: {e}\n{error}")

    return _failed(error)
