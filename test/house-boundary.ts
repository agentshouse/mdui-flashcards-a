import {assertQueryPointers} from './query-pointers';
import {expect, vi} from 'vitest';
import type {MdRuntimeClient} from '@agentshouse/mdruntime/client';
import type {Card, Deck} from '../src/data/model';
// These are local boundary-contract tests, not a Runtime implementation or evidence
// of live House/Provider acceptance. Production Runtime modules are never constructed.
export type Draft = NonNullable<Awaited<ReturnType<MdRuntimeClient['roomDraft']['read']>>>;
type Parts = Parameters<MdRuntimeClient['roomDraft']['write']>[3];
type SaveResult = Awaited<ReturnType<MdRuntimeClient['save']>>;
type SaveSelection = Parameters<MdRuntimeClient['save']>[1];
type Fields = Record<string, unknown>;
export type Doc = {room: string; path: string; type: string; fields: Fields; markdown: string};
export const ROOM = 'room:flashcards-test';
export const D1 = '11111111-1111-4111-8111-111111111111';
export const D2 = '22222222-2222-4222-8222-222222222222';
export const C1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const C2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const T0 = '2026-10-01T12:00:00.000Z';
export const deckPath = (id: string) => `decks/${id}.md`;
export const cardPath = (id: string) => `cards/${id}.md`;
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const deck = (id = D1, name = 'Biology'): Deck => ({id, name, createdAt: T0, updatedAt: T0});
export const card = (id = C1, deckId = D1): Card => ({id, deckId, front: 'Question', back: 'Answer', createdAt: T0, updatedAt: T0, streak: 0, intervalDays: 0, nextReviewAt: T0});
const markdown = (type: string, fields: Fields) => `---\n${JSON.stringify({type, ...fields})}\n---\n`;
export const deckDoc = (value = deck()): Doc => ({room: ROOM, path: deckPath(value.id), type: 'flashcard_deck', fields: {...value}, markdown: markdown('flashcard_deck', {...value})});
export const cardDoc = (value = card()): Doc => {
  const fields = {...value, deck: `../${deckPath(value.deckId)}`};
  return {room: ROOM, path: cardPath(value.id), type: 'flashcard_card', fields, markdown: markdown('flashcard_card', fields)};
};

class Observation {
  value: unknown;
  closed = false;
  listeners = new Set<(value: unknown) => void>();
  constructor(value: unknown) {this.value = clone(value);}
  current = () => clone(this.value);
  subscribe = (listener: (value: unknown) => void) => {
    if (this.closed) throw new Error('Cannot subscribe to closed observation');
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  close = () => {this.closed = true; this.listeners.clear();};
  publish(value: unknown) {
    if (this.closed) return;
    this.value = clone(value);
    this.listeners.forEach(listener => listener(this.current()));
  }
}

export const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, release};
};

/** Strict test double of only the published asynchronous methods the store uses. */
export class Boundary {
  docs = new Map<string, Doc>();
  drafts = new Map<string, Draft>();
  observations = new Map<string, Observation>();
  allObservations = new Map<string, Set<Observation>>();
  presentationValue: Record<string, unknown> = {};
  presentation = {read: async () => clone(this.presentationValue), write: async (value: Record<string, unknown>) => {this.presentationValue = clone(value);}};
  roomValues = [{locator: ROOM, name: 'Flashcards'}];
  lastCompleted: string | null = T0;
  writes: {room: string; path: string; revision: string | null; parts: Parts}[] = [];
  saves: {room: string; drafts: SaveSelection}[] = [];
  queries: unknown[] = [];
  revision = 0;
  saveGate?: Promise<void>;
  beforeWrite?: (path: string) => void;
  afterWrite?: (path: string) => void;
  beforeSave?: () => void;
  nextSaveRule?: string;

  constructor(docs: Doc[] = []) {docs.forEach(doc => this.docs.set(doc.path, clone(doc)));}
  private assertRoom(room: string) {expect(room).toBe(ROOM);}
  private checkQuery(query: unknown) {
    assertQueryPointers(query);
    expect(query).toEqual({types: ['flashcard_deck', 'flashcard_card'], select: {fields: 'all', markdown: true}, orderBy: [{by: {field: '/createdAt'}, direction: 'asc'}, {by: 'path', direction: 'asc'}], rooms: [ROOM]});
  }
  private result() {return {documents: [...this.docs.values()].sort((a, b) => Date.parse(String(a.fields.createdAt)) - Date.parse(String(b.fields.createdAt)) || a.path.localeCompare(b.path)).map(clone)};}
  private refreshQuery() {for (const item of this.allObservations.get('query') ?? []) item.publish(this.result());}
  external(doc: Doc) {this.docs.set(doc.path, clone(doc)); this.refreshQuery();}
  externalRemove(path: string) {this.docs.delete(path); this.refreshQuery();}
  publish(topic: string, value: unknown) {
    const observation = this.observations.get(topic);
    if (!observation) throw new Error(`Topic was not observed: ${topic}`);
    for (const item of this.allObservations.get(topic) ?? [observation]) item.publish(value);
  }
  draft(path: string, parts: Draft['parts']): Draft {
    const value: Draft = {room: ROOM, path, revision: `draft-${++this.revision}`, parts: clone(parts), changedUnderneath: {}, returned: null};
    this.drafts.set(path, value);
    if (this.observations.has("room-drafts")) this.publish("room-drafts", [...this.drafts.values()]);
    return clone(value);
  }
  rooms = vi.fn(async () => clone(this.roomValues));
  query = vi.fn(async (query: unknown) => {this.checkQuery(query); this.queries.push(clone(query)); return this.result();});
  observe = vi.fn(async (topic: string, query?: unknown) => {
    if (topic === 'query') this.checkQuery(query);
    else expect(query).toBeUndefined();
    const values: Record<string, unknown> = {
      query: this.result(), rooms: this.roomValues, 'service-mode': 'open',
      'sync-status': {state: 'synced', lastCompleted: this.lastCompleted, providerUnreachable: false, attentionRequired: [], reset: null},
      'connection-refusal': null, 'storage-loss': null, 'room-drafts': [...this.drafts.values()],
    };
    if (!(topic in values)) throw new Error(`Unexpected observation: ${topic}`);
    const observation = new Observation(values[topic]);
    this.observations.set(topic, observation);
    const watchers = this.allObservations.get(topic) ?? new Set<Observation>(); watchers.add(observation); this.allObservations.set(topic, watchers);
    return observation;
  });
  roomDraft = {
    read: vi.fn(async (room: string, path: string) => {this.assertRoom(room); return clone(this.drafts.get(path) ?? null);}),
    write: vi.fn(async (room: string, path: string, revision: string | null, parts: Parts) => {
      this.assertRoom(room);
      this.writes.push({room, path, revision, parts: clone(parts)});
      this.beforeWrite?.(path);
      const existing = this.drafts.get(path);
      if ((existing?.revision ?? null) !== revision) return {outcome: 'stale' as const, current: clone(existing ?? null)};
      expect(Object.keys(parts).length).toBeGreaterThan(0);
      expect(Object.keys(parts).every(key => ['creation', 'fields', 'removal'].includes(key))).toBe(true);
      if (parts.creation) {
        expect(Object.keys(parts.creation).sort()).toEqual(['fields', 'sections', 'type']);
        expect('type' in parts.creation).toBe(true);
      }
      if (parts.fields) for (const change of Object.values(parts.fields)) expect(Object.keys(change).sort()).toEqual(['base', 'value']);
      if (parts.removal) expect(typeof parts.removal.base).toBe('string');
      // The tested app writes only fresh drafts. Other-tab draft updates are
      // injected explicitly, preserving the real null-vs-revision CAS contract.
      // Revision-CAS updates preserve the first field base, matching the public draft contract.
      if (existing?.parts.fields && parts.fields) for (const [key, part] of Object.entries(parts.fields)) if (existing.parts.fields[key]) expect(part.base).toEqual(existing.parts.fields[key].base);
      const roomDraft = this.draft(path, parts as Draft['parts']);
      this.afterWrite?.(path);
      return {outcome: 'written' as const, roomDraft};
    }),
    discard: vi.fn(async () => {throw new Error('The store must not silently discard shared drafts');}),
  };
  save = vi.fn(async (room: string, selections: SaveSelection): Promise<SaveResult> => {
    this.assertRoom(room);
    this.saves.push({room, drafts: clone(selections)});
    expect(new Set(selections.map(item => item.path)).size).toBe(selections.length);
    selections.forEach(item => expect(Object.keys(item).sort()).toEqual(['path', 'revision']));
    if (this.saveGate) await this.saveGate;
    this.beforeSave?.();
    if (this.nextSaveRule) return {outcome: 'refused', rule: this.nextSaveRule};
    const next = new Map([...this.docs].map(([path, doc]) => [path, clone(doc)]));
    for (const selection of selections) {
      const draft = this.drafts.get(selection.path);
      if (!draft || draft.revision !== selection.revision) return {outcome: 'refused', rule: 'stale'};
      const current = next.get(selection.path);
      if (draft.parts.creation) {
        if (current) return {outcome: 'refused', rule: 'changed-underneath'};
        if (!('type' in draft.parts.creation)) throw new Error('Unexpected raw-markdown creation');
        const {type, fields, sections} = draft.parts.creation;
        expect(sections).toEqual({});
        next.set(selection.path, {room: ROOM, path: selection.path, type, fields: clone({...fields}), markdown: markdown(type, fields)});
      } else if (draft.parts.fields) {
        if (!current) return {outcome: 'refused', rule: 'changed-underneath'};
        for (const [key, change] of Object.entries(draft.parts.fields)) {
          const base = key in current.fields ? {value: current.fields[key]} : null;
          if (!same(base, change.base)) return {outcome: 'refused', rule: 'changed-underneath'};
          current.fields[key] = clone(change.value);
        }
        current.markdown = markdown(current.type, current.fields);
      } else if (draft.parts.removal) {
        if (!current || current.markdown !== draft.parts.removal.base) return {outcome: 'refused', rule: 'changed-underneath'};
        next.delete(selection.path);
      } else throw new Error('Unexpected Room Draft parts');
    }
    // Independent referential checks: cards must persist both a donor UUID and
    // the actual Room document reference; a batch may not strand child cards.
    for (const doc of next.values()) {
      const isDeck = doc.type === 'flashcard_deck';
      expect(['flashcard_deck', 'flashcard_card']).toContain(doc.type);
      expect(doc.path).toBe(isDeck ? deckPath(String(doc.fields.id)) : cardPath(String(doc.fields.id)));
      if (!isDeck) {
        if (doc.fields.deck !== `../${deckPath(String(doc.fields.deckId))}`) return {outcome: 'refused', rule: 'invalid-deck-reference'};
        const parentPath = new URL(String(doc.fields.deck), `https://local.test/${doc.path}`).pathname.slice(1);
        const parent = next.get(parentPath);
        if (parent?.type !== 'flashcard_deck') return {outcome: 'refused', rule: 'missing-reference-target'};
      }
    }
    this.docs = next;
    selections.forEach(selection => this.drafts.delete(selection.path));
    this.refreshQuery();
    if (this.observations.has('room-drafts')) this.publish('room-drafts', [...this.drafts.values()]);
    // Local queue admission only. This deliberately does not simulate a live
    // Provider acceptance, acknowledgment, retry worker, or confirmed revision.
    this.publish('sync-status', {state: 'pending', lastCompleted: T0, providerUnreachable: false, attentionRequired: [], reset: null});
    return {outcome: 'saved', identifier: `local-batch-${this.saves.length}`};
  });
  client() {return {rooms: this.rooms, query: this.query, observe: this.observe, roomDraft: this.roomDraft, presentation: this.presentation, save: this.save} as unknown as MdRuntimeClient;}
}

