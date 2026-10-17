import json
import os
import re

from openai import AsyncOpenAI, BadRequestError
from .prompts import TUTOR_PLANNER_SYSTEM_PROMPT, MANIM_GENERATOR_SYSTEM_PROMPT, MANIM_REPAIR_SYSTEM_PROMPT

MODEL_NAME = os.environ.get("OPENAI_MODEL_NAME") or "gpt-4-turbo-preview"

_FENCE = re.compile(r"```[a-zA-Z]*[ \t]*\n(.*?)```", re.DOTALL)


def _client() -> AsyncOpenAI:
    """
    Support local LLMs (Ollama) via OPENAI_BASE_URL.
    A client is created per call: the worker drives each call with its own event
    loop (asyncio.run), and a pooled client must not outlive the loop it was used in.
    """
    return AsyncOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY") or "dummy-key",  # Ollama ignores the key
        base_url=os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1",
        timeout=float(os.environ.get("LLM_TIMEOUT", "300")),  # local models can be slow
        max_retries=1,
    )


async def _complete(messages: list, **kwargs) -> str:
    async with _client() as client:
        response = await client.chat.completions.create(
            model=MODEL_NAME, messages=messages, **kwargs
        )
    return response.choices[0].message.content or ""


def extract_code(text: str) -> str:
    """Pull the Python source out of an LLM reply (fenced or not, with or without prose)."""
    match = _FENCE.search(text)
    if match:
        return match.group(1).strip()
    # Unterminated fence (reply cut off): drop the opening fence line.
    return re.sub(r"^```[a-zA-Z]*[ \t]*\n", "", text.strip()).strip()


def parse_plan(text: str) -> dict:
    """Parse the planner reply into a well-formed plan, whatever shape the model returned."""
    candidates = [text.strip()]
    fenced = _FENCE.search(text)
    if fenced:
        candidates.append(fenced.group(1).strip())
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start:end + 1])

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return _normalize_plan(data)

    # Not JSON at all: still show the user what the model said.
    return _normalize_plan({"tutor_text_markdown": text.strip() or "Sorry, I could not generate a response."})


def _normalize_plan(data: dict) -> dict:
    animations = []
    raw = data.get("animations")
    for anim in raw if isinstance(raw, list) else []:
        if not isinstance(anim, dict) or not str(anim.get("scene_spec") or "").strip():
            continue
        try:
            duration = int(anim.get("duration_seconds", 15))
        except (TypeError, ValueError):
            duration = 15
        animations.append({**anim, "duration_seconds": max(5, min(60, duration))})

    questions = data.get("questions_to_ask_user")
    return {
        "tutor_text_markdown": str(data.get("tutor_text_markdown") or ""),
        "animations": animations[:2],
        "questions_to_ask_user": [str(q) for q in questions] if isinstance(questions, list) else [],
    }


async def plan_tutor_response(history: list, user_message: str):
    """
    Calls the LLM to plan the response and animations.
    """
    messages = [
        {"role": "system", "content": TUTOR_PLANNER_SYSTEM_PROMPT},
    ]
    # Add history
    for msg in history:
        role, content = msg.get("role"), msg.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Add current message
    messages.append({"role": "user", "content": user_message})

    try:
        content = await _complete(messages, response_format={"type": "json_object"}, temperature=0.7)
    except BadRequestError:
        # Some OpenAI-compatible servers reject response_format; parse_plan copes without it.
        content = await _complete(messages, temperature=0.7)
    return parse_plan(content)

async def generate_manim_code(scene_spec: str, duration: int = 15):
    """
    Calls the LLM to generate Manim code from a spec.
    """
    prompt = f"Scene Spec: {scene_spec}\nConstraint: Duration approx {duration} seconds."

    system_prompt = MANIM_GENERATOR_SYSTEM_PROMPT.format(duration=duration)

    content = await _complete(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,  # Lower temp for code
    )
    return extract_code(content)


async def repair_manim_code(code: str, error: str):
    """
    Calls LLM to fix broken Manim code.
    """
    system_prompt = MANIM_REPAIR_SYSTEM_PROMPT.format(error_message=error)

    content = await _complete(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Broken Code:\n{code}"},
        ],
        temperature=0.2,
    )
    return extract_code(content)
