import os
import json
from openai import AsyncOpenAI
from .prompts import TUTOR_PLANNER_SYSTEM_PROMPT, MANIM_GENERATOR_SYSTEM_PROMPT, MANIM_REPAIR_SYSTEM_PROMPT

# Initialize client
# Support local LLM (Ollama) via OPENAI_BASE_URL
base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
api_key = os.environ.get("OPENAI_API_KEY", "dummy-key") # Ollama doesn't care about key usually

client = AsyncOpenAI(
    api_key=api_key,
    base_url=base_url
)

MODEL_NAME = os.environ.get("OPENAI_MODEL_NAME", "gpt-4-turbo-preview")

async def plan_tutor_response(history: list, user_message: str):
    """
    Calls the LLM to plan the response and animations.
    """
    messages = [
        {"role": "system", "content": TUTOR_PLANNER_SYSTEM_PROMPT},
    ]
    # Add history
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    
    # Add current message
    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model=MODEL_NAME, 
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7
    )

    content = response.choices[0].message.content
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "tutor_text_markdown": "Error generating response plan.",
            "animations": [],
            "questions_to_ask_user": []
        }

async def generate_manim_code(scene_spec: str, duration: int = 15):
    """
    Calls the LLM to generate Manim code from a spec.
    """
    prompt = f"Scene Spec: {scene_spec}\nConstraint: Duration approx {duration} seconds."
    
    system_prompt = MANIM_GENERATOR_SYSTEM_PROMPT.format(duration=duration)
    
    response = await client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2 # Lower temp for code
    )

    code = response.choices[0].message.content
    # Strip backticks if present
    code = code.replace("```python", "").replace("```", "").strip()
    return code

async def repair_manim_code(code: str, error: str):
    """
    Calls LLM to fix broken Manim code.
    """
    system_prompt = MANIM_REPAIR_SYSTEM_PROMPT.format(error_message=error)
    
    response = await client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Broken Code:\n{code}"}
        ],
        temperature=0.2
    )
    
    new_code = response.choices[0].message.content
    new_code = new_code.replace("```python", "").replace("```", "").strip()
    return new_code
