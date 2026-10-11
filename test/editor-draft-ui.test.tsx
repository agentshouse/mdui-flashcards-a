import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router';
import type {HouseDataStore} from '../src/data/house';
import {Boundary, deckDoc, cardDoc, D1, C1, cardPath} from './house-boundary';
import {CreateDeckPage} from '../src/components/CreateDeckPage';
import {CardModal} from '../src/components/CardModal';
const holder = vi.hoisted(() => ({store: null as HouseDataStore | null}));
vi.mock('../src/data/house', async importOriginal => {
  const module = await importOriginal<typeof import('../src/data/house')>();
  return {...module, dataStore: {openEditor: (...args: Parameters<HouseDataStore['openEditor']>) => holder.store!.openEditor(...args)}};
});
const stores: HouseDataStore[] = [];
afterEach(() => {cleanup(); stores.splice(0).forEach(store => store.dispose()); vi.restoreAllMocks();});
async function start(boundary: Boundary) {
  const {HouseDataStore} = await vi.importActual<typeof import('../src/data/house')>('../src/data/house');
  const store = new HouseDataStore(async () => boundary.client()); stores.push(store); await store.start(); holder.store = store; return store;
}
describe('actual forms over durable Room Draft boundary', () => {
  it('restores collection typing after a full form/store remount without Save', async () => {
    const boundary = new Boundary([deckDoc(), cardDoc()]); await start(boundary);
    const mounted = render(<MemoryRouter><CreateDeckPage/></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Persistent collection'}});
    await waitFor(() => expect(boundary.writes.length).toBeGreaterThan(0));
    mounted.unmount(); await start(boundary);
    render(<MemoryRouter><CreateDeckPage/></MemoryRouter>);
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Persistent collection'));
    expect(boundary.saves).toHaveLength(0);
  });
  it('hydrates invalid card input and redraws a second mounted editor on typing', async () => {
    const boundary = new Boundary([deckDoc(), cardDoc()]); const store = await start(boundary);
    const initial = await store.getCard(C1);
    const one = render(<CardModal mode="edit" open initial={initial} deckId={D1} onClose={() => {}}/>);
    await act(async () => {});
    const boxes = screen.getAllByRole('textbox');
    fireEvent.change(boxes[0], {target: {value: ''}});
    fireEvent.change(boxes[1], {target: {value: 'Draft answer'}});
    await waitFor(() => expect(boundary.drafts.get(cardPath(C1))?.parts.fields?.back.value).toBe('Draft answer'));
    one.unmount();
    const next = await start(boundary);
    render(<CardModal mode="edit" open initial={await next.getCard(C1)} deckId={D1} onClose={() => {}}/>);
    await waitFor(() => expect((screen.getAllByRole('textbox')[1] as HTMLTextAreaElement).value).toBe('Draft answer'));
    expect((screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toBe('');
    const other = await next.openEditor('flashcard_card', await next.getCard(C1));
    await act(async () => {await other.write({front: 'Other tab typing'});});
    expect((screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toBe('Other tab typing');
    expect(boundary.saves).toHaveLength(0); other.close();
  });
});
