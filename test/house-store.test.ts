import {afterEach, describe, expect, it, vi} from 'vitest';
import {HouseDataStore} from '../src/data/house';
import {gradeCard} from '../src/data/schedule';

import {Boundary, ROOM, D1, D2, C1, C2, T0, deckPath, cardPath, deck, card, deckDoc, cardDoc, gate, type Doc, type Draft} from './house-boundary';

const stores: HouseDataStore[] = [];
async function setup(docs: Doc[] = [deckDoc(), cardDoc()]) {
  const boundary = new Boundary(docs);
  const provider = vi.fn(async () => boundary.client());
  const store = new HouseDataStore(provider);
  stores.push(store);
  await store.start();
  return {boundary, store, provider};
}
afterEach(() => {stores.splice(0).forEach(store => store.dispose()); vi.restoreAllMocks();});

describe('HouseDataStore using a strict local published-boundary mock', () => {
  it('starts once, reads an empty Room without seeding, and closes observations', async () => {
    const {boundary, store, provider} = await setup([]);
    await Promise.all([store.start(), store.start()]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await store.getDecks()).toEqual([]);
    expect(store.snapshot()).toMatchObject({cards: [], loading: false, error: null, busy: false});
    expect(boundary.writes).toEqual([]);
    expect(boundary.saves).toEqual([]);
    expect([...boundary.observations.keys()].sort()).toEqual(['connection-refusal', 'query', 'rooms', 'service-mode', 'storage-loss', 'sync-status']);
    store.dispose();
    expect([...boundary.observations.values()].every(handle => handle.closed && handle.listeners.size === 0)).toBe(true);
  });

  it('creates, reads, updates, and deletes one document per entity', async () => {
    const {boundary, store} = await setup([]);
    const createdDeck = await store.upsertDeck(deck());
    const createdCard = await store.upsertCard(card());
    expect(createdDeck).toMatchObject(deck());
    expect(createdCard).toMatchObject(card());
    expect([...boundary.docs.keys()].sort()).toEqual([cardPath(C1), deckPath(D1)].sort());
    expect(boundary.docs.get(cardPath(C1))?.fields.deck).toBe(`../${deckPath(D1)}`);
    expect(boundary.writes[0]).toMatchObject({path: deckPath(D1), revision: null, parts: {creation: {type: 'flashcard_deck'}}});
    expect(boundary.writes[1]).toMatchObject({path: cardPath(C1), revision: null, parts: {creation: {type: 'flashcard_card'}}});
    const renamed = await store.upsertDeck({...createdDeck, name: 'Biology II'});
    expect(renamed.name).toBe('Biology II');
    expect(boundary.writes[2].parts.fields?.name).toEqual({value: 'Biology II', base: {value: 'Biology'}});
    const edited = await store.upsertCard({...createdCard, front: 'Revised question'});
    expect(edited).toMatchObject({front: 'Revised question', back: 'Answer', createdAt: T0, streak: 0, intervalDays: 0});
    expect(Object.keys(boundary.writes[3].parts.fields ?? {}).sort()).toEqual(['front', 'updatedAt']);
    expect(await store.getCards(D1)).toHaveLength(1);
    expect(await store.getCards(D2)).toEqual([]);
    await store.deleteCard(edited);
    expect(await store.getCard(C1)).toBeUndefined();
    await store.deleteDeck(renamed, []);
    expect(await store.getDeck(D1)).toBeUndefined();
    expect(boundary.docs.size).toBe(0);
  });

  it('observes remote additions, edits, and removals without polling or local shadow state', async () => {
    const {boundary, store} = await setup();
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);
    const initialVersion = store.snapshot().version;
    boundary.external(deckDoc(deck(D2, 'Chemistry')));
    boundary.external(cardDoc({...card(), back: 'Remote answer'}));
    expect((await store.getDeck(D2))?.name).toBe('Chemistry');
    expect((await store.getCard(C1))?.back).toBe('Remote answer');
    expect(store.snapshot().version).toBeGreaterThan(initialVersion);
    boundary.externalRemove(cardPath(C1));
    expect(await store.getCards(D1)).toEqual([]);
    expect(changed).toHaveBeenCalled();
    unsubscribe();
    changed.mockClear();
    boundary.externalRemove(deckPath(D2));
    expect(changed).not.toHaveBeenCalled();
    expect(boundary.save).not.toHaveBeenCalled();
  });

  it('sends SRS changes as field patches without rewriting question/answer content', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getCard(C1))!;
    const graded = await store.upsertCard({...opened, streak: 1, intervalDays: 1, nextReviewAt: '2026-10-12T12:00:00.000Z'});
    expect(graded).toMatchObject({front: 'Question', back: 'Answer', streak: 1, intervalDays: 1});
    expect(Object.keys(boundary.writes[0].parts.fields ?? {}).sort()).toEqual(['intervalDays', 'nextReviewAt', 'streak', 'updatedAt']);
    expect(boundary.writes[0].parts.fields?.streak).toEqual({value: 1, base: {value: 0}});
  });

  it('keeps externally authored Markdown exact when reading and grading only its schedule', async () => {
    const front = '\n    const answer = 42;\n    return answer;\n\n';
    const back = '\tindented answer\nA hard line break  \nnext line\n ';
    const {boundary, store} = await setup([deckDoc(), cardDoc({...card(), front, back})]);
    const opened = (await store.getCard(C1))!;
    expect(opened.front).toBe(front);
    expect(opened.back).toBe(back);
    const graded = await store.upsertCard(gradeCard(opened, true));
    expect(Object.keys(boundary.writes[0].parts.fields ?? {}).sort()).toEqual(['intervalDays', 'nextReviewAt', 'streak', 'updatedAt']);
    expect(graded.front).toBe(front);
    expect(graded.back).toBe(back);
    expect(boundary.docs.get(cardPath(C1))?.fields.front).toBe(front);
    expect(boundary.docs.get(cardPath(C1))?.fields.back).toBe(back);
  });

  it('preserves exact Markdown through creation, opened content edits, and a no-op save', async () => {
    const {boundary, store} = await setup([deckDoc()]);
    const front = '    first code block\n\n';
    const back = '\n    answer block\nline break  \n';
    const created = await store.upsertCard({...card(), front, back});
    expect(boundary.docs.get(cardPath(C1))?.fields).toMatchObject({front, back});
    expect(created.front).toBe(front);
    expect(created.back).toBe(back);
    const editedFront = '\n\n    changed code block\n  ';
    const edited = await store.upsertCard({...created, front: editedFront});
    expect(boundary.writes[1].parts.fields?.front).toEqual({value: editedFront, base: {value: front}});
    expect(boundary.writes[1].parts.fields?.back).toBeUndefined();
    expect(edited.front).toBe(editedFront);
    expect(edited.back).toBe(back);
    const saves = boundary.saves.length;
    await store.upsertCard(edited);
    expect(boundary.saves).toHaveLength(saves);
  });

  it('orders mixed UUID sample and new cards by creation instant with a stable path tie-break', async () => {
    const earlier = {...card('ffffffff-ffff-5fff-8fff-ffffffffffff'), createdAt: '2026-10-11T08:00:00.000Z'};
    const later = {...card('0198ffff-ffff-7fff-8fff-ffffffffffff'), createdAt: '2026-10-11T12:00:00.000Z'};
    const tied = {...card('aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'), createdAt: '2026-10-11T10:00:00.000+02:00'};
    const {store} = await setup([deckDoc(), cardDoc(later), cardDoc(earlier), cardDoc(tied)]);
    expect((await store.getCards(D1)).map(item => item.id)).toEqual([tied.id, earlier.id, later.id]);
  });

  it('does not save unchanged records or accept duplicate identities as creates', async () => {
    const {boundary, store} = await setup();
    await store.upsertDeck((await store.getDeck(D1))!);
    await store.upsertCard((await store.getCard(C1))!);
    expect(boundary.saves).toHaveLength(0);
    await expect(store.upsertDeck(deck())).rejects.toThrow(/already exists/i);
    expect(boundary.writes).toHaveLength(0);
  });

  it('keeps one deferred save in flight and rejects repeated actions', async () => {
    const {boundary, store} = await setup([]);
    const pending = gate();
    boundary.saveGate = pending.promise;
    const first = store.upsertDeck(deck());
    await vi.waitFor(() => expect(boundary.saves).toHaveLength(1));
    expect(store.snapshot().busy).toBe(true);
    await expect(store.upsertDeck(deck())).rejects.toThrow(/already in progress/i);
    expect(boundary.saves).toHaveLength(1);
    expect(boundary.docs.size).toBe(0);
    pending.release();
    await first;
    expect(store.snapshot().busy).toBe(false);
    expect(boundary.docs.size).toBe(1);
    expect(store.snapshot().status).toBe('');
  });

  it('preserves an existing shared draft and refuses to touch it', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getDeck(D1))!;
    const existing = boundary.draft(deckPath(D1), {fields: {name: {value: 'Other tab draft', base: {value: opened.name}}}});
    await expect(store.upsertDeck({...opened, name: 'My draft'})).rejects.toThrow(/unfinished House draft/i);
    expect(boundary.drafts.get(deckPath(D1))).toEqual(existing);
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.saves).toHaveLength(0);
    expect(boundary.roomDraft.discard).not.toHaveBeenCalled();
  });

  it('honors shared-draft CAS when another tab writes after the preflight read', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getDeck(D1))!;
    let competing: Draft | undefined;
    boundary.beforeWrite = path => {competing = boundary.draft(path, {fields: {name: {value: 'Racing draft', base: {value: opened.name}}}});};
    await expect(store.upsertDeck({...opened, name: 'My draft'})).rejects.toThrow(/shared House draft changed/i);
    expect(boundary.writes[0].revision).toBeNull();
    expect(boundary.drafts.get(deckPath(D1))).toEqual(competing);
    expect(boundary.saves).toHaveLength(0);
    expect(store.snapshot().busy).toBe(false);
  });

  it('passes the written revision into Save and retains a newer draft on a stale refusal', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getDeck(D1))!;
    let competing: Draft | undefined;
    boundary.beforeSave = () => {competing = boundary.draft(deckPath(D1), {fields: {name: {value: 'Newer tab draft', base: {value: opened.name}}}});};
    await expect(store.upsertDeck({...opened, name: 'My draft'})).rejects.toThrow(/refused.*stale/i);
    expect(boundary.saves[0].drafts[0]).toEqual({path: deckPath(D1), revision: 'draft-1'});
    expect(boundary.drafts.get(deckPath(D1))).toEqual(competing);
    expect(boundary.docs.get(deckPath(D1))?.fields.name).toBe('Biology');
  });

  it('preserves the opened field base and rejects stale edits without overwriting remote content', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getCard(C1))!;
    boundary.external(cardDoc({...card(), front: 'Remote question'}));
    await expect(store.upsertCard({...opened, front: 'My question'})).rejects.toThrow(/changed-underneath/i);
    expect(boundary.writes[0].parts.fields?.front).toEqual({value: 'My question', base: {value: 'Question'}});
    expect(boundary.docs.get(cardPath(C1))?.fields.front).toBe('Remote question');
    expect(boundary.drafts.get(cardPath(C1))?.parts.fields?.front.value).toBe('My question');
    expect(boundary.roomDraft.discard).not.toHaveBeenCalled();
    expect(store.snapshot().busy).toBe(false);
  });

  it('retains drafts after a local validation refusal and never retries automatically', async () => {
    const {boundary, store} = await setup();
    boundary.nextSaveRule = 'schema-validation';
    await expect(store.upsertDeck({...((await store.getDeck(D1))!), name: 'New name'})).rejects.toThrow(/schema-validation/i);
    expect(boundary.saves).toHaveLength(1);
    expect(boundary.drafts.has(deckPath(D1))).toBe(true);
    expect(boundary.docs.get(deckPath(D1))?.fields.name).toBe('Biology');
    expect(store.snapshot().busy).toBe(false);
  });

  it('deletes a deck and all its cards in one batch, retaining other collections', async () => {
    const {boundary, store} = await setup([deckDoc(), cardDoc(), cardDoc(card(C2)), deckDoc(deck(D2))]);
    const openedDeck = (await store.getDeck(D1))!;
    const children = await store.getCards(D1);
    await store.deleteDeck(openedDeck, children);
    expect(boundary.saves).toHaveLength(1);
    expect(boundary.saves[0].drafts.map(value => value.path).sort()).toEqual([deckPath(D1), cardPath(C1), cardPath(C2)].sort());
    expect(boundary.writes.every(write => Object.keys(write.parts).join() === 'removal')).toBe(true);
    expect([...boundary.docs.keys()]).toEqual([deckPath(D2)]);
  });

  it('rejects cascade deletion when its opened child set has changed', async () => {
    const {boundary, store} = await setup();
    const openedDeck = (await store.getDeck(D1))!;
    const children = await store.getCards(D1);
    boundary.external(cardDoc(card(C2)));
    await expect(store.deleteDeck(openedDeck, children)).rejects.toThrow(/cards changed/i);
    expect(boundary.saves).toHaveLength(0);
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.docs.size).toBe(3);
  });

  it('retains the entire cascade draft batch if a new child appears before Save', async () => {
    const {boundary, store} = await setup();
    boundary.beforeSave = () => boundary.external(cardDoc(card(C2)));
    await expect(store.deleteDeck((await store.getDeck(D1))!, await store.getCards(D1))).rejects.toThrow(/missing-reference-target/i);
    expect(boundary.saves).toHaveLength(1);
    expect(boundary.docs.size).toBe(3);
    expect([...boundary.drafts.keys()].sort()).toEqual([deckPath(D1), cardPath(C1)].sort());
    expect(boundary.roomDraft.discard).not.toHaveBeenCalled();
  });

  it('rejects deleting a remotely changed child before drafting any cascade removals', async () => {
    const {boundary, store} = await setup();
    const openedDeck = (await store.getDeck(D1))!;
    const children = await store.getCards(D1);
    boundary.external(cardDoc({...card(), back: 'Remote revision'}));
    await expect(store.deleteDeck(openedDeck, children)).rejects.toThrow(/selected record changed/i);
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.saves).toHaveLength(0);
  });

  it('preflights every cascade draft before writing any document', async () => {
    const {boundary, store} = await setup();
    const draft = boundary.draft(cardPath(C1), {fields: {back: {value: 'Unfinished', base: {value: 'Answer'}}}});
    await expect(store.deleteDeck((await store.getDeck(D1))!, await store.getCards(D1))).rejects.toThrow(/unfinished House draft/i);
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.drafts.size).toBe(1);
    expect(boundary.drafts.get(cardPath(C1))).toEqual(draft);
  });

  it('retains already-written drafts if a later cascade write loses CAS', async () => {
    const {boundary, store} = await setup();
    boundary.beforeWrite = path => {if (path === cardPath(C1)) boundary.draft(path, {fields: {back: {value: 'Other tab', base: {value: 'Answer'}}}});};
    await expect(store.deleteDeck((await store.getDeck(D1))!, await store.getCards(D1))).rejects.toThrow(/shared House draft changed/i);
    expect(boundary.saves).toHaveLength(0);
    expect(boundary.docs.size).toBe(2);
    expect(boundary.drafts.get(deckPath(D1))?.parts.removal).toBeDefined();
    expect(boundary.drafts.get(cardPath(C1))?.parts.fields?.back.value).toBe('Other tab');
    expect(boundary.roomDraft.discard).not.toHaveBeenCalled();
  });

  it('rejects card creation when the parent collection does not exist', async () => {
    const {boundary, store} = await setup([]);
    await expect(store.upsertCard(card())).rejects.toThrow(/collection no longer exists/i);
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.saves).toHaveLength(0);
  });

  it('refuses stale edits and deletes after a record is removed', async () => {
    const {boundary, store} = await setup();
    const opened = (await store.getCard(C1))!;
    boundary.externalRemove(cardPath(C1));
    await expect(store.upsertCard({...opened, front: 'Resurrected'})).rejects.toThrow(/moved or was removed/i);
    await expect(store.deleteCard(opened)).rejects.toThrow(/selected record changed/i);
    expect(boundary.writes).toHaveLength(0);
  });

  it('prevents an opened card from being reassigned to another collection', async () => {
    const {boundary, store} = await setup([deckDoc(), deckDoc(deck(D2)), cardDoc()]);
    const opened = (await store.getCard(C1))!;
    await expect(store.upsertCard({...opened, deckId: D2})).rejects.toThrow(/identity or collection cannot be changed/i);
    expect(boundary.writes).toHaveLength(0);
  });

  it('queues local Save while Provider writes are halted', async () => {
    const {boundary, store} = await setup();
    boundary.publish('service-mode', 'write-halted');
    expect(store.snapshot().halted).toBe(true);
    expect(await store.getDecks()).toHaveLength(1);
    const editor = await store.openEditor('flashcard_deck', await store.getDeck(D1));
    await editor.write({name: 'Queued rename'});
    await editor.commit(); editor.close();
    expect(boundary.saves).toHaveLength(1);
    boundary.publish('service-mode', 'open');
    await store.upsertDeck({...((await store.getDeck(D1))!), name: 'Allowed rename'});
    expect(boundary.saves).toHaveLength(2);
  });

  it('keeps only actionable attention from sync observations', async () => {
    const {boundary, store} = await setup();
    const status = {state: 'pending', lastCompleted: T0, providerUnreachable: true, attentionRequired: [], reset: null};
    boundary.publish('sync-status', status);
    expect(store.snapshot().status).toBe('');
    boundary.publish('sync-status', {...status, attentionRequired: [{room: ROOM, path: cardPath(C1), returned: {kind: 'expired'}}]});
    expect(store.snapshot().status).toMatch(/drafts need attention/i);
    boundary.publish('sync-status', {...status, state: 'synced', providerUnreachable: false});
    expect(store.snapshot().status).toBe('');
  });

  it.each([
    ['connection-refusal', {reason: 'revoked-authorization', reauthorizationOffered: true, refusal: null}, /connection refused/i],
    ['storage-loss', 'lost pending data', /unsynchronized.*lost/i],
    ['rooms', [], /binding changed/i],
  ])('blocks mutations after %s is observed', async (topic, value, message) => {
    const {boundary, store} = await setup();
    const opened = (await store.getDeck(D1))!;
    boundary.publish(String(topic), value);
    expect(store.snapshot().error).toMatch(message as RegExp);
    boundary.external(deckDoc(deck(D2, 'Remote addition after fatal status')));
    expect(store.snapshot().error).toMatch(message as RegExp);
    await expect(store.upsertDeck({...opened, name: 'Unsafe rename'})).rejects.toThrow(message as RegExp);
    expect(boundary.writes).toHaveLength(0);
  });

  it.each([
    ['empty name', {...deck(), name: '   '}],
    ['invalid UUID', {...deck(), id: 'not-a-uuid'}],
    ['invalid date', {...deck(), createdAt: 'tomorrow'}],
    ['oversized name', {...deck(), name: 'x'.repeat(201)}],
  ])('rejects invalid deck input: %s', async (_name, input) => {
    const {boundary, store} = await setup([]);
    await expect(store.upsertDeck(input)).rejects.toThrow();
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.saves).toHaveLength(0);
  });

  it.each([
    ['empty front', {front: ' '}], ['empty back', {back: ''}],
    ['negative streak', {streak: -1}], ['fractional interval', {intervalDays: 1.5}],
    ['interval beyond 60', {intervalDays: 61}], ['invalid due date', {nextReviewAt: 'soon'}],
    ['oversized content', {front: 'x'.repeat(50001)}],
  ])('rejects invalid card input: %s', async (_name, patch) => {
    const {boundary, store} = await setup([deckDoc()]);
    await expect(store.upsertCard({...card(), ...patch})).rejects.toThrow();
    expect(boundary.writes).toHaveLength(0);
    expect(boundary.saves).toHaveLength(0);
  });

  it.each([
    ['orphan card', [cardDoc()], /missing collection/i],
    ['mismatched deck reference', [deckDoc(), {...cardDoc(), fields: {...cardDoc().fields, deck: `../${deckPath(D2)}`}}], /missing collection/i],
    ['absent deck reference', [deckDoc(), {...cardDoc(), fields: {...card()}}], /invalid|expected.*string/i],
    ['duplicate identity', [deckDoc(), {...deckDoc(), path: 'decks/duplicate.md'}], /duplicate.*identity/i],
    ['wrong Room', [{...deckDoc(), room: 'room:other'}], /outside.*Room/i],
    ['unexpected type', [{...deckDoc(), type: 'unknown'}], /unexpected.*type/i],
    ['invalid fields', [{...deckDoc(), fields: {...deck(), name: ''}}], /too small|at least|invalid/i],
  ])('fails closed on invalid observed documents: %s', async (_name, docs, message) => {
    const {boundary, store} = await setup(docs as Doc[]);
    expect(store.snapshot()).toMatchObject({loading: false});
    expect(store.snapshot().error).toMatch(message as RegExp);
    await expect(store.getDecks()).rejects.toThrow();
    expect(boundary.writes).toHaveLength(0);
  });

  it.each([0, 2])('requires exactly one bound Room, refusing %s Rooms', async count => {
    const boundary = new Boundary();
    boundary.roomValues = Array.from({length: count}, (_, index) => ({locator: `room:${index}`, name: `Room ${index}`}));
    const store = new HouseDataStore(async () => boundary.client());
    stores.push(store);
    await store.start();
    expect(store.snapshot().error).toMatch(/exactly one/i);
    await expect(store.getDecks()).rejects.toThrow(/exactly one/i);
    expect(boundary.observe).toHaveBeenCalledWith('rooms');
    expect(boundary.observe).toHaveBeenCalledWith('sync-status');
    expect(boundary.observations.has('query')).toBe(false);
    expect(boundary.writes).toHaveLength(0);
  });
});


it('observes initial empty reach without an error, waits for sync, and recovers on late sole Room', async () => {
  const boundary = new Boundary([deckDoc()]); boundary.roomValues = []; boundary.lastCompleted = null;
  const store = new HouseDataStore(async () => boundary.client()); stores.push(store);
  await store.start();
  expect(boundary.rooms).not.toHaveBeenCalled();
  expect(store.snapshot()).toMatchObject({loading: true, error: null});
  expect(boundary.observations.has('query')).toBe(false);
  boundary.publish('rooms', [{locator: ROOM}, {locator: 'other'}]);
  expect(store.snapshot()).toMatchObject({loading: true, error: null});
  boundary.publish('sync-status', {state: 'synced', lastCompleted: T0, attentionRequired: []});
  expect(store.snapshot().error).toMatch(/exactly one/);
  boundary.publish('rooms', []);
  expect(store.snapshot().error).toMatch(/exactly one/);
  boundary.publish('rooms', [{locator: ROOM}]);
  await vi.waitFor(() => expect(store.snapshot()).toMatchObject({loading: false, error: null}));
  const opened = (await store.getDeck(D1))!;
  const edited = {...opened, name: 'Unsaved name kept through recovery'};
  boundary.publish('rooms', []);
  await expect(store.upsertDeck(edited)).rejects.toThrow(/binding/);
  expect(edited.name).toBe('Unsaved name kept through recovery');
  expect(boundary.writes).toHaveLength(0);
  boundary.publish('rooms', [{locator: ROOM}]);
  expect(store.snapshot().error).toBeNull();
  await store.upsertDeck(edited);
  expect(boundary.writes[0].parts.fields?.name).toEqual({value: edited.name, base: {value: 'Biology'}});
});

describe('durable business-field editor drafts', () => {
  it('stages invalid typing locally and restores a new collection after navigation', async () => {
    const {store, boundary} = await setup();
    const first = await store.openEditor('flashcard_deck');
    await first.write({name: ''});
    expect(boundary.saves).toHaveLength(0);
    await expect(first.commit()).rejects.toThrow();
    await first.write({name: 'A durable collection'});
    first.close();
    const reopened = await store.openEditor('flashcard_deck');
    expect(reopened.path).toBe(first.path);
    expect(reopened.value().name).toBe('A durable collection');
    expect(boundary.saves).toHaveLength(0);
    const saved = await reopened.commit();
    expect(saved).toMatchObject({name: 'A durable collection'});
    expect(boundary.saves).toHaveLength(1);
    reopened.close();
  });
  it('persists both card faces without queuing a save and hydrates another store', async () => {
    const {store, boundary} = await setup();
    const first = await store.openEditor('flashcard_card', undefined, D1);
    await first.write({front: 'Question draft'});
    await first.write({back: 'Answer draft'});
    first.close();
    const secondStore = new HouseDataStore(async () => boundary.client()); stores.push(secondStore);
    await secondStore.start();
    const second = await secondStore.openEditor('flashcard_card', undefined, D1);
    expect(second.value()).toMatchObject({front: 'Question draft', back: 'Answer draft', deckId: D1});
    expect(boundary.saves).toHaveLength(0);
    await second.commit();
    expect(boundary.docs.get(second.path)?.fields.front).toBe('Question draft');
    second.close();
  });
  it('merges disjoint tab input and preserves the original bases', async () => {
    const {store, boundary} = await setup(); const initial = await store.getCard(C1);
    const one = await store.openEditor('flashcard_card', initial);
    const two = await store.openEditor('flashcard_card', initial);
    const seen = vi.fn(); two.subscribe(seen);
    await one.write({front: 'First tab'});
    await two.write({back: 'Second tab'});
    expect(one.value()).toMatchObject({front: 'First tab', back: 'Second tab'});
    expect(seen).toHaveBeenCalled();
    expect(boundary.drafts.get(cardPath(C1))?.parts.fields?.front.base).toEqual({value: 'Question'});
    await one.commit();
    expect(boundary.docs.get(cardPath(C1))?.fields).toMatchObject({front: 'First tab', back: 'Second tab'});
    one.close(); two.close();
  });
  it('rereads stale CAS and applies this tab’s later same-field typing', async () => {
    const {store, boundary} = await setup(); const initial = await store.getCard(C1);
    const session = await store.openEditor('flashcard_card', initial);
    boundary.beforeWrite = path => {boundary.beforeWrite = undefined; boundary.draft(path, {fields: {front: {value: 'Other tab', base: {value: 'Question'}}}});};
    await session.write({front: 'Later local input'});
    expect(boundary.writes).toHaveLength(2);
    expect(session.value().front).toBe('Later local input');
    expect(boundary.drafts.get(session.path)?.parts.fields?.front.base).toEqual({value: 'Question'});
    expect(boundary.saves).toHaveLength(0); session.close();
  });
  it('keeps the Room draft when Save refuses a changed-underneath base', async () => {
    const {store, boundary} = await setup(); const initial = await store.getCard(C1);
    const session = await store.openEditor('flashcard_card', initial);
    await session.write({front: 'Local'});
    boundary.external(cardDoc({...card(), front: 'Other device'}));
    await expect(session.commit()).rejects.toThrow('changed-underneath');
    expect(boundary.drafts.get(session.path)?.parts.fields?.front.value).toBe('Local');
    expect(boundary.roomDraft.discard).not.toHaveBeenCalled(); session.close();
  });
  it('retains queued typing after the observing form closes', async () => {
    const {store, boundary} = await setup(); const session = await store.openEditor('flashcard_deck');
    const queued = session.write({name: 'Navigate immediately'}); session.close(); await queued;
    expect(boundary.saves).toHaveLength(0);
    const reopened = await store.openEditor('flashcard_deck');
    expect(reopened.value().name).toBe('Navigate immediately'); reopened.close();
  });
  it('redraws another tab after Save and bases subsequent typing on the new document', async () => {
    const {store, boundary} = await setup();
    const otherStore = new HouseDataStore(async () => boundary.client()); stores.push(otherStore); await otherStore.start();
    const one = await store.openEditor('flashcard_card', await store.getCard(C1));
    const two = await otherStore.openEditor('flashcard_card', await otherStore.getCard(C1));
    await one.write({front: 'Saved first'}); await one.commit();
    expect(two.value().front).toBe('Saved first');
    await two.write({front: 'Typed after Save'});
    expect(boundary.drafts.get(two.path)?.parts.fields?.front.base).toEqual({value: 'Saved first'});
    await two.commit();
    expect(one.value().front).toBe('Typed after Save');
    one.close(); two.close();
  });
  it('keeps field overrides already present on a creation draft', async () => {
    const {store, boundary} = await setup();
    const first = await store.openEditor('flashcard_card', undefined, D1);
    await first.write({front: 'Initial front'});
    const held = boundary.drafts.get(first.path)!;
    boundary.draft(first.path, {...held.parts, fields: {back: {value: 'Other tab answer', base: null}}});
    expect(first.value().back).toBe('Other tab answer');
    await first.write({front: 'Later front'});
    expect(boundary.drafts.get(first.path)?.parts.fields?.back).toEqual({value: 'Other tab answer', base: null});
    expect(first.value()).toMatchObject({front: 'Later front', back: 'Other tab answer'}); first.close();
  });
  it('does not roll back a newer observed draft when an older write reply arrives', async () => {
    const {store, boundary} = await setup(); const session = await store.openEditor('flashcard_card', await store.getCard(C1));
    boundary.afterWrite = path => {
      boundary.afterWrite = undefined;
      boundary.draft(path, {fields: {front: {value: 'Newer other tab', base: {value: 'Question'}}}});
    };
    await session.write({front: 'Earlier local'});
    expect(session.value().front).toBe('Newer other tab');
    expect(boundary.drafts.get(session.path)?.parts.fields?.front.value).toBe('Newer other tab'); session.close();
  });
  it('does not replay already-coalesced typing over intervening later foreign input', async () => {
    const {store, boundary} = await setup(); const session = await store.openEditor('flashcard_card', await store.getCard(C1));
    boundary.afterWrite = path => {
      boundary.afterWrite = undefined;
      boundary.draft(path, {fields: {front: {value: 'Later foreign C', base: {value: 'Question'}}}});
    };
    const a = session.write({front: 'A'});
    const b = session.write({front: 'B'});
    await Promise.all([a, b]);
    expect(boundary.writes).toHaveLength(1);
    expect(session.value().front).toBe('Later foreign C'); session.close();
  });
  it('an open creation becomes a field editor after another tab saves it', async () => {
    const {store, boundary} = await setup();
    const first = await store.openEditor('flashcard_deck'); await first.write({name: 'Created elsewhere'});
    const secondStore = new HouseDataStore(async () => boundary.client()); stores.push(secondStore); await secondStore.start();
    const second = await secondStore.openEditor('flashcard_deck');
    await second.commit();
    await first.write({name: 'Continue typing'});
    expect(boundary.drafts.get(first.path)?.parts.creation).toBeUndefined();
    expect(boundary.drafts.get(first.path)?.parts.fields?.name).toEqual({value: 'Continue typing', base: {value: 'Created elsewhere'}});
    await first.commit();
    const next = await store.openEditor('flashcard_deck'); expect(next.path).not.toBe(first.path);
    first.close(); second.close(); next.close();
  });
  it('rejects structural drafts and refuses identity editing', async () => {
    const {store, boundary} = await setup(); const initial = await store.getCard(C1);
    const session = await store.openEditor('flashcard_card', initial);
    await expect(session.write({id: C2})).rejects.toThrow('business fields'); session.close();
    boundary.draft(cardPath(C1), {removal: {base: boundary.docs.get(cardPath(C1))!.markdown}});
    await expect(store.openEditor('flashcard_card', initial)).rejects.toThrow('structural');
  });
});
