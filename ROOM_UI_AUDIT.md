# Master 12:25 donor chrome audit

Instruction: Porting `messages/20261011T1225Z-master-crm-room-label.md`, 2026-10-11. Donor megafarad/barabara at `4005955f9fc6865f4eca20496ac15e36579b80d8`, especially `src/context/DataContext.tsx`, contains no persistent sync strip. Its home page's Offline-Ready feature copy is static donor marketing, not a live status indicator.

Removed the added ordinary bottom strip and shared-Room hint. The strip is now present only for genuine errors, write-halt or returned-draft attention. The port already requires exactly one host-supplied binding and shows no Room name. No storage, schema, manifest, membership, fallback or Room-copy changes. Original donor UI/business controls and notices remain.

Verification: typecheck, lint, all 89 tests, build and release:check pass. Runtime observation tests now explicitly prove ordinary online/offline states add no UI status while returned-draft attention is retained. No live browser or pixel-fidelity acceptance claimed.
