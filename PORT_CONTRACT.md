# Port contract and acceptance boundaries

## Authority

The original ten-App brief selected megafarad/barabara, MIT parts only. Master’s whole-queue message at 2026-10-11T01:05Z placed it after OpenMAIC and before Messenger. Current JSON Schema conversion is Master’s 2026-10-11T07:25Z message. Parent assigned local preparation only here; Tasks-first worker owns App/Room allocation and publication. No new Room/App/release/push occurred.

## Source history

The prepared source main is a new root commit. The unmodified donor remains separately pinned as the audit reference; excluded photos, branding assets and unverified favicon are not distributed through donor commit ancestry. This does not remove attribution: exact donor commit, hashes, original README and MIT license remain in the source.

## Fidelity

All 12 original UI component files remain, adapted in place, with unchanged donor CSS preceding a small House/accessibility/responsive extension. The donor's landing page has its full hero, stats, six feature tiles, three showcase rows, three informational cards and CTA/footer. The library/collection/editor/review screens are the donor implementation, not substitutes. `reports/donor-fidelity.json` records per-file hashes and exact retained-line counts; those counts prove provenance, not visual acceptance.

House-required deviations:
- Branding is Flashcards. Non-MIT or unverified donor images/logos and quotations replaced with original local content; inaccurate product claims updated
- Hash routing keeps navigation inside a multi-file static House App
- Runtime-backed observed Room documents replace single-key localStorage. No fake empty success on missing binding
- Draft CAS, opened bases and one batch for cascade removal. Existing/returned drafts are preserved. Conflicts require review in House, never silently rebase
- Markdown previews cannot fetch media, navigate external links, or execute raw HTML. Editor Help opens the bundled guide; a pinned Vite transform also removes the dependency’s default external Help target
- Required fields, async-error retention, repeat-action locks, captured delete/edit targets, route-keyed pages, pagination bounds, local help, focus management, phone spacing and reduced motion fixes
- Non-donor status furniture is removed; actionable refusal, attention and storage-loss states remain visible

## Behavior retained

Create, list, rename and remove collections. Create/edit/remove front/back Markdown cards. Twelve-card pagination, animated question/answer flipping, card/deck counts and due badges. Full-deck review is read-only with previous/next/restart. Study selects due cards, repeats forgotten cards, and uses the exact original schedule: Forgot resets streak/interval to 0 and due now; Got It increments streak with 1, 3, then min(streak×2,60) day intervals. Shared Room schedule is disclosed.

## Concurrency and interruption

Only fields changed from the opened entity are written; untouched content/SRS stays untouched. The automatic updatedAt field also has an opened base, so simultaneous disjoint edits may conservatively conflict rather than merge. Business editors resume existing shared field drafts. Same-browser overlap rereads current CAS state and reapplies later input; disjoint parts merge while retaining first bases. Grading/deletion still refuse an unrelated unfinished draft rather than discard it. Every draft write and save names its revision. A stale save leaves drafts available in House. Deletions compare the full opened Markdown and reject unseen collection-child changes. A local save queues work; only observed House status describes provider confirmation. Provider write-halt does not block local typing or Save: House queues the batch until writes resume. Refusal, binding changes and reported storage loss fail closed. Drafts are never auto-discarded.

The test suite covers late card saves after modal reopen, repeated grade clicks, form errors retaining input, first-card and 12→13 pagination, confirmations and modal focus/dismissal. The mixed-control focus trap, CSS layout and real browser histories still require hosted review.

## Independent review corrections

Four source defects were fixed after the first candidate: Markdown validation no longer trims meaningful indentation or edge whitespace; creation-time ordering and saved-card page selection replace UUID-order assumptions and duplicate appends; the landing informational cards keep the donor’s three-column desktop layout; and completed old renames cannot close or erase a reopened rename draft. Exact-string and rename regressions were observed failing before their fixes. The local suite includes regression tests covering these cases. These additions are source/DOM checks, not hosted visual acceptance.

## Pending live gates

1. Parent allocates one private sample Room, writes exactly this schema and 22 licensed donor documents (one deck, 21 cards), then binds the Flashcards slot
2. Parent publishes source main + parentless built release using the current documented Tasks-first atomic flow
3. Hosted desktop and 360 px: every retained page, overflow, touch/keyboard controls, no third-party requests
4. CRUD, reload, two-client observation, offline queue→reconnect, real CAS conflicts/returned drafts, stopped writes, reach/binding changes
5. Study/review schedules across reload; deleting and editing while another client changes records; Escape/Close/Back/Forward during pending operations
6. Only after these pass can Porting status become review

No new House defect has been fabricated during local preparation. Per-member schedule identity waits on the existing core#3329 issue; basic shared schedule remains functional.

## Local-first business editors (Master1415/1420/1425)

Collection names and both card faces write their actual document Room Draft on every input, including invalid text. Explicit Create/Update validates and calls Save; typing never queues a Change Batch. Closing a form or navigating keeps the runtime-owned local draft; a new form restores it. New-document identity pointers use scoped House Presentation state only, never a buffer document/type. Two mounted editors observe the shared draft, merge disjoint changes and show later same-field typing. Original field bases remain intact for cross-device Save conflict checks. No browser storage, unsaved prompt, route HTTP request or lazy route module is introduced. Production uses eagerly bundled SPA pages over the fully observed Room query.

Strict boundary tests and mounted donor-form tests are local evidence, not browser/Provider acceptance. Hosted verification remains blocked on the documented House installed-release/authentication path.
