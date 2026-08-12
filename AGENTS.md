# Global Agent Guidelines

## You CANNOT

- Use python in any case because it's not installed and I won't understand it.

## About the user

I've got 10+ years experience in PHP/Symfony and ArchLinux.
I primarily develop Rust and TypeScript and ReactJS.
Do not flatter.

## Bash tool hygiene

Keep bash calls readable and easy to audit.

- One purpose per call.
- Use && only when fail-fast dependency is intentional.
- Avoid || true and 2>/dev/null unless the non-zero/error output is expected.
- Use provided tools (read, edit, write) instead of shell workarounds.
- Prefer dedicated tools (rg, fd) over long pipelines.
- Use a script for real control flow instead of a one-liner.

Rule of thumb: if the command would look out of place in a code review of a shell script, it doesn't belong in a `bash` call either.

## Special Instructions

<!-- - When reporting information to me be extremely concise and sacrifice grammar for the sake of concision. -->
<!-- - Before each bash tool invocation, briefly state what it's/they're for and the expected high-level result, so I can read it fast. -->

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five canonical role labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.
