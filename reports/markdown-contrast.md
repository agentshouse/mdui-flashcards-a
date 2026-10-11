# Markdown contrast correction

2026-10-11. Baseline: published source `bfc247749a3e70bf856c25657c7e6c631149cd4f`, Flashcards App `a_j.g`, sequence 6.

## Evidence-backed cause

- The pinned donor is `megafarad/barabara` at `4005955f9fc6865f4eca20496ac15e36579b80d8`. Its entire 3,791-byte `src/index.css` remains an exact prefix of the port stylesheet, and the donor MIT LICENSE is unchanged.
- Donor `Layout.tsx` uses a white canvas. Donor Dashboard and Review initialize their local theme to `light`; there is no theme switch. Neither the original donor nor the port set a Markdown color mode.
- The installed `@uiw/react-markdown-preview/markdown.css` independently selects `--color-fg-default: #c9d1d9` and a dark `--color-canvas-default: #0d1117` under the operating system's dark preference. Its explicit light palette is `#24292f` on `#ffffff`.
- The port's extra `.wmde-markdown { background: transparent !important; }` exposes the donor's light card background but did not coordinate the text palette. Under dark preference this combines pale text with the light card. This is a port integration defect, not missing donor CSS.

## Correction

All SafeMarkdown previews, including collection fronts/backs, Review, Study and editor previews, now carry the dependency's supported `wrapperElement` attribute `data-color-mode="light"`. The card form also selects light mode for both editor surfaces, including toolbar and syntax highlighting. The donor stylesheet, layout and business data are unchanged.

## Separate helper-label readability improvement

The donor itself uses pale `text-zinc-400` for small meaningful labels, dates, collection/card metadata, flip hints, progress and field help. This is separate from the port integration defect. In response to the same readability complaint, those light-surface text helpers now use the existing `text-zinc-600` palette color; collection-name placeholder text follows it. Decorative icons, dark-theme branches and white-on-dark buttons keep their existing colors. This is a narrow, documented accessibility adaptation of the donor, without layout changes.

Six mounted-page regressions cover Home, shell, Dashboard, collection creation, cards and Review. The built-CSS check calculates the original and improved helper contrast from the actual OKLCH tokens against white and indigo-50, and requires at least 4.5:1 for the improved pair. These sampled static surface calculations do not claim comprehensive animated/translucent browser contrast acceptance.

## Verification and limits

- Two mounted real-component regressions failed on the old code and pass on the correction. They verify both standalone previews and both editor surfaces beneath a dark-mode ancestor.
- `npm run theme:check` inspects the actual built CSS. Explicit light selectors have specificity `0,2,0`; automatic media selectors have `0,1,0`. Explicit light also occurs later than the equally specific dark ancestor selectors. See `markdown-theme-cascade.json` for exact rules.
- The calculated text contrast against white changes from 1.54:1 to 14.65:1. These are static palette calculations, not measurements on the user's device.
- The parent's normal hosted browser was in light mode and showed `rgb(36, 41, 47)` before the correction. It did not reproduce the user's dark-preference condition. An isolated local Chromium attempt was blocked by environment process/socket restrictions; a permitted escalation failed on the environment mount setup. No sandbox-disabling switch or alternate live-browser route was used. Dark-mode browser emulation is not claimed.
- No Room document, schema, binding, schedule or editor draft is changed by this correction. Publication and the post-publication hosted check are recorded separately.
