# Full-card reading and larger previews

2026-10-11. User-requested usability fix, based on release 7 / source 62e3481ed30bb130bd026e132cd5114e110e9b64. Existing dev App a_j.g only.

## Changes

The old collection tiles were fixed at 208 px and clipped both faces to four lines. The donor flip surfaces are retained, but the responsive grid now uses at most three columns; each tile is content-sized with a 288 px minimum and a six-line preview. The new, always-visible Expand card button opens a separate reading dialog, without entering the editor.

The dialog is up to 832 px wide, fits the dynamic viewport, and displays the complete existing safe Markdown in a scrollable body at 18–20 px with 1.75 line height. Its question/answer switch remains available in a fixed footer. Opening from a flipped tile starts on the answer. Side changes reset scroll position. Close, Escape, backdrop dismissal, focus trapping and focus restoration are supported. Reopening starts from the tile’s visible face. Observed text updates render in place; removal or route/page changes unmount the reader.

Flip controls are native buttons rather than a button role containing Edit/Delete controls. The inactive 3D face is inert and hidden from accessibility APIs. Edit/Delete remain separate. Modal focus lifetime no longer restarts when a parent callback changes; mixed controls are traversed in DOM order. The new reader uses no editor, draft, Save or schedule API.

## Boundaries

No change to Room documents, schema, binding, app manifest, data modules, package versions, schedules or seeded fixtures. The light Markdown palette and helper-label contrast correction are preserved. The original 3,791-byte donor stylesheet prefix and MIT LICENSE remain byte-for-byte unchanged. No new dependency, external resource, identity or permission was added.

## Verification

Mounted-component regressions cover complete long Russian question and answer text, stable light palette, no draft/write/grade calls, grid flip and current-face opening, keyboard focus trap and Escape restoration after observed updates, scroll reset, close/reopen, external text changes/removal, and independent existing editor behavior. Existing CRUD, schedule, Markdown safety, local-first drafts and SPA suites remain required.

Hosted desktop/mobile behavior and real computed layout are not established by DOM tests; the browser owner verifies after the Master 19:25 UTC deployment hold. Publication and browser outcomes are recorded separately.
