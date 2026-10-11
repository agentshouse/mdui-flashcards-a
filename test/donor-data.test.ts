import { test, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
test('all licensed donor cards remain related to the complete example deck', () => {
 const manifest=JSON.parse(fs.readFileSync('samples/PROVENANCE.json','utf8'));
 for(const [file,key] of [['exampleData.ts','source_sha256'],['LICENSE','license_sha256']]) expect(crypto.createHash('sha256').update(fs.readFileSync(`samples/donor/${file}`)).digest('hex')).toBe(manifest[key]);
 const rows=JSON.parse(fs.readFileSync('scripts/sample-documents.json','utf8')) as {type:string;path:string;fields:Record<string,unknown>}[];
 const decks=rows.filter(r=>r.type==='flashcard_deck');const cards=rows.filter(r=>r.type==='flashcard_card');expect(decks).toHaveLength(1);expect(cards).toHaveLength(21);
 for(const card of cards){expect(card.fields.deckId).toBe(decks[0].fields.id);expect(card.fields.deck).toBe(`../${decks[0].path}`);expect(card.fields.streak).toBe(0);expect(card.fields.intervalDays).toBe(0);expect(fs.readFileSync(`samples/${card.path}`,'utf8')).toContain(JSON.stringify(card.fields.front));}
 expect(rows.length).toBe(manifest.counts.decks+manifest.counts.cards);
});
