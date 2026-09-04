"""UNI1 input classifier: extension + magic + UTF-8/entropy sniff.

Author: Aziel Eliab, 2026. Apache-2.0.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

KIND_PROSE = "prose"
KIND_CODE = "code"
KIND_MARKUP = "markup"
KIND_COMPRESSED = "compressed"
KIND_MIXED = "mixed"

KIND_ID = {
    KIND_PROSE: 0,
    KIND_CODE: 1,
    KIND_MARKUP: 2,
    KIND_MIXED: 3,
    KIND_COMPRESSED: 4,
}
ID_KIND = {v: k for k, v in KIND_ID.items()}

COMPRESSED_MAGICS: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"%PDF", "pdf"),
    (b"PK\x03\x04", "zip"),
    (b"PK\x05\x06", "zip"),
    (b"PK\x07\x08", "zip"),
    (b"\x1f\x8b", "gzip"),
    (b"\x28\xb5\x2f\xfd", "zstd"),
    (b"\x04\x22\x4d\x18", "lz4"),
    (b"7z\xbc\xaf'\x1c", "7z"),
    (b"Rar!\x1a\x07", "rar"),
    (b"\xfd7zXZ\x00", "xz"),
    (b"BZh", "bz2"),
    (b"\x00\x00\x01\x00", "ico"),
    (b"RIFF", "riff"),
    (b"\x00\x00\x00\x0cjP  ", "jp2"),
    (b"\x1aE\xdf\xa3", "mkv"),
    (b"OggS", "ogg"),
    (b"fLaC", "flac"),
    (b"ID3", "mp3"),
    (b"\xff\xfb", "mp3"),
    (b"\x89HDF\r\n\x1a\n", "hdf5"),
)

COMPRESSED_EXT = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".pdf",
    ".zip",
    ".gz",
    ".tgz",
    ".tar",
    ".bz2",
    ".xz",
    ".zst",
    ".zstd",
    ".lz4",
    ".7z",
    ".rar",
    ".woff",
    ".woff2",
    ".mp3",
    ".mp4",
    ".m4a",
    ".ogg",
    ".flac",
    ".wav",
    ".ico",
    ".jar",
    ".whl",
    ".docx",
    ".xlsx",
    ".pptx",
}

PROSE_EXT = {
    ".txt",
    ".text",
    ".md",
    ".markdown",
    ".rst",
    ".adoc",
    ".org",
    ".tex",
    ".ltx",
    ".csv",
    ".tsv",
    ".log",
}

CODE_EXT = {
    ".py",
    ".pyi",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".c",
    ".h",
    ".cc",
    ".cpp",
    ".hpp",
    ".rs",
    ".go",
    ".java",
    ".kt",
    ".swift",
    ".rb",
    ".php",
    ".cs",
    ".scala",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".lua",
    ".r",
    ".m",
    ".sql",
    ".dart",
    ".vim",
    ".el",
}

MARKUP_EXT = {
    ".json",
    ".html",
    ".htm",
    ".xml",
    ".xhtml",
    ".svg",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".css",
}

CODE_SNIPPETS = (
    "def ",
    "class ",
    "function ",
    "import ",
    "from ",
    "#!/",
    "fn ",
    "func ",
    "public ",
    "private ",
    "const ",
    "let ",
    "var ",
    "return ",
    "#include",
    "package ",
)


class Classification:
    __slots__ = ("kind", "reason", "media", "utf8", "entropy", "name")

    def __init__(
        self,
        kind: str,
        reason: str,
        media: str = "",
        utf8: bool = False,
        entropy: float = 0.0,
        name: str = "",
    ) -> None:
        self.kind = kind
        self.reason = reason
        self.media = media
        self.utf8 = utf8
        self.entropy = entropy
        self.name = name

    def as_dict(self) -> dict:
        return {
            "class": self.kind,
            "reason": self.reason,
            "media": self.media,
            "utf8": self.utf8,
            "entropy": round(self.entropy, 4),
            "name": self.name,
        }


def shannon_entropy(raw: bytes) -> float:
    if not raw:
        return 0.0
    n = len(raw)
    counts = Counter(raw)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def sniff_magic(raw: bytes) -> str | None:
    for magic, name in COMPRESSED_MAGICS:
        if raw.startswith(magic):
            if name == "riff" and len(raw) >= 12 and raw[8:12] in {b"WEBP", b"WAVE", b"AVI "}:
                return name
            if name == "riff":
                continue
            return name
    return None


def _ext(name: str) -> str:
    return Path(name).suffix.lower() if name else ""


def classify(raw: bytes, name: str = "") -> Classification:
    """Detect prose / code / markup / compressed / mixed."""
    ext = _ext(name)
    magic = sniff_magic(raw)
    ent = shannon_entropy(raw)

    if magic:
        return Classification(KIND_COMPRESSED, f"magic:{magic}", magic, False, ent, name)
    if ext in COMPRESSED_EXT:
        return Classification(KIND_COMPRESSED, f"ext:{ext}", ext.lstrip("."), False, ent, name)

    try:
        text = raw.decode("utf-8")
        utf8 = True
    except UnicodeDecodeError:
        if ent >= 7.0:
            return Classification(KIND_COMPRESSED, "high-entropy-binary", "bin", False, ent, name)
        return Classification(KIND_MIXED, "non-utf8", "bin", False, ent, name)

    stripped = text.lstrip()
    if ext in MARKUP_EXT:
        return Classification(KIND_MARKUP, f"ext:{ext}", ext.lstrip("."), True, ent, name)
    if ext in CODE_EXT:
        return Classification(KIND_CODE, f"ext:{ext}", ext.lstrip("."), True, ent, name)
    if ext in PROSE_EXT:
        return Classification(KIND_PROSE, f"ext:{ext}", ext.lstrip("."), True, ent, name)

    if stripped[:1] in "{[":
        try:
            json.loads(text)
            return Classification(KIND_MARKUP, "json-sniff", "json", True, ent, name)
        except json.JSONDecodeError:
            pass
    if stripped.startswith("<") and (
        stripped.lower().startswith("<!doctype")
        or stripped.lower().startswith("<html")
        or stripped.lower().startswith("<?xml")
        or "</" in stripped[:400]
    ):
        return Classification(KIND_MARKUP, "html-xml-sniff", "html", True, ent, name)

    low = text[:2000]
    code_hits = sum(1 for s in CODE_SNIPPETS if s in low)
    brace = text.count("{") + text.count("}") + text.count(";")
    if code_hits >= 3 or (code_hits >= 1 and brace >= 8 and len(text) < 8000):
        return Classification(KIND_CODE, "code-sniff", "code", True, ent, name)

    # High-entropy UTF-8 that is not language-like (already compressed text? rare)
    if ent >= 7.5 and len(raw) >= 64:
        return Classification(KIND_MIXED, "high-entropy-utf8", "mix", True, ent, name)

    letters = sum(1 for ch in text if ch.isalpha() or ch.isspace())
    if raw and letters / len(text) >= 0.55:
        return Classification(KIND_PROSE, "utf8-prose-sniff", "txt", True, ent, name)
    return Classification(KIND_MIXED, "utf8-unknown", "mix", True, ent, name)


def allowlist_for(kind: str) -> tuple[str, ...]:
    """Strategies allowed to compete for this class."""
    if kind == KIND_PROSE:
        return ("sir", "teth", "teth_peer", "bodyx")
    if kind == KIND_CODE:
        return ("teth",)
    if kind == KIND_MARKUP:
        return ("teth",)
    if kind == KIND_MIXED:
        return ("sir", "teth")
    return ()
