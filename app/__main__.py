"""Entrypoint to run the Taskocalypse server."""

import sys

import uvicorn

from app.config import HOST, PORT


def main() -> None:
    """Start uvicorn server bound to 127.0.0.1."""
    print(f"Starting Taskocalypse server at http://{HOST}:{PORT}")
    uvicorn.run("app.api:app", host=HOST, port=PORT, reload=False, log_level="info")


if __name__ == "__main__":
    sys.exit(main())
