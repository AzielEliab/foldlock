"""Local FoldLock UI. Bind 127.0.0.1:8872 only.

Buttons: Fold file, Unfold, Info, Verify (hashes), Doctor, Sample vectors,
Export receipt. Simple / Advanced. Show zip: False, method tether-suppression,
hits, ratio. No CDN, no telemetry. Loopback only.
"""

from __future__ import annotations

import base64
import hashlib
import json
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from urllib.parse import urlparse

from foldlock.engine import (
    ENGINE_VERSION,
    LIMITATION,
    VECTORS_TEXT,
    fold_bytes,
    info_bytes,
    unfold_bytes,
    verify_bytes,
)
from foldlock.uni1 import FoldRefuse

LOOPBACK = frozenset({"127.0.0.1", "localhost", "::1"})
WEB = files("foldlock") / "web"
MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".fld": "application/octet-stream",
    ".txt": "text/plain; charset=utf-8",
}
MAX_BODY_BYTES = 8 * 1024 * 1024

_STATE: dict[str, bytes | dict | None] = {
    "original": VECTORS_TEXT.encode("utf-8"),
    "folded": None,
    "receipt": None,
    "name": "VECTORS.txt",
}


def _web_bytes(name: str) -> bytes:
    return (WEB / name).read_bytes()


def _ensure_fold() -> dict:
    original = _STATE["original"] or VECTORS_TEXT.encode("utf-8")
    folded = _STATE["folded"]
    receipt = _STATE["receipt"]
    if folded is None or receipt is None:
        folded, receipt = fold_bytes(original, name=str(_STATE["name"] or "upload.txt"))
        _STATE["folded"] = folded
        _STATE["receipt"] = receipt
    return _snapshot()


def _snapshot() -> dict:
    original = _STATE["original"] or b""
    folded = _STATE["folded"]
    receipt = dict(_STATE["receipt"] or {})
    info = None
    unfold_meta = None
    verified = None
    error = None
    if folded:
        try:
            info = info_bytes(folded)
            restored, unfold_meta = unfold_bytes(folded)
            verified = verify_bytes(original, restored)
        except ValueError as exc:
            error = str(exc)
    receipt.setdefault("zip", False)
    receipt.setdefault("method", receipt.get("strategy") or "adaptive")
    receipt.setdefault("limitation", LIMITATION)
    method = receipt.get("method") or "adaptive"
    return {
        "product": "foldlock",
        "version": ENGINE_VERSION,
        "name": _STATE["name"],
        "limitation": LIMITATION,
        "zip": False,
        "method": method,
        "receipt": receipt,
        "info": info,
        "unfold": unfold_meta,
        "verify": verified,
        "error": error,
        "orig_size": len(original),
        "orig_sha256": hashlib.sha256(original).hexdigest() if original else "",
        "folded_size": len(folded) if folded else 0,
        "tether_hits": (receipt or {}).get("tether_hits"),
        "ratio": (receipt or {}).get("ratio"),
        "has_folded": folded is not None,
        "sample_text": original.decode("utf-8") if _is_text(original) else None,
    }


def _is_text(raw: bytes) -> bool:
    try:
        raw.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


class Handler(BaseHTTPRequestHandler):
    server_version = f"FoldLock/{ENGINE_VERSION}"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _send(self, status: int, body: bytes, content_type: str, filename: str | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj: object) -> None:
        body = json.dumps(obj, indent=2, ensure_ascii=False, default=str).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def _read_body(self) -> bytes | None:
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._json(400, {"error": "invalid Content-Length"})
            return None
        if length < 0:
            self._json(400, {"error": "invalid Content-Length"})
            return None
        if length > MAX_BODY_BYTES:
            self._json(413, {"error": "payload too large", "limit": MAX_BODY_BYTES, "limitation": LIMITATION})
            return None
        return self.rfile.read(length) if length else b"{}"

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self._send(200, _web_bytes("index.html"), MIME[".html"])
            return
        if path == "/style.css":
            self._send(200, _web_bytes("style.css"), MIME[".css"])
            return
        if path == "/app.js":
            self._send(200, _web_bytes("app.js"), MIME[".js"])
            return
        if path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "version": ENGINE_VERSION,
                    "loopback": True,
                    "telemetry": False,
                    "zip": False,
                    "method": "adaptive",
                    "limitation": LIMITATION,
                },
            )
            return
        if path == "/api/state":
            self._json(200, _ensure_fold())
            return
        if path == "/api/download.fld":
            _ensure_fold()
            folded = _STATE["folded"] or b""
            name = str(_STATE["name"] or "foldlock") + ".fld"
            self._send(200, folded, MIME[".fld"], name)
            return
        if path == "/api/download.txt":
            original = _STATE["original"] or b""
            self._send(200, original, MIME[".txt"], str(_STATE["name"] or "unfolded.txt"))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        allowed = {
            "/api/fold",
            "/api/unfold",
            "/api/info",
            "/api/verify",
            "/api/sample",
            "/api/export",
            "/api/doctor",
            "/api/text",
        }
        if path not in allowed:
            self._json(404, {"error": "not found"})
            return
        raw = self._read_body()
        if raw is None:
            return

        if path == "/api/sample":
            _STATE["original"] = VECTORS_TEXT.encode("utf-8")
            _STATE["name"] = "VECTORS.txt"
            blob, receipt = fold_bytes(_STATE["original"], name="VECTORS.txt")
            _STATE["folded"] = blob
            _STATE["receipt"] = receipt
            self._json(200, _snapshot())
            return

        if path == "/api/verify":
            self._json(200, _ensure_fold())
            return

        if path == "/api/info":
            self._json(200, _ensure_fold())
            return

        if path == "/api/export":
            snap = _ensure_fold()
            self._json(
                200,
                {
                    "receipt": snap,
                    "filename": "foldlock-receipt.json",
                    "limitation": LIMITATION,
                    "zip": False,
                    "method": snap.get("method") or "adaptive",
                },
            )
            return

        if path == "/api/doctor":
            from foldlock.doctor import run_doctor
            import io
            from contextlib import redirect_stdout

            buf = io.StringIO()
            with redirect_stdout(buf):
                code = run_doctor(as_json=True)
            text = buf.getvalue()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                payload = {"ok": code == 0, "raw": text}
            payload["exit"] = code
            self._json(200, payload)
            return

        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            # raw file upload
            payload = None

        if path == "/api/text":
            if not isinstance(payload, dict):
                self._json(400, {"error": "JSON body required"})
                return
            text = str(payload.get("text") or "")
            name = str(payload.get("name") or "typed.txt")
            original = text.encode("utf-8")
            try:
                blob, receipt = fold_bytes(original, name=name)
            except (ValueError, FoldRefuse) as exc:
                self._json(400, {"error": str(exc), "limitation": LIMITATION, "zip": False})
                return
            _STATE["original"] = original
            _STATE["folded"] = blob
            _STATE["receipt"] = receipt
            _STATE["name"] = name
            self._json(200, _snapshot())
            return

        if path == "/api/fold":
            name = "upload.txt"
            data = raw
            if isinstance(payload, dict):
                name = str(payload.get("name") or name)
                b64 = payload.get("b64") or payload.get("bytes_b64")
                text = payload.get("text")
                if b64:
                    try:
                        data = base64.b64decode(b64)
                    except Exception as exc:  # noqa: BLE001
                        self._json(400, {"error": f"bad base64: {exc}"})
                        return
                elif text is not None:
                    data = str(text).encode("utf-8")
            try:
                blob, receipt = fold_bytes(data, name=name)
            except (ValueError, FoldRefuse) as exc:
                self._json(400, {"error": str(exc), "limitation": LIMITATION, "zip": False})
                return
            _STATE["original"] = data
            _STATE["folded"] = blob
            _STATE["receipt"] = receipt
            _STATE["name"] = name
            self._json(200, _snapshot())
            return

        if path == "/api/unfold":
            name = "upload.fld"
            data = raw
            if isinstance(payload, dict):
                name = str(payload.get("name") or name)
                b64 = payload.get("b64") or payload.get("bytes_b64")
                if b64:
                    try:
                        data = base64.b64decode(b64)
                    except Exception as exc:  # noqa: BLE001
                        self._json(400, {"error": f"bad base64: {exc}"})
                        return
            try:
                restored, meta = unfold_bytes(data)
            except ValueError as exc:
                self._json(400, {"error": str(exc), "limitation": LIMITATION, "zip": False, "verified": False})
                return
            _STATE["original"] = restored
            _STATE["folded"] = data
            _STATE["receipt"] = meta
            _STATE["name"] = name[:-4] if name.endswith(".fld") else name
            self._json(200, _snapshot())
            return

        self._json(404, {"error": "not found"})


def make_server(host: str = "127.0.0.1", port: int = 8872) -> ThreadingHTTPServer:
    if host not in LOOPBACK:
        raise ValueError("FoldLock UI binds loopback only (127.0.0.1)")
    return ThreadingHTTPServer((host, port), Handler)


def serve(host: str = "127.0.0.1", port: int = 8872) -> None:
    httpd = make_server(host, port)
    bound_host, bound_port = httpd.server_address[:2]
    print(
        f"FoldLock UI http://{bound_host}:{bound_port} "
        "(loopback only; zip-class SOTA UNI1 compression engine)"
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
