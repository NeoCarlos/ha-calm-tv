# anti-slop (vendored)

Oxlint plugin rules that reject low-evidence TypeScript patterns, copied into this repository so
we own them (rules, diagnostics and configuration).

- **Source:** https://github.com/dmmulroy/anti-slop (MIT)
- **Commit:** `13909c9e07590f5a85d93c62712259fe14a883f7`, copied from
  `skills/install-anti-slop/assets/anti-slop/` on 2026-11-15 with the `install-anti-slop` skill.
- **Installed at:** `tools/oxlint/anti-slop/` (generic plugin, `index.ts`). The opt-in Effect plugin
  (`effect/`) is copied but not enabled: this project doesn't use Effect.
- **Dependencies:** `oxlint` and `@oxlint/plugins`, pinned to the same exact version (1.93.0).
- **Configuration:** `.oxlintrc.json`, all generic rules plus `oxc/no-accumulating-spread` at `"error"`.
  Ignores agent tooling folders, this folder, `android/` and `dist/`.
- **Local deviations:** none.

To update, use the skill's update procedure (`references/update.md`) rather than copying over this
folder, so local changes are preserved.
