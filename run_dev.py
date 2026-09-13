"""
Single-command dev launcher: starts the legacy Streamlit app and the new
FastAPI backend together, merges their logs into one terminal (prefixed by
process name), and stops both cleanly on Ctrl+C.

Usage:
    venv\\Scripts\\activate
    python run_dev.py

Streamlit -> http://localhost:8501
Backend   -> http://localhost:8000
"""

import os
import platform
import subprocess
import sys
import threading
import time

# Both child processes are themselves Python (streamlit, uvicorn): when their
# stdout isn't a real terminal, CPython switches it to fully block-buffered,
# so nothing appears here until a large buffer fills. Force it off for them.
CHILD_ENV = {**os.environ, "PYTHONUNBUFFERED": "1"}

PROCESSES = {
    "streamlit": [sys.executable, "-m", "streamlit", "run", "app.py"],
    "backend": [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload"],
}

COLORS = {"streamlit": "\033[35m", "backend": "\033[36m"}  # magenta / cyan
RESET = "\033[0m"


def stream_output(name: str, proc: subprocess.Popen) -> None:
    prefix = f"{COLORS.get(name, '')}[{name}]{RESET} "
    assert proc.stdout is not None
    for line in proc.stdout:
        print(prefix + line.rstrip(), flush=True)


def kill(name: str, proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    print(f"Stopping {name} (pid {proc.pid})...", flush=True)
    if platform.system() == "Windows":
        # uvicorn --reload spawns a child worker process; a plain terminate()
        # on the parent can leave it orphaned holding the port. Kill the
        # whole tree instead.
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        proc.terminate()


def main() -> None:
    procs: dict[str, subprocess.Popen] = {}

    for name, cmd in PROCESSES.items():
        procs[name] = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=CHILD_ENV,
        )
        print(f"Started {name} (pid {procs[name].pid})", flush=True)

    print("\nStreamlit -> http://localhost:8501", flush=True)
    print("Backend   -> http://localhost:8000", flush=True)
    print("Press Ctrl+C to stop both.\n", flush=True)

    threads = [
        threading.Thread(target=stream_output, args=(name, proc), daemon=True)
        for name, proc in procs.items()
    ]
    for t in threads:
        t.start()

    try:
        # Poll rather than proc.wait(timeout=...), which raises TimeoutExpired
        # instead of returning — that would abort this loop on the first tick.
        # Exit as soon as either process dies on its own, since a dev session
        # with only one half running isn't useful.
        while True:
            for name, proc in procs.items():
                if proc.poll() is not None:
                    print(
                        f"\n{name} exited on its own (code {proc.returncode}); stopping the other one too.",
                        flush=True,
                    )
                    raise SystemExit
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping both servers...", flush=True)
    except SystemExit:
        pass
    finally:
        for name, proc in procs.items():
            kill(name, proc)
        for t in threads:
            t.join(timeout=2)
        print("Stopped.", flush=True)


if __name__ == "__main__":
    main()
