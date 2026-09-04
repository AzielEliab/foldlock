"""Controlled peer / abbreviation / optional Latin packs.

Replacements are opcodes that restore the original token. They are not
synonym rewrites in the text (house is never stored as the letters home).
Latin is an optional extra dictionary, never a translate-then-fold pass.

Author: Aziel Eliab, 2026. Apache-2.0.
"""

from __future__ import annotations

# Longer common English words (4+ letters), append-only. Not in TETH-1.
# Encoded as a short opcode; unfold restores this exact spelling.
PEER_PACK: tuple[str, ...] = (
    "about",
    "after",
    "again",
    "against",
    "almost",
    "already",
    "although",
    "always",
    "another",
    "around",
    "because",
    "before",
    "behind",
    "between",
    "beyond",
    "cannot",
    "child",
    "children",
    "company",
    "country",
    "different",
    "during",
    "enough",
    "everyone",
    "everything",
    "example",
    "family",
    "first",
    "following",
    "government",
    "great",
    "group",
    "himself",
    "home",
    "house",
    "however",
    "human",
    "important",
    "including",
    "information",
    "instead",
    "itself",
    "little",
    "million",
    "money",
    "month",
    "mother",
    "never",
    "nothing",
    "number",
    "often",
    "people",
    "percent",
    "perhaps",
    "place",
    "possible",
    "power",
    "probably",
    "problem",
    "program",
    "public",
    "question",
    "rather",
    "really",
    "school",
    "second",
    "several",
    "should",  # also a tether; filtered at bind time if present
    "since",
    "someone",
    "something",
    "state",
    "still",
    "story",
    "student",
    "system",
    "themselves",
    "therefore",
    "thing",
    "things",
    "though",
    "thousand",
    "through",
    "today",
    "together",
    "toward",
    "under",  # tether; filtered
    "until",
    "water",
    "week",
    "whether",
    "while",
    "without",
    "within",
    "woman",
    "world",
    "year",
    "years",
    "young",
)

# True abbreviations / clipped forms. Never expanded to a longer phrase.
ABBREV_PACK: tuple[str, ...] = (
    "approx",
    "dept",
    "govt",
    "intl",
    "acct",
    "admin",
    "config",
    "info",
    "qty",
    "avg",
    "amt",
    "est",
    "fig",
    "vol",
    "chap",
    "stat",
    "temp",
    "blvd",
    "assoc",
    "corp",
    "univ",
    "sept",
    "jan",
    "feb",
    "aug",
    "oct",
    "nov",
    "dec",
)

# Optional Latin-flavored peer IDs. Opcode restores the English word.
# Never writes Latin into the residual. Default off.
LATIN_PACK: tuple[str, ...] = (
    "according",
    "across",
    "among",
    "before",
    "between",
    "cause",
    "circle",
    "city",
    "day",
    "father",
    "friend",
    "hand",
    "life",
    "light",
    "man",
    "name",
    "night",
    "part",
    "time",
    "voice",
    "war",
    "way",
    "word",
    "work",
)

assert len(PEER_PACK) <= 255
assert len(ABBREV_PACK) <= 255
assert len(LATIN_PACK) <= 255


def bind_pack(words: tuple[str, ...], exclude: set[str]) -> tuple[str, ...]:
    """Stable unique pack with excluded lexicon words removed (keep order)."""
    out: list[str] = []
    seen: set[str] = set()
    for w in words:
        key = w.lower()
        if key in exclude or key in seen:
            continue
        seen.add(key)
        out.append(key)
    if len(out) > 255:
        raise ValueError("pack exceeds 255 ids")
    return tuple(out)
