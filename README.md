# pi-config

A small library of my personal [pi](https://github.com/earendil-works/pi) prompts, skills and extensions.

## Sources

This repo is based on:

- https://github.com/amosblomqvist/pi-config (341)
- https://github.com/badlogic/pi-skills (2,340)
- https://github.com/benithors/skills (70)
- https://github.com/earendil-works/pi-mono (85,363)
- https://github.com/mattpocock/skills (209,060)
- https://github.com/tmustier/pi-extensions (443)

## Setup

To run this configuration:

- backup your existing configuration
- create a fork (optional)
- clone this to `~/.pi/agent`
- clone each repository from the list above into `~/git/<owner>/<repo>/`
  (I like to fetch updates at times so the "copy it over into your repo approach" doesn't fit my need.)

## Fully installed things

| Name | Owner | `pi install ...` | URLs........ | Stars (8/8/26) |
| --- | --- | --- | --- | --- |
| pi-telegram | badlogic | `git:github.com/badlogic/pi-telegram` | [Code](https://github.com/badlogic/pi-telegram) | 272 |
| pi-token-stats | dheerapat | `git:github.com/dheerapat/pi-token-stats` | [Code](https://github.com/dheerapat/pi-token-stats) | 2 |
| pi-rtk-optimizer | MasuRii | `git:github.com/MasuRii/pi-rtk-optimizer` | [Code](https://github.com/MasuRii/pi-rtk-optimizer) | 226 |
| pi-tool-display | MasuRii | `git:github.com/MasuRii/pi-tool-display` | [Code](https://github.com/MasuRii/pi-tool-display) | 248 |
| pi-intercom | nicobailon | `git:github.com/nicobailon/pi-intercom` | [Code](https://github.com/nicobailon/pi-intercom) | 293 |
| pi-subagents | nicobailon | `git:github.com/nicobailon/pi-subagents` | [Code](https://github.com/nicobailon/pi-subagents) | 3,013 |
| pi-subagents | gotgenes | `npm:@gotgenes/pi-subagents` | [Code](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents) [PKG](https://www.npmjs.com/package/@gotgenes/pi-subagents) | 141* |
| pi-permission-system | gotgenes | `npm:@gotgenes/pi-permission-system` | [Code](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-permission-system) [PKG](https://www.npmjs.com/package/@gotgenes/pi-permission-system) | 141* |
| pi-diff | heyhuynhgiabuu | `npm:@heyhuynhgiabuu/pi-diff` | [Code](https://github.com/buddingnewinsights/pi-diff) [PKG](https://www.npmjs.com/package/@heyhuynhgiabuu/pi-diff) | 39 |
| rpiv-ask-user-question | juicesharp | `npm:@juicesharp/rpiv-ask-user-question` | [Code](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question) [PKG](https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question) | 576* |
| pi-mono-usage | emanuelcasco | `npm:pi-mono-usage` | [Code](https://github.com/emanuelcasco/pi-mono-extensions/tree/main/extensions/usage) [PKG](https://www.npmjs.com/package/pi-mono-usage) | 94* |
| pi-wakatime | ttttmr | `npm:pi-wakatime` | [Code](https://github.com/ttttmr/pi-wakatime) [PKG](https://www.npmjs.com/package/pi-wakatime) | 7 |

*) mono repo with more extensions than I use.

## Notes / Gotchas

- `settings.json` lists paths to files (packages, extension, skills, prompts, themes).
 
  The path notation uses `+`, `-` or no prefix to hold its enabled state depending on whether the path is inside (autoloaded) or outside (only when explicitly referenced) of Pi's config dir.

  | Enabled | Disabled | Not listed |
  | --- | --- | --- |
  | `+subfolder/file.js` | `-subfolder/file.js` | enabled by autoloading |
  | `../../path/file.js` | `-../../path/file.js` (doesn't even show up in `pi config`) | unknown / disabled |

