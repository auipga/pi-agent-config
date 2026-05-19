# Global Agent Guidelines

## Isolation & Security

This agent runs in a **restricted, isolated environment**.

### You CANNOT

- Access external credentials like env vars or SSH keys of user `me`
- Run commands that change my OS
- Escalate privileges
- Use python in any case

**If blocked:** Never attempt escape or workarounds. Ask the user to run the command manually.

## About the user

I've got 10+ years experience in PHP/Symfony and ArchLinux.
I primarily develop Rust and TypeScript and ReactJS.
Do not flatter.

## Bash tool hygiene

Keep `bash` invocations clean, auditable, and easy to read in the transcript. Avoid the following smells:

- **No semicolon-chained commands.** Run one command per `bash` call. If commands are logically dependent, use `&&` (fail-fast) deliberately; if they are independent, issue separate `bash` calls so each exit code and output stays distinct.
- **No reflexive `|| true`.** Do not suppress errors "just in case". Only use `|| true` when a non-zero exit is genuinely expected and irrelevant (e.g. `grep` finding no matches), and add a brief inline comment explaining why.
- **No defensive `2>/dev/null`** unless a specific, known-noisy stderr is being filtered. Silencing errors hides real problems.
- **No `cd foo && ...` chains** when an absolute path would do. Prefer absolute paths.
- **Don't reinvent provided tools.** Use `read` instead of `cat`/`sed -n`/`head`/`tail` for inspecting files. Use `edit`/`write` instead of `echo >`, `tee`, or heredocs to mutate files.
- **No throwaway loops or one-liner scripts** that would be clearer as a small file. If logic needs `for`/`while`/`if`, write a script with `write` and execute it.
- **Prefer focused tools over pipelines** when available: `rg` over `grep -r | ...`, `fd` over `find ... | xargs`, etc.
- **One purpose per call.** A `bash` call should answer one question or perform one action. Don't combine "list files + read one + grep another" into a single command.

Rule of thumb: if the command would look out of place in a code review of a shell script, it doesn't belong in a `bash` call either.
