import os
from typing import List, Literal

import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from rq import Queue

from services.config import STATIC_DIR
from services.llm_utils import plan_tutor_response
from worker_task import run_manim_job

app = FastAPI(title="Math Tutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Redis
redis_conn = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
q = Queue(connection=redis_conn)

# RQ kills jobs after 180s by default, which is too short for LLM generation + a HQ render.
JOB_TIMEOUT = int(os.getenv("JOB_TIMEOUT", "1800"))
RESULT_TTL = 3600

# Mount static for serving videos
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class RenderRequest(BaseModel):
    scene_spec: str
    duration: int = 15
    quality: Literal["low", "high"] = "low"

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []
    quality: Literal["low", "high"] = "low"

def enqueue_render(scene_spec: str, duration: int, quality: str):
    try:
        return q.enqueue(
            run_manim_job,
            scene_spec=scene_spec,
            duration=duration,
            quality=quality,
            job_timeout=JOB_TIMEOUT,
            result_ttl=RESULT_TTL,
            failure_ttl=RESULT_TTL,
        )
    except redis.exceptions.RedisError as e:
        raise HTTPException(status_code=503, detail=f"Render queue unavailable: {e}")

@app.get("/")
async def root():
    return {"message": "Math Tutor API is running"}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Plan Response
    try:
        plan = await plan_tutor_response(request.conversation_history, request.message)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")

    response_animations = []

    # 2. Enqueue Animations
    for anim in plan.get("animations", []):
        duration = anim.get("duration_seconds", 15)
        job = enqueue_render(anim["scene_spec"], duration, request.quality)
        response_animations.append({
            "id": job.id,
            "title": anim.get("title"),
            "status": "queued",
            "scene_spec": anim["scene_spec"], # Return spec for regeneration
            "duration": duration
        })

    return {
        "reply": plan.get("tutor_text_markdown", ""),
        "animations": response_animations,
        "questions": plan.get("questions_to_ask_user", [])
    }

# Plain `def` endpoints below: redis/rq calls are blocking, so FastAPI runs them in a thread pool.
@app.post("/render")
def manual_render(request: RenderRequest):
    job = enqueue_render(request.scene_spec, request.duration, request.quality)
    return {"job_id": job.id, "status": "queued"}

@app.get("/render/status/{job_id}")
def get_render_status(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        return {"status": "not_found"}

    status = job.get_status()
    if status in ("queued", "scheduled", "deferred"):
        return {"status": "queued"}
    if status == "started":
        return {"status": "rendering"}
    if status == "finished":
        # The task reports render failures in its return value rather than raising.
        result = job.return_value()
        if isinstance(result, dict) and result.get("status") == "completed" and result.get("video_url"):
            return {"status": "completed", "video_url": result["video_url"]}
        error = result.get("error") if isinstance(result, dict) else None
        return {"status": "failed", "error": error or "Render produced no video."}
    if status == "failed":
        latest = job.latest_result()
        trace = (latest.exc_string if latest else "") or "Render job failed."
        lines = [line for line in trace.strip().splitlines() if line.strip()]
        return {"status": "failed", "error": lines[-1] if lines else "Render job failed."}
    return {"status": "failed", "error": f"Render job was {status}."}
