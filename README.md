# pi-config

A small library of my personal [pi](https://github.com/earendil-works/pi) prompts, skills and extensions.

## Setup

To run this configuration:

- backup your existing configuration
- create a fork (optional)
- clone this and each repository from the list above into `~/git/<owner>/<repo>/` *
- symlink `~/.pi/agent` to `~/git/<owner>/pi-agent-config`

*) I like to fetch updates at times so the "copy it over into your repo approach" doesn't fit my need.

## Notes / Gotchas

- `settings.json` lists paths to files (packages, extension, skills, prompts, themes).
 
  The path notation uses `+`, `-` or no prefix to hold its enabled state depending on whether the path is inside (autoloaded) or outside (only when explicitly referenced) of Pi's config dir.

  | Enabled | Disabled | Not listed |
  | --- | --- | --- |
  | `+subfolder/file.js` | `-subfolder/file.js` | enabled by autoloading |
  | `../../path/file.js` | `-../../path/file.js` (doesn't even show up in `pi config`) | unknown / disabled |

