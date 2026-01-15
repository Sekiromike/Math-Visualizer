from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
import redis
from rq import Queue
from .services.llm_utils import plan_tutor_response
from .worker_task import run_manim_job

app = FastAPI(title="Math Tutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Redis
redis_conn = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
q = Queue(connection=redis_conn)

# Mount static for serving videos
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

class RenderRequest(BaseModel):
    scene_spec: str
    duration: int = 15
    quality: str = "low" # low, high

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []
    quality: str = "low"

@app.get("/")
async def root():
    return {"message": "Math Tutor API is running"}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Plan Response
    plan = await plan_tutor_response(request.conversation_history, request.message)
    
    response_animations = []
    
    # 2. Enqueue Animations
    for anim in plan.get("animations", []):
        job = q.enqueue(
            run_manim_job,
            scene_spec=anim.get("scene_spec", ""),
            duration=anim.get("duration_seconds", 15),
            quality=request.quality
        )
        response_animations.append({
            "id": job.id,
            "title": anim.get("title"),
            "status": "queued",
            "scene_spec": anim.get("scene_spec", ""), # Return spec for regeneration
            "duration": anim.get("duration_seconds", 15)
        })
        
    return {
        "reply": plan.get("tutor_text_markdown", ""),
        "animations": response_animations,
        "questions": plan.get("questions_to_ask_user", [])
    }

@app.post("/render")
async def manual_render(request: RenderRequest):
    job = q.enqueue(
        run_manim_job,
        scene_spec=request.scene_spec,
        duration=request.duration,
        quality=request.quality
    )
    return {"job_id": job.id, "status": "queued"}

@app.get("/render/status/{job_id}")
async def get_render_status(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        return {"status": "not_found"}
    
    if job.is_queued:
        return {"status": "queued"}
    elif job.is_started:
        return {"status": "rendering"}
    elif job.is_failed:
        return {"status": "failed", "error": str(job.exc_info)}
    elif job.is_finished:
        return {"status": "completed", "video_url": job.result.get("video_url") if job.result else None}
    
    return {"status": "unknown"}
