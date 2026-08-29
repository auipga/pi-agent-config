# Context

## Architecture

Top-level layout:

- `README.md`: short installation notes.
- `CONTEXT.md`: this file; the canonical local guide for agents.
- `extensions/`: custom extensions (`ts` files) and config (`json` files) of vendored extensions.
  - `date.ts` sends the current date as user message by `/date`.
  - `gnome-system-theme.ts` poll Gnome's dark mode and follow.
  - `manual-context-guard.ts` limits reads to `@`attached paths.
  - `pi-permission-system/config.json` configuration for `~/git/gotgenes/pi-packages/packages/pi-permission-system` extension. Edit this file only on behalf of the user and according to its docs.
  - `pi-rtk-optimizer/config.json` configuration for `~/git/MasuRii/pi-rtk-optimizer` extension.
  - `pi-tool-display/config.json` configuration for `~/git/MasuRii/pi-tool-display` extension.
- `prompts/`: my own prompt templates.
  - `ask-with-tool.md` to re-ask a question with tooling instead of plain chat.
  - `update-pi.md` special update procedure for Pi.
- `skills/`: my own skills.
  - `rtfm/`
  - `update-pi/`
  - `nixos-config`
- `themes/`: theme definitions.
  - `catppuccin-mocha.json`
- `docs/agents/`: repo guidance for agent workflows.
- `sessions/`, `tmp/`: runtime or scratch data.
- `git/`, `npm/`: vendored extension sources handled by `pi install` and `pi remove`.
- `settings.json` stores include paths of packages, extensions, skills, prompts and themes
- `presets.json`: configuration for `~/git/earendil-works/pi-mono/packages/coding-agent/examples/extensions/preset.ts` example extension.
- `models-store.json`, `usage-extension-cache.json`: runtime/state, not informative.

## Notes / Gotchas

- `docs/agents/domain.md` says domain docs should be read before exploring the codebase. `CONTEXT.md` is the main domain guide.
- Avoid running `pi list`: it shows only *packages* but limited detail about their state (enabled/disabled).
  Prefer `jq '{packages: (.packages // {})}' settings.json`.
- To know precisely which non-vendored extensions, prompts, skills, and themes are truly enabled, consult `settings.json` using `jq`:

  ```sh
  jq 'pick(.extensions, .prompts, .skills, .themes) | with_entries(.value |= map(select(startswith("-") | not) | sub("^\\+"; "")))' settings.json
  ```
