# Flashcards on House

A faithful ordinary House App port of [megafarad/barabara](https://github.com/megafarad/barabara) pinned at `4005955f9fc6865f4eca20496ac15e36579b80d8`.

The donor React/Vite pages, component layouts, original CSS, Markdown editor, animated flip cards, collection sidebar, library tiles, pagination and study/review behavior remain. House replaces the localStorage data store. See [PORT_CONTRACT.md](PORT_CONTRACT.md) and [reports/donor-fidelity.json](reports/donor-fidelity.json) for the exact scope and provenance.

## Local preparation

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build
npm run release:check
```

Node 24.19.0 was used. Published House model/runtime packages ask for >=24.21.0; Master has confirmed the older build-time Node warning is harmless. Prefer the declared Node version on new environments. No npm audit was run.

The built App needs House's supplied runtime and exactly one bound Flashcards Room. Opening it standalone deliberately shows a connection/binding error; it does not fabricate data or fall back to browser localStorage. This repository does not contain credentials, an App allocation, a release branch, or a publication script.

## Data

- `flashcard_deck`: one collection per document at `decks/<uuid>.md`
- `flashcard_card`: one card per document at `cards/<uuid>.md`
- `deckId` preserves the donor's UUID model; `deck` is the House reference `../decks/<uuid>.md`
- `schema.yaml` is the JSON Schema 2020-12 document required by current dev
- All production runtime code is isolated in `src/data/house.ts`; it receives `connectHouseBridge().runtime`, never constructs a Runtime
- `samples/` and `scripts/sample-documents.json` contain the pinned donor’s complete MIT-licensed example deck and all 21 cards used in the bound private Room. They are not in the release and are never seeded automatically

The original donor has one review schedule per card. This port states explicitly that content and schedules are shared with the Room. Per-member schedules are not implemented because House current-member identity remains an acknowledged gap (Porting's `runtime-current-member-identity` / core#3329). No identity is inferred.

## Verification boundary

Local typecheck, lint, test, schema/reference validation, license audit and release checks are distinct from hosted acceptance. Tests exercise the actual donor UI in jsdom and a strict local mock of the published runtime boundary; they are not live House acceptance. Hosted browser checks, real reload/offline/sync and live Room writes remain pending the House installed-release/authentication repair. Publication and compatible binding are checked separately.

## Licenses

Original donor MIT LICENSE is unchanged. Product name/logos are removed from the UI. Nine externally hosted photographs, an unverified SVG Repo favicon, the unused React logo and unattributed quotations are omitted. Original local SVG illustrations preserve their layout positions. Distributed production dependency notices and explicitly licensed embedded Font Awesome icons are retained in `public/THIRD_PARTY_NOTICES.txt` and `public/licenses/`; licensing is not silently generalized to MIT for every dependency.

## Reused donor demo (Master1150)

`samples/donor/exampleData.ts` and its original MIT notice are copied from megafarad/barabara commit `4005955f9fc6865f4eca20496ac15e36579b80d8`. `samples/PROVENANCE.json` records hashes and adaptations; `node scripts/adapt-donor-data.mjs` reproduces all 22 typed documents and the relative-path operator payload `scripts/donor-seed-changes.json`. Front/back text, deck membership and initial review state match the donor. Random IDs and wall-clock times become deterministic; the required relative deck reference is added. Earlier invented Spanish/web/gardening cards are replaced in source and remain recoverable in Git. No automatic seeding or runtime sample import.

## Local-first editing

Collection names and card front/back text are persisted as actual business-document Room Drafts as typed. They survive form navigation/remounts, redraw across same-browser editors, and queue only on explicit Save. Invalid input remains in the draft until corrected. All SPA code is bundled eagerly; page navigation selects the already observed local Room data. Provider write-halt delays synchronization, not local drafting or Save.
