import {useState} from 'react';
import {v7 as uuidv7} from 'uuid';
import type {ReactNode} from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router';
import type {Card, Deck} from '../src/data/model';
import CardForm from '../src/components/CardForm';
import CreateDeckForm from '../src/components/CreateDeckForm';
import {CardModal} from '../src/components/CardModal';
import {Modal} from '../src/components/Modal';
import {ViewDeckPage} from '../src/components/ViewDeckPage';
import {ReviewPage} from '../src/components/ReviewPage';
import Home from '../src/components/Home';
import {DashboardPage} from '../src/components/DashboardPage';
import Layout from '../src/components/Layout';

// Actual donor components, editors, router, forms, and dialogs run in jsdom.
// Only the House store/context boundaries are mocked. These are not visual or
// live House tests, and markdown network safety is covered separately.
const boundary = vi.hoisted(() => {
  type State = {decks: Deck[]; cards: Card[]; version: number; loading: boolean; busy: boolean; halted: boolean; error: string | null; status: string};
  let state: State = {decks: [], cards: [], version: 0, loading: false, busy: false, halted: false, error: null, status: 'Saved in House'};
  const listeners = new Set<() => void>();
  const snapshot = () => state;
  const update = (patch: Partial<State>) => {state = {...state, ...patch}; listeners.forEach(listener => listener());};
  return {
    snapshot, update,
    subscribe: (listener: () => void) => {listeners.add(listener); return () => {listeners.delete(listener);};},
    getDeck: vi.fn(), getDecks: vi.fn(), getCard: vi.fn(), getCards: vi.fn(),
    openEditor: vi.fn(), upsertCard: vi.fn(), upsertDeck: vi.fn(), deleteCard: vi.fn(), deleteDeck: vi.fn(),
  };
});
vi.mock('../src/data/house', () => ({dataStore: boundary}));
vi.mock('../src/context/DataContext', async () => {
  const {useSyncExternalStore} = await import('react');
  return {useDataStore: () => useSyncExternalStore(boundary.subscribe, boundary.snapshot)};
});

const DECK_ID = '11111111-1111-4111-8111-111111111111';
const T0 = '2026-01-01T00:00:00.000Z';
const deck: Deck = {id: DECK_ID, name: 'Biology', createdAt: T0, updatedAt: T0};
const card = (n = 1, patch: Partial<Card> = {}): Card => ({id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`, deckId: DECK_ID, front: `Question ${n}`, back: `Answer ${n}`, createdAt: T0, updatedAt: T0, streak: 0, intervalDays: 0, nextReviewAt: T0, ...patch});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};
function saveCard(value: Card) {
  const state = boundary.snapshot();
  const existing = state.cards.some(item => item.id === value.id);
  boundary.update({cards: existing ? state.cards.map(item => item.id === value.id ? value : item) : [...state.cards, value], version: state.version + 1});
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.update({decks: [deck], cards: [], version: 0, loading: false, busy: false, halted: false, error: null, status: 'Saved in House'});
  boundary.getDeck.mockImplementation(async (id: string) => boundary.snapshot().decks.find(value => value.id === id));
  boundary.getDecks.mockImplementation(async () => boundary.snapshot().decks);
  boundary.getCard.mockImplementation(async (id: string) => boundary.snapshot().cards.find(value => value.id === id));
  boundary.getCards.mockImplementation(async (id: string) => boundary.snapshot().cards.filter(value => value.deckId === id));
  boundary.upsertCard.mockImplementation(async (value: Card) => saveCard(value));
  boundary.openEditor.mockImplementation(async (type: string, initial?: Deck | Card, deckId?: string) => {
    let fields = initial ? {...initial} : type === 'flashcard_deck'
      ? {id: uuidv7(), name: '', createdAt: T0, updatedAt: T0}
      : {...card(), id: uuidv7(), deckId, front: '', back: ''};
    const listeners = new Set<(value: Record<string, unknown>) => void>();
    return {value: () => fields, write: async (patch: Record<string, unknown>) => {fields = {...fields, ...patch}; listeners.forEach(fn => fn(fields));},
      subscribe: (fn: (value: Record<string, unknown>) => void) => {listeners.add(fn); return () => listeners.delete(fn);}, close: () => listeners.clear(),
      commit: () => type === 'flashcard_deck' ? boundary.upsertDeck(fields) : boundary.upsertCard(fields)};
  });
  boundary.upsertDeck.mockImplementation(async (value: Deck) => {
    const state = boundary.snapshot();
    boundary.update({decks: state.decks.map(item => item.id === value.id ? value : item), version: state.version + 1});
    return value;
  });
  boundary.deleteCard.mockImplementation(async (value: Card) => {const state = boundary.snapshot(); boundary.update({cards: state.cards.filter(item => item.id !== value.id), version: state.version + 1});});
  boundary.deleteDeck.mockImplementation(async (value: Deck) => {const state = boundary.snapshot(); boundary.update({decks: state.decks.filter(item => item.id !== value.id), cards: state.cards.filter(item => item.deckId !== value.id), version: state.version + 1});});
});
afterEach(() => {cleanup(); vi.restoreAllMocks();});

function route(element: ReactNode, suffix = '') {
  return render(<MemoryRouter initialEntries={[`/decks/${DECK_ID}${suffix}`]}><Routes><Route path={`/decks/:deckId${suffix}`} element={element}/><Route path="/dashboard" element={<h1>Library destination</h1>}/></Routes></MemoryRouter>);
}
function fillCard(front: string, back: string, scope: HTMLElement = document.body) {
  const textboxes = within(scope).getAllByRole('textbox');
  expect(textboxes).toHaveLength(2);
  fireEvent.change(textboxes[0], {target: {value: front}});
  fireEvent.change(textboxes[1], {target: {value: back}});
  return textboxes as HTMLTextAreaElement[];
}
async function reveal() {
  fireEvent.click(await screen.findByRole('button', {name: 'Reveal Answer'}));
  await waitFor(() => expect(screen.queryByRole('button', {name: 'Reveal Answer'})).toBeNull());
}

describe('donor forms with House failures', () => {
  it('validates the collection name and retains it after a rejected save', async () => {
    const submit = vi.fn(async () => {throw new Error('House refused the collection');});
    render(<CreateDeckForm onSubmit={submit}/>);
    const input = screen.getByLabelText('Collection Name') as HTMLInputElement;
    fireEvent.change(input, {target: {value: '   '}});
    fireEvent.click(screen.getByRole('button', {name: 'Create Collection'}));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a collection name.');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(input, {target: {value: '  Biology notes  '}});
    fireEvent.click(screen.getByRole('button', {name: 'Create Collection'}));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('House refused the collection'));
    expect(submit).toHaveBeenCalledWith({name: 'Biology notes'});
    expect(input.value).toBe('  Biology notes  ');
    expect((screen.getByRole('button', {name: 'Create Collection'}) as HTMLButtonElement).disabled).toBe(false);
  });

  it('validates both card faces and keeps the complete draft after a failed save', async () => {
    const submit = vi.fn(async () => {throw new Error('The opened card changed in another tab');});
    render(<CardForm onSubmit={submit}/>);
    fillCard(' ', ' ');
    fireEvent.click(screen.getByRole('button', {name: 'Create Card'}));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(submit).not.toHaveBeenCalled();
    const [front, back] = fillCard('**Saved question draft**', 'Saved answer draft');
    fireEvent.click(screen.getByRole('button', {name: 'Create Card'}));
    expect((await screen.findByRole('alert')).textContent).toContain('opened card changed');
    expect(front.value).toBe('**Saved question draft**');
    expect(back.value).toBe('Saved answer draft');
    expect(submit).toHaveBeenCalledWith({front: '**Saved question draft**', back: 'Saved answer draft'});
  });

  it('disables the collection submit action while saving', async () => {
    const pending = deferred<void>();
    const submit = vi.fn(() => pending.promise);
    render(<CreateDeckForm onSubmit={submit}/>);
    fireEvent.change(screen.getByLabelText('Collection Name'), {target: {value: 'Biology'}});
    fireEvent.click(screen.getByRole('button', {name: 'Create Collection'}));
    const saving = await screen.findByRole('button', {name: 'Creating...'});
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saving);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    expect((screen.getByRole('button', {name: 'Create Collection'}) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('light-surface helper text contrast', () => {
  it.each(['home', 'layout', 'dashboard', 'create', 'collection', 'review'])('uses the stronger gray for meaningful labels on %s', page => {
    boundary.update({cards: [card()]});
    const view = page === 'collection' ? route(<ViewDeckPage/>)
      : page === 'review' ? route(<ReviewPage studyMode={false}/>, '/review')
      : render(<MemoryRouter>{page === 'home' ? <Home/>
        : page === 'layout' ? <Layout><p>Contents</p></Layout>
        : page === 'dashboard' ? <DashboardPage/>
        : <CreateDeckForm onSubmit={async () => {}}/>}</MemoryRouter>);
    const paleText = [...view.container.querySelectorAll('.text-zinc-400')].filter(element => element.namespaceURI !== 'http://www.w3.org/2000/svg');
    expect(paleText.map(element => element.textContent)).toEqual([]);
    expect(view.container.querySelectorAll('.text-zinc-600').length).toBeGreaterThan(0);
    if (page === 'create') expect(screen.getByLabelText('Collection Name').classList.contains('placeholder:text-zinc-600')).toBe(true);
  });
});

describe('card modal interrupted saves', () => {
  it('does not close a newly opened modal or replace its draft when an old save resolves', async () => {
    const pending = deferred<Card>();
    boundary.upsertCard.mockImplementationOnce(() => pending.promise);
    const close = vi.fn();
    const created = vi.fn();
    const props = {mode: 'create' as const, deckId: DECK_ID, onClose: close, onCreated: created};
    const view = render(<CardModal {...props} open/>);
    fillCard('Old question', 'Old answer', screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', {name: 'Create Card'}));
    await waitFor(() => expect(boundary.upsertCard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(close).toHaveBeenCalledTimes(1);
    view.rerender(<CardModal {...props} open={false}/>);
    view.rerender(<CardModal {...props} open/>);
    const [front, back] = fillCard('New question draft', 'New answer draft', screen.getByRole('dialog'));
    await act(async () => pending.resolve(boundary.upsertCard.mock.calls[0][0] as Card));
    expect(created).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(front.value).toBe('New question draft');
    expect(back.value).toBe('New answer draft');
  });

  it('preserves indented code and edge whitespace exactly through the actual editor save', async () => {
    const front = '\n    const initial = true;\n\n';
    const back = '\tinitial answer\ntrailing hard break  \n';
    const original = card(1, {front, back});
    const updated = vi.fn();
    render(<CardModal mode="edit" open deckId={DECK_ID} initial={original} onClose={vi.fn()} onUpdated={updated}/>);
    const textboxes = within(screen.getByRole('dialog')).getAllByRole('textbox') as HTMLTextAreaElement[];
    expect(textboxes[0].value).toBe(front);
    expect(textboxes[1].value).toBe(back);
    const nextFront = '\n    const edited = true;\n\n';
    const nextBack = '\tupdated answer\nline break  \n ';
    fillCard(nextFront, nextBack, screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', {name: 'Update Card'}));
    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(boundary.upsertCard.mock.calls[0][0].front).toBe(nextFront);
    expect(boundary.upsertCard.mock.calls[0][0].back).toBe(nextBack);
    expect(updated.mock.calls[0][0].front).toBe(nextFront);
    expect(updated.mock.calls[0][0].back).toBe(nextBack);
  });

  it('preserves original SRS fields when updating only card content', async () => {
    const original = card(1, {streak: 5, intervalDays: 10, nextReviewAt: '2030-01-01T00:00:00.000Z'});
    const updated = vi.fn();
    const close = vi.fn();
    render(<CardModal mode="edit" open deckId={DECK_ID} initial={original} onClose={close} onUpdated={updated}/>);
    fillCard('Edited question', 'Edited answer', screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', {name: 'Update Card'}));
    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(boundary.upsertCard.mock.calls[0][0]).toMatchObject({id: original.id, deckId: DECK_ID, front: 'Edited question', back: 'Edited answer', createdAt: T0, streak: 5, intervalDays: 10, nextReviewAt: original.nextReviewAt});
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('collection rename interruption', () => {
  it('keeps a reopened rename draft when the older save completes', async () => {
    const pending = deferred<Deck>();
    boundary.upsertDeck.mockImplementationOnce(async () => {
      const saved = await pending.promise;
      boundary.update({decks: [saved], version: boundary.snapshot().version + 1});
      return saved;
    });
    route(<ViewDeckPage/>);
    await screen.findByRole('heading', {name: 'Biology'});
    fireEvent.click(screen.getByRole('button', {name: 'Rename deck'}));
    const first = screen.getByRole('textbox', {name: 'Deck name'});
    fireEvent.change(first, {target: {value: 'Name A'}});
    fireEvent.keyDown(first, {key: 'Enter'});
    await waitFor(() => expect(boundary.upsertDeck).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(first, {key: 'Escape'});
    fireEvent.click(screen.getByRole('button', {name: 'Rename deck'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Deck name'}), {target: {value: 'Name B draft'}});
    await act(async () => pending.resolve({...deck, name: 'Name A'}));
    const reopened = screen.getByRole('textbox', {name: 'Deck name'}) as HTMLInputElement;
    expect(reopened.value).toBe('Name B draft');
    expect(boundary.upsertDeck).toHaveBeenCalledTimes(1);
  });
});

describe('landing page donor responsive classes', () => {
  it('retains a three-column informational-card layout on desktop and one column on phone', () => {
    render(<MemoryRouter><Home/></MemoryRouter>);
    const section = screen.getByRole('heading', {name: 'On learning & memory'}).closest('section');
    const grid = section?.querySelector('.grid');
    expect(grid?.classList.contains('grid-cols-1')).toBe(true);
    expect(grid?.classList.contains('md:grid-cols-3')).toBe(true);
    expect(grid?.classList.contains('md:grid-cols-1')).toBe(false);
    expect(grid?.classList.contains('sm:grid-cols-3')).toBe(false);
  });
});

describe('collection pagination using actual card creation flow', () => {
  it.each([0, 12])('shows the newly created card after %s existing cards', async count => {
    boundary.update({cards: Array.from({length: count}, (_, i) => card(i + 1))});
    route(<ViewDeckPage/>);
    await screen.findByRole('heading', {name: 'Biology'});
    await waitFor(() => expect(screen.getByText(`${count} ${count === 1 ? 'card' : 'cards'} • Ready to master`)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', {name: 'Add New Card'}));
    fillCard('Newly added question', 'Newly added answer', screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', {name: 'Create Card'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Newly added question')).toBeTruthy();
    expect(screen.getByText(`${count + 1} ${count === 0 ? 'card' : 'cards'} • Ready to master`)).toBeTruthy();
    expect(boundary.upsertCard).toHaveBeenCalledTimes(1);
    if (count === 12) {
      expect(screen.getByText('2 of 2')).toBeTruthy();
      expect(screen.queryByText('Question 1')).toBeNull();
    } else expect(screen.queryByText(/0 of/)).toBeNull();
  });
});

describe('mixed UUID collection ordering', () => {
  it('shows the created UUIDv7 card on its observed page without a duplicate', async () => {
    const existing = Array.from({length: 12}, (_, i) => card(i + 1, {id: `aaaaaaaa-aaaa-5aaa-8aaa-${String(i + 1).padStart(12, '0')}`}));
    boundary.update({cards: existing});
    // Return path order here deliberately. The page callback must also be robust
    // if an observed order puts the new card before older UUIDv5 sample cards.
    boundary.upsertCard.mockImplementationOnce(async (value: Card) => {
      const cards = [...boundary.snapshot().cards, value].sort((a, b) => a.id.localeCompare(b.id));
      boundary.update({cards, version: boundary.snapshot().version + 1});
      return value;
    });
    route(<ViewDeckPage/>);
    await screen.findByRole('heading', {name: 'Biology'});
    await waitFor(() => expect(screen.getByText('12 cards • Ready to master')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', {name: 'Add New Card'}));
    fillCard('Mixed-ID new question', 'Mixed-ID new answer', screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', {name: 'Create Card'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Mixed-ID new question')).toBeTruthy();
    expect(screen.getAllByText('Mixed-ID new question')).toHaveLength(1);
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('13 cards • Ready to master')).toBeTruthy();
    expect(boundary.snapshot().cards).toHaveLength(13);
  });
});

describe('study and review donor behavior', () => {
  it('reviews all cards including future cards, supports back/restart, and never grades', async () => {
    const initial = [card(1), card(2, {nextReviewAt: '2099-01-01T00:00:00.000Z'})];
    boundary.update({cards: initial});
    route(<ReviewPage studyMode={false}/>, '/review');
    expect(await screen.findByText('Question 1')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    await reveal();
    expect(screen.getByText('Answer 1')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Previous Card'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', {name: 'Got It'})).toBeNull();
    expect(screen.queryByRole('button', {name: 'Forgot'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Next Card'}));
    expect(await screen.findByText('Question 2')).toBeTruthy();
    await reveal();
    fireEvent.click(screen.getByRole('button', {name: 'Previous Card'}));
    expect(await screen.findByText('Question 1')).toBeTruthy();
    await reveal();
    fireEvent.click(screen.getByRole('button', {name: 'Next Card'}));
    await reveal();
    fireEvent.click(screen.getByRole('button', {name: 'Go to Beginning'}));
    expect(await screen.findByText('Question 1')).toBeTruthy();
    expect(boundary.upsertCard).not.toHaveBeenCalled();
    expect(boundary.snapshot().cards).toEqual(initial);
  });

  it('studies due cards only, persists Got It SRS, and guards a repeated grade while saving', async () => {
    boundary.update({cards: [card(1), card(2), card(3, {nextReviewAt: '2099-01-01T00:00:00.000Z'})]});
    const pending = deferred<Card>();
    boundary.upsertCard.mockImplementationOnce(async () => saveCard(await pending.promise));
    route(<ReviewPage studyMode/>, '/study');
    expect(await screen.findByText('Question 1')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    await reveal();
    const gotIt = screen.getByRole('button', {name: 'Got It'});
    const before = Date.now();
    act(() => {fireEvent.click(gotIt); fireEvent.click(gotIt);});
    expect(boundary.upsertCard).toHaveBeenCalledTimes(1);
    const graded = boundary.upsertCard.mock.calls[0][0] as Card;
    expect(graded).toMatchObject({id: card(1).id, front: 'Question 1', back: 'Answer 1', streak: 1, intervalDays: 1});
    expect(Date.parse(graded.nextReviewAt)).toBeGreaterThanOrEqual(before + 86400000);
    expect(Date.parse(graded.nextReviewAt)).toBeLessThanOrEqual(Date.now() + 86400000);
    expect((gotIt as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Forgot'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(graded));
    expect(await screen.findByText('Question 2')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(boundary.upsertCard).toHaveBeenCalledTimes(1);
  });

  it('resets forgotten cards to due now and repeats them at the end of the queue', async () => {
    boundary.update({cards: [card(1, {streak: 5, intervalDays: 10})]});
    route(<ReviewPage studyMode/>, '/study');
    await screen.findByText('Question 1');
    await reveal();
    const before = Date.now();
    fireEvent.click(screen.getByRole('button', {name: 'Forgot'}));
    await waitFor(() => expect(boundary.upsertCard).toHaveBeenCalledTimes(1));
    const graded = boundary.upsertCard.mock.calls[0][0] as Card;
    expect(graded).toMatchObject({streak: 0, intervalDays: 0});
    expect(Date.parse(graded.nextReviewAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(graded.nextReviewAt)).toBeLessThanOrEqual(Date.now());
    expect(await screen.findByText('Question 1')).toBeTruthy();
    expect(await screen.findByRole('button', {name: 'Reveal Answer'})).toBeTruthy();
    expect(screen.queryByText('Perfect Session')).toBeNull();
  });

  it('retains the current answer and offers retry when grading is refused', async () => {
    boundary.update({cards: [card(1), card(2)]});
    boundary.upsertCard.mockRejectedValueOnce(new Error('A shared draft needs attention'));
    route(<ReviewPage studyMode/>, '/study');
    await screen.findByText('Question 1');
    await reveal();
    fireEvent.click(screen.getByRole('button', {name: 'Got It'}));
    expect((await screen.findByRole('alert')).textContent).toContain('shared draft needs attention');
    expect(screen.getByText('Answer 1')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Got It'}) as HTMLButtonElement).disabled).toBe(false);
    expect(boundary.snapshot().cards[0].streak).toBe(0);
  });

  it('shows completion when no cards are due without mutating schedules', async () => {
    boundary.update({cards: [card(1, {nextReviewAt: '2099-01-01T00:00:00.000Z'})]});
    route(<ReviewPage studyMode/>, '/study');
    expect(await screen.findByText('Perfect Session')).toBeTruthy();
    expect(boundary.getCards).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'Reveal Answer'})).toBeNull();
    expect(boundary.upsertCard).not.toHaveBeenCalled();
  });
});

describe('modal keyboard and focus behavior', () => {
  it('labels the dialog, traps Tab at its edges, closes with Escape, and restores focus', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      // Buttons-only fixture avoids jsdom's mixed-selector ordering quirk for
      // nested buttons and inputs; actual browser focus order is not asserted.
      return <><button onClick={() => setOpen(true)}>Open editor</button><Modal open={open} onClose={() => setOpen(false)} title="Edit details"><p>Draft content</p><button>Last action</button></Modal></>;
    }
    render(<Harness/>);
    const trigger = screen.getByRole('button', {name: 'Open editor'});
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', {name: 'Edit details'});
    const close = within(dialog).getByRole('button', {name: 'Close'});
    const last = within(dialog).getByRole('button', {name: 'Last action'});
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(document, {key: 'Tab', shiftKey: true});
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});


describe('full-card reading without editing or grading', () => {
  const longQuestion = 'Почему полная формулировка вопроса должна быть доступна читателю? '.repeat(24);
  const questionEnd = 'Последняя строка длинного вопроса видна полностью.';
  const answerEnd = 'Последняя строка подробного ответа тоже доступна.';
  const longCard = () => card(1, {front: `${longQuestion}

${questionEnd}`, back: `${'Подробное объяснение ответа. '.repeat(40)}

${answerEnd}`});

  it('opens complete long Russian Markdown from an always-visible separate control and never opens an editor', async () => {
    const initial = [longCard()];
    boundary.update({cards: initial});
    route(<ViewDeckPage/>);
    const expand = await screen.findByRole('button', {name: 'Expand card'});
    expect(expand.getAttribute('aria-haspopup')).toBe('dialog');
    expect(expand.className).not.toMatch(/opacity-0/);
    expect(expand.closest('[role="button"]')).toBeNull();
    fireEvent.click(expand);
    const dialog = screen.getByRole('dialog', {name: 'Full card'});
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    const body = within(dialog).getByRole('region', {name: 'Full card text'});
    expect(body.textContent).toContain(questionEnd);
    expect(body.querySelector('.wmde-markdown')?.textContent).toContain(longQuestion.trim());
    expect(body.querySelector('[class*="line-clamp"]')).toBeNull();
    expect(body.querySelector('.wmde-markdown')?.getAttribute('data-color-mode')).toBe('light');
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Show answer'}));
    expect(body.textContent).toContain(answerEnd);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Show question'}));
    expect(body.textContent).toContain(questionEnd);
    expect(boundary.openEditor).not.toHaveBeenCalled();
    expect(boundary.upsertCard).not.toHaveBeenCalled();
    expect(boundary.snapshot().cards).toEqual(initial);
  });

  it('preserves grid flipping and opens the currently visible face', async () => {
    boundary.update({cards: [card()]});
    route(<ViewDeckPage/>);
    const showAnswer = await screen.findByRole('button', {name: 'Show answer'});
    expect(showAnswer.tagName).toBe('BUTTON');
    fireEvent.click(showAnswer);
    expect(screen.getByRole('button', {name: 'Show question'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Expand card'}));
    const dialog = screen.getByRole('dialog', {name: 'Full card'});
    expect(within(dialog).getByRole('region').textContent).toContain('Answer 1');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Close'}));
    expect(screen.getByRole('button', {name: 'Show question'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Show question'}));
    expect(screen.getByRole('button', {name: 'Show answer'})).toBeTruthy();
  });

  it('traps focus, resets scroll for each side, restores focus after observed updates and supports reopening', async () => {
    boundary.update({cards: [longCard()]});
    route(<ViewDeckPage/>);
    const expand = await screen.findByRole('button', {name: 'Expand card'});
    expand.focus(); fireEvent.click(expand);
    const dialog = screen.getByRole('dialog', {name: 'Full card'});
    const close = within(dialog).getByRole('button', {name: 'Close'});
    const switchSide = within(dialog).getByRole('button', {name: 'Show answer'});
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(document, {key: 'Tab', shiftKey: true});
    expect(document.activeElement).toBe(switchSide);
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(document.activeElement).toBe(close);
    const body = within(dialog).getByRole('region');
    body.scrollTop = 400;
    fireEvent.click(within(dialog).getByRole('button', {name: 'Answer'}));
    expect(body.scrollTop).toBe(0);
    act(() => boundary.update({cards: [longCard()], version: 1}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(expand);
    expect(document.body.style.overflow).not.toBe('hidden');
    fireEvent.click(expand);
    expect(within(screen.getByRole('dialog')).getByRole('region').textContent).toContain(questionEnd);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Close'}));
    expect(document.activeElement).toBe(expand);
    expect(boundary.openEditor).not.toHaveBeenCalled();
  });

  it('uses the observed current card and dismisses cleanly if that card disappears', async () => {
    boundary.update({cards: [card()]});
    route(<ViewDeckPage/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Expand card'}));
    act(() => boundary.update({cards: [card(1, {front: 'Updated externally'})], version: 1}));
    expect(within(screen.getByRole('dialog')).getByText('Updated externally')).toBeTruthy();
    act(() => boundary.update({cards: [], version: 2}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', {name: 'Create First Card'})).toBeTruthy();
    expect(boundary.upsertCard).not.toHaveBeenCalled();
  });

  it('keeps the existing edit route independent of the reader and flips', async () => {
    boundary.update({cards: [card()]});
    route(<ViewDeckPage/>);
    const edit = (await screen.findAllByRole('button', {name: 'Edit card'}))[0];
    fireEvent.click(edit);
    expect(screen.getByRole('dialog', {name: 'Edit Card'})).toBeTruthy();
    expect(screen.queryByRole('dialog', {name: 'Full card'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Show answer'})).toBeTruthy();
    await waitFor(() => expect(boundary.openEditor).toHaveBeenCalledTimes(1));
    expect(boundary.upsertCard).not.toHaveBeenCalled();
  });
});
