from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import io
import json
import logging
import os
import subprocess
import threading
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, Request, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from mss import mss
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT_DIR / "netron_computer" / "static"

load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "3001"))
    fps: int = max(1, int(os.getenv("FPS", "30")))
    jpeg_quality: int = min(95, max(20, int(os.getenv("JPEG_QUALITY", "45"))))
    max_frame_width: int = max(640, int(os.getenv("MAX_FRAME_WIDTH", "1024")))
    monitor_index: int = max(1, int(os.getenv("MONITOR_INDEX", "1")))
    language: str = os.getenv("LANGUAGE", "en").strip().lower() or "en"
    auth_username: str = os.getenv("AUTH_USERNAME", "admin")
    auth_password: str = os.getenv("AUTH_PASSWORD", "admin")
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "netron_computer_session")
    session_secret: str = os.getenv("SESSION_SECRET", "change-this-netron-computer-secret")
    enable_audio: bool = os.getenv("ENABLE_AUDIO", "1").strip().lower() not in {"0", "false", "no", "off"}
    audio_source: str = os.getenv("AUDIO_SOURCE", "").strip()
    audio_sample_rate: int = max(16000, int(os.getenv("AUDIO_SAMPLE_RATE", "48000")))
    audio_chunk_ms: int = min(100, max(10, int(os.getenv("AUDIO_CHUNK_MS", "20"))))


class RemoteDesktop:
    def __init__(self, settings: Settings) -> None:
        try:
            from pynput import keyboard as pynput_keyboard
            from pynput import mouse as pynput_mouse
        except Exception as exc:  # pragma: no cover - depends on local display stack
            raise RuntimeError(
                "Could not connect to local input control. "
                "On Linux, this usually requires an active X11 session with DISPLAY access."
            ) from exc

        self.settings = settings
        self.monitor_index = settings.monitor_index
        self.monitor_lock = threading.Lock()
        self.keyboard_module = pynput_keyboard
        self.mouse_module = pynput_mouse
        self.keyboard = pynput_keyboard.Controller()
        self.mouse = pynput_mouse.Controller()
        self.special_keys = {
            "alt": pynput_keyboard.Key.alt,
            "backspace": pynput_keyboard.Key.backspace,
            "ctrl": pynput_keyboard.Key.ctrl,
            "delete": pynput_keyboard.Key.delete,
            "down": pynput_keyboard.Key.down,
            "end": pynput_keyboard.Key.end,
            "enter": pynput_keyboard.Key.enter,
            "esc": pynput_keyboard.Key.esc,
            "escape": pynput_keyboard.Key.esc,
            "home": pynput_keyboard.Key.home,
            "left": pynput_keyboard.Key.left,
            "meta": pynput_keyboard.Key.cmd,
            "pagedown": pynput_keyboard.Key.page_down,
            "pageup": pynput_keyboard.Key.page_up,
            "right": pynput_keyboard.Key.right,
            "shift": pynput_keyboard.Key.shift,
            "space": " ",
            "tab": pynput_keyboard.Key.tab,
            "up": pynput_keyboard.Key.up,
        }
        self.mouse_buttons = {
            "left": pynput_mouse.Button.left,
            "middle": pynput_mouse.Button.middle,
            "right": pynput_mouse.Button.right,
        }

    def _list_monitors(self) -> list[dict[str, int]]:
        with mss() as screen_capture:
            monitors = screen_capture.monitors[1:]
            if not monitors:
                raise RuntimeError("Could not detect a monitor for screen capture.")
            return [dict(monitor) for monitor in monitors]

    def _get_monitor_selection(self) -> tuple[dict[str, int], int, int]:
        monitors = self._list_monitors()

        with self.monitor_lock:
            if self.monitor_index < 1:
                self.monitor_index = 1
            if self.monitor_index > len(monitors):
                self.monitor_index = len(monitors)
            current_index = self.monitor_index

        return monitors[current_index - 1], current_index, len(monitors)

    def _get_monitor(self) -> dict[str, int]:
        monitor, _, _ = self._get_monitor_selection()
        return monitor

    def screen_info(self) -> dict[str, int]:
        monitor, monitor_index, monitor_count = self._get_monitor_selection()
        cursor = self.cursor_info()
        return {
            "width": monitor["width"],
            "height": monitor["height"],
            "left": monitor["left"],
            "top": monitor["top"],
            "cursor_x": cursor["cursor_x"],
            "cursor_y": cursor["cursor_y"],
            "monitor_index": monitor_index,
            "monitor_count": monitor_count,
        }

    def cursor_info(self) -> dict[str, float]:
        monitor = self._get_monitor()
        mouse_x, mouse_y = self.mouse.position
        width = max(1, monitor["width"])
        height = max(1, monitor["height"])
        cursor_x = min(width - 1, max(0, mouse_x - monitor["left"]))
        cursor_y = min(height - 1, max(0, mouse_y - monitor["top"]))
        return {
            "cursor_x": cursor_x / max(1, width - 1),
            "cursor_y": cursor_y / max(1, height - 1),
        }

    def capture_frame(self) -> bytes:
        monitor = self._get_monitor()

        with mss() as screen_capture:
            shot = screen_capture.grab(monitor)

        image = Image.frombytes("RGB", shot.size, shot.rgb)
        if image.width > self.settings.max_frame_width:
            image.thumbnail((self.settings.max_frame_width, 9999), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=self.settings.jpeg_quality, optimize=True)
        return buffer.getvalue()

    def handle_message(self, payload: dict[str, Any]) -> dict[str, int] | None:
        message_type = payload.get("type")

        if message_type == "move":
            self._move_mouse(payload)
            return
        if message_type == "move_relative":
            self._move_mouse_relative(payload)
            return
        if message_type == "button_down":
            self.mouse.press(self._resolve_button(payload.get("button")))
            return
        if message_type == "button_up":
            self.mouse.release(self._resolve_button(payload.get("button")))
            return
        if message_type == "button_click":
            button = self._resolve_button(payload.get("button"))
            count = max(1, int(payload.get("count", 1)))
            self.mouse.click(button, count)
            return
        if message_type == "scroll":
            delta_y = float(payload.get("delta_y", 0))
            step = 0
            if delta_y > 0:
                step = -1
            elif delta_y < 0:
                step = 1
            if step:
                self.mouse.scroll(0, step)
            return
        if message_type == "key_down":
            self.keyboard.press(self._resolve_key(payload.get("key")))
            return
        if message_type == "key_up":
            self.keyboard.release(self._resolve_key(payload.get("key")))
            return
        if message_type == "key_tap":
            key = self._resolve_key(payload.get("key"))
            self.keyboard.press(key)
            self.keyboard.release(key)
            return
        if message_type == "type_text":
            text = str(payload.get("text", ""))
            for character in text:
                self.keyboard.press(character)
                self.keyboard.release(character)
            return
        if message_type == "cycle_monitor":
            self._cycle_monitor()
            return self.screen_info()

    def _move_mouse(self, payload: dict[str, Any]) -> None:
        monitor = self._get_monitor()
        x_ratio = min(1.0, max(0.0, float(payload.get("x", 0.0))))
        y_ratio = min(1.0, max(0.0, float(payload.get("y", 0.0))))
        width = max(1, monitor["width"])
        height = max(1, monitor["height"])
        x = monitor["left"] + min(width - 1, int((width - 1) * x_ratio))
        y = monitor["top"] + min(height - 1, int((height - 1) * y_ratio))
        self.mouse.position = (x, y)

    def _move_mouse_relative(self, payload: dict[str, Any]) -> None:
        dx = int(round(float(payload.get("dx", 0))))
        dy = int(round(float(payload.get("dy", 0))))
        if dx or dy:
            self.mouse.move(dx, dy)

    def _cycle_monitor(self) -> None:
        monitors = self._list_monitors()
        with self.monitor_lock:
            current_index = self.monitor_index
            if current_index < 1:
                current_index = 1
            self.monitor_index = (current_index % len(monitors)) + 1

    def _resolve_button(self, value: Any) -> Any:
        button_name = str(value or "left").lower()
        if button_name not in self.mouse_buttons:
            raise ValueError(f"Unknown mouse button: {button_name}")
        return self.mouse_buttons[button_name]

    def _resolve_key(self, value: Any) -> Any:
        key_name = str(value or "").strip()
        if not key_name:
            raise ValueError("Empty key value.")

        normalized = key_name.lower()
        if normalized in self.special_keys:
            return self.special_keys[normalized]

        if len(key_name) == 1:
            return key_name

        raise ValueError(f"Unknown key: {key_name}")


class RemoteDesktopStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._desktop: RemoteDesktop | None = None
        self._error: str | None = None
        self._lock = asyncio.Lock()

    async def get(self) -> RemoteDesktop:
        if self._desktop is not None:
            return self._desktop
        if self._error is not None:
            raise RuntimeError(self._error)

        async with self._lock:
            if self._desktop is not None:
                return self._desktop
            if self._error is not None:
                raise RuntimeError(self._error)

            try:
                self._desktop = await asyncio.to_thread(RemoteDesktop, self.settings)
            except Exception as exc:
                self._error = str(exc)
                raise RuntimeError(self._error) from exc

            return self._desktop


settings = Settings()
desktop_store = RemoteDesktopStore(settings)
app = FastAPI(title="netron-computer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def resolve_audio_source() -> str:
    if settings.audio_source:
        return settings.audio_source

    try:
        pactl_info = subprocess.run(
            ["pactl", "info"],
            capture_output=True,
            check=True,
            text=True,
        )
        default_sink = ""
        for line in pactl_info.stdout.splitlines():
            if line.startswith("Default Sink:"):
                default_sink = line.split(":", 1)[1].strip()
                break

        sources_result = subprocess.run(
            ["pactl", "list", "short", "sources"],
            capture_output=True,
            check=True,
            text=True,
        )
        source_names = []
        for line in sources_result.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                source_names.append(parts[1])

        monitor_sources = [name for name in source_names if name.endswith(".monitor")]
        preferred_names = []
        if default_sink:
            default_monitor = default_sink + ".monitor"
            if default_monitor in monitor_sources:
                preferred_names.append(default_monitor)
        preferred_names.extend(
            name for name in monitor_sources if "microphone" not in name.lower()
        )
        preferred_names.extend(name for name in monitor_sources if name not in preferred_names)

        for name in preferred_names:
            if name in source_names:
                return name
    except Exception as exc:
        logging.warning("Failed to resolve audio source automatically: %s", exc)

    raise RuntimeError(
        "Could not detect the system audio source automatically. "
        "Set AUDIO_SOURCE in .env, for example "
        "alsa_output.pci-0000_01_00.1.hdmi-stereo.monitor"
    )


def create_session_token(username: str) -> str:
    username_bytes = username.encode("utf-8")
    signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        username_bytes,
        hashlib.sha256,
    ).digest()
    return (
        base64.urlsafe_b64encode(username_bytes).decode("ascii").rstrip("=")
        + "."
        + base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    )


def create_api_token(username: str) -> str:
    return create_session_token(username)


def decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def is_session_token_valid(token: str | None) -> bool:
    if not token or "." not in token:
        return False

    encoded_username, encoded_signature = token.split(".", 1)

    try:
        username_bytes = decode_base64url(encoded_username)
        signature = decode_base64url(encoded_signature)
    except Exception:
        return False

    if username_bytes.decode("utf-8", errors="ignore") != settings.auth_username:
        return False

    expected_signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        username_bytes,
        hashlib.sha256,
    ).digest()
    return hmac.compare_digest(signature, expected_signature)


def get_request_token(request: Request) -> str | None:
    query_token = request.query_params.get("token")
    if query_token:
        return query_token
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return request.cookies.get(settings.session_cookie_name)


def is_request_authenticated(request: Request) -> bool:
    return is_session_token_valid(get_request_token(request))


def is_websocket_authenticated(websocket: WebSocket) -> bool:
    token = websocket.query_params.get("token")
    if token:
        return is_session_token_valid(token)
    return is_session_token_valid(websocket.cookies.get(settings.session_cookie_name))


def build_mobile_shell_url(request: Request) -> str:
    base_url = str(request.base_url).rstrip("/")
    return base_url + "/mobile"


def build_connect_targets(request: Request) -> list[str]:
    host = request.url.hostname or "127.0.0.1"
    base_port = settings.port
    ports = [base_port]
    for offset in (1, -1, 2, -2, 10):
        candidate = base_port + offset
        if 1 <= candidate <= 65535 and candidate not in ports:
            ports.append(candidate)
    return [f"http://{host}:{port}" for port in ports]


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path

    if path.startswith("/static") or path in {
        "/login",
        "/mobile",
        "/manifest.webmanifest",
        "/service-worker.js",
        "/api/health",
        "/api/public-config",
        "/api/auth/login",
    }:
        return await call_next(request)

    if path not in {"/", "/logout"}:
        return await call_next(request)

    if not is_request_authenticated(request):
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)

    return await call_next(request)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/login", response_model=None)
async def login_page(request: Request):
    if is_request_authenticated(request):
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return FileResponse(STATIC_DIR / "login.html")


@app.get("/mobile")
async def mobile_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "mobile.html")


@app.get("/manifest.webmanifest")
async def manifest() -> FileResponse:
    return FileResponse(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/service-worker.js")
async def service_worker() -> FileResponse:
    return FileResponse(STATIC_DIR / "service-worker.js", media_type="application/javascript")


@app.post("/login")
async def login_submit(request: Request) -> RedirectResponse:
    body = (await request.body()).decode("utf-8", errors="ignore")
    form = parse_qs(body, keep_blank_values=True)
    username = form.get("username", [""])[0]
    password = form.get("password", [""])[0]

    if username != settings.auth_username or password != settings.auth_password:
        return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)

    response = RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_token(username),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )
    return response


@app.get("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(settings.session_cookie_name)
    return response


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "app": "netron-computer",
            "port": settings.port,
            "fps": settings.fps,
            "session_type": os.getenv("XDG_SESSION_TYPE", "unknown"),
            "audio_source": settings.audio_source or "auto",
        }
    )


@app.get("/api/health")
async def api_health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "app": "netron-computer",
            "port": settings.port,
            "fps": settings.fps,
            "session_type": os.getenv("XDG_SESSION_TYPE", "unknown"),
            "audio_enabled": settings.enable_audio,
            "audio_source": settings.audio_source or "auto",
            "language": settings.language,
        }
    )


@app.get("/api/public-config")
async def public_config(request: Request) -> JSONResponse:
    parsed_base = urlparse(str(request.base_url))
    default_host = parsed_base.hostname or "127.0.0.1"
    return JSONResponse(
        {
            "app": "netron-computer",
            "default_host": default_host,
            "default_port": settings.port,
            "language": settings.language,
            "audio_enabled": settings.enable_audio,
            "auto_search_ports": build_connect_targets(request),
            "mobile_shell_url": build_mobile_shell_url(request),
            "supported_languages": ["en", "ru", "es"],
        }
    )


@app.post("/api/auth/login")
async def api_login(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "message": "Invalid JSON body."}, status_code=400)

    username = str(payload.get("username", ""))
    password = str(payload.get("password", ""))

    if username != settings.auth_username or password != settings.auth_password:
        return JSONResponse(
            {"ok": False, "message": "Invalid username or password."},
            status_code=401,
        )

    return JSONResponse(
        {
            "ok": True,
            "token": create_api_token(username),
            "audio_enabled": settings.enable_audio,
            "language": settings.language,
        }
    )


async def frame_sender(websocket: WebSocket, desktop: RemoteDesktop) -> None:
    frame_interval = 1 / settings.fps
    loop = asyncio.get_running_loop()
    next_frame_at = loop.time()
    while True:
        cursor = await asyncio.to_thread(desktop.cursor_info)
        await websocket.send_text(json.dumps({"type": "cursor_update", **cursor}))
        frame = await asyncio.to_thread(desktop.capture_frame)
        await websocket.send_bytes(frame)
        next_frame_at += frame_interval
        await asyncio.sleep(max(0, next_frame_at - loop.time()))


async def command_receiver(websocket: WebSocket, desktop: RemoteDesktop) -> None:
    while True:
        message = await websocket.receive()
        message_type = message.get("type")

        if message_type == "websocket.disconnect":
            return

        text = message.get("text")
        if not text:
            continue

        try:
            payload = json.loads(text)
            result = await asyncio.to_thread(desktop.handle_message, payload)
            if isinstance(result, dict):
                await websocket.send_text(json.dumps({"type": "screen_info", **result}))
        except Exception as exc:
            logging.warning("Skipping invalid control message: %s", exc)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    if not is_websocket_authenticated(websocket):
        await websocket.close(code=4401)
        return

    await websocket.accept()

    try:
        desktop = await desktop_store.get()
        info = await asyncio.to_thread(desktop.screen_info)
        await websocket.send_text(json.dumps({"type": "screen_info", **info}))
    except Exception as exc:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "error",
                    "message": str(exc),
                }
            )
        )
        await websocket.close(code=1011)
        return

    sender = asyncio.create_task(frame_sender(websocket, desktop))
    receiver = asyncio.create_task(command_receiver(websocket, desktop))

    done, pending = await asyncio.wait(
        {sender, receiver},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    for task in pending:
        with suppress(asyncio.CancelledError):
            await task

    for task in done:
        with suppress(asyncio.CancelledError):
            exception = task.exception()
            if exception is not None:
                logging.error("WebSocket task failed", exc_info=exception)


@app.websocket("/ws-audio")
async def websocket_audio_endpoint(websocket: WebSocket) -> None:
    if not is_websocket_authenticated(websocket):
        await websocket.close(code=4401)
        return

    if not settings.enable_audio:
        await websocket.close(code=4403)
        return

    await websocket.accept()

    audio_source = resolve_audio_source()
    channels = 2
    bytes_per_sample = 2
    chunk_size = max(
        1024,
        int(settings.audio_sample_rate * channels * bytes_per_sample * settings.audio_chunk_ms / 1000),
    )

    ffmpeg_command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-thread_queue_size",
        "64",
        "-probesize",
        "32",
        "-analyzeduration",
        "0",
        "-f",
        "pulse",
        "-i",
        audio_source,
        "-vn",
        "-ac",
        str(channels),
        "-ar",
        str(settings.audio_sample_rate),
        "-af",
        "aresample=async=0:min_hard_comp=0.0:first_pts=0",
        "-c:a",
        "pcm_s16le",
        "-f",
        "s16le",
        "pipe:1",
    ]

    process = await asyncio.create_subprocess_exec(
        *ffmpeg_command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "audio_config",
                    "sample_rate": settings.audio_sample_rate,
                    "channels": channels,
                    "format": "s16le",
                    "chunk_ms": settings.audio_chunk_ms,
                }
            )
        )

        assert process.stdout is not None
        while True:
            chunk = await process.stdout.read(chunk_size)
            if not chunk:
                break
            await websocket.send_bytes(chunk)
    except Exception as exc:
        logging.info("Audio websocket closed: %s", exc)
    finally:
        if process.returncode is None:
            process.kill()
            with suppress(ProcessLookupError):
                await process.wait()
        if process.stderr is not None:
            with suppress(Exception):
                await process.stderr.read()
        with suppress(Exception):
            await websocket.close()


@app.get("/audio-stream", response_model=None)
async def audio_stream(request: Request):
    if not is_request_authenticated(request):
        return JSONResponse({"ok": False, "message": "Unauthorized."}, status_code=401)

    if not settings.enable_audio:
        return JSONResponse({"ok": False, "message": "Audio streaming is disabled."}, status_code=403)

    audio_source = resolve_audio_source()

    ffmpeg_command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-flush_packets",
        "1",
        "-thread_queue_size",
        "64",
        "-f",
        "pulse",
        "-i",
        audio_source,
        "-vn",
        "-ac",
        "2",
        "-ar",
        str(settings.audio_sample_rate),
        "-c:a",
        "aac",
        "-profile:a",
        "aac_low",
        "-b:a",
        "96k",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-f",
        "adts",
        "pipe:1",
    ]

    process = await asyncio.create_subprocess_exec(
        *ffmpeg_command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    async def stream_bytes():
        try:
            assert process.stdout is not None
            while True:
                chunk = await process.stdout.read(4096)
                if not chunk:
                    break
                yield chunk
        finally:
            if process.returncode is None:
                process.kill()
                with suppress(ProcessLookupError):
                    await process.wait()
            if process.stderr is not None:
                with suppress(Exception):
                    await process.stderr.read()

    return StreamingResponse(
        stream_bytes(),
        media_type="audio/aac",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
        },
    )


def main() -> None:
    import uvicorn

    uvicorn.run(
        "netron_computer.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )
