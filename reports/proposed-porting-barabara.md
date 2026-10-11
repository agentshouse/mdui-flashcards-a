---
status: working
donor: https://github.com/megafarad/barabara/tree/4005955f9fc6865f4eca20496ac15e36579b80d8
app: not allocated
address: not published
---

# Flashcards (barabara) — local candidate

Actual donor components and original CSS retained: landing page, library, collection CRUD, Markdown card CRUD, 12-card pagination, flip cards, full-deck review, due-card study and donor SRS. Product branding and separately licensed/unverified media are replaced with original local artwork and accurate House copy.

House runtime comes only from the verified MIT @agentshouse/app-bridge 0.1.0-ce524f6608238 runtime. Typed JSON Schema Room documents: one collection/card, explicit relative deck reference. Observation, shared-draft revision CAS, opened bases, preserved conflicts, atomic guarded cascade deletion, runtime status and no localStorage fallback. One complete licensed donor example deck and all21 cards are prepared locally but not written to a Room or shipped as automatic seeds.

Local checks: typecheck, lint, 88 tests, build, release/schema/reference/license checks. Detailed evidence in the source repository’s reports/. Test doubles and jsdom are not live acceptance.

Pending: App/Room allocation, Tasks-first publication, hosted desktop / 360 px checks, real runtime writes/reload/offline/two-client sync and network capture. Shared Room schedules are explicit; per-member study history waits on existing runtime-current-member-identity/core#3329. No identity workaround is used.

Original MIT LICENSE retained verbatim. Full notices cover 177 installed production packages; omitted package-license files are supplemented from verified upstream grants or their explicit distributed README grant. Embedded Font Awesome icons carry their explicit CC BY 4.0 notices. No claim that every dependency is MIT.

The independent local source review also caught and verified fixes for Markdown whitespace loss, mixed-UUID card ordering/pagination, reversed desktop informational-card columns, and a stale rename callback clearing a newer draft.
