import os

# Shared by the API (serves it) and the RQ worker (writes into it).
# Resolves to /app/static inside the containers.
STATIC_DIR = os.environ.get("STATIC_DIR") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"
)
