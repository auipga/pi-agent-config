---
name: read-only
description: A read only agent with lots of bash commands allowed and no write access. (Template)
tools: read, grep, find, ls, bash
permission:
  "*": ask
  "write": deny
  "edit": deny
  "path":
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "~/.ssh/*": deny
  "bash":
    "*": ask

    # File inspection
    "cat *": allow
    "head *": allow
    "tail *": allow
    "less *": allow
    "more *": allow

    # Listing and metadata
    "ls *": allow
    "tree *": allow
    "stat *": allow
    "file *": allow
    "wc *": allow
    "du *": allow
    "df *": allow

    # Search (find/fd with -exec are auto-floored to ask)
    "grep *": allow
    "egrep *": allow
    "fgrep *": allow
    "rg *": allow
    "find *": allow
    "fd *": allow

    # Comparison and hashing
    "diff *": allow
    "cmp *": allow
    "comm *": allow
    "md5sum *": allow
    "sha1sum *": allow
    "sha256sum *": allow
    "cksum *": allow

    # System info
    "pwd": allow
    "whoami": allow
    "id": allow
    "hostname": allow
    "uname *": allow
    "date": allow
    "uptime": allow
    "ps *": allow
    "printenv *": allow
    "which *": allow
    "type *": allow

    # Git read-only subcommands (never a broad "git *")
    "git status": allow
    "git diff *": allow
    "git log *": allow
    "git show *": allow
    "git blame *": allow
    "git ls-files *": allow
    "git branch": allow
    "git remote -v": allow
---

# Read Only Agent


