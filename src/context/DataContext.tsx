import {createContext, useContext, useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {dataStore, type StoreSnapshot} from '../data/house';
import type {Deck} from '../data/model';
const DataContext = createContext<(StoreSnapshot & {setDecks: (decks: Deck[]) => void}) | undefined>(undefined);
export function DataProvider({children}: {children: ReactNode}) {
  const value = useSyncExternalStore(dataStore.subscribe, dataStore.snapshot);
  useEffect(() => {void dataStore.start();}, []);
  return <DataContext value={{...value, setDecks: () => { /* Room observation is authoritative. */ }}}>
    {(value.error || value.halted || value.status) && <div className="house-status" role={value.error ? 'alert' : 'status'}>
      {value.error ?? (value.halted ? 'Changes stay saved locally while House synchronization is paused.' : value.status)}
    </div>}
    {value.loading && <main className="p-12" role="status">Loading…</main>}
    {value.error && <main className="p-12"><h1 className="text-3xl mb-4">Flashcards needs attention</h1><p>{value.error}</p></main>}
    {value.version > 0 && <div hidden={value.loading || !!value.error} inert={value.loading || !!value.error}>{children}</div>}
  </DataContext>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useDataStore() {const value = useContext(DataContext); if (!value) throw new Error('DataProvider is missing.'); return value;}
