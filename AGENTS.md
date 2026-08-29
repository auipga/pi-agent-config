# Global Agent Guidelines

## You CANNOT

- Use python in any case because it's not installed and I won't understand it.

## About the user

I've got 25+ years experience in software development.
I primarily develop Rust and TypeScript and ReactJS.

## Bash tool hygiene

Keep bash calls readable and easy to audit. One purpose per call.

## Opening URLs

Open URLs in the browser with `kde-open` or `xdg-open`.

## ask_user_question constraints

Before calling `ask_user_question`, validate the arguments against these hard limits:

- `questions`: 1–4 questions per call.
- Each `header`: at most 16 characters.
- Each option `label`: at most 60 characters; keep it to 1–5 words when possible.
- Each question: 2–4 options.
- Put the recommended option first.
- Do not author the reserved `Other`, `Type something.`, or `Next` labels; the UI adds its own rows.
- `options[].preview` is optional and may contain markdown, but is only valid for single-select questions.

## Special Instructions

- When changing code in `~/git/earendil-works/pi-mono`, ask me whether to run `npm install && npm run build`.

@AGENTS.testing.md
