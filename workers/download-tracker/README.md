# foldlock download tracker

Isolated Worker `foldlock-download-tracker`. Project `foldlock`.
KV namespace `FOLDLOCK_DOWNLOADS` bound as `DOWNLOADS`.
Does **not** 302 to GitHub on `/download`. Serves gzip via `ASSETS.fetch`,
`Cache-Control: private, no-store`.

`/v1` hosts FoldLock 0.8.0-UNI1 preview (classify → bakeoff → passthrough).
SOTA zip-class compression engine for UTF-8 text. Not the ZIP container
format. Author Aziel Eliab.

GET `/` increments a **page-view** counter (separate from downloads).
GET `/download` increments **downloads**.
`/v1` never increments DOWNLOADS KV.

Host: https://foldlock-download-tracker.vibelock.workers.dev
