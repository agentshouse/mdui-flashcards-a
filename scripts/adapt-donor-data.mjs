// Operator-only deterministic adaptation of the pinned donor's complete example deck.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const pin = '4005955f9fc6865f4eca20496ac15e36579b80d8';
const source = fs.readFileSync('samples/donor/exampleData.ts', 'utf8');
const time = '2026-10-11T08:00:00.000Z';
let counter = 0;
function stableId() {
  const bytes = crypto.createHash('sha1').update(`${pin}:example:${counter++}`).digest();
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const code = ts.transpileModule(source.replaceAll('new Date().toISOString()', JSON.stringify(time)), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, require(name) { if (name !== 'uuid') throw new Error(`Unexpected donor import: ${name}`); return { v7: stableId }; } };
vm.runInNewContext(code, context, { timeout: 1000 });
const data = context.exports.exampleData;
const rows = [...data.decks.map(fields => ({ path: `decks/${fields.id}.md`, type: 'flashcard_deck', fields })), ...data.cards.map(card => ({ path: `cards/${card.id}.md`, type: 'flashcard_card', fields: { ...card, deck: `../decks/${card.deckId}.md` } }))];
fs.writeFileSync('scripts/sample-documents.json', JSON.stringify(rows, null, 2) + '\n');
const markdown = row => `---\ntype: ${row.type}\n${Object.entries(row.fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n`;

for (const row of rows) { fs.mkdirSync(`samples/${row.path.split('/')[0]}`, { recursive: true }); fs.writeFileSync(`samples/${row.path}`, markdown(row)); }
fs.writeFileSync('scripts/donor-seed-changes.json', JSON.stringify({ room_handle_required: true, changes: rows.map(row => ({ op: 'create', path: row.path, content: markdown(row) })) }, null, 2) + '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
fs.writeFileSync('samples/PROVENANCE.json', JSON.stringify({ repository: 'https://github.com/megafarad/barabara', commit: pin, source: 'src/data/exampleData.ts', license: 'MIT', source_sha256: hash(source), license_sha256: hash(fs.readFileSync('samples/donor/LICENSE')), counts: { decks: data.decks.length, cards: data.cards.length }, transform: ['All 21 donor front/back pairs and the single deck are retained verbatim, with original initial review values.', 'Replace random UUIDv7 and current time with stable namespaced UUID-shaped IDs and a fixed import timestamp; preserve deck relationships.', 'Add the schema-required relative deck document reference. No student, patient, practice-history, media or Agent output records.', 'The sample explains software message structure; it does not contain patient data. Operator-only files, never automatically seeded or imported by the UI.'] }, null, 2) + '\n');
console.log(`${data.decks.length} donor deck, ${data.cards.length} donor cards`);
