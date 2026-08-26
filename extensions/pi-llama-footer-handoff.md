# Handoff: llama-server live-stat footer extension

## Next-session focus

Continue the final specification for a Pi extension that displays live llama-server status and inference statistics in Pi's footer. Do not implement yet unless explicitly requested. The user's latest instruction was: `the final spec using no other skill than handoff`.

## Current project/context

- Workspace: `/home/deck/git/me/pi-agent-config`.
- No code has been changed for this feature.
- Pi supports extension footer/status APIs. The intended integration is `ctx.ui.setStatus()`, not `ctx.ui.setFooter()`, so the normal Pi footer and the existing TPS extension remain intact.
- An existing `pi-token-speed` extension registers `/tps` and displays provider/client-side generation TPS. Avoid replacing or conflicting with its status entry.
- The repository already contains `extensions/llama-shortcuts.ts`, but it is unrelated.

## Data-source decision

Use llama-server HTTP monitoring endpoints rather than attempting to read another process's stdout.

- `/slots`: live slot state, prompt totals, cached/processed prompt counts, context size, generation counts; enabled by default unless disabled with `--no-slots`.
- `/props`: model/server readiness and configuration.
- `/metrics`: optional Prometheus metrics and queue/deferred-request information; requires starting llama-server with `--metrics` and therefore a restart. The current local router was observed without this flag, so the extension must work without it.
- In router mode, monitoring endpoints need the selected model query parameter.
- The current local llama-server setup is a router on localhost port 9931; do not copy any API key from the conversation into documentation or code.

Live prompt speed can be calculated by sampling changes in `n_prompt_tokens_processed`. `/metrics` may be used when available, with `/slots` as the fallback. Model-loading progress should use the router's model status/SSE progress where available.

## Final component identifiers

- **C1-M**: model state icon.
- **C1-P**: prompt-processing state icon.
- **C1-G**: generation state icon.
- **C2**: queue/deferred-request indicator and mandatory waiting timer.
- **C3**: context-utilization bar and values; always visible whenever the server is ready.
- **C4**: active prompt/generation display container.
- **C5**: previously cached/reused prompt segment.
- **C6**: prompt tokens processed during the current turn / active current-turn segment.
- **C7**: prompt tokens remaining.
- **C8**: stopwatch, elapsed time, values, and percentage; later becomes the completed prompt summary.
- **C9**: live prompt-processing speed.
- **C10**: generation speed, integrated into Generation-C4 rather than displayed as a separate section.
- **C11**: model-loading progress bar.

Ready icon alternatives considered:

- A1: `✓` — selected recommendation; compact and normally one column wide.
- A2: `✔` — heavy checkmark.
- A3: `✅` — emoji, potentially two columns wide.
- A4/A5: Nerd Font check variants, font-dependent.

Use A1 unless the user changes this choice.

## Final layout/order

When ready, the order is:

```text
C1-M │ C3 │ C2 │ ...
```

C2 is positioned after C3.

### Loading

Only C1-M and C11 are shown. No C2-C10 components:

```text
⠋ │ Model [███▍░░░░░░] 38%
```

C1-M uses the one-character spinner while the model loads and becomes A1 when ready.

### Ready and idle

C1-M is A1 and C3 is always visible. C2 is hidden if this request was never queued:

```text
✓ │ Ctx [███████░░░] 23.4k/32.8k
```

No special alternate layout is used near the context limit; C3 keeps the same format.

### Waiting in the queue

The waiting timer is mandatory. C2 is shown before Prompt-C4 appears, using the live queue count and elapsed waiting time:

```text
✓ │ Ctx [███████░░░] 23.4k/32.8k │ 󰇚2 ⏱ 4s
```

The count represents waiting requests, not tokens. The timer starts when the request enters the queue.

### Prompt processing

C1-P is the spinner while this stage is active. C1-M remains A1 because the model is ready:

```text
✓ │ Ctx [███████░░░] 23.4k/32.8k │ 󰇚2 ⏱ 4s │ ⠋ Prompt [▒▒▒▒▒██▊░░] ⏱ 5s 4.7k/17.1k left 72% │ PP 142 t/s
```

C4 contains C5+C6+C7+C8, and C9 is the live prompt speed:

```text
C1-M │ C3 │ C2 │ C1-P + C4(C5+C6+C7+C8) │ C9
```

Bar styles must be distinguishable without relying solely on color:

```text
C5 cached:       ▒▒▒▒▒   muted/shaded style
C6 processed:       ███   bright/solid style
C7 remaining:           ░░   dim/light style
```

Fractional glyphs may be used for smoother boundaries:

```text
▏ ▎ ▍ ▌ ▋ ▊ ▉ █
```

### Prompt complete, generation active

C8 collapses to a prompt summary between C3 and Generation-C4. Its stopwatch icon becomes A1 and the label `Prompt` is added:

```text
✓ │ Ctx [████████░░] 27.1k/32.8k │ 󰇚2 ⏱ 4s │ ✓ Prompt 30s for 4.5k ≈ 150 t/s │ ⠋ Generation ⏱ 5s 100t ≈ 20 t/s
```

The prompt summary has the form:

```text
✓ Prompt 30s for 4.5k ≈ 150 t/s
```

C1-G is the spinner while generation is active.

The earlier idea that Generation-C4 should contain only C6/bar content was superseded by the later correction. Generation-C4 must instead be the full text form:

```text
Generation ⏱ 5s 100t ≈ 20 t/s
```

It does not contain C5, C7, or C8.

### Generation complete

C1-G changes from the spinner to A1. The generation summary uses the same structure as the completed prompt summary, with the `Generation` label:

```text
✓ │ Ctx [████████░░] 27.1k/32.8k │ 󰇚2 ⏱ 4s │ ✓ Prompt 30s for 4.5k ≈ 150 t/s │ ✓ Generation 5s for 100t ≈ 20 t/s
```

Use the Unicode approximation symbol `≈` everywhere; never use `^=`.

## C2 lifecycle

- Hidden if the current request was never queued.
- Live/full styling while the request is waiting:
  ```text
  󰇚2 ⏱ 4s
  ```
- Once the live waiting count reaches zero and the request receives a slot, retain C2 rather than removing it.
- The retained C2 is fully rendered but muted and preserves the original count plus final waiting duration:
  ```text
  󰇚2 ⏱ 4s
  ```
- Do not show a waiting end timestamp.
- On the next user message, clear C2 and every component to its right immediately before that message could be queued. C1-M and C3 persist.
- If the new request queues, create a new live C2 with a reset timer. If it starts immediately, C2 remains hidden.

## Context/prompt semantics

- C3 answers: how full is the entire model context/KV window?
- C4 answers: how far through the current prompt evaluation are we?
- C3 remains visible whenever the server is ready, with no special near-limit mode.
- During prompt processing, C4's colored bar shows reused prompt tokens, newly evaluated tokens, and remaining prompt tokens.
- After prompt processing, C4 is replaced by the C8 prompt summary; Generation-C4 then reports generation timing/count/speed.

## Suggested skills

No skill other than `handoff` is requested for the next session. Do not invoke implementation, TDD, research, code-review, or other skills unless the user explicitly changes the request.
