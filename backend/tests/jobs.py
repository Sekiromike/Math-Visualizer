def ok():
    return {"status": "completed", "video_url": "/static/x.mp4"}


def fail_result():
    return {"status": "failed", "error": "boom"}


def raises():
    raise RuntimeError("kaboom")
