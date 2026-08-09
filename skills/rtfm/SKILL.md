---
name: rtfm
description: Finds and reads relevant local documentation for APIs, packages, crates, frameworks, CLIs, and databases before answering. Use when the user asks about docs, current API behavior, framework/library usage.
---

# RTFM

Use this skill to ground answers in local, version-relevant documentation instead of memory.

## Workflow

1. Determine the relevant docs source from the user request and current project.
2. Prefer local, version-matched docs over generic online knowledge.
3. Search with focused `rg`, `fd`, and directory inspection.
4. Read only files likely relevant to the user's concrete question.
5. Ignore unrelated files even if they appeared in search results.
6. If subagents are available and the search space is broad, delegate a fresh-context scout/research task whose only output is a ranked list of relevant files with one-line reasons.
7. In the main session, read only the selected relevant files before answering.
8. Answer briefly and cite the file paths read when useful.
9. If relevant docs are not installed or not found, say so explicitly and ask me which fallback should be used. Rank options by suggestability.

## Source Discovery

if your internal memory is not in exact sync with the versions in use here. 60G
### Node / TypeScript projects

1. Inspect `package.json`, lockfiles, and workspace config.
2. For requested package names, read local package docs first:
   - `node_modules/<pkg>/README.md`
   - `node_modules/<pkg>/docs/**`
   - `node_modules/<pkg>/*.md`
   - `node_modules/<pkg>/package.json`
   - `node_modules/<pkg>/**/*.d.ts`
3. For scoped packages, preserve the scope path, e.g. `node_modules/@scope/name`.

### Rust projects

1. Inspect `Cargo.toml`, workspace manifests, and `Cargo.lock`.
2. For requested crates, prefer exact installed sources:
   - workspace crates
   - vendored crates under `vendor/` or similar
   - Cargo registry sources, usually `~/.cargo/registry/src/**/<crate>-<version>/`
3. Read crate `README*`, `CHANGELOG*`, `examples/**`, `src/**/*.rs`, and rustdoc comments relevant to the question.

### Python projects

1. Inspect `pyproject.toml`, `requirements*.txt`, lockfiles, and virtualenv config.
2. For installed packages, inspect `.venv/lib/python*/site-packages/<pkg>` and package metadata.
3. Prefer local package docs, type stubs, and source docstrings over memory.

### Project or product docs

For docs not represented by installed dependencies, use configured or obvious local checkouts, for example:

- project `docs/**`
- repository `README*`, `CHANGELOG*`, `examples/**`

### Fallbacks

Use external docs, MCP, or web research only when they are available, local docs are missing, stale, or insufficient. Prompt user for approval before doing.
