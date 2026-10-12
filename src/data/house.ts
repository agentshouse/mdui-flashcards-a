import {houseBridge} from '@agentshouse/app-bridge';
import {z} from 'zod';
import {v7 as uuidv7} from 'uuid';
import type {Card, Deck} from './model';
import type {DataStore} from './dataStore';

type Runtime = Awaited<ReturnType<typeof houseBridge>['runtime']>;
type Parts = Parameters<Runtime['roomDraft']['write']>[3];
type Document = {room: string; path: string; type?: string; fields?: Readonly<Record<string, unknown>>; markdown?: string};
const uuid = z.uuid();
const timestamp = z.iso.datetime({offset: true});
export const deckSchema = z.object({id: uuid, name: z.string().trim().min(1).max(200), createdAt: timestamp, updatedAt: timestamp});
export const cardSchema = z.object({id: uuid, deckId: uuid, front: z.string().min(1).max(50000).regex(/\S/), back: z.string().min(1).max(50000).regex(/\S/), createdAt: timestamp, updatedAt: timestamp, streak: z.number().int().min(0), intervalDays: z.number().int().min(0).max(60), nextReviewAt: timestamp});
const cardFieldsSchema = cardSchema.extend({deck: z.string().regex(/^\.\.\/decks\/[0-9a-f-]{36}\.md$/)});
export const OPENED = Symbol('opened House document');
type Opened = {[OPENED]?: Document};
export const flashcardQuery = {types: ['flashcard_deck', 'flashcard_card'], select: {fields: 'all' as const, markdown: true as const}, orderBy: [{by: {field: '/createdAt'}, direction: 'asc' as const}, {by: 'path' as const, direction: 'asc' as const}]};
export type StoreSnapshot = {decks: Deck[]; cards: Card[]; loading: boolean; error: string | null; status: string; halted: boolean; busy: boolean; version: number};
let connection: Promise<Runtime> | undefined;
export function houseRuntime() {
  connection ??= (async () => {const bridge = houseBridge(); bridge.setTab({title: 'Flashcards'}); return bridge.runtime;})();
  return connection;
}
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The only production data boundary. No fallback store or automatic sample seeding. */
export class HouseDataStore implements DataStore {
  private state: StoreSnapshot = {decks: [], cards: [], loading: true, error: null, status: '', halted: false, busy: false, version: 0};
  private listeners = new Set<() => void>();
  private close: (() => void)[] = [];
  private init?: Promise<void>;
  private md?: Runtime;
  private room?: string;
  private locked = false;
  private fatalError: string | null = null;
  private bindingReady = false;
  private disposed = false;
  private queryGeneration = 0;
  private provider: () => Promise<Runtime>;
  constructor(provider: () => Promise<Runtime> = houseRuntime) {this.provider = provider;}
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  snapshot = () => this.state;
  private fail(message: string) {this.fatalError = message; this.emit({error: message});}
  private emit(patch: Partial<StoreSnapshot>) {this.state = {...this.state, ...patch}; this.listeners.forEach(listener => listener());}
  start() {
    this.init ??= this.connect();
    return this.init;
  }
  private readDocuments(result: {documents: readonly Document[]}) {
    const decks: Deck[] = []; const cards: Card[] = []; const ids = new Set<string>();
    for (const doc of result.documents) {
      if (doc.room !== this.room) throw new Error('House returned a document outside the bound Room.');
      const schema = doc.type === 'flashcard_deck' ? deckSchema : doc.type === 'flashcard_card' ? cardFieldsSchema : null;
      if (!schema) throw new Error(`Unexpected document type at ${doc.path}.`);
      const fields = schema.parse(doc.fields);
      if (ids.has(fields.id)) throw new Error(`Duplicate flashcard identity at ${doc.path}.`);
      ids.add(fields.id);
      const item = Object.assign(fields, {[OPENED]: { ...doc, fields: {...doc.fields} }});
      if (doc.type === 'flashcard_deck') decks.push(item as Deck); else cards.push(item as Card);
    }
    for (const card of cards) if (!decks.some(deck => deck.id === card.deckId && (card as Card & {deck: string}).deck === `../decks/${deck.id}.md`)) throw new Error(`Card ${card.id} refers to a missing collection.`);
    // Preserve donor insertion chronology even when IDs come from mixed generators.
    // Date.parse also compares valid timestamp offsets as instants; path breaks ties.
    const byCreation = (a: Deck | Card, b: Deck | Card) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || ((a as Opened)[OPENED]!.path).localeCompare((b as Opened)[OPENED]!.path);
    decks.sort(byCreation); cards.sort(byCreation);
    this.emit({decks, cards, loading: false, error: this.fatalError, version: this.state.version + 1});
  }
  private async connect() {
    const timer = setTimeout(() => this.emit({loading: false, error: 'House has not supplied the runtime. Open this App inside House.'}), 15000);
    try {
      this.md = await this.provider();
      clearTimeout(timer);
      if (this.disposed) return;
      const md = this.md;
      const bindings = await md.observe('rooms');
      const sync = await md.observe('sync-status');
      if (this.disposed) {bindings.close(); sync.close(); return;}
      let query: {current(): {documents: readonly Document[]}; close(): void} | undefined;
      let stopQuery: (() => void) | undefined;
      let queryRoom: string | undefined;
      let loadingQuery: Promise<void> | undefined;
      const render = () => {
        if (!this.bindingReady || this.disposed || !query) return;
        try {this.readDocuments(query.current() as {documents: readonly Document[]});}
        catch (e) {this.emit({loading: false, error: errorText(e)});}
      };
      const showBindings = () => {
        if (this.disposed) return;
        const rooms = bindings.current();
        const status = sync.current();
        const completed = status.lastCompleted !== null;
        this.bindingReady = completed && rooms.length === 1;
        this.emit({status: status.attentionRequired.length ? 'House drafts need attention. Resolve them in House before editing those records.' : ''});
        if (!this.bindingReady) {
          this.emit({loading: !completed, error: this.fatalError ?? (completed ? 'The Room binding changed or is missing. Bind exactly one Flashcards Room to this App.' : null)});
          return;
        }
        this.room = rooms[0].locator;
        if (queryRoom === this.room) {render(); return;}
        queryRoom = this.room;
        const generation = ++this.queryGeneration;
        stopQuery?.(); query?.close(); query = undefined;
        this.emit({loading: true, error: this.fatalError});
        loadingQuery = (async () => {
          const next = await md.observe('query', {...flashcardQuery, rooms: [this.room!]});
          if (this.disposed || generation !== this.queryGeneration) {next.close(); return;}
          query = next;
          stopQuery = next.subscribe(render);
          render();
        })().catch(e => {if (!this.disposed && generation === this.queryGeneration) this.emit({loading: false, error: errorText(e)});});
      };
      this.close.push(bindings.subscribe(showBindings), () => bindings.close(), sync.subscribe(showBindings), () => sync.close(), () => {stopQuery?.(); query?.close();});
      showBindings();
      const watch = async <T>(pending: Promise<{current(): T; subscribe(fn: (value: T) => void): () => void; close(): void}>, apply: (value: T) => void) => {
        const observation = await pending;
        if (this.disposed) {observation.close(); return;}
        apply(observation.current());
        this.close.push(observation.subscribe(apply), () => observation.close());
      };
      await Promise.all([
        watch(md.observe('service-mode'), value => this.emit({halted: value === 'write-halted'})),
        watch(md.observe('connection-refusal'), value => {if (value) this.fail(`House connection refused: ${value.reason}`);}),
        watch(md.observe('storage-loss'), value => {if (value) this.fail('House reports that unsynchronized drafts or pending changes were lost. Check the Room before continuing.');}),
      ]);
      await loadingQuery;
    } catch(e) {if (!this.disposed) this.emit({loading: false, error: errorText(e)});} finally {clearTimeout(timer);}
  }
  dispose() {this.disposed = true; this.queryGeneration++; this.close.splice(0).forEach(fn => fn());}
  private async available() {
    await this.start();
    if (this.state.error) throw new Error(this.state.error);
    if (!this.bindingReady || this.state.loading) throw new Error('Loading Flashcards Room. Your open form is kept.');
    if (!this.md || !this.room) throw new Error('No Flashcards Room is bound.');
    return {md: this.md, room: this.room};
  }
  /** Shared, durable business-field drafts. Typing is local; only commit queues a Save. */
  async openEditor(type: 'flashcard_deck' | 'flashcard_card', initial?: Deck | Card, deckId?: string) {
    const {md, room} = await this.available();
    const opened = (initial as Opened | undefined)?.[OPENED];
    if (initial && (!opened || opened.room !== room)) throw new Error('Reopen this record from its Room before editing.');
    const scope = `${room}:${type}:${deckId ?? ''}`;
    const presentation = await md.presentation.read();
    const state = presentation && typeof presentation === 'object' ? presentation as Record<string, unknown> : {};
    const pointers = state.flashcardDrafts && typeof state.flashcardDrafts === 'object' ? state.flashcardDrafts as Record<string, string> : {};
    const pointer = !initial && typeof pointers[scope] === 'string' ? pointers[scope] : undefined;
    const held = pointer ? await md.roomDraft.read(room, pointer) : null;
    const creation = held?.parts.creation;
    const resumed = creation && 'type' in creation && creation.type === type && (!deckId || creation.fields.deckId === deckId) ? creation.fields : undefined;
    const now = new Date().toISOString();
    const base: Record<string, unknown> = initial ? {...initial} : resumed ? {...resumed} : {
      id: uuidv7(), createdAt: now, updatedAt: now,
      ...(type === 'flashcard_deck' ? {name: ''} : {deckId, deck: `../decks/${deckId}.md`, front: '', back: '', streak: 0, intervalDays: 0, nextReviewAt: now}),
    };
    uuid.parse(base.id);
    if (type === 'flashcard_card') uuid.parse(base.deckId);
    const path = opened?.path ?? `${type === 'flashcard_deck' ? 'decks' : 'cards'}/${base.id}.md`;
    if (resumed && path !== pointer) throw new Error('The saved draft pointer does not match its document identity.');
    type Draft = NonNullable<Awaited<ReturnType<Runtime['roomDraft']['read']>>>;
    const visible = () => (type === 'flashcard_deck' ? this.state.decks : this.state.cards).find(item => item.id === base.id);
    const fieldsOf = (draft: Draft | null): Record<string, unknown> => {
      const latest = visible();
      if (!draft) return {...base, ...latest};
      if (draft.parts.move || draft.parts.removal || draft.parts.markdown || draft.parts.sections || draft.parts.preamble) throw new Error('This document has structural draft changes. Review them in House before editing its fields.');
      if (draft.parts.creation) {
        const value = draft.parts.creation;
        if (!('type' in value) || value.type !== type || value.fields.id !== base.id) throw new Error('A different creation already occupies this draft path.');
        return {...value.fields, ...Object.fromEntries(Object.entries(draft.parts.fields ?? {}).map(([key, part]) => [key, part.value]))};
      }
      return {...base, ...latest, ...Object.fromEntries(Object.entries(draft.parts.fields ?? {}).map(([key, part]) => [key, part.value]))};
    };
    let activeDraft = await md.roomDraft.read(room, path);
    let fields = fieldsOf(activeDraft);
    let serial = Promise.resolve();
    let lastFailure: unknown;
    let observationFailure: unknown;
    let generation = 0;
    const pending = new Map<string, {value: unknown; generation: number}>();
    const listeners = new Set<(value: Record<string, unknown>) => void>();
    const value = () => ({...fields, ...Object.fromEntries([...pending].map(([key, item]) => [key, item.value]))});
    const redraw = () => listeners.forEach(listener => listener(value()));
    let observedGeneration = 0;
    const observation = await md.observe('room-drafts');
    const stop = observation.subscribe(drafts => {
      const draft = drafts.find(item => item.room === room && item.path === path) ?? null;
      activeDraft = draft; observedGeneration++;
      try {fields = fieldsOf(draft); observationFailure = undefined;} catch (error) {observationFailure = error;} redraw();
    });
    activeDraft = observation.current().find(item => item.room === room && item.path === path) ?? null;
    fields = fieldsOf(activeDraft);
    const stopVisible = this.subscribe(() => {try {fields = fieldsOf(activeDraft); observationFailure = undefined;} catch (error) {observationFailure = error;} redraw();});
    const writable = type === 'flashcard_deck' ? ['name'] : ['front', 'back'];
    const write = (patch: Record<string, unknown>) => {
      if (Object.keys(patch).some(key => !writable.includes(key))) return Promise.reject(new Error('Only editable business fields may be drafted.'));
      const currentGeneration = ++generation;
      for (const [key, field] of Object.entries(patch)) pending.set(key, {value: field, generation: currentGeneration});
      redraw();
      const next = serial.then(async () => {
        if (this.state.error) throw new Error(this.state.error);
        if (!this.bindingReady || this.room !== room) throw new Error('The original Room is not currently available.');
        let current = await md.roomDraft.read(room, path);
        for (;;) {
          const flushing = new Map(pending);
          if (!flushing.size) return;
          const latestPatch: Record<string, unknown> = {...Object.fromEntries([...flushing].map(([key, item]) => [key, item.value])), updatedAt: new Date().toISOString()};
          fieldsOf(current); // Never overwrite structural drafts or another identity.
          const currentDocument = (visible() as Opened | undefined)?.[OPENED] ?? opened;
          const parts: Parts = currentDocument && !current?.parts.creation ? {...current?.parts, fields: {...current?.parts.fields,
            ...Object.fromEntries(Object.entries(latestPatch).map(([key, field]) => [key, {value: field, base: current?.parts.fields?.[key] ? current.parts.fields[key].base : key in (currentDocument.fields ?? {}) ? {value: currentDocument.fields?.[key]} : null}])),
          }} : {...current?.parts, creation: {type, fields: {...fieldsOf(current), ...latestPatch}, sections: current?.parts.creation && 'sections' in current.parts.creation ? current.parts.creation.sections : {}}, ...(current?.parts.fields ? {fields: Object.fromEntries(Object.entries(current.parts.fields).map(([key, part]) => [key, key in latestPatch ? {...part, value: latestPatch[key]} : part]))} : {})};
          const result = await md.roomDraft.write(room, path, current?.revision ?? null, parts);
          if (result.outcome === 'stale') {current = result.current; continue;}
          for (;;) {
            const before = observedGeneration;
            const latest = await md.roomDraft.read(room, path);
            if (before !== observedGeneration) continue;
            activeDraft = latest; fields = fieldsOf(latest); break;
          }
          for (const [key, item] of flushing) if (pending.get(key)?.generation === item.generation) pending.delete(key);
          lastFailure = undefined; redraw();
          if (!opened) {
            const currentState = await md.presentation.read();
            const object = currentState && typeof currentState === 'object' ? currentState as Record<string, unknown> : {};
            const previous = object.flashcardDrafts && typeof object.flashcardDrafts === 'object' ? object.flashcardDrafts as Record<string, string> : {};
            await md.presentation.write({...object, flashcardDrafts: {...previous, [scope]: path}});
          }
          return;
        }
      });
      serial = next.catch(error => {lastFailure = error;});
      return next;
    };
    return {
      path, value, write,
      error: () => observationFailure ? errorText(observationFailure) : lastFailure ? errorText(lastFailure) : undefined,
      subscribe(listener: (fields: Record<string, unknown>) => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
      close() {stop(); stopVisible(); observation.close(); listeners.clear();},
      commit: async () => {
        await serial;
        if (lastFailure) throw lastFailure;
        await this.mutation(async (runtime, currentRoom) => {
          if (currentRoom !== room) throw new Error('The original Room binding changed.');
          const draft = await runtime.roomDraft.read(room, path);
          const schema = type === 'flashcard_deck' ? deckSchema : cardFieldsSchema;
          schema.parse(fieldsOf(draft));
          if (draft) {
            const result = await runtime.save(room, [{path, revision: draft.revision}]);
            if (result.outcome !== 'saved') throw new Error(`House refused the save (${result.outcome}${'rule' in result ? `: ${result.rule}` : ''}). Your draft is retained.`);
          }
        });
        return (type === 'flashcard_deck' ? this.state.decks : this.state.cards).find(item => item.id === base.id) as Deck | Card;
      },
    };
  }
  async getDecks() {await this.available(); return this.state.decks;}
  async getDeck(id: string) {return (await this.getDecks()).find(deck => deck.id === id);}
  async getCards(deckId: string) {await this.available(); return this.state.cards.filter(card => card.deckId === deckId);}
  async getCard(id: string) {await this.available(); return this.state.cards.find(card => card.id === id);}
  private async mutation<T>(action: (md: Runtime, room: string) => Promise<T>) {
    if (this.locked) throw new Error('A save is already in progress. Wait before trying again.');
    this.locked = true; this.emit({busy: true});
    try {
      const {md, room} = await this.available();
      const answer = await action(md, room);
      const result = await md.query({...flashcardQuery, rooms: [room]});
      if (this.bindingReady && this.room === room) this.readDocuments(result);
      return answer;
    } finally {this.locked = false; this.emit({busy: false});}
  }
  private async save(md: Runtime, room: string, changes: {path: string; parts: Parts}[]) {
    if (!changes.length) return;
    if (!this.bindingReady || this.room !== room) throw new Error("The Room binding is not ready. Your drafts are retained.");
    for (const item of changes) if (await md.roomDraft.read(room, item.path)) throw new Error('This record has an unfinished House draft. Resolve it in House before editing again.');
    const drafts = [];
    for (const item of changes) {
      const result = await md.roomDraft.write(room, item.path, null, item.parts);
      if (result.outcome !== 'written' || !result.roomDraft) throw new Error('The shared House draft changed in another tab. Your drafts are retained; review them in House.');
      drafts.push({path: item.path, revision: result.roomDraft.revision});
    }
    if (!this.bindingReady || this.room !== room) throw new Error("The Room binding changed during save. Your drafts are retained.");
    const result = await md.save(room, drafts);
    if (result.outcome !== 'saved') throw new Error(`House refused the save (${result.outcome}${'rule' in result ? `: ${result.rule}` : ''}). Your drafts are retained in House; review them before retrying.`);
  }
  private async upsert<T extends Deck | Card>(input: T, type: 'flashcard_deck' | 'flashcard_card'): Promise<T> {
    const schema = type === 'flashcard_deck' ? deckSchema : cardFieldsSchema;
    const fields = schema.parse(type === 'flashcard_card' ? {...input, deck: `../decks/${(input as Card).deckId}.md`} : input);
    const opened = (input as Opened)[OPENED];
    await this.mutation(async (md, room) => {
      const result = await md.query({...flashcardQuery, rooms: [room]});
      const current = result.documents.find(doc => doc.fields?.id === fields.id);
      if (type === 'flashcard_card' && !result.documents.some(doc => doc.type === 'flashcard_deck' && doc.fields?.id === (fields as Card).deckId)) throw new Error('The collection no longer exists.');
      if (!opened) {
        if (current) throw new Error('This identity already exists. Reopen the record before editing it.');
        await this.save(md, room, [{path: `${type === 'flashcard_deck' ? 'decks' : 'cards'}/${fields.id}.md`, parts: {creation: {type, fields, sections: {}}}}]);
        return;
      }
      if (opened.room !== room || !current || current.path !== opened.path || current.type !== type) throw new Error('This record moved or was removed. Reopen it before editing.');
      if (fields.id !== opened.fields?.id || ('deckId' in fields && fields.deckId !== opened.fields?.deckId)) throw new Error('A record identity or collection cannot be changed.');
      const delta = Object.fromEntries(Object.entries(fields).filter(([key, value]) => key !== 'updatedAt' && !equal(value, opened.fields?.[key])));
      if (!Object.keys(delta).length) return;
      delta.updatedAt = new Date().toISOString();
      schema.parse({...current.fields, ...delta});
      const changes = Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, {value, base: {value: opened.fields?.[key]}}]));
      await this.save(md, room, [{path: opened.path, parts: {fields: changes}}]);
    });
    return (type === 'flashcard_deck' ? await this.getDeck(fields.id) : await this.getCard(fields.id)) as T;
  }
  upsertDeck(deck: Deck) {return this.upsert(deck, 'flashcard_deck');}
  upsertCard(card: Card) {return this.upsert(card, 'flashcard_card');}
  private async remove(items: (Deck | Card)[], deck?: Deck) {
    await this.mutation(async (md, room) => {
      const result = await md.query({...flashcardQuery, rooms: [room]});
      if (deck) {
        const expected = items.filter(item => 'deckId' in item).map(item => item.id).sort();
        const current = result.documents.filter(doc => doc.type === 'flashcard_card' && doc.fields?.deckId === deck.id).map(doc => doc.fields!.id).sort();
        if (!equal(expected, current)) throw new Error('The collection’s cards changed. Close this dialog, review the cards, and try again.');
      }
      const changes = items.map(item => {
        const opened = (item as Opened)[OPENED];
        const current = result.documents.find(doc => doc.path === opened?.path);
        if (!opened?.markdown || opened.room !== room || !current || current.markdown !== opened.markdown) throw new Error('A selected record changed. Close this dialog and review it before deleting.');
        return {path: opened.path, parts: {removal: {base: opened.markdown}}};
      });
      await this.save(md, room, changes);
    });
  }
  deleteCard(card: Card) {return this.remove([card]);}
  deleteDeck(deck: Deck, cards: Card[]) {return this.remove([deck, ...cards], deck);}
}
export const dataStore = new HouseDataStore();

export type EditorSession = Awaited<ReturnType<HouseDataStore["openEditor"]>>;
