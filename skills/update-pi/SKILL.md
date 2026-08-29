---
name: update-pi
description: Update Pi Coding Agent (customized instructions)
disable-model-invocation: true
tools: read, grep, find, ls, bash
model: openai/gpt-5.6-luna
thinking: low
max_turns: 20
read_more_about_this_frontmatter: https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents#frontmatter-fields
permission:
  "*": deny
  read: allow
  grep: allow
  find: allow
  ls: allow
  bash:
    "*": deny
    "git fetch *": "allow"
    "npm install": "allow"
    "npm run build": "allow"
  external_directory:
    "*": deny
---

Source: ~/git/earendil-works/pi-mono/
`cd` into the folder.

## Update Source

Update only the main branch.
Fetch the tags from upstream.
If the fetch does not show '[new tag]', skip merge and continue with install.
Merge the latest version tag into the branch 'me' (ignore the non-error output of the command).

## Install

Run `npm install`.
Run `npm run build`.

## Rules

Handle uncommitted changes by stashing.
Skip git hooks.
Ignore the non-error output of all commands.
Ask me how to handle failures. Provide multiple suggestions to choose from.
