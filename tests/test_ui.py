"""Local UI: loopback only, no CDN, Fold/Unfold/Verify."""

from __future__ import annotations

import json
import threading
import urllib.request

import pytest

from foldlock.ui import LOOPBACK, make_server


def test_ui_rejects_non_loopback() -> None:
    with pytest.raises(ValueError, match="loopback"):
        make_server("0.0.0.0", 9)
    assert "127.0.0.1" in LOOPBACK


def _serve():
    httpd = make_server("127.0.0.1", 0)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def test_ui_get_root_honest_scope() -> None:
    httpd = _serve()
    port = httpd.server_address[1]
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as resp:
            html = resp.read().decode("utf-8")
        assert "FoldLock" in html
        assert "THIS IS" in html
        assert "THIS IS NOT" in html
        assert "zip: False" in html or "not zip" in html.lower()
        assert "Fold" in html
        assert "Unfold" in html
        assert "Verify" in html
        assert "cdnjs" not in html.lower()
        assert "unpkg" not in html.lower()
        assert "jsdelivr" not in html.lower()
        assert "GodLock.AZ" not in html
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/style.css", timeout=3) as resp:
            css = resp.read().decode("utf-8")
        assert "--gold" in css or "c9a227" in css
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=3) as resp:
            health = json.loads(resp.read().decode("utf-8"))
        assert health["ok"] is True
        assert health["loopback"] is True
        assert health["telemetry"] is False
        assert health["zip"] is False
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/sample",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            state = json.loads(resp.read().decode("utf-8"))
        assert state["zip"] is False
        assert state["method"] in {"tether-suppression", "passthrough", "sir", "adaptive", "tether-peer", "bodyx"}
        assert state["verify"]["ok"] is True
        assert state["receipt"]["orig_size"] == 63
        assert state["receipt"]["folded_size"] <= 63
    finally:
        httpd.shutdown()
        httpd.server_close()
