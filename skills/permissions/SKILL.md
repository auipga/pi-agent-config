---
name: permissions
description: Understand persisted permissions (gotgenes/pi-permission-system)
disable-model-invocation: true
permission:
  "*": deny
  path:
    "~/.pi/agent/extensions/pi-permission-system/*": allow
    ".pi/extensions/pi-permission-system/*": allow
  read:
    "*": deny
    "settings.json": allow
    "trust.json": allow
    ".pi/extensions/pi-permission-system/config.json": allow
    "~/.pi/agent/extensions/pi-permission-system/config.json": allow
  write:
    "*": deny
    "settings.json": allow
    ".pi/extensions/pi-permission-system/config.json": allow
    "~/.pi/agent/extensions/pi-permission-system/config.json": allow
  bash:
    "jq '*' *.json": allow
  external_directory:
    "*": deny
    "~/.pi/agent/extensions/pi-permission-system/*": allow
---

`pi-permission-system` (I refer to it as `pps`) is a package by user @gotgenes.
pps is an npm package called `@gotgenes/pi-permission-system`.
It's repo is cloned locally into `~/git/gotgenes/pi-packages/` and contains multiple packages.
One of is pps, at `~/git/gotgenes/pi-packages/packages/pi-permission-system/`.

Suggest edits to this skill, because this section is WIP.

The only config file of pps is a `config.json`.
This file exists at 2 places.
1. `<project>/.pi/extensions/pi-permission-system/config.json` - project local
2. `~/.pi/agent/extensions/pi-permission-system/config.json` - global

I refer to them as **global permissions** and **project permissions** or **local permissions**.

To evaluate the configuration both files become merged.

TODO: The docs provide good examples. Copy or describe one in this skill's file.

