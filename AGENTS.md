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
- Avoid `|| true` and `2>/dev/null` unless the non-zero/error output is expected.
<!-- - Use provided tools (read, edit, write) instead of shell workarounds. -->
<!-- - Prefer dedicated tools (rg, fd) over long pipelines. -->
- Use a script for real control flow instead of a one-liner.

Rule of thumb: if the command would look out of place in a code review of a shell script, it doesn't belong in a `bash` call either.

## ask_user_question constraints

Before calling `ask_user_question`, validate the arguments against these hard limits:

- `questions`: 1–4 questions per call.
- Each `header`: at most 16 characters
- Each option `label`: at most 60 characters; keep it to 1–5 words when possible.
- Each question: 2–4 options.
- Do not author the reserved `Other`, `Type something.`, or `Next` labels; the UI adds its own rows.
- `options[].preview` is optional and may contain markdown, but is only valid for single-select questions.

## Special Instructions

<!-- - When reporting information to me be extremely concise and sacrifice grammar for the sake of concision. -->
<!-- - Before each bash tool invocation, briefly state what it's/they're for and the expected high-level result, so I can read it fast. -->
<!-- - When changing code in `~/git/earendil-works/pi-mono`, run the relevant `npm install` and `npm run build`. -->

