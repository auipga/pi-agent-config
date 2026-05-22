# Global Agent Guidelines

## Isolation & Security

This agent runs in a **restricted, isolated environment**.

### You CANNOT

- Access external credentials like env vars or SSH keys of user `me`
- Run commands that change my OS like installing packages.
- Escalate privileges
- Use python in any case

**If blocked:** Never attempt escape or workarounds. Ask the user to run the command manually.

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

- Before each bash tool invocation, briefly state what it's for and the expected high-level result, so I can read it fast.
