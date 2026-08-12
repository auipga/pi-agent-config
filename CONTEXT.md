# Context

## Architecture

Top-level layout:

- `README.md`: short installation notes.
- `CONTEXT.md`: this file; the canonical local guide for agents.
- `extensions/`: custom extensions and config files of vendored extensions.
  - `at-file-context-guard.ts`
  - `date.ts` sends the current date as user message by `/date`.
  - `gnome-system-theme.ts` poll Gnome's dark mode and follow.
  - `pi-permission-system/config.json` configuration for `@gotgenes/pi-permission-system` extension. Edit this file only on behalf of the user and according to its docs.
  - `pi-rtk-optimizer/config.json` configuration for `~/git/MasuRii/pi-rtk-optimizer` extension.
  - `pi-tool-display/config.json` configuration for `~/git/MasuRii/pi-tool-display` extension.
- `prompts/`: my own prompt templates.
  - `ask-with-tool.md` to re-ask a question with tooling instead of plain chat.
  - `update-pi.md` special update procedure for Pi.
- `skills/`: my own skills.
  - `rtfm/`
- `themes/`: theme definitions.
  - `catppuccin-mocha.json`
- `docs/agents/`: repo guidance for agent workflows.
- `sessions/`, `tmp/`: runtime or scratch data.
- `git/`, `npm/`: sources of installed extensions
- `settings.json`, `sandbox.json`, `trust.json`, `auth.json`, `presets.json`, `models-store.json`, `usage-extension-cache.json`: Pi runtime/config state.

## Notes / Gotchas

- `docs/agents/domain.md` says domain docs should be read before exploring the codebase. In this repo, `CONTEXT.md` is the main domain guide.
- The repo depends on external upstream checkouts under `~/git/...`; missing checkouts fail silently.
- `settings.json` lists paths to files (packages, extension, skills, prompts, themes)

To know exactly which configured extensions, prompts, skills, and themes are enabled, run:

```sh
jq 'pick(.extensions, .prompts, .skills, .themes) | with_entries(.value |= map(select(startswith("-") | not) | sub("^\\+"; "")))' settings.json
```

This filters disabled `-...` entries and normalizes explicitly enabled `+...` entries to plain paths.
Run `pi list` to know information about `pi install`ed extensions. (this corresponds to
`jq '{packages: (.packages // {})}' settings.json`.
`pi list` has no clue about enabled/disabled parts of a package.
