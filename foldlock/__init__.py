"""FoldLock: SOTA zip-class compression engine for UTF-8 text (adaptive UNI1).

Author: Aziel Eliab, 2026. Apache-2.0.
Forks are welcome and always allowed.
"""

from __future__ import annotations

from foldlock.engine import (
    ENGINE_VERSION,
    LIMITATION,
    MAGIC,
    MAGIC_UNI1,
    PAPER_ID,
    SPEC_STRING,
    TETHERS,
    VECTORS_ORIG_SIZE,
    VECTORS_SHA256,
    VECTORS_TEXT,
    expand,
    fold,
    fold_bytes,
    fold_fld3_bytes,
    info,
    info_bytes,
    suppress,
    unfold,
    unfold_bytes,
    verify_bytes,
)

__version__ = "0.8.0"
__author__ = "Aziel Eliab"
__all__ = [
    "ENGINE_VERSION",
    "LIMITATION",
    "MAGIC",
    "MAGIC_UNI1",
    "PAPER_ID",
    "SPEC_STRING",
    "TETHERS",
    "VECTORS_ORIG_SIZE",
    "VECTORS_SHA256",
    "VECTORS_TEXT",
    "__version__",
    "expand",
    "fold",
    "fold_bytes",
    "fold_fld3_bytes",
    "info",
    "info_bytes",
    "suppress",
    "unfold",
    "unfold_bytes",
    "verify_bytes",
]
