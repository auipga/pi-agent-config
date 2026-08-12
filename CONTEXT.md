# Context

## Purpose

This repository is the working configuration for a personal Pi coding-agent setup.
It stores prompts, skills, extensions, themes, and supporting metadata used by Pi.

This document is for future agents working in the repo. Use the vocabulary here when naming concepts, file groups, and tasks.

## Glossary

- **Configuration repo**: this repository as a whole; the source of the user's Pi setup.
- **Extension**: a Pi extension under `extensions/`.
- **Skill**: an agent skill under `skills/`.
- **Prompt**: a reusable prompt template under `prompts/`.
- **Theme**: a Pi theme file under `themes/`.
- **Domain docs**: documentation under `docs/`, especially `docs/agents/`.
- **Update pi**: the `prompts/update-pi.md` workflow for refreshing the upstream Pi sources.

Avoid inventing alternate names for these concepts unless the repo already uses them.

## Architecture

Top-level layout:

- `README.md`: short project summary and installation notes.
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
  - `update-pi.md` must use this departing instructions for updating Pi runtime.
- `skills/`: my own skills.
  - `rtfm/`
- `themes/`: theme definitions.
  - `catppuccin-mocha.json`
- `docs/agents/`: repo guidance for agent workflows.
- `sessions/`, `tmp/`: runtime or scratch data.
- `git/`, `npm/`: sources of installed extensions
- `settings.json`, `sandbox.json`, `trust.json`, `auth.json`, `presets.json`, `models-store.json`, `usage-extension-cache.json`: Pi runtime/config state.

Source provenance:

- The README lists upstream repositories this config draws from.

## Setup

See `README.md`.

## Update

`prompts/update-pi.md` documents the expected update process for the Pi coding agent source tree.

## Notes / Gotchas

- `docs/agents/domain.md` says domain docs should be read before exploring the codebase. In this repo, `CONTEXT.md` is the main domain guide.
- The repo depends on external upstream checkouts under `~/git/...`; missing checkouts fail silently.
- The setup instructions in `README.md` are part of the operating model; keep this document consistent with them.
- `settings.json` lists paths to files (packages, extension, skills, prompts, themes)

  | Enabled | Disabled | Undefined |
  | --------------- | --------------- | --------------- |
  | `+subfolder/file.js` | `-subfolder/file.js` | enabled by autoloading |
  | `../../path/file.js` | `-../../path/file.js` (doesn't even show up in `pi config`) | unknown / disabled |


## Open Questions

- Which files are truly source-of-truth versus generated cache/state files?
- Should this repo eventually split into multiple context docs, or stay single-context?
- Which extensions and skills are maintained locally versus vendored from upstream?
