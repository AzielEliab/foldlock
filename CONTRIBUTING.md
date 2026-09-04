# Contributing to FoldLock

**Forks are first-class.** This project is Apache-2.0; you do not need
permission to fork, patch, or redistribute.

**Forks are welcome and always allowed.**

## How to run tests

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m pytest -q
```

Python 3.10+. Codec is stdlib only (`hashlib`, `re`, `struct`). pytest is
the dev extra. No network. No ML. No zlib for the fold.

## Ground rules

1. **Zip-class software, not the ZIP format.** Do not wrap zlib/gzip/DEFLATE and keep the name FoldLock.
2. **TETH-1 is append-only.** Do not reorder IDs 0..111.
3. **Unfold is a gate.** Refuse unless `len == orig_size` AND SHA-256 matches.
4. **UI binds loopback only** (`127.0.0.1:8872`). Do not listen on `0.0.0.0`. No telemetry. No CDN.
5. **Do not mix the download tracker** with any other product's Worker or KV. Namespace `FOLDLOCK_DOWNLOADS` only.
6. **Public identity is Aziel Eliab only.** GodLock may appear only as a sibling product name in the mesh table.
7. This repo is FoldLock only. WhistleLock is a sibling; same preprint, different tree.
8. New behavior needs a test that fails without the change.

## Where to change things

- Codec: `foldlock/engine.py` (FLD3 TETH), `foldlock/sir.py`, `foldlock/uni1.py`, `foldlock/classify.py`, `foldlock/packs.py`
- CLI: `foldlock/cli.py`
- Doctor: `foldlock/doctor.py`
- Local UI: `foldlock/ui.py`, `foldlock/web/`
- Skill: `SKILL.md`
- Spec: `docs/whitepaper.md`
- Catalog bump (aziel-runtime + corpus listing hint): `docs/catalog-aziel-runtime.md`
- Flutter: `mobile/`
- Isolated counter: `workers/download-tracker/`

## License of contributions

By submitting a change you agree it is licensed under Apache-2.0, the
same license as the rest of the tree. Keep the copyright lines honest.
Ship as Aziel Eliab.
