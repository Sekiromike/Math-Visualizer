# Math Tutor AI (with Manim Animations)

A full-stack application that acts as an AI Math Tutor. It converses with you to explain math concepts and **automatically generates visual animations** (using [Manim](https://www.manim.community/)) to illustrate those concepts in real-time.

**Now supports running completely locally with [Ollama](https://ollama.com)!**

## 🚀 Features

- **AI Chat Interface**: Interactive tutor powered by LLMs (GPT-4 or Local Open Source models).
- **Auto-Generated Animations**: The AI writes Python code to visualize concepts using Manim.
- **Local Privacy**: visualizes data and runs models on your machine.
- **Quality Control**:
    - **Draft Mode**: Fast, low-resolution previews.
    - **HQ Mode**: High-quality 60fps renders.
    - **Regeneration**: One-click re-render if the AI makes a mistake.
- **Self-Repair**: The system automatically attempts to fix Python syntax errors in generated animations.

## 🛠️ Architecture

- **Frontend**: Next.js (React) + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Worker**: Redis Queue (RQ) + Dockerized Manim environment
- **LLM**: Connects to OpenAI API or Local Ollama instance

## 📋 Prerequisites

1.  **Docker Desktop** (Required for the animation worker).
2.  **Ollama** (Recommended for local LLM) OR an **OpenAI API Key**.
3.  **Git**.

## ⚡ Quick Start

### 1. Configure Environment

Create a `.env` file in the root directory:

```bash
# --- OPTION A: Local LLM (Recommended) ---
# 1. Install Ollama: https://ollama.com
# 2. Pull a model: `ollama pull qwen2.5-coder`
OPENAI_API_KEY=dummy
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL_NAME=qwen2.5-coder

# --- OPTION B: OpenAI ---
# OPENAI_API_KEY=sk-your-key...
# OPENAI_MODEL_NAME=gpt-4-turbo-preview

# Shared Config
REDIS_URL=redis://redis:6379
```

### 2. Start Services

Run the application using Docker Compose. This will build the backend, worker, and frontend containers.

```bash
docker-compose up --build
```
*Note: The first build takes a few minutes (it installs LaTeX, ffmpeg and Manim), and the first start of the `frontend` container runs `npm install`, so give it a minute before opening the page.*

### 3. Use the App

1.  Open your browser to **[http://localhost:3000](http://localhost:3000)**.
2.  Type a request:
    > "Visually explain the dot product of two vectors."
    > "Show me how the area of a circle is calculated."
3.  The AI will reply with text and queue an animation.
4.  Wait for the "Rendering..." card to finish (approx 15-30s for Draft).

## 🎮 Controls

- **Quality Toggle** (Top Right):
    - **Draft**: (Default) Fast rendering, 480p, 15fps. Good for quick iteration.
    - **HQ**: Slower rendering, 1080p, 60fps. Use this when you want a nice video.
- **Regenerate** (On Animation Card):
    - If a video fails or looks weird, click the refresh icon on the video card to re-run the render with the current quality settings.

## 🐛 Troubleshooting

**"Render failed"**
check the logs for the python error:
```bash
docker-compose logs worker
```
The system tries to auto-fix code errors, but sometimes the LLM hallucinates libraries not present in the container.

**Ollama Connection Refused**
Ensure Ollama is running (`ollama serve`). The containers reach it through `host.docker.internal` (mapped for you in `docker-compose.yml`, also on Linux). On Linux, Ollama listens on `127.0.0.1` by default, which containers cannot reach: start it with `OLLAMA_HOST=0.0.0.0` (for the systemd service: `sudo systemctl edit ollama` and add `Environment="OLLAMA_HOST=0.0.0.0"`).

**Chat shows "LLM request failed"**
The message includes the underlying error. Check that the model is pulled (`ollama pull qwen2.5-coder`) and that `OPENAI_BASE_URL` / `OPENAI_MODEL_NAME` in `.env` are right. Slow local models: raise `LLM_TIMEOUT` (seconds, default 300).

**Frontend connection error**
Ensure the backend is up at `http://localhost:8000`.

## ⚙️ Optional Settings

Set in `.env` (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_TIMEOUT` | `300` | Seconds to wait for each LLM call |
| `RENDER_TIMEOUT` | `600` | Seconds allowed for one Manim run |
| `JOB_TIMEOUT` | `1800` | Max seconds for a whole job (LLM + renders + repairs) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL the browser calls |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## 🧪 Backend Tests

The backend tests need no Docker, Redis, Manim or LLM (they use an in-memory Redis and a stand-in `manim`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # installs manim too; to skip it: pip install fastapi uvicorn redis "rq>=2" openai pytest fakeredis httpx
pytest
```
