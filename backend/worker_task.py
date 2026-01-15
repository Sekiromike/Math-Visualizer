import os
import subprocess
import uuid
import asyncio
from .llm_utils import generate_manim_code, repair_manim_code

# We need a synchronous wrapper for the async generation if running in a sync worker
# Or we can run the LLM generation in the API and pass the CODE to the worker.
# BETTER APPROACH: API gets the plan (JSON). API calls LLM to generate CODE for each animation (Async).
# Then API enqueues the CODE to the worker to just RENDER.
# This prevents holding up the worker with LLM latency.
# BUT: The requirement said "Step B: ... For each scene_spec, generate a single Manim file".
# If we do Step B in the API, the user waits longer for the initial response.
# If we do Step B in the Worker, the API responds fast ("Thinking..."), and video loads later.
# Let's do Step B in the Worker.

def run_manim_job(scene_spec: str, duration: int = 15, quality: str = "low"):
    """
    RQ Task: Generates code and renders it.
    """
    job_id = str(uuid.uuid4())
    output_dir = "/app/static/renders"
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Generate Code (Blocking call to async function?)
    # Since RQ is sync, we need to run async code.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    code = loop.run_until_complete(generate_manim_code(scene_spec, duration))
    loop.close()
    
    # 2. Write Code to File
    filename = f"scene_{job_id}.py"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w") as f:
        f.write(code)
    
    # 3. Run Manim
    # manim -pqh scene.py GeneratedScene --media_dir ...
    # -p: preview (opens file), we don't need this in docker.
    # -qh: quality high. -ql: low.
    # Format: manim [flags] [file] [scene_name]
    
    quality_flag = "-ql" if quality == "low" else "-qh"
    
    cmd = [
        "manim",
        quality_flag, 
        "--media_dir", "/app/static/media", # Manim default output structure
        "-o", f"video_{job_id}.mp4", # Output filename
        filepath,
        "GeneratedScene"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Render failed: {result.stderr}")
        
        # Attempt Repair
        print("Attempting repair...")
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            new_code = loop.run_until_complete(repair_manim_code(code, result.stderr))
            loop.close()
            
            # Overwrite file
            with open(filepath, "w") as f:
                f.write(new_code)
                
            # Retry Render
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Repair failed: {result.stderr}")
                return {"status": "failed", "error": result.stderr}
                
        except Exception as e:
            print(f"Repair exception: {e}")
            return {"status": "failed", "error": str(e)}

    # Manim 0.18+ output path structure varies, but usually media/videos/scene_name/...
    # With -o, it puts it where we specify relative to media dir?
    # Let's assume standard output for now.
    # Actually, relying on return of the file path is best.
    
    # 480p15 is for -ql, 1080p60 for -qh typically.
    resolution_dir = "480p15" if quality == "low" else "1080p60" 
    
    video_path = f"/static/media/videos/{filename[:-3]}/{resolution_dir}/video_{job_id}.mp4" 
    # This path depends on manim version and quality (-ql = 480p15 sometimes).
    # We will refine this by checking file existence or configuring output content.
    
    return {"status": "completed", "video_url": video_path}
