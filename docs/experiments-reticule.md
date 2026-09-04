# Discarded experiment: 2×2 reticule / glyph rotation

**Status:** not shipped. Not a codec. Not encryption.

During the Aziel runtime integration design thread, a geometry idea was
explored: treat residual bytes as glyphs on a 2×2 reticule, rotate or
permute cells, and present the fold as something that “looks like
encryption but everyone has the key.”

That path was dropped.

Reasons:

1. **Size.** Rotation and glyph theatre do not densify UTF-8 prose.
   They add framing and usually grow the file.
2. **Honesty.** A public permutation is not confidentiality. Shipping
   it as if it were encryption would be crypto-cosplay.
3. **Restore.** FoldLock’s gate is exact byte restore (`orig_size` +
   SHA-256). A reticule that is not smaller and not secret fails both
   the product claim and the receipt.

What shipped instead is UNI1: classify → allowlist → bakeoff →
passthrough if nothing shrinks. Receipts stay structural (`strategy`,
`beats_zstd` when zstd is present, `zip: false`).

Do not reintroduce reticule / rotation / fake-crypto layers for size.

Author: Aziel Eliab. Apache-2.0.
