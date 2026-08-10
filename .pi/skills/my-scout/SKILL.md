---
name: my-scout
description: Scout files/docs/code for a search term or task, then return a post-hoc canonical context pack with relevant reads, toll reads, tool evidence, and open questions. Use when invoked as /skill:my-scout or when the user asks for a scout-style evidence pack.
---

# My Scout

Scout a search term or task and answer with a minimal replay-worthy context pack.

Invocation examples:

```text
/skill:my-scout createPiExtension command API
/skill:my-scout find where auth tokens are refreshed
/skill:my-scout explain deployment workflow docs
```

## Mission

Given the user argument, investigate enough to answer confidently, then emit the answer in the canonical scout format below.

Prefer precision over breadth. The final output must separate:

- **relevant reads**: sources another agent should replay/read
- **duty/toll reads**: navigation, indexes, TOCs, broad discovery, failed or irrelevant reads
- **tool evidence**: useful grep/find/ls/bash queries or summaries
- **open questions / user decisions**: unresolved choices or structured decisions

## Search workflow

1. Parse the user argument as either:
   - a literal search term, or
   - a task/question that needs source discovery.
2. Start with cheap discovery:
   - use `grep` for exact/literal terms when likely
   - use `find` for file names or likely docs/code extensions
   - use `ls` only to understand directory shape
3. Read likely sources.
4. Follow only links/imports/references that are likely to affect the answer.
5. Stop when additional reads are unlikely to change the answer.
6. In retrospect, classify every meaningful tool result:
   - keep if replay-worthy
   - mark as duty/toll if only used for navigation/discovery or irrelevant

## Retrospective classification rules

### Read all relevant reads

Include entries that directly support the answer or would let another agent continue without redoing discovery.

Good selectors:

- exact line ranges for the useful passage
- `section:<heading>` when line numbers are unavailable or the section is the unit of evidence
- `block:<n>` for a specific code block in a markdown/doc source
- `grep:<pattern>` when the source is best represented by a search hit rather than full read
- `all` only for short files where all content matters

### Skip what's considered duty/toll

Include reads/listings/searches that were useful only as toll:

- indexes, TOCs, READMEs used only to discover paths
- directory listings used only for orientation
- broad files where nothing relevant was found
- files inspected due to plausible matches but not needed for final answer

Do not hide wasted exploration; compress it.

### Tool evidence

Include non-read evidence useful for replay:

- grep/find query that located key files
- ls summary for directory discovery
- bash command if it produced evidence, not just validation noise
- ask_user_question payload summary if relevant to decisions

### Open questions / user decisions

Include:

- `none` if no unresolved choices
- pending ambiguity that affects correctness
- user-selected options if a decision was made
- IDs/summaries of `ask_user_question` payloads when used

## Canonical output format

Always use this exact top-level shape.

```md
# Answer

<answer>

## Read all relevant reads

> <size> · <why>
  [<path>]():`<selector>`

> <size> · <why>
  [<path>]():`<selector>`

## Skip what's considered duty/toll

> <size> · <why>
  [<path>]():`<selector>`
```

Optional sections use the same quote + indented evidence style:

```md
## Tool evidence

> <tool> · <why>
  `<query-or-summary>`

## Open questions / user decisions

> <status> · <why>
  `<decision-or-question-id>`
```

For this skill, include **Tool evidence** and **Open questions / user decisions** by default. If empty, add a single `none` entry.

## Selector grammar

Use only these selector forms:

```text
all
44-91
44-91,280-302
block:3
section:Extension lifecycle
grep:createPiExtension
ls
```

## Size formatting

Use approximate human-readable sizes:

- `800 B`
- `1 kB`
- `10 kB`
- `2 MB`

If the exact size is unknown, estimate the source/excerpt size. Do not spend extra tool calls just to calculate size unless size is important.

## Path formatting

Use paths relative to the current working directory when possible. Use absolute paths only for sources outside the project.

Examples:

```md
[docs/extensions.md]():`44-91`
[/home/deck/.pi/agent/skills/foo/SKILL.md]():`all`
```

## Answer style

Be concise. Put the direct answer first. The evidence pack is for replay, not prose.

## Example final response

```md
# Answer

Use a post-hoc context pack emitted by the skill after it finishes gathering info. Include only replay-worthy reads, plus explicit toll reads that were useful only for navigation/discovery.

## Read all relevant reads

> 10 kB · extension lifecycle API
  [docs/extensions.md]():`44-91`

> 1 kB · `Box`, `Text`, keybinding event handling
  [docs/tui.md]():`210-248,280-302`

## Skip what's considered duty/toll

> 4 kB · index only; used to discover extension docs
  [docs/README.md]():`all`

> 8 kB · nothing relevant found
  [CHANGELOG.md]():`all`

> 800 B · directory discovery only
  [examples/extensions/]():`ls`

## Tool evidence

> grep · found extension helper signature
  `createPiExtension` in `docs/`

## Open questions / user decisions

> none · no unresolved choices
  `none`
```
