# Context

## Purpose

This repository is the working configuration for a personal Pi coding-agent setup.
It stores prompts, skills, extensions, themes, and supporting metadata used by Pi.

This document is for future agents working in the repo. Use the vocabulary here when naming concepts, file groups, and tasks.

## Glossary

- **Configuration repo**: this repository as a whole; the source of the Pi setup.
- **Extension**: a Pi extension under `extensions/`.
- **Skill**: an agent skill under `skills/`.
- **Prompt**: a reusable prompt template under `prompts/`.
- **Theme**: a Pi theme file under `themes/`.
- **Domain docs**: documentation under `docs/`, especially `docs/agents/`.
- **Update prompt**: the `prompts/update-pi.md` workflow for refreshing the upstream Pi sources.

Avoid inventing alternate names for these concepts unless the repo already uses them.

## Architecture

Top-level layout:

- `README.md`: short project summary and installation notes.
- `CONTEXT.md`: this file; the canonical local guide for agents.
- `extensions/`: custom and vendored Pi extensions.
  - `at-file-context-guard.ts`
  - `date.ts`
  - `gnome-system-theme.ts`
  - `pi-permission-system/`
  - `pi-rtk-optimizer/`
  - `pi-tool-display/`
- `prompts/`: prompt templates.
  - `update-pi.md`
- `skills/`: bundled skills.
  - `rtfm/`
- `themes/`: theme definitions.
  - `catppuccin-mocha.json`
- `docs/agents/`: repo guidance for agent workflows.
- `sessions/`, `tmp/`: runtime or scratch data.
- `settings.json`, `sandbox.json`, `trust.json`, `auth.json`, `presets.json`, `models-store.json`, `usage-extension-cache.json`: Pi runtime/config state.

Source provenance:

- The README lists upstream repositories this config draws from.
- The repo is intentionally a curated personal config, not a clean-room package.

## Setup

To reproduce the setup locally:

1. Back up any existing Pi configuration.
2. Clone this repo to `~/.pi/agent`.
3. Clone the upstream source repositories into `~/git/<owner>/<repo>/` as expected by the local workflows.
4. Keep the upstream checkouts available if you want to refresh this repo from source rather than copying artifacts manually.

Relevant workflow:

- `prompts/update-pi.md` documents the expected update process for the Pi coding agent source tree.

## Notes / Gotchas

- This repo mixes checked-in source artifacts with local runtime state. Be careful not to treat everything under the root as a hand-authored source file.
- `docs/agents/domain.md` says domain docs should be read before exploring the codebase. In this repo, `CONTEXT.md` is the main domain guide.
- The repo depends on external upstream checkouts under `~/git/...`; missing checkouts can make update workflows fail.
- Some files here look like generated or machine-managed state. Verify whether a change should be committed before editing it.
- The setup instructions in `README.md` are part of the operating model; keep this document consistent with them.

## Open Questions

- Which files are truly source-of-truth versus generated cache/state files?
- Should this repo eventually split into multiple context docs, or stay single-context?
- Which extensions and skills are maintained locally versus vendored from upstream?
