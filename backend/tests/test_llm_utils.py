from services.llm_utils import extract_code, parse_plan


def test_extract_code_from_fenced_block_with_prose():
    text = "Sure! Here you go:\n```python\nfrom manim import *\nx = 1\n```\nHope it helps."
    assert extract_code(text) == "from manim import *\nx = 1"


def test_extract_code_plain():
    assert extract_code("from manim import *\n") == "from manim import *"


def test_parse_plan_plain_json():
    plan = parse_plan('{"tutor_text_markdown": "hi", "animations": [], "questions_to_ask_user": []}')
    assert plan["tutor_text_markdown"] == "hi"


def test_parse_plan_json_wrapped_in_fence_and_prose():
    plan = parse_plan('Here:\n```json\n{"tutor_text_markdown": "hi"}\n```')
    assert plan["tutor_text_markdown"] == "hi"
    assert plan["animations"] == [] and plan["questions_to_ask_user"] == []


def test_parse_plan_garbage_falls_back_to_raw_text():
    plan = parse_plan("I could not make JSON, sorry")
    assert "I could not make JSON" in plan["tutor_text_markdown"]
    assert plan["animations"] == []


def test_parse_plan_normalizes_bad_shapes():
    plan = parse_plan('{"tutor_text_markdown": "x", "animations": ["oops", {"scene_spec": "s", "duration_seconds": "9999"}], "questions_to_ask_user": "q"}')
    assert len(plan["animations"]) == 1
    assert plan["animations"][0]["duration_seconds"] <= 60
    assert plan["questions_to_ask_user"] == []


def test_parse_plan_non_object_json():
    assert parse_plan("[1, 2]")["animations"] == []
