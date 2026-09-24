# FoldLock on iPhone and Android

The phone screen is a simple reader. The fold runs in the desktop package.

**Author:** Aziel Eliab

## Start

1. `cd mobile`
2. `flutter create --org com.azieeliab --project-name foldlock .`
3. `flutter pub get && flutter run`

## Notes

Application id: `com.azieeliab.foldlock`. Offline. Light and dark follow the system. Gold focus.

FoldLock folds UTF-8 text and restores the same bytes when the size and SHA-256 match. Short text stays the same size. Photos, ZIP archives, and other already-compressed files are refused. Ratios are per-file receipts.

Desktop package: https://github.com/AzielEliab/foldlock

**Forks are welcome and always allowed.**
