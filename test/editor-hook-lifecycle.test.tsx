import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {HouseDataStore} from '../src/data/house';
import type {Card} from '../src/data/model';
import {useEditorDraft} from '../src/data/useEditorDraft';
import {Boundary, C1, C2, card, cardDoc, cardPath, deckDoc, gate} from './house-boundary';

const holder = vi.hoisted(() => ({open: undefined as HouseDataStore['openEditor'] | undefined}));
vi.mock('../src/data/house', async importOriginal => {
  const module = await importOriginal<typeof import('../src/data/house')>();
  return {...module, dataStore: {openEditor: (...args: Parameters<HouseDataStore['openEditor']>) => holder.open!(...args)}};
});
const stores: HouseDataStore[] = [];
afterEach(() => {cleanup(); stores.splice(0).forEach(store => store.dispose()); vi.restoreAllMocks();});

function Editor({initial}: {initial: Card}) {
  const draft = useEditorDraft('flashcard_card', initial);
  return <>
    <input aria-label="Card front" value={String(draft.fields.front ?? '')} onChange={event => draft.write({front: event.target.value})}/>
    {draft.error && <p role="alert">{draft.error}</p>}
  </>;
}
const front = () => screen.getByRole('textbox', {name: 'Card front'}) as HTMLInputElement;
async function start() {
  const boundary = new Boundary([deckDoc(), cardDoc(), cardDoc({...card(C2), front: 'Second card'})]);
  const {HouseDataStore} = await vi.importActual<typeof import('../src/data/house')>('../src/data/house');
  const store = new HouseDataStore(async () => boundary.client()); stores.push(store); await store.start();
  holder.open = store.openEditor.bind(store);
  return {boundary, store, one: (await store.getCard(C1))!, two: (await store.getCard(C2))!};
}

describe('editor hook isolates asynchronous work by document', () => {
  it.each(['resolve', 'reject'] as const)('ignores an old opening %s after switching A to B', async outcome => {
    const {boundary, store, one, two} = await start();
    const delayed = gate();
    holder.open = async (...args) => {
      const session = await store.openEditor(...args);
      if (args[1]?.id === C1) {
        await delayed.promise;
        if (outcome === 'reject') {session.close(); throw new Error('Old opening failed');}
      }
      return session;
    };
    const mounted = render(<Editor initial={one}/>);
    mounted.rerender(<Editor initial={two}/>);
    expect(front().value).toBe('Second card');
    fireEvent.change(front(), {target: {value: 'Typing in B'}});
    await waitFor(() => expect(boundary.drafts.get(cardPath(C2))?.parts.fields?.front.value).toBe('Typing in B'));
    await act(async () => {delayed.release();});
    expect(front().value).toBe('Typing in B');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(boundary.drafts.has(cardPath(C1))).toBe(false);
  });

  it('does not show an old A write failure in the newly opened B editor', async () => {
    const {boundary, one, two} = await start();
    const delayed = gate(); const entered = gate();
    const original = boundary.roomDraft.write.getMockImplementation()!;
    boundary.roomDraft.write.mockImplementation(async (...args) => {
      if (args[1] === cardPath(C1)) {entered.release(); await delayed.promise; throw new Error('A write failed');}
      return original(...args);
    });
    const mounted = render(<Editor initial={one}/>);
    fireEvent.change(front(), {target: {value: 'A pending'}});
    await act(async () => {await entered.promise;});
    mounted.rerender(<Editor initial={two}/>);
    fireEvent.change(front(), {target: {value: 'B durable'}});
    await waitFor(() => expect(boundary.drafts.get(cardPath(C2))?.parts.fields?.front.value).toBe('B durable'));
    await act(async () => {delayed.release();});
    expect(front().value).toBe('B durable');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not let an old A write success hide a current B write failure', async () => {
    const {boundary, one, two} = await start();
    const delayed = gate(); const entered = gate();
    const original = boundary.roomDraft.write.getMockImplementation()!;
    boundary.roomDraft.write.mockImplementation(async (...args) => {
      if (args[1] === cardPath(C1)) {entered.release(); await delayed.promise; return original(...args);}
      throw new Error('B write failed');
    });
    const mounted = render(<Editor initial={one}/>);
    fireEvent.change(front(), {target: {value: 'A pending'}});
    await act(async () => {await entered.promise;});
    mounted.rerender(<Editor initial={two}/>);
    fireEvent.change(front(), {target: {value: 'B retained input'}});
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('B write failed'));
    await act(async () => {delayed.release();});
    expect(screen.getByRole('alert').textContent).toBe('B write failed');
    expect(front().value).toBe('B retained input');
  });

  it('shows and clears structural draft errors from observation without another edit', async () => {
    const {boundary, one} = await start();
    render(<Editor initial={one}/>);
    await act(async () => {});
    act(() => {boundary.draft(cardPath(C1), {removal: {base: boundary.docs.get(cardPath(C1))!.markdown}});});
    expect(screen.getByRole('alert').textContent).toMatch(/structural draft changes/i);
    expect(front().value).toBe('Question');
    act(() => {boundary.draft(cardPath(C1), {fields: {front: {value: 'Other editor input', base: {value: 'Question'}}}});});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(front().value).toBe('Other editor input');
    expect(boundary.saves).toHaveLength(0);
  });
});
