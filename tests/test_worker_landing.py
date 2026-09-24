"""Homepage Download is the hero link. Counting stays on /download."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "workers" / "download-tracker" / "src" / "index.js").read_text(
    encoding="utf-8"
)
HTML = INDEX[INDEX.index("<!doctype html>") : INDEX.rindex("</html>") + 7]


def test_primary_download_is_the_hero_link() -> None:
    assert 'id="downloadBtn"' in HTML
    assert 'class="btn block primary"' in HTML
    assert 'href="/download?asset=${DEFAULT_ASSET}"' in HTML
    assert 'const DEFAULT_ASSET = "foldlock-0.8.0.tar.gz"' in INDEX
    assert ">Download</a>" in HTML
    # The button is in the hero, ahead of the tracker card and the mesh strip.
    assert HTML.index('id="downloadBtn"') < HTML.index('id="tracker"')
    assert HTML.index('id="downloadBtn"') < HTML.index('id="meshStrip"')


def test_quiet_footer_focus_and_color_scheme() -> None:
    assert '<footer class="quiet">' in HTML
    assert "prefers-color-scheme: light" in HTML
    assert ":focus-visible" in HTML
    assert "@media (max-width: 420px)" in HTML
    assert "Aziel Eliab" in HTML


def test_landing_keeps_counters_mesh_and_routes() -> None:
    assert ">Views</span>" in HTML
    assert ">Downloads</span>" in HTML
    assert 'id="btn-install"' in HTML
    assert 'id="install-line"' in HTML
    assert 'id="meshStrip"' in HTML
    assert 'id="meshLiveCount"' in HTML
    assert "FragGate slug=mesh" in HTML
    assert 'href="/stats"' in HTML
    assert 'href="/openapi.json"' in HTML
    assert 'href="/v1/mesh"' in HTML
    assert 'href="/v1/skill"' in HTML
    assert 'href="/ai"' in HTML
