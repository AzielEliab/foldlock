"""Worker homepage rose-star brand mark (Aziel Eliab only).

Public HTML uses /sigil.png with empty alt and no words on the mark.
Do not put “everblooming sigil” on the mark. FragGate / Remain-OFF untouched.
Verify contracts that require Everblooming header/skill strings stay unchanged.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "workers" / "download-tracker" / "src" / "index.js").read_text(
    encoding="utf-8"
)
MESH = (ROOT / "workers" / "download-tracker" / "src" / "mesh.js").read_text(
    encoding="utf-8"
)
RUNTIME = (ROOT / "workers" / "download-tracker" / "src" / "runtime.js").read_text(
    encoding="utf-8"
)
SKILL = (ROOT / "SKILL.md").read_text(encoding="utf-8")
PUBLIC_SIGIL = ROOT / "workers" / "download-tracker" / "public" / "sigil.png"

BRAND_ROW = (
    '<div class="brandrow"><img class="brandmark" src="/sigil.png" '
    'width="40" height="40" alt="" decoding="async"></div>'
)


def test_homepage_has_rose_star_brandrow() -> None:
    assert BRAND_ROW in INDEX
    assert 'class="brandrow"' in INDEX
    assert 'class="brandmark"' in INDEX
    assert 'src="/sigil.png"' in INDEX
    assert 'alt=""' in INDEX
    assert "Aziel Eliab" in INDEX


def test_public_html_does_not_name_everblooming_on_the_mark() -> None:
    html = INDEX[INDEX.index("<!doctype html>") : INDEX.rindex("</html>") + 7]
    assert "everblooming" not in html.lower()
    assert "Everblooming sigil" not in INDEX
    assert 'alt="everblooming sigil"' not in INDEX.lower()
    assert 'title="Home — everblooming sigil"' not in INDEX
    assert "everblooming" not in BRAND_ROW.lower()
    brand_start = INDEX.find('<div class="brandrow">')
    brand_end = INDEX.find("</div>", brand_start) + len("</div>")
    brand = INDEX[brand_start:brand_end]
    assert "everblooming" not in brand.lower()
    assert 'alt=""' in brand


def test_hosted_sigil_is_official_rose_star_png() -> None:
    assert PUBLIC_SIGIL.is_file()
    data = PUBLIC_SIGIL.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    # Official Aziel rose-star is ~75KB. Reject the 4KB placeholder.
    assert 70000 <= len(data) <= 80000


def test_fraggate_and_mesh_proxy_untouched() -> None:
    assert "FragGate slug=mesh" in INDEX
    assert "handleMeshApi(request, url, env)" in INDEX
    assert "MESH_DEFAULT_OFF = true" in MESH
    assert "Remain-OFF" not in INDEX
    assert "Remain-OFF" not in MESH


def test_skill_and_runtime_identity_contracts_unchanged() -> None:
    """Header/skill verify strings stay as they were (Aziel Eliab only)."""
    assert "FoldLock" in SKILL
    assert "Author Aziel Eliab" in SKILL
    assert "const SKILL =" in RUNTIME
    assert "name: FoldLock" in RUNTIME
    assert "Author Aziel Eliab" in RUNTIME
    assert "Aziel Eliab" in RUNTIME
    # Do not rewrite header/skill strings if a verify contract requires
    # the words "Everblooming" — none exist on this public mark.
    assert "Everblooming" not in BRAND_ROW
